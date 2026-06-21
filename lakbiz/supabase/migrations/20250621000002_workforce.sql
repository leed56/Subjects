-- LakBiz: AC workforce — in-house technicians + external contractors.
-- Local-first pattern (text ids, organization_id), gated by the ac_jobs module
-- (same plan gate as ac_jobs/vehicles). Contractors carry payout/rate fields;
-- the payable ledger (contractor_payments) and accrual arrive in a later phase.

create table if not exists public.technicians (
  id text primary key,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  phone text,
  specialties jsonb not null default '[]'::jsonb,
  active boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists technicians_org_idx on public.technicians(organization_id);

create table if not exists public.contractors (
  id text primary key,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  company text,
  phone text,
  specialties jsonb not null default '[]'::jsonb,
  rate_type text not null default 'per_job' check (rate_type in ('per_job', 'per_unit', 'per_meter', 'fixed')),
  rate_amount numeric not null default 0,
  payable_balance numeric not null default 0,
  active boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists contractors_org_idx on public.contractors(organization_id);

drop trigger if exists set_technicians_updated_at on public.technicians;
create trigger set_technicians_updated_at
  before update on public.technicians
  for each row execute function public.set_updated_at();

drop trigger if exists set_contractors_updated_at on public.contractors;
create trigger set_contractors_updated_at
  before update on public.contractors
  for each row execute function public.set_updated_at();

alter table public.technicians enable row level security;
alter table public.contractors enable row level security;

do $$
declare
  t text;
begin
  foreach t in array array['technicians', 'contractors'] loop
    execute format('drop policy if exists %I on public.%I', t || '_select_member', t);
    execute format('drop policy if exists %I on public.%I', t || '_insert_member', t);
    execute format('drop policy if exists %I on public.%I', t || '_update_member', t);
    execute format('drop policy if exists %I on public.%I', t || '_delete_member', t);

    execute format(
      'create policy %I on public.%I for select to authenticated using (
        organization_id in (select m.organization_id from public.org_members m where m.user_id = auth.uid())
      )',
      t || '_select_member', t
    );
    execute format(
      'create policy %I on public.%I for insert to authenticated with check (
        public.org_member_can_write_module(organization_id, %L)
      )',
      t || '_insert_member', t, 'ac_jobs'
    );
    execute format(
      'create policy %I on public.%I for update to authenticated
        using (public.org_member_can_write_module(organization_id, %L))
        with check (public.org_member_can_write_module(organization_id, %L))',
      t || '_update_member', t, 'ac_jobs', 'ac_jobs'
    );
    execute format(
      'create policy %I on public.%I for delete to authenticated using (
        public.org_member_can_write_module(organization_id, %L)
      )',
      t || '_delete_member', t, 'ac_jobs'
    );
  end loop;
end $$;

comment on table public.technicians is 'In-house AC service team members (local-first synced).';
comment on table public.contractors is 'External AC subcontractors with payout rates + payable balance (local-first synced).';
