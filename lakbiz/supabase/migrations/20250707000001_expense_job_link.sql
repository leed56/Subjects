-- LakBiz HVAC platform Phase 7: other job costs, via the existing
-- Expenses ledger rather than a parallel "job costs" table.
--
-- Audited first: Suppliers/Bills (Purchase) already exist for materials
-- (Phase 1/13), and Expenses (Phase 11 of the prior spec) already covers
-- ad-hoc operating costs with category/amount/date/payment
-- method/vendor/notes — everything the spec's field list asks for
-- except a job link. Adding one column here integrates with the sound
-- existing model instead of duplicating it with a new "other job costs"
-- table.

alter table public.expenses add column if not exists job_id text;
create index if not exists expenses_job_idx on public.expenses(job_id);

alter table public.expenses drop constraint if exists expenses_category_check;
alter table public.expenses add constraint expenses_category_check
  check (category in (
    'rent', 'utilities', 'salaries', 'fuel', 'transport', 'supplies',
    'maintenance', 'insurance', 'marketing', 'other',
    'parking', 'equipment_rental', 'outsourced_repair'
  ));

comment on column public.expenses.job_id is 'Links an expense into a specific job''s "other costs" (HVAC platform Phase 7). No FK — jobs are local-first text ids, same as job_items.job_id. Deliberately no "subcontractor" category was added alongside this column: that cost is already captured by ac_jobs.subcontract_cost for contractor-assigned jobs, so one would double-count against the other.';
