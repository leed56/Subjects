-- LakBiz mixed-tender sale foundation — normalized payment audit + atomic sale finalization.
--
-- This migration deliberately lands BEFORE the POS UI is switched to mixed tender.
-- The existing local-first createSale/createSaleToCloud path remains untouched until
-- this database transaction is available on the verified LakBiz Supabase project.
--
-- Design rules:
--   * sale header, sale lines, aggregate stock, stock logs, customer credit,
--     tender rows, cheque linkage, return-credit consumption and advanced
--     inventory identity allocation succeed or fail as ONE PostgreSQL transaction;
--   * buy cost / profit are derived server-side from products_base and are never
--     accepted from a cashier payload;
--   * ordinary org members may read the customer-facing tender breakdown, but
--     bank / cheque / return source identifiers live in an owner-only relation;
--   * return-credit tender is owner-approved and becomes an immutable exchange
--     settlement against the brand-new replacement invoice;
--   * the legacy sales_base.payment_method column remains populated for existing
--     reports/readers: one tender keeps its normal method, multiple tenders use
--     the new display-only value `mixed`;
--   * client retries are idempotent by p_sale_id.

-- ─────────────────────────────────────────────────────────────────────────────
-- Customer-facing tender ledger
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.sale_tenders (
  id text primary key,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  sale_id text not null references public.sales_base(id) on delete restrict,
  kind text not null
    check (kind in ('cash', 'card', 'bank_transfer', 'cheque', 'credit', 'return_credit')),
  amount numeric(14, 2) not null check (amount > 0),
  note text,
  created_by uuid,
  created_at timestamptz not null default now()
);

create index if not exists sale_tenders_org_sale_idx
  on public.sale_tenders(organization_id, sale_id, created_at);

-- Sensitive payment-source references are physically separated from the
-- operational tender row. Staff can see "Card LKR 4,000" on a receipt without
-- gaining visibility into the owner's bank-account / cheque identifiers.
create table if not exists public.sale_tender_sources (
  tender_id text primary key references public.sale_tenders(id) on delete restrict,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  bank_account_id text references public.bank_accounts(id) on delete restrict,
  cheque_id text references public.cheques(id) on delete restrict,
  return_id uuid references public.sale_returns(id) on delete restrict,
  created_at timestamptz not null default now(),
  check (
    (bank_account_id is not null)::integer
    + (cheque_id is not null)::integer
    + (return_id is not null)::integer
    <= 1
  )
);

create index if not exists sale_tender_sources_org_idx
  on public.sale_tender_sources(organization_id);

alter table public.sale_tenders enable row level security;
alter table public.sale_tender_sources enable row level security;

drop policy if exists sale_tenders_select_org on public.sale_tenders;
create policy sale_tenders_select_org on public.sale_tenders
for select to authenticated using (
  organization_id in (
    select organization_id from public.org_members where user_id = auth.uid()
  )
);

drop policy if exists sale_tender_sources_select_owner on public.sale_tender_sources;
create policy sale_tender_sources_select_owner on public.sale_tender_sources
for select to authenticated using (public.can_see_org_financials(organization_id));

