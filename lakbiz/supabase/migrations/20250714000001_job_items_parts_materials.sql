-- LakBiz job-parts-materials phase: widen job_items for real parts/
-- materials tracking (source types, replacement/warranty, invoiceable
-- lines) — see docs/JOB_PARTS_ARCHITECTURE.md for the full design.
--
-- Purely additive: every new column is nullable or has a safe default,
-- so every existing row stays valid and every existing job continues to
-- invoice exactly as it does today. This migration does NOT touch the
-- historical files that created job_items/its masking (20250621000005,
-- 20250705000001, 20250706000001, 20250712000001/2/3) — it widens the
-- table and rebuilds the view + trigger functions with `create or
-- replace`, preserving every existing role/financial-masking check
-- verbatim (re-read directly from the live-current versions of those
-- functions before writing this file, not from memory).

-- ─── widen CHECK constraints (additive: a wider CHECK cannot reject any
--     row that already satisfied the narrower one) ─────────────────────
--
-- Looked up dynamically by column rather than a guessed constraint name
-- (Postgres auto-names an inline CHECK after the table name *at the time
-- it was added* — item_type's constraint dates from when this table was
-- still named `job_items`, before 20250706000001 renamed it to
-- `job_items_base` — a hardcoded name here would be a guess this
-- migration doesn't need to make).

do $$
declare
  r record;
begin
  for r in
    select tc.constraint_name
    from information_schema.table_constraints tc
    join information_schema.constraint_column_usage ccu
      on tc.constraint_name = ccu.constraint_name and tc.constraint_schema = ccu.constraint_schema
    where tc.table_schema = 'public'
      and tc.table_name = 'job_items_base'
      and tc.constraint_type = 'CHECK'
      and ccu.column_name in ('item_type', 'source')
  loop
    execute format('alter table public.job_items_base drop constraint %I', r.constraint_name);
  end loop;
end $$;

alter table public.job_items_base add constraint job_items_item_type_check
  check (item_type in ('part', 'labour', 'service', 'transport', 'other'));
alter table public.job_items_base add constraint job_items_source_check
  check (source in ('stock', 'purchased', 'manual', 'customer_supplied'));

-- ─── new columns ───────────────────────────────────────────────────────

alter table public.job_items_base add column if not exists unit text;
alter table public.job_items_base add column if not exists discount numeric(14, 2);
alter table public.job_items_base add column if not exists invoiceable boolean not null default true;
alter table public.job_items_base add column if not exists purchased_for_job boolean not null default false;
alter table public.job_items_base add column if not exists is_replacement boolean not null default false;
alter table public.job_items_base add column if not exists old_component_name text;
alter table public.job_items_base add column if not exists old_component_serial text;
alter table public.job_items_base add column if not exists old_component_disposition text
  check (old_component_disposition in (
    'returned_to_customer', 'retained_by_company', 'sent_for_warranty',
    'disposed', 'repairable_core_return', 'unknown'
  ));
alter table public.job_items_base add column if not exists new_component_serial text;
alter table public.job_items_base add column if not exists warranty_type text
  check (warranty_type in ('none', 'company', 'supplier', 'manufacturer'));
alter table public.job_items_base add column if not exists warranty_days integer;
alter table public.job_items_base add column if not exists warranty_start_date date;
alter table public.job_items_base add column if not exists warranty_expiry_date date;
alter table public.job_items_base add column if not exists notes text;

create index if not exists job_items_warranty_expiry_idx
  on public.job_items_base(warranty_expiry_date)
  where warranty_expiry_date is not null;

comment on column public.job_items_base.purchased_for_job is 'True when a source=stock line''s stock was received specifically for this job via the External-Purchase-to-Inventory path, even though source is correctly stock once received — distinguishes "bought for you" from "was already in the warehouse" for the Purchased-for-Job filter.';
comment on column public.job_items_base.invoiceable is 'Whether this line may appear on the customer-facing itemized invoice. Financial fields (unit_price/line_total/customer_price/discount) stay masked from non-financial roles regardless of this flag — this only controls invoice inclusion, not visibility.';
comment on column public.job_items_base.warranty_expiry_date is 'Computed client-side (warranty_start_date + warranty_days) and stored, same pattern as ac_jobs.service_due_date, for cheap sorting/querying by the Active Warranties view.';

-- ─── rebuild the masked view with the new columns ─────────────────────
-- Financial masking rule for the new `discount` column matches
-- `customer_price`'s existing treatment exactly (it's a money amount a
-- non-financial role shouldn't see). Every other new column is
-- operational data a technician legitimately needs (component name/
-- serial/disposition, warranty dates, unit, notes, invoiceable,
-- purchased_for_job) — left unmasked, matching how name/qty/source
-- already behave in this same view.

create or replace view public.job_items with (security_barrier = true) as
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
  i.technician_id,
  i.unit,
  case when public.can_see_org_financials(i.organization_id) then i.discount else null::numeric end as discount,
  i.invoiceable,
  i.purchased_for_job,
  i.is_replacement,
  i.old_component_name,
  i.old_component_serial,
  i.old_component_disposition,
  i.new_component_serial,
  i.warranty_type,
  i.warranty_days,
  i.warranty_start_date,
  i.warranty_expiry_date,
  i.notes
from public.job_items_base i
where i.organization_id in (select organization_id from public.org_members where user_id = auth.uid());

alter view public.job_items set (security_invoker = false);

-- grant/revoke on the view and job_items_base were already set correctly
-- by 20250706000001 (grant) and 20250712000001 (base-table select
-- revoke) — unaffected by widening the view's column list, not repeated
-- here.

-- ─── rebuild the three INSTEAD OF trigger functions ────────────────────
-- Role/module write gate is copied verbatim from the current-live
-- versions (20250712000001's UPDATE/DELETE, 20250712000002's INSERT —
-- the actual latest version of each, confirmed by reading the migration
-- files directly, not assumed). Only the column list changes.

create or replace function public.job_items_view_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_unit_price numeric(14,2);
  v_line_total numeric(14,2);
begin
  if not (public.org_member_can_write_module(new.organization_id, 'ac_jobs')
      and public.org_member_role_in(new.organization_id, array['owner','manager','data_entry','technician'])) then
    raise exception 'permission denied for table job_items_base' using errcode = '42501';
  end if;

  -- Unchanged from 20250712000002: for source='stock' the server always
  -- derives unit_price from products_base.buy_price, never trusting the
  -- client — the actual historical-cost guarantee. Untouched by this
  -- migration's new columns.
  if new.source = 'stock' and new.product_id is not null then
    select p.buy_price into v_unit_price
    from public.products_base p
    where p.id = new.product_id and p.organization_id = new.organization_id;
    v_unit_price := coalesce(v_unit_price, 0);
  elsif public.can_see_org_financials(new.organization_id) then
    v_unit_price := coalesce(new.unit_price, 0);
  else
    v_unit_price := 0;
  end if;

  v_line_total := round(coalesce(new.qty, 0) * v_unit_price, 2);

  insert into public.job_items_base (
    id, organization_id, job_id, item_type, name, qty, unit_price, line_total,
    created_at, updated_at, source, product_id, supplier_id, purchase_ref, purchase_date,
    customer_price, technician_id,
    unit, discount, invoiceable, purchased_for_job,
    is_replacement, old_component_name, old_component_serial, old_component_disposition,
    new_component_serial, warranty_type, warranty_days, warranty_start_date, warranty_expiry_date,
    notes
  ) values (
    new.id, new.organization_id, new.job_id, new.item_type, new.name, new.qty,
    v_unit_price, v_line_total,
    coalesce(new.created_at, now()), coalesce(new.updated_at, now()), new.source, new.product_id, new.supplier_id,
    new.purchase_ref, new.purchase_date,
    case when public.can_see_org_financials(new.organization_id) then new.customer_price else null end,
    new.technician_id,
    new.unit,
    case when public.can_see_org_financials(new.organization_id) then new.discount else null end,
    coalesce(new.invoiceable, true),
    coalesce(new.purchased_for_job, false),
    coalesce(new.is_replacement, false), new.old_component_name, new.old_component_serial, new.old_component_disposition,
    new.new_component_serial, new.warranty_type, new.warranty_days, new.warranty_start_date, new.warranty_expiry_date,
    new.notes
  );
  return new;
end;
$$;

create or replace function public.job_items_view_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not (public.org_member_can_write_module(new.organization_id, 'ac_jobs')
      and public.org_member_role_in(new.organization_id, array['owner','manager','data_entry','technician'])) then
    raise exception 'permission denied for table job_items_base' using errcode = '42501';
  end if;
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
    technician_id = new.technician_id,
    unit = new.unit,
    discount = case when public.can_see_org_financials(new.organization_id) then new.discount else job_items_base.discount end,
    invoiceable = coalesce(new.invoiceable, job_items_base.invoiceable),
    purchased_for_job = coalesce(new.purchased_for_job, job_items_base.purchased_for_job),
    is_replacement = coalesce(new.is_replacement, job_items_base.is_replacement),
    old_component_name = new.old_component_name,
    old_component_serial = new.old_component_serial,
    old_component_disposition = new.old_component_disposition,
    new_component_serial = new.new_component_serial,
    warranty_type = new.warranty_type,
    warranty_days = new.warranty_days,
    warranty_start_date = new.warranty_start_date,
    warranty_expiry_date = new.warranty_expiry_date,
    notes = new.notes
  where id = old.id and organization_id = old.organization_id;
  return new;
end;
$$;

create or replace function public.job_items_view_delete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not (public.org_member_can_write_module(old.organization_id, 'ac_jobs')
      and public.org_member_role_in(old.organization_id, array['owner','manager','data_entry','technician'])) then
    raise exception 'permission denied for table job_items_base' using errcode = '42501';
  end if;
  delete from public.job_items_base
  where id = old.id and organization_id = old.organization_id;
  return old;
end;
$$;

-- Triggers already point at these functions by name (created by
-- 20250706000001) — `create or replace function` above is sufficient,
-- no need to drop/recreate the `instead of` triggers themselves.
