-- Cloud sync SELECT on masked AC/workforce views failed with
-- "permission denied for table ac_jobs_base" because security_invoker=true
-- requires SELECT on *_base, which is revoked for financial masking.
-- Match products/sales fix: run masked views as view owner; auth.uid() in
-- can_see_org_financials() still applies per session user.

alter view public.ac_jobs set (security_invoker = false);
alter view public.contractors set (security_invoker = false);
alter view public.vehicles set (security_invoker = false);

-- Idempotent: products/sales may already be false on some environments.
alter view public.products set (security_invoker = false);
alter view public.sales set (security_invoker = false);
alter view public.sale_lines set (security_invoker = false);

-- Explicit subscription write policies on renamed base tables (belt-and-braces).
do $$
declare
  rec record;
begin
  for rec in
    select *
    from (
      values
        ('ac_jobs_base', 'ac_jobs', 'ac_jobs'),
        ('contractors_base', 'contractors', 'ac_jobs'),
        ('vehicles_base', 'vehicles', 'vehicles')
    ) as t(table_name, policy_prefix, module_key)
  loop
    execute format(
      'drop policy if exists %I on public.%I',
      rec.policy_prefix || '_insert_member',
      rec.table_name
    );
    execute format(
      'drop policy if exists %I on public.%I',
      rec.policy_prefix || '_update_member',
      rec.table_name
    );
    execute format(
      'drop policy if exists %I on public.%I',
      rec.policy_prefix || '_delete_member',
      rec.table_name
    );

    execute format(
      'create policy %I on public.%I for insert to authenticated with check (
        public.org_member_can_write_module(organization_id, %L)
      )',
      rec.policy_prefix || '_insert_member',
      rec.table_name,
      rec.module_key
    );

    execute format(
      'create policy %I on public.%I for update to authenticated
        using (public.org_member_can_write_module(organization_id, %L))
        with check (public.org_member_can_write_module(organization_id, %L))',
      rec.policy_prefix || '_update_member',
      rec.table_name,
      rec.module_key,
      rec.module_key
    );

    execute format(
      'create policy %I on public.%I for delete to authenticated using (
        public.org_member_can_write_module(organization_id, %L)
      )',
      rec.policy_prefix || '_delete_member',
      rec.table_name,
      rec.module_key
    );
  end loop;
end $$;

comment on view public.ac_jobs is
  'Masked AC jobs read; subcontract_cost hidden from non-owner/manager. security_invoker=false for cloud sync SELECT.';
