-- Additive owner-only base-currency ledger. No historical stock or finance is rewritten.
create table public.ledger_accounts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  code text not null check (code ~ '^[0-9]{4}$'),
  name text not null check (length(btrim(name)) between 1 and 120),
  kind text not null check (kind in ('asset','liability','equity','income','expense')),
  unique (organization_id,code), unique (organization_id,id)
);
create table public.journal_batches (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  source_key text not null check (source_key ~ '^manual:[0-9a-f-]{36}$'),
  journal_date date not null,
  memo text not null check (length(btrim(memo)) between 1 and 500),
  currency text not null default 'LKR' check (currency='LKR'),
  status text not null default 'draft' check (status in ('draft','posted')),
  request_payload jsonb not null,
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  unique (organization_id,source_key), unique (organization_id,id)
);
create index journal_batches_date_idx on public.journal_batches(organization_id,journal_date,id);
create table public.journal_lines (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  batch_id uuid not null,
  account_id uuid not null,
  line_no integer not null check (line_no between 1 and 200),
  debit_minor numeric not null default 0,
  credit_minor numeric not null default 0,
  check (debit_minor=trunc(debit_minor) and credit_minor=trunc(credit_minor)),
  check (debit_minor between 0 and 100000000000000 and credit_minor between 0 and 100000000000000),
  check ((debit_minor>0 and credit_minor=0) or (credit_minor>0 and debit_minor=0)),
  unique (batch_id,line_no),
  foreign key (organization_id,batch_id) references public.journal_batches(organization_id,id),
  foreign key (organization_id,account_id) references public.ledger_accounts(organization_id,id)
);
create index journal_lines_account_idx on public.journal_lines(organization_id,account_id,batch_id);
create index journal_lines_batch_idx on public.journal_lines(organization_id,batch_id);

alter table public.ledger_accounts enable row level security;
alter table public.journal_batches enable row level security;
alter table public.journal_lines enable row level security;
create policy ledger_accounts_owner_read on public.ledger_accounts for select to authenticated using (public.is_org_owner(organization_id));
create policy ledger_accounts_owner_insert on public.ledger_accounts for insert to authenticated with check (public.is_org_owner(organization_id) and public.org_has_module(organization_id,'banking'));
create policy journal_batches_owner_read on public.journal_batches for select to authenticated using (public.is_org_owner(organization_id));
create policy journal_batches_owner_insert on public.journal_batches for insert to authenticated with check (public.is_org_owner(organization_id) and public.org_has_module(organization_id,'banking') and created_by=(select auth.uid()));
create policy journal_batches_owner_post on public.journal_batches for update to authenticated using (public.is_org_owner(organization_id) and public.org_has_module(organization_id,'banking')) with check (public.is_org_owner(organization_id) and public.org_has_module(organization_id,'banking'));
create policy journal_lines_owner_read on public.journal_lines for select to authenticated using (public.is_org_owner(organization_id));
create policy journal_lines_owner_insert on public.journal_lines for insert to authenticated with check (public.is_org_owner(organization_id) and public.org_has_module(organization_id,'banking'));
revoke all on public.ledger_accounts,public.journal_batches,public.journal_lines from public,anon,authenticated;
grant select,insert on public.ledger_accounts,public.journal_lines to authenticated;
grant select,insert,update on public.journal_batches to authenticated;

-- Constraints also cover writes made directly through the Data API.
create function public.guard_ledger_batch() returns trigger language plpgsql security invoker set search_path='' as $$
begin
  if tg_op='DELETE' then raise exception 'Journals are immutable'; end if;
  if tg_op='INSERT' then
    if new.status<>'draft' then raise exception 'A journal must start as draft'; end if;
  elsif old.status<>'draft' or new.status<>'posted' or (to_jsonb(new)-'status')<>(to_jsonb(old)-'status') then
    raise exception 'Only the draft-to-posted transition is allowed';
  end if;
  return new;
end $$;
create trigger guard_ledger_batch before insert or update or delete on public.journal_batches for each row execute function public.guard_ledger_batch();
create function public.guard_ledger_line() returns trigger language plpgsql security invoker set search_path='' as $$
declare state text;
begin
  if tg_op<>'INSERT' then raise exception 'Journal lines are immutable'; end if;
  select status into state from public.journal_batches where organization_id=new.organization_id and id=new.batch_id for update;
  if state is distinct from 'draft' then raise exception 'Cannot add lines to a posted journal'; end if;
  return new;
end $$;
create trigger guard_ledger_line before insert or update or delete on public.journal_lines for each row execute function public.guard_ledger_line();
create function public.check_ledger_balance() returns trigger language plpgsql security invoker set search_path='' as $$
declare b uuid; o uuid; n bigint; d numeric; c numeric; state text;
begin
  if tg_table_name='journal_batches' then b:=new.id; else b:=new.batch_id; end if;
  o:=new.organization_id;
  select status into state from public.journal_batches where organization_id=o and id=b;
  select count(*),coalesce(sum(debit_minor),0),coalesce(sum(credit_minor),0) into n,d,c from public.journal_lines where organization_id=o and batch_id=b;
  if state is distinct from 'posted' or n<2 or n>200 or d<=0 or d<>c or d>9007199254740991 then
    raise exception 'Journal must be posted with two or more balanced lines';
  end if;
  return null;
end $$;
create constraint trigger journal_batch_balanced after insert or update on public.journal_batches deferrable initially deferred for each row execute function public.check_ledger_balance();
create constraint trigger journal_lines_balanced after insert on public.journal_lines deferrable initially deferred for each row execute function public.check_ledger_balance();
revoke all on function public.guard_ledger_batch(),public.guard_ledger_line(),public.check_ledger_balance() from public,anon,authenticated;

