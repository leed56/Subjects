-- LakBiz HVAC platform Phase 6: job labor costing.
--
-- Adds Technician.hourlyRate (the "smallest explicit configuration
-- necessary" per the spec — no technician gets a fabricated cost, this
-- column is nullable and only used when an owner actually sets it) and
-- JobItem.technicianId (labour lines already give a job as many labor
-- entries as it needs, so multiple technicians per job needed no new
-- join table — just a per-line technician reference).
--
-- Both additions are financial data reachable by a role the app's own
-- documented permission matrix says should NOT see financial fields on
-- /workforce (technicians have route access there — see
-- src/lib/org-role/permissions.ts's TECHNICIAN_ROUTES). Column-level RLS
-- doesn't exist in Postgres, so — following the exact
-- security-barrier-view + INSTEAD OF trigger pattern already established
-- for `products` in 20250623000001_financial_data_rls.sql — both
-- `technicians` and `job_items` get masked views here. Skipping this and
-- relying on client-side hiding alone would leave hourly_rate/unit_price/
-- line_total/customer_price readable by any authenticated org member via
-- a direct REST call, which is exactly the "expose company profit to
-- unauthorized technicians" the spec's absolute rules forbid.
--
-- Known pre-existing gap, NOT fixed here (disclosed, not silently left):
-- `contractors.rate_amount`/`payable_balance` have the same unmasked
-- problem and predate this phase entirely — same root cause, different
-- table, out of scope for this migration since this phase didn't touch
-- contractors. Flagged in the progress doc for a dedicated follow-up.

alter table public.technicians add column if not exists hourly_rate numeric(14, 2);
alter table public.job_items add column if not exists technician_id text
  references public.technicians(id) on delete set null;

create index if not exists job_items_technician_idx on public.job_items(technician_id);

-- ─── technicians: rename + masked view ────────────────────────────────────
alter table public.technicians rename to technicians_base;

create view public.technicians with (security_barrier = true) as
select
  t.id,
  t.organization_id,
  t.name,
  t.phone,
  t.specialties,
  t.active,
  t.notes,
  case when public.can_see_org_financials(t.organization_id) then t.hourly_rate else null::numeric(14, 2) end as hourly_rate,
  t.created_at,
  t.updated_at
from public.technicians_base t;

grant select, insert, update, delete on public.technicians to authenticated;

create or replace function public.technicians_view_insert()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  insert into public.technicians_base (
    id, organization_id, name, phone, specialties, active, notes, hourly_rate, created_at, updated_at
  ) values (
    new.id, new.organization_id, new.name, new.phone, new.specialties, new.active, new.notes, new.hourly_rate,
    coalesce(new.created_at, now()), coalesce(new.updated_at, now())
  );
  return new;
end;
$$;

create or replace function public.technicians_view_update()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  update public.technicians_base set
    name = new.name,
    phone = new.phone,
    specialties = new.specialties,
    active = new.active,
    notes = new.notes,
    -- A non-financial caller's UPDATE carries whatever the masked SELECT
    -- gave it (null) — preserve the existing rate rather than nulling it
    -- out from underneath an owner, same guard as products' buy_price.
    hourly_rate = case when public.can_see_org_financials(new.organization_id) then new.hourly_rate else technicians_base.hourly_rate end,
    updated_at = coalesce(new.updated_at, now())
  where id = old.id and organization_id = old.organization_id;
  return new;
end;
$$;

create or replace function public.technicians_view_delete()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  delete from public.technicians_base
  where id = old.id and organization_id = old.organization_id;
  return old;
end;
$$;

drop trigger if exists technicians_view_insert_trg on public.technicians;
create trigger technicians_view_insert_trg
  instead of insert on public.technicians
  for each row execute function public.technicians_view_insert();

drop trigger if exists technicians_view_update_trg on public.technicians;
create trigger technicians_view_update_trg
  instead of update on public.technicians
  for each row execute function public.technicians_view_update();

drop trigger if exists technicians_view_delete_trg on public.technicians;
create trigger technicians_view_delete_trg
  instead of delete on public.technicians
  for each row execute function public.technicians_view_delete();

-- ─── job_items: rename + masked view ──────────────────────────────────────
alter table public.job_items rename to job_items_base;

create view public.job_items with (security_barrier = true) as
select
  i.id,
  i.organization_id,
  i.job_id,
  i.item_type,
  i.name,
  i.qty,
  case when public.can_see_org_financials(i.organization_id) then i.unit_price else 0::numeric end as unit_price,
  case when public.can_see_org_financials(i.organization_id) then i.line_total else 0::numeric end as line_total,
  i.created_at,
  i.updated_at,
  i.source,
  i.product_id,
  i.supplier_id,
  i.purchase_ref,
  i.purchase_date,
  case when public.can_see_org_financials(i.organization_id) then i.customer_price else null::numeric end as customer_price,
  i.technician_id
from public.job_items_base i;

grant select, insert, update, delete on public.job_items to authenticated;

create or replace function public.job_items_view_insert()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  insert into public.job_items_base (
    id, organization_id, job_id, item_type, name, qty, unit_price, line_total,
    created_at, updated_at, source, product_id, supplier_id, purchase_ref, purchase_date,
    customer_price, technician_id
  ) values (
    new.id, new.organization_id, new.job_id, new.item_type, new.name, new.qty, new.unit_price, new.line_total,
    coalesce(new.created_at, now()), coalesce(new.updated_at, now()), new.source, new.product_id, new.supplier_id,
    new.purchase_ref, new.purchase_date, new.customer_price, new.technician_id
  );
  return new;
end;
$$;

create or replace function public.job_items_view_update()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  update public.job_items_base set
    job_id = new.job_id,
    item_type = new.item_type,
    name = new.name,
    qty = new.qty,
    unit_price = case when public.can_see_org_financials(new.organization_id) then new.unit_price else job_items_base.unit_price end,
    line_total = case when public.can_see_org_financials(new.organization_id) then new.line_total else job_items_base.line_total end,
    updated_at = coalesce(new.updated_at, now()),
    source = new.source,
    product_id = new.product_id,
    supplier_id = new.supplier_id,
    purchase_ref = new.purchase_ref,
    purchase_date = new.purchase_date,
    customer_price = case when public.can_see_org_financials(new.organization_id) then new.customer_price else job_items_base.customer_price end,
    technician_id = new.technician_id
  where id = old.id and organization_id = old.organization_id;
  return new;
end;
$$;

create or replace function public.job_items_view_delete()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  delete from public.job_items_base
  where id = old.id and organization_id = old.organization_id;
  return old;
end;
$$;

drop trigger if exists job_items_view_insert_trg on public.job_items;
create trigger job_items_view_insert_trg
  instead of insert on public.job_items
  for each row execute function public.job_items_view_insert();

drop trigger if exists job_items_view_update_trg on public.job_items;
create trigger job_items_view_update_trg
  instead of update on public.job_items
  for each row execute function public.job_items_view_update();

drop trigger if exists job_items_view_delete_trg on public.job_items;
create trigger job_items_view_delete_trg
  instead of delete on public.job_items
  for each row execute function public.job_items_view_delete();

comment on column public.technicians_base.hourly_rate is 'Internal labor cost basis (LKR/hour). Nullable — no fabricated cost for technicians with no configured rate. Masked from non-financial roles via the public.technicians view.';
comment on column public.job_items_base.technician_id is 'itemType=labour only — which roster technician performed this line. Multiple technicians per job = multiple labour lines, not a schema change to ac_jobs.';
