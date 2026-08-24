-- LakBiz Textile Phase 2: physical fabric-roll identity, balances and audit.

create table if not exists public.textile_rolls (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  product_id text not null references public.products_base(id) on delete restrict,
  supplier_id text references public.suppliers(id) on delete set null,
  roll_no text not null,
  barcode text,
  supplier_lot text,
  dye_lot text,
  shade text,
  width numeric(10, 3),
  width_unit text not null default 'inch' check (width_unit in ('inch', 'centimetre')),
  length_unit text not null check (length_unit in ('metre', 'yard')),
  received_length numeric(14, 3) not null check (received_length > 0),
  remaining_length numeric(14, 3) not null check (remaining_length >= 0),
  reserved_length numeric(14, 3) not null default 0 check (reserved_length >= 0),
  damaged_length numeric(14, 3) not null default 0 check (damaged_length >= 0),
  weight_kg numeric(14, 3) check (weight_kg is null or weight_kg >= 0),
  grade text,
  rack_location text,
  source_reference text,
  status text not null default 'unopened'
    check (status in ('unopened','opened','reserved','exhausted','quarantined','returned')),
  received_at date not null default current_date,
  notes text,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (reserved_length <= remaining_length),
  check (remaining_length + damaged_length <= received_length),
  check (damaged_length <= received_length)
);

create unique index if not exists textile_rolls_org_roll_no_uq
  on public.textile_rolls(organization_id, lower(roll_no));
create unique index if not exists textile_rolls_org_barcode_uq
  on public.textile_rolls(organization_id, lower(barcode))
  where barcode is not null and barcode <> '';
create index if not exists textile_rolls_product_status_idx
  on public.textile_rolls(organization_id, product_id, status);
create index if not exists textile_rolls_dye_lot_idx
  on public.textile_rolls(organization_id, product_id, dye_lot, shade);
create index if not exists textile_rolls_location_idx
  on public.textile_rolls(organization_id, rack_location);

