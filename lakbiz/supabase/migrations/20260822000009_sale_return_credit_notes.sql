-- LakBiz customer returns — financial recognition + controlled settlement.
--
-- Phase 1 (20260822000008) deliberately stopped after PHYSICAL return intake.
-- This phase keeps that separation and adds two further layers:
--   1. CREDIT NOTE = accounting recognition of the return (revenue/VAT reversal)
--   2. SETTLEMENT = how the credit is actually satisfied (receivable reduction,
--      bank refund, or an explicitly external refund such as cash/card/cheque).
--
-- The original sale/invoice remains immutable. A credit note is a separate
-- customer-facing financial document, and settlement entries are append-only.
-- This avoids silently rewriting historical invoices, guessing which payment
-- funded a refund, or pretending the app has a cash ledger when it does not.

-- A return can be financially unsettled, partly settled, or fully settled by
-- one/multiple methods. Existing values remain valid.
alter table public.sale_returns
  drop constraint if exists sale_returns_settlement_status_check;
alter table public.sale_returns
  add constraint sale_returns_settlement_status_check
  check (settlement_status in (
    'pending', 'partial', 'settled_external', 'reduced_credit',
    'exchange', 'settled_mixed'
  ));

alter table public.sale_returns
  add column if not exists settled_at timestamptz;

-- One immutable credit note per accepted physical return.
create table if not exists public.sale_credit_notes (
  id uuid primary key,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  credit_note_no text not null,
  return_id uuid not null unique references public.sale_returns(id) on delete restrict,
  sale_id text not null references public.sales_base(id) on delete restrict,
  issued_at timestamptz not null default now(),
  gross_credit numeric(14, 2) not null check (gross_credit >= 0),
  output_vat_reversal numeric(14, 2) not null default 0 check (output_vat_reversal >= 0),
  net_revenue_reversal numeric(14, 2) not null default 0 check (net_revenue_reversal >= 0),
  created_by uuid,
  created_at timestamptz not null default now(),
  unique (organization_id, credit_note_no)
);
create index if not exists sale_credit_notes_org_date_idx
  on public.sale_credit_notes(organization_id, issued_at desc);
create index if not exists sale_credit_notes_org_sale_idx
  on public.sale_credit_notes(organization_id, sale_id);

-- Append-only settlement ledger. One return may have several entries: e.g.
-- reduce LKR 4,000 of outstanding customer credit and refund LKR 1,000 by bank.
create table if not exists public.sale_return_settlements (
  id uuid primary key,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  return_id uuid not null references public.sale_returns(id) on delete restrict,
  credit_note_id uuid not null references public.sale_credit_notes(id) on delete restrict,
  settlement_type text not null
    check (settlement_type in ('receivable_reduction', 'bank_refund', 'external_refund')),
  amount numeric(14, 2) not null check (amount > 0),
  bank_account_id text references public.bank_accounts(id) on delete restrict,
  external_method text
    check (external_method is null or external_method in ('cash', 'card', 'cheque', 'other')),
  note text,
  created_by uuid,
  created_at timestamptz not null default now()
);
create index if not exists sale_return_settlements_return_idx
  on public.sale_return_settlements(organization_id, return_id, created_at);
create index if not exists sale_return_settlements_credit_note_idx
  on public.sale_return_settlements(credit_note_id);

alter table public.sale_credit_notes enable row level security;
alter table public.sale_return_settlements enable row level security;

-- Credit notes are customer-facing documents and may be read by members who can
-- already read the original bill. Hidden COGS/profit remains in the existing
-- owner-only sale_return_financials table.
drop policy if exists sale_credit_notes_select_org on public.sale_credit_notes;
create policy sale_credit_notes_select_org on public.sale_credit_notes
for select to authenticated using (
  organization_id in (
    select organization_id from public.org_members where user_id = auth.uid()
  )
);

-- Refund destinations and receivable adjustments are internal finance: owner only.
drop policy if exists sale_return_settlements_select_owner on public.sale_return_settlements;
create policy sale_return_settlements_select_owner on public.sale_return_settlements
for select to authenticated using (public.can_see_org_financials(organization_id));

