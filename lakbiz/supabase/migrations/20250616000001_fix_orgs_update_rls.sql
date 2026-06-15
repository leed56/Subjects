-- Fix broken orgs_update_owner policy: unqualified `id` bound to org_members.id

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
