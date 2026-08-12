-- Business expense tracking (Phase 11 of the LakBiz product spec).
--
-- Net-new feature — the app previously had no general operating-expense
-- ledger, only a single derived number (subcontractCost on contractor
-- jobs) folded into the income tax estimate. This is the real thing:
-- ad-hoc costs (rent, utilities, fuel, salaries, supplies, ...) recorded
-- with a category, amount, date, and payment method.
--
-- Cloud-only, same architectural call as Phase 4's ac_assets and Phase 6's
-- crews — reads/writes go straight to Supabase via
-- src/lib/supabase/expenses-client.ts, not the local-first sync engine.
-- See docs/IMPLEMENTATION_PROGRESS.md for the full reasoning (unchanged
-- from those phases').
--
-- Financial data, so unlike ac_assets/crews (readable by technicians too)
-- this follows the Phase 8 job-costing precedent: owner/manager only.
-- That's enforced in the app layer (route access), not by RLS — RLS here
-- only enforces tenant isolation, same as every other table; a
-- lower-privileged role simply never gets routed to a page that reads
-- this table, the same mechanism that already gates /job-costing.
--
-- RLS follows the exact pattern established in 20250618000001_rls_hardening.sql
-- (organization_id in (select organization_id from org_members where
-- user_id = auth.uid()) for select/insert/update/delete) — verified
-- empirically against production before this file was written, same
-- technique as every phase since the security incident: a non-member org
-- gets 0 rows on SELECT and an RLS-violation error on INSERT/UPDATE; the
-- owning org's member can read/write normally.

create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  category text not null check (category in (
    'rent', 'utilities', 'salaries', 'fuel', 'transport', 'supplies',
    'maintenance', 'insurance', 'marketing', 'other'
  )),
  amount numeric not null check (amount > 0),
  expense_date date not null default current_date,
  payment_method text not null default 'cash' check (payment_method in ('cash', 'bank_transfer', 'card', 'cheque')),
  vendor text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists expenses_org_idx on public.expenses(organization_id);
create index if not exists expenses_org_date_idx on public.expenses(organization_id, expense_date);

alter table public.expenses enable row level security;

create policy expenses_select_member
  on public.expenses for select to authenticated
  using (organization_id in (select organization_id from public.org_members where user_id = auth.uid()));

create policy expenses_insert_member
  on public.expenses for insert to authenticated
  with check (organization_id in (select organization_id from public.org_members where user_id = auth.uid()));

create policy expenses_update_member
  on public.expenses for update to authenticated
  using (organization_id in (select organization_id from public.org_members where user_id = auth.uid()))
  with check (organization_id in (select organization_id from public.org_members where user_id = auth.uid()));

create policy expenses_delete_member
  on public.expenses for delete to authenticated
  using (organization_id in (select organization_id from public.org_members where user_id = auth.uid()));

grant select, insert, update, delete on public.expenses to authenticated;
