-- Extend financial masking to AC jobs (subcontract cost), contractors, vehicles, contractor payments.

-- contractor_payments: owner/manager SELECT only
drop policy if exists contractor_payments_select_member on public.contractor_payments;
create policy contractor_payments_select_financial on public.contractor_payments
  for select to authenticated using (
    organization_id in (
      select m.organization_id from public.org_members m where m.user_id = auth.uid()
    )
    and public.can_see_org_financials(organization_id)
  );

-- ─── Preserve financial columns on staff sync writes ───────────────────────────
create or replace function public.preserve_ac_job_subcontract_cost()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if not public.can_see_org_financials(new.organization_id) then
    new.subcontract_cost := old.subcontract_cost;
  end if;
  return new;
end;
$$;

create or replace function public.preserve_contractor_financials()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if not public.can_see_org_financials(new.organization_id) then
    new.rate_amount := old.rate_amount;
    new.payable_balance := old.payable_balance;
  end if;
  return new;
end;
$$;

create or replace function public.preserve_vehicle_costs()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if not public.can_see_org_financials(new.organization_id) then
    new.purchase_price := old.purchase_price;
    new.recondition_cost := old.recondition_cost;
    new.min_price := old.min_price;
  end if;
  return new;
end;
$$;

-- ─── AC jobs: mask subcontract_cost ───────────────────────────────────────────
alter table public.ac_jobs rename to ac_jobs_base;

create view public.ac_jobs with (security_barrier = true) as
select
  j.id,
  j.organization_id,
  j.job_no,
  j.job_date,
  j.customer_id,
  j.customer_name,
  j.phone,
  j.address,
  j.brand,
  j.btu,
  j.unit_type,
  j.unit_count,
  j.description,
  j.quoted_amount,
  j.deposit_amount,
  j.pipe_meters,
  j.status,
  j.scheduled_date,
  j.installed_date,
  j.notes,
  j.created_at,
  j.updated_at,
  j.service_due_date,
  j.last_service_date,
  j.service_interval_months,
  j.amc_contract,
  j.job_type,
  j.assigned_technician,
  j.service_due_manual,
  j.service_interval_days,
  j.assignee_type,
  j.assignee_id,
  case
    when public.can_see_org_financials(j.organization_id) then j.subcontract_cost
    else null::numeric
  end as subcontract_cost
from public.ac_jobs_base j;

-- ─── Contractors: mask rate + payable ────────────────────────────────────────
alter table public.contractors rename to contractors_base;

create view public.contractors with (security_barrier = true) as
select
  c.id,
  c.organization_id,
  c.name,
  c.company,
  c.phone,
  c.specialties,
  c.rate_type,
  case
    when public.can_see_org_financials(c.organization_id) then c.rate_amount
    else 0::numeric
  end as rate_amount,
  case
    when public.can_see_org_financials(c.organization_id) then c.payable_balance
    else 0::numeric
  end as payable_balance,
  c.active,
  c.notes,
  c.created_at,
  c.updated_at
from public.contractors_base c;

-- ─── Vehicles: mask cost fields ──────────────────────────────────────────────
alter table public.vehicles rename to vehicles_base;

create view public.vehicles with (security_barrier = true) as
select
  v.id,
  v.organization_id,
  v.stock_id,
  v.date_added,
  v.make,
  v.model,
  v.year,
  v.chassis_no,
  v.engine_no,
  v.reg_no,
  v.color,
  v.fuel,
  v.transmission,
  v.mileage_km,
  v.condition,
  case
    when public.can_see_org_financials(v.organization_id) then v.purchase_price
    else 0::numeric
  end as purchase_price,
  case
    when public.can_see_org_financials(v.organization_id) then v.recondition_cost
    else 0::numeric
  end as recondition_cost,
  v.ask_price,
  case
    when public.can_see_org_financials(v.organization_id) then v.min_price
    else null::numeric
  end as min_price,
  v.status,
  v.customer_id,
  v.customer_name,
  v.sold_price,
  v.sold_date,
  v.finance_partner,
  v.payment_method,
  v.notes,
  v.created_at,
  v.updated_at
from public.vehicles_base v;

