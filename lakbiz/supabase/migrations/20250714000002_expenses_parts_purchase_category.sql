-- LakBiz job-parts-materials phase: add the "parts_purchase" Expense
-- category — created programmatically alongside an "External Purchase,
-- Expense only" job_items line (see docs/JOB_PARTS_ARCHITECTURE.md §2.2)
-- so the purchase shows up in shop-wide expense totals and VAT
-- input-tax figures, which HVAC platform Phase 4/5 explicitly disclosed
-- as a gap ("won't appear in shop-wide expense totals... yet").
--
-- Widens the existing named constraint in place (already named and
-- drop/recreate'd once before, by 20250707000001_expense_job_link.sql —
-- reusing that exact known name rather than a dynamic lookup, unlike
-- job_items' item_type/source constraints in the sibling migration,
-- which were never explicitly named).

alter table public.expenses drop constraint if exists expenses_category_check;
alter table public.expenses add constraint expenses_category_check
  check (category in (
    'rent', 'utilities', 'salaries', 'fuel', 'transport', 'supplies',
    'maintenance', 'insurance', 'marketing', 'other',
    'parking', 'equipment_rental', 'outsourced_repair',
    'parts_purchase'
  ));

comment on constraint expenses_category_check on public.expenses is 'parts_purchase (job-parts-materials phase) is always excluded from computeJobProfitability''s job-cost sum (see job-profitability.ts) — it mirrors an already-counted job_items line into shop-wide reporting, never a second cost.';
