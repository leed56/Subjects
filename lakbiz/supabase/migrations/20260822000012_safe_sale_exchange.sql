-- LakBiz safe customer exchange workflow.
--
-- Accounting model:
--   ORIGINAL SALE stays immutable.
--   RETURN creates the physical RTN document.
--   CREDIT NOTE recognizes the returned value / VAT reversal.
--   REPLACEMENT is a brand-new normal CREDIT sale for the same customer.
--   EXCHANGE applies available return credit against that new sale's customer
--   receivable without discounting or rewriting either invoice.
--
-- This first exchange phase deliberately requires a real customer account.
-- Walk-in exchanges need a generalized tender/allocation ledger and are not
-- guessed as cash, discount or refund. That keeps revenue, VAT and receivables
-- auditable while still supporting equal, cheaper and more-expensive exchanges.

-- Exchange is another settlement mechanism, but it references the replacement
-- sale explicitly so the audit trail can always explain where the credit went.
alter table public.sale_return_settlements
  add column if not exists replacement_sale_id text
    references public.sales_base(id) on delete restrict;

alter table public.sale_return_settlements
  drop constraint if exists sale_return_settlements_settlement_type_check;
alter table public.sale_return_settlements
  add constraint sale_return_settlements_settlement_type_check
  check (settlement_type in (
    'receivable_reduction', 'bank_refund', 'external_refund', 'exchange'
  ));

alter table public.sale_return_settlements
  drop constraint if exists sale_return_settlements_exchange_shape_check;
alter table public.sale_return_settlements
  add constraint sale_return_settlements_exchange_shape_check
  check (
    (
      settlement_type = 'exchange'
      and replacement_sale_id is not null
      and bank_account_id is null
      and external_method is null
    )
    or
    (
      settlement_type <> 'exchange'
      and replacement_sale_id is null
    )
  );

-- A replacement invoice can consume return credit once only. This intentionally
-- conservative phase avoids silently spreading several returns across one sale.
create unique index if not exists sale_return_settlements_exchange_sale_uq
  on public.sale_return_settlements(organization_id, replacement_sale_id)
  where settlement_type = 'exchange' and replacement_sale_id is not null;

create index if not exists sale_return_settlements_exchange_return_idx
  on public.sale_return_settlements(organization_id, return_id, created_at)
  where settlement_type = 'exchange';

