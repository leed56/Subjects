-- Close the remaining legacy-checkout consistency gap.
--
-- The first completed-invoice migration made the header and lines atomic, but
-- the old browser sync still had to append stock, credit, bank and cheque
-- rows afterward.  This wrapper keeps the original validation routine as the
-- authority for the immutable invoice, then applies all dependent state in
-- the same transaction.  The optional context is owner/cashier supplied data
-- only for identifiers and display snapshots; quantities, prices, stock and
-- credit amounts are derived from the server-side invoice.

create function ledger_internal.record_completed_invoice(
  p_organization_id uuid,
  p_sale jsonb,
  p_lines jsonb,
  p_context jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_result jsonb;
  v_org record;
  v_customer record;
  v_product record;
  v_line jsonb;
  v_context_customer jsonb;
  v_context_bank jsonb;
  v_context_cheque jsonb;
  v_context_log jsonb;
  v_customer_id text;
  v_product_id text;
  v_sale_id text;
  v_method text;
  v_qty numeric;
  v_bank_rows integer;
  v_log_id text;
  v_cheque_id text;
begin
  if auth.uid() is null
     or not public.org_member_can_write_module(p_organization_id, 'sales')
     or not public.org_member_role_in(p_organization_id, array['owner','manager','data_entry','cashier']) then
    raise exception 'Sale permission required' using errcode='42501';
  end if;

  if coalesce((p_context->>'atomic_side_effects')::boolean, false) = false then
    return ledger_internal.record_completed_invoice(p_organization_id, p_sale, p_lines);
  end if;

  v_sale_id := nullif(btrim(p_sale->>'id'), '');
  v_customer_id := nullif(btrim(p_sale->>'customer_id'), '');
  v_method := nullif(btrim(p_sale->>'payment_method'), '');
  if v_sale_id is null then
    raise exception 'Invoice id is required' using errcode='22023';
  end if;

  -- New local customers are registered inside the same transaction as their
  -- first invoice. Existing customer profiles are deliberately not overwritten
  -- by a stale retry; only their server credit balance is changed below.
  if v_customer_id is not null then
    select c.* into v_customer
    from public.customers c
    where c.id = v_customer_id and c.organization_id = p_organization_id
    for update;
    if not found then
      v_context_customer := p_context->'customer';
      if jsonb_typeof(v_context_customer) is distinct from 'object'
         or nullif(btrim(v_context_customer->>'id'), '') is distinct from v_customer_id
         or nullif(btrim(v_context_customer->>'name'), '') is null then
        raise exception 'Customer record is required before invoice commit' using errcode='42501';
      end if;
      insert into public.customers (
        id, organization_id, name, phone, address, credit_balance,
        contact_type, contact_person, vat_number, credit_limit
      ) values (
        v_customer_id, p_organization_id, btrim(v_context_customer->>'name'),
        nullif(btrim(v_context_customer->>'phone'), ''),
        nullif(btrim(v_context_customer->>'address'), ''), 0,
        coalesce(nullif(v_context_customer->>'contact_type', ''), 'individual'),
        nullif(btrim(v_context_customer->>'contact_person'), ''),
        nullif(btrim(v_context_customer->>'vat_number'), ''),
        nullif(v_context_customer->>'credit_limit', '')::numeric
      );
    end if;
  end if;

  v_context_cheque := p_context->'cheque';
  if v_method = 'cheque' and jsonb_typeof(v_context_cheque) = 'object' then
    v_cheque_id := nullif(btrim(coalesce(p_sale->>'cheque_id', v_context_cheque->>'id')), '');
    if v_cheque_id is null then
      raise exception 'Cheque identity is required' using errcode='22023';
    end if;
    insert into public.cheques (
      id, organization_id, direction, cheque_no, bank_name, party_name,
      customer_id, amount, cheque_date, post_dated, status, linked_sale_id,
      bank_account_id, note, created_at, updated_at
    ) values (
      v_cheque_id, p_organization_id, 'received',
      nullif(btrim(v_context_cheque->>'cheque_no'), ''),
      nullif(btrim(v_context_cheque->>'bank_name'), ''),
      v_customer_id,
      (v_context_cheque->>'amount')::numeric,
      (v_context_cheque->>'cheque_date')::date,
      coalesce((v_context_cheque->>'post_dated')::boolean, false),
      coalesce(nullif(v_context_cheque->>'status', ''), 'pending'),
      v_sale_id,
      nullif(btrim(v_context_cheque->>'bank_account_id'), ''),
      nullif(btrim(v_context_cheque->>'note'), ''), now(), now()
    ) on conflict (id) do nothing;
  end if;

  -- The original three-argument routine validates payment method, derives
  -- price/cost/profit and inserts the immutable header and lines.  Any error
  -- below rolls that invoice back as well.
  v_result := ledger_internal.record_completed_invoice(p_organization_id, p_sale, p_lines);
  if coalesce((v_result->>'replayed')::boolean, false) then
    return v_result;
  end if;

  select o.* into v_org
  from public.organizations o
  where o.id = p_organization_id
  for update;
  if not found then raise exception 'Organization not found' using errcode='P0002'; end if;

  -- Lock, validate and decrement each product once.  The client-supplied
  -- quantity is checked against the locked server stock and never trusted as a
  -- replacement stock value.
  for v_line in select value from jsonb_array_elements(p_lines) loop
    v_product_id := nullif(btrim(v_line->>'product_id'), '');
    v_qty := (v_line->>'qty')::numeric;
    select p.* into v_product
    from public.products_base p
    where p.id = v_product_id and p.organization_id = p_organization_id
    for update;
    if not found or coalesce(v_product.active, true) = false then
      raise exception 'Active product is required for stock commit' using errcode='42501';
    end if;
    if v_product.stock_qty < v_qty then
      raise exception 'Insufficient stock for %' , v_product.name using errcode='23514';
    end if;
    update public.products_base
    set stock_qty = stock_qty - v_qty, updated_at = now()
    where id = v_product_id and organization_id = p_organization_id;

    v_context_log := (
      select value from jsonb_array_elements(coalesce(p_context->'stock_logs', '[]'::jsonb))
      where nullif(btrim(value->>'product_id'), '') = v_product_id
      limit 1
    );
    v_log_id := coalesce(nullif(btrim(v_context_log->>'id'), ''), gen_random_uuid()::text);
    insert into public.stock_logs (
      id, organization_id, product_id, product_name, log_type, qty, note,
      log_date, user_id, created_at
    ) values (
      v_log_id, p_organization_id, v_product_id, v_product.name, 'sale', v_qty,
      coalesce(nullif(btrim(v_context_log->>'note'), ''), 'Bill ' || v_sale_id),
      coalesce(nullif(v_context_log->>'log_date', '')::timestamptz, now()),
      auth.uid(), now()
    ) on conflict (id) do nothing;
  end loop;

  if v_method = 'credit' and v_customer_id is not null then
    update public.customers
    set credit_balance = credit_balance + (p_sale->>'total')::numeric,
        updated_at = now()
    where id = v_customer_id and organization_id = p_organization_id;
  end if;

  v_context_bank := p_context->'bank_transaction';
  if v_method in ('card', 'bank_transfer') and jsonb_typeof(v_context_bank) = 'object' then
    if nullif(btrim(v_context_bank->>'account_id'), '') is null
       or not exists (
         select 1 from public.bank_accounts b
         where b.id = v_context_bank->>'account_id'
           and b.organization_id = p_organization_id
       ) then
      raise exception 'Bank account is not available for this invoice' using errcode='P0002';
    end if;
    if round((v_context_bank->>'amount')::numeric, 2) <> round((p_sale->>'total')::numeric, 2) then
      raise exception 'Bank receipt amount does not match invoice total' using errcode='23514';
    end if;
    insert into public.bank_transactions (
      id, organization_id, account_id, type, amount, description, reference,
      txn_date, created_at, updated_at
    ) values (
      v_context_bank->>'id', p_organization_id, v_context_bank->>'account_id',
      coalesce(v_context_bank->>'type', 'deposit'), (v_context_bank->>'amount')::numeric,
      v_context_bank->>'description', v_context_bank->>'reference',
      coalesce((v_context_bank->>'txn_date')::date, current_date), now(), now()
    ) on conflict (id) do nothing;
    get diagnostics v_bank_rows = row_count;
    if v_bank_rows = 1 then
      update public.bank_accounts
      set balance = balance + (v_context_bank->>'amount')::numeric, updated_at = now()
      where id = v_context_bank->>'account_id' and organization_id = p_organization_id;
    end if;
  end if;

  update public.organizations
  set sync_generation = sync_generation + 1
  where id = p_organization_id;
  return v_result;
end;
$$;

revoke all on function ledger_internal.record_completed_invoice(uuid,jsonb,jsonb,jsonb) from public, anon, authenticated;
grant execute on function ledger_internal.record_completed_invoice(uuid,jsonb,jsonb,jsonb) to authenticated;

create function public.record_completed_invoice(
  p_organization_id uuid,
  p_sale jsonb,
  p_lines jsonb,
  p_context jsonb
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select ledger_internal.record_completed_invoice(p_organization_id, p_sale, p_lines, p_context);
$$;

revoke all on function public.record_completed_invoice(uuid,jsonb,jsonb,jsonb) from public, anon;
grant execute on function public.record_completed_invoice(uuid,jsonb,jsonb,jsonb) to authenticated;

notify pgrst, 'reload schema';
