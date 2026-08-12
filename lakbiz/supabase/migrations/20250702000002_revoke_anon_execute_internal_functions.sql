-- LakBiz: revoke anon EXECUTE on internal-only SECURITY DEFINER functions
-- (Phase 17, final security audit).
--
-- The Supabase security advisor flagged ~30 functions as executable by the
-- unauthenticated `anon` role via `/rest/v1/rpc/<name>` — the masked-view
-- INSTEAD OF trigger functions (products_view_insert etc.) and the
-- org/role/subscription helper functions (is_org_member, can_see_org_
-- financials, org_can_write, etc.). None of these have a legitimate
-- logged-out caller.
--
-- Verified by inspection first, not fixed blind: every one of these reads
-- `auth.uid()` (which is null for anon) and scopes its result to rows
-- matching the caller, so an anon call today returns false/empty rather
-- than leaking data — this is defense-in-depth against future changes to
-- those functions or to PostgREST's anon grants, not a fix for a live
-- leak. `authenticated` keeps EXECUTE; the app calls these through an
-- authenticated Supabase client exclusively.
--
-- is_platform_admin() and can_see_org_financials()/is_org_owner()/
-- org_can_write() etc. are also called internally by the masked views'
-- own WHERE/CASE clauses (see docs/ARCHITECTURE_AUDIT.md and Phase 6-11
-- migrations) — revoking anon's direct RPC access does not affect that,
-- since the views invoke them as their SECURITY DEFINER owner, not as
-- the requesting role.

revoke execute on function public.ac_jobs_view_delete() from anon;
revoke execute on function public.ac_jobs_view_insert() from anon;
revoke execute on function public.ac_jobs_view_update() from anon;
revoke execute on function public.can_see_org_financials(uuid) from anon;
revoke execute on function public.contractors_view_delete() from anon;
revoke execute on function public.contractors_view_insert() from anon;
revoke execute on function public.contractors_view_update() from anon;
revoke execute on function public.get_org_sync_generation(uuid) from anon;
revoke execute on function public.is_org_member(uuid) from anon;
revoke execute on function public.is_org_owner(uuid) from anon;
revoke execute on function public.is_platform_admin() from anon;
revoke execute on function public.org_can_add_product(uuid) from anon;
revoke execute on function public.org_can_write(uuid) from anon;
revoke execute on function public.org_has_addon(uuid, text) from anon;
revoke execute on function public.org_has_module(uuid, text) from anon;
revoke execute on function public.org_member_can_write(uuid) from anon;
revoke execute on function public.org_member_can_write_module(uuid, text) from anon;
revoke execute on function public.products_view_delete() from anon;
revoke execute on function public.products_view_insert() from anon;
revoke execute on function public.products_view_update() from anon;
revoke execute on function public.sale_lines_view_delete() from anon;
revoke execute on function public.sale_lines_view_insert() from anon;
revoke execute on function public.sale_lines_view_update() from anon;
revoke execute on function public.sales_view_delete() from anon;
revoke execute on function public.sales_view_insert() from anon;
revoke execute on function public.sales_view_update() from anon;
revoke execute on function public.try_advance_org_sync_generation(uuid, bigint) from anon;
revoke execute on function public.vehicles_view_delete() from anon;
revoke execute on function public.vehicles_view_insert() from anon;
revoke execute on function public.vehicles_view_update() from anon;
