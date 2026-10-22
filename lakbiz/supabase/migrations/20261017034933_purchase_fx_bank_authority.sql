-- Prepared FX and banking authority; no organization is enabled.
alter table public.purchase_receipt_invoices drop constraint purchase_receipt_invoices_currency_check;
alter table public.purchase_receipt_invoices add constraint purchase_invoice_currency_supported check(currency in ('LKR','USD','EUR','GBP','INR','AED','CNY'));
alter table public.purchase_receipt_invoices add column foreign_subtotal_minor bigint not null default 0 check(foreign_subtotal_minor>=0),add column foreign_total_minor bigint not null default 0 check(foreign_total_minor>=0),add column recognition_rate numeric(20,6) not null default 1 check(recognition_rate>0 and recognition_rate<>'NaN'::numeric);
alter table public.purchase_receipt_invoice_lines add column foreign_unit_cost_minor bigint not null default 0 check(foreign_unit_cost_minor>=0),add column foreign_line_total_minor bigint not null default 0 check(foreign_line_total_minor>=0);
update public.purchase_receipt_invoices set foreign_subtotal_minor=subtotal_minor,foreign_total_minor=total_minor;
update public.purchase_receipt_invoice_lines set foreign_unit_cost_minor=unit_cost_minor,foreign_line_total_minor=line_total_minor;
alter function public.record_purchase_receipt_invoice_atomic(uuid,uuid,uuid[],text,date,numeric,jsonb) set schema inventory_internal;
revoke all on function inventory_internal.record_purchase_receipt_invoice_atomic(uuid,uuid,uuid[],text,date,numeric,jsonb) from public,anon,authenticated;
create function public.record_purchase_receipt_invoice_atomic(p_organization_id uuid,p_invoice_id uuid,p_receipt_ids uuid[],p_supplier_invoice_no text,p_invoice_date date,p_input_vat numeric,p_lines jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
 perform inventory_internal.record_purchase_receipt_invoice_atomic(p_organization_id,p_invoice_id,p_receipt_ids,p_supplier_invoice_no,p_invoice_date,p_input_vat,p_lines);
 update public.purchase_receipt_invoices set foreign_subtotal_minor=subtotal_minor,foreign_total_minor=total_minor where organization_id=p_organization_id and id=p_invoice_id returning to_jsonb(purchase_receipt_invoices) into result;
 update public.purchase_receipt_invoice_lines set foreign_unit_cost_minor=unit_cost_minor,foreign_line_total_minor=line_total_minor where organization_id=p_organization_id and invoice_id=p_invoice_id;
 return result;
end;
$$;
revoke all on function public.record_purchase_receipt_invoice_atomic(uuid,uuid,uuid[],text,date,numeric,jsonb) from public,anon;
grant execute on function public.record_purchase_receipt_invoice_atomic(uuid,uuid,uuid[],text,date,numeric,jsonb) to authenticated;
create function public.record_purchase_receipt_invoice_fx_atomic(
  p_organization_id uuid,p_invoice_id uuid,p_receipt_ids uuid[],p_supplier_invoice_no text,
  p_invoice_date date,p_input_vat numeric,p_lines jsonb,p_currency text,p_exchange_rate numeric
) returns jsonb language plpgsql security definer set search_path='' as $$
declare
  prior public.purchase_receipt_invoices%rowtype;
  po public.purchase_orders%rowtype; delivery public.purchase_order_receipts%rowtype;
  order_line public.purchase_order_lines%rowtype;
  sorted_receipts uuid[]; receipt uuid; po_id text; canonical_lines jsonb; canonical jsonb;
  requested jsonb; received_line jsonb; price numeric; quantity numeric;
  cost_minor bigint; line_minor bigint; subtotal bigint:=0; vat_minor bigint; balance numeric;
  expected_lines integer:=0; invoice_no text; foreign_subtotal bigint:=0; foreign_line bigint;
begin
  if p_currency is null or p_currency not in ('USD','EUR','GBP','INR','AED','CNY') or p_exchange_rate is null or p_exchange_rate<=0 or p_exchange_rate::text in ('NaN','Infinity','-Infinity') or round(p_exchange_rate,6)<>p_exchange_rate or p_input_vat<>0 then raise exception 'Foreign invoices require a supported currency, positive six-decimal FX quote and zero local import VAT';end if;
  perform inventory_internal.require_purchase_authority(p_organization_id);
  perform 1 from public.purchase_invoice_settings where organization_id=p_organization_id and enabled for share;
  if not found then raise exception 'Receipt-linked supplier invoicing is not enabled'; end if;
  invoice_no:=nullif(btrim(p_supplier_invoice_no),'');
  if p_invoice_id is null or invoice_no is null or length(invoice_no)>100 or p_invoice_date is null or not isfinite(p_invoice_date)
    or p_input_vat is null or p_input_vat<0 or p_input_vat::text in ('NaN','Infinity','-Infinity') or round(p_input_vat,2)<>p_input_vat
    or p_receipt_ids is null or cardinality(p_receipt_ids) not between 1 and 20 or array_position(p_receipt_ids,null) is not null then
    raise exception 'Supply a valid invoice key, number, date, VAT and 1 to 20 receipts'; end if;
  select array_agg(id order by id) into sorted_receipts from (select distinct unnest(p_receipt_ids) as id) ids;
  if cardinality(sorted_receipts)<>cardinality(p_receipt_ids) then raise exception 'Duplicate delivery identities are not allowed'; end if;
  if jsonb_typeof(p_lines) is distinct from 'array' then raise exception 'Invoice rates must be an array'; end if;
  if jsonb_array_length(p_lines) not between 1 and 4000 then raise exception 'Supply 1 to 4000 receipt-line rates'; end if;
  select jsonb_agg(jsonb_build_object('receipt_id',(value->>'receipt_id')::uuid,'line_id',(value->>'line_id')::uuid,'unit_cost',(value->>'unit_cost')::numeric)
    order by (value->>'receipt_id')::uuid,(value->>'line_id')::uuid) into canonical_lines from jsonb_array_elements(p_lines);
  if (select count(distinct (value->>'receipt_id',value->>'line_id')) from jsonb_array_elements(canonical_lines))<>jsonb_array_length(canonical_lines) then
    raise exception 'Duplicate invoice line identities are not allowed'; end if;
  vat_minor:=(p_input_vat*100)::bigint;
  canonical:=jsonb_build_object('receipts',to_jsonb(sorted_receipts),'number',upper(invoice_no),'date',p_invoice_date,'vat_minor',vat_minor,'lines',canonical_lines);
  canonical:=canonical||jsonb_build_object('currency',p_currency,'exchange_rate',p_exchange_rate);
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_organization_id::text||p_invoice_id::text,0));
  select * into prior from public.purchase_receipt_invoices where organization_id=p_organization_id and id=p_invoice_id;
  if found then
    if prior.request<>canonical then raise exception 'Invoice key was reused with different details'; end if;
    return to_jsonb(prior);
  end if;
  select purchase_order_id into po_id from public.purchase_order_receipts where organization_id=p_organization_id and receipt_id=sorted_receipts[1];
  if not found then raise exception 'Delivery not found in this organization'; end if;
  -- Same order lock as receiving/cancellation, then sorted deliveries and
  -- source identity locks before the supplier. Billing never updates stock.
  select * into po from public.purchase_orders where id=po_id and organization_id=p_organization_id for update;
  if not found then raise exception 'Purchase order not found in this organization'; end if;
  foreach receipt in array sorted_receipts loop
    select * into delivery from public.purchase_order_receipts where organization_id=p_organization_id and receipt_id=receipt for update;
    if not found or delivery.purchase_order_id<>po.id then raise exception 'Every delivery must belong to the same purchase order and organization'; end if;
    if exists(select 1 from public.purchase_invoice_receipts where organization_id=p_organization_id and receipt_id=receipt) then
      raise exception 'This delivery is already linked to a supplier invoice'; end if;
    expected_lines:=expected_lines+jsonb_array_length(delivery.request_lines);
  end loop;
  if expected_lines<>jsonb_array_length(canonical_lines) then raise exception 'Invoice must cover every line of the selected deliveries exactly once'; end if;
  -- Invoice-line FKs need product key-share locks. Acquire them explicitly
  -- before the supplier, matching receiving's product-before-supplier order.
  perform 1 from public.products_base p where p.organization_id=p_organization_id and p.id in(
    select product_id from public.purchase_order_lines where purchase_order_id=po.id and organization_id=p_organization_id
  ) order by p.id for key share;
  select payable_balance into balance from public.suppliers where id=po.supplier_id and organization_id=p_organization_id for update;
  if not found or balance is null or balance::text in ('NaN','Infinity','-Infinity') then raise exception 'Supplier payable requires review'; end if;
  insert into public.purchase_receipt_invoices(organization_id,id,purchase_order_id,supplier_id,supplier_invoice_no,invoice_date,subtotal_minor,input_vat_minor,total_minor,request,created_by,currency,recognition_rate)
    values(p_organization_id,p_invoice_id,po.id,po.supplier_id,invoice_no,p_invoice_date,0,vat_minor,vat_minor,canonical,auth.uid(),p_currency,p_exchange_rate);
  foreach receipt in array sorted_receipts loop
    insert into public.purchase_invoice_receipts(organization_id,receipt_id,invoice_id) values(p_organization_id,receipt,p_invoice_id);
  end loop;
  for requested in select value from jsonb_array_elements(canonical_lines) loop
    receipt:=(requested->>'receipt_id')::uuid;
    if receipt is null or not(receipt=any(sorted_receipts)) then raise exception 'Invoice rate references an unselected delivery'; end if;
    select value into received_line from public.purchase_order_receipts r cross join lateral jsonb_array_elements(r.request_lines)
      where r.organization_id=p_organization_id and r.receipt_id=receipt and value->>'line_id'=requested->>'line_id';
    if not found then raise exception 'Invoice rate does not match a received line'; end if;
    select * into order_line from public.purchase_order_lines where id=(requested->>'line_id')::uuid and purchase_order_id=po.id and organization_id=p_organization_id;
    if not found then raise exception 'Received purchase line requires review'; end if;
    if not exists(select 1 from public.products_base where id=order_line.product_id and organization_id=p_organization_id) then
      raise exception 'Received product must belong to this organization'; end if;
    price:=(requested->>'unit_cost')::numeric; quantity:=(received_line->>'qty')::numeric;
    if price is null or price<0 or price::text in ('NaN','Infinity','-Infinity') or round(price,2)<>price
      or quantity is null or quantity<=0 or quantity::text in ('NaN','Infinity','-Infinity') or round(quantity,3)<>quantity then
      raise exception 'Invalid invoice price or recorded delivery quantity'; end if;
    foreign_line:=round(quantity*price*100)::bigint;foreign_subtotal:=foreign_subtotal+foreign_line;cost_minor:=round(price*100*p_exchange_rate)::bigint;
    line_minor:=round(foreign_line*p_exchange_rate)::bigint;
    subtotal:=subtotal+line_minor;
    insert into public.purchase_receipt_invoice_lines(organization_id,invoice_id,receipt_id,purchase_order_line_id,product_id,product_name,qty,unit_cost_minor,line_total_minor,foreign_unit_cost_minor,foreign_line_total_minor)
      values(p_organization_id,p_invoice_id,receipt,order_line.id,order_line.product_id,order_line.product_name,quantity,cost_minor,line_minor,(price*100)::bigint,foreign_line);
  end loop;
  if foreign_subtotal>0 and subtotal=0 then raise exception 'The FX quote rounds the entire invoice below one LKR cent';end if;
  update public.purchase_receipt_invoices set subtotal_minor=subtotal,total_minor=subtotal+vat_minor,foreign_subtotal_minor=foreign_subtotal,foreign_total_minor=foreign_subtotal where organization_id=p_organization_id and id=p_invoice_id returning * into prior;
  update public.suppliers set payable_balance=payable_balance+(subtotal+vat_minor)::numeric/100 where id=po.supplier_id and organization_id=p_organization_id;
  return to_jsonb(prior);
