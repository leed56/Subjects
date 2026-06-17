-- Repair partial LakBiz schema + org_app_data cloud sync table

create or replace function public.is_org_member(org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.org_members
    where organization_id = org_id and user_id = auth.uid()
  );
$$;

drop policy if exists "orgs_update_owner" on public.organizations;
create policy "orgs_update_owner"
  on public.organizations for update to authenticated
  using (
    exists (
      select 1 from public.org_members m
      where m.organization_id = organizations.id
        and m.user_id = auth.uid()
        and m.role = 'owner'
    )
  )
  with check (
    exists (
      select 1 from public.org_members m
      where m.organization_id = organizations.id
        and m.user_id = auth.uid()
        and m.role = 'owner'
    )
  );

create table if not exists public.org_app_data (
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id)
);

create index if not exists org_app_data_updated_at_idx
  on public.org_app_data (updated_at desc);

alter table public.org_app_data enable row level security;

drop policy if exists "org_app_data_select_member" on public.org_app_data;
create policy "org_app_data_select_member"
  on public.org_app_data for select to authenticated
  using (public.is_org_member(organization_id));

drop policy if exists "org_app_data_insert_member" on public.org_app_data;
create policy "org_app_data_insert_member"
  on public.org_app_data for insert to authenticated
  with check (public.is_org_member(organization_id));

drop policy if exists "org_app_data_update_member" on public.org_app_data;
create policy "org_app_data_update_member"
  on public.org_app_data for update to authenticated
  using (public.is_org_member(organization_id))
  with check (public.is_org_member(organization_id));
