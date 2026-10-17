-- Prepared only. Existing purchasing/invoice gates remain unchanged.
create function inventory_internal.guard_invoice_legacy_source()
returns trigger language plpgsql security invoker set search_path='' as $$
begin
  if current_user in ('authenticated','anon') and exists(select 1 from public.purchase_invoice_settings where enabled and
    (organization_id=case when tg_op='DELETE' then old.organization_id else new.organization_id end
      or (tg_op='UPDATE' and organization_id=old.organization_id))) then
    raise exception 'Legacy supplier financial documents are read-only under invoice authority' using errcode='42501';
  end if;
  if tg_op='DELETE' then return old; end if;
  return new;
end;
$$;
revoke all on function inventory_internal.guard_invoice_legacy_source() from public,anon,authenticated;
create trigger purchases_invoice_source_guard before insert or update or delete on public.purchases for each row execute function inventory_internal.guard_invoice_legacy_source();
create trigger purchase_lines_invoice_source_guard before insert or update or delete on public.purchase_lines for each row execute function inventory_internal.guard_invoice_legacy_source();
create trigger supplier_payments_invoice_source_guard before insert or update or delete on public.supplier_payments for each row execute function inventory_internal.guard_invoice_legacy_source();

create table public.purchase_invoice_cash_settlements (
  organization_id uuid not null references public.organizations(id),
  id uuid not null,
  invoice_id uuid not null,
  supplier_id text not null references public.suppliers(id),
  amount_minor bigint not null check(amount_minor>0),
  payment_date date not null check(isfinite(payment_date)),
  note text not null default '' check(length(note)<=500),
  request jsonb not null,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  primary key(organization_id,id),
  foreign key(organization_id,invoice_id) references public.purchase_receipt_invoices(organization_id,id)
);
create index purchase_invoice_cash_settlements_invoice_idx on public.purchase_invoice_cash_settlements(organization_id,invoice_id,created_at);
create index purchase_invoice_cash_settlements_supplier_idx on public.purchase_invoice_cash_settlements(organization_id,supplier_id,payment_date);
alter table public.purchase_invoice_cash_settlements enable row level security;
revoke all on public.purchase_invoice_cash_settlements from public,anon,authenticated;
grant select on public.purchase_invoice_cash_settlements to authenticated;
create policy purchase_invoice_cash_settlements_read on public.purchase_invoice_cash_settlements for select to authenticated using(public.can_see_org_financials(organization_id));

create function public.settle_purchase_invoice_cash_atomic(
  p_organization_id uuid,p_settlement_id uuid,p_invoice_id uuid,p_amount numeric,p_payment_date date,p_note text default ''
) returns jsonb language plpgsql security definer set search_path='' as $$
declare
  prior public.purchase_invoice_cash_settlements%rowtype; bill public.purchase_receipt_invoices%rowtype;
  canonical jsonb; amount bigint; paid numeric; balance numeric; memo text;
begin
  perform inventory_internal.require_purchase_authority(p_organization_id);
  perform 1 from public.purchase_invoice_settings where organization_id=p_organization_id and enabled for share;
  if not found then raise exception 'Receipt-linked supplier invoicing is not enabled'; end if;
  memo:=btrim(coalesce(p_note,''));
  if p_settlement_id is null or p_invoice_id is null or p_payment_date is null or not isfinite(p_payment_date)
    or p_amount is null or p_amount<=0 or p_amount::text in ('NaN','Infinity','-Infinity') or round(p_amount,2)<>p_amount or length(memo)>500 then
    raise exception 'Supply a settlement key, invoice, valid date, positive two-decimal amount and a note up to 500 characters'; end if;
  amount:=(p_amount*100)::bigint;
  canonical:=jsonb_build_object('invoice',p_invoice_id,'amount_minor',amount,'date',p_payment_date,'note',memo);
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_organization_id::text||p_settlement_id::text,0));
  select * into prior from public.purchase_invoice_cash_settlements where organization_id=p_organization_id and id=p_settlement_id;
  if found then
    if prior.request<>canonical then raise exception 'Settlement key was reused with different details'; end if;
    return to_jsonb(prior);
  end if;
  select * into bill from public.purchase_receipt_invoices where organization_id=p_organization_id and id=p_invoice_id for update;
  if not found or bill.currency<>'LKR' then raise exception 'An LKR invoice in this company is required'; end if;
  if p_payment_date<bill.invoice_date then raise exception 'Payment date cannot precede the invoice date'; end if;
  select coalesce(sum(amount_minor),0) into paid from public.purchase_invoice_cash_settlements where organization_id=p_organization_id and invoice_id=p_invoice_id;
  if paid+amount>bill.total_minor then raise exception 'Payment exceeds the outstanding invoice amount'; end if;
  select payable_balance into balance from public.suppliers where organization_id=p_organization_id and id=bill.supplier_id for update;
  if not found or balance is null or balance::text in ('NaN','Infinity','-Infinity') or balance<p_amount then
    raise exception 'Supplier payable requires reconciliation before this payment'; end if;
  insert into public.purchase_invoice_cash_settlements(organization_id,id,invoice_id,supplier_id,amount_minor,payment_date,note,request,created_by)
    values(p_organization_id,p_settlement_id,p_invoice_id,bill.supplier_id,amount,p_payment_date,memo,canonical,auth.uid()) returning * into prior;
  update public.suppliers set payable_balance=payable_balance-p_amount where organization_id=p_organization_id and id=bill.supplier_id;
  return to_jsonb(prior);
