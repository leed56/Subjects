-- LakBiz Phase 19: role-aware write enforcement (audit finding).
--
-- Two real gaps found by directly inspecting the live database rather
-- than trusting prior write-ups (the same method that caught the
-- contractors-masking mistake and the technicians/job_items upsert bug
-- earlier this engagement):
--
-- 1. CRITICAL — masking bypass. `technicians_base`/`job_items_base`
--    never got the `revoke select ... from authenticated` that the other
--    six masked-view base tables got in
--    20250628000002_fix_masked_view_cross_tenant_leak.sql /
--    20250628000003_fix_masked_view_grant_regression.sql (sales_base,
--    sale_lines_base, products_base, ac_jobs_base, contractors_base,
--    vehicles_base). Both tables predate that fix's original scope
--    (added by 20250706000001_labor_costing.sql, written after) and were
--    simply missed. Any authenticated org member — including a
--    technician — could query `technicians_base`/`job_items_base`
--    directly and read real hourly_rate/unit_price/line_total/
--    customer_price, completely bypassing the `technicians`/`job_items`
--    masked views' column-level hiding. This is exactly the "expose
--    company profit to unauthorized technicians" case the spec's
--    absolute rules forbid.
--
-- 2. Role-blind writes. `org_member_can_write_module(org_id, module_key)`
--    (used by every write RLS policy across the app's business tables,
--    and inline inside every masked-view INSTEAD OF trigger function)
--    only checks (a) org membership and (b) whether the org's
--    subscription plan has that module enabled. It never checks the
--    calling member's ROLE. The app's own documented permission matrix
--    (src/lib/org-role/permissions.ts) says a cashier must never touch
--    Suppliers/Banking and a technician must never touch Stock/Sales/
--    Customers — but that was only ever enforced by hiding UI and by
--    Next.js middleware redirecting page navigation. A direct
--    authenticated REST call (e.g. from browser devtools, using a real
--    staff member's own valid session) was never blocked by the
--    database itself for 22 tables: products, stock_logs, sales,
--    sale_lines, customers, customer_payments, customer_product_prices,
--    suppliers, purchases, purchase_lines, supplier_payments,
--    bank_accounts, bank_transactions, bank_transfers, cheques,
--    vehicles, ac_jobs, job_status_history, job_items, technicians,
--    contractors, contractor_payments.
--
-- Fix: a new `org_member_role_in(org_id, roles)` helper, ANDed into
-- every one of those 22 tables' insert/update/delete RLS policies AND
-- into all 8 masked-view tables' INSTEAD OF trigger functions (the
-- trigger functions are SECURITY DEFINER, which bypasses the base
-- table's own RLS entirely — fixing only the table policies would leave
-- the view-write path, i.e. the path the app actually uses, unprotected).
-- Role sets below mirror the app's own existing permission functions
-- (canOperateAcJobs/canUpdateAcJob, canUseSuppliersModule,
-- canUseBankingModule) as closely as possible — this is the database
-- enforcing intent the app already codes and documents, not new policy.
--
-- Deliberately NOT attempted here (would need its own careful design,
-- flagged as a disclosed follow-up rather than silently left): write-time
-- value masking on INSERT for job_items (UPDATE already correctly clamps
-- unit_price/line_total/customer_price to the existing value for a
-- non-financial role via `case when can_see_org_financials(...)`; INSERT
-- has no equivalent clamp yet).

-- ===== Part 1: close the masking-bypass grant gap =====

revoke select on public.technicians_base from authenticated;
revoke select on public.job_items_base from authenticated;

-- ===== Part 2: role-check helper =====

