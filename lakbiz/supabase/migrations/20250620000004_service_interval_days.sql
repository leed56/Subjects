-- Service interval in days (90, 180, etc.) for recurring AC maintenance

alter table public.ac_jobs
  add column if not exists service_interval_days integer default 180;

comment on column public.ac_jobs.service_interval_days is 'Days until next service after service done (e.g. 90, 180)';

-- Backfill from months where present
update public.ac_jobs
set service_interval_days = coalesce(service_interval_months, 6) * 30
where service_interval_days is null or service_interval_days = 180;
