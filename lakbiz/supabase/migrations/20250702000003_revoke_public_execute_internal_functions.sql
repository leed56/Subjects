-- LakBiz: follow-up to 20250702000002 — revoke EXECUTE from PUBLIC too
-- (Phase 17, final security audit).
--
-- Re-ran the security advisor after 20250702000002 and only 5 of the 30
-- functions actually lost anon's access; the other 25 still showed up as
-- anon-executable. `pg_proc.proacl` explains why: those 25 had EXECUTE
-- granted to PUBLIC (Postgres's default for a newly created function,
-- unless the owner explicitly revokes it) in addition to the named
-- role grants — `REVOKE ... FROM anon` alone doesn't remove access that
-- anon inherits via the PUBLIC pseudo-role. Same class of grant-hygiene
-- bug this repo has hit before for these exact masked-view functions
-- (see 20250628000002_fix_masked_view_cross_tenant_leak.sql and
-- 20250628000003_fix_masked_view_grant_regression.sql).
--
-- Revoke from PUBLIC on all 30 (idempotent/no-op for the 5 that didn't
-- have it) and explicitly (re-)grant to authenticated, which the app
-- actually needs. Verified after applying: the security advisor's
-- anon_security_definer_function_executable warning count dropped from
-- 25 to 0; authenticated_security_definer_function_executable is
-- unaffected (expected — those calls are legitimate).

revoke execute on function public.ac_jobs_view_delete() from public;
revoke execute on function public.ac_jobs_view_insert() from public;
revoke execute on function public.ac_jobs_view_update() from public;
revoke execute on function public.can_see_org_financials(uuid) from public;
revoke execute on function public.contractors_view_delete() from public;
revoke execute on function public.contractors_view_insert() from public;
revoke execute on function public.contractors_view_update() from public;
revoke execute on function public.get_org_sync_generation(uuid) from public;
revoke execute on function public.is_org_member(uuid) from public;
revoke execute on function public.is_org_owner(uuid) from public;
revoke execute on function public.is_platform_admin() from public;
revoke execute on function public.org_can_add_product(uuid) from public;
revoke execute on function public.org_can_write(uuid) from public;
revoke execute on function public.org_has_addon(uuid, text) from public;
revoke execute on function public.org_has_module(uuid, text) from public;
revoke execute on function public.org_member_can_write(uuid) from public;
revoke execute on function public.org_member_can_write_module(uuid, text) from public;
revoke execute on function public.products_view_delete() from public;
revoke execute on function public.products_view_insert() from public;
revoke execute on function public.products_view_update() from public;
revoke execute on function public.sale_lines_view_delete() from public;
revoke execute on function public.sale_lines_view_insert() from public;
revoke execute on function public.sale_lines_view_update() from public;
revoke execute on function public.sales_view_delete() from public;
revoke execute on function public.sales_view_insert() from public;
revoke execute on function public.sales_view_update() from public;
revoke execute on function public.try_advance_org_sync_generation(uuid, bigint) from public;
revoke execute on function public.vehicles_view_delete() from public;
revoke execute on function public.vehicles_view_insert() from public;
revoke execute on function public.vehicles_view_update() from public;

grant execute on function public.ac_jobs_view_delete() to authenticated;
grant execute on function public.ac_jobs_view_insert() to authenticated;
grant execute on function public.ac_jobs_view_update() to authenticated;
grant execute on function public.can_see_org_financials(uuid) to authenticated;
grant execute on function public.contractors_view_delete() to authenticated;
grant execute on function public.contractors_view_insert() to authenticated;
grant execute on function public.contractors_view_update() to authenticated;
grant execute on function public.get_org_sync_generation(uuid) to authenticated;
grant execute on function public.is_org_member(uuid) to authenticated;
grant execute on function public.is_org_owner(uuid) to authenticated;
grant execute on function public.is_platform_admin() to authenticated;
grant execute on function public.org_can_add_product(uuid) to authenticated;
grant execute on function public.org_can_write(uuid) to authenticated;
grant execute on function public.org_has_addon(uuid, text) to authenticated;
grant execute on function public.org_has_module(uuid, text) to authenticated;
grant execute on function public.org_member_can_write(uuid) to authenticated;
grant execute on function public.org_member_can_write_module(uuid, text) to authenticated;
grant execute on function public.products_view_delete() to authenticated;
grant execute on function public.products_view_insert() to authenticated;
grant execute on function public.products_view_update() to authenticated;
grant execute on function public.sale_lines_view_delete() to authenticated;
grant execute on function public.sale_lines_view_insert() to authenticated;
grant execute on function public.sale_lines_view_update() to authenticated;
grant execute on function public.sales_view_delete() to authenticated;
grant execute on function public.sales_view_insert() to authenticated;
grant execute on function public.sales_view_update() to authenticated;
grant execute on function public.try_advance_org_sync_generation(uuid, bigint) to authenticated;
grant execute on function public.vehicles_view_delete() to authenticated;
grant execute on function public.vehicles_view_insert() to authenticated;
grant execute on function public.vehicles_view_update() to authenticated;
