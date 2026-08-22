-- LakBiz advanced inventory — registration guards.
--
-- Variant/batch/serial records describe the SAME physical quantity already
-- carried by products_base.stock_qty. They add identity detail; they are not a
-- second receiving transaction. Prevent direct REST/API writes from registering
-- more on-hand identity stock than the aggregate Product quantity contains.
--
-- Important: guards live on identity INSERT/UPDATE only, not products_base.
-- Existing POS first decrements aggregate stock and then its exact identity in
-- the same user operation; blocking that short intermediate state would break
-- the staged local-first sync path.

create or replace function public.guard_product_variant_registration()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_mode text;
  v_product_qty numeric(14,3);
  v_other_qty numeric(14,3);
begin
  select coalesce(p.tracking_mode, 'simple') into v_mode
  from public.product_inventory_profiles p
  where p.organization_id = new.organization_id
    and p.product_id = new.product_id;

  -- Lot/serial variant quantities are derived from their identity rows and the
  -- product_variants.stock_qty field is not authoritative for those modes.
  if coalesce(v_mode, 'simple') <> 'variant' then
    return new;
  end if;

  if coalesce(new.stock_qty, 0) < 0 then
    raise exception 'variant stock cannot be negative' using errcode = '23514';
  end if;

  select p.stock_qty into v_product_qty
  from public.products_base p
  where p.id = new.product_id
    and p.organization_id = new.organization_id;

  if not found then
    raise exception 'product not found for variant registration' using errcode = 'P0002';
  end if;

  if tg_op = 'UPDATE' then
    select coalesce(sum(v.stock_qty), 0) into v_other_qty
    from public.product_variants v
    where v.organization_id = new.organization_id
      and v.product_id = new.product_id
      and v.id <> old.id;
  else
    select coalesce(sum(v.stock_qty), 0) into v_other_qty
    from public.product_variants v
    where v.organization_id = new.organization_id
      and v.product_id = new.product_id;
  end if;

  if v_other_qty + coalesce(new.stock_qty, 0) > v_product_qty then
    raise exception 'assigned variant stock (%) exceeds aggregate product stock (%)',
      v_other_qty + coalesce(new.stock_qty, 0), v_product_qty
      using errcode = '23514';
  end if;

  return new;
end;
$$;

create or replace function public.guard_inventory_lot_registration()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_product_qty numeric(14,3);
  v_other_qty numeric(14,3);
begin
  select p.stock_qty into v_product_qty
  from public.products_base p
  where p.id = new.product_id
    and p.organization_id = new.organization_id;

  if not found then
    raise exception 'product not found for lot registration' using errcode = 'P0002';
  end if;

  if tg_op = 'UPDATE' then
    select coalesce(sum(l.qty_on_hand), 0) into v_other_qty
    from public.inventory_lots l
    where l.organization_id = new.organization_id
      and l.product_id = new.product_id
      and l.id <> old.id;
  else
    select coalesce(sum(l.qty_on_hand), 0) into v_other_qty
    from public.inventory_lots l
    where l.organization_id = new.organization_id
      and l.product_id = new.product_id;
  end if;

  if v_other_qty + coalesce(new.qty_on_hand, 0) > v_product_qty then
    raise exception 'registered batch stock (%) exceeds aggregate product stock (%)',
      v_other_qty + coalesce(new.qty_on_hand, 0), v_product_qty
      using errcode = '23514';
  end if;

  return new;
end;
$$;

create or replace function public.guard_inventory_unit_registration()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_product_qty numeric(14,3);
  v_other_units integer;
  v_new_on_hand integer;
begin
  select p.stock_qty into v_product_qty
  from public.products_base p
  where p.id = new.product_id
    and p.organization_id = new.organization_id;

  if not found then
    raise exception 'product not found for serialized-unit registration' using errcode = 'P0002';
  end if;

  -- Sold and written-off units are no longer part of on-hand Product stock.
  if tg_op = 'UPDATE' then
    select count(*) into v_other_units
    from public.inventory_units u
    where u.organization_id = new.organization_id
      and u.product_id = new.product_id
      and u.status not in ('sold', 'written_off')
      and u.id <> old.id;
  else
    select count(*) into v_other_units
    from public.inventory_units u
    where u.organization_id = new.organization_id
      and u.product_id = new.product_id
      and u.status not in ('sold', 'written_off');
  end if;

  v_new_on_hand := case when new.status not in ('sold', 'written_off') then 1 else 0 end;
  if v_other_units + v_new_on_hand > floor(v_product_qty) then
    raise exception 'registered serialized units (%) exceed aggregate product stock (%)',
      v_other_units + v_new_on_hand, v_product_qty
      using errcode = '23514';
  end if;

  return new;
end;
$$;

revoke all on function public.guard_product_variant_registration() from public, anon;
revoke all on function public.guard_inventory_lot_registration() from public, anon;
revoke all on function public.guard_inventory_unit_registration() from public, anon;

drop trigger if exists product_variants_registration_guard on public.product_variants;
create trigger product_variants_registration_guard
before insert or update of organization_id, product_id, stock_qty on public.product_variants
for each row execute function public.guard_product_variant_registration();

drop trigger if exists inventory_lots_registration_guard on public.inventory_lots;
create trigger inventory_lots_registration_guard
before insert or update of organization_id, product_id, qty_on_hand on public.inventory_lots
for each row execute function public.guard_inventory_lot_registration();

drop trigger if exists inventory_units_registration_guard on public.inventory_units;
create trigger inventory_units_registration_guard
before insert or update of organization_id, product_id, status on public.inventory_units
for each row execute function public.guard_inventory_unit_registration();

comment on function public.guard_product_variant_registration() is
  'For pure variant tracking, prevents direct variant quantity writes from assigning more size/colour stock than the aggregate Product quantity.';
comment on function public.guard_inventory_lot_registration() is
  'Prevents identity-level batch quantity from exceeding the existing aggregate Product stock. Batch creation assigns identity to already-received stock; it is not a second stock-in.';
comment on function public.guard_inventory_unit_registration() is
  'Prevents on-hand serialized identity count from exceeding the existing aggregate Product stock. Unit registration assigns IMEI/serial identity to already-received stock.';
