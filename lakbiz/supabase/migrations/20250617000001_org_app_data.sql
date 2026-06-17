-- LakBiz org-scoped app data (Phase A cloud sync)
-- Stores full AppData JSON per organization until normalized tables land.

create table if not exists public.org_app_data (
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id)
);

create index if not exists org_app_data_updated_at_idx
  on public.org_app_data (updated_at desc);

alter table public.org_app_data enable row level security;

create policy "org_app_data_select_member"
  on public.org_app_data for select to authenticated
  using (public.is_org_member(organization_id));

create policy "org_app_data_insert_member"
  on public.org_app_data for insert to authenticated
  with check (public.is_org_member(organization_id));

create policy "org_app_data_update_member"
  on public.org_app_data for update to authenticated
  using (public.is_org_member(organization_id))
  with check (public.is_org_member(organization_id));