create or replace function public.apply_sale_return_exchange(
  p_organization_id uuid,
  p_return_id uuid,
  p_settlement_id uuid,
  p_replacement_sale_id text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_return record;
  v_note record;
  v_original record;
  v_replacement record;
  v_customer record;
  v_existing record;
  v_before numeric(14,2);
  v_total numeric(14,2);
  v_remaining numeric(14,2);
  v_amount numeric(14,2);
  v_status text;
  v_all_exchange boolean;
begin
  if p_organization_id is null
     or p_return_id is null
     or p_settlement_id is null
     or nullif(btrim(coalesce(p_replacement_sale_id, '')), '') is null then
    raise exception 'organization, return, settlement and replacement sale are required'
      using errcode = '22023';
  end if;

  if not public.can_see_org_financials(p_organization_id) then
    raise exception 'owner approval is required for exchange credit'
      using errcode = '42501';
  end if;

  -- Network retry / double-click idempotency.
  select * into v_existing
  from public.sale_return_settlements s
  where s.id = p_settlement_id
    and s.organization_id = p_organization_id
    and s.return_id = p_return_id;

  if found then
    if v_existing.settlement_type <> 'exchange'
       or v_existing.replacement_sale_id is distinct from p_replacement_sale_id then
      raise exception 'settlement id already belongs to a different operation'
        using errcode = '23505';
    end if;

    select r.settlement_status into v_status
    from public.sale_returns r
    where r.id = p_return_id and r.organization_id = p_organization_id;

    select coalesce(sum(s.amount), 0) into v_total
    from public.sale_return_settlements s
    where s.organization_id = p_organization_id and s.return_id = p_return_id;

    select greatest(0, n.gross_credit - v_total) into v_remaining
    from public.sale_credit_notes n
    where n.organization_id = p_organization_id and n.return_id = p_return_id;

    return jsonb_build_object(
      'ok', true,
      'replayed', true,
      'settlement_id', v_existing.id,
      'settlement_status', v_status,
      'applied_amount', v_existing.amount,
      'remaining_return_credit', coalesce(v_remaining, 0),
      'replacement_sale_id', v_existing.replacement_sale_id
    );
  end if;

  -- Lock the return first so exchange and normal refund settlement cannot race.
  select r.* into v_return
  from public.sale_returns r
  where r.id = p_return_id
    and r.organization_id = p_organization_id
  for update;
  if not found then
    raise exception 'return not found' using errcode = 'P0002';
  end if;

  select n.* into v_note
  from public.sale_credit_notes n
  where n.organization_id = p_organization_id
    and n.return_id = p_return_id;
  if not found then
    raise exception 'issue the credit note before creating an exchange'
      using errcode = '23514';
  end if;

  select s.id, s.customer_id, s.customer_name, s.sale_date
  into v_original
  from public.sales_base s
  where s.id = v_return.sale_id
    and s.organization_id = p_organization_id;
  if not found then
    raise exception 'original sale not found' using errcode = 'P0002';
  end if;

  if v_original.customer_id is null then
    raise exception 'safe exchange requires a customer account on the original sale'
      using errcode = '23514';
  end if;

  if p_replacement_sale_id = v_original.id then
    raise exception 'replacement sale must be a new invoice'
      using errcode = '23514';
  end if;

  select
    s.id, s.bill_no, s.customer_id, s.customer_name, s.sale_date,
    s.payment_method, s.total, s.credit_amount
  into v_replacement
  from public.sales_base s
  where s.id = p_replacement_sale_id
    and s.organization_id = p_organization_id
  for update;
  if not found then
    raise exception 'replacement sale not found' using errcode = 'P0002';
  end if;

  if v_replacement.customer_id is distinct from v_original.customer_id then
    raise exception 'replacement sale must belong to the same customer account'
      using errcode = '23514';
  end if;

  if v_replacement.payment_method <> 'credit' or coalesce(v_replacement.credit_amount, 0) <= 0 then
    raise exception 'replacement sale must be recorded as a credit sale before applying exchange credit'
      using errcode = '23514';
  end if;

  -- Do not allow an unrelated historical credit invoice to be relabelled as an
  -- exchange. The replacement sale must be issued after the credit note exists.
  if v_replacement.sale_date < v_note.issued_at then
    raise exception 'replacement sale must be created after the return credit note'
      using errcode = '23514';
  end if;

  if exists (
    select 1
    from public.sale_return_settlements s
    where s.organization_id = p_organization_id
      and s.settlement_type = 'exchange'
      and s.replacement_sale_id = p_replacement_sale_id
  ) then
    raise exception 'replacement sale already has return credit applied'
      using errcode = '23505';
  end if;

  select coalesce(sum(s.amount), 0) into v_before
  from public.sale_return_settlements s
  where s.organization_id = p_organization_id
    and s.return_id = p_return_id;

  v_remaining := round(v_note.gross_credit - v_before, 2);
  if v_remaining <= 0.005 then
    raise exception 'return credit is already fully settled'
      using errcode = '23514';
  end if;

  -- Automatically apply only what both sides can legitimately absorb:
  -- cheaper replacement -> leaves return credit open;
  -- equal replacement -> settles return exactly;
  -- dearer replacement -> leaves the price difference as normal receivable.
  v_amount := round(least(v_remaining, v_replacement.credit_amount), 2);
  if v_amount <= 0 then
    raise exception 'no exchange credit can be applied to this replacement sale'
      using errcode = '23514';
  end if;

  select c.* into v_customer
  from public.customers c
  where c.id = v_original.customer_id
    and c.organization_id = p_organization_id
  for update;
  if not found then
    raise exception 'customer account not found' using errcode = 'P0002';
  end if;

  -- The new CREDIT sale must still have enough receivable outstanding to absorb
  -- the exchange. This also stops negative/global customer balances.
  if v_amount > v_customer.credit_balance + 0.005 then
    raise exception 'customer outstanding balance is lower than the exchange credit; reconcile recent payments first'
      using errcode = '23514';
  end if;

  update public.customers
  set credit_balance = greatest(0, credit_balance - v_amount),
      updated_at = now()
  where id = v_customer.id and organization_id = p_organization_id;

  insert into public.sale_return_settlements (
    id, organization_id, return_id, credit_note_id,
    settlement_type, amount, replacement_sale_id, note, created_by
  ) values (
    p_settlement_id, p_organization_id, p_return_id, v_note.id,
    'exchange', v_amount, p_replacement_sale_id,
    'Exchange credit applied to replacement bill ' || coalesce(v_replacement.bill_no, v_replacement.id),
    auth.uid()
  );

  select
    coalesce(sum(s.amount), 0),
    coalesce(bool_and(s.settlement_type = 'exchange'), false)
  into v_total, v_all_exchange
  from public.sale_return_settlements s
  where s.organization_id = p_organization_id
    and s.return_id = p_return_id;

  v_remaining := greatest(0, round(v_note.gross_credit - v_total, 2));
  if v_remaining > 0.005 then
    v_status := 'partial';
  elsif v_all_exchange then
    v_status := 'exchange';
  else
    v_status := 'settled_mixed';
  end if;

  update public.sale_returns
  set settlement_status = v_status,
      settled_at = case when v_remaining <= 0.005 then now() else null end
  where id = p_return_id and organization_id = p_organization_id;

  -- Exchange changes the AppData-backed customer receivable. Force other
  -- devices to pull the authoritative snapshot before any older push.
  update public.organizations
  set sync_generation = sync_generation + 1
  where id = p_organization_id;

  return jsonb_build_object(
    'ok', true,
    'replayed', false,
    'settlement_id', p_settlement_id,
    'settlement_status', v_status,
    'applied_amount', v_amount,
    'remaining_return_credit', v_remaining,
    'replacement_sale_id', p_replacement_sale_id,
    'replacement_bill_no', v_replacement.bill_no,
    'replacement_credit_difference', greatest(0, round(v_replacement.credit_amount - v_amount, 2))
  );
end;
$$;

revoke all on function public.apply_sale_return_exchange(uuid, uuid, uuid, text)
  from public, anon;
grant execute on function public.apply_sale_return_exchange(uuid, uuid, uuid, text)
  to authenticated;

comment on function public.apply_sale_return_exchange(uuid, uuid, uuid, text) is
  'Owner-only exchange: applies issued return credit to a new same-customer CREDIT sale without mutating either invoice.';
