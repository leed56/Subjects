-- LakBiz: owner-only financial privacy + deeper business-template catalogue.
--
-- Goals:
-- 1. Internal finance is visible only to the organization OWNER. "Manager"
--    remains an operational role, not a second owner account.
-- 2. AC job quote/deposit/subcontract values are masked at the DB boundary,
--    not merely hidden in React.
-- 3. Non-owner operational edits preserve existing owner-entered job money.
-- 4. Financial ledgers/purchasing/banking writes are owner-only.
-- 5. Provisioning gains Pharmacy, Mobile Phones & Repair Parts, and Footwear
--    templates while keeping sector_modules as the authoritative module gate.
--
-- This migration is intentionally additive/replace-in-place: no route/table is
-- renamed or deleted and existing sector ids remain unchanged.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. One authoritative financial capability: OWNER only.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.can_see_org_financials(org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.org_members m
    where m.organization_id = org_id
      and m.user_id = auth.uid()
      and m.role::text = 'owner'
  );
$$;

revoke all on function public.can_see_org_financials(uuid) from public, anon;
grant execute on function public.can_see_org_financials(uuid) to authenticated;

comment on function public.can_see_org_financials(uuid) is
  'Owner-only internal-financial capability. Manager is operational, not a second owner. Used by masked views and financial RLS.';

-- Existing masked views for products.buy_price, sales.profit,
-- sale_lines.buy_price, technicians.hourly_rate, job_items cost/customer
-- price, contractors rate/payable, and vehicle internal costs all call the
-- function above, so replacing it immediately makes those columns owner-only.

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. AC jobs: quote/deposit/subcontract are owner-only at the database layer.
--    complaint/diagnosis + asset_id + crew_id are retained from the current
--    latest view definition (20250708000001).
-- ─────────────────────────────────────────────────────────────────────────────
create or replace view public.ac_jobs as
select
  id,
  organization_id,
  job_no,
  job_date,
  customer_id,
  customer_name,
  phone,
  address,
  brand,
  btu,
  unit_type,
  unit_count,
  description,
  case when public.can_see_org_financials(organization_id) then quoted_amount else 0::numeric end as quoted_amount,
  case when public.can_see_org_financials(organization_id) then deposit_amount else 0::numeric end as deposit_amount,
  pipe_meters,
  status,
  scheduled_date,
  installed_date,
  notes,
  created_at,
  updated_at,
  service_due_date,
  last_service_date,
  service_interval_months,
  amc_contract,
  job_type,
  assigned_technician,
  service_due_manual,
  service_interval_days,
  assignee_type,
  assignee_id,
  case when public.can_see_org_financials(organization_id) then subcontract_cost else null::numeric end as subcontract_cost,
  asset_id,
  crew_id,
  complaint,
  diagnosis
from public.ac_jobs_base j
where organization_id in (
  select organization_id from public.org_members where user_id = auth.uid()
);

alter view public.ac_jobs set (security_invoker = false);
grant select, insert, update, delete on public.ac_jobs to authenticated;

-- Non-owner job creation is allowed for operational roles, but commercial
-- fields are forced to masked values. The owner can later price/collect it.
create or replace function public.ac_jobs_view_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.org_member_can_write_module(new.organization_id, 'ac_jobs')
     or not public.org_member_role_in(new.organization_id, array['owner','manager','data_entry']) then
    raise exception 'permission denied for table ac_jobs_base' using errcode = '42501';
  end if;

  insert into public.ac_jobs_base (
    id, organization_id, job_no, job_date, customer_id, customer_name, phone, address,
    brand, btu, unit_type, unit_count, description, quoted_amount, deposit_amount,
    pipe_meters, status, scheduled_date, installed_date, notes, service_due_date,
    last_service_date, service_interval_months, amc_contract, job_type, assigned_technician,
    service_due_manual, service_interval_days, assignee_type, assignee_id, subcontract_cost,
    asset_id, crew_id, complaint, diagnosis
  ) values (
    new.id, new.organization_id, new.job_no, new.job_date, new.customer_id, new.customer_name,
    new.phone, new.address, new.brand, new.btu, new.unit_type, new.unit_count, new.description,
    case when public.can_see_org_financials(new.organization_id) then coalesce(new.quoted_amount, 0) else 0 end,
    case when public.can_see_org_financials(new.organization_id) then coalesce(new.deposit_amount, 0) else 0 end,
    new.pipe_meters, new.status, new.scheduled_date, new.installed_date, new.notes,
    new.service_due_date, new.last_service_date, new.service_interval_months,
    new.amc_contract, new.job_type, new.assigned_technician, new.service_due_manual,
    new.service_interval_days, new.assignee_type, new.assignee_id,
    case when public.can_see_org_financials(new.organization_id) then new.subcontract_cost else null end,
    new.asset_id, new.crew_id, new.complaint, new.diagnosis
  );
  return new;
