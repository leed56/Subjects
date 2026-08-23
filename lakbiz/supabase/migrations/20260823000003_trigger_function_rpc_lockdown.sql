-- LakBiz API hardening: trigger functions must not be directly callable RPCs.
--
-- PostgreSQL grants EXECUTE on new functions to PUBLIC by default. Supabase's
-- Data API exposes executable functions from the public schema as RPCs, which
-- means trigger-only helpers can otherwise appear callable even though they are
-- intended to run solely through their attached table/view triggers.
--
-- Revoke direct execution from PUBLIC/anon/authenticated for every current
-- public trigger-returning function. Existing triggers remain attached and
-- continue to invoke these functions internally. Also harden default privileges
-- for future functions created by this migration owner so new functions are not
-- accidentally public unless a later migration explicitly grants EXECUTE.

do $$
declare
  r record;
begin
  for r in
    select p.oid::regprocedure as proc
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prorettype = 'trigger'::regtype
  loop
    execute format(
      'revoke all on function %s from public, anon, authenticated',
      r.proc
    );
  end loop;
end $$;

alter default privileges in schema public
  revoke execute on functions from public;
alter default privileges in schema public
  revoke execute on functions from anon, authenticated;

comment on schema public is
  'LakBiz exposed schema. Trigger helpers are not directly executable; application RPCs must receive explicit grants.';
