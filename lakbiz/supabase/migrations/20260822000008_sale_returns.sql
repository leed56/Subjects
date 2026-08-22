-- LakBiz controlled customer-return intake.
--
-- This phase deliberately separates PHYSICAL RETURN from FINANCIAL SETTLEMENT.
-- A return can restore inspected merchandise to inventory (including the exact
-- variant/batch/IMEI identity) or hold it out of sellable stock, while the
-- original invoice, VAT, customer balance, cash/bank and cheque records remain
-- unchanged until a later explicit credit-note/refund settlement workflow.
--
-- Why this split matters:
--   * a returned item is not the same event as paying money back;
--   * cash refunds have no cash-account selector in today's model;
--   * bank refunds need a specific bank account;
--   * credit sales may already be partly/fully paid;
--   * pharmacy returns must never become sellable merely because a customer
--     handed them back.
--
-- The return document is append-only. The original sale and original sale
-- allocations remain immutable historical records.

-- Stock audit gains one explicit movement kind for merchandise that is actually
-- restored to aggregate sellable/on-hand stock. Non-restocked returns do not
-- write stock_logs because Product.stock_qty does not change for them.
alter table public.stock_logs drop constraint if exists stock_logs_log_type_check;
alter table public.stock_logs add constraint stock_logs_log_type_check
  check (log_type in (
    'in', 'out', 'sale', 'purchase', 'job_usage', 'job_return',
    'supplier_return', 'write_off', 'customer_return'
  ));

create table if not exists public.sale_returns (
  id uuid primary key,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  return_no text not null,
  sale_id text not null references public.sales_base(id) on delete restrict,
  returned_at timestamptz not null default now(),
  reason text not null,
  merchandise_value numeric(14, 2) not null default 0 check (merchandise_value >= 0),
  output_vat_reversal numeric(14, 2) not null default 0 check (output_vat_reversal >= 0),
  settlement_status text not null default 'pending'
    check (settlement_status in ('pending', 'settled_external', 'reduced_credit', 'exchange')),
  created_by uuid,
  created_at timestamptz not null default now(),
  unique (organization_id, return_no)
);
create index if not exists sale_returns_org_sale_idx
  on public.sale_returns(organization_id, sale_id, returned_at desc);

