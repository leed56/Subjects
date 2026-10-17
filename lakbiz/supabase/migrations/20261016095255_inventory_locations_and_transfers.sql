-- LakBiz Phase 2 — general inventory locations and transfer authority.
--
-- Additive only. This establishes physical custody for advanced inventory
-- identities and a dispatch -> in transit -> receive transfer ledger. It does
-- not reinterpret products_base.stock_qty; simple-stock reconciliation is a
-- separate controlled migration after location totals have been certified.

create table if not exists public.inventory_locations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  code text not null,
  name text not null,
  kind text not null default 'stockroom'
    check (kind in ('shop', 'warehouse', 'stockroom', 'vehicle', 'other')),
  address text,
  is_default boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (btrim(code) <> '' and btrim(name) <> '')
);
create unique index if not exists inventory_locations_org_code_uq
  on public.inventory_locations(organization_id, lower(code));
create unique index if not exists inventory_locations_one_default_uq
  on public.inventory_locations(organization_id) where is_default;
create index if not exists inventory_locations_org_active_idx
  on public.inventory_locations(organization_id, active, name);

-- Every existing tenant with inventory receives one deterministic custody
-- location before identity rows are linked to locations.
insert into public.inventory_locations (organization_id, code, name, kind, is_default)
select distinct source.organization_id, 'MAIN', 'Main stockroom', 'stockroom', true
from (
  select organization_id from public.products_base
  union
  select organization_id from public.inventory_lots
  union
  select organization_id from public.inventory_units
) source
where not exists (
  select 1 from public.inventory_locations l
  where l.organization_id = source.organization_id and l.is_default
);

alter table public.inventory_lots
  add column if not exists location_id uuid references public.inventory_locations(id) on delete restrict;
alter table public.inventory_units
  add column if not exists location_id uuid references public.inventory_locations(id) on delete restrict;

update public.inventory_lots lot
set location_id = location.id
from public.inventory_locations location
where lot.location_id is null
  and location.organization_id = lot.organization_id
  and location.is_default;

update public.inventory_units unit_row
set location_id = location.id
from public.inventory_locations location
where unit_row.location_id is null
  and location.organization_id = unit_row.organization_id
  and location.is_default;

create index if not exists inventory_lots_location_idx
  on public.inventory_lots(organization_id, location_id, product_id, status);
create index if not exists inventory_units_location_idx
  on public.inventory_units(organization_id, location_id, product_id, status);

create table if not exists public.inventory_transfers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  transfer_no text not null,
  from_location_id uuid not null references public.inventory_locations(id) on delete restrict,
  to_location_id uuid not null references public.inventory_locations(id) on delete restrict,
  status text not null default 'draft'
    check (status in ('draft', 'dispatched', 'in_transit', 'received', 'cancelled')),
  note text,
  dispatched_at timestamptz,
  dispatched_by uuid references auth.users(id) on delete set null,
  received_at timestamptz,
  received_by uuid references auth.users(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (from_location_id <> to_location_id),
  check (btrim(transfer_no) <> '')
);
create unique index if not exists inventory_transfers_org_no_uq
  on public.inventory_transfers(organization_id, transfer_no);
create index if not exists inventory_transfers_org_status_idx
  on public.inventory_transfers(organization_id, status, created_at desc);

create table if not exists public.inventory_transfer_lines (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  transfer_id uuid not null references public.inventory_transfers(id) on delete cascade,
  product_id text not null references public.products_base(id) on delete restrict,
  variant_id uuid references public.product_variants(id) on delete restrict,
  lot_id uuid references public.inventory_lots(id) on delete restrict,
  unit_id uuid references public.inventory_units(id) on delete restrict,
  qty numeric(14, 3) not null check (qty > 0),
  dispatched_qty numeric(14, 3) not null default 0 check (dispatched_qty >= 0),
  received_qty numeric(14, 3) not null default 0 check (received_qty >= 0),
  created_at timestamptz not null default now(),
  check (dispatched_qty <= qty),
  check (received_qty <= dispatched_qty),
  check (unit_id is null or qty = 1)
);
create index if not exists inventory_transfer_lines_transfer_idx
  on public.inventory_transfer_lines(organization_id, transfer_id);
create index if not exists inventory_transfer_lines_identity_idx
  on public.inventory_transfer_lines(organization_id, product_id, lot_id, unit_id);

