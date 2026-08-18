-- Phase 25 follow-up — the masked-view N+1 fix explicitly deferred in
-- 20250712-era work (see docs/IMPLEMENTATION_PROGRESS.md, "Phase 25 —
-- performance / N+1 review"): the app-layer fix already shipped
-- (concurrent batches of 25 `.update()` calls via Promise.all) reduced
-- wall-clock time but not round-trip *count* — a full sync still issues
-- one HTTP request per row being updated. This adds a genuine O(1)
-- (per chunk) bulk-update path: a single UPDATE ... FROM
-- jsonb_array_elements(...) statement updates every row in one round
-- trip, via a new RPC the client calls once per chunk instead of once
-- per row.
--
-- WHY THIS TARGETS THE VIEW, NOT THE BASE TABLE, AND WHY IT'S SECURITY
-- INVOKER (not DEFINER, unlike this project's other trigger/helper
-- functions): sales/products/ac_jobs/contractors/vehicles/technicians/
-- job_items are masked views with INSTEAD OF UPDATE triggers that are
-- themselves SECURITY DEFINER and already perform the real permission
-- check (org_member_can_write_module + org_member_role_in, added in
-- 20250712000001_role_aware_write_rls.sql). `UPDATE view ... FROM
-- jsonb_array_elements($1) AS r(val) WHERE view.id = ...` is standard
-- Postgres: for every row the FROM-join matches, the INSTEAD OF UPDATE
-- trigger fires once, exactly as it already does today for the
-- PostgREST-issued one-row-at-a-time `.update()` calls this replaces —
-- same trigger, same permission check, same tenant-scoping WHERE clause
-- baked into the view itself, just issued as one statement instead of N.
-- Making this function SECURITY INVOKER (the PL/pgSQL default, made
-- explicit here) keeps it running as the calling `authenticated` role
-- against the view exactly as PostgREST's `.update()` does today — it
-- adds no new privilege surface, it only changes the request count.
--
-- SQL-INJECTION SAFETY: `p_view` is checked against a hardcoded
-- allowlist before use. Every identifier substituted into the dynamic
-- SQL (view name, column names, column type names) comes only from
-- pg_catalog (via format_type()/pg_attribute), never from client input.
-- Row *values* are never string-concatenated into SQL text — they stay
-- inside the single `$1` bind parameter and are only ever extracted via
-- `->>`, which is safe for arbitrary text content.
--
-- WHY COLUMNS COME FROM THE PAYLOAD'S OWN KEYS, NOT THE VIEW'S FULL
-- COLUMN LIST: found and fixed during design, before this was applied —
-- an earlier draft built the SET list from every column on the view.
-- Every masked view carries columns the client never sends in an update
-- payload (created_at/updated_at are always server-computed; some
-- tables' row-builder functions in business-sync.ts only ever populate
-- a subset). Setting every view column unconditionally would have
-- overwritten those omitted columns with NULL on every bulk update —
-- silent data loss. Using the first payload row's own JSON keys (every
-- row-builder function in business-sync.ts sends an identical key set
-- for a given table/call, using `field ?? null` rather than omitting
-- keys, so this is safe) means only columns the caller actually intends
-- to write are ever touched.
create or replace function public.bulk_update_masked_view_rows(
  p_view text,
  p_rows jsonb
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_id_type text;
  v_keys text[];
  v_set text := '';
  v_type text;
  v_key text;
  v_sql text;
  is_first boolean := true;
begin
  if p_view not in ('sales', 'products', 'ac_jobs', 'contractors', 'vehicles', 'technicians', 'job_items') then
    raise exception 'bulk_update_masked_view_rows: view % is not allowed', p_view;
  end if;

  if p_rows is null or jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) = 0 then
    return;
  end if;

  select format_type(a.atttypid, a.atttypmod)
    into v_id_type
  from pg_attribute a
  join pg_class c on c.oid = a.attrelid
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relname = p_view
    and a.attname = 'id'
    and a.attnum > 0
    and not a.attisdropped;

  if v_id_type is null then
    raise exception 'bulk_update_masked_view_rows: view % has no id column', p_view;
  end if;

  select array_agg(key)
    into v_keys
  from jsonb_object_keys(p_rows -> 0) as key
  where key <> 'id';

  if v_keys is null or array_length(v_keys, 1) = 0 then
    raise exception 'bulk_update_masked_view_rows: no columns in payload for view %', p_view;
  end if;

  foreach v_key in array v_keys loop
    select format_type(a.atttypid, a.atttypmod)
      into v_type
    from pg_attribute a
    join pg_class c on c.oid = a.attrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = p_view
      and a.attname = v_key
      and a.attnum > 0
      and not a.attisdropped;

    if v_type is null then
      raise exception 'bulk_update_masked_view_rows: column % not found on view %', v_key, p_view;
    end if;

    if not is_first then
      v_set := v_set || ', ';
    end if;
    v_set := v_set || format('%I = (r.val ->> %L)::%s', v_key, v_key, v_type);
    is_first := false;
  end loop;

  v_sql := format(
    'update %I as t set %s from jsonb_array_elements($1) as r(val) where t.id = (r.val ->> ''id'')::%s',
    p_view, v_set, v_id_type
  );

  execute v_sql using p_rows;
end;
$$;

comment on function public.bulk_update_masked_view_rows(text, jsonb) is
  'Phase 25 follow-up: single-round-trip bulk UPDATE for a masked view (sales/products/ac_jobs/contractors/vehicles/technicians/job_items). SECURITY INVOKER — relies entirely on each view''s own INSTEAD OF UPDATE trigger (SECURITY DEFINER, already role/module-checked) for permissions; this function only builds the dynamic UPDATE statement. Column set is taken from the payload''s own keys, not the view''s full column list, so columns the caller does not send are never overwritten.';

revoke all on function public.bulk_update_masked_view_rows(text, jsonb) from public;
grant execute on function public.bulk_update_masked_view_rows(text, jsonb) to authenticated;
