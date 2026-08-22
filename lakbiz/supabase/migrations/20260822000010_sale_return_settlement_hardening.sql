-- Follow-up hardening for the return-settlement RPC introduced in
-- 20260822000009. Keeps migrations append-only while tightening runtime
-- validation and the replay branch.

create or replace function public.settle_sale_return_credit(
  p_organization_id uuid,
  p_return_id uuid,
  p_settlement_id uuid,
  p_settlement_type text,
  p_amount numeric,
  p_bank_account_id text default null,
  p_external_method text default null,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_return record;
  v_note record;
  v_sale record;
  v_existing record;
  v_customer record;
  v_bank record;
  v_amount numeric(14,2);
  v_before numeric(14,2);
  v_total numeric(14,2);
  v_gross_credit numeric(14,2);
  v_remaining numeric(14,2);
  v_status text;
  v_all_receivable boolean;
  v_all_refund boolean;
begin
  if p_organization_id is null or p_return_id is null or p_settlement_id is null then
    raise exception 'organization, return and settlement id are required' using errcode = '22023';
  end if;
  if not public.can_see_org_financials(p_organization_id) then
    raise exception 'owner approval is required for return settlement' using errcode = '42501';
  end if;
  if p_settlement_type is null
     or p_settlement_type not in ('receivable_reduction', 'bank_refund', 'external_refund') then
    raise exception 'invalid settlement type' using errcode = '22023';
  end if;

  v_amount := round(coalesce(p_amount, 0), 2);
  if v_amount <= 0 then
    raise exception 'settlement amount must be positive' using errcode = '22023';
  end if;

  -- Network retry / double-click idempotency. Do not touch an unassigned
  -- RECORD field in this replay path; read only the scalar values needed.
  select * into v_existing
  from public.sale_return_settlements s
  where s.id = p_settlement_id
    and s.organization_id = p_organization_id
    and s.return_id = p_return_id;
  if found then
    select r.settlement_status into v_status
    from public.sale_returns r
    where r.id = p_return_id and r.organization_id = p_organization_id;

    select coalesce(sum(s.amount), 0) into v_total
    from public.sale_return_settlements s
    where s.organization_id = p_organization_id and s.return_id = p_return_id;

    select n.gross_credit into v_gross_credit
    from public.sale_credit_notes n
    where n.organization_id = p_organization_id and n.return_id = p_return_id;

    return jsonb_build_object(
      'ok', true,
      'replayed', true,
      'settlement_id', v_existing.id,
      'settlement_status', v_status,
      'settled_total', v_total,
      'remaining', greatest(0, coalesce(v_gross_credit, 0) - v_total)
    );
  end if;

  -- The return row lock serializes all settlement entries for this return.
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
    raise exception 'issue the credit note before settlement' using errcode = '23514';
  end if;

  select s.id, s.customer_id, s.customer_name into v_sale
  from public.sales_base s
  where s.id = v_return.sale_id
    and s.organization_id = p_organization_id;
  if not found then
    raise exception 'original sale not found' using errcode = 'P0002';
  end if;

  select coalesce(sum(s.amount), 0) into v_before
  from public.sale_return_settlements s
  where s.organization_id = p_organization_id
    and s.return_id = p_return_id;

  v_remaining := round(v_note.gross_credit - v_before, 2);
  if v_remaining <= 0 then
    raise exception 'return credit is already fully settled' using errcode = '23514';
  end if;
  if v_amount > v_remaining + 0.005 then
    raise exception 'settlement amount exceeds remaining return credit (%)', v_remaining using errcode = '23514';
  end if;

  if p_settlement_type = 'receivable_reduction' then
    if v_sale.customer_id is null then
      raise exception 'this sale has no customer account to reduce' using errcode = '23514';
    end if;

    select c.* into v_customer
    from public.customers c
    where c.id = v_sale.customer_id
      and c.organization_id = p_organization_id
    for update;
    if not found then
      raise exception 'customer account not found' using errcode = 'P0002';
    end if;
    if v_amount > v_customer.credit_balance + 0.005 then
      raise exception 'customer outstanding balance is only %', v_customer.credit_balance using errcode = '23514';
    end if;

    update public.customers
    set credit_balance = greatest(0, credit_balance - v_amount),
        updated_at = now()
    where id = v_customer.id and organization_id = p_organization_id;

  elsif p_settlement_type = 'bank_refund' then
    if nullif(btrim(coalesce(p_bank_account_id, '')), '') is null then
      raise exception 'bank account is required for bank refund' using errcode = '22023';
    end if;

    select b.* into v_bank
    from public.bank_accounts b
    where b.id = p_bank_account_id
      and b.organization_id = p_organization_id
    for update;
    if not found then
      raise exception 'bank account not found' using errcode = 'P0002';
    end if;

    update public.bank_accounts
    set balance = balance - v_amount,
        updated_at = now()
    where id = v_bank.id and organization_id = p_organization_id;

    insert into public.bank_transactions (
      id, organization_id, account_id, type, amount,
      description, reference, txn_date
    ) values (
      'return:' || p_settlement_id::text,
      p_organization_id,
      v_bank.id,
      'withdrawal',
      v_amount,
      'Customer return refund ' || v_return.return_no,
      v_note.credit_note_no,
      current_date
    );

  elsif p_settlement_type = 'external_refund' then
    if p_external_method is null
       or p_external_method not in ('cash', 'card', 'cheque', 'other') then
      raise exception 'external refund method is required' using errcode = '22023';
    end if;
  end if;

  insert into public.sale_return_settlements (
    id, organization_id, return_id, credit_note_id,
    settlement_type, amount, bank_account_id, external_method, note, created_by
  ) values (
    p_settlement_id, p_organization_id, p_return_id, v_note.id,
    p_settlement_type, v_amount,
    case when p_settlement_type = 'bank_refund' then p_bank_account_id else null end,
    case when p_settlement_type = 'external_refund' then p_external_method else null end,
    nullif(btrim(coalesce(p_note, '')), ''), auth.uid()
  );

  select
    coalesce(sum(s.amount), 0),
    coalesce(bool_and(s.settlement_type = 'receivable_reduction'), false),
    coalesce(bool_and(s.settlement_type in ('bank_refund', 'external_refund')), false)
  into v_total, v_all_receivable, v_all_refund
  from public.sale_return_settlements s
  where s.organization_id = p_organization_id
    and s.return_id = p_return_id;

  v_remaining := greatest(0, round(v_note.gross_credit - v_total, 2));
  if v_remaining > 0.005 then
    v_status := 'partial';
  elsif v_all_receivable then
    v_status := 'reduced_credit';
  elsif v_all_refund then
    v_status := 'settled_external';
  else
    v_status := 'settled_mixed';
  end if;

  update public.sale_returns
  set settlement_status = v_status,
      settled_at = case when v_remaining <= 0.005 then now() else null end
  where id = p_return_id and organization_id = p_organization_id;

  -- Customer receivable or bank balance changes live in AppData. Advance the
  -- generation so other devices cannot push an older local snapshot over them.
  if p_settlement_type in ('receivable_reduction', 'bank_refund') then
    update public.organizations
    set sync_generation = sync_generation + 1
    where id = p_organization_id;
  end if;

  return jsonb_build_object(
    'ok', true,
    'replayed', false,
    'settlement_id', p_settlement_id,
    'settlement_status', v_status,
    'settled_total', v_total,
    'remaining', v_remaining
  );
end;
$$;

revoke all on function public.settle_sale_return_credit(uuid, uuid, uuid, text, numeric, text, text, text) from public, anon;
grant execute on function public.settle_sale_return_credit(uuid, uuid, uuid, text, numeric, text, text, text) to authenticated;
