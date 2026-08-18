-- LakBiz: enforce stock_logs.user_id server-side.
--
-- Disclosed gap (flagged by the Codex automated review on an earlier PR,
-- not fixed at the time): `stock_logs.user_id` (added in
-- 20250704000001_stock_movement_types.sql, comment: "Nullable — populated
-- by the app layer, not enforced by RLS") is fully client-controlled.
-- business-sync.ts's stockLogRow() sends whatever `log.userId` the local
-- app state happens to hold, and the INSERT/UPDATE RLS policy on
-- stock_logs (20250618000001_rls_hardening.sql) only checks
-- `organization_id` membership — it never checks `user_id` at all. Any
-- authenticated org member could therefore write a stock movement log
-- attributed to a different member, corrupting the "who actually moved
-- this stock" audit trail the column exists to provide.
--
-- Fix: a BEFORE INSERT OR UPDATE trigger that always overwrites
-- `user_id` with `auth.uid()` for authenticated writers, ignoring
-- whatever the client sent. This keeps the column's offline-first
-- ergonomics (the client can still populate it optimistically for local
-- display before a round trip) while making the value actually
-- trustworthy once it lands in Postgres. Writes from contexts with no
-- `auth.uid()` (service_role, e.g. an admin backfill script) leave
-- whatever was supplied untouched, since there's no real actor to stamp.

create or replace function public.stock_logs_stamp_user_id()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is not null then
    new.user_id := auth.uid();
  end if;
  return new;
end;
$$;

drop trigger if exists stock_logs_stamp_user_id on public.stock_logs;
create trigger stock_logs_stamp_user_id
  before insert or update on public.stock_logs
  for each row
  execute function public.stock_logs_stamp_user_id();

comment on function public.stock_logs_stamp_user_id() is
  'Forces stock_logs.user_id to auth.uid() for authenticated writers so the audit trail cannot be spoofed by a client-supplied value. See migration header for the disclosed gap this closes.';

-- Only the authenticated role ever calls this via the table's own INSERT/
-- UPDATE RLS policies; no anon/public execute grant is needed (matches
-- the pattern in 20250702000002/20250702000003 for internal helpers).
revoke all on function public.stock_logs_stamp_user_id() from public, anon;
