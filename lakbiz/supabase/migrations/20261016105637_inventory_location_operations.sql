-- Phase 2: gate-controlled adapters for existing stock writers, holds and
-- audited default-location reconciliation. This migration never enables a shop.
create table public.inventory_reservations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  balance_id uuid references public.inventory_location_balances(id) on delete restrict,
  unit_id uuid references public.inventory_units(id) on delete restrict,
  qty numeric(14,3) not null check (qty > 0 and qty <> 'NaN'::numeric),
  reason text not null check (btrim(reason) <> ''),
  status text not null default 'active' check (status in ('active','released')),
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  released_by uuid references auth.users(id), released_at timestamptz,
  check ((balance_id is null) <> (unit_id is null)),
  check (unit_id is null or qty = 1)
);
create unique index inventory_reservations_active_unit_uq
  on public.inventory_reservations(unit_id) where status = 'active' and unit_id is not null;
create index inventory_reservations_org_status_idx on public.inventory_reservations(organization_id,status,created_at);
create index inventory_reservations_balance_idx on public.inventory_reservations(balance_id) where status = 'active';

create table public.inventory_reconciliation_audit (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  balance_id uuid not null references public.inventory_location_balances(id),
  before_qty numeric(14,3) not null, after_qty numeric(14,3) not null,
  reason text not null check (btrim(reason) <> ''),
  actor_id uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now()
);
create index inventory_reconciliation_audit_org_idx on public.inventory_reconciliation_audit(organization_id,created_at);
alter table public.inventory_reservations enable row level security;
alter table public.inventory_reconciliation_audit enable row level security;
revoke all on public.inventory_reservations, public.inventory_reconciliation_audit from public, anon, authenticated;
grant select on public.inventory_reservations, public.inventory_reconciliation_audit to authenticated;
create policy inventory_reservations_select_org on public.inventory_reservations
for select to authenticated using (public.org_member_role_in(organization_id,array['owner','manager','data_entry']));
create policy inventory_reconciliation_audit_select_org on public.inventory_reconciliation_audit
for select to authenticated using (public.org_member_role_in(organization_id,array['owner','manager']));

-- Register new identities at the default location even before activation.
create function inventory_internal.assign_default_inventory_location()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  if new.location_id is null then
    select id into new.location_id from public.inventory_locations
      where organization_id=new.organization_id and is_default and active;
  end if;
  if new.location_id is not null and not exists (
    select 1 from public.inventory_locations where id=new.location_id and organization_id=new.organization_id
  ) then raise exception 'Inventory location belongs to a different organization'; end if;
  return new;
end;
$$;
create trigger inventory_lots_assign_location before insert or update of location_id,organization_id on public.inventory_lots
for each row execute function inventory_internal.assign_default_inventory_location();
create trigger inventory_units_assign_location before insert or update of location_id,organization_id on public.inventory_units
for each row execute function inventory_internal.assign_default_inventory_location();

-- Existing mutation paths retain responsibility for aggregate/identity stock.
-- Enabled shops atomically mirror their deltas into the main custody location.
create function inventory_internal.sync_default_location_quantity()
returns trigger language plpgsql security definer set search_path='' as $$
declare
  tenant uuid; pid text; vid uuid; lid uuid; mode text;
  old_qty numeric:=0; new_qty numeric:=0; delta numeric; loc uuid;
  balance_row public.inventory_location_balances%rowtype;
