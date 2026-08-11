-- HVAC asset lifecycle records (Phase 4 of the LakBiz product spec).
--
-- A customer can own multiple AC units; each has independent history.
-- Cloud-only for v1 — reads/writes go straight to Supabase via
-- src/lib/supabase/ac-assets-client.ts, the same simple pattern already
-- used by org-settings.ts and notification-log-client.ts, rather than the
-- local-first sync engine (business-sync.ts / app-store-provider.tsx) the
-- rest of the app's entities go through. That engine is ~6,000 lines of
-- deeply interconnected offline-sync/conflict-resolution logic; wiring a
-- new entity into it correctly, with no browser available to verify the
-- sync round-trip, was judged higher-risk than shipping a real, working,
-- RLS-verified cloud-only module now and revisiting offline support later
-- once it can be tested properly. See docs/IMPLEMENTATION_PROGRESS.md.
--
-- RLS follows the exact pattern established in 20250618000001_rls_hardening.sql
-- (organization_id in (select organization_id from org_members where
-- user_id = auth.uid()) for select/insert/update/delete) — verified
-- empirically against production before this file was written: a
-- non-member org gets 0 rows on SELECT and an RLS-violation error on
-- INSERT; the owning org's member can read/write normally.

create table if not exists public.ac_assets (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  customer_id text references public.customers(id) on delete set null,
  site_address text,
  brand text,
  model text,
  serial_no text,
  indoor_serial text,
  outdoor_serial text,
  btu integer,
  ac_type text,
  refrigerant_type text,
  install_date date,
  warranty_expiry date,
  location_in_property text,
  status text not null default 'active' check (status in ('active', 'inactive', 'removed', 'replaced')),
  next_service_date date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists ac_assets_org_idx on public.ac_assets(organization_id);
create index if not exists ac_assets_customer_idx on public.ac_assets(customer_id);

alter table public.ac_assets enable row level security;

create policy ac_assets_select_member
  on public.ac_assets for select to authenticated
  using (organization_id in (select organization_id from public.org_members where user_id = auth.uid()));

create policy ac_assets_insert_member
  on public.ac_assets for insert to authenticated
  with check (organization_id in (select organization_id from public.org_members where user_id = auth.uid()));

create policy ac_assets_update_member
  on public.ac_assets for update to authenticated
  using (organization_id in (select organization_id from public.org_members where user_id = auth.uid()))
  with check (organization_id in (select organization_id from public.org_members where user_id = auth.uid()));

create policy ac_assets_delete_member
  on public.ac_assets for delete to authenticated
  using (organization_id in (select organization_id from public.org_members where user_id = auth.uid()));

grant select, insert, update, delete on public.ac_assets to authenticated;

-- Let a service/repair job reference the asset it's servicing.
alter table public.ac_jobs_base add column if not exists asset_id uuid references public.ac_assets(id) on delete set null;
create index if not exists ac_jobs_base_asset_idx on public.ac_jobs_base(asset_id);

-- ac_jobs (the masked view) must expose the new column too. New columns
-- must be appended at the end for CREATE OR REPLACE VIEW to accept this
-- as an addition rather than an attempted column rename.
create or replace view public.ac_jobs as
select id, organization_id, job_no, job_date, customer_id, customer_name, phone, address,
  brand, btu, unit_type, unit_count, description, quoted_amount, deposit_amount, pipe_meters,
  status, scheduled_date, installed_date, notes, created_at, updated_at, service_due_date,
  last_service_date, service_interval_months, amc_contract, job_type, assigned_technician,
  service_due_manual, service_interval_days, assignee_type, assignee_id,
  case when can_see_org_financials(organization_id) then subcontract_cost else null::numeric end as subcontract_cost,
  asset_id
from public.ac_jobs_base j
where organization_id in (select organization_id from public.org_members where user_id = auth.uid());

alter view public.ac_jobs set (security_invoker = false);
