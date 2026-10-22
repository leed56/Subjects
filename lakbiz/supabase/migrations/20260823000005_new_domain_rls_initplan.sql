-- LakBiz performance hardening for new-domain RLS reads.
--
-- Supabase/Postgres can evaluate auth.uid() once per statement when it is
-- wrapped in a scalar SELECT. Preserve the exact tenant-membership semantics of
-- the August inventory/return/tender SELECT policies while avoiding per-row
-- auth function re-evaluation at scale.
--
-- ALTER POLICY is used rather than drop/recreate so the policy identity and
-- role/command shape remain unchanged throughout the migration.

alter policy product_inventory_profiles_select_org
  on public.product_inventory_profiles
  using (
    organization_id in (
      select organization_id from public.org_members
      where user_id = (select auth.uid())
    )
  );

alter policy product_variants_select_org
  on public.product_variants
  using (
    organization_id in (
      select organization_id from public.org_members
      where user_id = (select auth.uid())
    )
  );

alter policy inventory_lots_select_org
  on public.inventory_lots
  using (
    organization_id in (
      select organization_id from public.org_members
      where user_id = (select auth.uid())
    )
  );

alter policy inventory_units_select_org
  on public.inventory_units
  using (
    organization_id in (
      select organization_id from public.org_members
      where user_id = (select auth.uid())
    )
  );

alter policy inventory_allocations_select_org
  on public.inventory_allocations
  using (
    organization_id in (
      select organization_id from public.org_members
      where user_id = (select auth.uid())
    )
  );

alter policy sale_returns_select_org
  on public.sale_returns
  using (
    organization_id in (
      select organization_id from public.org_members
      where user_id = (select auth.uid())
    )
  );

alter policy sale_return_lines_select_org
  on public.sale_return_lines
  using (
    organization_id in (
      select organization_id from public.org_members
      where user_id = (select auth.uid())
    )
  );

alter policy inventory_return_holds_select_org
  on public.inventory_return_holds
  using (
    organization_id in (
      select organization_id from public.org_members
      where user_id = (select auth.uid())
    )
  );

alter policy sale_credit_notes_select_org
  on public.sale_credit_notes
  using (
    organization_id in (
      select organization_id from public.org_members
      where user_id = (select auth.uid())
    )
  );

alter policy sale_tenders_select_org
  on public.sale_tenders
  using (
    organization_id in (
      select organization_id from public.org_members
      where user_id = (select auth.uid())
    )
  );
