-- LakBiz customer-return restock safety guards.
--
-- UI defaults are not a security/safety boundary. A tampered manager client
-- must not be able to mark pharmacy returns, recalled/expired batches, inactive
-- variants or discontinued products as approved-for-resale simply by sending
-- restock=true to process_sale_return().
--
-- The guard runs BEFORE the immutable sale_return_lines row is inserted. The
-- workflow RPC may have already staged aggregate/identity changes earlier in
-- the same PostgreSQL transaction; raising here rolls the entire transaction
-- back atomically, so no partial stock restoration survives.

create or replace function public.guard_sale_return_restock_safety()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sector text;
  v_product_active boolean;
  v_alloc record;
  v_variant_active boolean;
  v_lot_status text;
  v_lot_expiry date;
begin
  if not new.restocked then
    return new;
  end if;

  select o.sector_id into v_sector
  from public.organizations o
  where o.id = new.organization_id;

  -- Customer-returned medicine remains on inspection hold in this phase.
  -- Reintroducing medicine to dispensing stock needs a dedicated regulated
  -- inspection/release workflow, not a generic retail return checkbox.
  if coalesce(v_sector, '') = 'pharmacy' then
    raise exception 'pharmacy customer returns cannot be restored directly to sellable stock'
      using errcode = '23514';
  end if;

  select p.active into v_product_active
  from public.products_base p
  where p.organization_id = new.organization_id
    and p.id = new.product_id;
  if not found or not coalesce(v_product_active, false) then
    raise exception 'inactive product cannot be restored directly to sellable stock'
      using errcode = '23514';
  end if;

  if new.original_allocation_id is null then
    return new;
  end if;

  select a.* into v_alloc
  from public.inventory_allocations a
  where a.id = new.original_allocation_id
    and a.organization_id = new.organization_id
    and a.reference_type = 'sale'
    and a.reference_id = new.sale_id;
  if not found then
    raise exception 'original sale allocation not found for return restock guard'
      using errcode = 'P0002';
  end if;

  if v_alloc.variant_id is not null and v_alloc.lot_id is null and v_alloc.unit_id is null then
    select v.active into v_variant_active
    from public.product_variants v
    where v.id = v_alloc.variant_id
      and v.organization_id = new.organization_id
      and v.product_id = new.product_id;
    if not found or not coalesce(v_variant_active, false) then
      raise exception 'inactive variant cannot be restored directly to sellable stock'
        using errcode = '23514';
    end if;
  end if;

  if v_alloc.lot_id is not null then
    select l.status, l.expiry_date
      into v_lot_status, v_lot_expiry
    from public.inventory_lots l
    where l.id = v_alloc.lot_id
      and l.organization_id = new.organization_id
      and l.product_id = new.product_id;
    if not found then
      raise exception 'original batch not found for return restock guard'
        using errcode = 'P0002';
    end if;
    if v_lot_status in ('quarantine', 'expired', 'recalled', 'returned')
       or (v_lot_expiry is not null and v_lot_expiry < current_date) then
      raise exception 'unsafe or expired batch cannot be restored directly to sellable stock'
        using errcode = '23514';
    end if;
  end if;

  return new;
end;
$$;

revoke all on function public.guard_sale_return_restock_safety() from public, anon;

drop trigger if exists sale_return_lines_restock_safety on public.sale_return_lines;
create trigger sale_return_lines_restock_safety
before insert on public.sale_return_lines
for each row execute function public.guard_sale_return_restock_safety();

comment on function public.guard_sale_return_restock_safety() is
  'Defense-in-depth guard for process_sale_return: blocks direct sellable-restock of pharmacy returns, inactive products/variants and unsafe/expired batches. Any rejection rolls back the whole return transaction.';
