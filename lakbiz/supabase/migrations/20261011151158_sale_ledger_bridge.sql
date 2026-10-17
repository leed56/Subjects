-- Opt-in, new-sale revenue/VAT bridge. No backfill, COGS or settlement posting.
create schema if not exists ledger_internal;
revoke all on schema ledger_internal from public,anon,authenticated;

create table public.ledger_sales_settings (
  organization_id uuid primary key references public.organizations(id),
  enabled boolean not null default false,
  updated_by uuid not null references auth.users(id),
  updated_at timestamptz not null default now()
);
create table public.ledger_sale_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  sale_id text not null references public.sales_base(id) on delete restrict,
  status text not null default 'pending' check(status in ('pending','posted','needs_review')),
  reason text,
  journal_id uuid references public.journal_batches(id) on delete restrict,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  unique(organization_id,sale_id),
  check ((status='posted' and journal_id is not null and reason is null) or
         (status<>'posted' and journal_id is null))
);
create index ledger_sale_events_review_idx on public.ledger_sale_events(organization_id,status,created_at,id);
create index ledger_sale_events_recent_idx on public.ledger_sale_events(organization_id,created_at desc,id desc);
create index ledger_sale_events_source_idx on public.ledger_sale_events(sale_id);
alter table public.ledger_sales_settings enable row level security;
alter table public.ledger_sale_events enable row level security;
create policy ledger_sales_settings_owner_read on public.ledger_sales_settings for select to authenticated using(public.is_org_owner(organization_id));
create policy ledger_sale_events_owner_read on public.ledger_sale_events for select to authenticated using(public.is_org_owner(organization_id));
revoke all on public.ledger_sales_settings,public.ledger_sale_events from public,anon,authenticated;
grant select on public.ledger_sales_settings,public.ledger_sale_events to authenticated;

alter table public.journal_batches drop constraint journal_batches_source_key_check;
alter table public.journal_batches add constraint journal_batches_source_key_check check(
  source_key ~ '^(manual|sale):[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
);
-- Only the trusted bridge may create sale-source headers; owners keep manual entries.
alter policy journal_batches_owner_insert on public.journal_batches with check (
  public.is_org_owner(organization_id) and public.org_has_module(organization_id,'banking')
  and created_by=(select auth.uid()) and source_key like 'manual:%'
);

create function public.set_sales_ledger_enabled(p_organization_id uuid,p_enabled boolean,p_acknowledgement text default '')
returns void language plpgsql security definer set search_path='' as $$
begin
  if auth.uid() is null or not public.is_org_owner(p_organization_id) or not public.org_has_module(p_organization_id,'banking') then
    raise exception 'Owner with active banking entitlement required' using errcode='42501';
  end if;
  if p_enabled is null then raise exception 'Enabled flag required'; end if;
  -- POS finalizers lock this same organization row: activation has a serialized boundary.
  perform 1 from public.organizations where id=p_organization_id for update;
  if p_enabled then
    if p_acknowledgement is distinct from 'NEW_SALES_REVENUE_ONLY' then raise exception 'Acknowledge revenue-only scope'; end if;
    if (select count(*) from public.ledger_accounts where organization_id=p_organization_id and
        (code,kind) in (('1000','asset'),('1010','asset'),('1020','asset'),('1100','asset'),('4000','income'),('2100','liability')))<>6 then
      raise exception 'Initialize the standard chart of accounts first';
    end if;
  end if;
  insert into public.ledger_sales_settings(organization_id,enabled,updated_by)
  values(p_organization_id,p_enabled,auth.uid()) on conflict(organization_id)
  do update set enabled=excluded.enabled,updated_by=excluded.updated_by,updated_at=now();
end $$;
revoke all on function public.set_sales_ledger_enabled(uuid,boolean,text) from public,anon;
grant execute on function public.set_sales_ledger_enabled(uuid,boolean,text) to authenticated;

-- Privileged execution is limited to internal triggers. Payload is always re-read from DB.
create function ledger_internal.post_sale_event(p_event_id uuid)
returns void language plpgsql security definer set search_path='' as $$
declare e public.ledger_sale_events%rowtype; s public.sales_base%rowtype;
  t record; a uuid; batch uuid; n integer:=0; paid numeric:=0;
  lines jsonb:='[]'; why text; source text;
