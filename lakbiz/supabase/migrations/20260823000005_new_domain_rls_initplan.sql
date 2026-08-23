-- LakBiz performance hardening for new-domain RLS reads.
--
-- Supabase/Postgres can evaluate auth.uid() once per statement when it is
-- wrapped in a scalar SELECT. Preserve the exact tenant-membership semantics of
-- the August inventory/return/tender SELECT policies while avoiding per-row
-- auth function re-evaluation at scale.

-- Advanced inventory operational reads.
drop policy if exists product_inventory_profiles_select_org on public.product_inventory_profiles;
create policy product_inventory_profiles_select_org on public.product_inventory_profiles
for select to authenticated using (
  organization_id in (
    select organization_id from public.org_members
    where user_id = (select auth.uid())
  )
);

drop policy if exists product_variants_select_org on public.product_variants;
create policy product_variants_select_org on public.product_variants
for select to authenticated using (
  organization_id in (
    select organization_id from public.org_members
    where user_id = (select auth.uid())
  )
);

drop policy if exists inventory_lots_select_org on public.inventory_lots;
create policy inventory_lots_select_org on public.inventory_lots
for select to authenticated using (
  organization_id in (
    select organization_id from public.org_members
    where user_id = (select auth.uid())
  )
);

drop policy if exists inventory_units_select_org on public.inventory_units;
create policy inventory_units_select_org on public.inventory_units
for select to authenticated using (
  organization_id in (
    select organization_id from public.org_members
    where user_id = (select auth.uid())
  )
);

drop policy if exists inventory_allocations_select_org on public.inventory_allocations;
create policy inventory_allocations_select_org on public.inventory_allocations
for select to authenticated using (
  organization_id in (
    select organization_id from public.org_members
    where user_id = (select auth.uid())
  )
);

-- Return / credit-note operational reads.
drop policy if exists sale_returns_select_org on public.sale_returns;
create policy sale_returns_select_org on public.sale_returns
for select to authenticated using (
  organization_id in (
    select organization_id from public.org_members
    where user_id = (select auth.uid())
  )
);

drop policy if exists sale_return_lines_select_org on public.sale_return_lines;
create policy sale_return_lines_select_org on public.sale_return_lines
for select to authenticated using (
  organization_id in (
    select organization_id from public.org_members
    where user_id = (select auth.uid())
  )
);

drop policy if exists inventory_return_holds_select_org on public.inventory_return_holds;
create policy inventory_return_holds_select_org on public.inventory_return_holds
for select to authenticated using (
  organization_id in (
    select organization_id from public.org_members
    where user_id = (select auth.uid())
  )
);

drop policy if exists sale_credit_notes_select_org on public.sale_credit_notes;
create policy sale_credit_notes_select_org on public.sale_credit_notes
for select to authenticated using (
  organization_id in (
    select organization_id from public.org_members
    where user_id = (select auth.uid())
  )
);

-- Customer-facing tender breakdown reads.
drop policy if exists sale_tenders_select_org on public.sale_tenders;
create policy sale_tenders_select_org on public.sale_tenders
for select to authenticated using (
  organization_id in (
    select organization_id from public.org_members
    where user_id = (select auth.uid())
  )
);