end;
$$;

revoke all on function public.record_purchase_receipt_invoice_fx_atomic(uuid,uuid,uuid[],text,date,numeric,jsonb,text,numeric) from public,anon;
grant execute on function public.record_purchase_receipt_invoice_fx_atomic(uuid,uuid,uuid[],text,date,numeric,jsonb,text,numeric) to authenticated;

create table public.purchase_invoice_bank_settlements(
 organization_id uuid not null references public.organizations(id),id uuid not null,invoice_id uuid not null,supplier_id text not null references public.suppliers(id),account_id text not null references public.bank_accounts(id),
 foreign_amount_minor bigint not null check(foreign_amount_minor>0),carrying_minor bigint not null check(carrying_minor>=0),paid_minor bigint not null check(paid_minor>0),fee_minor bigint not null check(fee_minor>=0),
 exchange_rate numeric(20,6) not null check(exchange_rate>0 and exchange_rate<>'NaN'::numeric),exchange_difference_minor bigint not null check(exchange_difference_minor=paid_minor-carrying_minor),
 payment_date date not null check(isfinite(payment_date)),note text not null check(length(note)<=500),request jsonb not null,created_by uuid not null references auth.users(id),created_at timestamptz not null default now(),
 primary key(organization_id,id),foreign key(organization_id,invoice_id) references public.purchase_receipt_invoices(organization_id,id)
);
create index purchase_invoice_bank_settlements_invoice_idx on public.purchase_invoice_bank_settlements(organization_id,invoice_id,created_at);
create index purchase_invoice_bank_settlements_account_idx on public.purchase_invoice_bank_settlements(organization_id,account_id,created_at);
create index purchase_invoice_bank_settlements_supplier_idx on public.purchase_invoice_bank_settlements(organization_id,supplier_id,payment_date);
alter table public.purchase_invoice_bank_settlements enable row level security;
revoke all on public.purchase_invoice_bank_settlements from public,anon,authenticated;
grant select on public.purchase_invoice_bank_settlements to authenticated;
create policy purchase_invoice_bank_settlements_read on public.purchase_invoice_bank_settlements for select to authenticated using(public.can_see_org_financials(organization_id));

