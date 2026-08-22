-- LakBiz POS payment-source privacy hardening.
--
-- The owner-only finance migration intentionally hides bank_accounts and cheques
-- from cashier/data-entry/manager sessions. A production POS must still accept
-- bank transfers and cheques without giving those roles access to the owner's
-- banking ledger. This migration keeps the existing atomic sale finalizer as the
-- accounting core and adds a privacy-preserving wrapper around it.
--
-- Rules:
--   * owner configures one hidden default bank destination for POS transfers;
--   * staff choose "Bank transfer" without receiving the account id/balance;
--   * an owner may explicitly override the destination account id;
--   * staff enter cheque no/bank/date as tender metadata; the wrapper creates the
--     protected cheque row inside the SAME transaction as the sale;
--   * direct cheque/account table access remains owner-only;
--   * bank-transfer receipts update the owner bank ledger only after the inner
--     atomic sale finalizer succeeds;
--   * replaying the same sale id never posts bank money or cheque records twice.

create table if not exists public.pos_payment_routes (
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  bank_account_id text not null references public.bank_accounts(id) on delete restrict,
  updated_by uuid,
  updated_at timestamptz not null default now()
);

alter table public.pos_payment_routes enable row level security;

drop policy if exists pos_payment_routes_select_owner on public.pos_payment_routes;
create policy pos_payment_routes_select_owner on public.pos_payment_routes
for select to authenticated using (public.can_see_org_financials(organization_id));

-- Route configuration is intentionally RPC-only so no broad historical policy
-- can accidentally let nonowners rewrite the destination.
revoke insert, update, delete on public.pos_payment_routes from authenticated;
grant select on public.pos_payment_routes to authenticated;

create or replace function public.configure_pos_bank_route(
  p_organization_id uuid,
  p_bank_account_id text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_organization_id is null
     or nullif(btrim(coalesce(p_bank_account_id, '')), '') is null then
    raise exception 'organization and bank account are required' using errcode = '22023';
  end if;

  if not public.can_see_org_financials(p_organization_id) then
    raise exception 'owner approval is required to configure POS banking' using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.bank_accounts b
    where b.id = p_bank_account_id
      and b.organization_id = p_organization_id
  ) then
    raise exception 'bank account not found for organization' using errcode = 'P0002';
  end if;

  insert into public.pos_payment_routes (
    organization_id, bank_account_id, updated_by, updated_at
  ) values (
    p_organization_id, p_bank_account_id, auth.uid(), now()
  )
  on conflict (organization_id) do update set
    bank_account_id = excluded.bank_account_id,
    updated_by = excluded.updated_by,
    updated_at = now();

  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.configure_pos_bank_route(uuid, text) from public, anon;
grant execute on function public.configure_pos_bank_route(uuid, text) to authenticated;

