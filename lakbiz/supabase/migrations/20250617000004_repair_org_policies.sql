-- Repair org owner update policy + is_org_member helper

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