create function public.settle_purchase_invoice_bank_atomic(p_organization_id uuid,p_settlement_id uuid,p_invoice_id uuid,p_account_id text,p_foreign_amount numeric,p_exchange_rate numeric,p_fee numeric,p_payment_date date,p_note text default '')
returns jsonb language plpgsql security definer set search_path='' as $$
declare bill public.purchase_receipt_invoices%rowtype;prior public.purchase_invoice_bank_settlements%rowtype;account public.bank_accounts%rowtype;
 foreign_minor bigint;paid bigint;fee bigint;carrying bigint;foreign_paid numeric;book_paid numeric;balance numeric;canonical jsonb;memo text;
begin
 perform inventory_internal.require_purchase_authority(p_organization_id);
 if not public.org_member_can_write_module(p_organization_id,'banking') then raise exception 'Banking write access required' using errcode='42501';end if;
 perform 1 from public.purchase_invoice_settings where organization_id=p_organization_id and enabled for share;if not found then raise exception 'Invoice authority is not enabled';end if;
 memo:=btrim(coalesce(p_note,''));
 if p_settlement_id is null or p_invoice_id is null or nullif(p_account_id,'') is null or p_payment_date is null or not isfinite(p_payment_date) or length(memo)>500
   or p_foreign_amount is null or p_foreign_amount<=0 or round(p_foreign_amount,2)<>p_foreign_amount or p_foreign_amount::text in ('NaN','Infinity','-Infinity')
   or p_exchange_rate is null or p_exchange_rate<=0 or round(p_exchange_rate,6)<>p_exchange_rate or p_exchange_rate::text in ('NaN','Infinity','-Infinity')
   or p_fee is null or p_fee<0 or round(p_fee,2)<>p_fee or p_fee::text in ('NaN','Infinity','-Infinity') then raise exception 'Supply valid bank settlement amounts, FX quote, date and reference';end if;
 foreign_minor:=(p_foreign_amount*100)::bigint;paid:=round(foreign_minor*p_exchange_rate)::bigint;fee:=(p_fee*100)::bigint;
 if paid<=0 then raise exception 'Bank payment must have a positive LKR cash value';end if;
 canonical:=jsonb_build_object('invoice',p_invoice_id,'account',p_account_id,'foreign_minor',foreign_minor,'exchange_rate',p_exchange_rate,'fee_minor',fee,'date',p_payment_date,'note',memo);
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('bank-settlement:'||p_organization_id::text||p_settlement_id::text,0));
 select * into prior from public.purchase_invoice_bank_settlements where organization_id=p_organization_id and id=p_settlement_id;
 if found then if prior.request<>canonical then raise exception 'Bank settlement key was reused with different details';end if;return to_jsonb(prior);end if;
 select * into bill from public.purchase_receipt_invoices where organization_id=p_organization_id and id=p_invoice_id for update;
 if not found or bill.foreign_total_minor<=0 then raise exception 'A payable invoice in this company is required';end if;
 if p_payment_date<bill.invoice_date or (bill.currency='LKR' and p_exchange_rate<>1) then raise exception 'Payment date or LKR exchange rate is invalid';end if;
 select coalesce(sum(foreign_amount_minor),0),coalesce(sum(carrying_minor),0) into foreign_paid,book_paid from public.purchase_invoice_bank_settlements where organization_id=p_organization_id and invoice_id=p_invoice_id;
 select foreign_paid+coalesce(sum(amount_minor),0),book_paid+coalesce(sum(amount_minor),0) into foreign_paid,book_paid from public.purchase_invoice_cash_settlements where organization_id=p_organization_id and invoice_id=p_invoice_id;
 if foreign_paid+foreign_minor>bill.foreign_total_minor then raise exception 'Payment exceeds the foreign invoice outstanding';end if;
 carrying:=round(bill.total_minor::numeric*(foreign_paid+foreign_minor)/bill.foreign_total_minor)::bigint-book_paid::bigint;
 if carrying<0 or book_paid+carrying>bill.total_minor then raise exception 'Invoice carrying balance requires reconciliation';end if;
 select payable_balance into balance from public.suppliers where organization_id=p_organization_id and id=bill.supplier_id for update;
 if not found or balance is null or balance::text in ('NaN','Infinity','-Infinity') or balance<carrying::numeric/100 then raise exception 'Supplier payable requires reconciliation';end if;
 select * into account from public.bank_accounts where organization_id=p_organization_id and id=p_account_id for update;
 if not found or account.balance is null or account.balance::text in ('NaN','Infinity','-Infinity') or account.balance<(paid+fee)::numeric/100 then raise exception 'Bank account is unavailable or has insufficient funds';end if;
 insert into public.purchase_invoice_bank_settlements(organization_id,id,invoice_id,supplier_id,account_id,foreign_amount_minor,carrying_minor,paid_minor,fee_minor,exchange_rate,exchange_difference_minor,payment_date,note,request,created_by)
   values(p_organization_id,p_settlement_id,p_invoice_id,bill.supplier_id,p_account_id,foreign_minor,carrying,paid,fee,p_exchange_rate,paid-carrying,p_payment_date,memo,canonical,auth.uid()) returning * into prior;
 update public.suppliers set payable_balance=payable_balance-carrying::numeric/100 where organization_id=p_organization_id and id=bill.supplier_id;
 update public.bank_accounts b set balance=b.balance-(paid+fee)::numeric/100 where organization_id=p_organization_id and id=p_account_id;
 insert into public.bank_transactions(id,organization_id,account_id,type,amount,description,reference,txn_date)
   values('purchase-bank:'||p_settlement_id::text,p_organization_id,p_account_id,'withdrawal',(paid+fee)::numeric/100,'Supplier invoice '||bill.supplier_invoice_no,p_invoice_id::text,p_payment_date);
 return to_jsonb(prior);
end;
$$;
revoke all on function public.settle_purchase_invoice_bank_atomic(uuid,uuid,uuid,text,numeric,numeric,numeric,date,text) from public,anon;
grant execute on function public.settle_purchase_invoice_bank_atomic(uuid,uuid,uuid,text,numeric,numeric,numeric,date,text) to authenticated;

