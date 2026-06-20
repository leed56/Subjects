-- Keep is_org_member for policies that still reference it; inline policies for org_app_data.

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

drop policy if exists "org_app_data_select_member" on public.org_app_data;
create policy "org_app_data_select_member"
  on public.org_app_data for select to authenticated
  using (
    organization_id in (
      select m.organization_id from public.org_members m where m.user_id = auth.uid()
    )
  );

drop policy if exists "org_app_data_insert_member" on public.org_app_data;
create policy "org_app_data_insert_member"
  on public.org_app_data for insert to authenticated
  with check (
    organization_id in (
      select m.organization_id from public.org_members m where m.user_id = auth.uid()
    )
  );

drop policy if exists "org_app_data_update_member" on public.org_app_data;
create policy "org_app_data_update_member"
  on public.org_app_data for update to authenticated
  using (
    organization_id in (
      select m.organization_id from public.org_members m where m.user_id = auth.uid()
    )
  )
  with check (
    organization_id in (
      select m.organization_id from public.org_members m where m.user_id = auth.uid()
    )
  );
