-- Phase F: data_entry org role for shop staff (stock/sales without financial visibility).
--
-- RLS follow-up (not in this migration): column-level hide of buy_price on products/purchases
-- for non-owner/manager roles via security-barrier views or server-side selects.

alter type public.org_role add value if not exists 'data_entry';

-- Owners may add team members to their org (invite flow uses service role for auth.users;
-- this policy allows owner to insert org_members rows when API uses user session + RPC).
create or replace function public.is_org_owner(org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.org_members m
    where m.organization_id = org_id
      and m.user_id = auth.uid()
      and m.role = 'owner'
  );
$$;

revoke all on function public.is_org_owner(uuid) from public;
grant execute on function public.is_org_owner(uuid) to authenticated;

drop policy if exists "org_members_insert_by_owner" on public.org_members;
create policy "org_members_insert_by_owner"
  on public.org_members for insert to authenticated
  with check (
    public.is_org_owner(organization_id)
    and role in ('data_entry', 'cashier', 'technician', 'manager')
    and user_id <> auth.uid()
  );

comment on type public.org_role is
  'Shop roles: owner (full), manager (financials), data_entry (stock/sales, no buy/profit), cashier, technician';
