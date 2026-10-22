-- LakBiz advanced inventory — immutable allocation audit.
--
-- inventory_allocations is the historical answer to "which batch/IMEI/variant
-- fulfilled this sale/job/return?". Normal staff must be able to READ that
-- traceability, but they must not be able to rewrite or delete history with a
-- direct REST call. Trusted SECURITY DEFINER workflow RPCs append records.

-- Remove the broad stock-role write policies created with the initial additive
-- schema. SELECT remains organization-scoped.
drop policy if exists inventory_allocations_insert_stock_roles on public.inventory_allocations;
drop policy if exists inventory_allocations_update_stock_roles on public.inventory_allocations;
drop policy if exists inventory_allocations_delete_stock_roles on public.inventory_allocations;

-- Direct authenticated clients get read-only access. SECURITY DEFINER functions
-- such as allocate_sale_inventory() execute with the function owner's rights and
-- can still append the audit record transactionally.
revoke insert, update, delete on public.inventory_allocations from authenticated;
grant select on public.inventory_allocations to authenticated;

-- Defense in depth: RLS remains enabled and only the existing org-scoped SELECT
-- policy is expected to remain.
alter table public.inventory_allocations enable row level security;

comment on table public.inventory_allocations is
  'Immutable identity-allocation audit. Org members may read their traceability history; only trusted workflow functions append records. Direct client INSERT/UPDATE/DELETE is revoked.';
