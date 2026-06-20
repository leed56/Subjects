-- AC job service lifecycle fields

alter table public.ac_jobs
  add column if not exists service_due_date date,
  add column if not exists last_service_date date,
  add column if not exists service_interval_months smallint not null default 6,
  add column if not exists amc_contract boolean not null default false;