-- Clients cannot fabricate, edit or delete financial history directly.
revoke insert, update, delete on public.sale_credit_notes from authenticated;
revoke insert, update, delete on public.sale_return_settlements from authenticated;
grant select on public.sale_credit_notes to authenticated;
grant select on public.sale_return_settlements to authenticated;

-- Issue the accounting document for one accepted physical return. This does NOT
-- move money or customer receivables. It only makes the revenue/VAT reversal an
-- explicit, immutable credit note. Owner-only because it changes accounting.
create or replace function public.issue_sale_return_credit_note(
  p_organization_id uuid,
  p_return_id uuid,
  p_credit_note_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_return record;
  v_existing record;
  v_note_no text;
  v_net numeric(14,2);
begin
  if p_organization_id is null or p_return_id is null or p_credit_note_id is null then
    raise exception 'organization, return and credit note id are required' using errcode = '22023';
  end if;

  if not public.can_see_org_financials(p_organization_id) then
    raise exception 'owner approval is required for credit notes' using errcode = '42501';
  end if;

  -- Idempotency by the business object: a return may have only one note.
  select * into v_existing
  from public.sale_credit_notes n
  where n.organization_id = p_organization_id
    and n.return_id = p_return_id;
  if found then
    return jsonb_build_object(
      'ok', true,
      'replayed', true,
      'credit_note_id', v_existing.id,
      'credit_note_no', v_existing.credit_note_no,
      'gross_credit', v_existing.gross_credit,
      'output_vat_reversal', v_existing.output_vat_reversal,
      'net_revenue_reversal', v_existing.net_revenue_reversal,
      'issued_at', v_existing.issued_at
    );
  end if;

  select r.* into v_return
  from public.sale_returns r
  where r.id = p_return_id
    and r.organization_id = p_organization_id
  for update;
  if not found then
    raise exception 'return not found' using errcode = 'P0002';
  end if;

  if v_return.merchandise_value <= 0 then
    raise exception 'return has no financial value' using errcode = '23514';
  end if;

  v_net := greatest(0, round(v_return.merchandise_value - v_return.output_vat_reversal, 2));
  v_note_no := 'CRN-' || upper(substr(replace(p_credit_note_id::text, '-', ''), 1, 8));

  insert into public.sale_credit_notes (
    id, organization_id, credit_note_no, return_id, sale_id,
    gross_credit, output_vat_reversal, net_revenue_reversal, created_by
  ) values (
    p_credit_note_id, p_organization_id, v_note_no, p_return_id, v_return.sale_id,
    v_return.merchandise_value, v_return.output_vat_reversal, v_net, auth.uid()
  );

  return jsonb_build_object(
    'ok', true,
    'replayed', false,
    'credit_note_id', p_credit_note_id,
    'credit_note_no', v_note_no,
    'gross_credit', v_return.merchandise_value,
    'output_vat_reversal', v_return.output_vat_reversal,
    'net_revenue_reversal', v_net,
    'issued_at', now()
  );
end;
$$;

revoke all on function public.issue_sale_return_credit_note(uuid, uuid, uuid) from public, anon;
grant execute on function public.issue_sale_return_credit_note(uuid, uuid, uuid) to authenticated;

-- Post ONE settlement entry. Repeated calls with the same settlement UUID are
-- harmless. Multiple different entries are allowed until the credit-note value
-- is fully settled.
create or replace function public.settle_sale_return_credit(
  p_organization_id uuid,
  p_return_id uuid,
  p_settlement_id uuid,
  p_settlement_type text,
  p_amount numeric,
  p_bank_account_id text default null,
  p_external_method text default null,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_return record;
  v_note record;
  v_sale record;
  v_existing record;
  v_customer record;
  v_bank record;
  v_amount numeric(14,2);
  v_before numeric(14,2);
  v_total numeric(14,2);
  v_remaining numeric(14,2);
  v_status text;
  v_all_receivable boolean;
  v_all_refund boolean;
begin
  if p_organization_id is null or p_return_id is null or p_settlement_id is null then
    raise exception 'organization, return and settlement id are required' using errcode = '22023';
  end if;
  if not public.can_see_org_financials(p_organization_id) then
    raise exception 'owner approval is required for return settlement' using errcode = '42501';
  end if;
  if p_settlement_type not in ('receivable_reduction', 'bank_refund', 'external_refund') then
    raise exception 'invalid settlement type' using errcode = '22023';
  end if;

  v_amount := round(coalesce(p_amount, 0), 2);
  if v_amount <= 0 then
    raise exception 'settlement amount must be positive' using errcode = '22023';
  end if;

  -- Network retry / double-click idempotency.
  select * into v_existing
  from public.sale_return_settlements s
  where s.id = p_settlement_id
    and s.organization_id = p_organization_id
    and s.return_id = p_return_id;
  if found then
    select r.settlement_status, r.settled_at into v_status, v_return.settled_at
    from public.sale_returns r
    where r.id = p_return_id and r.organization_id = p_organization_id;
    select coalesce(sum(s.amount), 0) into v_total
    from public.sale_return_settlements s
    where s.organization_id = p_organization_id and s.return_id = p_return_id;
    select n.gross_credit into v_remaining
    from public.sale_credit_notes n
    where n.organization_id = p_organization_id and n.return_id = p_return_id;
    return jsonb_build_object(
      'ok', true,
      'replayed', true,
      'settlement_id', v_existing.id,
      'settlement_status', v_status,
      'settled_total', v_total,
      'remaining', greatest(0, coalesce(v_remaining, 0) - v_total)
    );
  end if;

  -- The return row lock serializes all settlement entries for this return.
  select r.* into v_return
  from public.sale_returns r
  where r.id = p_return_id
    and r.organization_id = p_organization_id
  for update;
  if not found then
    raise exception 'return not found' using errcode = 'P0002';
  end if;

  select n.* into v_note
  from public.sale_credit_notes n
  where n.organization_id = p_organization_id
    and n.return_id = p_return_id;
  if not found then
    raise exception 'issue the credit note before settlement' using errcode = '23514';
  end if;

  select s.id, s.customer_id, s.customer_name into v_sale
  from public.sales_base s
  where s.id = v_return.sale_id
    and s.organization_id = p_organization_id;
  if not found then
    raise exception 'original sale not found' using errcode = 'P0002';
  end if;

  select coalesce(sum(s.amount), 0) into v_before
  from public.sale_return_settlements s
  where s.organization_id = p_organization_id
    and s.return_id = p_return_id;

  v_remaining := round(v_note.gross_credit - v_before, 2);
  if v_remaining <= 0 then
    raise exception 'return credit is already fully settled' using errcode = '23514';
  end if;
  if v_amount > v_remaining + 0.005 then
    raise exception 'settlement amount exceeds remaining return credit (%)', v_remaining using errcode = '23514';
  end if;

  if p_settlement_type = 'receivable_reduction' then
    if v_sale.customer_id is null then
      raise exception 'this sale has no customer account to reduce' using errcode = '23514';
    end if;

    select c.* into v_customer
    from public.customers c
    where c.id = v_sale.customer_id
      and c.organization_id = p_organization_id
    for update;
    if not found then
      raise exception 'customer account not found' using errcode = 'P0002';
    end if;
    if v_amount > v_customer.credit_balance + 0.005 then
      raise exception 'customer outstanding balance is only %', v_customer.credit_balance using errcode = '23514';
    end if;

    update public.customers
    set credit_balance = greatest(0, credit_balance - v_amount),
        updated_at = now()
    where id = v_customer.id and organization_id = p_organization_id;

  elsif p_settlement_type = 'bank_refund' then
    if nullif(btrim(coalesce(p_bank_account_id, '')), '') is null then
      raise exception 'bank account is required for bank refund' using errcode = '22023';
    end if;

    select b.* into v_bank
    from public.bank_accounts b
    where b.id = p_bank_account_id
      and b.organization_id = p_organization_id
    for update;
    if not found then
      raise exception 'bank account not found' using errcode = 'P0002';
    end if;

    update public.bank_accounts
    set balance = balance - v_amount,
        updated_at = now()
    where id = v_bank.id and organization_id = p_organization_id;

    insert into public.bank_transactions (
      id, organization_id, account_id, type, amount,
      description, reference, txn_date
    ) values (
      'return:' || p_settlement_id::text,
      p_organization_id,
      v_bank.id,
      'withdrawal',
      v_amount,
      'Customer return refund ' || v_return.return_no,
      v_note.credit_note_no,
      current_date
    );

  elsif p_settlement_type = 'external_refund' then
    if p_external_method not in ('cash', 'card', 'cheque', 'other') then
      raise exception 'external refund method is required' using errcode = '22023';
    end if;
  end if;

  insert into public.sale_return_settlements (
    id, organization_id, return_id, credit_note_id,
    settlement_type, amount, bank_account_id, external_method, note, created_by
  ) values (
    p_settlement_id, p_organization_id, p_return_id, v_note.id,
    p_settlement_type, v_amount,
    case when p_settlement_type = 'bank_refund' then p_bank_account_id else null end,
    case when p_settlement_type = 'external_refund' then p_external_method else null end,
    nullif(btrim(coalesce(p_note, '')), ''), auth.uid()
  );

  select
    coalesce(sum(s.amount), 0),
    coalesce(bool_and(s.settlement_type = 'receivable_reduction'), false),
    coalesce(bool_and(s.settlement_type in ('bank_refund', 'external_refund')), false)
  into v_total, v_all_receivable, v_all_refund
  from public.sale_return_settlements s
  where s.organization_id = p_organization_id
    and s.return_id = p_return_id;

  v_remaining := greatest(0, round(v_note.gross_credit - v_total, 2));
  if v_remaining > 0.005 then
    v_status := 'partial';
  elsif v_all_receivable then
    v_status := 'reduced_credit';
  elsif v_all_refund then
    v_status := 'settled_external';
  else
    v_status := 'settled_mixed';
  end if;

  update public.sale_returns
  set settlement_status = v_status,
      settled_at = case when v_remaining <= 0.005 then now() else null end
  where id = p_return_id and organization_id = p_organization_id;

  -- Customer receivable or bank balance changes live in AppData. Advance the
  -- generation so other devices cannot push an older local snapshot over them.
  if p_settlement_type in ('receivable_reduction', 'bank_refund') then
    update public.organizations
    set sync_generation = sync_generation + 1
    where id = p_organization_id;
  end if;

  return jsonb_build_object(
    'ok', true,
    'replayed', false,
    'settlement_id', p_settlement_id,
    'settlement_status', v_status,
    'settled_total', v_total,
    'remaining', v_remaining
  );
end;
$$;

revoke all on function public.settle_sale_return_credit(uuid, uuid, uuid, text, numeric, text, text, text) from public, anon;
grant execute on function public.settle_sale_return_credit(uuid, uuid, uuid, text, numeric, text, text, text) to authenticated;

comment on table public.sale_credit_notes is
  'Immutable customer credit notes issued against accepted sale_returns. They reverse revenue/output VAT for reporting without rewriting the original invoice.';
comment on table public.sale_return_settlements is
  'Append-only owner financial settlement ledger for a return credit note. Supports partial/mixed receivable reduction, bank refund and externally handled refund.';
comment on function public.issue_sale_return_credit_note(uuid, uuid, uuid) is
  'Owner-only accounting recognition step for an accepted physical return. Creates exactly one immutable credit note and does not move money/receivables.';
comment on function public.settle_sale_return_credit(uuid, uuid, uuid, text, numeric, text, text, text) is
  'Owner-only idempotent settlement entry. Reduces customer receivable or posts a bank withdrawal when explicitly selected; external refunds are recorded without fabricating a cash/card ledger.';