begin
  if tg_op='DELETE' then tenant:=old.organization_id; else tenant:=new.organization_id; end if;
  if not exists(select 1 from public.inventory_transfer_settings where organization_id=tenant and enabled) then
    if tg_op='DELETE' then return old; else return new; end if;
  end if;
  if tg_op='UPDATE' and new.organization_id<>old.organization_id then
    raise exception 'Enabled inventory cannot be reassigned to another organization';
  end if;
  if tg_table_name='products_base' then
    if tg_op='DELETE' then pid:=old.id; else pid:=new.id; end if;
  else
    if tg_op='DELETE' then pid:=old.product_id; else pid:=new.product_id; end if;
    if tg_op='UPDATE' and new.product_id<>old.product_id then
      raise exception 'Registered inventory cannot be reassigned to another product';
    end if;
  end if;
  select coalesce(profile.tracking_mode,'simple') into mode
    from public.products_base p left join public.product_inventory_profiles profile
      on profile.product_id=p.id and profile.organization_id=p.organization_id
    where p.id=pid and p.organization_id=tenant;
  if tg_table_name='products_base' then
    if coalesce(mode,'simple')<>'simple' then
      if tg_op='DELETE' then return old; else return new; end if;
    end if;
    if tg_op<>'INSERT' then old_qty:=old.stock_qty; end if;
    if tg_op<>'DELETE' then new_qty:=new.stock_qty; end if;
  elsif tg_table_name='product_variants' then
    if mode<>'variant' then
      if tg_op='DELETE' then return old; else return new; end if;
    end if;
    if tg_op='DELETE' then vid:=old.id; else vid:=new.id; end if;
    if tg_op<>'INSERT' then old_qty:=old.stock_qty; end if;
    if tg_op<>'DELETE' then new_qty:=new.stock_qty; end if;
  else
    if mode not in ('lot','variant_lot') then
      if tg_op='DELETE' then return old; else return new; end if;
    end if;
    if tg_op='DELETE' then lid:=old.id; vid:=old.variant_id; else lid:=new.id; vid:=new.variant_id; end if;
    if tg_op='UPDATE' and new.variant_id is distinct from old.variant_id then
      raise exception 'Lot variant cannot change after location registration';
    end if;
    if tg_op<>'INSERT' then old_qty:=old.qty_on_hand; end if;
    if tg_op<>'DELETE' then new_qty:=new.qty_on_hand; end if;
  end if;
  delta:=new_qty-old_qty;
  if delta=0 then if tg_op='DELETE' then return old; else return new; end if; end if;
  if delta='NaN'::numeric then raise exception 'Stock quantity must be finite'; end if;
  select id into loc from public.inventory_locations where organization_id=tenant and is_default and active for share;
  if loc is null then raise exception 'An active default stock location is required'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    tenant::text||':'||loc::text||':'||pid||':'||coalesce(vid::text,'')||':'||coalesce(lid::text,''),0));
  select * into balance_row from public.inventory_location_balances
    where organization_id=tenant and location_id=loc and product_id=pid
      and variant_id is not distinct from vid and lot_id is not distinct from lid for update;
  if not found then
    if delta<0 then raise exception 'Main-location stock is missing; reconcile before this operation'; end if;
    insert into public.inventory_location_balances(organization_id,location_id,product_id,variant_id,lot_id,qty_on_hand)
      values(tenant,loc,pid,vid,lid,delta);
  else
    if balance_row.qty_on_hand+delta<balance_row.qty_reserved then
      raise exception 'Insufficient unreserved stock at the main location; release holds or receive a transfer';
    end if;
    update public.inventory_location_balances set qty_on_hand=qty_on_hand+delta where id=balance_row.id;
  end if;
  if tg_op='DELETE' then return old; else return new; end if;
end;
$$;
create trigger products_location_quantity after insert or update or delete on public.products_base
for each row execute function inventory_internal.sync_default_location_quantity();
create trigger variants_location_quantity after insert or update or delete on public.product_variants
for each row execute function inventory_internal.sync_default_location_quantity();
create trigger lots_location_quantity after insert or update or delete on public.inventory_lots
for each row execute function inventory_internal.sync_default_location_quantity();

create function public.reserve_inventory_stock(
  p_organization_id uuid, p_reservation_id uuid, p_qty numeric, p_reason text,
  p_balance_id uuid default null, p_unit_id uuid default null
) returns public.inventory_reservations
language plpgsql security definer set search_path='' as $$
declare result public.inventory_reservations%rowtype;
begin
  if auth.uid() is null or not public.org_member_can_write_module(p_organization_id,'stock')
    or not public.org_member_role_in(p_organization_id,array['owner','manager','data_entry']) then
    raise exception 'Reservation requires stock write access' using errcode='42501';
  end if;
  if not exists(select 1 from public.inventory_transfer_settings where organization_id=p_organization_id and enabled) then
    raise exception 'Location stock authority is not enabled';
  end if;
  if p_qty is null or p_qty<=0 or p_qty='NaN'::numeric or round(p_qty,3)<>p_qty
     or nullif(btrim(p_reason),'') is null or ((p_balance_id is null)=(p_unit_id is null)) then
    raise exception 'Choose one stock identity, a positive exact quantity and a reason';
  end if;
  if p_balance_id is not null then
    update public.inventory_location_balances set qty_reserved=qty_reserved+p_qty
      where id=p_balance_id and organization_id=p_organization_id and qty_on_hand-qty_reserved>=p_qty
        and exists(select 1 from public.inventory_locations location where location.id=location_id and location.active)
        and (lot_id is null or exists(select 1 from public.inventory_lots lot where lot.id=lot_id
          and lot.status='available' and (lot.expiry_date is null or lot.expiry_date>=(now() at time zone 'Asia/Colombo')::date)));
    if not found then raise exception 'Insufficient unreserved location stock'; end if;
  else
    if p_qty<>1 then raise exception 'A serialized reservation must have quantity one'; end if;
    update public.inventory_units set status='reserved'
      where id=p_unit_id and organization_id=p_organization_id and status='available' and custody_status='available';
    if not found then raise exception 'Serialized unit is unavailable'; end if;
  end if;
  insert into public.inventory_reservations(id,organization_id,balance_id,unit_id,qty,reason)
    values(p_reservation_id,p_organization_id,p_balance_id,p_unit_id,p_qty,btrim(p_reason)) returning * into result;
  return result;
