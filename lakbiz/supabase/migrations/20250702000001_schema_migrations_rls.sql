-- LakBiz: enable RLS on public.schema_migrations (Phase 17, final security audit).
--
-- This table is purely an internal deploy-tracking log — every row is
-- inserted by whoever runs a migration (via the Supabase service-role
-- connection this session uses), never by the deployed app itself at
-- runtime. Confirmed via grep: no application code under src/ references
-- "schema_migrations" at all.
--
-- The Supabase security advisor flags it as `rls_disabled_in_public`
-- (ERROR level): with RLS off, the anon/authenticated PostgREST roles can
-- read (and, given schema_migrations' default table grants, write) it
-- over `/rest/v1/schema_migrations` — exposing internal deployment
-- history to any signed-in user, and letting one insert bogus rows.
--
-- Fix: enable RLS with zero policies. service_role (and this session's
-- migration connection) bypasses RLS by default and is unaffected;
-- anon/authenticated get a hard deny, which is correct since neither has
-- any legitimate reason to touch this table.

alter table public.schema_migrations enable row level security;
