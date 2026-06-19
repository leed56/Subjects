-- Owner can set a fixed service due date instead of auto interval

alter table public.ac_jobs
  add column if not exists service_due_manual boolean not null default false;

comment on column public.ac_jobs.service_due_manual is 'When true, service_due_date is not auto-recalculated from interval';