end;
$$;

create function public.release_inventory_reservation(p_reservation_id uuid)
returns public.inventory_reservations language plpgsql security definer set search_path='' as $$
declare result public.inventory_reservations%rowtype;
begin
  select * into result from public.inventory_reservations where id=p_reservation_id for update;
  if not found or auth.uid() is null or not public.org_member_can_write_module(result.organization_id,'stock')
    or not public.org_member_role_in(result.organization_id,array['owner','manager','data_entry']) then
    raise exception 'Reservation not found or inaccessible' using errcode='42501';
  end if;
  if result.status='released' then return result; end if;
  if result.balance_id is not null then
    update public.inventory_location_balances set qty_reserved=qty_reserved-result.qty
      where id=result.balance_id and organization_id=result.organization_id and qty_reserved>=result.qty;
  else
    -- Release the ledger row first so the unit guard can permit availability.
    update public.inventory_reservations set status='released',released_by=auth.uid(),released_at=now()
      where id=result.id;
    update public.inventory_units set status='available'
      where id=result.unit_id and organization_id=result.organization_id and status='reserved';
  end if;
  if not found then raise exception 'Reservation custody has changed; reconciliation is required'; end if;
  update public.inventory_reservations set status='released',released_by=auth.uid(),released_at=coalesce(released_at,now())
    where id=result.id returning * into result;
  return result;
end;
$$;

create function inventory_internal.guard_reserved_inventory_unit()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  if exists(select 1 from public.inventory_reservations where unit_id=old.id and status='active') then
    if tg_op='DELETE' then raise exception 'Release the unit reservation before deletion'; end if;
    if new.status<>'reserved' or new.location_id is distinct from old.location_id
      or new.custody_status<>old.custody_status then
      raise exception 'Release the unit reservation before moving or selling this unit';
    end if;
  end if;
  if tg_op='DELETE' then return old; else return new; end if;
end;
$$;
create trigger inventory_units_guard_reservation before update or delete on public.inventory_units
for each row execute function inventory_internal.guard_reserved_inventory_unit();

create function public.reconcile_default_inventory_balance(
  p_balance_id uuid, p_expected_qty numeric, p_reason text
) returns public.inventory_location_balances language plpgsql security definer set search_path='' as $$
declare b public.inventory_location_balances%rowtype; r record; target numeric;
begin
  select * into b from public.inventory_location_balances where id=p_balance_id;
  if not found or auth.uid() is null or not public.org_member_can_write_module(b.organization_id,'stock')
    or not public.org_member_role_in(b.organization_id,array['owner']) then
    raise exception 'Reconciliation requires owner stock write access' using errcode='42501';
  end if;
  if nullif(btrim(p_reason),'') is null or p_expected_qty is null then
    raise exception 'A counted balance and reconciliation reason are required';
  end if;
  perform 1 from public.products_base where id=b.product_id and organization_id=b.organization_id for update;
  select * into b from public.inventory_location_balances where id=p_balance_id for update;
  if b.qty_on_hand<>p_expected_qty then raise exception 'Balance changed; reload before reconciliation'; end if;
  if not exists(select 1 from public.inventory_locations where id=b.location_id and is_default) then
    raise exception 'Only the default location can absorb a source reconciliation difference';
  end if;
  select * into r from public.get_inventory_location_reconciliation(b.organization_id,b.product_id)
    where identity_kind<>'product_total' and variant_id is not distinct from b.variant_id
      and lot_id is not distinct from b.lot_id and unit_id is null;
  if not found then raise exception 'Source stock identity is unavailable'; end if;
  target:=b.qty_on_hand+r.difference;
  if target<b.qty_reserved then raise exception 'Reconciliation would consume reserved or branch stock'; end if;
  update public.inventory_location_balances set qty_on_hand=target where id=b.id returning * into b;
  insert into public.inventory_reconciliation_audit(organization_id,balance_id,before_qty,after_qty,reason)
    values(b.organization_id,b.id,p_expected_qty,target,btrim(p_reason));
  return b;