create function inventory_internal.guard_purchase_bank_source()
returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if current_user in ('authenticated','anon') and (case when tg_op='DELETE' then old.id like 'purchase-bank:%' else new.id like 'purchase-bank:%' end or (tg_op='UPDATE' and old.id like 'purchase-bank:%')) then raise exception 'Invoice bank payment audit is immutable' using errcode='42501';end if;
 if tg_op='DELETE' then return old;end if;return new;
end;
$$;
revoke all on function inventory_internal.guard_purchase_bank_source() from public,anon,authenticated;
create trigger bank_transactions_purchase_source_guard before insert or update or delete on public.bank_transactions for each row execute function inventory_internal.guard_purchase_bank_source();

alter table public.bank_transactions add column if not exists reversed_by text;
create table public.purchase_bank_commands(organization_id uuid not null references public.organizations(id),id uuid not null,request jsonb not null,result jsonb not null,actor_id uuid not null references auth.users(id),created_at timestamptz not null default now(),primary key(organization_id,id));
create table public.purchase_bank_account_deletions(organization_id uuid not null references public.organizations(id),account_id text not null,command_id uuid not null,primary key(organization_id,account_id),foreign key(organization_id,command_id) references public.purchase_bank_commands(organization_id,id) deferrable initially deferred);
do $$declare t text;begin foreach t in array array['purchase_bank_commands','purchase_bank_account_deletions'] loop execute format('alter table public.%I enable row level security',t);execute format('revoke all on public.%I from public,anon,authenticated',t);execute format('grant select on public.%I to authenticated',t);execute format('create policy %I on public.%I for select to authenticated using(public.can_see_org_financials(organization_id))',t||'_read',t);end loop;end$$;

create function inventory_internal.require_purchase_bank_authority(tenant uuid)
returns void language plpgsql security invoker set search_path='' as $$
begin
 if auth.uid() is null or not public.can_see_org_financials(tenant) or not public.org_member_can_write_module(tenant,'banking') then raise exception 'Owner banking write access required' using errcode='42501';end if;
 perform 1 from public.purchase_invoice_settings where organization_id=tenant and enabled for share;if not found then raise exception 'Invoice banking authority is not enabled';end if;
end;
$$;
revoke all on function inventory_internal.require_purchase_bank_authority(uuid) from public,anon,authenticated;

create function inventory_internal.guard_purchase_bank_balance()
returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if current_user in ('authenticated','anon') and exists(select 1 from public.purchase_invoice_settings where enabled and (organization_id=case when tg_op='DELETE' then old.organization_id else new.organization_id end or (tg_op='UPDATE' and organization_id=old.organization_id))) then
  if tg_op='DELETE' or (tg_op='INSERT' and new.balance<>0) or (tg_op='UPDATE' and (old.balance is distinct from new.balance or old.organization_id is distinct from new.organization_id)) then raise exception 'Bank balances require atomic banking commands' using errcode='42501';end if;
 end if;
 if tg_op='DELETE' then return old;end if;return new;
end;
$$;
revoke all on function inventory_internal.guard_purchase_bank_balance() from public,anon,authenticated;
create trigger bank_accounts_purchase_balance_guard before insert or update or delete on public.bank_accounts for each row execute function inventory_internal.guard_purchase_bank_balance();
create function inventory_internal.guard_purchase_bank_ledger()
returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if current_user in ('authenticated','anon') and exists(select 1 from public.purchase_invoice_settings where enabled and (organization_id=case when tg_op='DELETE' then old.organization_id else new.organization_id end or (tg_op='UPDATE' and organization_id=old.organization_id))) then raise exception 'Bank ledger changes require atomic banking commands' using errcode='42501';end if;
 if tg_op='DELETE' then return old;end if;return new;
end;
$$;
revoke all on function inventory_internal.guard_purchase_bank_ledger() from public,anon,authenticated;
create trigger bank_transactions_purchase_ledger_guard before insert or update or delete on public.bank_transactions for each row execute function inventory_internal.guard_purchase_bank_ledger();
create trigger bank_transfers_purchase_ledger_guard before insert or update or delete on public.bank_transfers for each row execute function inventory_internal.guard_purchase_bank_ledger();
create trigger cheques_purchase_ledger_guard before insert or update or delete on public.cheques for each row execute function inventory_internal.guard_purchase_bank_ledger();

create function public.save_purchase_bank_metadata(p_organization_id uuid,p_rows jsonb)
returns void language plpgsql security definer set search_path='' as $$
declare item jsonb;account public.bank_accounts%rowtype;
begin
 perform inventory_internal.require_purchase_bank_authority(p_organization_id);
 if jsonb_typeof(p_rows) is distinct from 'array' then raise exception 'Bank metadata must be an array';end if;
 if jsonb_array_length(p_rows)>200 then raise exception 'Submit at most 200 accounts';end if;
 for item in select value from jsonb_array_elements(p_rows) order by value->>'id' loop
  if nullif(item->>'id','') is null or (item->>'organization_id')::uuid is distinct from p_organization_id or nullif(btrim(item->>'bank_name'),'') is null or nullif(btrim(item->>'account_name'),'') is null or nullif(btrim(item->>'account_number'),'') is null or length(item->>'id')>200 or length(item->>'bank_name')>200 or length(item->>'account_name')>200 or length(item->>'account_number')>100 or length(item->>'branch')>200 then raise exception 'Invalid bank account metadata';end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('bank-account:'||(item->>'id'),0));
  select * into account from public.bank_accounts where id=item->>'id' for update;
  if found then
   if account.organization_id<>p_organization_id then raise exception 'Bank account belongs to another company';end if;
   update public.bank_accounts set bank_name=btrim(item->>'bank_name'),account_name=btrim(item->>'account_name'),account_number=btrim(item->>'account_number'),branch=item->>'branch' where id=account.id;
  else
   if exists(select 1 from public.purchase_bank_account_deletions where organization_id=p_organization_id and account_id=item->>'id') then raise exception 'Bank account was deleted. Reload this company.';end if;
   if coalesce((item->>'balance')::numeric,0)<>0 then raise exception 'Create opening bank balances through the Banking workspace';end if;
   insert into public.bank_accounts(id,organization_id,bank_name,branch,account_name,account_number,balance) values(item->>'id',p_organization_id,btrim(item->>'bank_name'),item->>'branch',btrim(item->>'account_name'),btrim(item->>'account_number'),0);
  end if;
 end loop;
end;
$$;
revoke all on function public.save_purchase_bank_metadata(uuid,jsonb) from public,anon;
grant execute on function public.save_purchase_bank_metadata(uuid,jsonb) to authenticated;

