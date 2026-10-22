-- LakBiz Phase 2 — atomic general inventory custody movement.
--
-- Aggregate products_base.stock_qty and identity totals remain unchanged by a
-- location transfer. Physical availability moves between location balances;
-- serialized units keep their exact location and an explicit custody state.
-- Disabled by default until sales/receipts and location reconciliation are
-- certified together. No app role may enable this preview authority directly.

create table public.inventory_transfer_settings (
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  enabled boolean not null default false
);
alter table public.inventory_transfer_settings enable row level security;
revoke all on public.inventory_transfer_settings from public, anon, authenticated;
grant select on public.inventory_transfer_settings to authenticated;
create policy inventory_transfer_settings_select_org on public.inventory_transfer_settings
for select to authenticated using (
  organization_id in (select organization_id from public.org_members where user_id = (select auth.uid()))
);

create table if not exists public.inventory_location_balances (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  location_id uuid not null references public.inventory_locations(id) on delete restrict,
  product_id text not null references public.products_base(id) on delete cascade,
  variant_id uuid references public.product_variants(id) on delete restrict,
  lot_id uuid references public.inventory_lots(id) on delete restrict,
  qty_on_hand numeric(14, 3) not null default 0 check (qty_on_hand >= 0),
  qty_reserved numeric(14, 3) not null default 0 check (qty_reserved >= 0 and qty_reserved <= qty_on_hand),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists inventory_location_balances_identity_uq
  on public.inventory_location_balances(
    organization_id,
    location_id,
    product_id,
    coalesce(variant_id::text, ''),
    coalesce(lot_id::text, '')
  );
create index if not exists inventory_location_balances_product_idx
  on public.inventory_location_balances(organization_id, product_id, location_id);
create index if not exists inventory_location_balances_lot_idx
  on public.inventory_location_balances(lot_id) where lot_id is not null;

alter table public.inventory_units
  add column if not exists custody_status text not null default 'available'
    check (custody_status in ('available', 'in_transit'));

create or replace function public.guard_inventory_unit_transit()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if old.custody_status = 'in_transit' then
    if tg_op = 'DELETE' then
      raise exception 'A serialized unit in transit cannot be deleted';
    end if;
    if new.status is distinct from old.status
       or new.product_id is distinct from old.product_id
       or new.variant_id is distinct from old.variant_id
       or new.lot_id is distinct from old.lot_id
       or new.organization_id is distinct from old.organization_id then
      raise exception 'A serialized unit in transit cannot be sold or reassigned';
    end if;
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;
revoke all on function public.guard_inventory_unit_transit() from public, anon, authenticated;
create trigger inventory_units_guard_transit before update or delete on public.inventory_units
for each row execute function public.guard_inventory_unit_transit();

create unique index inventory_transfer_lines_exact_identity_uq
on public.inventory_transfer_lines (
  transfer_id, product_id, coalesce(variant_id::text, ''),
  coalesce(lot_id::text, ''), coalesce(unit_id::text, '')
);
alter table public.inventory_transfer_lines add constraint inventory_transfer_lines_finite_qty
check (qty <> 'NaN'::numeric and dispatched_qty <> 'NaN'::numeric and received_qty <> 'NaN'::numeric);

-- Existing operational fields remain editable under their established RLS,
-- but exact custody can move only through the atomic transfer RPCs.
revoke update on table public.inventory_units from authenticated;
grant update (
  variant_id, lot_id, serial_no, imei, secondary_imei, barcode,
  warranty_expiry, status, sale_id, customer_id, notes, updated_at
) on table public.inventory_units to authenticated;

comment on column public.inventory_lots.location_id is
  'Legacy/default receipt location. inventory_location_balances is authoritative when a lot is split across locations.';
comment on column public.inventory_units.location_id is
  'Authoritative physical custody location for this exact serialized unit.';

-- Reconcile the existing aggregate and identity ledgers into each tenant's
-- default location once. ON CONFLICT makes retrying this migration harmless.
insert into public.inventory_location_balances
  (organization_id, location_id, product_id, qty_on_hand)
select p.organization_id, l.id, p.id, p.stock_qty
from public.products_base p
join public.inventory_locations l
  on l.organization_id = p.organization_id and l.is_default
left join public.product_inventory_profiles profile on profile.product_id = p.id
where coalesce(profile.tracking_mode, 'simple') = 'simple'
on conflict do nothing;

insert into public.inventory_location_balances
  (organization_id, location_id, product_id, variant_id, qty_on_hand)
select v.organization_id, l.id, v.product_id, v.id, v.stock_qty
from public.product_variants v
join public.product_inventory_profiles profile
  on profile.product_id = v.product_id and profile.tracking_mode = 'variant'
join public.inventory_locations l
  on l.organization_id = v.organization_id and l.is_default
on conflict do nothing;

insert into public.inventory_location_balances
  (organization_id, location_id, product_id, variant_id, lot_id, qty_on_hand)
select lot.organization_id, coalesce(lot.location_id, location.id), lot.product_id,
       lot.variant_id, lot.id, lot.qty_on_hand
from public.inventory_lots lot
join public.inventory_locations location
  on location.organization_id = lot.organization_id and location.is_default
on conflict do nothing;

alter table public.inventory_location_balances enable row level security;
revoke all on table public.inventory_location_balances from anon, authenticated;
grant select on table public.inventory_location_balances to authenticated;

drop policy if exists inventory_location_balances_select_org on public.inventory_location_balances;
create policy inventory_location_balances_select_org
on public.inventory_location_balances for select to authenticated
using (
  organization_id in (
    select organization_id from public.org_members where user_id = (select auth.uid())
  )
);

drop trigger if exists inventory_location_balances_updated_at on public.inventory_location_balances;
create trigger inventory_location_balances_updated_at
before update on public.inventory_location_balances
for each row execute function public.set_updated_at();

-- Transfer rows are readable through RLS but all mutations now pass through
-- the atomic RPCs below. This prevents clients from forging lifecycle states or
-- changing quantities without moving the corresponding physical custody.
revoke insert, update, delete on table public.inventory_transfers from authenticated;
revoke insert, update, delete on table public.inventory_transfer_lines from authenticated;

create or replace function public.validate_inventory_transfer_scope()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  parent_status text;
begin
  if tg_table_name = 'inventory_transfers' then
    if tg_op = 'DELETE' then
      if old.status not in ('draft', 'cancelled') then
        raise exception 'Only draft or cancelled transfers can be deleted';
      end if;
      return old;
    end if;
    if tg_op = 'INSERT' and new.status <> 'draft' then
      raise exception 'A transfer must start as a draft';
    end if;
    if not exists (
      select 1 from public.inventory_locations
      where id = new.from_location_id and organization_id = new.organization_id
    ) or not exists (
      select 1 from public.inventory_locations
      where id = new.to_location_id and organization_id = new.organization_id
    ) then
      raise exception 'Transfer locations must belong to the transfer organization';
    end if;
    if (tg_op = 'INSERT' or (
      tg_op = 'UPDATE' and (
        new.from_location_id <> old.from_location_id
        or new.to_location_id <> old.to_location_id
      )
    )) and (
      not exists (select 1 from public.inventory_locations where id = new.from_location_id and active)
      or not exists (select 1 from public.inventory_locations where id = new.to_location_id and active)
    ) then
      raise exception 'A new transfer requires active origin and destination locations';
    end if;
    if tg_op = 'UPDATE' then
      if new.organization_id <> old.organization_id then
        raise exception 'Transfer organization cannot be changed';
      end if;
      if old.status <> 'draft' and (
        new.from_location_id <> old.from_location_id
        or new.to_location_id <> old.to_location_id
      ) then
        raise exception 'Transfer route cannot change after dispatch';
      end if;
      if new.status <> old.status and not (
        (old.status = 'draft' and new.status in ('dispatched', 'cancelled'))
        or (old.status = 'dispatched' and new.status = 'in_transit')
        or (old.status = 'in_transit' and new.status = 'received')
      ) then
        raise exception 'Invalid inventory transfer status transition';
      end if;
    end if;
  else
    if tg_op = 'DELETE' then
      select status into parent_status from public.inventory_transfers
      where id = old.transfer_id and organization_id = old.organization_id;
      if parent_status <> 'draft' then
        raise exception 'Transfer lines can only be deleted while the transfer is a draft';
      end if;
      return old;
    end if;

    select status into parent_status from public.inventory_transfers
    where id = new.transfer_id and organization_id = new.organization_id;
    if parent_status is null then
      raise exception 'Transfer line must belong to the transfer organization';
    end if;
    if tg_op = 'INSERT' and (
      parent_status <> 'draft' or new.dispatched_qty <> 0 or new.received_qty <> 0
    ) then
      raise exception 'New transfer lines must start with zero movement on a draft';
    end if;
    if tg_op = 'UPDATE' and parent_status <> 'draft' and (
      new.organization_id <> old.organization_id
      or new.transfer_id <> old.transfer_id
      or new.product_id <> old.product_id
      or new.variant_id is distinct from old.variant_id
      or new.lot_id is distinct from old.lot_id
      or new.unit_id is distinct from old.unit_id
      or new.qty <> old.qty
      or new.dispatched_qty < old.dispatched_qty
      or new.received_qty < old.received_qty
    ) then
      raise exception 'Dispatched transfer identity and quantities are immutable';
    end if;
    if not exists (
      select 1 from public.products_base
      where id = new.product_id and organization_id = new.organization_id
    ) then
      raise exception 'Transfer product must belong to the transfer organization';
    end if;
    if new.variant_id is not null and not exists (
      select 1 from public.product_variants
      where id = new.variant_id and organization_id = new.organization_id
        and product_id = new.product_id
    ) then
      raise exception 'Transfer variant must match the product and organization';
    end if;
    if new.lot_id is not null and not exists (
      select 1 from public.inventory_lots
      where id = new.lot_id and organization_id = new.organization_id
        and product_id = new.product_id
    ) then
      raise exception 'Transfer lot must match the product and organization';
    end if;
    if new.unit_id is not null and not exists (
      select 1 from public.inventory_units
      where id = new.unit_id and organization_id = new.organization_id
        and product_id = new.product_id
    ) then
      raise exception 'Transfer unit must match the product and organization';
    end if;
  end if;
  return new;
end;
$$;
revoke all on function public.validate_inventory_transfer_scope() from public, anon, authenticated;

create or replace function public.create_inventory_transfer_draft(
  p_organization_id uuid,
  p_transfer_id uuid,
  p_from_location_id uuid,
  p_to_location_id uuid,
  p_lines jsonb,
  p_note text default null
)
returns public.inventory_transfers
language plpgsql
security definer
set search_path = ''
as $$
declare
  transfer_row public.inventory_transfers%rowtype;
  line jsonb;
begin
  if not public.org_member_can_write_module(p_organization_id, 'stock')
     or not public.org_member_role_in(p_organization_id, array['owner','manager','data_entry']) then
    raise exception 'Permission denied for inventory transfer' using errcode = '42501';
  end if;
  if jsonb_typeof(coalesce(p_lines, '[]'::jsonb)) <> 'array'
     or jsonb_array_length(coalesce(p_lines, '[]'::jsonb)) = 0 then
    raise exception 'At least one transfer line is required';
  end if;

  insert into public.inventory_transfers (
    id, organization_id, transfer_no, from_location_id, to_location_id, note
  ) values (
    p_transfer_id, p_organization_id,
    'TRF-' || upper(substr(replace(p_transfer_id::text, '-', ''), 1, 8)),
    p_from_location_id, p_to_location_id, nullif(btrim(p_note), '')
  ) returning * into transfer_row;

  for line in select value from jsonb_array_elements(p_lines) loop
    if (line->>'qty')::numeric = 'NaN'::numeric then
      raise exception 'Transfer quantity must be finite';
    end if;
    insert into public.inventory_transfer_lines (
      organization_id, transfer_id, product_id, variant_id, lot_id, unit_id, qty
    ) values (
      p_organization_id,
      transfer_row.id,
      nullif(btrim(line->>'product_id'), ''),
      nullif(line->>'variant_id', '')::uuid,
      nullif(line->>'lot_id', '')::uuid,
      nullif(line->>'unit_id', '')::uuid,
      round((line->>'qty')::numeric, 3)
    );
  end loop;
  return transfer_row;
end;
$$;

create or replace function public.dispatch_inventory_transfer(p_transfer_id uuid)
returns public.inventory_transfers
language plpgsql
security definer
set search_path = ''
as $$
declare
  transfer_row public.inventory_transfers%rowtype;
  line public.inventory_transfer_lines%rowtype;
  balance_row public.inventory_location_balances%rowtype;
  tracking_mode text;
begin
  select * into transfer_row from public.inventory_transfers
  where id = p_transfer_id for update;
  if not found or transfer_row.status <> 'draft'
     or not public.org_member_can_write_module(transfer_row.organization_id, 'stock')
     or not public.org_member_role_in(transfer_row.organization_id, array['owner','manager','data_entry']) then
    raise exception 'Transfer is not an accessible draft' using errcode = '42501';
  end if;
  if not exists (select 1 from public.inventory_transfer_lines where transfer_id = transfer_row.id) then
    raise exception 'Transfer has no lines';
  end if;
  if not exists (select 1 from public.inventory_transfer_settings
    where organization_id = transfer_row.organization_id and enabled) then
    raise exception 'Location transfer authority requires certified stock integration';
  end if;

  for line in select * from public.inventory_transfer_lines
              where transfer_id = transfer_row.id
              order by product_id, variant_id, lot_id, unit_id, id for update loop
    select coalesce(profile.tracking_mode, 'simple') into tracking_mode
    from public.products_base p
    left join public.product_inventory_profiles profile on profile.product_id = p.id
    where p.id = line.product_id and p.organization_id = transfer_row.organization_id
    for update of p;
    if (tracking_mode in ('serial', 'variant_serial')) <> (line.unit_id is not null)
       or (tracking_mode in ('lot', 'variant_lot')) <> (line.lot_id is not null and line.unit_id is null)
       or (tracking_mode in ('variant', 'variant_serial', 'variant_lot')) <> (line.variant_id is not null) then
      raise exception 'Transfer identity does not match product tracking mode';
    end if;
    if line.lot_id is not null and not exists (
      select 1 from public.inventory_lots where id = line.lot_id
      and organization_id = transfer_row.organization_id and product_id = line.product_id
      and variant_id is not distinct from line.variant_id and status = 'available'
      and (expiry_date is null or expiry_date >= (now() at time zone 'Asia/Colombo')::date)
    ) then
      raise exception 'Transfer lot is blocked or has a different variant';
    end if;
    if line.unit_id is not null then
      update public.inventory_units
      set custody_status = 'in_transit', updated_at = now()
      where id = line.unit_id
        and organization_id = transfer_row.organization_id
        and product_id = line.product_id
        and variant_id is not distinct from line.variant_id
        and lot_id is not distinct from line.lot_id
        and location_id = transfer_row.from_location_id
        and custody_status = 'available'
        and status = 'available';
      if not found then raise exception 'Serialized unit is unavailable at the origin location'; end if;
    else
      select * into balance_row from public.inventory_location_balances
      where organization_id = transfer_row.organization_id
        and location_id = transfer_row.from_location_id
        and product_id = line.product_id
        and variant_id is not distinct from line.variant_id
        and lot_id is not distinct from line.lot_id
      for update;
      if not found or balance_row.qty_on_hand - balance_row.qty_reserved < line.qty then
        raise exception 'Insufficient unreserved stock at the origin location';
      end if;
      update public.inventory_location_balances
      set qty_on_hand = qty_on_hand - line.qty
      where id = balance_row.id;
    end if;
    update public.inventory_transfer_lines
    set dispatched_qty = qty
    where id = line.id;
  end loop;

  update public.inventory_transfers
  set status = 'dispatched', dispatched_at = now(), dispatched_by = auth.uid()
  where id = transfer_row.id returning * into transfer_row;
  return transfer_row;
end;
$$;

create or replace function public.mark_inventory_transfer_in_transit(p_transfer_id uuid)
returns public.inventory_transfers
language plpgsql
security definer
set search_path = ''
as $$
declare transfer_row public.inventory_transfers%rowtype;
begin
  select * into transfer_row from public.inventory_transfers where id = p_transfer_id for update;
  if not found or transfer_row.status <> 'dispatched'
     or not public.org_member_can_write_module(transfer_row.organization_id, 'stock')
     or not public.org_member_role_in(transfer_row.organization_id, array['owner','manager','data_entry']) then
    raise exception 'Transfer is not ready for transit' using errcode = '42501';
  end if;
  update public.inventory_transfers set status = 'in_transit'
  where id = transfer_row.id returning * into transfer_row;
  return transfer_row;
end;
$$;

create or replace function public.receive_inventory_transfer(p_transfer_id uuid)
returns public.inventory_transfers
language plpgsql
security definer
set search_path = ''
as $$
declare
  transfer_row public.inventory_transfers%rowtype;
  line public.inventory_transfer_lines%rowtype;
  balance_row public.inventory_location_balances%rowtype;
begin
  select * into transfer_row from public.inventory_transfers
  where id = p_transfer_id for update;
  if not found or transfer_row.status <> 'in_transit'
     or not public.org_member_can_write_module(transfer_row.organization_id, 'stock')
     or not public.org_member_role_in(transfer_row.organization_id, array['owner','manager','data_entry']) then
    raise exception 'Transfer is not ready to receive' using errcode = '42501';
  end if;

  for line in select * from public.inventory_transfer_lines
              where transfer_id = transfer_row.id
              order by product_id, variant_id, lot_id, unit_id, id for update loop
    if line.dispatched_qty <> line.qty then
      raise exception 'Transfer line was not fully dispatched';
    end if;
    if line.unit_id is not null then
      update public.inventory_units
      set location_id = transfer_row.to_location_id,
          custody_status = 'available', updated_at = now()
      where id = line.unit_id
        and organization_id = transfer_row.organization_id
        and location_id = transfer_row.from_location_id
        and custody_status = 'in_transit';
      if not found then raise exception 'Serialized unit custody no longer matches this transfer'; end if;
    else
      perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
        transfer_row.organization_id::text || ':' || transfer_row.to_location_id::text || ':' ||
        line.product_id || ':' || coalesce(line.variant_id::text, '') || ':' || coalesce(line.lot_id::text, ''),
        0
      ));
      select * into balance_row from public.inventory_location_balances
      where organization_id = transfer_row.organization_id
        and location_id = transfer_row.to_location_id
        and product_id = line.product_id
        and variant_id is not distinct from line.variant_id
        and lot_id is not distinct from line.lot_id
      for update;
      if found then
        update public.inventory_location_balances
        set qty_on_hand = qty_on_hand + line.qty
        where id = balance_row.id;
      else
        insert into public.inventory_location_balances (
          organization_id, location_id, product_id, variant_id, lot_id, qty_on_hand
        ) values (
          transfer_row.organization_id, transfer_row.to_location_id,
          line.product_id, line.variant_id, line.lot_id, line.qty
        );
      end if;
    end if;
    update public.inventory_transfer_lines set received_qty = qty where id = line.id;
  end loop;

  update public.inventory_transfers
  set status = 'received', received_at = now(), received_by = auth.uid()
  where id = transfer_row.id returning * into transfer_row;
  return transfer_row;
