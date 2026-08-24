-- LakBiz: platform-admin-only workspace provisioning.
--
-- Client UI no longer offers public shop signup. Enforce the same invariant at
-- the database boundary so an authenticated user cannot bypass the UI and call
-- the historical self-signup RPC directly.
--
-- provision_shop is already service_role-only. Keep the legacy bootstrap
-- wrapper available only to service_role for compatibility/rollback tooling;
-- normal shop users must receive an organization membership from platform
-- administration before they can sign in to the workspace.

revoke all on function public.bootstrap_user_organization(text, text, text) from public;
revoke all on function public.bootstrap_user_organization(text, text, text) from anon;
revoke all on function public.bootstrap_user_organization(text, text, text) from authenticated;
grant execute on function public.bootstrap_user_organization(text, text, text) to service_role;

comment on function public.bootstrap_user_organization(text, text, text)
  is 'Legacy compatibility wrapper. Shop/workspace creation is platform-admin controlled; execution is service_role-only.';