end;
$$;
revoke all on function public.settle_purchase_invoice_cash_atomic(uuid,uuid,uuid,numeric,date,text) from public,anon;
grant execute on function public.settle_purchase_invoice_cash_atomic(uuid,uuid,uuid,numeric,date,text) to authenticated;

create function public.get_purchase_invoice_settlement(p_organization_id uuid,p_invoice_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare bill public.purchase_receipt_invoices%rowtype; balance numeric;
begin
  if auth.uid() is null or not public.can_see_org_financials(p_organization_id) then raise exception 'Owner financial access required' using errcode='42501'; end if;
  select * into bill from public.purchase_receipt_invoices where organization_id=p_organization_id and id=p_invoice_id for share;
  if not found then raise exception 'Invoice not found in this company'; end if;
  select payable_balance into balance from public.suppliers where organization_id=p_organization_id and id=bill.supplier_id for share;
  return jsonb_build_object('organization_id',p_organization_id,'invoice_id',bill.id,'number',bill.supplier_invoice_no,'invoice_date',bill.invoice_date,
    'total_minor',bill.total_minor,'paid_minor',(select coalesce(sum(amount_minor),0) from public.purchase_invoice_cash_settlements where organization_id=p_organization_id and invoice_id=bill.id),
    'payable_balance',balance,'payments',coalesce((select jsonb_agg(to_jsonb(s) order by s.created_at desc,s.id) from
      (select id,amount_minor,payment_date,note,created_at from public.purchase_invoice_cash_settlements where organization_id=p_organization_id and invoice_id=bill.id order by created_at desc,id limit 50) s),'[]'::jsonb));
end;
$$;
revoke all on function public.get_purchase_invoice_settlement(uuid,uuid) from public,anon;
grant execute on function public.get_purchase_invoice_settlement(uuid,uuid) to authenticated;

-- The opening adjustment reconciles retained legacy/opening balances. It is
-- labelled explicitly rather than presenting incomplete history as zero-based.
create function public.get_purchase_supplier_statement(p_organization_id uuid,p_supplier_id text,p_page integer default 0)
returns jsonb language plpgsql security definer set search_path='' as $$
declare balance numeric; output jsonb;
begin
  if auth.uid() is null or not public.can_see_org_financials(p_organization_id) then raise exception 'Owner financial access required' using errcode='42501'; end if;
  if p_page is null or p_page<0 or p_page>100000 then raise exception 'Invalid statement page'; end if;
  select payable_balance into balance from public.suppliers where organization_id=p_organization_id and id=p_supplier_id for share;
  if not found or balance is null or balance::text in ('NaN','Infinity','-Infinity') then raise exception 'Supplier balance not available in this company'; end if;
  with entries as (
    select purchase_date as date,'grn:'||id as identity,'GRN '||grn_no as label,round(credit_amount*100)::numeric as amount_minor,0 as sort_priority
      from public.purchases where organization_id=p_organization_id and supplier_id=p_supplier_id and credit_amount>0
    union all select payment_date,'legacy-payment:'||id,'Supplier payment ('||method||')',-round(amount*100)::numeric,1
      from public.supplier_payments where organization_id=p_organization_id and supplier_id=p_supplier_id
    union all select invoice_date::timestamp at time zone 'Asia/Colombo','invoice:'||id::text,'Invoice '||supplier_invoice_no,total_minor::numeric,0
      from public.purchase_receipt_invoices where organization_id=p_organization_id and supplier_id=p_supplier_id
    union all select payment_date::timestamp at time zone 'Asia/Colombo','cash:'||id::text,'Invoice cash payment',-amount_minor::numeric,1
      from public.purchase_invoice_cash_settlements where organization_id=p_organization_id and supplier_id=p_supplier_id
  ), totals as (select coalesce(sum(amount_minor),0) as net,count(*) as count from entries),
  numbered as (select *,round(balance*100)-(select net from totals)+sum(amount_minor) over(order by date,sort_priority,identity) as balance_minor from entries),
  page as (select * from numbered order by date,sort_priority,identity limit 50 offset (p_page::bigint*50))
  select jsonb_build_object('organization_id',p_organization_id,'supplier_id',p_supplier_id,'payable_balance',balance,'page',p_page,
    'opening_minor',round(balance*100)-(select net from totals),'count',(select count from totals),'entries',coalesce((select jsonb_agg(to_jsonb(page) order by date,sort_priority,identity) from page),'[]'::jsonb)) into output;
  return output;
end;
$$;
revoke all on function public.get_purchase_supplier_statement(uuid,text,integer) from public,anon;
grant execute on function public.get_purchase_supplier_statement(uuid,text,integer) to authenticated;
