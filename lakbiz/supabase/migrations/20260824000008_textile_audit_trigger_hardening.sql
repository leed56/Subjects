-- Keep the immutable audit trigger outside caller-controlled schema resolution.
alter function public.block_textile_audit_snapshot_mutation()
  set search_path = '';

-- Trigger functions are internal implementation details, not public RPCs.
revoke execute on function public.block_textile_audit_snapshot_mutation()
  from public, anon, authenticated;
