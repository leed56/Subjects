-- LakBiz owner-financial isolation: job item reads must use public.job_items.
--
-- job_items_base contains internal unit cost, line cost, customer price and
-- discount fields. Its tenant RLS prevents cross-organization reads but does
-- not mask those values by role. The public.job_items view performs the
-- owner-only masking, so authenticated application users must not be able to
-- SELECT the base relation directly.

revoke select on table public.job_items_base from public;
revoke select on table public.job_items_base from anon;
revoke select on table public.job_items_base from authenticated;

-- Keep the masked API view available to signed-in application users. Writes
-- continue through its INSTEAD OF triggers / existing role-aware RLS path.
grant select on table public.job_items to authenticated;
