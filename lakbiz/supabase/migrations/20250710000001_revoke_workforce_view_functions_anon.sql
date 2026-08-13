-- LakBiz: extend the existing anon/public EXECUTE revocation
-- (20250702000002_revoke_anon_execute_internal_functions.sql /
-- 20250702000003_revoke_public_execute_internal_functions.sql, Phase 17
-- final security audit) to technicians_view_*/job_items_view_* — those
-- functions didn't exist yet when that hardening pass ran (labor_costing
-- came ten days later), so they never got the same treatment. Found via
-- a live security-advisor check while first applying labor_costing.sql.
--
-- Same class of gap, same fix: these are internal INSTEAD OF trigger
-- functions with no legitimate anon/public caller; the app only reaches
-- them through an authenticated Supabase client via an actual
-- INSERT/UPDATE/DELETE on the technicians/job_items views.

revoke execute on function public.technicians_view_insert() from anon, public;
revoke execute on function public.technicians_view_update() from anon, public;
revoke execute on function public.technicians_view_delete() from anon, public;
revoke execute on function public.job_items_view_insert() from anon, public;
revoke execute on function public.job_items_view_update() from anon, public;
revoke execute on function public.job_items_view_delete() from anon, public;

grant execute on function public.technicians_view_insert() to authenticated;
grant execute on function public.technicians_view_update() to authenticated;
grant execute on function public.technicians_view_delete() to authenticated;
grant execute on function public.job_items_view_insert() to authenticated;
grant execute on function public.job_items_view_update() to authenticated;
grant execute on function public.job_items_view_delete() to authenticated;
