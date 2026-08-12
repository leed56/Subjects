-- LakBiz HVAC platform Phase 3: richer stock movement types + link fields.
--
-- stock_logs already exists as the audit trail behind every stockQty
-- change (see 20250616000002_business_data_schema.sql) — every mutation
-- in actions.ts already funnels through it, so this phase widens the
-- existing table rather than adding a parallel one. `log_type` had a
-- CHECK constraint limited to ('in', 'out', 'sale'); it must be dropped
-- and replaced before the app can write the new movement kinds
-- (purchase/job_usage/job_return/supplier_return/write_off), or every
-- insert of a new kind gets rejected outright.
--
-- "Transfer between locations" from the spec's movement list is
-- deliberately not modeled here — the product model has no
-- location/warehouse concept at all (confirmed in the Phase 1 audit),
-- so a transfer type with nothing to transfer between would be a
-- fabricated capability, not a real one.

alter table public.stock_logs drop constraint if exists stock_logs_log_type_check;
alter table public.stock_logs add constraint stock_logs_log_type_check
  check (log_type in (
    'in', 'out', 'sale', 'purchase', 'job_usage', 'job_return', 'supplier_return', 'write_off'
  ));

alter table public.stock_logs add column if not exists related_job_id text;
alter table public.stock_logs add column if not exists related_supplier_id text;
alter table public.stock_logs add column if not exists user_id uuid;

create index if not exists stock_logs_related_job_idx on public.stock_logs(related_job_id);
create index if not exists stock_logs_related_supplier_idx on public.stock_logs(related_supplier_id);

comment on column public.stock_logs.related_job_id is 'ac_jobs.id for job_usage/job_return movements. No FK — jobs are local-first (text ids assigned client-side before any sync round-trip), same as job_items.job_id already does.';
comment on column public.stock_logs.related_supplier_id is 'suppliers.id for purchase/supplier_return movements.';
comment on column public.stock_logs.user_id is 'Org member who performed the movement, when known (auth.uid() at write time). Nullable — populated by the app layer, not enforced by RLS.';