end;
$$;

revoke all on function public.reserve_inventory_stock(uuid,uuid,numeric,text,uuid,uuid) from public,anon;
revoke all on function public.release_inventory_reservation(uuid) from public,anon;
revoke all on function public.reconcile_default_inventory_balance(uuid,numeric,text) from public,anon;
grant execute on function public.reserve_inventory_stock(uuid,uuid,numeric,text,uuid,uuid) to authenticated;
grant execute on function public.release_inventory_reservation(uuid) to authenticated;
grant execute on function public.reconcile_default_inventory_balance(uuid,numeric,text) to authenticated;
revoke all on all functions in schema inventory_internal from public,anon,authenticated;

-- Targeted legacy actions submit compare-and-swap commands rather than
-- replacing newer cloud quantities. Command replay is durable and idempotent.
create table public.inventory_stock_commands (
  organization_id uuid not null references public.organizations(id),
  command_key text not null, product_id text not null references public.products_base(id),
  expected_qty numeric(14,3) not null, next_qty numeric(14,3) not null,
  actor_id uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  primary key(organization_id,command_key)
);
alter table public.inventory_stock_commands enable row level security;
revoke all on public.inventory_stock_commands from public,anon,authenticated;
grant select on public.inventory_stock_commands to authenticated;
create policy inventory_stock_commands_select_org on public.inventory_stock_commands
for select to authenticated using(public.org_member_role_in(organization_id,array['owner','manager','data_entry']));

create function public.apply_inventory_stock_commands(p_organization_id uuid,p_changes jsonb)
returns void language plpgsql security definer set search_path='' as $$
declare change jsonb; prior public.inventory_stock_commands%rowtype;
  pid text; key text; expected numeric; desired numeric; current_qty numeric; mode text;
  log_row jsonb; signed_qty numeric; resolved_name text;
begin
  if auth.uid() is null or not public.org_member_can_write_module(p_organization_id,'stock')
    or not public.org_member_role_in(p_organization_id,array['owner','manager','data_entry']) then
    raise exception 'Atomic stock updates require stock write access' using errcode='42501';
  end if;
  if not exists(select 1 from public.inventory_transfer_settings where organization_id=p_organization_id and enabled) then
    raise exception 'Location stock authority is not enabled';
  end if;
  if jsonb_typeof(p_changes)<>'array' or jsonb_array_length(p_changes)>200 then
    raise exception 'Submit a bounded array of stock commands';
  end if;
  for change in select value from jsonb_array_elements(p_changes) order by value->>'product_id',value->>'command_key' loop
    pid:=change->>'product_id'; key:=nullif(btrim(change->>'command_key'),'');
    expected:=(change->>'expected_qty')::numeric; desired:=(change->>'next_qty')::numeric;
    if key is null or expected is null or desired is null or expected<0 or desired<0
      or expected='NaN'::numeric or desired='NaN'::numeric or round(expected,3)<>expected or round(desired,3)<>desired then
      raise exception 'Invalid stock command quantities or key';
    end if;
    select p.stock_qty,coalesce(profile.tracking_mode,'simple') into current_qty,mode
      from public.products_base p left join public.product_inventory_profiles profile
        on profile.product_id=p.id and profile.organization_id=p.organization_id
      where p.id=pid and p.organization_id=p_organization_id for update of p;
    if not found then raise exception 'Stock product not found in this organization'; end if;
    select * into prior from public.inventory_stock_commands
      where organization_id=p_organization_id and command_key=key;
    if found then
      if prior.product_id<>pid or prior.expected_qty<>expected or prior.next_qty<>desired then
        raise exception 'Stock command key was reused with different quantities';
      end if;
      continue;
    end if;
    if current_qty<>expected then raise exception 'Stock changed on another device. Reload before retrying this stock action.'; end if;
    if mode<>'simple' and desired<expected then
      raise exception 'Tracked stock requires an exact variant, lot or serial operation';
    end if;
    update public.products_base set stock_qty=desired where id=pid and organization_id=p_organization_id;
    log_row:=change->'stock_log';
    if log_row is not null and log_row<>'null'::jsonb then
      signed_qty:=case when log_row->>'log_type' in ('in','purchase','job_return','customer_return') then 1 else -1 end
        *abs((log_row->>'qty')::numeric);
      if key<>'stock-log:'||(log_row->>'id') or desired-expected<>signed_qty
        or log_row->>'product_id'<>pid then raise exception 'Stock log does not match the stock command'; end if;
      if nullif(log_row->>'related_supplier_id','') is not null then
        perform 1 from public.suppliers where id=log_row->>'related_supplier_id' and organization_id=p_organization_id;
        if not found then raise exception 'Related supplier must belong to this organization'; end if;
      end if;
      if nullif(log_row->>'related_job_id','') is not null then
        perform 1 from public.ac_jobs_base where id=log_row->>'related_job_id' and organization_id=p_organization_id;
        if not found then raise exception 'Related job must belong to this organization'; end if;
      end if;
      select name into resolved_name from public.products_base where id=pid and organization_id=p_organization_id;
      insert into public.stock_logs(id,organization_id,product_id,product_name,log_type,qty,note,log_date,related_job_id,related_supplier_id,user_id)
      values(log_row->>'id',p_organization_id,pid,resolved_name,log_row->>'log_type',(log_row->>'qty')::numeric,
        log_row->>'note',coalesce((log_row->>'log_date')::timestamptz,now()),log_row->>'related_job_id',log_row->>'related_supplier_id',auth.uid());
    end if;
    insert into public.inventory_stock_commands(organization_id,command_key,product_id,expected_qty,next_qty)
      values(p_organization_id,key,pid,expected,desired);
  end loop;
