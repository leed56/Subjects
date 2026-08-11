-- Corrects a regression introduced by the previous migration in this same
-- fix (20250628000002_fix_masked_view_cross_tenant_leak.sql).
--
-- That migration closed the cross-tenant row leak by granting SELECT on
-- the *_base tables to `authenticated` and flipping the views to
-- security_invoker=true. It worked for the cross-tenant case, but the base
-- table grant let ANY authenticated client bypass the views' column
-- masking entirely by querying e.g. `products_base` directly instead of
-- `products` — the RLS on the base tables only checks organization
-- membership, not the owner/manager financial-visibility check the view's
-- CASE expressions enforce. That would have exposed buy_price, profit,
-- subcontract_cost, contractor rates, and vehicle costs to
-- cashier/technician/data_entry roles. Flagged by review on PR #27 before
-- it merged — not something that shipped to production.
--
-- (This is also why 20250623000003_fix_financial_view_security.sql
-- deliberately revoked direct SELECT on these base tables in the first
-- place — this migration restores that property.)
--
-- Correct fix: revoke the base-table grants again, revert the views to
-- security_invoker=false, and instead add the missing tenant filter
-- directly inside each view's own WHERE clause — the same membership
-- check the RLS policies use, evaluated by the view itself since it
-- (deliberately) runs as its owner and never touches the base tables
-- through any other path.
--
-- Verified after applying: cross-tenant reads through all six views
-- return 0 rows for a non-member org (same empirical test that found the
-- original leak); direct queries against the *_base tables now correctly
-- fail with "permission denied" again; the legitimate org owner's own data
-- is still visible with real financial values.
--
-- Note: Supabase's security-advisor linter will continue to report these
-- six views as "Security Definer View" — that check is a blanket
-- "security_invoker=false" heuristic and doesn't know the view has its own
-- correct row filter. That's expected here, not a leftover bug; the
-- empirical tests above are the actual verification.

revoke select on public.sales_base from authenticated;
revoke select on public.sale_lines_base from authenticated;
revoke select on public.products_base from authenticated;
revoke select on public.ac_jobs_base from authenticated;
revoke select on public.contractors_base from authenticated;
revoke select on public.vehicles_base from authenticated;

create or replace view public.ac_jobs as
select id, organization_id, job_no, job_date, customer_id, customer_name, phone, address,
  brand, btu, unit_type, unit_count, description, quoted_amount, deposit_amount, pipe_meters,
  status, scheduled_date, installed_date, notes, created_at, updated_at, service_due_date,
  last_service_date, service_interval_months, amc_contract, job_type, assigned_technician,
  service_due_manual, service_interval_days, assignee_type, assignee_id,
  case when can_see_org_financials(organization_id) then subcontract_cost else null::numeric end as subcontract_cost
from public.ac_jobs_base j
where organization_id in (select organization_id from public.org_members where user_id = auth.uid());

create or replace view public.contractors as
select id, organization_id, name, company, phone, specialties, rate_type,
  case when can_see_org_financials(organization_id) then rate_amount else 0::numeric end as rate_amount,
  case when can_see_org_financials(organization_id) then payable_balance else 0::numeric end as payable_balance,
  active, notes, created_at, updated_at
from public.contractors_base c
where organization_id in (select organization_id from public.org_members where user_id = auth.uid());

create or replace view public.products as
select id, organization_id, name, sku, category, sector_id, condition,
  case when can_see_org_financials(organization_id) then buy_price else 0::numeric(14,2) end as buy_price,
  sell_price, stock_qty, reorder_level, unit, custom_fields, created_at, updated_at
from public.products_base p
where organization_id in (select organization_id from public.org_members where user_id = auth.uid());

create or replace view public.sale_lines as
select id, sale_id, organization_id, product_id, product_name, qty, unit_price,
  case when can_see_org_financials(organization_id) then buy_price else 0::numeric(14,2) end as buy_price,
  line_order
from public.sale_lines_base l
where organization_id in (select organization_id from public.org_members where user_id = auth.uid());

create or replace view public.sales as
select id, organization_id, bill_no, sale_date, subtotal, output_vat, discount, total,
  case when can_see_org_financials(organization_id) then profit else 0::numeric(14,2) end as profit,
  payment_method, customer_id, customer_name, credit_amount, cheque_id, created_at
from public.sales_base s
where organization_id in (select organization_id from public.org_members where user_id = auth.uid());

create or replace view public.vehicles as
select id, organization_id, stock_id, date_added, make, model, year, chassis_no, engine_no, reg_no,
  color, fuel, transmission, mileage_km, condition,
  case when can_see_org_financials(organization_id) then purchase_price else 0::numeric end as purchase_price,
  case when can_see_org_financials(organization_id) then recondition_cost else 0::numeric end as recondition_cost,
  ask_price,
  case when can_see_org_financials(organization_id) then min_price else null::numeric end as min_price,
  status, customer_id, customer_name, sold_price, sold_date, finance_partner, payment_method, notes,
  created_at, updated_at
from public.vehicles_base v
where organization_id in (select organization_id from public.org_members where user_id = auth.uid());

alter view public.ac_jobs set (security_invoker = false);
alter view public.contractors set (security_invoker = false);
alter view public.products set (security_invoker = false);
alter view public.sale_lines set (security_invoker = false);
alter view public.sales set (security_invoker = false);
alter view public.vehicles set (security_invoker = false);
