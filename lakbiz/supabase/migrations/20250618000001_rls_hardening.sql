-- LakBiz: RLS hardening — bootstrap RPC, tighter org policies, revoke public RPC on triggers

-- ─── Fix mutable search_path on set_updated_at ───────────────────────────────
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ─── Membership expression (no SECURITY DEFINER RPC) ─────────────────────────
-- Used inline in policies: org row visible when user has a membership row.

-- ─── Atomic shop bootstrap (org + owner membership + trial subscription) ─────
create or replace function public.bootstrap_user_organization(
  p_name text,
  p_phone text default null,
  p_sector text default 'grocery'
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  select organization_id
  into v_org_id
  from public.org_members
  where user_id = v_uid
  limit 1;

  if v_org_id is not null then
    return v_org_id;
  end if;

  insert into public.organizations (name, phone, sector)
  values (
    coalesce(nullif(trim(p_name), ''), 'My Shop'),
    nullif(trim(p_phone), ''),
    coalesce(nullif(trim(p_sector), ''), 'grocery')
  )
  returning id into v_org_id;

  insert into public.org_members (organization_id, user_id, role)
  values (v_org_id, v_uid, 'owner');

  return v_org_id;
end;
$$;

revoke all on function public.bootstrap_user_organization(text, text, text) from public;
revoke execute on function public.bootstrap_user_organization(text, text, text) from anon;
grant execute on function public.bootstrap_user_organization(text, text, text) to authenticated;

-- Trigger-only: block direct RPC calls to subscription bootstrap
revoke all on function public.create_org_subscription() from public;
revoke all on function public.create_org_subscription() from anon;
revoke all on function public.create_org_subscription() from authenticated;

-- ─── Organizations: no direct insert; bootstrap RPC only ─────────────────────
drop policy if exists "orgs_insert_authenticated" on public.organizations;

drop policy if exists "orgs_select_member" on public.organizations;
create policy "orgs_select_member"
  on public.organizations for select to authenticated
  using (
    id in (
      select m.organization_id
      from public.org_members m
      where m.user_id = auth.uid()
    )
  );

-- ─── Org members: own row only; no direct insert (bootstrap RPC) ───────────────
drop policy if exists "org_members_insert_self_owner" on public.org_members;

drop policy if exists "org_members_select_own_org" on public.org_members;
create policy "org_members_select_own"
  on public.org_members for select to authenticated
  using (user_id = auth.uid());

-- ─── Subscriptions / addons ──────────────────────────────────────────────────
drop policy if exists "subscriptions_select_member" on public.subscriptions;
create policy "subscriptions_select_member"
  on public.subscriptions for select to authenticated
  using (
    organization_id in (
      select m.organization_id
      from public.org_members m
      where m.user_id = auth.uid()
    )
  );

drop policy if exists "addons_select_member" on public.subscription_addons;
create policy "addons_select_member"
  on public.subscription_addons for select to authenticated
  using (
    exists (
      select 1
      from public.subscriptions s
      join public.org_members m on m.organization_id = s.organization_id
      where s.id = subscription_addons.subscription_id
        and m.user_id = auth.uid()
    )
  );

-- ─── Business tables: replace is_org_member() with inline membership check ───
do $$
declare
  t text;
  org_col text;
begin
  foreach t in array array[
    'products', 'customers', 'suppliers', 'sales', 'purchases',
    'customer_payments', 'supplier_payments', 'stock_logs',
    'bank_accounts', 'cheques', 'ac_jobs', 'vehicles',
    'sale_lines', 'purchase_lines', 'notification_log'
  ] loop
    org_col := 'organization_id';

    execute format('drop policy if exists %I on public.%I', t || '_select_member', t);
    execute format('drop policy if exists %I on public.%I', t || '_insert_member', t);
    execute format('drop policy if exists %I on public.%I', t || '_update_member', t);
    execute format('drop policy if exists %I on public.%I', t || '_delete_member', t);

    execute format(
      'create policy %I on public.%I for select to authenticated using (
        %I in (select m.organization_id from public.org_members m where m.user_id = auth.uid())
      )',
      t || '_select_member', t, org_col
    );
    execute format(
      'create policy %I on public.%I for insert to authenticated with check (
        %I in (select m.organization_id from public.org_members m where m.user_id = auth.uid())
      )',
      t || '_insert_member', t, org_col
    );
    execute format(
      'create policy %I on public.%I for update to authenticated
        using (%I in (select m.organization_id from public.org_members m where m.user_id = auth.uid()))
        with check (%I in (select m.organization_id from public.org_members m where m.user_id = auth.uid()))',
      t || '_update_member', t, org_col, org_col
    );
    execute format(
      'create policy %I on public.%I for delete to authenticated using (
        %I in (select m.organization_id from public.org_members m where m.user_id = auth.uid())
      )',
      t || '_delete_member', t, org_col
    );
  end loop;
end $$;

-- is_org_member kept for org_app_data / notification_log policies (see 20250620000008)
