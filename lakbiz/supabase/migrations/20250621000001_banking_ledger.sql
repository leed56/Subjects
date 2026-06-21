-- LakBiz Phase 1: banking transaction + transfer ledger.
-- Follows the existing local-first pattern: text client ids, organization_id,
-- member-read RLS + banking-module-gated writes (same as bank_accounts/cheques).

create table if not exists public.bank_transactions (
  id text primary key,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  account_id text not null,
  type text not null check (type in ('deposit', 'withdrawal', 'fee', 'interest', 'adjustment')),
  amount numeric not null default 0,
  description text,
  reference text,
  txn_date date not null default current_date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists bank_transactions_org_idx on public.bank_transactions(organization_id);
create index if not exists bank_transactions_account_idx on public.bank_transactions(account_id);

create table if not exists public.bank_transfers (
  id text primary key,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  from_account_id text not null,
  to_account_id text not null,
  amount numeric not null default 0,
  description text,
  transfer_date date not null default current_date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists bank_transfers_org_idx on public.bank_transfers(organization_id);

-- updated_at maintenance (set_updated_at exists from rls_hardening migration)
drop trigger if exists set_bank_transactions_updated_at on public.bank_transactions;
create trigger set_bank_transactions_updated_at
  before update on public.bank_transactions
  for each row execute function public.set_updated_at();

drop trigger if exists set_bank_transfers_updated_at on public.bank_transfers;
create trigger set_bank_transfers_updated_at
  before update on public.bank_transfers
  for each row execute function public.set_updated_at();

-- RLS: member read, banking-module write (mirrors bank_accounts policies).
alter table public.bank_transactions enable row level security;
alter table public.bank_transfers enable row level security;

do $$
declare
  t text;
begin
  foreach t in array array['bank_transactions', 'bank_transfers'] loop
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
      t || '_insert_member', t, 'banking'
    );
    execute format(
      'create policy %I on public.%I for update to authenticated
        using (public.org_member_can_write_module(organization_id, %L))
        with check (public.org_member_can_write_module(organization_id, %L))',
      t || '_update_member', t, 'banking', 'banking'
    );
    execute format(
      'create policy %I on public.%I for delete to authenticated using (
        public.org_member_can_write_module(organization_id, %L)
      )',
      t || '_delete_member', t, 'banking'
    );
  end loop;
end $$;

comment on table public.bank_transactions is 'Per-account deposit/withdrawal/fee/interest/adjustment ledger (local-first synced).';
comment on table public.bank_transfers is 'Account-to-account transfers (local-first synced).';