-- ─── View write triggers (security definer + module gate) ────────────────────
create or replace function public.ac_jobs_view_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.org_member_can_write_module(new.organization_id, 'ac_jobs') then
    raise exception 'permission denied for table ac_jobs_base' using errcode = '42501';
  end if;
  insert into public.ac_jobs_base (
    id, organization_id, job_no, job_date, customer_id, customer_name, phone, address,
    brand, btu, unit_type, unit_count, description, quoted_amount, deposit_amount,
    pipe_meters, status, scheduled_date, installed_date, notes, service_due_date,
    last_service_date, service_interval_months, amc_contract, job_type, assigned_technician,
    service_due_manual, service_interval_days, assignee_type, assignee_id, subcontract_cost
  ) values (
    new.id, new.organization_id, new.job_no, new.job_date, new.customer_id, new.customer_name,
    new.phone, new.address, new.brand, new.btu, new.unit_type, new.unit_count, new.description,
    new.quoted_amount, new.deposit_amount, new.pipe_meters, new.status, new.scheduled_date,
    new.installed_date, new.notes, new.service_due_date, new.last_service_date,
    new.service_interval_months, new.amc_contract, new.job_type, new.assigned_technician,
    new.service_due_manual, new.service_interval_days, new.assignee_type, new.assignee_id,
    new.subcontract_cost
  );
  return new;
end;
$$;

create or replace function public.ac_jobs_view_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.org_member_can_write_module(new.organization_id, 'ac_jobs') then
    raise exception 'permission denied for table ac_jobs_base' using errcode = '42501';
  end if;
  update public.ac_jobs_base set
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
    quoted_amount = new.quoted_amount,
    deposit_amount = new.deposit_amount,
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
    subcontract_cost = new.subcontract_cost,
    updated_at = coalesce(new.updated_at, now())
  where id = old.id and organization_id = old.organization_id;
  return new;
end;
$$;

create or replace function public.ac_jobs_view_delete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.org_member_can_write_module(old.organization_id, 'ac_jobs') then
    raise exception 'permission denied for table ac_jobs_base' using errcode = '42501';
  end if;
  delete from public.ac_jobs_base
  where id = old.id and organization_id = old.organization_id;
  return old;
end;
$$;

create or replace function public.contractors_view_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.org_member_can_write_module(new.organization_id, 'ac_jobs') then
    raise exception 'permission denied for table contractors_base' using errcode = '42501';
  end if;
  insert into public.contractors_base (
    id, organization_id, name, company, phone, specialties, rate_type, rate_amount,
    payable_balance, active, notes, created_at, updated_at
  ) values (
    new.id, new.organization_id, new.name, new.company, new.phone, new.specialties,
    new.rate_type, new.rate_amount, new.payable_balance, new.active, new.notes,
    coalesce(new.created_at, now()), coalesce(new.updated_at, now())
  );
  return new;
end;
$$;

create or replace function public.contractors_view_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.org_member_can_write_module(new.organization_id, 'ac_jobs') then
    raise exception 'permission denied for table contractors_base' using errcode = '42501';
  end if;
  update public.contractors_base set
    name = new.name,
    company = new.company,
    phone = new.phone,
    specialties = new.specialties,
    rate_type = new.rate_type,
    rate_amount = new.rate_amount,
    payable_balance = new.payable_balance,
    active = new.active,
    notes = new.notes,
    updated_at = coalesce(new.updated_at, now())
  where id = old.id and organization_id = old.organization_id;
  return new;
end;
$$;

create or replace function public.contractors_view_delete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.org_member_can_write_module(old.organization_id, 'ac_jobs') then
    raise exception 'permission denied for table contractors_base' using errcode = '42501';
  end if;
  delete from public.contractors_base
  where id = old.id and organization_id = old.organization_id;
  return old;
end;
$$;

create or replace function public.vehicles_view_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.org_member_can_write_module(new.organization_id, 'vehicles') then
    raise exception 'permission denied for table vehicles_base' using errcode = '42501';
  end if;
  insert into public.vehicles_base (
    id, organization_id, stock_id, date_added, make, model, year, chassis_no, engine_no,
    reg_no, color, fuel, transmission, mileage_km, condition, purchase_price,
    recondition_cost, ask_price, min_price, status, customer_id, customer_name, sold_price,
    sold_date, finance_partner, payment_method, notes, created_at, updated_at
  ) values (
    new.id, new.organization_id, new.stock_id, new.date_added, new.make, new.model, new.year,
    new.chassis_no, new.engine_no, new.reg_no, new.color, new.fuel, new.transmission,
    new.mileage_km, new.condition, new.purchase_price, new.recondition_cost, new.ask_price,
    new.min_price, new.status, new.customer_id, new.customer_name, new.sold_price, new.sold_date,
    new.finance_partner, new.payment_method, new.notes,
    coalesce(new.created_at, now()), coalesce(new.updated_at, now())
  );
  return new;