-- RLS protects which organization a user can write, while these guards also
-- prove that every referenced identity belongs to that same organization.
-- This closes cross-tenant foreign-key substitution even if an id is guessed.
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

    if not exists (
      select 1 from public.inventory_locations
      where id = new.from_location_id and organization_id = new.organization_id
    ) or not exists (
      select 1 from public.inventory_locations
      where id = new.to_location_id and organization_id = new.organization_id
    ) then
      raise exception 'Transfer locations must belong to the transfer organization';
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
      select status into parent_status
      from public.inventory_transfers
      where id = old.transfer_id and organization_id = old.organization_id;
      if parent_status <> 'draft' then
        raise exception 'Transfer lines can only change while the transfer is a draft';
      end if;
      return old;
    end if;

    select status into parent_status
    from public.inventory_transfers
    where id = new.transfer_id and organization_id = new.organization_id;

    if parent_status is null then
      raise exception 'Transfer line must belong to the transfer organization';
    end if;
    if parent_status <> 'draft' then
      raise exception 'Transfer lines can only change while the transfer is a draft';
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
        and location_id = (select from_location_id from public.inventory_transfers where id = new.transfer_id)
    ) then
      raise exception 'Transfer lot must be held at the origin location';
    end if;
    if new.unit_id is not null and not exists (
      select 1 from public.inventory_units
      where id = new.unit_id and organization_id = new.organization_id
        and product_id = new.product_id
        and location_id = (select from_location_id from public.inventory_transfers where id = new.transfer_id)
    ) then
      raise exception 'Transfer unit must be held at the origin location';
    end if;
  end if;

  return new;
end;
$$;

revoke all on function public.validate_inventory_transfer_scope() from public, anon, authenticated;

drop trigger if exists inventory_transfers_validate_scope on public.inventory_transfers;
create trigger inventory_transfers_validate_scope
  before insert or update or delete on public.inventory_transfers
  for each row execute function public.validate_inventory_transfer_scope();
drop trigger if exists inventory_transfer_lines_validate_scope on public.inventory_transfer_lines;
create trigger inventory_transfer_lines_validate_scope
  before insert or update or delete on public.inventory_transfer_lines
  for each row execute function public.validate_inventory_transfer_scope();

alter table public.inventory_locations enable row level security;
alter table public.inventory_transfers enable row level security;
alter table public.inventory_transfer_lines enable row level security;

revoke all on table public.inventory_locations from anon, authenticated;
revoke all on table public.inventory_transfers from anon, authenticated;
revoke all on table public.inventory_transfer_lines from anon, authenticated;
grant select, insert, update, delete on table public.inventory_locations to authenticated;
grant select, insert, update, delete on table public.inventory_transfers to authenticated;
grant select, insert, update, delete on table public.inventory_transfer_lines to authenticated;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'inventory_locations',
    'inventory_transfers',
    'inventory_transfer_lines'
  ] loop
    execute format('drop policy if exists %I on public.%I', table_name || '_select_org', table_name);
    execute format(
      'create policy %I on public.%I for select to authenticated using (
        organization_id in (select organization_id from public.org_members where user_id = (select auth.uid()))
      )', table_name || '_select_org', table_name
    );
    execute format('drop policy if exists %I on public.%I', table_name || '_insert_stock_roles', table_name);
    execute format(
      'create policy %I on public.%I for insert to authenticated with check (
        public.org_member_can_write_module(organization_id, ''stock'')
        and public.org_member_role_in(organization_id, array[''owner'',''manager'',''data_entry''])
      )', table_name || '_insert_stock_roles', table_name
    );
    execute format('drop policy if exists %I on public.%I', table_name || '_update_stock_roles', table_name);
    execute format(
      'create policy %I on public.%I for update to authenticated using (
        public.org_member_can_write_module(organization_id, ''stock'')
        and public.org_member_role_in(organization_id, array[''owner'',''manager'',''data_entry''])
      ) with check (
        public.org_member_can_write_module(organization_id, ''stock'')
        and public.org_member_role_in(organization_id, array[''owner'',''manager'',''data_entry''])
      )', table_name || '_update_stock_roles', table_name
    );
    execute format('drop policy if exists %I on public.%I', table_name || '_delete_stock_roles', table_name);
    execute format(
      'create policy %I on public.%I for delete to authenticated using (
        public.org_member_can_write_module(organization_id, ''stock'')
        and public.org_member_role_in(organization_id, array[''owner'',''manager''])
      )', table_name || '_delete_stock_roles', table_name
    );
  end loop;
end $$;

drop trigger if exists inventory_locations_updated_at on public.inventory_locations;
create trigger inventory_locations_updated_at before update on public.inventory_locations
  for each row execute function public.set_updated_at();
drop trigger if exists inventory_transfers_updated_at on public.inventory_transfers;
create trigger inventory_transfers_updated_at before update on public.inventory_transfers
  for each row execute function public.set_updated_at();

comment on table public.inventory_locations is
  'Organization-scoped physical custody locations. Exactly one default location is allowed per organization.';
comment on table public.inventory_transfers is
  'Controlled general-stock movement lifecycle between physical locations; draft, dispatch/in-transit, receive and cancellation are explicit.';
comment on table public.inventory_transfer_lines is
  'Product and optional exact variant/lot/serialized identities moved by an inventory transfer.';