create function inventory_internal.apply_purchase_bank_transaction(tenant uuid,item jsonb,managed boolean default false)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare prior public.bank_transactions%rowtype;account public.bank_accounts%rowtype;amount numeric;delta numeric;day date;kind text;sid text;
begin
 sid:=nullif(item->>'id','');kind:=item->>'type';amount:=(item->>'amount')::numeric;day:=(item->>'txn_date')::date;
 if sid is null or length(sid)>250 or (item->>'organization_id')::uuid is distinct from tenant or kind is null or kind not in ('deposit','withdrawal','fee','interest','adjustment') or amount is null or amount=0 or amount::text in ('NaN','Infinity','-Infinity') or round(amount,2)<>amount or (kind<>'adjustment' and amount<0) or day is null or not isfinite(day) or length(item->>'description')>2000 or length(item->>'reference')>500 then raise exception 'Invalid bank transaction';end if;
 select * into account from public.bank_accounts where id=item->>'account_id' and organization_id=tenant for update;if not found then raise exception 'Bank account not found in this company';end if;
 select * into prior from public.bank_transactions where id=sid;
 if found then
  if prior.organization_id<>tenant then raise exception 'Bank transaction identity belongs to another company';end if;
  if prior.account_id is distinct from account.id or prior.type is distinct from kind or prior.amount is distinct from amount or prior.txn_date is distinct from day then raise exception 'Bank transaction ID was reused with different economic details';end if;
  return to_jsonb(prior);
 end if;
 if not managed and sid ~ '^(purchase-bank:|sale-tender:|return:|bank-reversal:|bank-opening:)' then raise exception 'Reserved bank audit ID';end if;
 delta:=case when kind in ('withdrawal','fee') then -amount else amount end;
 insert into public.bank_transactions(id,organization_id,account_id,type,amount,description,reference,txn_date) values(sid,tenant,account.id,kind,amount,item->>'description',item->>'reference',day) returning * into prior;
 update public.bank_accounts b set balance=b.balance+delta where id=account.id and organization_id=tenant;
 return to_jsonb(prior);
end;
$$;
revoke all on function inventory_internal.apply_purchase_bank_transaction(uuid,jsonb,boolean) from public,anon,authenticated;

create function inventory_internal.apply_purchase_bank_transfer(tenant uuid,item jsonb)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare prior public.bank_transfers%rowtype;amount numeric;stamp timestamptz;
begin
 amount:=(item->>'amount')::numeric;stamp:=(item->>'transfer_date')::timestamptz;
 if nullif(item->>'id','') is null or length(item->>'id')>250 or (item->>'organization_id')::uuid is distinct from tenant or amount is null or amount<=0 or amount::text in ('NaN','Infinity','-Infinity') or round(amount,2)<>amount or stamp is null or not isfinite(stamp) or item->>'from_account_id' is not distinct from item->>'to_account_id' or length(item->>'description')>2000 then raise exception 'Invalid bank transfer';end if;
 perform 1 from public.bank_accounts where organization_id=tenant and id in(item->>'from_account_id',item->>'to_account_id') order by id for update;
 if (select count(*) from public.bank_accounts where organization_id=tenant and id in(item->>'from_account_id',item->>'to_account_id'))<>2 then raise exception 'Both transfer accounts must belong to this company';end if;
 select * into prior from public.bank_transfers where id=item->>'id';
 if found then if prior.organization_id<>tenant or prior.from_account_id is distinct from item->>'from_account_id' or prior.to_account_id is distinct from item->>'to_account_id' or prior.amount<>amount or prior.transfer_date<>stamp then raise exception 'Transfer ID was reused with different details';end if;return to_jsonb(prior);end if;
 insert into public.bank_transfers(id,organization_id,from_account_id,to_account_id,amount,description,transfer_date) values(item->>'id',tenant,item->>'from_account_id',item->>'to_account_id',amount,item->>'description',stamp) returning * into prior;
 update public.bank_accounts b set balance=b.balance+case when id=prior.from_account_id then -amount else amount end where organization_id=tenant and id in(prior.from_account_id,prior.to_account_id);
 return to_jsonb(prior);
end;
$$;
revoke all on function inventory_internal.apply_purchase_bank_transfer(uuid,jsonb) from public,anon,authenticated;

create function inventory_internal.apply_purchase_cheque(tenant uuid,item jsonb,expected text default null)
returns jsonb language plpgsql security invoker set search_path='' as $$
#variable_conflict use_variable
declare prior public.cheques%rowtype;result public.cheques%rowtype;amount numeric;day date;delta numeric;account text;status text;
begin
 select * into prior from public.cheques where id=item->>'id' for update;
 if found then
  if prior.organization_id<>tenant then raise exception 'Cheque belongs to another company';end if;
  if expected is null then return to_jsonb(prior);end if;
  if prior.status<>expected then raise exception 'Cheque status changed. Reload before continuing.';end if;
  status:=item->>'status';account:=coalesce(nullif(item->>'bank_account_id',''),prior.bank_account_id);
  if status is null or status not in ('pending','deposited','cleared','bounced') then raise exception 'Invalid cheque status';end if;
  if prior.status='cleared' and account is distinct from prior.bank_account_id then raise exception 'Reverse clearing against its original bank account before changing accounts';end if;
  if status='cleared' or prior.status='cleared' then
   if account is null then raise exception 'Choose the bank account for cheque clearing';end if;
   perform 1 from public.bank_accounts where id=account and organization_id=tenant for update;if not found then raise exception 'Bank account not found in this company';end if;
  end if;
  delta:=case when status='cleared' and prior.status<>'cleared' then case when prior.direction='received' then prior.amount else -prior.amount end when prior.status='cleared' and status<>'cleared' then case when prior.direction='received' then -prior.amount else prior.amount end else 0 end;
  if delta<>0 then update public.bank_accounts b set balance=b.balance+delta where id=account and organization_id=tenant;end if;
  update public.cheques set status=status,bank_account_id=account where id=prior.id returning * into result;
 else
  if expected is not null then raise exception 'Cheque not found in this company';end if;
  amount:=(item->>'amount')::numeric;day:=(item->>'cheque_date')::date;
  if (item->>'organization_id')::uuid is distinct from tenant or nullif(item->>'id','') is null or length(item->>'id')>250 or nullif(btrim(item->>'cheque_no'),'') is null or length(item->>'cheque_no')>100 or nullif(btrim(item->>'bank_name'),'') is null or length(item->>'bank_name')>200 or nullif(btrim(item->>'party_name'),'') is null or length(item->>'party_name')>200 or item->>'direction' is null or item->>'direction' not in ('received','paid') or amount is null or amount<=0 or amount::text in ('NaN','Infinity','-Infinity') or round(amount,2)<>amount or day is null or not isfinite(day) or length(item->>'note')>2000 then raise exception 'Invalid cheque registration';end if;
  if item->>'status' is distinct from 'pending' then raise exception 'New cheque must start pending';end if;
  if nullif(item->>'customer_id','') is not null and not exists(select 1 from public.customers where id=item->>'customer_id' and organization_id=tenant) then raise exception 'Cheque customer belongs to another company';end if;
  if nullif(item->>'linked_sale_id','') is not null and not exists(select 1 from public.sales where id=item->>'linked_sale_id' and organization_id=tenant) then raise exception 'Cheque sale belongs to another company';end if;
  insert into public.cheques(id,organization_id,direction,cheque_no,bank_name,party_name,customer_id,amount,cheque_date,post_dated,status,linked_sale_id,note)
   values(item->>'id',tenant,item->>'direction',btrim(item->>'cheque_no'),btrim(item->>'bank_name'),btrim(item->>'party_name'),nullif(item->>'customer_id',''),amount,day,coalesce((item->>'post_dated')::boolean,false),'pending',nullif(item->>'linked_sale_id',''),item->>'note') returning * into result;
 end if;
 return to_jsonb(result);
