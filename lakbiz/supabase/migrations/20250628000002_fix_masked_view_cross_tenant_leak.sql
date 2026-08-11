-- CRITICAL FIX: cross-tenant data leak via the masked financial views.
--
-- public.sales, public.sale_lines, public.products, public.ac_jobs,
-- public.contractors, and public.vehicles were created with
-- security_invoker=false (implicitly or explicitly), which runs the view
-- as its owner rather than the querying user. That completely bypasses the
-- row level security policies on the underlying *_base tables — the
-- column-level financial masking (CASE WHEN can_see_org_financials(...))
-- still hid cost/profit/buy_price correctly, but nothing filtered ROWS by
-- organization at all.
--
-- Confirmed empirically against production (2026-08-11): an authenticated
-- user from Organization A could read every row belonging to every other
-- organization through these six views — customer names, phone numbers,
-- addresses, job details, sales — while a direct query against the
-- underlying *_base table correctly returned "permission denied" (proving
-- RLS on the base tables was correctly written; it just wasn't being
-- reached).
--
-- This has already been applied directly to production (see
-- docs/IMPLEMENTATION_PROGRESS.md and the PR this migration ships in) —
-- this file exists so the fix is version-controlled and so
-- scripts/apply-migrations.mjs applying migrations fresh to a new
-- environment (e.g. a staging branch) produces the same schema.
--
-- The two-part fix:
--   1. Grant SELECT on the base tables to `authenticated` — previously only
--      the definer-mode view could read them at all.
--   2. Set security_invoker=true on each view so the existing RLS policies
--      on the base tables apply to the querying user, not the view owner.

grant select on public.sales_base to authenticated;
grant select on public.sale_lines_base to authenticated;
grant select on public.products_base to authenticated;
grant select on public.ac_jobs_base to authenticated;
grant select on public.contractors_base to authenticated;
grant select on public.vehicles_base to authenticated;

alter view public.sales set (security_invoker = true);
alter view public.sale_lines set (security_invoker = true);
alter view public.products set (security_invoker = true);
alter view public.ac_jobs set (security_invoker = true);
alter view public.contractors set (security_invoker = true);
alter view public.vehicles set (security_invoker = true);
