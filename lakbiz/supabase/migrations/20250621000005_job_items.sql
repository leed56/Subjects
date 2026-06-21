-- LakBiz: AC job line items (parts/labour) + status history.
-- Local-first pattern (text ids, organization_id), gated by the ac_jobs module.

create table if not exists public.job_items (
  id text primary key,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  job_id text not null,
  item_type text not null default 'part' check (item_type in ('part', 'labour', 'service')),
  name text not null,
  qty numeric not null default 1,
  unit_price numeric not null default 0,
  line_total numeric not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists job_items_org_idx on public.job_items(organization_id);
create index if not exists job_items_job_idx on public.job_items(job_id);

create table if not exists public.job_status_history (
  id text primary key,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  job_id text not null,
  old_status text,
  new_status text not null,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists job_status_history_org_idx on public.job_status_history(organization_id);
create index if not exists job_status_history_job_idx on public.job_status_history(job_id);

drop trigger if exists set_job_items_updated_at on public.job_items;
create trigger set_job_items_updated_at
  before update on public.job_items
  for each row execute function public.set_updated_at();

drop trigger if exists set_job_status_history_updated_at on public.job_status_history;
create trigger set_job_status_history_updated_at
  before update on public.job_status_history
  for each row execute function public.set_updated_at();

alter table public.job_items enable row level security;
alter table public.job_status_history enable row level security;

do $$
declare
  t text;
begin
  foreach t in array array['job_items', 'job_status_history'] loop
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

comment on table public.job_items is 'Parts/labour line items per AC job (local-first synced).';
comment on table public.job_status_history is 'Status change audit trail per AC job (local-first synced).';