end;
$$;
revoke all on function inventory_internal.apply_purchase_cheque(uuid,jsonb,text) from public,anon,authenticated;

create function public.sync_purchase_bank_rows(p_organization_id uuid,p_kind text,p_rows jsonb)
returns void language plpgsql security definer set search_path='' as $$
declare item jsonb;
begin
 perform inventory_internal.require_purchase_bank_authority(p_organization_id);
 if jsonb_typeof(p_rows) is distinct from 'array' or p_kind is null or p_kind not in ('transaction','transfer','cheque') then raise exception 'Invalid bank ledger rows';end if;
 if jsonb_array_length(p_rows)>200 then raise exception 'Submit at most 200 ledger rows';end if;
 if p_kind<>'cheque' then perform 1 from public.bank_accounts where organization_id=p_organization_id and id in(select value->>'account_id' from jsonb_array_elements(p_rows) union select value->>'from_account_id' from jsonb_array_elements(p_rows) union select value->>'to_account_id' from jsonb_array_elements(p_rows)) order by id for update;end if;
 for item in select value from jsonb_array_elements(p_rows) order by value->>'account_id',value->>'id' loop
  if p_kind='transaction' then perform inventory_internal.apply_purchase_bank_transaction(p_organization_id,item);
  elsif p_kind='transfer' then perform inventory_internal.apply_purchase_bank_transfer(p_organization_id,item);
  else perform inventory_internal.apply_purchase_cheque(p_organization_id,item);end if;
 end loop;
end;
$$;
revoke all on function public.sync_purchase_bank_rows(uuid,text,jsonb) from public,anon;
grant execute on function public.sync_purchase_bank_rows(uuid,text,jsonb) to authenticated;

create function public.purchase_bank_command(p_organization_id uuid,p_command_id uuid,p_action text,p_input jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare prior public.purchase_bank_commands%rowtype;request jsonb;result jsonb;account public.bank_accounts%rowtype;txn public.bank_transactions%rowtype;item jsonb;event jsonb;
 sid text;opening numeric;stamp timestamptz;deleted jsonb:='[]';account_ids text[]:='{}';transaction_ids text[]:='{}';transfer_ids text[]:='{}';cheque_ids text[]:='{}';
begin
 perform inventory_internal.require_purchase_bank_authority(p_organization_id);
 if p_command_id is null or p_action is null or p_action not in ('account_create','account_delete','transaction_create','transaction_reverse','transfer_create','cheque_create','cheque_status') or jsonb_typeof(p_input) is distinct from 'object' then raise exception 'Invalid banking command';end if;
 request:=jsonb_build_object('action',p_action,'input',p_input);
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('bank-command:'||p_organization_id::text||p_command_id::text,0));
 select * into prior from public.purchase_bank_commands where organization_id=p_organization_id and id=p_command_id;
 if found then if prior.request<>request then raise exception 'Bank command key was reused with different details';end if;return prior.result;end if;
 sid:=p_command_id::text;stamp:=coalesce(nullif(p_input->>'date','')::timestamptz,now());
 if not isfinite(stamp) then raise exception 'Invalid banking date';end if;
 if p_action='account_create' then
  opening:=coalesce((p_input->>'balance')::numeric,0);
  if opening::text in ('NaN','Infinity','-Infinity') or round(opening,2)<>opening then raise exception 'Opening bank balance must use two decimals';end if;
  perform public.save_purchase_bank_metadata(p_organization_id,jsonb_build_array(jsonb_build_object('id',sid,'organization_id',p_organization_id,'bank_name',p_input->>'bankName','branch',p_input->>'branch','account_name',p_input->>'accountName','account_number',p_input->>'accountNumber','balance',0)));
  if opening<>0 then
   item:=jsonb_build_object('id','bank-opening:'||sid,'organization_id',p_organization_id,'account_id',sid,'type','adjustment','amount',opening,'description','Verified opening bank balance','txn_date',(stamp at time zone 'Asia/Colombo')::date);
   perform inventory_internal.apply_purchase_bank_transaction(p_organization_id,item,true);transaction_ids:=array['bank-opening:'||sid];
  end if;
  account_ids:=array[sid];
 elsif p_action='account_delete' then
  select * into account from public.bank_accounts where id=p_input->>'id' and organization_id=p_organization_id for update;
  if not found or account.balance<>0 or exists(select 1 from public.bank_transactions where organization_id=p_organization_id and account_id=account.id) or exists(select 1 from public.bank_transfers where organization_id=p_organization_id and (from_account_id=account.id or to_account_id=account.id)) or exists(select 1 from public.cheques where organization_id=p_organization_id and bank_account_id=account.id) then raise exception 'Only an unused zero-balance account can be deleted';end if;
  insert into public.purchase_bank_account_deletions values(p_organization_id,account.id,p_command_id);delete from public.bank_accounts where id=account.id;deleted:=jsonb_build_array(account.id);
 elsif p_action='transaction_create' then
  item:=jsonb_build_object('id',sid,'organization_id',p_organization_id,'account_id',p_input->>'accountId','type',p_input->>'type','amount',p_input->'amount','description',p_input->>'description','reference',p_input->>'reference','txn_date',(stamp at time zone 'Asia/Colombo')::date);
  event:=inventory_internal.apply_purchase_bank_transaction(p_organization_id,item);account_ids:=array[event->>'account_id'];transaction_ids:=array[sid];
 elsif p_action='transaction_reverse' then
  select * into txn from public.bank_transactions where id=p_input->>'id' and organization_id=p_organization_id;
  if not found or txn.reversed_by is not null or txn.id ~ '^(purchase-bank:|sale-tender:|return:|bank-reversal:|bank-opening:)' then raise exception 'This bank entry must be corrected through its source workflow or is already reversed';end if;
  perform 1 from public.bank_accounts where id=txn.account_id and organization_id=p_organization_id for update;
  select * into txn from public.bank_transactions where id=txn.id and organization_id=p_organization_id for update;
  if txn.reversed_by is not null then raise exception 'This bank transaction is already reversed';end if;
  item:=jsonb_build_object('id','bank-reversal:'||sid,'organization_id',p_organization_id,'account_id',txn.account_id,'type','adjustment','amount',case when txn.type in ('withdrawal','fee') then txn.amount else -txn.amount end,'description','Reversal of bank transaction '||txn.id,'reference',txn.id,'txn_date',(stamp at time zone 'Asia/Colombo')::date);
  perform inventory_internal.apply_purchase_bank_transaction(p_organization_id,item,true);
  update public.bank_transactions set reversed_by='bank-reversal:'||sid where id=txn.id;
  account_ids:=array[txn.account_id];transaction_ids:=array[txn.id,'bank-reversal:'||sid];
 elsif p_action='transfer_create' then
  item:=jsonb_build_object('id',sid,'organization_id',p_organization_id,'from_account_id',p_input->>'fromAccountId','to_account_id',p_input->>'toAccountId','amount',p_input->'amount','description',p_input->>'description','transfer_date',stamp);
  event:=inventory_internal.apply_purchase_bank_transfer(p_organization_id,item);account_ids:=array[event->>'from_account_id',event->>'to_account_id'];transfer_ids:=array[sid];
 elsif p_action='cheque_create' then
  item:=jsonb_build_object('id',sid,'organization_id',p_organization_id,'direction',p_input->>'direction','cheque_no',p_input->>'chequeNo','bank_name',p_input->>'bankName','party_name',p_input->>'partyName','customer_id',p_input->>'customerId','amount',p_input->'amount','cheque_date',p_input->>'chequeDate','post_dated',p_input->'postDated','status','pending','linked_sale_id',p_input->>'linkedSaleId','note',p_input->>'note');
  perform inventory_internal.apply_purchase_cheque(p_organization_id,item);cheque_ids:=array[sid];
 else
  item:=jsonb_build_object('id',p_input->>'id','organization_id',p_organization_id,'status',p_input->>'status','bank_account_id',p_input->>'accountId');
  if nullif(p_input->>'expectedStatus','') is null then raise exception 'Expected cheque status is required';end if;
  event:=inventory_internal.apply_purchase_cheque(p_organization_id,item,p_input->>'expectedStatus');cheque_ids:=array[event->>'id'];account_ids:=array[event->>'bank_account_id'];
 end if;
 result:=jsonb_build_object('organization_id',p_organization_id,'command_id',p_command_id,'account_ids',to_jsonb(account_ids),'transaction_ids',to_jsonb(transaction_ids),'transfer_ids',to_jsonb(transfer_ids),'cheque_ids',to_jsonb(cheque_ids),'deleted_accounts',deleted);
 insert into public.purchase_bank_commands values(p_organization_id,p_command_id,request,result,auth.uid(),now());return result;