end;
$$;

create or replace function public.vehicles_view_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.org_member_can_write_module(new.organization_id, 'vehicles') then
    raise exception 'permission denied for table vehicles_base' using errcode = '42501';
  end if;
  update public.vehicles_base set
    stock_id = new.stock_id,
    date_added = new.date_added,
    make = new.make,
    model = new.model,
    year = new.year,
    chassis_no = new.chassis_no,
    engine_no = new.engine_no,
    reg_no = new.reg_no,
    color = new.color,
    fuel = new.fuel,
    transmission = new.transmission,
    mileage_km = new.mileage_km,
    condition = new.condition,
    purchase_price = new.purchase_price,
    recondition_cost = new.recondition_cost,
    ask_price = new.ask_price,
    min_price = new.min_price,
    status = new.status,
    customer_id = new.customer_id,
    customer_name = new.customer_name,
    sold_price = new.sold_price,
    sold_date = new.sold_date,
    finance_partner = new.finance_partner,
    payment_method = new.payment_method,
    notes = new.notes,
    updated_at = coalesce(new.updated_at, now())
  where id = old.id and organization_id = old.organization_id;
  return new;
end;
$$;

create or replace function public.vehicles_view_delete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.org_member_can_write_module(old.organization_id, 'vehicles') then
    raise exception 'permission denied for table vehicles_base' using errcode = '42501';
  end if;
  delete from public.vehicles_base
  where id = old.id and organization_id = old.organization_id;
  return old;
end;
$$;

create trigger ac_jobs_view_insert_trg
  instead of insert on public.ac_jobs
  for each row execute function public.ac_jobs_view_insert();

create trigger ac_jobs_view_update_trg
  instead of update on public.ac_jobs
  for each row execute function public.ac_jobs_view_update();

create trigger ac_jobs_view_delete_trg
  instead of delete on public.ac_jobs
  for each row execute function public.ac_jobs_view_delete();

create trigger contractors_view_insert_trg
  instead of insert on public.contractors
  for each row execute function public.contractors_view_insert();

create trigger contractors_view_update_trg
  instead of update on public.contractors
  for each row execute function public.contractors_view_update();

create trigger contractors_view_delete_trg
  instead of delete on public.contractors
  for each row execute function public.contractors_view_delete();

create trigger vehicles_view_insert_trg
  instead of insert on public.vehicles
  for each row execute function public.vehicles_view_insert();

create trigger vehicles_view_update_trg
  instead of update on public.vehicles
  for each row execute function public.vehicles_view_update();

create trigger vehicles_view_delete_trg
  instead of delete on public.vehicles
  for each row execute function public.vehicles_view_delete();

drop trigger if exists ac_jobs_preserve_subcontract on public.ac_jobs_base;
create trigger ac_jobs_preserve_subcontract
  before update on public.ac_jobs_base
  for each row
  when (not public.can_see_org_financials(new.organization_id))
  execute function public.preserve_ac_job_subcontract_cost();

drop trigger if exists contractors_preserve_financials on public.contractors_base;
create trigger contractors_preserve_financials
  before update on public.contractors_base
  for each row
  when (not public.can_see_org_financials(new.organization_id))
  execute function public.preserve_contractor_financials();

drop trigger if exists vehicles_preserve_costs on public.vehicles_base;
create trigger vehicles_preserve_costs
  before update on public.vehicles_base
  for each row
  when (not public.can_see_org_financials(new.organization_id))
  execute function public.preserve_vehicle_costs();

alter view public.ac_jobs set (security_invoker = true);
alter view public.contractors set (security_invoker = true);
alter view public.vehicles set (security_invoker = true);

revoke all on public.ac_jobs_base from authenticated, anon;
revoke all on public.contractors_base from authenticated, anon;
revoke all on public.vehicles_base from authenticated, anon;

grant select, insert, update, delete on public.ac_jobs to authenticated;
grant select, insert, update, delete on public.contractors to authenticated;
grant select, insert, update, delete on public.vehicles to authenticated;

grant insert, update, delete on public.ac_jobs_base to authenticated;
grant insert, update, delete on public.contractors_base to authenticated;
grant insert, update, delete on public.vehicles_base to authenticated;

comment on view public.ac_jobs is
  'Masked AC jobs read; subcontract_cost hidden from non-owner/manager roles.';