end;
$$;

-- A manager/data-entry update arrives through the masked view with zero/null
-- financial placeholders. Preserve the real base-table values rather than
-- letting an operational edit destroy the owner's commercial data.
create or replace function public.ac_jobs_view_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.org_member_can_write_module(new.organization_id, 'ac_jobs')
     or not public.org_member_role_in(new.organization_id, array['owner','manager','data_entry']) then
    raise exception 'permission denied for table ac_jobs_base' using errcode = '42501';
  end if;

  update public.ac_jobs_base b set
    job_no = new.job_no,
    job_date = new.job_date,
    customer_id = new.customer_id,
    customer_name = new.customer_name,
    phone = new.phone,
    address = new.address,
    brand = new.brand,
    btu = new.btu,
    unit_type = new.unit_type,
    unit_count = new.unit_count,
    description = new.description,
    quoted_amount = case when public.can_see_org_financials(new.organization_id) then new.quoted_amount else b.quoted_amount end,
    deposit_amount = case when public.can_see_org_financials(new.organization_id) then new.deposit_amount else b.deposit_amount end,
    pipe_meters = new.pipe_meters,
    status = new.status,
    scheduled_date = new.scheduled_date,
    installed_date = new.installed_date,
    notes = new.notes,
    service_due_date = new.service_due_date,
    last_service_date = new.last_service_date,
    service_interval_months = new.service_interval_months,
    amc_contract = new.amc_contract,
    job_type = new.job_type,
    assigned_technician = new.assigned_technician,
    service_due_manual = new.service_due_manual,
    service_interval_days = new.service_interval_days,
    assignee_type = new.assignee_type,
    assignee_id = new.assignee_id,
    subcontract_cost = case when public.can_see_org_financials(new.organization_id) then new.subcontract_cost else b.subcontract_cost end,
    asset_id = new.asset_id,
    crew_id = new.crew_id,
    complaint = new.complaint,
    diagnosis = new.diagnosis,
    updated_at = coalesce(new.updated_at, now())
  where b.id = old.id and b.organization_id = old.organization_id;
  return new;
end;
$$;

-- Delete is an administrative operation: owner/manager only. Data-entry may
-- create/edit operational records but cannot destroy job history.
create or replace function public.ac_jobs_view_delete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.org_member_can_write_module(old.organization_id, 'ac_jobs')
     or not public.org_member_role_in(old.organization_id, array['owner','manager']) then
    raise exception 'permission denied for table ac_jobs_base' using errcode = '42501';
  end if;
  delete from public.ac_jobs_base
  where id = old.id and organization_id = old.organization_id;
  return old;
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Owner-only financial ledgers and purchase/banking writes.
--    Drop every historical broad policy name first because Postgres policies
--    are permissive (OR): leaving one old member policy would defeat the new
--    owner policy.
-- ─────────────────────────────────────────────────────────────────────────────

-- Expenses are pure internal finance; the original migration allowed any org
-- member at RLS and relied on route hiding. Close that gap here.
drop policy if exists expenses_select_member on public.expenses;
drop policy if exists expenses_select_financial on public.expenses;
drop policy if exists expenses_select_owner on public.expenses;
create policy expenses_select_owner on public.expenses for select to authenticated using (
  public.org_member_role_in(organization_id, array['owner'])
);

drop policy if exists expenses_insert_member on public.expenses;
drop policy if exists expenses_insert_owner on public.expenses;
create policy expenses_insert_owner on public.expenses for insert to authenticated with check (
  public.org_member_role_in(organization_id, array['owner'])
);

drop policy if exists expenses_update_member on public.expenses;
drop policy if exists expenses_update_owner on public.expenses;
create policy expenses_update_owner on public.expenses for update to authenticated
using (public.org_member_role_in(organization_id, array['owner']))
with check (public.org_member_role_in(organization_id, array['owner']));

