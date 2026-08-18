-- LakBiz Phase 19: role-aware SELECT enforcement (read side of the audit).
--
-- The write side (20250712000001/20250712000002) closed role-blind
-- INSERT/UPDATE/DELETE. SELECT policies on these tables were still
-- member-only (any role belonging to the org can read all rows), even
-- though the app's own documented permission matrix
-- (src/lib/org-role/permissions.ts) says:
--   - technician: no access to Stock/Sales/Customers at all (not just
--     masked columns — the whole module)
--   - cashier: no access to AC assets or the workforce/crews module
--   - data_entry: no access to the workforce/crews module
--
-- Verified safe before writing this (not assumed) by checking every
-- technician/data_entry/cashier-reachable page's actual data usage:
--   - The job_items "add a stock part" picker — technician's real,
--     sanctioned workflow — reads `products` (not customers/sales/
--     stock_logs), and a job's customer info is already denormalized
--     onto ac_jobs_base itself (customer_id/customer_name/phone/address
--     columns), so technician never needs the standalone `customers`
--     table.
--   - The only UI that reads `customers` directly (the New/Edit job
--     form's customer picker) is gated behind canOperateAcJobs, which
--     already excludes technician — unreachable for that role regardless
--     of this migration.
--   - No technician/data_entry/cashier-reachable page references
--     data.sales, data.saleLines, data.customerPayments,
--     data.customerProductPrices, data.stockLogs, or data.crews at all.
--   - `products` is deliberately NOT restricted here: technician
--     genuinely needs to read it for that same "add stock part" picker.
--     buy_price stays correctly masked at the column level via
--     can_see_org_financials, which is the right control for this
--     table, not a SELECT block.
--
-- Uses the org_member_role_in helper from 20250712000001.

-- Plain tables (no view layer — their own RLS policy is the real
-- enforcement point).

drop policy if exists "customers_select_member" on public.customers;
create policy "customers_select_member" on public.customers for select to authenticated using (
  (organization_id in (select m.organization_id from public.org_members m where m.user_id = auth.uid()))
  and public.org_member_role_in(organization_id, array['owner','manager','data_entry','cashier'])
);

drop policy if exists "customer_payments_select_member" on public.customer_payments;
create policy "customer_payments_select_member" on public.customer_payments for select to authenticated using (
  (organization_id in (select m.organization_id from public.org_members m where m.user_id = auth.uid()))
  and public.org_member_role_in(organization_id, array['owner','manager','data_entry','cashier'])
);

drop policy if exists "customer_product_prices_select_member" on public.customer_product_prices;
create policy "customer_product_prices_select_member" on public.customer_product_prices for select to authenticated using (
  (organization_id in (select m.organization_id from public.org_members m where m.user_id = auth.uid()))
  and public.org_member_role_in(organization_id, array['owner','manager','data_entry','cashier'])
);

drop policy if exists "stock_logs_select_member" on public.stock_logs;
create policy "stock_logs_select_member" on public.stock_logs for select to authenticated using (
  (organization_id in (select m.organization_id from public.org_members m where m.user_id = auth.uid()))
  and public.org_member_role_in(organization_id, array['owner','manager','data_entry','cashier'])
);

drop policy if exists "ac_assets_select_member" on public.ac_assets;
create policy "ac_assets_select_member" on public.ac_assets for select to authenticated using (
  (organization_id in (select org_members.organization_id from public.org_members where org_members.user_id = auth.uid()))
  and public.org_member_role_in(organization_id, array['owner','manager','data_entry','technician'])
);

drop policy if exists "crews_select_member" on public.crews;
create policy "crews_select_member" on public.crews for select to authenticated using (
  (organization_id in (select org_members.organization_id from public.org_members where org_members.user_id = auth.uid()))
  and public.org_member_role_in(organization_id, array['owner','manager','technician'])
);

-- sales_base/sale_lines_base are masked-view base tables with SELECT
-- already revoked from `authenticated` (20250628000003) — the app only
-- ever reads them through the `sales`/`sale_lines` VIEWS, which run
-- security_invoker=false (view owner's privileges, bypassing the base
-- table's RLS entirely) with their own hardcoded tenant WHERE clause.
-- An RLS-policy-only fix on the base tables would therefore be
-- unreachable dead code for the real read path — the actual enforcement
-- point is each view's own WHERE clause, fixed here directly.

create or replace view public.sales as
select id, organization_id, bill_no, sale_date, subtotal, output_vat, discount, total,
  case when can_see_org_financials(organization_id) then profit else 0::numeric(14,2) end as profit,
  payment_method, customer_id, customer_name, credit_amount, cheque_id, created_at
from public.sales_base s
where organization_id in (select organization_id from public.org_members where user_id = auth.uid())
  and public.org_member_role_in(organization_id, array['owner','manager','data_entry','cashier']);

alter view public.sales set (security_invoker = false);

create or replace view public.sale_lines as
select id, sale_id, organization_id, product_id, product_name, qty, unit_price,
  case when can_see_org_financials(organization_id) then buy_price else 0::numeric(14,2) end as buy_price,
  line_order
from public.sale_lines_base l
where organization_id in (select organization_id from public.org_members where user_id = auth.uid())
  and public.org_member_role_in(organization_id, array['owner','manager','data_entry','cashier']);

alter view public.sale_lines set (security_invoker = false);
