-- Installation & maintenance crews (Phase 6 of the LakBiz product spec).
--
-- Net-new concept, deliberately named "crew" rather than "team": the app
-- already uses "team" to mean "in-house technician" as opposed to
-- "contractor" (see job_assignee_type on ac_jobs_base, and the Workforce
-- page copy). A crew is a *named group* of workforce members (technicians
-- and/or contractors) who work installation or maintenance jobs together —
-- a genuinely new entity, not a rename of the existing single-assignee
-- concept.
--
-- Cloud-only, same architectural call as Phase 4's ac_assets: reads/writes
-- go straight to Supabase via src/lib/supabase/crews-client.ts, not the
-- local-first sync engine. See docs/IMPLEMENTATION_PROGRESS.md.
--
-- No financial fields on crews themselves (rate/payable stays on the
-- individual technician/contractor row), so — unlike sales/products/
-- contractors/vehicles/ac_jobs — there is no masked-view split needed
-- here: crews is a plain RLS-protected table, same shape as ac_assets.
--
-- RLS follows the exact pattern established in 20250618000001_rls_hardening.sql
-- (organization_id in (select organization_id from org_members where
-- user_id = auth.uid()) for select/insert/update/delete) — verified
-- empirically against production before this file was written, same
-- technique as the security incident and Phase 4: a non-member org gets
-- 0 rows on SELECT and an RLS-violation error on INSERT/UPDATE; the
-- owning org's member can read/write normally.

create table if not exists public.crews (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  crew_type text not null default 'mixed' check (crew_type in ('installation', 'maintenance', 'mixed')),
  active boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists crews_org_idx on public.crews(organization_id);

alter table public.crews enable row level security;

create policy crews_select_member
  on public.crews for select to authenticated
  using (organization_id in (select organization_id from public.org_members where user_id = auth.uid()));

create policy crews_insert_member
  on public.crews for insert to authenticated
  with check (organization_id in (select organization_id from public.org_members where user_id = auth.uid()));

create policy crews_update_member
  on public.crews for update to authenticated
  using (organization_id in (select organization_id from public.org_members where user_id = auth.uid()))
  with check (organization_id in (select organization_id from public.org_members where user_id = auth.uid()));

create policy crews_delete_member
  on public.crews for delete to authenticated
  using (organization_id in (select organization_id from public.org_members where user_id = auth.uid()));

grant select, insert, update, delete on public.crews to authenticated;

-- Membership is polymorphic (a member is either a technicians row or a
-- contractors_base row — two separate tables, see 20250621000002_workforce.sql
-- and 20250621000004_contractor_payments.sql) so member_id can't carry a
-- single foreign key. organization_id is denormalized onto this table too
-- (not just reachable via crew_id) so its own RLS policy never has to join
-- crews to decide visibility, matching the direct-column pattern every
-- other RLS policy in this schema uses.
create table if not exists public.crew_members (
  id uuid primary key default gen_random_uuid(),
  crew_id uuid not null references public.crews(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  member_type text not null check (member_type in ('technician', 'contractor')),
  member_id text not null,
  is_lead boolean not null default false,
  created_at timestamptz not null default now(),
  unique (crew_id, member_type, member_id)
);

create index if not exists crew_members_crew_idx on public.crew_members(crew_id);
create index if not exists crew_members_org_idx on public.crew_members(organization_id);

alter table public.crew_members enable row level security;

create policy crew_members_select_member
  on public.crew_members for select to authenticated
  using (organization_id in (select organization_id from public.org_members where user_id = auth.uid()));

create policy crew_members_insert_member
  on public.crew_members for insert to authenticated
  with check (organization_id in (select organization_id from public.org_members where user_id = auth.uid()));

create policy crew_members_update_member
  on public.crew_members for update to authenticated
  using (organization_id in (select organization_id from public.org_members where user_id = auth.uid()))
  with check (organization_id in (select organization_id from public.org_members where user_id = auth.uid()));

create policy crew_members_delete_member
  on public.crew_members for delete to authenticated
  using (organization_id in (select organization_id from public.org_members where user_id = auth.uid()));

grant select, insert, update, delete on public.crew_members to authenticated;

-- Let a job reference the crew assigned to it — additive and nullable,
-- same treatment as asset_id in Phase 4. Deliberately NOT wiring this into
-- the /jobs create/edit form this phase: that page runs through the
-- local-first sync engine, whose ACJobInput type doesn't know about
-- crew_id, and extending that safely needs a browser to verify the
-- offline/sync round-trip (same reasoning Phase 4 gave for asset_id). The
-- column and the read path (a crew's assigned-jobs list) are ready for it;
-- wiring the write side into the job form is flagged as follow-up, not
-- dropped silently.
alter table public.ac_jobs_base add column if not exists crew_id uuid references public.crews(id) on delete set null;
create index if not exists ac_jobs_base_crew_idx on public.ac_jobs_base(crew_id);

-- ac_jobs (the masked view) must expose the new column too. New columns
-- must be appended at the end for CREATE OR REPLACE VIEW to accept this
-- as an addition rather than an attempted column rename (learned the hard
-- way in Phase 4).
create or replace view public.ac_jobs as
select id, organization_id, job_no, job_date, customer_id, customer_name, phone, address,
  brand, btu, unit_type, unit_count, description, quoted_amount, deposit_amount, pipe_meters,
  status, scheduled_date, installed_date, notes, created_at, updated_at, service_due_date,
  last_service_date, service_interval_months, amc_contract, job_type, assigned_technician,
  service_due_manual, service_interval_days, assignee_type, assignee_id,
  case when can_see_org_financials(organization_id) then subcontract_cost else null::numeric end as subcontract_cost,
  asset_id, crew_id
from public.ac_jobs_base j
where organization_id in (select organization_id from public.org_members where user_id = auth.uid());

alter view public.ac_jobs set (security_invoker = false);