end;
$$;
revoke all on function public.apply_inventory_stock_commands(uuid,jsonb) from public,anon;
grant execute on function public.apply_inventory_stock_commands(uuid,jsonb) to authenticated;

create table public.inventory_opening_custody_audit (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  reason text not null check(btrim(reason)<>''),
  balance_rows_added integer not null, unit_locations_assigned integer not null,
  actor_id uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now()
);
alter table public.inventory_opening_custody_audit enable row level security;
revoke all on public.inventory_opening_custody_audit from public,anon,authenticated;
grant select on public.inventory_opening_custody_audit to authenticated;
create policy inventory_opening_custody_audit_select_owner on public.inventory_opening_custody_audit
for select to authenticated using(public.org_member_role_in(organization_id,array['owner','manager']));

create function public.initialize_inventory_opening_custody(p_organization_id uuid,p_reason text)
returns void language plpgsql security definer set search_path='' as $$
declare main_location uuid; identity_row record; added integer:=0; units_assigned integer:=0;
begin
  if auth.uid() is null or not public.org_member_can_write_module(p_organization_id,'stock')
    or not public.org_member_role_in(p_organization_id,array['owner']) then
    raise exception 'Opening custody requires the organization owner' using errcode='42501';
  end if;
  if nullif(btrim(p_reason),'') is null then raise exception 'Record a verified opening-stock reason'; end if;
  if exists(select 1 from public.inventory_transfer_settings where organization_id=p_organization_id and enabled)
    or exists(select 1 from public.inventory_transfers where organization_id=p_organization_id and status in ('dispatched','in_transit'))
    or exists(select 1 from public.inventory_reservations where organization_id=p_organization_id and status='active') then
    raise exception 'Opening custody must be prepared before activation and physical movement';
  end if;
  perform 1 from public.products_base where organization_id=p_organization_id order by id for update;
  select id into main_location from public.inventory_locations
    where organization_id=p_organization_id and is_default and active for share;
  if main_location is null then raise exception 'Create an active main stock location first'; end if;
  for identity_row in select * from public.get_inventory_location_reconciliation(p_organization_id,null)
    where identity_kind in ('simple','variant','lot') and source_qty>0
  loop
    if not exists(select 1 from public.inventory_location_balances b
      where b.organization_id=p_organization_id and b.product_id=identity_row.product_id
        and b.variant_id is not distinct from identity_row.variant_id
        and b.lot_id is not distinct from identity_row.lot_id) then
      insert into public.inventory_location_balances(organization_id,location_id,product_id,variant_id,lot_id,qty_on_hand)
      values(p_organization_id,main_location,identity_row.product_id,identity_row.variant_id,identity_row.lot_id,identity_row.source_qty);
      added:=added+1;
    end if;
  end loop;
  update public.inventory_units set location_id=main_location
    where organization_id=p_organization_id and location_id is null and custody_status='available'
      and status not in ('sold','written_off');
  get diagnostics units_assigned=row_count;
  insert into public.inventory_opening_custody_audit(organization_id,reason,balance_rows_added,unit_locations_assigned)
    values(p_organization_id,btrim(p_reason),added,units_assigned);
end;
$$;
revoke all on function public.initialize_inventory_opening_custody(uuid,text) from public,anon;
grant execute on function public.initialize_inventory_opening_custody(uuid,text) to authenticated;