create table if not exists public.textile_roll_costs (
  roll_id uuid primary key references public.textile_rolls(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  unit_cost numeric(14, 4) not null check (unit_cost >= 0),
  landed_unit_cost numeric(14, 4) check (landed_unit_cost is null or landed_unit_cost >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists textile_roll_costs_org_idx
  on public.textile_roll_costs(organization_id);

create table if not exists public.textile_roll_movements (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  roll_id uuid not null references public.textile_rolls(id) on delete restrict,
  movement_type text not null check (movement_type in (
    'receipt','measurement_adjustment','damage','reservation','reservation_release',
    'cut','sale','return','transfer','status_change'
  )),
  quantity_delta numeric(14, 3) not null,
  balance_after numeric(14, 3) not null check (balance_after >= 0),
  reason text,
  reference_type text,
  reference_id text,
  actor_user_id uuid default auth.uid(),
  created_at timestamptz not null default now()
);
create index if not exists textile_roll_movements_roll_time_idx
  on public.textile_roll_movements(organization_id, roll_id, created_at desc);

alter table public.textile_rolls enable row level security;
alter table public.textile_roll_costs enable row level security;
alter table public.textile_roll_movements enable row level security;

drop policy if exists textile_rolls_select_org on public.textile_rolls;
create policy textile_rolls_select_org on public.textile_rolls
  for select to authenticated using (
    organization_id in (select organization_id from public.org_members where user_id = auth.uid())
  );
drop policy if exists textile_rolls_insert_stock_roles on public.textile_rolls;
create policy textile_rolls_insert_stock_roles on public.textile_rolls
  for insert to authenticated with check (
    public.org_member_can_write_module(organization_id, 'stock')
    and public.org_member_role_in(organization_id, array['owner','manager','data_entry'])
  );
-- Deliberately no direct UPDATE/DELETE policy. Balance, reservation and status
-- changes must go through audited domain functions, never a generic row edit.

drop policy if exists textile_roll_movements_select_org on public.textile_roll_movements;
create policy textile_roll_movements_select_org on public.textile_roll_movements
  for select to authenticated using (
    organization_id in (select organization_id from public.org_members where user_id = auth.uid())
  );
-- Deliberately no client INSERT/UPDATE/DELETE policy. Only trusted roll-domain
-- triggers/functions append movements, keeping the audit ledger credible.

drop policy if exists textile_roll_costs_select_owner on public.textile_roll_costs;
create policy textile_roll_costs_select_owner on public.textile_roll_costs
  for select to authenticated using (public.can_see_org_financials(organization_id));
drop policy if exists textile_roll_costs_insert_owner on public.textile_roll_costs;
create policy textile_roll_costs_insert_owner on public.textile_roll_costs
  for insert to authenticated with check (public.can_see_org_financials(organization_id));
drop policy if exists textile_roll_costs_update_owner on public.textile_roll_costs;
create policy textile_roll_costs_update_owner on public.textile_roll_costs
  for update to authenticated using (public.can_see_org_financials(organization_id))
  with check (public.can_see_org_financials(organization_id));

create or replace function public.textile_roll_validate_scope()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not exists (
    select 1 from public.products_base p
    where p.id = new.product_id and p.organization_id = new.organization_id
      and p.sector_id = 'textile'
  ) then
    raise exception 'Textile roll product must belong to the same Textile organization';
  end if;
  if new.supplier_id is not null and not exists (
    select 1 from public.suppliers s
    where s.id = new.supplier_id and s.organization_id = new.organization_id
  ) then
    raise exception 'Supplier must belong to the same organization';
  end if;
  return new;
end;
$$;
revoke all on function public.textile_roll_validate_scope() from public;

drop trigger if exists textile_roll_validate_scope_trigger on public.textile_rolls;
create trigger textile_roll_validate_scope_trigger
  before insert or update on public.textile_rolls
  for each row execute function public.textile_roll_validate_scope();

create or replace function public.textile_roll_cost_validate_scope()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not exists (
    select 1 from public.textile_rolls r
    where r.id = new.roll_id and r.organization_id = new.organization_id
  ) then
    raise exception 'Roll cost must belong to the same organization as the roll';
  end if;
  return new;
end;
$$;
revoke all on function public.textile_roll_cost_validate_scope() from public;
drop trigger if exists textile_roll_cost_validate_scope_trigger on public.textile_roll_costs;
create trigger textile_roll_cost_validate_scope_trigger
  before insert or update on public.textile_roll_costs
  for each row execute function public.textile_roll_cost_validate_scope();

create or replace function public.textile_roll_receipt_movement()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.textile_roll_movements (
    organization_id, roll_id, movement_type, quantity_delta, balance_after,
    reason, reference_type, reference_id, actor_user_id
  ) values (
    new.organization_id, new.id, 'receipt', new.remaining_length,
    new.remaining_length,
    case when new.damaged_length > 0
      then 'Physical roll received; damaged measure excluded from usable balance'
      else 'Physical roll received' end,
    case when new.source_reference is null then null else 'source_reference' end,
    new.source_reference, new.created_by
  );
  return new;
end;
$$;
revoke all on function public.textile_roll_receipt_movement() from public;

drop trigger if exists textile_roll_receipt_movement_trigger on public.textile_rolls;
create trigger textile_roll_receipt_movement_trigger
  after insert on public.textile_rolls
  for each row execute function public.textile_roll_receipt_movement();

create or replace function public.adjust_textile_roll_measurement(
  p_roll_id uuid,
  p_new_remaining numeric,
  p_reason text
) returns public.textile_rolls
language plpgsql security definer set search_path = public as $$
declare
  v_roll public.textile_rolls;
  v_old numeric;
begin
  if p_new_remaining < 0 then raise exception 'Remaining length cannot be negative'; end if;
  if nullif(trim(p_reason), '') is null then raise exception 'Adjustment reason is required'; end if;

  select * into v_roll from public.textile_rolls where id = p_roll_id for update;
  if not found then raise exception 'Roll not found or inaccessible'; end if;
  if not exists (
    select 1 from public.org_members m
    where m.organization_id = v_roll.organization_id and m.user_id = auth.uid()
  ) then
    raise exception 'Roll not found or inaccessible';
  end if;
  if not public.org_member_can_write_module(v_roll.organization_id, 'stock') then
    raise exception 'Stock access denied';
  end if;
  if not public.org_member_role_in(v_roll.organization_id, array['owner','manager']) then
    raise exception 'Only an owner or manager can adjust measured roll stock';
  end if;
  if p_new_remaining + v_roll.damaged_length > v_roll.received_length then
    raise exception 'Usable remaining length plus damaged length cannot exceed received length';
  end if;
  if p_new_remaining < v_roll.reserved_length then
    raise exception 'Remaining length cannot be below reserved length';
  end if;

  v_old := v_roll.remaining_length;
  update public.textile_rolls set
    remaining_length = round(p_new_remaining, 3),
    status = case
      when p_new_remaining = 0 then 'exhausted'
      when status = 'exhausted' then 'opened'
      else status
    end,
    updated_at = now()
  where id = p_roll_id returning * into v_roll;

  insert into public.textile_roll_movements (
    organization_id, roll_id, movement_type, quantity_delta, balance_after, reason
  ) values (
    v_roll.organization_id, v_roll.id, 'measurement_adjustment',
    round(p_new_remaining - v_old, 3), v_roll.remaining_length, trim(p_reason)
  );
  return v_roll;
end;
$$;
revoke all on function public.adjust_textile_roll_measurement(uuid, numeric, text) from public;
grant execute on function public.adjust_textile_roll_measurement(uuid, numeric, text) to authenticated;

comment on table public.textile_rolls is
  'Physical fabric roll identity and current measured balance. Sales/cuts must use movements rather than silently editing length.';
comment on table public.textile_roll_costs is
  'Owner-only roll cost relation, physically separated from operational roll data.';
comment on table public.textile_roll_movements is
  'Append-only audit history for each physical roll receipt, correction, reservation, cut, sale, return and transfer.';