end;
$$;

create or replace function public.cancel_inventory_transfer(p_transfer_id uuid)
returns public.inventory_transfers
language plpgsql
security definer
set search_path = ''
as $$
declare transfer_row public.inventory_transfers%rowtype;
begin
  select * into transfer_row from public.inventory_transfers where id = p_transfer_id for update;
  if not found or transfer_row.status <> 'draft'
     or not public.org_member_can_write_module(transfer_row.organization_id, 'stock')
     or not public.org_member_role_in(transfer_row.organization_id, array['owner','manager','data_entry']) then
    raise exception 'Transfer is not an accessible draft' using errcode = '42501';
  end if;
  update public.inventory_transfers set status = 'cancelled'
  where id = transfer_row.id returning * into transfer_row;
  return transfer_row;
end;
$$;

do $$
declare signature text;
begin
  foreach signature in array array[
    'public.create_inventory_transfer_draft(uuid,uuid,uuid,uuid,jsonb,text)',
    'public.dispatch_inventory_transfer(uuid)',
    'public.mark_inventory_transfer_in_transit(uuid)',
    'public.receive_inventory_transfer(uuid)',
    'public.cancel_inventory_transfer(uuid)'
  ] loop
    execute 'revoke all on function ' || signature || ' from public, anon';
    execute 'grant execute on function ' || signature || ' to authenticated';
  end loop;
end $$;

comment on table public.inventory_location_balances is
  'Authoritative physical custody by location for simple, variant and lot stock. Aggregate business stock is unchanged by internal transfers.';
comment on function public.dispatch_inventory_transfer(uuid) is
  'Atomically removes unreserved source availability and marks exact serialized units in transit.';
comment on function public.receive_inventory_transfer(uuid) is
  'Atomically adds destination availability and completes exact serialized-unit custody.';