create or replace function public.finalize_sale_with_private_tenders(
  p_organization_id uuid,
  p_sale_id text,
  p_customer_id text default null,
  p_customer_name text default null,
  p_discount numeric default 0,
  p_lines jsonb default '[]'::jsonb,
  p_tenders jsonb default '[]'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tender jsonb;
  v_normalized_tenders jsonb := '[]'::jsonb;
  v_result jsonb;
  v_tender_id text;
  v_kind text;
  v_amount numeric(14,2);
  v_bank_account_id text;
  v_cheque_id text;
  v_cheque_no text;
  v_cheque_bank text;
  v_cheque_date date;
  v_post_dated boolean;
  v_party_name text;
  v_existing_cheque record;
  v_bill_no text;
  v_is_owner boolean := false;
begin
  if p_organization_id is null
     or nullif(btrim(coalesce(p_sale_id, '')), '') is null then
    raise exception 'organization_id and sale_id are required' using errcode = '22023';
  end if;

  if not public.org_member_can_write_module(p_organization_id, 'sales')
     or not public.org_member_role_in(
       p_organization_id,
       array['owner','manager','data_entry','cashier']
     ) then
    raise exception 'permission denied for sale finalization' using errcode = '42501';
  end if;

  v_is_owner := public.can_see_org_financials(p_organization_id);

  -- Important: let the already-idempotent inner finalizer answer replays before
  -- this wrapper creates any source rows or posts any bank movement.
  if exists (
    select 1 from public.sales_base s
    where s.id = p_sale_id
  ) then
    return public.finalize_sale_with_tenders(
      p_organization_id,
      p_sale_id,
      p_customer_id,
      p_customer_name,
      p_discount,
      p_lines,
      p_tenders
    );
  end if;

  if jsonb_typeof(coalesce(p_tenders, '[]'::jsonb)) <> 'array' then
    raise exception 'p_tenders must be a JSON array' using errcode = '22023';
  end if;

  if p_customer_id is not null then
    select c.name into v_party_name
    from public.customers c
    where c.id = p_customer_id
      and c.organization_id = p_organization_id;
    if not found then
      raise exception 'customer account not found' using errcode = 'P0002';
    end if;
  else
    v_party_name := coalesce(nullif(btrim(coalesce(p_customer_name, '')), ''), 'Walk-in customer');
  end if;

  for v_tender in
    select value from jsonb_array_elements(coalesce(p_tenders, '[]'::jsonb))
  loop
    v_tender_id := nullif(btrim(v_tender->>'id'), '');
    v_kind := nullif(btrim(v_tender->>'kind'), '');
    v_amount := round(coalesce(nullif(v_tender->>'amount', '')::numeric, 0), 2);

    if v_tender_id is null then
      raise exception 'tender id is required' using errcode = '22023';
    end if;

    if v_kind = 'bank_transfer' then
      v_bank_account_id := nullif(btrim(v_tender->>'bank_account_id'), '');

      -- Explicit bank ids are an owner-only override. Staff never need to read
      -- or guess bank_accounts ids; their transfer tender resolves the hidden
      -- organization route inside this SECURITY DEFINER function.
      if v_bank_account_id is not null and not v_is_owner then
        raise exception 'staff bank-transfer tenders must use the private POS route'
          using errcode = '42501';
      end if;

      if v_bank_account_id is null then
        select r.bank_account_id into v_bank_account_id
        from public.pos_payment_routes r
        where r.organization_id = p_organization_id;

        if not found then
          raise exception 'owner must configure the POS bank destination before bank-transfer checkout'
            using errcode = '23514';
        end if;
      end if;

      -- Lock the destination now; the lock is held through the inner sale commit
      -- and the bank-ledger posting below, closing concurrent balance updates.
      perform 1
      from public.bank_accounts b
      where b.id = v_bank_account_id
        and b.organization_id = p_organization_id
      for update;
      if not found then
        raise exception 'POS bank destination is unavailable' using errcode = 'P0002';
      end if;

      v_tender := v_tender || jsonb_build_object('bank_account_id', v_bank_account_id);

    elsif v_kind = 'cheque' then
      v_cheque_id := nullif(btrim(v_tender->>'cheque_id'), '');

      if v_cheque_id is not null then
        if not v_is_owner then
          raise exception 'staff cheque tenders must use inline cheque details'
            using errcode = '42501';
        end if;
      else
        v_cheque_no := nullif(btrim(v_tender->>'cheque_no'), '');
        v_cheque_bank := nullif(btrim(v_tender->>'cheque_bank'), '');
        v_cheque_date := case
          when nullif(btrim(v_tender->>'cheque_date'), '') is null then null
          else (v_tender->>'cheque_date')::date
        end;
        v_post_dated := coalesce((v_tender->>'post_dated')::boolean, false);

        if v_cheque_no is null or v_cheque_bank is null or v_cheque_date is null then
          raise exception 'cheque no, bank and date are required' using errcode = '22023';
        end if;
        if v_amount <= 0 then
          raise exception 'cheque tender amount must be positive' using errcode = '22023';
        end if;

        v_cheque_id := 'sale-tender:' || v_tender_id;

        select c.* into v_existing_cheque
        from public.cheques c
        where c.id = v_cheque_id;

        if found then
          if v_existing_cheque.organization_id is distinct from p_organization_id
             or v_existing_cheque.direction <> 'received'
             or abs(round(v_existing_cheque.amount, 2) - v_amount) > 0.005
             or v_existing_cheque.cheque_no <> v_cheque_no
             or v_existing_cheque.bank_name <> v_cheque_bank
             or v_existing_cheque.cheque_date <> v_cheque_date
             or v_existing_cheque.linked_sale_id is distinct from p_sale_id then
            raise exception 'cheque tender id conflicts with an existing cheque'
              using errcode = '23505';
          end if;
        else
          insert into public.cheques (
            id, organization_id, direction, cheque_no, bank_name, party_name,
            customer_id, amount, cheque_date, post_dated, status,
            linked_sale_id, note, created_at, updated_at
          ) values (
            v_cheque_id,
            p_organization_id,
            'received',
            v_cheque_no,
            v_cheque_bank,
            v_party_name,
            p_customer_id,
            v_amount,
            v_cheque_date,
            v_post_dated,
            'pending',
            null,
            'Created atomically from POS tender',
            now(),
            now()
          );
        end if;

        v_tender := v_tender || jsonb_build_object('cheque_id', v_cheque_id);
      end if;
    end if;

    v_normalized_tenders := v_normalized_tenders || jsonb_build_array(v_tender);
  end loop;

  -- The existing finalizer remains the single authority for invoice, stock,
  -- credit, return-credit and advanced-identity allocation. Any exception from
  -- it rolls back cheque creation and route work performed above.
  v_result := public.finalize_sale_with_tenders(
    p_organization_id,
    p_sale_id,
    p_customer_id,
    p_customer_name,
    p_discount,
    p_lines,
    v_normalized_tenders
  );

  if coalesce((v_result->>'replayed')::boolean, false) then
    return v_result;
  end if;

  v_bill_no := nullif(v_result->>'bill_no', '');

  -- Only a successfully finalized bank-transfer tender posts to the owner's
  -- bank ledger. Staff never read the account row; the source id is already
  -- protected in sale_tender_sources.
  for v_tender in
    select value from jsonb_array_elements(v_normalized_tenders)
  loop
    if (v_tender->>'kind') = 'bank_transfer' then
      v_tender_id := btrim(v_tender->>'id');
      v_amount := round((v_tender->>'amount')::numeric, 2);
      v_bank_account_id := btrim(v_tender->>'bank_account_id');

      insert into public.bank_transactions (
        id, organization_id, account_id, type, amount,
        description, reference, txn_date, created_at, updated_at
      ) values (
        'sale-tender:' || v_tender_id,
        p_organization_id,
        v_bank_account_id,
        'deposit',
        v_amount,
        'POS bank-transfer receipt',
        v_bill_no,
        current_date,
        now(),
        now()
      );

      update public.bank_accounts
      set balance = balance + v_amount,
          updated_at = now()
      where id = v_bank_account_id
        and organization_id = p_organization_id;
    end if;
  end loop;

  return v_result;
end;
$$;

revoke all on function public.finalize_sale_with_private_tenders(
  uuid, text, text, text, numeric, jsonb, jsonb
) from public, anon;
grant execute on function public.finalize_sale_with_private_tenders(
  uuid, text, text, text, numeric, jsonb, jsonb
) to authenticated;

comment on table public.pos_payment_routes is
  'Owner-only mapping from an organization POS to its hidden default bank destination. Operational staff can accept bank transfers without reading bank_accounts.';
comment on function public.configure_pos_bank_route(uuid, text) is
  'Owner-only configuration of the hidden bank destination used by staff POS bank-transfer tenders.';
comment on function public.finalize_sale_with_private_tenders(uuid, text, text, text, numeric, jsonb, jsonb) is
  'Privacy wrapper around finalize_sale_with_tenders: resolves hidden bank routing and creates protected received-cheque rows atomically before final sale commit.';
