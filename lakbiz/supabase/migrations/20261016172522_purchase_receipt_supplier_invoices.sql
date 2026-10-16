-- Prepared authority only. No company is enabled, no stock is received here.
create table public.purchase_invoice_settings (
  organization_id uuid primary key references public.organizations(id),
  enabled boolean not null default false
);
create table public.purchase_receipt_invoices (
  organization_id uuid not null references public.organizations(id),
  id uuid not null,
  purchase_order_id text not null references public.purchase_orders(id),
  supplier_id text not null references public.suppliers(id),
  supplier_invoice_no text not null check(btrim(supplier_invoice_no)<>'' and length(supplier_invoice_no)<=100),
  supplier_invoice_key text generated always as (upper(btrim(supplier_invoice_no))) stored,
  invoice_date date not null check(isfinite(invoice_date)),
  currency text not null default 'LKR' check(currency='LKR'),
  subtotal_minor bigint not null check(subtotal_minor>=0),
  input_vat_minor bigint not null check(input_vat_minor>=0),
  total_minor bigint not null check(total_minor=subtotal_minor+input_vat_minor),
  request jsonb not null,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  primary key(organization_id,id),
  unique(organization_id,supplier_id,supplier_invoice_key)
);
create index purchase_receipt_invoices_order_idx on public.purchase_receipt_invoices(organization_id,purchase_order_id,created_at);
create table public.purchase_invoice_receipts (
  organization_id uuid not null,
  receipt_id uuid not null,
  invoice_id uuid not null,
  primary key(organization_id,receipt_id),
  unique(organization_id,receipt_id,invoice_id),
  foreign key(organization_id,receipt_id) references public.purchase_order_receipts(organization_id,receipt_id),
  foreign key(organization_id,invoice_id) references public.purchase_receipt_invoices(organization_id,id)
);
create index purchase_invoice_receipts_invoice_idx on public.purchase_invoice_receipts(organization_id,invoice_id);
create table public.purchase_receipt_invoice_lines (
  organization_id uuid not null,
  invoice_id uuid not null,
  receipt_id uuid not null,
  purchase_order_line_id uuid not null references public.purchase_order_lines(id),
  product_id text not null references public.products_base(id),
  product_name text not null,
  qty numeric(14,3) not null check(qty>0 and qty<>'NaN'::numeric),
  unit_cost_minor bigint not null check(unit_cost_minor>=0),
  line_total_minor bigint not null check(line_total_minor>=0),
  primary key(organization_id,receipt_id,purchase_order_line_id),
  foreign key(organization_id,receipt_id,invoice_id) references public.purchase_invoice_receipts(organization_id,receipt_id,invoice_id)
);
create index purchase_receipt_invoice_lines_invoice_idx on public.purchase_receipt_invoice_lines(organization_id,invoice_id);
create index purchase_receipt_invoice_lines_product_idx on public.purchase_receipt_invoice_lines(product_id);
create index purchase_receipt_invoice_lines_order_line_idx on public.purchase_receipt_invoice_lines(purchase_order_line_id);

alter table public.purchase_invoice_settings enable row level security;
alter table public.purchase_receipt_invoices enable row level security;
alter table public.purchase_invoice_receipts enable row level security;
alter table public.purchase_receipt_invoice_lines enable row level security;
revoke all on public.purchase_invoice_settings,public.purchase_receipt_invoices,public.purchase_invoice_receipts,public.purchase_receipt_invoice_lines from public,anon,authenticated;
grant select on public.purchase_invoice_settings,public.purchase_receipt_invoices,public.purchase_invoice_receipts,public.purchase_receipt_invoice_lines to authenticated;
create policy purchase_invoice_settings_read on public.purchase_invoice_settings for select to authenticated
using(exists(select 1 from public.org_members m where m.organization_id=purchase_invoice_settings.organization_id and m.user_id=auth.uid()));
create policy purchase_receipt_invoices_read on public.purchase_receipt_invoices for select to authenticated using(public.can_see_org_financials(organization_id));
create policy purchase_invoice_receipts_read on public.purchase_invoice_receipts for select to authenticated using(public.can_see_org_financials(organization_id));
create policy purchase_receipt_invoice_lines_read on public.purchase_receipt_invoice_lines for select to authenticated using(public.can_see_org_financials(organization_id));

