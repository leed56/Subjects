-- LakBiz HVAC platform Phase 9: Job Detail redesign — Complaint & Diagnosis.
--
-- Two genuinely new fields, not previously modeled anywhere: `description`
-- is an auto-generated equipment summary (brand/BTU/unit type — see
-- addACJob in actions.ts) with no editable UI input at all, not "what the
-- customer reported." Complaint (customer's account) and Diagnosis
-- (technician's finding) are distinct concepts the spec's Job Detail
-- section list names explicitly.
--
-- ac_jobs is a masked view over ac_jobs_base with INSTEAD OF triggers
-- (20250626000001_ac_workforce_financial_masking.sql) — new columns must
-- be added to the base table, then appended (not inserted) to the view
-- and both trigger functions, same CREATE OR REPLACE VIEW append-only
-- constraint already documented in prior phases' migrations. Neither
-- field is financial, so no masking case/when is needed for them.
--
-- Live-DB audit fix (found while applying this phase's migrations):
-- crews.sql (20250630000001) added ac_jobs_base.crew_id and appended it
-- to this view's SELECT list, but this file's earlier draft rewrote the
-- view without it — CREATE OR REPLACE VIEW cannot drop a column, so that
-- draft would have failed outright. Also, crews.sql (and, further back,
-- ac_asset_lifecycle.sql for asset_id) never taught the INSERT/UPDATE
-- trigger functions to forward asset_id/crew_id at all — both existed
-- only in the SELECT half of the view, silently no-opping any write.
-- Since this migration already has to rewrite the same view + both
-- trigger functions to append complaint/diagnosis, it corrects both
-- gaps here rather than reproducing them a third time.

alter table public.ac_jobs_base add column if not exists complaint text;
alter table public.ac_jobs_base add column if not exists diagnosis text;

create or replace view public.ac_jobs as
select id, organization_id, job_no, job_date, customer_id, customer_name, phone, address,
  brand, btu, unit_type, unit_count, description, quoted_amount, deposit_amount, pipe_meters,
  status, scheduled_date, installed_date, notes, created_at, updated_at, service_due_date,
  last_service_date, service_interval_months, amc_contract, job_type, assigned_technician,
  service_due_manual, service_interval_days, assignee_type, assignee_id,
  case when can_see_org_financials(organization_id) then subcontract_cost else null::numeric end as subcontract_cost,
  asset_id, crew_id, complaint, diagnosis
from public.ac_jobs_base j
where organization_id in (select organization_id from public.org_members where user_id = auth.uid());

alter view public.ac_jobs set (security_invoker = false);

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
    service_due_manual, service_interval_days, assignee_type, assignee_id, subcontract_cost,
    asset_id, crew_id, complaint, diagnosis
  ) values (
    new.id, new.organization_id, new.job_no, new.job_date, new.customer_id, new.customer_name,
    new.phone, new.address, new.brand, new.btu, new.unit_type, new.unit_count, new.description,
    new.quoted_amount, new.deposit_amount, new.pipe_meters, new.status, new.scheduled_date,
    new.installed_date, new.notes, new.service_due_date, new.last_service_date,
    new.service_interval_months, new.amc_contract, new.job_type, new.assigned_technician,
    new.service_due_manual, new.service_interval_days, new.assignee_type, new.assignee_id,
    new.subcontract_cost, new.asset_id, new.crew_id, new.complaint, new.diagnosis
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
    asset_id = new.asset_id,
    crew_id = new.crew_id,
    complaint = new.complaint,
    diagnosis = new.diagnosis,
    updated_at = coalesce(new.updated_at, now())
  where id = old.id and organization_id = old.organization_id;
  return new;
end;
$$;

comment on column public.ac_jobs_base.complaint is 'What the customer reported (HVAC platform Phase 9) — distinct from description, an auto-generated equipment summary.';
comment on column public.ac_jobs_base.diagnosis is 'What the technician found on inspection (Phase 9).';
