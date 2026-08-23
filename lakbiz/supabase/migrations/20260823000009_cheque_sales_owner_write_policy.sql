-- Cheques are owner-only financial records, but they may originate from
-- Sales / POS even when the Banking workspace is disabled for a sector.
-- Keep direct table writes owner-only while allowing an active Sales module
-- to persist cheque payment records without requiring the Banking module.

drop policy if exists cheques_insert_owner on public.cheques;
drop policy if exists cheques_update_owner on public.cheques;
drop policy if exists cheques_delete_owner on public.cheques;

create policy cheques_insert_owner
on public.cheques
for insert
to authenticated
with check (
  org_member_role_in(organization_id, array['owner']::text[])
  and (
    org_member_can_write_module(organization_id, 'sales')
    or org_member_can_write_module(organization_id, 'banking')
  )
);

create policy cheques_update_owner
on public.cheques
for update
to authenticated
using (
  org_member_role_in(organization_id, array['owner']::text[])
  and (
    org_member_can_write_module(organization_id, 'sales')
    or org_member_can_write_module(organization_id, 'banking')
  )
)
with check (
  org_member_role_in(organization_id, array['owner']::text[])
  and (
    org_member_can_write_module(organization_id, 'sales')
    or org_member_can_write_module(organization_id, 'banking')
  )
);

create policy cheques_delete_owner
on public.cheques
for delete
to authenticated
using (
  org_member_role_in(organization_id, array['owner']::text[])
  and (
    org_member_can_write_module(organization_id, 'sales')
    or org_member_can_write_module(organization_id, 'banking')
  )
);
