-- LakBiz: enforce single-organization membership per user at the database level.
--
-- Every read path already assumes this (middleware.ts fetchOrgRole,
-- org-role/require-org-role.ts getOrgMemberContext, and
-- bootstrap_user_organization()/provision_shop() all call
-- `.eq('user_id', ...).maybeSingle()` or `limit 1`). That assumption was
-- never enforced by schema: org_members only has `unique (organization_id,
-- user_id)`, which blocks a duplicate row in the *same* org but not a second
-- row in a *different* org. If a user ever ended up in two orgs (a bad
-- invite path, a manual DB edit, a future bug), `.maybeSingle()` throws a
-- PostgREST "multiple rows" error and that user's dashboard/login breaks
-- outright — a reliability bug, not a data leak, but worth closing at the
-- schema layer rather than trusting every call site to keep using `limit 1`.
--
-- This migration formalizes the existing single-org-per-user product model
-- (see docs/ARCHITECTURE_AUDIT.md, "Tenant model"). It does NOT change any
-- RLS policy and does NOT touch role permissions.
--
-- SAFETY: this constraint will fail to apply if any user_id already appears
-- in more than one org_members row. Run the check below FIRST against the
-- target database and resolve any duplicates (decide which membership wins,
-- remove the other) before applying this migration:
--
--   select user_id, array_agg(organization_id) as orgs, count(*)
--   from public.org_members
--   group by user_id
--   having count(*) > 1;
--
-- This session has no live database connection and could not run that check
-- against production — do not apply this migration until it has been run
-- and returned zero rows.

do $$
declare
  dup_count integer;
begin
  select count(*) into dup_count
  from (
    select user_id
    from public.org_members
    group by user_id
    having count(*) > 1
  ) dupes;

  if dup_count > 0 then
    raise exception
      'org_members has % user(s) with multiple organization memberships — resolve duplicates before adding the single-membership constraint (see query in this migration''s header comment)',
      dup_count;
  end if;
end $$;

alter table public.org_members
  add constraint org_members_user_id_key unique (user_id);