create or replace function public.org_member_role_in(org_id uuid, roles text[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.org_members m
    where m.organization_id = org_id
      and m.user_id = auth.uid()
      and m.role::text = any(roles)
  );
$$;

comment on function public.org_member_role_in(uuid, text[]) is
  'True when the calling user is a member of org_id with a role in the given list. Used alongside org_member_can_write_module (module/plan check only, role-blind) to enforce the actual per-role write matrix documented in src/lib/org-role/permissions.ts at the database layer, not just client-side.';

revoke all on function public.org_member_role_in(uuid, text[]) from public, anon;
grant execute on function public.org_member_role_in(uuid, text[]) to authenticated;

-- ===== Part 3: role-aware write policies (22 tables) =====
-- Shop staff (owner/manager/data_entry/cashier): stock, sales, customers.
-- Owner/manager only: suppliers, banking, vehicles, workforce roster
-- (technicians/contractors/contractor_payments — "no financial fields"
-- per the matrix, and their own job-hours logging goes through job_items,
-- not this roster table, so this doesn't block any real technician
-- workflow). Owner/manager/data_entry: ac_jobs itself + its status
-- history (matches canOperateAcJobs — technician is deliberately not
-- included; canUpdateAcJob returns false for every field for that role).
-- Owner/manager/data_entry/technician: job_items only (the one table
-- Phase 6 explicitly built for technicians to log their own labour/parts).

-- products_base (module=stock, roles=[owner, manager, data_entry, cashier])
drop policy if exists "products_insert_member" on public.products_base;
create policy "products_insert_member" on public.products_base for insert to authenticated with check (
  (public.org_member_can_write_module(organization_id, 'stock') and public.org_member_role_in(organization_id, array['owner','manager','data_entry','cashier']) and org_can_add_product(organization_id))
);
drop policy if exists "products_update_member" on public.products_base;
create policy "products_update_member" on public.products_base for update to authenticated
  using ((public.org_member_can_write_module(organization_id, 'stock') and public.org_member_role_in(organization_id, array['owner','manager','data_entry','cashier'])))
  with check ((public.org_member_can_write_module(organization_id, 'stock') and public.org_member_role_in(organization_id, array['owner','manager','data_entry','cashier'])));
drop policy if exists "products_delete_member" on public.products_base;
create policy "products_delete_member" on public.products_base for delete to authenticated using (
  (public.org_member_can_write_module(organization_id, 'stock') and public.org_member_role_in(organization_id, array['owner','manager','data_entry','cashier']))
);

-- stock_logs (module=stock, roles=[owner, manager, data_entry, cashier])
drop policy if exists "stock_logs_insert_member" on public.stock_logs;
create policy "stock_logs_insert_member" on public.stock_logs for insert to authenticated with check (
  (public.org_member_can_write_module(organization_id, 'stock') and public.org_member_role_in(organization_id, array['owner','manager','data_entry','cashier']))
);
drop policy if exists "stock_logs_update_member" on public.stock_logs;
create policy "stock_logs_update_member" on public.stock_logs for update to authenticated
  using ((public.org_member_can_write_module(organization_id, 'stock') and public.org_member_role_in(organization_id, array['owner','manager','data_entry','cashier'])))
  with check ((public.org_member_can_write_module(organization_id, 'stock') and public.org_member_role_in(organization_id, array['owner','manager','data_entry','cashier'])));
drop policy if exists "stock_logs_delete_member" on public.stock_logs;
create policy "stock_logs_delete_member" on public.stock_logs for delete to authenticated using (
  (public.org_member_can_write_module(organization_id, 'stock') and public.org_member_role_in(organization_id, array['owner','manager','data_entry','cashier']))
);

-- sales_base (module=sales, roles=[owner, manager, data_entry, cashier])
drop policy if exists "sales_insert_member" on public.sales_base;
create policy "sales_insert_member" on public.sales_base for insert to authenticated with check (
  (public.org_member_can_write_module(organization_id, 'sales') and public.org_member_role_in(organization_id, array['owner','manager','data_entry','cashier']))
);
drop policy if exists "sales_update_member" on public.sales_base;
create policy "sales_update_member" on public.sales_base for update to authenticated
  using ((public.org_member_can_write_module(organization_id, 'sales') and public.org_member_role_in(organization_id, array['owner','manager','data_entry','cashier'])))
  with check ((public.org_member_can_write_module(organization_id, 'sales') and public.org_member_role_in(organization_id, array['owner','manager','data_entry','cashier'])));
drop policy if exists "sales_delete_member" on public.sales_base;
create policy "sales_delete_member" on public.sales_base for delete to authenticated using (
  (public.org_member_can_write_module(organization_id, 'sales') and public.org_member_role_in(organization_id, array['owner','manager','data_entry','cashier']))
);

-- sale_lines_base (module=sales, roles=[owner, manager, data_entry, cashier])
drop policy if exists "sale_lines_insert_member" on public.sale_lines_base;
create policy "sale_lines_insert_member" on public.sale_lines_base for insert to authenticated with check (
  (public.org_member_can_write_module(organization_id, 'sales') and public.org_member_role_in(organization_id, array['owner','manager','data_entry','cashier']))
);
drop policy if exists "sale_lines_update_member" on public.sale_lines_base;
create policy "sale_lines_update_member" on public.sale_lines_base for update to authenticated
  using ((public.org_member_can_write_module(organization_id, 'sales') and public.org_member_role_in(organization_id, array['owner','manager','data_entry','cashier'])))
  with check ((public.org_member_can_write_module(organization_id, 'sales') and public.org_member_role_in(organization_id, array['owner','manager','data_entry','cashier'])));
drop policy if exists "sale_lines_delete_member" on public.sale_lines_base;
create policy "sale_lines_delete_member" on public.sale_lines_base for delete to authenticated using (
  (public.org_member_can_write_module(organization_id, 'sales') and public.org_member_role_in(organization_id, array['owner','manager','data_entry','cashier']))
);

-- customers (module=customers, roles=[owner, manager, data_entry, cashier])
drop policy if exists "customers_insert_member" on public.customers;
create policy "customers_insert_member" on public.customers for insert to authenticated with check (
  (public.org_member_can_write_module(organization_id, 'customers') and public.org_member_role_in(organization_id, array['owner','manager','data_entry','cashier']))
);
drop policy if exists "customers_update_member" on public.customers;
create policy "customers_update_member" on public.customers for update to authenticated
  using ((public.org_member_can_write_module(organization_id, 'customers') and public.org_member_role_in(organization_id, array['owner','manager','data_entry','cashier'])))
  with check ((public.org_member_can_write_module(organization_id, 'customers') and public.org_member_role_in(organization_id, array['owner','manager','data_entry','cashier'])));
drop policy if exists "customers_delete_member" on public.customers;
create policy "customers_delete_member" on public.customers for delete to authenticated using (
  (public.org_member_can_write_module(organization_id, 'customers') and public.org_member_role_in(organization_id, array['owner','manager','data_entry','cashier']))
);

-- customer_payments (module=customers, roles=[owner, manager, data_entry, cashier])
drop policy if exists "customer_payments_insert_member" on public.customer_payments;
create policy "customer_payments_insert_member" on public.customer_payments for insert to authenticated with check (
  (public.org_member_can_write_module(organization_id, 'customers') and public.org_member_role_in(organization_id, array['owner','manager','data_entry','cashier']))
);
drop policy if exists "customer_payments_update_member" on public.customer_payments;
create policy "customer_payments_update_member" on public.customer_payments for update to authenticated
  using ((public.org_member_can_write_module(organization_id, 'customers') and public.org_member_role_in(organization_id, array['owner','manager','data_entry','cashier'])))
  with check ((public.org_member_can_write_module(organization_id, 'customers') and public.org_member_role_in(organization_id, array['owner','manager','data_entry','cashier'])));
drop policy if exists "customer_payments_delete_member" on public.customer_payments;
create policy "customer_payments_delete_member" on public.customer_payments for delete to authenticated using (
  (public.org_member_can_write_module(organization_id, 'customers') and public.org_member_role_in(organization_id, array['owner','manager','data_entry','cashier']))
);

-- customer_product_prices (module=customers, roles=[owner, manager, data_entry, cashier])
drop policy if exists "customer_product_prices_insert_member" on public.customer_product_prices;
create policy "customer_product_prices_insert_member" on public.customer_product_prices for insert to authenticated with check (
  (public.org_member_can_write_module(organization_id, 'customers') and public.org_member_role_in(organization_id, array['owner','manager','data_entry','cashier']))
);
drop policy if exists "customer_product_prices_update_member" on public.customer_product_prices;
create policy "customer_product_prices_update_member" on public.customer_product_prices for update to authenticated
  using ((public.org_member_can_write_module(organization_id, 'customers') and public.org_member_role_in(organization_id, array['owner','manager','data_entry','cashier'])))
  with check ((public.org_member_can_write_module(organization_id, 'customers') and public.org_member_role_in(organization_id, array['owner','manager','data_entry','cashier'])));
drop policy if exists "customer_product_prices_delete_member" on public.customer_product_prices;
create policy "customer_product_prices_delete_member" on public.customer_product_prices for delete to authenticated using (
  (public.org_member_can_write_module(organization_id, 'customers') and public.org_member_role_in(organization_id, array['owner','manager','data_entry','cashier']))
);

-- suppliers (module=suppliers, roles=[owner, manager])
drop policy if exists "suppliers_insert_member" on public.suppliers;
create policy "suppliers_insert_member" on public.suppliers for insert to authenticated with check (
  (public.org_member_can_write_module(organization_id, 'suppliers') and public.org_member_role_in(organization_id, array['owner','manager']))
);
drop policy if exists "suppliers_update_member" on public.suppliers;
create policy "suppliers_update_member" on public.suppliers for update to authenticated
  using ((public.org_member_can_write_module(organization_id, 'suppliers') and public.org_member_role_in(organization_id, array['owner','manager'])))
  with check ((public.org_member_can_write_module(organization_id, 'suppliers') and public.org_member_role_in(organization_id, array['owner','manager'])));
drop policy if exists "suppliers_delete_member" on public.suppliers;
create policy "suppliers_delete_member" on public.suppliers for delete to authenticated using (
  (public.org_member_can_write_module(organization_id, 'suppliers') and public.org_member_role_in(organization_id, array['owner','manager']))
);

-- purchases (module=suppliers, roles=[owner, manager])
drop policy if exists "purchases_insert_member" on public.purchases;
create policy "purchases_insert_member" on public.purchases for insert to authenticated with check (
  (public.org_member_can_write_module(organization_id, 'suppliers') and public.org_member_role_in(organization_id, array['owner','manager']))
);
drop policy if exists "purchases_update_member" on public.purchases;
create policy "purchases_update_member" on public.purchases for update to authenticated
  using ((public.org_member_can_write_module(organization_id, 'suppliers') and public.org_member_role_in(organization_id, array['owner','manager'])))
  with check ((public.org_member_can_write_module(organization_id, 'suppliers') and public.org_member_role_in(organization_id, array['owner','manager'])));
drop policy if exists "purchases_delete_member" on public.purchases;
create policy "purchases_delete_member" on public.purchases for delete to authenticated using (
  (public.org_member_can_write_module(organization_id, 'suppliers') and public.org_member_role_in(organization_id, array['owner','manager']))
);

-- purchase_lines (module=suppliers, roles=[owner, manager])
drop policy if exists "purchase_lines_insert_member" on public.purchase_lines;
create policy "purchase_lines_insert_member" on public.purchase_lines for insert to authenticated with check (
  (public.org_member_can_write_module(organization_id, 'suppliers') and public.org_member_role_in(organization_id, array['owner','manager']))
);
drop policy if exists "purchase_lines_update_member" on public.purchase_lines;
create policy "purchase_lines_update_member" on public.purchase_lines for update to authenticated
  using ((public.org_member_can_write_module(organization_id, 'suppliers') and public.org_member_role_in(organization_id, array['owner','manager'])))
  with check ((public.org_member_can_write_module(organization_id, 'suppliers') and public.org_member_role_in(organization_id, array['owner','manager'])));
drop policy if exists "purchase_lines_delete_member" on public.purchase_lines;
create policy "purchase_lines_delete_member" on public.purchase_lines for delete to authenticated using (
  (public.org_member_can_write_module(organization_id, 'suppliers') and public.org_member_role_in(organization_id, array['owner','manager']))
);

-- supplier_payments (module=suppliers, roles=[owner, manager])
drop policy if exists "supplier_payments_insert_member" on public.supplier_payments;
create policy "supplier_payments_insert_member" on public.supplier_payments for insert to authenticated with check (
  (public.org_member_can_write_module(organization_id, 'suppliers') and public.org_member_role_in(organization_id, array['owner','manager']))
);
drop policy if exists "supplier_payments_update_member" on public.supplier_payments;
create policy "supplier_payments_update_member" on public.supplier_payments for update to authenticated
  using ((public.org_member_can_write_module(organization_id, 'suppliers') and public.org_member_role_in(organization_id, array['owner','manager'])))
  with check ((public.org_member_can_write_module(organization_id, 'suppliers') and public.org_member_role_in(organization_id, array['owner','manager'])));
drop policy if exists "supplier_payments_delete_member" on public.supplier_payments;
create policy "supplier_payments_delete_member" on public.supplier_payments for delete to authenticated using (
  (public.org_member_can_write_module(organization_id, 'suppliers') and public.org_member_role_in(organization_id, array['owner','manager']))
);

-- bank_accounts (module=banking, roles=[owner, manager])
drop policy if exists "bank_accounts_insert_member" on public.bank_accounts;
create policy "bank_accounts_insert_member" on public.bank_accounts for insert to authenticated with check (
  (public.org_member_can_write_module(organization_id, 'banking') and public.org_member_role_in(organization_id, array['owner','manager']))
);
drop policy if exists "bank_accounts_update_member" on public.bank_accounts;
create policy "bank_accounts_update_member" on public.bank_accounts for update to authenticated
  using ((public.org_member_can_write_module(organization_id, 'banking') and public.org_member_role_in(organization_id, array['owner','manager'])))
  with check ((public.org_member_can_write_module(organization_id, 'banking') and public.org_member_role_in(organization_id, array['owner','manager'])));
drop policy if exists "bank_accounts_delete_member" on public.bank_accounts;
create policy "bank_accounts_delete_member" on public.bank_accounts for delete to authenticated using (
  (public.org_member_can_write_module(organization_id, 'banking') and public.org_member_role_in(organization_id, array['owner','manager']))
);

-- bank_transactions (module=banking, roles=[owner, manager])
drop policy if exists "bank_transactions_insert_member" on public.bank_transactions;
create policy "bank_transactions_insert_member" on public.bank_transactions for insert to authenticated with check (
  (public.org_member_can_write_module(organization_id, 'banking') and public.org_member_role_in(organization_id, array['owner','manager']))
);
drop policy if exists "bank_transactions_update_member" on public.bank_transactions;
create policy "bank_transactions_update_member" on public.bank_transactions for update to authenticated
  using ((public.org_member_can_write_module(organization_id, 'banking') and public.org_member_role_in(organization_id, array['owner','manager'])))
  with check ((public.org_member_can_write_module(organization_id, 'banking') and public.org_member_role_in(organization_id, array['owner','manager'])));
drop policy if exists "bank_transactions_delete_member" on public.bank_transactions;
create policy "bank_transactions_delete_member" on public.bank_transactions for delete to authenticated using (
  (public.org_member_can_write_module(organization_id, 'banking') and public.org_member_role_in(organization_id, array['owner','manager']))
);

-- bank_transfers (module=banking, roles=[owner, manager])
drop policy if exists "bank_transfers_insert_member" on public.bank_transfers;
create policy "bank_transfers_insert_member" on public.bank_transfers for insert to authenticated with check (
  (public.org_member_can_write_module(organization_id, 'banking') and public.org_member_role_in(organization_id, array['owner','manager']))
);
drop policy if exists "bank_transfers_update_member" on public.bank_transfers;
create policy "bank_transfers_update_member" on public.bank_transfers for update to authenticated
  using ((public.org_member_can_write_module(organization_id, 'banking') and public.org_member_role_in(organization_id, array['owner','manager'])))
  with check ((public.org_member_can_write_module(organization_id, 'banking') and public.org_member_role_in(organization_id, array['owner','manager'])));
drop policy if exists "bank_transfers_delete_member" on public.bank_transfers;
create policy "bank_transfers_delete_member" on public.bank_transfers for delete to authenticated using (
  (public.org_member_can_write_module(organization_id, 'banking') and public.org_member_role_in(organization_id, array['owner','manager']))
);

-- cheques (module=banking, roles=[owner, manager])
drop policy if exists "cheques_insert_member" on public.cheques;
create policy "cheques_insert_member" on public.cheques for insert to authenticated with check (
  (public.org_member_can_write_module(organization_id, 'banking') and public.org_member_role_in(organization_id, array['owner','manager']))
);
drop policy if exists "cheques_update_member" on public.cheques;
create policy "cheques_update_member" on public.cheques for update to authenticated
  using ((public.org_member_can_write_module(organization_id, 'banking') and public.org_member_role_in(organization_id, array['owner','manager'])))
  with check ((public.org_member_can_write_module(organization_id, 'banking') and public.org_member_role_in(organization_id, array['owner','manager'])));
drop policy if exists "cheques_delete_member" on public.cheques;
create policy "cheques_delete_member" on public.cheques for delete to authenticated using (
  (public.org_member_can_write_module(organization_id, 'banking') and public.org_member_role_in(organization_id, array['owner','manager']))
);

-- vehicles_base (module=vehicles, roles=[owner, manager])
drop policy if exists "vehicles_insert_member" on public.vehicles_base;
create policy "vehicles_insert_member" on public.vehicles_base for insert to authenticated with check (
  (public.org_member_can_write_module(organization_id, 'vehicles') and public.org_member_role_in(organization_id, array['owner','manager']))
);
drop policy if exists "vehicles_update_member" on public.vehicles_base;
create policy "vehicles_update_member" on public.vehicles_base for update to authenticated
  using ((public.org_member_can_write_module(organization_id, 'vehicles') and public.org_member_role_in(organization_id, array['owner','manager'])))
  with check ((public.org_member_can_write_module(organization_id, 'vehicles') and public.org_member_role_in(organization_id, array['owner','manager'])));
drop policy if exists "vehicles_delete_member" on public.vehicles_base;
create policy "vehicles_delete_member" on public.vehicles_base for delete to authenticated using (
  (public.org_member_can_write_module(organization_id, 'vehicles') and public.org_member_role_in(organization_id, array['owner','manager']))
);

-- ac_jobs_base (module=ac_jobs, roles=[owner, manager, data_entry])
drop policy if exists "ac_jobs_insert_member" on public.ac_jobs_base;
create policy "ac_jobs_insert_member" on public.ac_jobs_base for insert to authenticated with check (
  (public.org_member_can_write_module(organization_id, 'ac_jobs') and public.org_member_role_in(organization_id, array['owner','manager','data_entry']))
);
drop policy if exists "ac_jobs_update_member" on public.ac_jobs_base;
create policy "ac_jobs_update_member" on public.ac_jobs_base for update to authenticated
  using ((public.org_member_can_write_module(organization_id, 'ac_jobs') and public.org_member_role_in(organization_id, array['owner','manager','data_entry'])))
  with check ((public.org_member_can_write_module(organization_id, 'ac_jobs') and public.org_member_role_in(organization_id, array['owner','manager','data_entry'])));
drop policy if exists "ac_jobs_delete_member" on public.ac_jobs_base;
create policy "ac_jobs_delete_member" on public.ac_jobs_base for delete to authenticated using (
  (public.org_member_can_write_module(organization_id, 'ac_jobs') and public.org_member_role_in(organization_id, array['owner','manager','data_entry']))
);

-- job_status_history (module=ac_jobs, roles=[owner, manager, data_entry])
drop policy if exists "job_status_history_insert_member" on public.job_status_history;
create policy "job_status_history_insert_member" on public.job_status_history for insert to authenticated with check (
  (public.org_member_can_write_module(organization_id, 'ac_jobs') and public.org_member_role_in(organization_id, array['owner','manager','data_entry']))
);
drop policy if exists "job_status_history_update_member" on public.job_status_history;
create policy "job_status_history_update_member" on public.job_status_history for update to authenticated
  using ((public.org_member_can_write_module(organization_id, 'ac_jobs') and public.org_member_role_in(organization_id, array['owner','manager','data_entry'])))
  with check ((public.org_member_can_write_module(organization_id, 'ac_jobs') and public.org_member_role_in(organization_id, array['owner','manager','data_entry'])));
drop policy if exists "job_status_history_delete_member" on public.job_status_history;
create policy "job_status_history_delete_member" on public.job_status_history for delete to authenticated using (
  (public.org_member_can_write_module(organization_id, 'ac_jobs') and public.org_member_role_in(organization_id, array['owner','manager','data_entry']))
);

-- job_items_base (module=ac_jobs, roles=[owner, manager, data_entry, technician])
drop policy if exists "job_items_insert_member" on public.job_items_base;
create policy "job_items_insert_member" on public.job_items_base for insert to authenticated with check (
  (public.org_member_can_write_module(organization_id, 'ac_jobs') and public.org_member_role_in(organization_id, array['owner','manager','data_entry','technician']))
);
drop policy if exists "job_items_update_member" on public.job_items_base;
create policy "job_items_update_member" on public.job_items_base for update to authenticated
  using ((public.org_member_can_write_module(organization_id, 'ac_jobs') and public.org_member_role_in(organization_id, array['owner','manager','data_entry','technician'])))
  with check ((public.org_member_can_write_module(organization_id, 'ac_jobs') and public.org_member_role_in(organization_id, array['owner','manager','data_entry','technician'])));
drop policy if exists "job_items_delete_member" on public.job_items_base;
create policy "job_items_delete_member" on public.job_items_base for delete to authenticated using (
  (public.org_member_can_write_module(organization_id, 'ac_jobs') and public.org_member_role_in(organization_id, array['owner','manager','data_entry','technician']))
);

-- technicians_base (module=ac_jobs, roles=[owner, manager] -- roster/pay rate, "no financial fields" per matrix)
drop policy if exists "technicians_insert_member" on public.technicians_base;
create policy "technicians_insert_member" on public.technicians_base for insert to authenticated with check (
  (public.org_member_can_write_module(organization_id, 'ac_jobs') and public.org_member_role_in(organization_id, array['owner','manager']))
);
drop policy if exists "technicians_update_member" on public.technicians_base;
create policy "technicians_update_member" on public.technicians_base for update to authenticated
  using ((public.org_member_can_write_module(organization_id, 'ac_jobs') and public.org_member_role_in(organization_id, array['owner','manager'])))
  with check ((public.org_member_can_write_module(organization_id, 'ac_jobs') and public.org_member_role_in(organization_id, array['owner','manager'])));
drop policy if exists "technicians_delete_member" on public.technicians_base;
create policy "technicians_delete_member" on public.technicians_base for delete to authenticated using (
  (public.org_member_can_write_module(organization_id, 'ac_jobs') and public.org_member_role_in(organization_id, array['owner','manager']))
);

-- contractors_base (module=ac_jobs, roles=[owner, manager])
drop policy if exists "contractors_insert_member" on public.contractors_base;
create policy "contractors_insert_member" on public.contractors_base for insert to authenticated with check (
  (public.org_member_can_write_module(organization_id, 'ac_jobs') and public.org_member_role_in(organization_id, array['owner','manager']))
);
drop policy if exists "contractors_update_member" on public.contractors_base;
create policy "contractors_update_member" on public.contractors_base for update to authenticated
  using ((public.org_member_can_write_module(organization_id, 'ac_jobs') and public.org_member_role_in(organization_id, array['owner','manager'])))
  with check ((public.org_member_can_write_module(organization_id, 'ac_jobs') and public.org_member_role_in(organization_id, array['owner','manager'])));
drop policy if exists "contractors_delete_member" on public.contractors_base;
create policy "contractors_delete_member" on public.contractors_base for delete to authenticated using (
  (public.org_member_can_write_module(organization_id, 'ac_jobs') and public.org_member_role_in(organization_id, array['owner','manager']))
);

-- contractor_payments (module=ac_jobs, roles=[owner, manager])
drop policy if exists "contractor_payments_insert_member" on public.contractor_payments;
create policy "contractor_payments_insert_member" on public.contractor_payments for insert to authenticated with check (
  (public.org_member_can_write_module(organization_id, 'ac_jobs') and public.org_member_role_in(organization_id, array['owner','manager']))
);
drop policy if exists "contractor_payments_update_member" on public.contractor_payments;
create policy "contractor_payments_update_member" on public.contractor_payments for update to authenticated
  using ((public.org_member_can_write_module(organization_id, 'ac_jobs') and public.org_member_role_in(organization_id, array['owner','manager'])))
  with check ((public.org_member_can_write_module(organization_id, 'ac_jobs') and public.org_member_role_in(organization_id, array['owner','manager'])));
drop policy if exists "contractor_payments_delete_member" on public.contractor_payments;
create policy "contractor_payments_delete_member" on public.contractor_payments for delete to authenticated using (
  (public.org_member_can_write_module(organization_id, 'ac_jobs') and public.org_member_role_in(organization_id, array['owner','manager']))
);

-- ===== Part 4: same role check inside the 8 masked-view trigger functions =====
-- These are SECURITY DEFINER and bypass the base table's own RLS entirely,
-- so Part 3 alone does not protect the path the app actually writes
-- through (INSERT/UPDATE/DELETE against the view, not the base table).

create or replace function public.products_view_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not (public.org_member_can_write_module(new.organization_id, 'stock')
      and public.org_member_role_in(new.organization_id, array['owner','manager','data_entry','cashier'])) then
    raise exception 'permission denied for table products_base' using errcode = '42501';
  end if;
  insert into public.products_base (
    id, organization_id, name, sku, category, sector_id, condition,
    buy_price, sell_price, stock_qty, reorder_level, unit, custom_fields,
    created_at, updated_at, active, notes
  ) values (
    new.id, new.organization_id, new.name, new.sku, new.category, new.sector_id, new.condition,
    new.buy_price, new.sell_price, new.stock_qty, new.reorder_level, new.unit, new.custom_fields,
    coalesce(new.created_at, now()), coalesce(new.updated_at, now()),
    coalesce(new.active, true), new.notes
  );
  return new;
end;
$$;

create or replace function public.products_view_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not (public.org_member_can_write_module(new.organization_id, 'stock')
      and public.org_member_role_in(new.organization_id, array['owner','manager','data_entry','cashier'])) then
    raise exception 'permission denied for table products_base' using errcode = '42501';
  end if;
  update public.products_base set
    name = new.name,
    sku = new.sku,
    category = new.category,
    sector_id = new.sector_id,
    condition = new.condition,
    buy_price = new.buy_price,
    sell_price = new.sell_price,
    stock_qty = new.stock_qty,
    reorder_level = new.reorder_level,
    unit = new.unit,
    custom_fields = new.custom_fields,
    updated_at = coalesce(new.updated_at, now()),
    active = coalesce(new.active, true),
    notes = new.notes
  where id = old.id and organization_id = old.organization_id;
  return new;
end;
$$;

create or replace function public.products_view_delete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not (public.org_member_can_write_module(old.organization_id, 'stock')
      and public.org_member_role_in(old.organization_id, array['owner','manager','data_entry','cashier'])) then
    raise exception 'permission denied for table products_base' using errcode = '42501';
  end if;
  delete from public.products_base
  where id = old.id and organization_id = old.organization_id;
  return old;
end;
$$;

create or replace function public.ac_jobs_view_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not (public.org_member_can_write_module(new.organization_id, 'ac_jobs')
      and public.org_member_role_in(new.organization_id, array['owner','manager','data_entry'])) then
    raise exception 'permission denied for table ac_jobs_base' using errcode = '42501';
  end if;
  insert into public.ac_jobs_base (
    id, organization_id, job_no, job_date, customer_id, customer_name, phone, address,
    brand, btu, unit_type, unit_count, description, quoted_amount, deposit_amount,
    pipe_meters, status, scheduled_date, installed_date, notes, service_due_date,
    last_service_date, service_interval_months, amc_contract, job_type, assigned_technician,
    service_due_manual, service_interval_days, assignee_type, assignee_id, subcontract_cost,
    asset_id, crew_id, complaint, diagnosis
  ) values (
    new.id, new.organization_id, new.job_no, new.job_date, new.customer_id, new.customer_name,
    new.phone, new.address, new.brand, new.btu, new.unit_type, new.unit_count, new.description,
    new.quoted_amount, new.deposit_amount, new.pipe_meters, new.status, new.scheduled_date,
    new.installed_date, new.notes, new.service_due_date, new.last_service_date,
    new.service_interval_months, new.amc_contract, new.job_type, new.assigned_technician,
    new.service_due_manual, new.service_interval_days, new.assignee_type, new.assignee_id,
    new.subcontract_cost, new.asset_id, new.crew_id, new.complaint, new.diagnosis
  );
  return new;
end;
$$;

create or replace function public.ac_jobs_view_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not (public.org_member_can_write_module(new.organization_id, 'ac_jobs')
      and public.org_member_role_in(new.organization_id, array['owner','manager','data_entry'])) then
    raise exception 'permission denied for table ac_jobs_base' using errcode = '42501';
  end if;
  update public.ac_jobs_base set
    job_no = new.job_no,
    job_date = new.job_date,
    customer_id = new.customer_id,
    customer_name = new.customer_name,
    phone = new.phone,
    address = new.address,
    brand = new.brand,
    btu = new.btu,
    unit_type = new.unit_type,
    unit_count = new.unit_count,
    description = new.description,
    quoted_amount = new.quoted_amount,
    deposit_amount = new.deposit_amount,
    pipe_meters = new.pipe_meters,
    status = new.status,
    scheduled_date = new.scheduled_date,
    installed_date = new.installed_date,
    notes = new.notes,
    service_due_date = new.service_due_date,
    last_service_date = new.last_service_date,
    service_interval_months = new.service_interval_months,
    amc_contract = new.amc_contract,
    job_type = new.job_type,
    assigned_technician = new.assigned_technician,
    service_due_manual = new.service_due_manual,
    service_interval_days = new.service_interval_days,
    assignee_type = new.assignee_type,
    assignee_id = new.assignee_id,
    subcontract_cost = new.subcontract_cost,
    asset_id = new.asset_id,
    crew_id = new.crew_id,
    complaint = new.complaint,
    diagnosis = new.diagnosis,
    updated_at = coalesce(new.updated_at, now())
  where id = old.id and organization_id = old.organization_id;
  return new;
end;
$$;

create or replace function public.ac_jobs_view_delete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not (public.org_member_can_write_module(old.organization_id, 'ac_jobs')
      and public.org_member_role_in(old.organization_id, array['owner','manager','data_entry'])) then
    raise exception 'permission denied for table ac_jobs_base' using errcode = '42501';
  end if;
  delete from public.ac_jobs_base
  where id = old.id and organization_id = old.organization_id;
  return old;
end;
$$;

create or replace function public.job_items_view_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not (public.org_member_can_write_module(new.organization_id, 'ac_jobs')
      and public.org_member_role_in(new.organization_id, array['owner','manager','data_entry','technician'])) then
    raise exception 'permission denied for table job_items_base' using errcode = '42501';
  end if;
  insert into public.job_items_base (
    id, organization_id, job_id, item_type, name, qty, unit_price, line_total,
    created_at, updated_at, source, product_id, supplier_id, purchase_ref, purchase_date,
    customer_price, technician_id
  ) values (
    new.id, new.organization_id, new.job_id, new.item_type, new.name, new.qty, new.unit_price, new.line_total,
    coalesce(new.created_at, now()), coalesce(new.updated_at, now()), new.source, new.product_id, new.supplier_id,
    new.purchase_ref, new.purchase_date, new.customer_price, new.technician_id
  );
  return new;
end;
$$;

create or replace function public.job_items_view_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not (public.org_member_can_write_module(new.organization_id, 'ac_jobs')
      and public.org_member_role_in(new.organization_id, array['owner','manager','data_entry','technician'])) then
    raise exception 'permission denied for table job_items_base' using errcode = '42501';
  end if;
  update public.job_items_base set
    job_id = new.job_id,
    item_type = new.item_type,
    name = new.name,
    qty = new.qty,
    unit_price = case when public.can_see_org_financials(new.organization_id) then new.unit_price else job_items_base.unit_price end,
    line_total = case when public.can_see_org_financials(new.organization_id) then new.line_total else job_items_base.line_total end,
    updated_at = coalesce(new.updated_at, now()),
    source = new.source,
    product_id = new.product_id,
    supplier_id = new.supplier_id,
    purchase_ref = new.purchase_ref,
    purchase_date = new.purchase_date,
    customer_price = case when public.can_see_org_financials(new.organization_id) then new.customer_price else job_items_base.customer_price end,
    technician_id = new.technician_id
  where id = old.id and organization_id = old.organization_id;
  return new;
end;
$$;

create or replace function public.job_items_view_delete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- CORRECTION: the original (Phase 6) version of this function referenced
  -- new.organization_id here. NEW is always NULL in a DELETE trigger — so
  -- org_member_can_write_module(null, ...) was always false, meaning
  -- deleting a job item via the app (deleteJobItemFromCloud) has always
  -- raised "permission denied" and never actually worked. Fixed to
  -- old.organization_id, the only row data a DELETE trigger actually has.
  if not (public.org_member_can_write_module(old.organization_id, 'ac_jobs')
      and public.org_member_role_in(old.organization_id, array['owner','manager','data_entry','technician'])) then
    raise exception 'permission denied for table job_items_base' using errcode = '42501';
  end if;
  delete from public.job_items_base
  where id = old.id and organization_id = old.organization_id;
  return old;
end;
$$;

create or replace function public.technicians_view_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not (public.org_member_can_write_module(new.organization_id, 'ac_jobs')
      and public.org_member_role_in(new.organization_id, array['owner','manager'])) then
    raise exception 'permission denied for table technicians_base' using errcode = '42501';
  end if;
  insert into public.technicians_base (
    id, organization_id, name, phone, specialties, active, notes, hourly_rate, created_at, updated_at
  ) values (
    new.id, new.organization_id, new.name, new.phone, new.specialties, new.active, new.notes, new.hourly_rate,
    coalesce(new.created_at, now()), coalesce(new.updated_at, now())
  );
  return new;
end;
$$;

create or replace function public.technicians_view_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not (public.org_member_can_write_module(new.organization_id, 'ac_jobs')
      and public.org_member_role_in(new.organization_id, array['owner','manager'])) then
    raise exception 'permission denied for table technicians_base' using errcode = '42501';
  end if;
  update public.technicians_base set
    name = new.name,
    phone = new.phone,
    specialties = new.specialties,
    active = new.active,
    notes = new.notes,
    hourly_rate = case when public.can_see_org_financials(new.organization_id) then new.hourly_rate else technicians_base.hourly_rate end,
    updated_at = coalesce(new.updated_at, now())
  where id = old.id and organization_id = old.organization_id;
  return new;
end;
$$;

create or replace function public.technicians_view_delete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- CORRECTION: same pre-existing bug as job_items_view_delete above —
  -- the original referenced new.organization_id (always NULL in a DELETE
  -- trigger), so deleting a technician via the app has always raised
  -- "permission denied" and never actually worked. Fixed to
  -- old.organization_id.
  if not (public.org_member_can_write_module(old.organization_id, 'ac_jobs')
      and public.org_member_role_in(old.organization_id, array['owner','manager'])) then
    raise exception 'permission denied for table technicians_base' using errcode = '42501';
  end if;
  delete from public.technicians_base
  where id = old.id and organization_id = old.organization_id;
  return old;
end;
$$;

create or replace function public.contractors_view_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not (public.org_member_can_write_module(new.organization_id, 'ac_jobs')
      and public.org_member_role_in(new.organization_id, array['owner','manager'])) then
    raise exception 'permission denied for table contractors_base' using errcode = '42501';
  end if;
  insert into public.contractors_base (
    id, organization_id, name, company, phone, specialties, rate_type, rate_amount,
    payable_balance, active, notes, created_at, updated_at
  ) values (
    new.id, new.organization_id, new.name, new.company, new.phone, new.specialties,
    new.rate_type, new.rate_amount, new.payable_balance, new.active, new.notes,
    coalesce(new.created_at, now()), coalesce(new.updated_at, now())
  );
  return new;
end;
$$;

create or replace function public.contractors_view_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not (public.org_member_can_write_module(new.organization_id, 'ac_jobs')
      and public.org_member_role_in(new.organization_id, array['owner','manager'])) then
    raise exception 'permission denied for table contractors_base' using errcode = '42501';
  end if;
  update public.contractors_base set
    name = new.name,
    company = new.company,
    phone = new.phone,
    specialties = new.specialties,
    rate_type = new.rate_type,
    rate_amount = new.rate_amount,
    payable_balance = new.payable_balance,
    active = new.active,
    notes = new.notes,
    updated_at = coalesce(new.updated_at, now())
  where id = old.id and organization_id = old.organization_id;
  return new;
end;
$$;

create or replace function public.contractors_view_delete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not (public.org_member_can_write_module(old.organization_id, 'ac_jobs')
      and public.org_member_role_in(old.organization_id, array['owner','manager'])) then
    raise exception 'permission denied for table contractors_base' using errcode = '42501';
  end if;
  delete from public.contractors_base
  where id = old.id and organization_id = old.organization_id;
  return old;
end;
$$;

create or replace function public.sales_view_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not (public.org_member_can_write_module(new.organization_id, 'sales')
      and public.org_member_role_in(new.organization_id, array['owner','manager','data_entry','cashier'])) then
    raise exception 'permission denied for table sales_base' using errcode = '42501';
  end if;
  insert into public.sales_base (
    id, organization_id, bill_no, sale_date, subtotal, output_vat, discount, total, profit,
    payment_method, customer_id, customer_name, credit_amount, cheque_id, created_at
  ) values (
    new.id, new.organization_id, new.bill_no, new.sale_date, new.subtotal, new.output_vat,
    new.discount, new.total, new.profit, new.payment_method, new.customer_id, new.customer_name,
    new.credit_amount, new.cheque_id, coalesce(new.created_at, now())
  );
  return new;
end;
$$;

create or replace function public.sales_view_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not (public.org_member_can_write_module(new.organization_id, 'sales')
      and public.org_member_role_in(new.organization_id, array['owner','manager','data_entry','cashier'])) then
    raise exception 'permission denied for table sales_base' using errcode = '42501';
  end if;
  update public.sales_base set
    bill_no = new.bill_no,
    sale_date = new.sale_date,
    subtotal = new.subtotal,
    output_vat = new.output_vat,
    discount = new.discount,
    total = new.total,
    profit = new.profit,
    payment_method = new.payment_method,
    customer_id = new.customer_id,
    customer_name = new.customer_name,
    credit_amount = new.credit_amount,
    cheque_id = new.cheque_id
  where id = old.id and organization_id = old.organization_id;
  return new;
end;
$$;

create or replace function public.sales_view_delete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not (public.org_member_can_write_module(old.organization_id, 'sales')
      and public.org_member_role_in(old.organization_id, array['owner','manager','data_entry','cashier'])) then
    raise exception 'permission denied for table sales_base' using errcode = '42501';
  end if;
  delete from public.sales_base
  where id = old.id and organization_id = old.organization_id;
  return old;
end;
$$;

create or replace function public.sale_lines_view_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not (public.org_member_can_write_module(new.organization_id, 'sales')
      and public.org_member_role_in(new.organization_id, array['owner','manager','data_entry','cashier'])) then
    raise exception 'permission denied for table sale_lines_base' using errcode = '42501';
  end if;
  insert into public.sale_lines_base (
    id, sale_id, organization_id, product_id, product_name, qty, unit_price, buy_price, line_order
  ) values (
    coalesce(new.id, gen_random_uuid()), new.sale_id, new.organization_id, new.product_id,
    new.product_name, new.qty, new.unit_price, new.buy_price, new.line_order
  );
  return new;
end;
$$;

create or replace function public.sale_lines_view_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not (public.org_member_can_write_module(new.organization_id, 'sales')
      and public.org_member_role_in(new.organization_id, array['owner','manager','data_entry','cashier'])) then
    raise exception 'permission denied for table sale_lines_base' using errcode = '42501';
  end if;
  update public.sale_lines_base set
    sale_id = new.sale_id,
    product_id = new.product_id,
    product_name = new.product_name,
    qty = new.qty,
    unit_price = new.unit_price,
    buy_price = new.buy_price,
    line_order = new.line_order
  where id = old.id and organization_id = old.organization_id;
  return new;
end;
$$;

create or replace function public.sale_lines_view_delete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not (public.org_member_can_write_module(old.organization_id, 'sales')
      and public.org_member_role_in(old.organization_id, array['owner','manager','data_entry','cashier'])) then
    raise exception 'permission denied for table sale_lines_base' using errcode = '42501';
  end if;
  delete from public.sale_lines_base
  where id = old.id and organization_id = old.organization_id;
  return old;
end;
$$;

create or replace function public.vehicles_view_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not (public.org_member_can_write_module(new.organization_id, 'vehicles')
      and public.org_member_role_in(new.organization_id, array['owner','manager'])) then
    raise exception 'permission denied for table vehicles_base' using errcode = '42501';
  end if;
  insert into public.vehicles_base (
    id, organization_id, stock_id, date_added, make, model, year, chassis_no, engine_no,
    reg_no, color, fuel, transmission, mileage_km, condition, purchase_price,
    recondition_cost, ask_price, min_price, status, customer_id, customer_name, sold_price,
    sold_date, finance_partner, payment_method, notes, created_at, updated_at
  ) values (
    new.id, new.organization_id, new.stock_id, new.date_added, new.make, new.model, new.year,
    new.chassis_no, new.engine_no, new.reg_no, new.color, new.fuel, new.transmission,
    new.mileage_km, new.condition, new.purchase_price, new.recondition_cost, new.ask_price,
    new.min_price, new.status, new.customer_id, new.customer_name, new.sold_price, new.sold_date,
    new.finance_partner, new.payment_method, new.notes,
    coalesce(new.created_at, now()), coalesce(new.updated_at, now())
  );
  return new;
end;
$$;

create or replace function public.vehicles_view_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not (public.org_member_can_write_module(new.organization_id, 'vehicles')
      and public.org_member_role_in(new.organization_id, array['owner','manager'])) then
    raise exception 'permission denied for table vehicles_base' using errcode = '42501';
  end if;
  update public.vehicles_base set
    stock_id = new.stock_id,
    date_added = new.date_added,
    make = new.make,
    model = new.model,
    year = new.year,
    chassis_no = new.chassis_no,
    engine_no = new.engine_no,
    reg_no = new.reg_no,
    color = new.color,
    fuel = new.fuel,
    transmission = new.transmission,
    mileage_km = new.mileage_km,
    condition = new.condition,
    purchase_price = new.purchase_price,
    recondition_cost = new.recondition_cost,
    ask_price = new.ask_price,
    min_price = new.min_price,
    status = new.status,
    customer_id = new.customer_id,
    customer_name = new.customer_name,
    sold_price = new.sold_price,
    sold_date = new.sold_date,
    finance_partner = new.finance_partner,
    payment_method = new.payment_method,
    notes = new.notes,
    updated_at = coalesce(new.updated_at, now())
  where id = old.id and organization_id = old.organization_id;
  return new;
end;
$$;

create or replace function public.vehicles_view_delete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not (public.org_member_can_write_module(old.organization_id, 'vehicles')
      and public.org_member_role_in(old.organization_id, array['owner','manager'])) then
    raise exception 'permission denied for table vehicles_base' using errcode = '42501';
  end if;
  delete from public.vehicles_base
  where id = old.id and organization_id = old.organization_id;
  return old;
end;
$$;
