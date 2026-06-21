-- LakBiz Phase C: contractor payout settlement ledger.
-- contractors.payable_balance is derived (sum of completed contractor-job
-- subcontract costs minus payments) and recomputed client-side; this table
-- records the settlement payouts (mirrors supplier_payments).

create table if not exists public.contractor_payments (
  id text primary key,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  contractor_id text not null,
  contractor_name text,
  amount numeric not null default 0,
  payment_date date not null default current_date,
  method text,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists contractor_payments_org_idx on public.contractor_payments(organization_id);
create index if not exists contractor_payments_contractor_idx on public.contractor_payments(contractor_id);

drop trigger if exists set_contractor_payments_updated_at on public.contractor_payments;
create trigger set_contractor_payments_updated_at
  before update on public.contractor_payments
  for each row execute function public.set_updated_at();

alter table public.contractor_payments enable row level security;

drop policy if exists "contractor_payments_select_member" on public.contractor_payments;
create policy "contractor_payments_select_member"
  on public.contractor_payments for select to authenticated using (
    organization_id in (select m.organization_id from public.org_members m where m.user_id = auth.uid())
  );

drop policy if exists "contractor_payments_insert_member" on public.contractor_payments;
create policy "contractor_payments_insert_member"
  on public.contractor_payments for insert to authenticated
  with check (public.org_member_can_write_module(organization_id, 'ac_jobs'));

drop policy if exists "contractor_payments_update_member" on public.contractor_payments;
create policy "contractor_payments_update_member"
  on public.contractor_payments for update to authenticated
  using (public.org_member_can_write_module(organization_id, 'ac_jobs'))
  with check (public.org_member_can_write_module(organization_id, 'ac_jobs'));

drop policy if exists "contractor_payments_delete_member" on public.contractor_payments;
create policy "contractor_payments_delete_member"
  on public.contractor_payments for delete to authenticated
  using (public.org_member_can_write_module(organization_id, 'ac_jobs'));

comment on table public.contractor_payments is 'Payouts settling contractor payable balances (local-first synced).';