drop policy if exists expenses_delete_member on public.expenses;
drop policy if exists expenses_delete_owner on public.expenses;
create policy expenses_delete_owner on public.expenses for delete to authenticated using (
  public.org_member_role_in(organization_id, array['owner'])
);

-- Supplier/procurement ledgers. SELECT policies already call
-- can_see_org_financials(), now owner-only; writes are tightened explicitly.
do $$
declare
  t text;
begin
  foreach t in array array[
    'suppliers',
    'purchases',
    'purchase_lines',
    'supplier_payments',
    'purchase_orders',
    'purchase_order_lines'
  ] loop
    execute format('drop policy if exists %I on public.%I', t || '_insert_member', t);
    execute format('drop policy if exists %I on public.%I', t || '_insert_owner', t);
    execute format(
      'create policy %I on public.%I for insert to authenticated with check (
        public.org_member_can_write_module(organization_id, ''suppliers'')
        and public.org_member_role_in(organization_id, array[''owner''])
      )', t || '_insert_owner', t
    );

    execute format('drop policy if exists %I on public.%I', t || '_update_member', t);
    execute format('drop policy if exists %I on public.%I', t || '_update_owner', t);
    execute format(
      'create policy %I on public.%I for update to authenticated
       using (
         public.org_member_can_write_module(organization_id, ''suppliers'')
         and public.org_member_role_in(organization_id, array[''owner''])
       )
       with check (
         public.org_member_can_write_module(organization_id, ''suppliers'')
         and public.org_member_role_in(organization_id, array[''owner''])
       )', t || '_update_owner', t
    );

    execute format('drop policy if exists %I on public.%I', t || '_delete_member', t);
    execute format('drop policy if exists %I on public.%I', t || '_delete_owner', t);
    execute format(
      'create policy %I on public.%I for delete to authenticated using (
        public.org_member_can_write_module(organization_id, ''suppliers'')
        and public.org_member_role_in(organization_id, array[''owner''])
      )', t || '_delete_owner', t
    );
  end loop;
end $$;

-- Banking/cheque ledgers.
do $$
declare
  t text;
begin
  foreach t in array array[
    'bank_accounts',
    'bank_transactions',
    'bank_transfers',
    'cheques'
  ] loop
    execute format('drop policy if exists %I on public.%I', t || '_insert_member', t);
    execute format('drop policy if exists %I on public.%I', t || '_insert_owner', t);
    execute format(
      'create policy %I on public.%I for insert to authenticated with check (
        public.org_member_can_write_module(organization_id, ''banking'')
        and public.org_member_role_in(organization_id, array[''owner''])
      )', t || '_insert_owner', t
    );

    execute format('drop policy if exists %I on public.%I', t || '_update_member', t);
    execute format('drop policy if exists %I on public.%I', t || '_update_owner', t);
    execute format(
      'create policy %I on public.%I for update to authenticated
       using (
         public.org_member_can_write_module(organization_id, ''banking'')
         and public.org_member_role_in(organization_id, array[''owner''])
       )
       with check (
         public.org_member_can_write_module(organization_id, ''banking'')
         and public.org_member_role_in(organization_id, array[''owner''])
       )', t || '_update_owner', t
    );

    execute format('drop policy if exists %I on public.%I', t || '_delete_member', t);
    execute format('drop policy if exists %I on public.%I', t || '_delete_owner', t);
    execute format(
      'create policy %I on public.%I for delete to authenticated using (
        public.org_member_can_write_module(organization_id, ''banking'')
        and public.org_member_role_in(organization_id, array[''owner''])
      )', t || '_delete_owner', t
    );
  end loop;
end $$;

-- Contractor payments are an internal payable ledger. Workforce records can
-- remain operationally manager-accessible, but payment money is owner-only.
drop policy if exists contractor_payments_insert_member on public.contractor_payments;
drop policy if exists contractor_payments_insert_owner on public.contractor_payments;
create policy contractor_payments_insert_owner on public.contractor_payments for insert to authenticated with check (
  public.org_member_can_write_module(organization_id, 'ac_jobs')
  and public.org_member_role_in(organization_id, array['owner'])
);