-- Legacy snapshot balances are unsafe after invoice authority is enabled.
-- Activation must wait for settlement/GRN adapters, not just the invoice UI.
create function inventory_internal.guard_invoice_supplier_balance()
returns trigger language plpgsql security invoker set search_path='' as $$
begin
  if current_user in ('authenticated','anon') and (
    old.payable_balance is distinct from new.payable_balance or old.organization_id<>new.organization_id
  ) and exists(select 1 from public.purchase_invoice_settings
    where organization_id in (old.organization_id,new.organization_id) and enabled) then
    raise exception 'Supplier payable changes require the atomic invoice/settlement workflow' using errcode='42501';
  end if;
  return new;
end;
$$;
revoke all on function inventory_internal.guard_invoice_supplier_balance() from public,anon,authenticated;
create trigger suppliers_invoice_balance_guard before update of payable_balance,organization_id on public.suppliers
for each row execute function inventory_internal.guard_invoice_supplier_balance();

create function public.record_purchase_receipt_invoice_atomic(
  p_organization_id uuid,p_invoice_id uuid,p_receipt_ids uuid[],p_supplier_invoice_no text,
  p_invoice_date date,p_input_vat numeric,p_lines jsonb
) returns jsonb language plpgsql security definer set search_path='' as $$
declare
  prior public.purchase_receipt_invoices%rowtype;
  po public.purchase_orders%rowtype; delivery public.purchase_order_receipts%rowtype;
  order_line public.purchase_order_lines%rowtype;
  sorted_receipts uuid[]; receipt uuid; po_id text; canonical_lines jsonb; canonical jsonb;
  requested jsonb; received_line jsonb; price numeric; quantity numeric;
  cost_minor bigint; line_minor bigint; subtotal bigint:=0; vat_minor bigint; balance numeric;
  expected_lines integer:=0; invoice_no text;
begin
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
  insert into public.purchase_receipt_invoices(organization_id,id,purchase_order_id,supplier_id,supplier_invoice_no,invoice_date,subtotal_minor,input_vat_minor,total_minor,request,created_by)
    values(p_organization_id,p_invoice_id,po.id,po.supplier_id,invoice_no,p_invoice_date,0,vat_minor,vat_minor,canonical,auth.uid());
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
    cost_minor:=(price*100)::bigint;
    line_minor:=round(quantity*cost_minor)::bigint;
    subtotal:=subtotal+line_minor;
    insert into public.purchase_receipt_invoice_lines(organization_id,invoice_id,receipt_id,purchase_order_line_id,product_id,product_name,qty,unit_cost_minor,line_total_minor)
      values(p_organization_id,p_invoice_id,receipt,order_line.id,order_line.product_id,order_line.product_name,quantity,cost_minor,line_minor);
  end loop;
  update public.purchase_receipt_invoices set subtotal_minor=subtotal,total_minor=subtotal+vat_minor where organization_id=p_organization_id and id=p_invoice_id returning * into prior;
  update public.suppliers set payable_balance=payable_balance+(subtotal+vat_minor)::numeric/100 where id=po.supplier_id and organization_id=p_organization_id;
  return to_jsonb(prior);
end;
$$;
revoke all on function public.record_purchase_receipt_invoice_atomic(uuid,uuid,uuid[],text,date,numeric,jsonb) from public,anon;
grant execute on function public.record_purchase_receipt_invoice_atomic(uuid,uuid,uuid[],text,date,numeric,jsonb) to authenticated;