end;
$$;
revoke all on function public.purchase_bank_command(uuid,uuid,text,jsonb) from public,anon;
grant execute on function public.purchase_bank_command(uuid,uuid,text,jsonb) to authenticated;

create function public.get_purchase_bank_command_snapshot(p_organization_id uuid,p_command_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare command public.purchase_bank_commands%rowtype;result jsonb;
begin
 if auth.uid() is null or not public.can_see_org_financials(p_organization_id) then raise exception 'Owner financial access required' using errcode='42501';end if;
 select * into command from public.purchase_bank_commands where organization_id=p_organization_id and id=p_command_id;if not found then raise exception 'Bank command not found in this company';end if;
 perform 1 from public.bank_accounts where organization_id=p_organization_id and id in(select jsonb_array_elements_text(command.result->'account_ids')) order by id for share;
 result:=command.result||jsonb_build_object('accounts',coalesce((select jsonb_agg(to_jsonb(a)) from public.bank_accounts a where organization_id=p_organization_id and id in(select jsonb_array_elements_text(command.result->'account_ids'))),'[]'::jsonb),
 'transactions',coalesce((select jsonb_agg(to_jsonb(t)) from public.bank_transactions t where organization_id=p_organization_id and id in(select jsonb_array_elements_text(command.result->'transaction_ids'))),'[]'::jsonb),
 'transfers',coalesce((select jsonb_agg(to_jsonb(t)) from public.bank_transfers t where organization_id=p_organization_id and id in(select jsonb_array_elements_text(command.result->'transfer_ids'))),'[]'::jsonb),
 'cheques',coalesce((select jsonb_agg(to_jsonb(c)) from public.cheques c where organization_id=p_organization_id and id in(select jsonb_array_elements_text(command.result->'cheque_ids'))),'[]'::jsonb));
 return result;
end;
$$;
revoke all on function public.get_purchase_bank_command_snapshot(uuid,uuid) from public,anon;
grant execute on function public.get_purchase_bank_command_snapshot(uuid,uuid) to authenticated;

create or replace function public.settle_purchase_invoice_cash_atomic(
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
  select paid+coalesce(sum(foreign_amount_minor),0) into paid from public.purchase_invoice_bank_settlements where organization_id=p_organization_id and invoice_id=p_invoice_id;
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

create or replace function public.get_purchase_supplier_statement(p_organization_id uuid,p_supplier_id text,p_page integer default 0)
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
    union all select payment_date::timestamp at time zone 'Asia/Colombo','bank:'||id::text,'Invoice bank payment',-carrying_minor::numeric,1
      from public.purchase_invoice_bank_settlements where organization_id=p_organization_id and supplier_id=p_supplier_id
  ), totals as (select coalesce(sum(amount_minor),0) as net,count(*) as count from entries),
  numbered as (select *,round(balance*100)-(select net from totals)+sum(amount_minor) over(order by date,sort_priority,identity) as balance_minor from entries),
  page as (select * from numbered order by date,sort_priority,identity limit 50 offset (p_page::bigint*50))
  select jsonb_build_object('organization_id',p_organization_id,'supplier_id',p_supplier_id,'payable_balance',balance,'page',p_page,
    'opening_minor',round(balance*100)-(select net from totals),'count',(select count from totals),'entries',coalesce((select jsonb_agg(to_jsonb(page) order by date,sort_priority,identity) from page),'[]'::jsonb)) into output;
  return output;
end;
$$;

create or replace function public.get_purchase_invoice_workspace(p_organization_id uuid,p_purchase_order_id text default null,p_page integer default 0,p_receipt_page integer default 0)
returns jsonb language plpgsql security definer set search_path='' as $$
declare output jsonb;
begin
  if auth.uid() is null or not public.can_see_org_financials(p_organization_id) then raise exception 'Owner financial access required' using errcode='42501'; end if;
  if p_page is null or p_receipt_page is null or p_page<0 or p_receipt_page<0 or p_page>100000 or p_receipt_page>100000 then raise exception 'Invalid invoice history page'; end if;
  if p_purchase_order_id is not null and not exists(select 1 from public.purchase_orders where organization_id=p_organization_id and id=p_purchase_order_id) then raise exception 'Purchase order not found in this company'; end if;
  with available as (
    select r.organization_id,r.receipt_id,r.purchase_order_id,r.received_at,r.request_lines from public.purchase_order_receipts r
      where r.organization_id=p_organization_id and r.purchase_order_id=p_purchase_order_id
      and not exists(select 1 from public.purchase_invoice_receipts a where a.organization_id=r.organization_id and a.receipt_id=r.receipt_id)
  ), receipt_page as (select * from available order by received_at desc,receipt_id limit 50 offset p_receipt_page::bigint*50),
  invoice_page as (select organization_id,id,supplier_id,supplier_invoice_no,invoice_date,currency,subtotal_minor,input_vat_minor,total_minor,foreign_subtotal_minor,foreign_total_minor,recognition_rate,created_at
    from public.purchase_receipt_invoices where organization_id=p_organization_id order by created_at desc,id limit 25 offset p_page::bigint*25)
  select jsonb_build_object('organizationId',p_organization_id,'enabled',coalesce((select enabled from public.purchase_invoice_settings where organization_id=p_organization_id),false),
    'orderId',p_purchase_order_id,'page',p_page,'receiptPage',p_receipt_page,'invoiceCount',(select count(*) from public.purchase_receipt_invoices where organization_id=p_organization_id),
    'receiptCount',(select count(*) from available),'billed','[]'::jsonb,'receipts',coalesce((select jsonb_agg(to_jsonb(r) order by r.received_at desc,r.receipt_id) from receipt_page r),'[]'::jsonb),
    'invoices',coalesce((select jsonb_agg(to_jsonb(i) order by i.created_at desc,i.id) from invoice_page i),'[]'::jsonb)) into output;
  return output;
end;
$$;
revoke all on function public.get_purchase_invoice_workspace(uuid,text,integer,integer) from public,anon;
grant execute on function public.get_purchase_invoice_workspace(uuid,text,integer,integer) to authenticated;

-- Keep the existing cash summary compatible while including bank payments in
-- the outstanding balance. Foreign amounts and carrying values are separate.
create or replace function public.get_purchase_invoice_settlement(p_organization_id uuid,p_invoice_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare bill public.purchase_receipt_invoices%rowtype; balance numeric;
begin
  if auth.uid() is null or not public.can_see_org_financials(p_organization_id) then raise exception 'Owner financial access required' using errcode='42501'; end if;
  select * into bill from public.purchase_receipt_invoices where organization_id=p_organization_id and id=p_invoice_id for share;
  if not found then raise exception 'Invoice not found in this company'; end if;
  select payable_balance into balance from public.suppliers where organization_id=p_organization_id and id=bill.supplier_id for share;
  return jsonb_build_object('organization_id',p_organization_id,'invoice_id',bill.id,'number',bill.supplier_invoice_no,'invoice_date',bill.invoice_date,
    'currency',bill.currency,'recognition_rate',bill.recognition_rate,'foreign_total_minor',bill.foreign_total_minor,
    'total_minor',bill.total_minor,
    'paid_minor',(select coalesce(sum(amount_minor),0) from public.purchase_invoice_cash_settlements where organization_id=p_organization_id and invoice_id=bill.id)
      +(select coalesce(sum(carrying_minor),0) from public.purchase_invoice_bank_settlements where organization_id=p_organization_id and invoice_id=bill.id),
    'foreign_paid_minor',(select coalesce(sum(amount_minor),0) from public.purchase_invoice_cash_settlements where organization_id=p_organization_id and invoice_id=bill.id)
      +(select coalesce(sum(foreign_amount_minor),0) from public.purchase_invoice_bank_settlements where organization_id=p_organization_id and invoice_id=bill.id),
    'payable_balance',balance,'payments',coalesce((select jsonb_agg(to_jsonb(s) order by s.created_at desc,s.id) from
      (select id,amount_minor,payment_date,note,created_at from public.purchase_invoice_cash_settlements where organization_id=p_organization_id and invoice_id=bill.id order by created_at desc,id limit 50) s),'[]'::jsonb),
    'bank_payments',coalesce((select jsonb_agg(to_jsonb(s) order by s.created_at desc,s.id) from
      (select id,account_id,foreign_amount_minor,carrying_minor,paid_minor,fee_minor,exchange_difference_minor,payment_date,note,created_at
       from public.purchase_invoice_bank_settlements where organization_id=p_organization_id and invoice_id=bill.id order by created_at desc,id limit 50) s),'[]'::jsonb));
end;
$$;

-- Read current balances, not the historical balances at the time of payment.
create function public.get_purchase_invoice_bank_settlement_snapshot(p_organization_id uuid,p_settlement_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare payment public.purchase_invoice_bank_settlements%rowtype; result jsonb;
begin
 if auth.uid() is null or not public.can_see_org_financials(p_organization_id) then raise exception 'Owner financial access required' using errcode='42501';end if;
 select * into payment from public.purchase_invoice_bank_settlements where organization_id=p_organization_id and id=p_settlement_id;
 if not found then raise exception 'Bank settlement not found in this company';end if;
 perform 1 from public.suppliers where organization_id=p_organization_id and id=payment.supplier_id for share;
 perform 1 from public.bank_accounts where organization_id=p_organization_id and id=payment.account_id for share;
 select jsonb_build_object('organization_id',p_organization_id,'settlement_id',payment.id,'invoice_id',payment.invoice_id,
  'account',(select to_jsonb(a) from public.bank_accounts a where a.organization_id=p_organization_id and a.id=payment.account_id),
  'transaction',(select to_jsonb(t) from public.bank_transactions t where t.organization_id=p_organization_id and t.id='purchase-bank:'||payment.id::text),
  'supplier',(select jsonb_build_object('id',s.id,'organization_id',s.organization_id,'payable_balance',s.payable_balance) from public.suppliers s where s.organization_id=p_organization_id and s.id=payment.supplier_id)) into result;
 if result->'account'='null'::jsonb or result->'transaction'='null'::jsonb or result->'supplier'='null'::jsonb then raise exception 'Settlement balances require reconciliation';end if;
 return result;
end;
$$;
revoke all on function public.get_purchase_invoice_bank_settlement_snapshot(uuid,uuid) from public,anon;
grant execute on function public.get_purchase_invoice_bank_settlement_snapshot(uuid,uuid) to authenticated;
