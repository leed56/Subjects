-- LakBiz advanced inventory — registration guard.
--
-- Batch/serial records describe the SAME physical quantity already carried by
-- products_base.stock_qty. They are identity detail, not a second receiving
-- transaction. Prevent staff from registering more on-hand batch/serial stock
-- than the aggregate Product quantity currently contains.
--
-- Important: this guard is intentionally on identity INSERT/UPDATE only, not on
-- products_base updates. Existing POS first decrements aggregate stock and then
-- allocates the exact batch/serial in the same user operation; blocking the
-- intermediate aggregate update would make that safe staged integration
-- impossible. The final advanced allocation always reduces identity stock.

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

revoke all on function public.guard_inventory_lot_registration() from public, anon;
revoke all on function public.guard_inventory_unit_registration() from public, anon;

drop trigger if exists inventory_lots_registration_guard on public.inventory_lots;
create trigger inventory_lots_registration_guard
before insert or update of organization_id, product_id, qty_on_hand on public.inventory_lots
for each row execute function public.guard_inventory_lot_registration();

drop trigger if exists inventory_units_registration_guard on public.inventory_units;
create trigger inventory_units_registration_guard
before insert or update of organization_id, product_id, status on public.inventory_units
for each row execute function public.guard_inventory_unit_registration();

comment on function public.guard_inventory_lot_registration() is
  'Prevents identity-level batch quantity from exceeding the existing aggregate Product stock. Batch creation assigns identity to already-received stock; it is not a second stock-in.';
comment on function public.guard_inventory_unit_registration() is
  'Prevents on-hand serialized identity count from exceeding the existing aggregate Product stock. Unit registration assigns IMEI/serial identity to already-received stock.';
