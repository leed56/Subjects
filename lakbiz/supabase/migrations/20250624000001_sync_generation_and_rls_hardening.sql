-- Optimistic multi-device sync generation + close remaining subscription RLS gaps.

-- ─── Sync generation (optimistic concurrency) ────────────────────────────────
alter table public.organizations
  add column if not exists sync_generation bigint not null default 0;

comment on column public.organizations.sync_generation is
  'Incremented after each successful cloud push; clients compare before overwriting remote data.';

create or replace function public.get_org_sync_generation(p_org_id uuid)
returns bigint
language sql
stable
security definer
set search_path = public
as $$
  select o.sync_generation
  from public.organizations o
  where o.id = p_org_id
    and o.id in (
      select m.organization_id
      from public.org_members m
      where m.user_id = auth.uid()
    );
$$;

create or replace function public.try_advance_org_sync_generation(
  p_org_id uuid,
  p_seen_generation bigint
)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_next bigint;
begin
  if not public.org_member_can_write(p_org_id) then
    raise exception 'subscription read-only';
  end if;

  update public.organizations
  set sync_generation = sync_generation + 1
  where id = p_org_id
    and sync_generation = p_seen_generation
  returning sync_generation into v_next;

  if found then
    return v_next;
  end if;

  select sync_generation into v_next
  from public.organizations
  where id = p_org_id;

  return -1;
end;
$$;

revoke all on function public.get_org_sync_generation(uuid) from public;
revoke all on function public.try_advance_org_sync_generation(uuid, bigint) from public;
grant execute on function public.get_org_sync_generation(uuid) to authenticated;
grant execute on function public.try_advance_org_sync_generation(uuid, bigint) to authenticated;

-- ─── Subscription table writes: platform/service role only ───────────────────
revoke insert, update, delete on public.subscriptions from authenticated;
revoke insert, update, delete on public.subscription_addons from authenticated;

-- Team invites only while subscription allows writes
drop policy if exists "org_members_insert_by_owner" on public.org_members;
create policy "org_members_insert_by_owner"
  on public.org_members for insert to authenticated
  with check (
    public.is_org_owner(organization_id)
    and public.org_can_write(organization_id)
    and role in ('data_entry', 'cashier', 'technician', 'manager')
    and user_id <> auth.uid()
  );

-- ─── Masked base tables: explicit subscription write policies ────────────────
do $$
declare
  rec record;
begin
  for rec in
    select *
    from (
      values
        ('products_base', 'products', 'stock'),
        ('sales_base', 'sales', 'sales'),
        ('sale_lines_base', 'sale_lines', 'sales')
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

    if rec.table_name = 'products_base' then
      execute format(
        'create policy %I on public.%I for insert to authenticated with check (
          public.org_member_can_write_module(organization_id, %L)
          and public.org_can_add_product(organization_id)
        )',
        rec.policy_prefix || '_insert_member',
        rec.table_name,
        rec.module_key
      );
    else
      execute format(
        'create policy %I on public.%I for insert to authenticated with check (
          public.org_member_can_write_module(organization_id, %L)
        )',
        rec.policy_prefix || '_insert_member',
        rec.table_name,
        rec.module_key
      );
    end if;

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

-- Masked views inherit base-table RLS via security_invoker triggers; block direct
-- authenticated SELECT on *_base (writes stay on base for upsert compatibility).
revoke select on public.products_base from authenticated, anon;
revoke select on public.sales_base from authenticated, anon;
revoke select on public.sale_lines_base from authenticated, anon;
