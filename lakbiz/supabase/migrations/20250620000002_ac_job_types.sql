-- AC job types + technician assignment

alter table public.ac_jobs
  add column if not exists job_type text not null default 'installation'
    check (job_type in ('installation', 'service', 'repair')),
  add column if not exists assigned_technician text;

comment on column public.ac_jobs.job_type is 'installation | service | repair';
comment on column public.ac_jobs.assigned_technician is 'Technician name assigned to this job';