-- Tender history is append-only. The finalizer below is the only writer.
revoke insert, update, delete on public.sale_tenders from authenticated;
revoke insert, update, delete on public.sale_tender_sources from authenticated;
grant select on public.sale_tenders to authenticated;
grant select on public.sale_tender_sources to authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- Atomic sale finalizer
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.finalize_sale_with_tenders(
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
  v_existing_sale record;
  v_org record;
  v_customer record;
  v_product record;
  v_cheque record;
  v_return record;
  v_credit_note record;
  v_original_sale record;

  v_line jsonb;
  v_tender jsonb;

  v_line_count integer := 0;
  v_distinct_line_count integer := 0;
  v_tender_count integer := 0;
  v_distinct_tender_count integer := 0;
  v_return_tender_count integer := 0;
  v_cheque_tender_count integer := 0;

  v_product_id text;
  v_qty numeric(14, 3);
  v_unit_price numeric(14, 2);
  v_gross numeric(14, 2) := 0;
  v_discount numeric(14, 2) := 0;
  v_total numeric(14, 2) := 0;
  v_subtotal numeric(14, 2) := 0;
  v_output_vat numeric(14, 2) := 0;
  v_profit numeric(14, 2) := 0;

  v_tender_id text;
  v_kind text;
  v_amount numeric(14, 2);
  v_tender_total numeric(14, 2) := 0;
  v_credit_amount numeric(14, 2) := 0;
  v_bank_account_id text;
  v_cheque_id text;
  v_return_id uuid;
  v_single_cheque_id text := null;

  v_return_settled_before numeric(14, 2) := 0;
  v_return_credit_remaining numeric(14, 2) := 0;
  v_return_settled_total numeric(14, 2) := 0;
  v_return_remaining_after numeric(14, 2) := 0;
  v_all_exchange boolean := false;
  v_return_status text;
  v_original_customer_id text;

  v_legacy_method text;
  v_bill_no text;
  v_allocation jsonb;
  v_replay_tender_count integer := 0;
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

  -- Stable idempotency boundary. A committed transaction can be replayed after
  -- a client timeout, but an unrelated legacy sale using the same id is never
  -- silently reclassified as a tender-engine sale.
  select s.* into v_existing_sale
  from public.sales_base s
  where s.id = p_sale_id;

  if found then
    if v_existing_sale.organization_id is distinct from p_organization_id then
      raise exception 'sale id already belongs to another organization' using errcode = '23505';
    end if;

    select count(*) into v_replay_tender_count
    from public.sale_tenders t
    where t.organization_id = p_organization_id
      and t.sale_id = p_sale_id;

    if v_replay_tender_count = 0 then
      raise exception 'sale id already exists outside the mixed-tender finalizer' using errcode = '23505';
    end if;

    return jsonb_build_object(
      'ok', true,
      'replayed', true,
      'sale_id', v_existing_sale.id,
      'bill_no', v_existing_sale.bill_no,
      'total', v_existing_sale.total,
      'payment_method', v_existing_sale.payment_method,
      'credit_amount', v_existing_sale.credit_amount,
      'tender_count', v_replay_tender_count
    );
  end if;

  select o.id, o.vat_registered into v_org
  from public.organizations o
  where o.id = p_organization_id
  for update;
  if not found then
    raise exception 'organization not found' using errcode = 'P0002';
  end if;

  if jsonb_typeof(coalesce(p_lines, '[]'::jsonb)) <> 'array' then
    raise exception 'p_lines must be a JSON array' using errcode = '22023';
  end if;
  if jsonb_typeof(coalesce(p_tenders, '[]'::jsonb)) <> 'array' then
    raise exception 'p_tenders must be a JSON array' using errcode = '22023';
  end if;

  select count(*), count(distinct nullif(btrim(value->>'product_id'), ''))
  into v_line_count, v_distinct_line_count
  from jsonb_array_elements(coalesce(p_lines, '[]'::jsonb));

  if v_line_count = 0 then
    raise exception 'add at least one sale line' using errcode = '22023';
  end if;
  if v_distinct_line_count <> v_line_count then
    raise exception 'each product may appear only once in an atomic sale payload' using errcode = '22023';
  end if;

  -- Lock and price every aggregate product before money is validated. The
  -- server reads buy_price itself, so a cashier can never submit or overwrite
  -- COGS/profit. Product locks also close the two-cashiers-last-item race.
  for v_line in select value from jsonb_array_elements(p_lines)
  loop
    v_product_id := nullif(btrim(v_line->>'product_id'), '');
    v_qty := coalesce(nullif(v_line->>'qty', '')::numeric, 0);

    if v_product_id is null or v_qty <= 0 then
      raise exception 'each sale line requires product_id and qty > 0' using errcode = '22023';
    end if;

    select p.id, p.name, p.buy_price, p.sell_price, p.stock_qty, p.active
    into v_product
    from public.products_base p
    where p.id = v_product_id
      and p.organization_id = p_organization_id
    for update;

    if not found then
      raise exception 'product % not found', v_product_id using errcode = 'P0002';
    end if;
    if coalesce(v_product.active, true) = false then
      raise exception 'product % is inactive', v_product.name using errcode = '23514';
    end if;
    if v_product.stock_qty < v_qty then
      raise exception 'insufficient aggregate stock for product %', v_product.name using errcode = '23514';
    end if;

    v_unit_price := case
      when nullif(v_line->>'unit_price', '') is null then round(v_product.sell_price, 2)
      else round((v_line->>'unit_price')::numeric, 2)
    end;
    if v_unit_price < 0 then
      raise exception 'unit price cannot be negative for product %', v_product.name using errcode = '22023';
    end if;

    v_gross := round(v_gross + (v_unit_price * v_qty), 2);
    v_profit := round(v_profit + ((v_unit_price - v_product.buy_price) * v_qty), 2);
  end loop;

  v_discount := round(greatest(0, coalesce(p_discount, 0)), 2);
  if v_discount > v_gross then
    raise exception 'discount cannot exceed sale value' using errcode = '23514';
  end if;

  v_total := round(v_gross - v_discount, 2);
  if v_total <= 0 then
    raise exception 'sale total must be greater than zero' using errcode = '23514';
  end if;
  v_profit := round(v_profit - v_discount, 2);

  -- Match the current app's VAT-inclusive split exactly: taxable subtotal is
  -- rounded to the nearest rupee, VAT is the inclusive remainder.
  if coalesce(v_org.vat_registered, false) then
    v_subtotal := round(v_total / 1.18, 0);
    v_output_vat := round(v_total - v_subtotal, 2);
  else
    v_subtotal := v_total;
    v_output_vat := 0;
  end if;

  if p_customer_id is not null then
    select c.* into v_customer
    from public.customers c
    where c.id = p_customer_id
      and c.organization_id = p_organization_id
    for update;
    if not found then
      raise exception 'customer account not found' using errcode = 'P0002';
    end if;
  end if;

  select count(*), count(distinct nullif(btrim(value->>'id'), ''))
  into v_tender_count, v_distinct_tender_count
  from jsonb_array_elements(coalesce(p_tenders, '[]'::jsonb));

  if v_tender_count = 0 then
    raise exception 'add at least one payment tender' using errcode = '22023';
  end if;
  if v_distinct_tender_count <> v_tender_count then
    raise exception 'each payment tender must have a unique id' using errcode = '22023';
  end if;

  -- Validate every payment source before inserting the invoice. Exceptions roll
  -- the entire transaction back, but validating first keeps the function easier
  -- to audit and avoids transient side effects even inside the transaction.
  for v_tender in select value from jsonb_array_elements(p_tenders)
  loop
    v_tender_id := nullif(btrim(v_tender->>'id'), '');
    v_kind := nullif(btrim(v_tender->>'kind'), '');
    v_amount := round(coalesce(nullif(v_tender->>'amount', '')::numeric, 0), 2);
    v_bank_account_id := nullif(btrim(v_tender->>'bank_account_id'), '');
    v_cheque_id := nullif(btrim(v_tender->>'cheque_id'), '');
    v_return_id := case
      when nullif(btrim(v_tender->>'return_id'), '') is null then null
      else (v_tender->>'return_id')::uuid
    end;

    if v_tender_id is null then
      raise exception 'tender id is required' using errcode = '22023';
    end if;
    if exists (select 1 from public.sale_tenders t where t.id = v_tender_id) then
      raise exception 'tender id already exists' using errcode = '23505';
    end if;
    if v_kind not in ('cash', 'card', 'bank_transfer', 'cheque', 'credit', 'return_credit') then
      raise exception 'invalid tender kind %', coalesce(v_kind, '<null>') using errcode = '22023';
    end if;
    if v_amount <= 0 then
      raise exception 'every tender amount must be positive' using errcode = '22023';
    end if;

    v_tender_total := round(v_tender_total + v_amount, 2);

    if v_kind in ('cash', 'card', 'credit') then
      if v_bank_account_id is not null or v_cheque_id is not null or v_return_id is not null then
        raise exception '% tender cannot carry a bank, cheque or return source', v_kind using errcode = '22023';
      end if;

      if v_kind = 'credit' then
        if p_customer_id is null then
          raise exception 'customer credit requires a customer account' using errcode = '23514';
        end if;
        v_credit_amount := round(v_credit_amount + v_amount, 2);
      end if;

    elsif v_kind = 'bank_transfer' then
      if v_bank_account_id is null or v_cheque_id is not null or v_return_id is not null then
        raise exception 'bank transfer requires exactly one destination bank account' using errcode = '22023';
      end if;
      if not exists (
        select 1 from public.bank_accounts b
        where b.id = v_bank_account_id and b.organization_id = p_organization_id
      ) then
        raise exception 'destination bank account not found' using errcode = 'P0002';
      end if;

    elsif v_kind = 'cheque' then
      if v_cheque_id is null or v_bank_account_id is not null or v_return_id is not null then
        raise exception 'cheque tender requires exactly one cheque record' using errcode = '22023';
      end if;

      select c.* into v_cheque
      from public.cheques c
      where c.id = v_cheque_id
        and c.organization_id = p_organization_id
      for update;
      if not found then
        raise exception 'cheque record not found' using errcode = 'P0002';
      end if;
      if v_cheque.direction <> 'received' then
        raise exception 'sale tender must use a received cheque' using errcode = '23514';
      end if;
      if v_cheque.status in ('bounced', 'returned') then
        raise exception 'bounced/returned cheque cannot fund a sale' using errcode = '23514';
      end if;
      if v_cheque.linked_sale_id is not null then
        raise exception 'cheque is already linked to another sale' using errcode = '23505';
      end if;
      if abs(round(v_cheque.amount, 2) - v_amount) > 0.005 then
        raise exception 'cheque amount must exactly match its tender allocation' using errcode = '23514';
      end if;

      v_cheque_tender_count := v_cheque_tender_count + 1;
      v_single_cheque_id := v_cheque_id;

    elsif v_kind = 'return_credit' then
      if v_return_id is null or v_bank_account_id is not null or v_cheque_id is not null then
        raise exception 'return-credit tender requires exactly one return document' using errcode = '22023';
      end if;
      if not public.can_see_org_financials(p_organization_id) then
        raise exception 'owner approval is required to consume return credit' using errcode = '42501';
      end if;

      v_return_tender_count := v_return_tender_count + 1;
      if v_return_tender_count > 1 then
        raise exception 'this safe phase supports one return-credit source per replacement sale' using errcode = '23514';
      end if;

      -- Lock the return row for the remainder of this transaction. That
      -- serializes a simultaneous refund/exchange against the same credit note.
      select r.* into v_return
      from public.sale_returns r
      where r.id = v_return_id
        and r.organization_id = p_organization_id
      for update;
      if not found then
        raise exception 'return document not found' using errcode = 'P0002';
      end if;

      select n.* into v_credit_note
      from public.sale_credit_notes n
      where n.organization_id = p_organization_id
        and n.return_id = v_return_id;
      if not found then
        raise exception 'issue the return credit note before using it as tender' using errcode = '23514';
      end if;

      select s.customer_id into v_original_customer_id
      from public.sales_base s
      where s.id = v_return.sale_id
        and s.organization_id = p_organization_id;
      if not found then
        raise exception 'original returned sale not found' using errcode = 'P0002';
      end if;

      -- A registered customer's credit cannot be transferred to a different
      -- customer, while a walk-in return stays a walk-in replacement. This is
      -- stricter than matching free-text names and prevents accidental transfer.
      if v_original_customer_id is distinct from p_customer_id then
        raise exception 'return credit must stay with the original customer context' using errcode = '23514';
      end if;

      select coalesce(sum(s.amount), 0) into v_return_settled_before
      from public.sale_return_settlements s
      where s.organization_id = p_organization_id
        and s.return_id = v_return_id;

      v_return_credit_remaining := round(v_credit_note.gross_credit - v_return_settled_before, 2);
      if v_return_credit_remaining <= 0.005 then
        raise exception 'return credit is already fully settled' using errcode = '23514';
      end if;
      if v_amount > v_return_credit_remaining + 0.005 then
        raise exception 'return-credit tender exceeds available balance (%)', v_return_credit_remaining using errcode = '23514';
      end if;
    end if;
  end loop;

  if abs(v_tender_total - v_total) > 0.005 then
    raise exception 'tender allocation (%) must exactly equal sale total (%)', v_tender_total, v_total
      using errcode = '23514';
  end if;

  if v_credit_amount > 0 then
    if p_customer_id is null then
      raise exception 'customer credit requires a customer account' using errcode = '23514';
    end if;
    if v_customer.credit_limit is not null
       and v_customer.credit_balance + v_credit_amount > v_customer.credit_limit + 0.005 then
      raise exception 'customer credit limit would be exceeded' using errcode = '23514';
    end if;
  end if;

  v_legacy_method := case
    when v_tender_count > 1 then 'mixed'
    when (p_tenders->0->>'kind') = 'return_credit' then 'mixed'
    else p_tenders->0->>'kind'
  end;

  -- New mixed-tender invoices get a collision-resistant server number rather
  -- than relying on a client-side "current sale count + 1" race.
  v_bill_no := 'LB-' || to_char(current_date, 'YYYYMMDD') || '-' || upper(substr(md5(p_sale_id), 1, 8));

  insert into public.sales_base (
    id, organization_id, bill_no, sale_date, subtotal, output_vat, discount,
    total, profit, payment_method, customer_id, customer_name,
    credit_amount, cheque_id, created_at
  ) values (
    p_sale_id,
    p_organization_id,
    v_bill_no,
    now(),
    v_subtotal,
    v_output_vat,
    case when v_discount > 0 then v_discount else null end,
    v_total,
    v_profit,
    v_legacy_method,
    p_customer_id,
    case
      when p_customer_id is not null then v_customer.name
      else nullif(btrim(coalesce(p_customer_name, '')), '')
    end,
    v_credit_amount,
    case when v_cheque_tender_count = 1 then v_single_cheque_id else null end,
    now()
  );

  -- Persist the exact historical selling price and server-side buy-cost snapshot,
  -- then move aggregate stock + stock-log audit. Advanced identity is handled
  -- immediately afterward by allocate_sale_inventory in the SAME transaction.
  for v_line in select value from jsonb_array_elements(p_lines)
  loop
    v_product_id := nullif(btrim(v_line->>'product_id'), '');
    v_qty := (v_line->>'qty')::numeric;

    select p.id, p.name, p.buy_price, p.sell_price
    into v_product
    from public.products_base p
    where p.id = v_product_id
      and p.organization_id = p_organization_id
    for update;

    v_unit_price := case
      when nullif(v_line->>'unit_price', '') is null then round(v_product.sell_price, 2)
      else round((v_line->>'unit_price')::numeric, 2)
    end;

    insert into public.sale_lines_base (
      sale_id, organization_id, product_id, product_name,
      qty, unit_price, buy_price, line_order
    ) values (
      p_sale_id,
      p_organization_id,
      v_product.id,
      v_product.name,
      v_qty,
      v_unit_price,
      v_product.buy_price,
      coalesce((v_line->>'line_order')::smallint, 0)
    );

    update public.products_base
    set stock_qty = stock_qty - v_qty,
        updated_at = now()
    where id = v_product.id
      and organization_id = p_organization_id;

    insert into public.stock_logs (
      id, organization_id, product_id, product_name, log_type,
      qty, note, log_date, user_id, created_at
    ) values (
      gen_random_uuid()::text,
      p_organization_id,
      v_product.id,
      v_product.name,
      'sale',
      v_qty,
      'Bill ' || v_bill_no,
      now(),
      auth.uid(),
      now()
    );
  end loop;

  if v_credit_amount > 0 then
    update public.customers
    set credit_balance = credit_balance + v_credit_amount,
        updated_at = now()
    where id = p_customer_id
      and organization_id = p_organization_id;
  end if;

  -- Tender rows are immutable receipt/accounting evidence. Sensitive source ids
  -- are inserted only into the owner-readable side relation.
  for v_tender in select value from jsonb_array_elements(p_tenders)
  loop
    v_tender_id := btrim(v_tender->>'id');
    v_kind := btrim(v_tender->>'kind');
    v_amount := round((v_tender->>'amount')::numeric, 2);
    v_bank_account_id := nullif(btrim(v_tender->>'bank_account_id'), '');
    v_cheque_id := nullif(btrim(v_tender->>'cheque_id'), '');
    v_return_id := case
      when nullif(btrim(v_tender->>'return_id'), '') is null then null
      else (v_tender->>'return_id')::uuid
    end;

    insert into public.sale_tenders (
      id, organization_id, sale_id, kind, amount, note, created_by
    ) values (
      v_tender_id,
      p_organization_id,
      p_sale_id,
      v_kind,
      v_amount,
      nullif(btrim(coalesce(v_tender->>'note', '')), ''),
      auth.uid()
    );

    if v_bank_account_id is not null or v_cheque_id is not null or v_return_id is not null then
      insert into public.sale_tender_sources (
        tender_id, organization_id, bank_account_id, cheque_id, return_id
      ) values (
        v_tender_id,
        p_organization_id,
        v_bank_account_id,
        v_cheque_id,
        v_return_id
      );
    end if;

    if v_kind = 'cheque' then
      update public.cheques
      set linked_sale_id = p_sale_id,
          updated_at = now()
      where id = v_cheque_id
        and organization_id = p_organization_id;
    end if;

    if v_kind = 'return_credit' then
      -- Generalized exchange settlement: no customer receivable is fabricated.
      -- The return credit itself is a payment tender against this new invoice.
      insert into public.sale_return_settlements (
        id, organization_id, return_id, credit_note_id,
        settlement_type, amount, replacement_sale_id, note, created_by
      ) values (
        gen_random_uuid(),
        p_organization_id,
        v_return_id,
        v_credit_note.id,
        'exchange',
        v_amount,
        p_sale_id,
        'Return credit applied as tender to bill ' || v_bill_no,
        auth.uid()
      );

      select
        coalesce(sum(s.amount), 0),
        coalesce(bool_and(s.settlement_type = 'exchange'), false)
      into v_return_settled_total, v_all_exchange
      from public.sale_return_settlements s
      where s.organization_id = p_organization_id
        and s.return_id = v_return_id;

      v_return_remaining_after := greatest(
        0,
        round(v_credit_note.gross_credit - v_return_settled_total, 2)
      );

      if v_return_remaining_after > 0.005 then
        v_return_status := 'partial';
      elsif v_all_exchange then
        v_return_status := 'exchange';
      else
        v_return_status := 'settled_mixed';
      end if;

      update public.sale_returns
      set settlement_status = v_return_status,
          settled_at = case when v_return_remaining_after <= 0.005 then now() else null end
      where id = v_return_id
        and organization_id = p_organization_id;
    end if;
  end loop;

  -- This RPC joins the old aggregate stock transaction and the advanced
  -- variant/lot/serial transaction into one commit boundary. Any identity race
  -- (last IMEI, last batch, etc.) raises here and rolls back the entire invoice,
  -- aggregate stock, customer credit and payment ledger above.
  v_allocation := public.allocate_sale_inventory(
    p_organization_id,
    p_sale_id,
    p_customer_id,
    p_lines
  );

  -- Force other devices to pull before an older local snapshot can overwrite
  -- the newly finalized sale/customer/stock state.
  update public.organizations
  set sync_generation = sync_generation + 1
  where id = p_organization_id;

  return jsonb_build_object(
    'ok', true,
    'replayed', false,
    'sale_id', p_sale_id,
    'bill_no', v_bill_no,
    'total', v_total,
    'payment_method', v_legacy_method,
    'credit_amount', v_credit_amount,
    'tender_count', v_tender_count,
    'advanced_inventory', v_allocation
  );
end;
$$;

revoke all on function public.finalize_sale_with_tenders(uuid, text, text, text, numeric, jsonb, jsonb)
  from public, anon;
grant execute on function public.finalize_sale_with_tenders(uuid, text, text, text, numeric, jsonb, jsonb)
  to authenticated;

comment on table public.sale_tenders is
  'Immutable customer-facing allocation of a sale total across cash/card/bank/cheque/customer-credit/return-credit tenders.';
comment on table public.sale_tender_sources is
  'Owner-only sensitive source references for sale_tenders. Operational staff can read tender amounts without seeing bank/cheque/return source identifiers.';
comment on function public.finalize_sale_with_tenders(uuid, text, text, text, numeric, jsonb, jsonb) is
  'Atomically finalizes a mixed-tender sale, server-derived COGS/profit, aggregate stock, customer credit, payment audit, return-credit consumption and advanced identity allocation.';