drop policy if exists contractor_payments_update_member on public.contractor_payments;
drop policy if exists contractor_payments_update_owner on public.contractor_payments;
create policy contractor_payments_update_owner on public.contractor_payments for update to authenticated
using (
  public.org_member_can_write_module(organization_id, 'ac_jobs')
  and public.org_member_role_in(organization_id, array['owner'])
)
with check (
  public.org_member_can_write_module(organization_id, 'ac_jobs')
  and public.org_member_role_in(organization_id, array['owner'])
);

drop policy if exists contractor_payments_delete_member on public.contractor_payments;
drop policy if exists contractor_payments_delete_owner on public.contractor_payments;
create policy contractor_payments_delete_owner on public.contractor_payments for delete to authenticated using (
  public.org_member_can_write_module(organization_id, 'ac_jobs')
  and public.org_member_role_in(organization_id, array['owner'])
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. New provisioning templates + sector-module matrix.
-- ─────────────────────────────────────────────────────────────────────────────
insert into public.business_templates (
  id, name_en, name_si, sector_id, default_plan_id, sort_order, is_active
) values
  ('grocery', 'Grocery & Supermarket', 'සිල්ලර සහ සුපිරි වෙළඳසැල්', 'grocery', 'business', 10, true),
  ('pharmacy', 'Pharmacy', 'ඖෂධ අලෙවිසැල', 'pharmacy', 'business', 20, true),
  ('electronics', 'Electronics', 'ඉලෙක්ට්‍රොනික උපකරණ', 'electronics', 'business', 30, true),
  ('mobile_shop', 'Mobile Phones & Repair Parts', 'ජංගම දුරකථන සහ අමතර කොටස්', 'mobile_shop', 'business', 40, true),
  ('electricals', 'Electricals', 'විදුලි උපකරණ', 'electricals', 'business', 50, true),
  ('spare_parts', 'Auto & Machinery Spare Parts', 'වාහන සහ යන්ත්‍ර අමතර කොටස්', 'spare_parts', 'business', 60, true),
  ('footwear', 'Footwear, Slippers & Shoes', 'පාවහන්, සෙරෙප්පු සහ සපත්තු', 'footwear', 'business', 70, true),
  ('ac_hvac', 'Air Conditioning & HVAC', 'වායු සමනය සහ HVAC', 'ac_hvac', 'pro', 80, true),
  ('car_sales', 'Car Sales & Vehicle Dealership', 'මෝටර් රථ වෙළඳාම', 'car_sales', 'pro', 90, true)
on conflict (id) do update set
  name_en = excluded.name_en,
  name_si = excluded.name_si,
  sector_id = excluded.sector_id,
  default_plan_id = excluded.default_plan_id,
  sort_order = excluded.sort_order,
  is_active = excluded.is_active;

-- New retail templates intentionally reuse the mature retail core. Their
-- difference is in fields/categories/workflows, not duplicated routes.
insert into public.sector_modules (sector_id, module_key, allowed) values
  ('pharmacy', 'sales', true),
  ('pharmacy', 'stock', true),
  ('pharmacy', 'bills', true),
  ('pharmacy', 'customers', true),
  ('pharmacy', 'suppliers', true),
  ('pharmacy', 'banking', true),
  ('pharmacy', 'ac_jobs', false),
  ('pharmacy', 'vehicles', false),
  ('pharmacy', 'export', true),
  ('pharmacy', 'offline', false),

  ('mobile_shop', 'sales', true),
  ('mobile_shop', 'stock', true),
  ('mobile_shop', 'bills', true),
  ('mobile_shop', 'customers', true),
  ('mobile_shop', 'suppliers', true),
  ('mobile_shop', 'banking', true),
  ('mobile_shop', 'ac_jobs', false),
  ('mobile_shop', 'vehicles', false),
  ('mobile_shop', 'export', true),
  ('mobile_shop', 'offline', false),

  ('footwear', 'sales', true),
  ('footwear', 'stock', true),
  ('footwear', 'bills', true),
  ('footwear', 'customers', true),
  ('footwear', 'suppliers', true),
  ('footwear', 'banking', true),
  ('footwear', 'ac_jobs', false),
  ('footwear', 'vehicles', false),
  ('footwear', 'export', true),
  ('footwear', 'offline', false)
on conflict (sector_id, module_key) do update set allowed = excluded.allowed;

comment on table public.business_templates is
  'Admin provisioning catalogue. sector_id selects the operational template; plan controls commercial entitlement separately.';
