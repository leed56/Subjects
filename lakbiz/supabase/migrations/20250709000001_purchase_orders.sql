-- LakBiz HVAC platform Phase 13: purchase orders.
--
-- Phase 1/13 audit: `purchases`/`purchase_lines` already exist
-- (20250616000002_business_data_schema.sql) as the "I already have the
-- goods and the supplier's bill in hand" GRN flow, and already carry
-- financial-only RLS (20250623000001_financial_data_rls.sql: full-row
-- SELECT-deny for non-owner/manager roles, not the masked-view partial
-- column hiding used by products/ac_jobs/technicians/job_items). A
-- purchase order is a distinct, earlier-in-time document — goods ordered
-- but not yet delivered, possibly delivered in more than one shipment —
-- so it gets its own table pair rather than overloading `purchases` with
-- a status column that would make "GRN" and "still waiting on this" mean
-- the same row. Same RLS pattern as its closest sibling: full-row
-- SELECT-deny gated on can_see_org_financials, member-scoped writes.
--
-- Deliberately no payment_method/credit_amount/input_vat columns here —
-- a PO is not a bill. Receiving against a PO only ever moves stock
-- (via stock_logs, type 'purchase'); if/when the supplier's actual
-- invoice arrives, the owner records it as a normal `purchases` GRN
-- entry, entering the real payment terms then. Recording both a PO
-- receipt and a GRN as if each independently represented money owed
-- would double-count the same delivery.

create table if not exists public.purchase_orders (
  id text primary key,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  po_no text not null,
  order_date timestamptz not null default now(),
  supplier_id text references public.suppliers(id) on delete set null,
  supplier_name text not null,
  expected_total numeric(14, 2) not null default 0,
  status text not null default 'pending'
    check (status in ('pending', 'partial', 'received', 'cancelled')),
  -- No FK: ac_jobs is local-first (client-assigned text ids, synced
  -- later) and is itself a masked view, not a base table — job_items and
  -- stock_logs already reference jobs the same unenforced way.
  related_job_id text,
  note text,
  received_date timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists purchase_orders_org_idx on public.purchase_orders(organization_id);
create index if not exists purchase_orders_supplier_idx on public.purchase_orders(supplier_id);
create index if not exists purchase_orders_job_idx on public.purchase_orders(related_job_id);

create table if not exists public.purchase_order_lines (
  id uuid primary key default gen_random_uuid(),
  purchase_order_id text not null references public.purchase_orders(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  product_id text,
  product_name text not null,
  qty_ordered numeric(14, 3) not null default 1,
  qty_received numeric(14, 3) not null default 0,
  unit_cost numeric(14, 2) not null default 0,
  line_order smallint not null default 0
);

create index if not exists purchase_order_lines_po_idx on public.purchase_order_lines(purchase_order_id);

alter table public.purchase_orders enable row level security;
alter table public.purchase_order_lines enable row level security;

do $$
declare
  t text;
begin
  foreach t in array array['purchase_orders', 'purchase_order_lines'] loop
    execute format(
      'create policy %I on public.%I for select to authenticated using (
        organization_id in (select m.organization_id from public.org_members m where m.user_id = auth.uid())
        and public.can_see_org_financials(organization_id)
      )',
      t || '_select_financial', t
    );
    execute format(
      'create policy %I on public.%I for insert to authenticated with check (
        organization_id in (select m.organization_id from public.org_members m where m.user_id = auth.uid())
      )',
      t || '_insert_member', t
    );
    execute format(
      'create policy %I on public.%I for update to authenticated
        using (organization_id in (select m.organization_id from public.org_members m where m.user_id = auth.uid()))
        with check (organization_id in (select m.organization_id from public.org_members m where m.user_id = auth.uid()))',
      t || '_update_member', t
    );
    execute format(
      'create policy %I on public.%I for delete to authenticated using (
        organization_id in (select m.organization_id from public.org_members m where m.user_id = auth.uid())
      )',
      t || '_delete_member', t
    );
  end loop;
end $$;