begin
  select * into e from public.ledger_sale_events where id=p_event_id for update;
  if not found or e.status<>'pending' then return; end if;
  select * into s from public.sales_base where id=e.sale_id and organization_id=e.organization_id for update;
  if not found then why:='Sale source missing';
  elsif e.created_by is null or e.created_by is distinct from auth.uid() or not public.org_member_role_in(e.organization_id,array['owner','manager','data_entry','cashier'])
    then why:='Authorized POS actor required';
  elsif not public.org_has_module(e.organization_id,'banking') then why:='Banking entitlement inactive';
  elsif s.total is null or s.subtotal is null or s.output_vat is null or s.sale_date is null or not isfinite(s.sale_date)
    or not (s.total>0 and s.total*100<=100000000000000 and s.subtotal>=0 and s.output_vat>=0
      and s.subtotal+s.output_vat=s.total and trunc(s.total*100)=s.total*100
      and trunc(s.subtotal*100)=s.subtotal*100 and trunc(s.output_vat*100)=s.output_vat*100)
    then why:='Invalid sale totals or date';
  elsif not exists(select 1 from public.sale_tenders where sale_id=s.id and organization_id=s.organization_id)
    then why:='Normalized tender evidence required';
  elsif exists(select 1 from public.sale_tenders where sale_id=s.id and organization_id=s.organization_id and
      (kind is null or kind not in ('cash','card','bank_transfer','credit') or amount is null or not(amount>0 and amount*100<=100000000000000 and trunc(amount*100)=amount*100)))
    then why:='Unsupported or invalid tender: cheque/return credit need separate adapters';
  else
    for t in select case kind when 'cash' then '1000' when 'card' then '1020' when 'bank_transfer' then '1010' when 'credit' then '1100' end as code,
      sum(amount)*100 as amount from public.sale_tenders where sale_id=s.id and organization_id=s.organization_id group by kind order by kind loop
      paid:=paid+t.amount;
      lines:=lines||jsonb_build_array(jsonb_build_object('accountCode',t.code,'debitMinor',t.amount,'creditMinor',0));
    end loop;
    if paid<>s.total*100 then why:='Tender total does not equal invoice total';
    elsif exists(select 1 from jsonb_array_elements(lines) x where (x->>'debitMinor')::numeric>100000000000000) then why:='Tender aggregate too large';
    else
      if s.subtotal>0 then lines:=lines||jsonb_build_array(jsonb_build_object('accountCode','4000','debitMinor',0,'creditMinor',s.subtotal*100)); end if;
      if s.output_vat>0 then lines:=lines||jsonb_build_array(jsonb_build_object('accountCode','2100','debitMinor',0,'creditMinor',s.output_vat*100)); end if;
      if exists(select 1 from jsonb_array_elements(lines) x where not exists(select 1 from public.ledger_accounts ac where ac.organization_id=e.organization_id and ac.code=x->>'accountCode')) then why:='Required ledger account missing'; end if;
    end if;
  end if;
  if why is not null then update public.ledger_sale_events set status='needs_review',reason=why where id=e.id; return; end if;
  perform pg_advisory_xact_lock(hashtextextended(e.organization_id::text,0));
  source:='sale:'||e.id::text;
  if exists(select 1 from public.journal_batches where organization_id=e.organization_id and source_key=source) then
    raise exception 'Unexpected sale journal collision';
  end if;
  insert into public.journal_batches(organization_id,source_key,journal_date,memo,request_payload,created_by)
    values(e.organization_id,source,(s.sale_date at time zone 'Asia/Colombo')::date,
      left('Sale '||coalesce(s.bill_no,s.id)||' · revenue/VAT only',500),
      jsonb_build_object('saleId',s.id,'total',s.total,'subtotal',s.subtotal,'vat',s.output_vat,'lines',lines),e.created_by)
    returning id into batch;
  for t in select value as body from jsonb_array_elements(lines) loop
    select id into a from public.ledger_accounts where organization_id=e.organization_id and code=t.body->>'accountCode';
    n:=n+1;
    insert into public.journal_lines(organization_id,batch_id,account_id,line_no,debit_minor,credit_minor)
      values(e.organization_id,batch,a,n,(t.body->>'debitMinor')::numeric,(t.body->>'creditMinor')::numeric);
  end loop;
  update public.journal_batches set status='posted' where id=batch;
  update public.ledger_sale_events set status='posted',journal_id=batch where id=e.id;
end $$;
revoke all on function ledger_internal.post_sale_event(uuid) from public,anon,authenticated;

create function ledger_internal.capture_sale() returns trigger language plpgsql security definer set search_path='' as $$
begin
  if exists(select 1 from public.ledger_sales_settings where organization_id=new.organization_id and enabled) then
    insert into public.ledger_sale_events(organization_id,sale_id,created_by) values(new.organization_id,new.id,auth.uid());
  end if;
  return new;
end $$;
create function ledger_internal.process_captured_sale() returns trigger language plpgsql security definer set search_path='' as $$
begin perform ledger_internal.post_sale_event(new.id); return null; end $$;
revoke all on function ledger_internal.capture_sale(),ledger_internal.process_captured_sale() from public,anon,authenticated;
create trigger capture_sale_for_ledger after insert on public.sales_base for each row execute function ledger_internal.capture_sale();
create constraint trigger process_sale_for_ledger after insert on public.ledger_sale_events deferrable initially deferred for each row execute function ledger_internal.process_captured_sale();

-- Do not allow a posted source to be silently edited or its tender evidence replaced.
create function ledger_internal.guard_posted_sale_source() returns trigger language plpgsql security definer set search_path='' as $$
declare sale text; org uuid; posted boolean;
begin
  if tg_table_name='sales_base' then sale:=old.id; org:=old.organization_id;
  elsif tg_op='INSERT' then sale:=new.sale_id; org:=new.organization_id;
  else sale:=old.sale_id; org:=old.organization_id; end if;
  select exists(select 1 from public.ledger_sale_events where organization_id=org and sale_id=sale and status='posted') into posted;
  if tg_table_name='sale_tenders' and tg_op='UPDATE' then
    posted:=posted or exists(select 1 from public.ledger_sale_events where organization_id=new.organization_id and sale_id=new.sale_id and status='posted');
  end if;
  if posted then
    if tg_table_name='sale_tenders' or tg_op='DELETE' then raise exception 'Posted sale accounting evidence is immutable'; end if;
    if (new.id,new.organization_id,new.total,new.subtotal,new.output_vat,new.sale_date,new.bill_no)
       is distinct from (old.id,old.organization_id,old.total,old.subtotal,old.output_vat,old.sale_date,old.bill_no) then
      raise exception 'Posted sale totals/date cannot be edited; use a controlled reversal';
    end if;
  end if;
  if tg_op='DELETE' then return old; else return new; end if;
end $$;
revoke all on function ledger_internal.guard_posted_sale_source() from public,anon,authenticated;
create trigger guard_posted_sale_source before update or delete on public.sales_base for each row execute function ledger_internal.guard_posted_sale_source();
create trigger guard_posted_sale_tenders before insert or update or delete on public.sale_tenders for each row execute function ledger_internal.guard_posted_sale_source();
