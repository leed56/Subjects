-- H1 + H2: enforce subscription write access and plan modules in RLS.

create or replace function public.sector_allows_module(sector text, module_key text)
returns boolean
language sql
immutable
set search_path = public
as $$
  select case coalesce(sector, 'grocery')
    when 'grocery' then module_key not in ('banking', 'ac_jobs', 'vehicles')
    when 'ac_hvac' then module_key <> 'vehicles'
    when 'car_sales' then module_key <> 'ac_jobs'
    else true
  end;
$$;

create or replace function public.org_has_addon(org_id uuid, addon_name text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.subscription_addons sa
    join public.subscriptions s on s.id = sa.subscription_id
    where s.organization_id = org_id
      and sa.addon::text = addon_name
  );
$$;

create or replace function public.org_can_write(org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.subscriptions s
    where s.organization_id = org_id
      and s.status in ('trialing', 'active')
  );
$$;

create or replace function public.org_has_module(org_id uuid, module_key text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  plan_features jsonb;
  sector text;
  plan_flag boolean;
  effective boolean;
begin
  if not public.org_can_write(org_id) then
    return false;
  end if;

  select p.features, o.sector
  into plan_features, sector
  from public.subscriptions s
  join public.plans p on p.id = s.plan_id
  join public.organizations o on o.id = s.organization_id
  where s.organization_id = org_id;

  if plan_features is null then
    return false;
  end if;

  if not public.sector_allows_module(sector, module_key) then
    return false;
  end if;

  plan_flag := coalesce((plan_features ->> module_key)::boolean, false);

  if module_key = 'ac_jobs' then
    effective := plan_flag
      or public.org_has_addon(org_id, 'ac_jobs')
      or public.org_has_addon(org_id, 'sector_pack');
  elsif module_key = 'vehicles' then
    effective := plan_flag
      or public.org_has_addon(org_id, 'vehicles')
      or public.org_has_addon(org_id, 'sector_pack');
  else
    effective := plan_flag;
  end if;

  return effective;
end;
$$;

create or replace function public.org_can_add_product(org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case
    when not public.org_has_module(org_id, 'stock') then false
    when p.max_products is null then true
    else (
      select count(*)::int
      from public.products pr
      where pr.organization_id = org_id
    ) < p.max_products
  end
  from public.subscriptions s
  join public.plans p on p.id = s.plan_id
  where s.organization_id = org_id;
$$;

create or replace function public.org_member_can_write_module(org_id uuid, module_key text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_org_member(org_id)
    and public.org_has_module(org_id, module_key);
$$;

create or replace function public.org_member_can_write(org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_org_member(org_id)
    and public.org_can_write(org_id);
$$;

-- Tighten org settings updates for suspended shops
drop policy if exists "orgs_update_owner" on public.organizations;
create policy "orgs_update_owner"
  on public.organizations for update to authenticated
  using (
    public.is_org_member(id)
    and public.org_can_write(id)
    and exists (
      select 1 from public.org_members m
      where m.organization_id = organizations.id
        and m.user_id = auth.uid()
        and m.role = 'owner'
    )
  )
  with check (
    public.is_org_member(id)
    and public.org_can_write(id)
    and exists (
      select 1 from public.org_members m
      where m.organization_id = organizations.id
        and m.user_id = auth.uid()
        and m.role = 'owner'
    )
  );

-- Business tables: SELECT = member; writes = member + active subscription + module
do $$
declare
  rec record;
begin
  for rec in
    select *
    from (
      values
        ('products', 'stock'),
        ('stock_logs', 'stock'),
        ('sales', 'sales'),
        ('sale_lines', 'sales'),
        ('customers', 'customers'),
        ('customer_payments', 'customers'),
        ('suppliers', 'suppliers'),
        ('purchases', 'suppliers'),
        ('purchase_lines', 'suppliers'),
        ('supplier_payments', 'suppliers'),
        ('bank_accounts', 'banking'),
        ('cheques', 'banking'),
        ('ac_jobs', 'ac_jobs'),
        ('vehicles', 'vehicles')
    ) as t(table_name, module_key)
  loop
    execute format(
      'drop policy if exists %I on public.%I',
      rec.table_name || '_insert_member',
      rec.table_name
    );
    execute format(
      'drop policy if exists %I on public.%I',
      rec.table_name || '_update_member',
      rec.table_name
    );
    execute format(
      'drop policy if exists %I on public.%I',
      rec.table_name || '_delete_member',
      rec.table_name
    );

    if rec.table_name = 'products' then
      execute format(
        'create policy %I on public.%I for insert to authenticated with check (
          public.org_member_can_write_module(organization_id, %L)
          and public.org_can_add_product(organization_id)
        )',
        rec.table_name || '_insert_member',
        rec.table_name,
        rec.module_key
      );
    else
      execute format(
        'create policy %I on public.%I for insert to authenticated with check (
          public.org_member_can_write_module(organization_id, %L)
        )',
        rec.table_name || '_insert_member',
        rec.table_name,
        rec.module_key
      );
    end if;

    execute format(
      'create policy %I on public.%I for update to authenticated
        using (public.org_member_can_write_module(organization_id, %L))
        with check (public.org_member_can_write_module(organization_id, %L))',
      rec.table_name || '_update_member',
      rec.table_name,
      rec.module_key,
      rec.module_key
    );

    execute format(
      'create policy %I on public.%I for delete to authenticated using (
        public.org_member_can_write_module(organization_id, %L)
      )',
      rec.table_name || '_delete_member',
      rec.table_name,
      rec.module_key
    );
  end loop;
end $$;

-- Notification log: active subscription required, no module gate
drop policy if exists "notification_log_insert_member" on public.notification_log;
create policy "notification_log_insert_member"
  on public.notification_log for insert to authenticated
  with check (public.org_member_can_write(organization_id));

drop policy if exists "notification_log_update_member" on public.notification_log;
create policy "notification_log_update_member"
  on public.notification_log for update to authenticated
  using (public.org_member_can_write(organization_id))
  with check (public.org_member_can_write(organization_id));

drop policy if exists "notification_log_delete_member" on public.notification_log;
create policy "notification_log_delete_member"
  on public.notification_log for delete to authenticated
  using (public.org_member_can_write(organization_id));