create function public.initialize_general_ledger(p_organization_id uuid) returns void language plpgsql security invoker set search_path='' as $$
begin
  if auth.uid() is null or not public.is_org_owner(p_organization_id) or not public.org_has_module(p_organization_id,'banking') then raise exception 'Owner with active banking entitlement required' using errcode='42501'; end if;
  insert into public.ledger_accounts(organization_id,code,name,kind)
  select p_organization_id,v.code,v.name,v.kind from (values
    ('1000','Cash','asset'),('1010','Bank','asset'),('1020','Card clearing','asset'),
    ('1100','Customer receivables','asset'),('1200','Inventory','asset'),('1300','Input VAT','asset'),
    ('2000','Supplier payables','liability'),('2100','Output VAT','liability'),
    ('3000','Opening equity','equity'),('4000','Sales revenue','income'),
    ('5000','Cost of goods sold','expense'),('5100','Stock loss','expense'),
    ('5200','Operating expenses','expense'),('5300','Exchange differences','expense')
  ) as v(code,name,kind) on conflict (organization_id,code) do nothing;
end $$;
create function public.post_general_ledger_journal(p_organization_id uuid,p_source_key text,p_date date,p_memo text,p_lines jsonb) returns uuid language plpgsql security invoker set search_path='' as $$
declare existing public.journal_batches%rowtype; payload jsonb; batch uuid; item jsonb; account uuid; n integer:=0; d numeric:=0; c numeric:=0; x numeric; y numeric;
begin
  if auth.uid() is null or not public.is_org_owner(p_organization_id) or not public.org_has_module(p_organization_id,'banking') then raise exception 'Owner with active banking entitlement required' using errcode='42501'; end if;
  if p_source_key is null or p_source_key!~'^manual:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' or p_date is null or p_memo is null or length(btrim(p_memo)) not between 1 and 500 then raise exception 'Invalid journal header'; end if;
  if p_lines is null or jsonb_typeof(p_lines)<>'array' then raise exception 'Journal lines must be an array'; end if;
  if jsonb_array_length(p_lines) not between 2 and 200 then raise exception 'Two to 200 lines required'; end if;
  payload:=jsonb_build_object('date',p_date,'memo',btrim(p_memo),'lines',p_lines);
  -- Tenant lock serializes retries before the unique source constraint is reached.
  perform pg_advisory_xact_lock(hashtextextended(p_organization_id::text,0));
  select * into existing from public.journal_batches where organization_id=p_organization_id and source_key=p_source_key;
  if found then
    if existing.status<>'posted' or existing.request_payload<>payload then raise exception 'Idempotency key reused with a different journal'; end if;
    return existing.id;
  end if;
  insert into public.journal_batches(organization_id,source_key,journal_date,memo,request_payload) values(p_organization_id,p_source_key,p_date,btrim(p_memo),payload) returning id into batch;
  for item in select value from jsonb_array_elements(p_lines) loop
    if jsonb_typeof(item)<>'object' or coalesce(item->>'debitMinor','')!~'^[0-9]{1,15}$' or coalesce(item->>'creditMinor','')!~'^[0-9]{1,15}$' then raise exception 'Amounts must be nonnegative integer minor units'; end if;
    x:=(item->>'debitMinor')::numeric; y:=(item->>'creditMinor')::numeric;
    select id into account from public.ledger_accounts where organization_id=p_organization_id and code=item->>'accountCode';
    if account is null then raise exception 'Unknown account'; end if;
    n:=n+1;d:=d+x;c:=c+y;
    insert into public.journal_lines(organization_id,batch_id,account_id,line_no,debit_minor,credit_minor) values(p_organization_id,batch,account,n,x,y);
  end loop;
  if d<>c or d<=0 or d>9007199254740991 then raise exception 'Journal is not balanced'; end if;
  update public.journal_batches set status='posted' where id=batch and organization_id=p_organization_id;
  return batch;
end $$;
revoke all on function public.initialize_general_ledger(uuid), public.post_general_ledger_journal(uuid,text,date,text,jsonb) from public,anon;
grant execute on function public.initialize_general_ledger(uuid),public.post_general_ledger_journal(uuid,text,date,text,jsonb) to authenticated;

-- Aggregate in the database, not over a client-side truncated page of journal lines.
create function public.get_general_ledger_trial_balance(p_organization_id uuid)
returns table(account_id uuid,code text,name text,kind text,debit_minor numeric,credit_minor numeric)
language plpgsql stable security invoker set search_path='' as $$
begin
  if auth.uid() is null or not public.is_org_owner(p_organization_id) then raise exception 'Owner access required' using errcode='42501'; end if;
  return query select a.id,a.code,a.name,a.kind,
    greatest(coalesce(sum(l.debit_minor-l.credit_minor),0),0),
    greatest(coalesce(sum(l.credit_minor-l.debit_minor),0),0)
  from public.ledger_accounts a
  left join public.journal_lines l on l.organization_id=a.organization_id and l.account_id=a.id
  left join public.journal_batches b on b.organization_id=l.organization_id and b.id=l.batch_id
  where a.organization_id=p_organization_id and (b.status='posted' or b.id is null)
  group by a.id,a.code,a.name,a.kind order by a.code;
end $$;
revoke all on function public.get_general_ledger_trial_balance(uuid) from public,anon;
grant execute on function public.get_general_ledger_trial_balance(uuid) to authenticated;