-- One row represents one returned quantity slice. For advanced inventory it is
-- tied to the ORIGINAL sale allocation so the same batch/variant/device cannot
-- be returned twice. Simple/legacy stock has original_allocation_id = null.
create table if not exists public.sale_return_lines (
  id uuid primary key default gen_random_uuid(),
  return_id uuid not null references public.sale_returns(id) on delete restrict,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  sale_id text not null references public.sales_base(id) on delete restrict,
  sale_line_order smallint not null,
  product_id text not null references public.products_base(id) on delete restrict,
  product_name text not null,
  qty numeric(14, 3) not null check (qty > 0),
  unit_price numeric(14, 2) not null default 0,
  return_value numeric(14, 2) not null default 0 check (return_value >= 0),
  output_vat_reversal numeric(14, 2) not null default 0 check (output_vat_reversal >= 0),
  original_allocation_id uuid references public.inventory_allocations(id) on delete restrict,
  restocked boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists sale_return_lines_sale_line_idx
  on public.sale_return_lines(organization_id, sale_id, sale_line_order);
create index if not exists sale_return_lines_original_allocation_idx
  on public.sale_return_lines(original_allocation_id)
  where original_allocation_id is not null;

-- COGS/profit reversal is internal owner-only finance. It is physically split
-- from the operational return rows, matching the advanced-inventory cost model.
create table if not exists public.sale_return_financials (
  return_id uuid primary key references public.sale_returns(id) on delete restrict,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  reversed_cogs numeric(14, 2) not null default 0 check (reversed_cogs >= 0),
  reversed_profit numeric(14, 2) not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists sale_return_financials_org_idx
  on public.sale_return_financials(organization_id);

alter table public.sale_returns enable row level security;
alter table public.sale_return_lines enable row level security;
alter table public.sale_return_financials enable row level security;

-- Return documents/lines contain customer-facing sale values, not hidden buy
-- cost. Any member of the organization may read them for traceability.
drop policy if exists sale_returns_select_org on public.sale_returns;
create policy sale_returns_select_org on public.sale_returns
for select to authenticated using (
  organization_id in (
    select organization_id from public.org_members where user_id = auth.uid()
  )
);

drop policy if exists sale_return_lines_select_org on public.sale_return_lines;
create policy sale_return_lines_select_org on public.sale_return_lines
for select to authenticated using (
  organization_id in (
    select organization_id from public.org_members where user_id = auth.uid()
  )
);

-- Profit/COGS reversals remain owner-only.
drop policy if exists sale_return_financials_select_owner on public.sale_return_financials;
create policy sale_return_financials_select_owner on public.sale_return_financials
for select to authenticated using (public.can_see_org_financials(organization_id));

-- Direct clients cannot fabricate/edit/delete return history. Trusted workflow
-- RPCs below are SECURITY DEFINER and append the audit atomically.
revoke insert, update, delete on public.sale_returns from authenticated;
revoke insert, update, delete on public.sale_return_lines from authenticated;
revoke insert, update, delete on public.sale_return_financials from authenticated;
grant select on public.sale_returns to authenticated;
grant select on public.sale_return_lines to authenticated;
grant select on public.sale_return_financials to authenticated;

create or replace function public.process_sale_return(
  p_organization_id uuid,
  p_sale_id text,
  p_return_id uuid,
  p_reason text,
  p_lines jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sale record;
  v_existing record;
  v_line jsonb;
  v_alloc_json jsonb;
  v_sale_line record;
  v_original_alloc record;
  v_mode text;
  v_return_no text;
  v_line_order smallint;
  v_requested_qty numeric(14,3);
  v_restock boolean;
  v_prev_returned numeric(14,3);
  v_sale_alloc_count integer;
  v_alloc_sum numeric(14,3);
  v_alloc_id uuid;
  v_alloc_qty numeric(14,3);
  v_alloc_prev_returned numeric(14,3);
  v_gross_before_discount numeric(14,2);
  v_sale_factor numeric;
  v_vat_ratio numeric;
  v_piece_value numeric(14,2);
  v_piece_vat numeric(14,2);
  v_piece_cogs numeric(14,2);
  v_total_value numeric(14,2) := 0;
  v_total_vat numeric(14,2) := 0;
  v_total_cogs numeric(14,2) := 0;
  v_total_restocked numeric(14,3) := 0;
  v_return_line_id uuid;
  v_is_owner boolean;
begin
  if p_organization_id is null or p_sale_id is null or p_return_id is null then
    raise exception 'organization, sale and return id are required' using errcode = '22023';
  end if;
  if nullif(btrim(coalesce(p_reason, '')), '') is null then
    raise exception 'return reason is required' using errcode = '22023';
  end if;
  if p_lines is null or jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) = 0 then
    raise exception 'at least one return line is required' using errcode = '22023';
  end if;

  -- Returns are intentionally elevated above normal POS sales: owner/manager
  -- approval prevents a cashier from silently reversing stock.
  if not public.org_member_can_write_module(p_organization_id, 'sales')
     or not public.org_member_role_in(p_organization_id, array['owner','manager']) then
    raise exception 'owner or manager approval is required for customer returns' using errcode = '42501';
  end if;

  v_is_owner := public.can_see_org_financials(p_organization_id);

  -- Network retry / double-click idempotency. Same request id returns the
  -- already-created document without touching stock a second time.
  select * into v_existing
  from public.sale_returns r
  where r.id = p_return_id
    and r.organization_id = p_organization_id
    and r.sale_id = p_sale_id;
  if found then
    return jsonb_build_object(
      'ok', true,
      'replayed', true,
      'return_id', v_existing.id,
      'return_no', v_existing.return_no,
      'merchandise_value', v_existing.merchandise_value,
      'output_vat_reversal', v_existing.output_vat_reversal,
      'settlement_status', v_existing.settlement_status
    );
  end if;

  select
    s.id,
    s.bill_no,
    s.total,
    coalesce(s.output_vat, 0) as output_vat,
    s.customer_id
  into v_sale
  from public.sales_base s
  where s.id = p_sale_id
    and s.organization_id = p_organization_id
  for update;
  if not found then
    raise exception 'sale not found' using errcode = 'P0002';
  end if;

  -- The request may contain each invoice line at most once. This keeps return
  -- quantity accounting deterministic and makes the UI payload easy to audit.
  if exists (
    select 1
    from (
      select (item->>'line_order')::smallint as line_order, count(*) as c
      from jsonb_array_elements(p_lines) item
      group by (item->>'line_order')::smallint
    ) q
    where q.c > 1
  ) then
    raise exception 'duplicate sale line in return request' using errcode = '22023';
  end if;

  select coalesce(sum(sl.qty * sl.unit_price), 0)
  into v_gross_before_discount
  from public.sale_lines_base sl
  where sl.organization_id = p_organization_id
    and sl.sale_id = p_sale_id;

  v_sale_factor := case
    when v_gross_before_discount > 0 then v_sale.total / v_gross_before_discount
    else 0
  end;
  v_vat_ratio := case
    when v_sale.total > 0 then v_sale.output_vat / v_sale.total
    else 0
  end;

  v_return_no := 'RTN-' || upper(substr(replace(p_return_id::text, '-', ''), 1, 8));

  insert into public.sale_returns (
    id, organization_id, return_no, sale_id, reason,
    merchandise_value, output_vat_reversal, settlement_status, created_by
  ) values (
    p_return_id, p_organization_id, v_return_no, p_sale_id, btrim(p_reason),
    0, 0, 'pending', auth.uid()
  );

  for v_line in select value from jsonb_array_elements(p_lines)
  loop
    v_line_order := (v_line->>'line_order')::smallint;
    v_requested_qty := (v_line->>'qty')::numeric;
    v_restock := coalesce((v_line->>'restock')::boolean, false);

    if v_requested_qty is null or v_requested_qty <= 0 then
      raise exception 'return quantity must be positive' using errcode = '22023';
    end if;

    select
      sl.line_order,
      sl.product_id,
      sl.product_name,
      sl.qty,
      sl.unit_price,
      sl.buy_price
    into v_sale_line
    from public.sale_lines_base sl
    where sl.organization_id = p_organization_id
      and sl.sale_id = p_sale_id
      and sl.line_order = v_line_order
    for update;

    if not found or v_sale_line.product_id is null then
      raise exception 'sale line % not found or has no stock product', v_line_order using errcode = 'P0002';
    end if;

    select coalesce(sum(rl.qty), 0)
    into v_prev_returned
    from public.sale_return_lines rl
    where rl.organization_id = p_organization_id
      and rl.sale_id = p_sale_id
      and rl.sale_line_order = v_line_order;

    if v_requested_qty > v_sale_line.qty - v_prev_returned then
      raise exception 'return quantity exceeds remaining quantity on sale line %', v_line_order using errcode = '23514';
    end if;

    select p.tracking_mode
    into v_mode
    from public.product_inventory_profiles p
    where p.organization_id = p_organization_id
      and p.product_id = v_sale_line.product_id;
    v_mode := coalesce(v_mode, 'simple');

    select count(*)::integer
    into v_sale_alloc_count
    from public.inventory_allocations a
    where a.organization_id = p_organization_id
      and a.reference_type = 'sale'
      and a.reference_id = p_sale_id
      and a.product_id = v_sale_line.product_id;

    -- When a historical advanced sale has exact identity allocations, returning
    -- it must name those allocations. If a legacy sale predates identity
    -- allocation, a non-restocked return is still allowed, but restocking into
    -- advanced stock without knowing the original identity is rejected.
    if v_mode <> 'simple' and v_sale_alloc_count = 0 and v_restock then
      raise exception 'exact inventory identity is unavailable for this legacy sale; record it as non-restocked' using errcode = '23514';
    end if;

    if v_mode <> 'simple' and v_sale_alloc_count > 0 then
      if jsonb_typeof(coalesce(v_line->'allocations', '[]'::jsonb)) <> 'array'
         or jsonb_array_length(coalesce(v_line->'allocations', '[]'::jsonb)) = 0 then
        raise exception 'exact sold identity must be selected for advanced inventory return' using errcode = '22023';
      end if;

      select coalesce(sum((entry->>'qty')::numeric), 0)
      into v_alloc_sum
      from jsonb_array_elements(v_line->'allocations') entry;

      if v_alloc_sum <> v_requested_qty then
        raise exception 'selected identity quantity must equal returned quantity' using errcode = '23514';
      end if;

      for v_alloc_json in select value from jsonb_array_elements(v_line->'allocations')
      loop
        v_alloc_id := (v_alloc_json->>'allocation_id')::uuid;
        v_alloc_qty := (v_alloc_json->>'qty')::numeric;
        if v_alloc_id is null or v_alloc_qty is null or v_alloc_qty <= 0 then
          raise exception 'invalid return allocation' using errcode = '22023';
        end if;

        select a.* into v_original_alloc
        from public.inventory_allocations a
        where a.id = v_alloc_id
          and a.organization_id = p_organization_id
          and a.reference_type = 'sale'
          and a.reference_id = p_sale_id
          and a.product_id = v_sale_line.product_id
        for update;
        if not found then
          raise exception 'original sale allocation not found' using errcode = 'P0002';
        end if;

        select coalesce(sum(rl.qty), 0)
        into v_alloc_prev_returned
        from public.sale_return_lines rl
        where rl.original_allocation_id = v_alloc_id;

        if v_alloc_qty > v_original_alloc.qty - v_alloc_prev_returned then
          raise exception 'return quantity exceeds remaining quantity for selected inventory identity' using errcode = '23514';
        end if;

        if v_mode = 'variant' then
          if v_original_alloc.variant_id is null then
            raise exception 'variant allocation is missing' using errcode = '23514';
          end if;
          if v_restock then
            update public.product_variants
            set stock_qty = stock_qty + v_alloc_qty,
                updated_at = now()
            where id = v_original_alloc.variant_id
              and organization_id = p_organization_id
              and product_id = v_sale_line.product_id;
            if not found then raise exception 'variant not found' using errcode = 'P0002'; end if;
          end if;

        elsif v_mode in ('lot', 'variant_lot') then
          if v_original_alloc.lot_id is null then
            raise exception 'batch allocation is missing' using errcode = '23514';
          end if;
          if v_restock then
            update public.inventory_lots
            set qty_on_hand = qty_on_hand + v_alloc_qty,
                status = case
                  when status in ('quarantine', 'recalled') then status
                  when expiry_date is not null and expiry_date < current_date then 'expired'
                  else 'available'
                end,
                updated_at = now()
            where id = v_original_alloc.lot_id
              and organization_id = p_organization_id
              and product_id = v_sale_line.product_id;
            if not found then raise exception 'batch not found' using errcode = 'P0002'; end if;
          end if;

        elsif v_mode in ('serial', 'variant_serial') then
          if v_original_alloc.unit_id is null or v_original_alloc.qty <> 1 or v_alloc_qty <> 1 then
            raise exception 'serialized return must select exactly one sold device' using errcode = '23514';
          end if;
          if v_restock then
            update public.inventory_units
            set status = 'available',
                sale_id = null,
                customer_id = null,
                updated_at = now()
            where id = v_original_alloc.unit_id
              and organization_id = p_organization_id
              and product_id = v_sale_line.product_id
              and status = 'sold'
              and sale_id = p_sale_id;
          else
            update public.inventory_units
            set status = 'returned',
                updated_at = now()
            where id = v_original_alloc.unit_id
              and organization_id = p_organization_id
              and product_id = v_sale_line.product_id
              and status = 'sold'
              and sale_id = p_sale_id;
          end if;
          if not found then
            raise exception 'serialized unit is no longer in the expected sold state' using errcode = '23514';
          end if;
        end if;

        v_piece_value := round(v_sale_line.unit_price * v_alloc_qty * v_sale_factor, 2);
        v_piece_vat := round(v_piece_value * v_vat_ratio, 2);
        v_piece_cogs := round(v_sale_line.buy_price * v_alloc_qty, 2);

        insert into public.sale_return_lines (
          return_id, organization_id, sale_id, sale_line_order,
          product_id, product_name, qty, unit_price, return_value,
          output_vat_reversal, original_allocation_id, restocked
        ) values (
          p_return_id, p_organization_id, p_sale_id, v_line_order,
          v_sale_line.product_id, v_sale_line.product_name, v_alloc_qty,
          v_sale_line.unit_price, v_piece_value, v_piece_vat,
          v_alloc_id, v_restock
        ) returning id into v_return_line_id;

        insert into public.inventory_allocations (
          organization_id, product_id, variant_id, lot_id, unit_id,
          reference_type, reference_id, qty
        ) values (
          p_organization_id, v_sale_line.product_id,
          v_original_alloc.variant_id, v_original_alloc.lot_id,
          v_original_alloc.unit_id, 'return', p_return_id::text, v_alloc_qty
        );

        v_total_value := v_total_value + v_piece_value;
        v_total_vat := v_total_vat + v_piece_vat;
        v_total_cogs := v_total_cogs + v_piece_cogs;
      end loop;
    else
      -- Simple inventory (or an advanced legacy sale with no historical
      -- allocation and explicitly NOT restocked) is represented by one line.
      v_piece_value := round(v_sale_line.unit_price * v_requested_qty * v_sale_factor, 2);
      v_piece_vat := round(v_piece_value * v_vat_ratio, 2);
      v_piece_cogs := round(v_sale_line.buy_price * v_requested_qty, 2);

      insert into public.sale_return_lines (
        return_id, organization_id, sale_id, sale_line_order,
        product_id, product_name, qty, unit_price, return_value,
        output_vat_reversal, original_allocation_id, restocked
      ) values (
        p_return_id, p_organization_id, p_sale_id, v_line_order,
        v_sale_line.product_id, v_sale_line.product_name, v_requested_qty,
        v_sale_line.unit_price, v_piece_value, v_piece_vat, null, v_restock
      );

      insert into public.inventory_allocations (
        organization_id, product_id, reference_type, reference_id, qty
      ) values (
        p_organization_id, v_sale_line.product_id,
        'return', p_return_id::text, v_requested_qty
      );

      v_total_value := v_total_value + v_piece_value;
      v_total_vat := v_total_vat + v_piece_vat;
      v_total_cogs := v_total_cogs + v_piece_cogs;
    end if;

    if v_restock then
      update public.products_base
      set stock_qty = stock_qty + v_requested_qty,
          updated_at = now()
      where id = v_sale_line.product_id
        and organization_id = p_organization_id;
      if not found then raise exception 'product not found' using errcode = 'P0002'; end if;

      insert into public.stock_logs (
        id, organization_id, product_id, product_name, log_type, qty,
        note, log_date, user_id
      ) values (
        gen_random_uuid()::text,
        p_organization_id,
        v_sale_line.product_id,
        v_sale_line.product_name,
        'customer_return',
        v_requested_qty,
        'Customer return ' || v_return_no || ' · Bill ' || coalesce(v_sale.bill_no, p_sale_id),
        now(),
        auth.uid()
      );
      v_total_restocked := v_total_restocked + v_requested_qty;
    end if;
  end loop;

  -- Rounding across partial lines must never let return documents exceed the
  -- original invoice by more than a cent-level tolerance.
  if (
    (select coalesce(sum(r.merchandise_value), 0)
     from public.sale_returns r
     where r.organization_id = p_organization_id
       and r.sale_id = p_sale_id
       and r.id <> p_return_id)
    + v_total_value > v_sale.total + 0.05
  ) then
    raise exception 'return value exceeds original sale total' using errcode = '23514';
  end if;

  update public.sale_returns
  set merchandise_value = v_total_value,
      output_vat_reversal = v_total_vat
  where id = p_return_id;

  insert into public.sale_return_financials (
    return_id, organization_id, reversed_cogs, reversed_profit
  ) values (
    p_return_id, p_organization_id, v_total_cogs, v_total_value - v_total_cogs
  );

  -- Force every other device/session to see this transactional stock change
  -- before it can push an older local snapshot over it.
  update public.organizations
  set sync_generation = sync_generation + 1
  where id = p_organization_id;

  return jsonb_build_object(
    'ok', true,
    'replayed', false,
    'return_id', p_return_id,
    'return_no', v_return_no,
    'merchandise_value', v_total_value,
    'output_vat_reversal', v_total_vat,
    'reversed_profit', case when v_is_owner then v_total_value - v_total_cogs else null end,
    'restocked_qty', v_total_restocked,
    'settlement_status', 'pending'
  );
end;
$$;

revoke all on function public.process_sale_return(uuid, text, uuid, text, jsonb) from public, anon;
grant execute on function public.process_sale_return(uuid, text, uuid, text, jsonb) to authenticated;

comment on table public.sale_returns is
  'Immutable customer merchandise-return documents. settlement_status=pending means inventory may have changed but the original sale/VAT/customer/cash/bank records have not yet been financially reversed.';
comment on table public.sale_return_lines is
  'Returned sale-line quantities, optionally tied to the exact original sale inventory allocation. restocked=true means Product.stock_qty and exact advanced identity were restored.';
comment on table public.sale_return_financials is
  'Owner-only COGS/profit reversal snapshot for later credit-note/refund settlement and net reporting.';
comment on function public.process_sale_return(uuid, text, uuid, text, jsonb) is
  'Owner/manager-controlled, idempotent physical return intake. Validates remaining sold quantity, restores exact variant/batch/IMEI only when explicitly restocked, appends immutable return allocations, and leaves financial settlement pending.';