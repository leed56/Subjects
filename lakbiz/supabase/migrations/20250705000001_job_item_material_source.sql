-- LakBiz HVAC platform Phase 4/5: job material sources + historical cost.
--
-- job_items already exists (20250621000005_job_items.sql) as the
-- job-costing line-item table but had no link to real inventory — a
-- "part" row was always free text, so nothing could distinguish stock
-- consumption from an off-books purchase or a customer-supplied part,
-- and nothing captured a historical unit-cost snapshot. This migration
-- widens the existing table; it does not add a parallel one.

alter table public.job_items add column if not exists source text
  check (source in ('stock', 'purchased', 'customer_supplied'));
alter table public.job_items add column if not exists product_id text
  references public.products_base(id) on delete set null;
alter table public.job_items add column if not exists supplier_id text
  references public.suppliers(id) on delete set null;
alter table public.job_items add column if not exists purchase_ref text;
alter table public.job_items add column if not exists purchase_date date;
alter table public.job_items add column if not exists customer_price numeric(14, 2);

create index if not exists job_items_product_idx on public.job_items(product_id);
create index if not exists job_items_supplier_idx on public.job_items(supplier_id);

comment on column public.job_items.source is 'Only meaningful when item_type = ''part''. stock = decremented from real inventory (unit_price is a frozen historical cost snapshot, never recalculated); purchased = bought specifically for this job, does not touch products/stock_qty; customer_supplied = no cost/no stock movement unless the shop genuinely incurred one.';
comment on column public.job_items.product_id is 'Set only when source = ''stock'' — the real product this material was decremented from.';
comment on column public.job_items.customer_price is 'What the customer is charged for this specific line, when the owner wants to track it. Does not feed the job invoice, which still totals from ac_jobs.quoted_amount as one flat figure.';

-- product_id references products_base directly (not the masked `products`
-- view — views can't be FK targets), same pattern already established by
-- ac_jobs_base.asset_id -> ac_assets in 20250629000001_ac_asset_lifecycle.sql.
