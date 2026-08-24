-- LakBiz advanced inventory hardening: allow identity decreases after aggregate
-- sale stock has already been decremented.
--
-- The registration guards introduced in 20260822000005 correctly prevent
-- identity stock from being registered above products_base.stock_qty. During an
-- atomic sale, however, aggregate stock is reduced before exact lot/unit
-- identities are consumed. If a sale spans multiple lots or multiple serialized
-- units, the first identity UPDATE can temporarily leave total identity on-hand
-- above the already-reduced aggregate quantity and the old guard rejects a valid
-- transaction.
--
-- Security invariant:
--   * INSERTS and identity INCREASES still may not exceed aggregate stock;
--   * organization/product reassignment is always revalidated;
--   * same-product/same-org DECREASES are allowed because they cannot create
--     additional stock or worsen aggregate over-registration.
--
-- This makes the guard monotonic: it blocks operations that increase registered
-- physical coverage, while allowing trusted sale/write-off workflows to reduce
-- that coverage toward the new aggregate balance.

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

  if coalesce(v_mode, 'simple') <> 'variant' then
    return new;
  end if;

  if coalesce(new.stock_qty, 0) < 0 then
    raise exception 'variant stock cannot be negative' using errcode = '23514';
  end if;

  if tg_op = 'UPDATE'
     and new.organization_id = old.organization_id
     and new.product_id = old.product_id
     and coalesce(new.stock_qty, 0) <= coalesce(old.stock_qty, 0) then
    return new;
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
  if coalesce(new.qty_on_hand, 0) < 0 then
    raise exception 'batch stock cannot be negative' using errcode = '23514';
  end if;

  if tg_op = 'UPDATE'
     and new.organization_id = old.organization_id
     and new.product_id = old.product_id
     and coalesce(new.qty_on_hand, 0) <= coalesce(old.qty_on_hand, 0) then
    return new;
  end if;

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
  v_old_on_hand integer;
  v_new_on_hand integer;
begin
  v_old_on_hand := case
    when tg_op = 'UPDATE' and old.status not in ('sold', 'written_off') then 1
    else 0
  end;
  v_new_on_hand := case when new.status not in ('sold', 'written_off') then 1 else 0 end;

  if tg_op = 'UPDATE'
     and new.organization_id = old.organization_id
     and new.product_id = old.product_id
     and v_new_on_hand <= v_old_on_hand then
    return new;
  end if;

  select p.stock_qty into v_product_qty
  from public.products_base p
  where p.id = new.product_id
    and p.organization_id = new.organization_id;

  if not found then
    raise exception 'product not found for serialized-unit registration' using errcode = 'P0002';
  end if;

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

comment on function public.guard_inventory_lot_registration() is
  'Prevents batch identity increases above aggregate stock while allowing same-product quantity decreases during sale/write-off workflows.';
comment on function public.guard_inventory_unit_registration() is
  'Prevents serialized on-hand increases above aggregate stock while allowing same-product transitions that do not increase on-hand count.';
