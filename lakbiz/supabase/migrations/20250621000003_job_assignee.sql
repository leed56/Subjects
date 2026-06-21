-- LakBiz: assign AC jobs to in-house team or external contractor + subcontract cost.
-- ac_jobs already has member-read + ac_jobs-module-gated write RLS; just add columns.

alter table public.ac_jobs
  add column if not exists assignee_type text check (assignee_type in ('team', 'contractor')),
  add column if not exists assignee_id text,
  add column if not exists subcontract_cost numeric;

comment on column public.ac_jobs.assignee_type is 'team = in-house technician, contractor = external subcontractor';
comment on column public.ac_jobs.subcontract_cost is 'Amount paid to the contractor for this job (drives margin and contractor payable in later phase)';
