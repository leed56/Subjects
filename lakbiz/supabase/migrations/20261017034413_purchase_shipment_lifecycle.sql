-- Each physical roll is linked to the exact immutable purchase receipt.
create table public.purchase_receipt_fabric_rolls (
 organization_id uuid not null references public.organizations(id),
 receipt_id uuid not null, purchase_order_line_id uuid not null references public.purchase_order_lines(id),
 roll_id uuid not null references public.textile_rolls(id),
 primary key (organization_id,receipt_id,roll_id), unique (roll_id),
 foreign key (organization_id,receipt_id) references public.purchase_order_receipts(organization_id,receipt_id) deferrable initially deferred
);
alter table public.purchase_receipt_fabric_rolls enable row level security;
revoke all on public.purchase_receipt_fabric_rolls from public,anon,authenticated;
grant select on public.purchase_receipt_fabric_rolls to authenticated;
create policy purchase_receipt_fabric_rolls_read on public.purchase_receipt_fabric_rolls for select to authenticated using(public.can_see_org_financials(organization_id));

create function inventory_internal.receive_purchase_fabric_rolls(tenant uuid,receipt uuid,line_id uuid,pid text,quantity numeric,cost numeric,supplier text,allocations jsonb,stamp timestamptz)
returns void language plpgsql security invoker set search_path='' as $$
declare item jsonb; amount numeric; total numeric:=0; unit text; roll_id uuid; roll_no text;
begin
 select length_unit into unit from public.purchase_order_lines where id=line_id and organization_id=tenant and product_id=pid;
 if unit not in ('metre','yard') or unit is null then raise exception 'Confirm the purchase line measurement unit before receiving fabric'; end if;
 if jsonb_typeof(allocations) is distinct from 'array' or jsonb_array_length(allocations) not between 1 and 500 then raise exception 'Supply 1 to 500 measured fabric rolls'; end if;
 for item in select value from jsonb_array_elements(allocations) loop
  if jsonb_typeof(item) is distinct from 'object' or item-array['roll_no','qty','length_unit','barcode','supplier_lot','dye_lot','shade','rack_location']<>'{}'::jsonb then raise exception 'Invalid fabric roll details'; end if;
  roll_no:=nullif(btrim(item->>'roll_no'),'');amount:=(item->>'qty')::numeric;
  if roll_no is null or length(roll_no)>200 or item->>'length_unit' is distinct from unit or amount is null or amount<=0 or amount::text in ('NaN','Infinity','-Infinity') or round(amount,3)<>amount then raise exception 'Each roll requires a number, positive length and matching purchase unit'; end if;
  total:=total+amount;
  insert into public.textile_rolls(organization_id,product_id,supplier_id,roll_no,barcode,supplier_lot,dye_lot,shade,rack_location,length_unit,received_length,remaining_length,source_reference,received_at)
   values(tenant,pid,supplier,roll_no,nullif(btrim(item->>'barcode'),''),nullif(btrim(item->>'supplier_lot'),''),nullif(btrim(item->>'dye_lot'),''),nullif(btrim(item->>'shade'),''),nullif(btrim(item->>'rack_location'),''),unit,amount,amount,receipt::text,(stamp at time zone 'Asia/Colombo')::date) returning id into roll_id;
  insert into public.textile_roll_costs(roll_id,organization_id,unit_cost,landed_unit_cost) values(roll_id,tenant,cost,cost);
  insert into public.purchase_receipt_fabric_rolls(organization_id,receipt_id,purchase_order_line_id,roll_id) values(tenant,receipt,line_id,roll_id);
 end loop;
 if total<>quantity then raise exception 'Roll lengths must equal the received shipment quantity'; end if;
end $$;
revoke all on function inventory_internal.receive_purchase_fabric_rolls(uuid,uuid,uuid,text,numeric,numeric,text,jsonb,timestamptz) from public,anon,authenticated;

create or replace function inventory_internal.receive_purchase_order_costed(
  p_organization_id uuid,p_purchase_order_id text,p_receipt_id uuid,p_lines jsonb,p_costs jsonb
) returns jsonb language plpgsql security definer set search_path='' as $$
declare
  po public.purchase_orders%rowtype; line public.purchase_order_lines%rowtype;
  prior public.purchase_order_receipts%rowtype; item jsonb; canonical jsonb;
  quantity numeric; expected numeric; current_stock numeric; product_name text; mode text;
  new_status text; result jsonb; delivery_time timestamptz:=now(); identity_key text; identity_count integer:=0; effective_cost numeric; inbound_reserved numeric;
begin
  if auth.uid() is null
    or not public.can_see_org_financials(p_organization_id)
    or not public.org_member_can_write_module(p_organization_id,'suppliers')
    or not public.org_member_can_write_module(p_organization_id,'stock') then
    raise exception 'Purchase receiving requires purchasing and stock write access' using errcode='42501';
  end if;
  perform 1 from public.purchase_receipt_settings where organization_id=p_organization_id and enabled for share;
  if not found then raise exception 'Atomic purchase receiving is not enabled'; end if;
  perform 1 from public.inventory_transfer_settings where organization_id=p_organization_id and enabled for share;
  if not found then raise exception 'Location stock authority must be enabled first'; end if;
  if p_receipt_id is null or jsonb_typeof(p_lines) is distinct from 'array' then
    raise exception 'A delivery key and receipt lines are required'; end if;
  if jsonb_array_length(p_lines) not between 1 and 200 then raise exception 'Submit 1 to 200 receipt lines'; end if;
  select jsonb_agg(value order by value->>'line_id') into canonical from jsonb_array_elements(p_lines);
  if (select count(distinct value->>'line_id') from jsonb_array_elements(canonical))<>jsonb_array_length(canonical) then
    raise exception 'Every receipt line requires a unique stable line ID'; end if;
  if jsonb_typeof(p_costs) is distinct from 'object' then raise exception 'Invalid private receipt costs'; end if;
  if p_costs<>'{}'::jsonb then
    select jsonb_agg(value||jsonb_build_object('received_unit_cost',p_costs->(value->>'line_id')) order by value->>'line_id') into canonical from jsonb_array_elements(canonical);
  end if;
  -- Serialize a delivery key even if a faulty client reuses it on another PO.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_organization_id::text||p_receipt_id::text,0));
  select * into po from public.purchase_orders where id=p_purchase_order_id and organization_id=p_organization_id for update;
  if not found then raise exception 'Purchase order not found in this organization'; end if;
  select * into prior from public.purchase_order_receipts where organization_id=p_organization_id and receipt_id=p_receipt_id;
  if found then
    if prior.purchase_order_id<>p_purchase_order_id or prior.request_lines<>canonical then
      raise exception 'Delivery key was reused with different receipt details'; end if;
    return prior.result;
  end if;
  if po.status not in ('pending','partial') then raise exception 'Purchase order is not open for receiving'; end if;
  if po.supplier_id is null or not exists(select 1 from public.suppliers where id=po.supplier_id and organization_id=p_organization_id) then
    raise exception 'Purchase supplier must belong to this organization'; end if;
  -- Lock every order line and all affected products in stable order.
  perform 1 from public.purchase_order_lines where purchase_order_id=po.id order by id for update;
  if exists(select 1 from public.purchase_order_lines where purchase_order_id=po.id and organization_id<>p_organization_id) then
    raise exception 'Purchase order has invalid organization line ownership'; end if;
  if exists(select 1 from public.purchase_order_lines where purchase_order_id=po.id group by product_id having count(*)>1) then
    raise exception 'Legacy duplicate product lines require review before receiving'; end if;
  if exists(select 1 from public.purchase_order_lines where purchase_order_id=po.id and (
    qty_ordered<=0 or qty_received<0 or qty_received>qty_ordered or unit_cost<0
    or qty_ordered::text in ('NaN','Infinity','-Infinity') or qty_received::text in ('NaN','Infinity','-Infinity')
    or unit_cost::text in ('NaN','Infinity','-Infinity')
  )) then raise exception 'Malformed purchase order requires review before receiving'; end if;
  for item in select value from jsonb_array_elements(canonical) loop
    if item ? 'allocations' then
      if jsonb_typeof(item->'allocations') is distinct from 'array' then raise exception 'Exact receiving allocations must be an array'; end if;
      identity_count:=identity_count+jsonb_array_length(item->'allocations');
    end if;
  end loop;
  if identity_count>2000 then raise exception 'Split this delivery into at most 2000 physical identities'; end if;
  for identity_key in select distinct v.key from jsonb_array_elements(canonical) l
    cross join lateral jsonb_array_elements(coalesce(l.value->'allocations','[]'::jsonb)) a
    cross join lateral(values('serial:'||nullif(btrim(a.value->>'serial_no'),'')),('imei:'||nullif(btrim(a.value->>'imei'),''))) v(key)
    where v.key is not null order by v.key loop
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('receipt-identity:'||p_organization_id::text||':'||identity_key,0));
  end loop;
  perform 1 from public.products_base p where p.organization_id=p_organization_id and p.id in (
    select l.product_id from public.purchase_order_lines l where l.purchase_order_id=po.id
  ) order by p.id for update;
  for item in select value from jsonb_array_elements(canonical) loop
    select * into line from public.purchase_order_lines
      where id=(item->>'line_id')::uuid and purchase_order_id=po.id and organization_id=p_organization_id;
    if not found then raise exception 'Receipt line does not belong to this purchase order'; end if;
    quantity:=(item->>'qty')::numeric; expected:=(item->>'expected_received')::numeric;
    if quantity is null or expected is null or quantity<=0 or expected<0
      or quantity::text in ('NaN','Infinity','-Infinity') or expected::text in ('NaN','Infinity','-Infinity')
      or round(quantity,3)<>quantity or round(expected,3)<>expected
      or line.qty_ordered::text in ('NaN','Infinity','-Infinity') or line.qty_received::text in ('NaN','Infinity','-Infinity')
      or line.unit_cost::text in ('NaN','Infinity','-Infinity') or line.unit_cost<0
      or line.qty_received<0 or line.qty_ordered<=0 then raise exception 'Invalid receipt quantity or purchase line'; end if;
    if line.qty_received<>expected then raise exception 'Purchase receipt changed on another device. Reload before receiving.'; end if;
    if quantity>line.qty_ordered-line.qty_received then raise exception 'Receipt exceeds the outstanding order quantity'; end if;
    if p_costs='{}'::jsonb then
      select coalesce(sum(l.qty-l.received_qty),0) into inbound_reserved from public.purchase_shipment_lines l join public.purchase_shipments s on s.organization_id=l.organization_id and s.id=l.shipment_id where l.organization_id=p_organization_id and l.line_id=line.id and s.status in ('in_transit','landed');
      if quantity+inbound_reserved>line.qty_ordered-line.qty_received then raise exception 'This quantity belongs to an active shipment. Receive it from the shipment workspace.';end if;
    end if;
    select p.name,coalesce(profile.tracking_mode,'simple'),p.stock_qty into product_name,mode,current_stock from public.products_base p
      left join public.product_inventory_profiles profile on profile.product_id=p.id and profile.organization_id=p.organization_id
      where p.id=line.product_id and p.organization_id=p_organization_id;
    if not found then raise exception 'Receipt product not found in this organization'; end if;
    if current_stock is null or current_stock<0 or current_stock::text in ('NaN','Infinity','-Infinity') then
      raise exception 'Malformed source stock requires reconciliation before receiving'; end if;

    effective_cost:=coalesce((p_costs->>line.id::text)::numeric,line.unit_cost);
    if effective_cost<0 or effective_cost::text in ('NaN','Infinity','-Infinity') or round(effective_cost,2)<>effective_cost then raise exception 'Invalid server receipt cost'; end if;
    if exists(select 1 from public.products_base where organization_id=p_organization_id and id=line.product_id and sector_id='textile') then
      if p_costs='{}'::jsonb then raise exception 'Fabric rolls must be received from a landed shipment'; end if;
      update public.products_base set buy_price=effective_cost where id=line.product_id and organization_id=p_organization_id;
      perform inventory_internal.receive_purchase_fabric_rolls(p_organization_id,p_receipt_id,line.id,line.product_id,quantity,effective_cost,po.supplier_id,item->'allocations',delivery_time);
    else
      update public.products_base set stock_qty=stock_qty+quantity,buy_price=effective_cost where id=line.product_id and organization_id=p_organization_id;
      perform inventory_internal.receive_purchase_identity(p_organization_id,p_receipt_id,line.id,line.product_id,quantity,effective_cost,po.supplier_id,item->'allocations',delivery_time);
    end if;
    update public.purchase_order_lines set qty_received=qty_received+quantity where id=line.id;
    if not exists(select 1 from public.products_base where organization_id=p_organization_id and id=line.product_id and sector_id='textile') then
      insert into public.stock_logs(id,organization_id,product_id,product_name,log_type,qty,note,log_date,related_supplier_id,user_id)
        values('po-receipt:'||p_receipt_id::text||':'||line.id::text,p_organization_id,line.product_id,product_name,
          'purchase',quantity,'PO '||po.po_no,delivery_time,po.supplier_id,auth.uid());
    end if;
  end loop;
  select case when bool_and(qty_received>=qty_ordered) then 'received' else 'partial' end into new_status
    from public.purchase_order_lines where purchase_order_id=po.id;
  update public.purchase_orders set status=new_status,received_date=coalesce(received_date,delivery_time) where id=po.id;
  result:=jsonb_build_object('receipt_id',p_receipt_id,'purchase_order_id',po.id,'status',new_status,'received_at',delivery_time,'lines',canonical);
  insert into public.purchase_order_receipts(organization_id,receipt_id,purchase_order_id,request_lines,result,received_by)
    values(p_organization_id,p_receipt_id,po.id,canonical,result,auth.uid());
  return result;
end;
$$;

revoke all on function inventory_internal.receive_purchase_order_costed(uuid,text,uuid,jsonb,jsonb) from public,anon,authenticated;
create or replace function public.receive_purchase_order_atomic(p_organization_id uuid,p_purchase_order_id text,p_receipt_id uuid,p_lines jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
begin return inventory_internal.receive_purchase_order_costed(p_organization_id,p_purchase_order_id,p_receipt_id,p_lines,'{}'::jsonb); end;
$$;
revoke all on function public.receive_purchase_order_atomic(uuid,text,uuid,jsonb) from public,anon;
grant execute on function public.receive_purchase_order_atomic(uuid,text,uuid,jsonb) to authenticated;

create table public.purchase_shipments(
 organization_id uuid not null references public.organizations(id),id uuid not null,purchase_order_id text not null references public.purchase_orders(id),
 reference text not null check(length(reference) between 1 and 100),status text not null default 'draft' check(status in ('draft','in_transit','landed','received','cancelled','closed_short')),
 version integer not null default 1,currency text not null check(currency in ('LKR','USD','EUR','GBP','INR','AED','CNY')),exchange_rate numeric(20,6) not null check(exchange_rate>0 and exchange_rate<>'NaN'::numeric),
 allocation_basis text not null check(allocation_basis in ('value','quantity')),charges_minor bigint not null check(charges_minor>=0),recoverable_vat_minor bigint not null check(recoverable_vat_minor>=0),
 charges jsonb not null,documents jsonb not null default '[]',note text not null default '',created_by uuid not null references auth.users(id),created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 primary key(organization_id,id),unique(organization_id,reference)
);
create table public.purchase_shipment_lines(
 organization_id uuid not null,shipment_id uuid not null,line_id uuid not null references public.purchase_order_lines(id),product_id text not null references public.products_base(id),product_name text not null,
 qty numeric(14,3) not null check(qty>0 and qty<>'NaN'::numeric),received_qty numeric(14,3) not null default 0 check(received_qty>=0 and received_qty<=qty),
 foreign_unit_minor bigint not null check(foreign_unit_minor>=0),goods_minor bigint not null check(goods_minor>=0),allocated_minor bigint not null default 0 check(allocated_minor>=0),
 primary key(organization_id,shipment_id,line_id),foreign key(organization_id,shipment_id) references public.purchase_shipments(organization_id,id)
);
create table public.purchase_shipment_receipts(
 organization_id uuid not null,shipment_id uuid not null,receipt_id uuid not null,line_id uuid not null,qty numeric(14,3) not null check(qty>0),inventory_minor bigint not null check(inventory_minor>=0),
 primary key(organization_id,receipt_id,line_id),foreign key(organization_id,shipment_id,line_id) references public.purchase_shipment_lines(organization_id,shipment_id,line_id),
 foreign key(organization_id,receipt_id) references public.purchase_order_receipts(organization_id,receipt_id)
);
create table public.purchase_shipment_commands(
 organization_id uuid not null,command_id uuid not null,shipment_id uuid not null,request jsonb not null,result jsonb not null,actor_id uuid not null references auth.users(id),created_at timestamptz not null default now(),
 primary key(organization_id,command_id),foreign key(organization_id,shipment_id) references public.purchase_shipments(organization_id,id)
);
create index purchase_shipments_history_idx on public.purchase_shipments(organization_id,created_at desc,id);
create unique index purchase_shipments_reference_key on public.purchase_shipments(organization_id,upper(btrim(reference)));
create index purchase_shipments_order_idx on public.purchase_shipments(organization_id,purchase_order_id,status);
create index purchase_shipment_receipts_shipment_idx on public.purchase_shipment_receipts(organization_id,shipment_id);
do $$declare t text;begin foreach t in array array['purchase_shipments','purchase_shipment_lines','purchase_shipment_receipts','purchase_shipment_commands'] loop
 execute format('alter table public.%I enable row level security',t);execute format('revoke all on public.%I from public,anon,authenticated',t);execute format('grant select on public.%I to authenticated',t);
 execute format('create policy %I on public.%I for select to authenticated using(public.can_see_org_financials(organization_id))',t||'_read',t);
end loop;end$$;

create function public.get_purchase_shipment(p_organization_id uuid,p_shipment_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
 if auth.uid() is null or not public.can_see_org_financials(p_organization_id) then raise exception 'Owner financial access required' using errcode='42501'; end if;
 perform 1 from public.purchase_shipments where organization_id=p_organization_id and id=p_shipment_id for share;
 if not found then raise exception 'Shipment not found in this company'; end if;
 select jsonb_build_object('organization_id',p_organization_id,'shipment',(select to_jsonb(s) from public.purchase_shipments s where organization_id=p_organization_id and id=p_shipment_id),
   'lines',coalesce((select jsonb_agg(to_jsonb(l) order by line_id) from public.purchase_shipment_lines l where organization_id=p_organization_id and shipment_id=p_shipment_id),'[]'::jsonb),
   'receipts',coalesce((select jsonb_agg(to_jsonb(r) order by receipt_id,line_id) from public.purchase_shipment_receipts r where organization_id=p_organization_id and shipment_id=p_shipment_id),'[]'::jsonb)) into result;
 return result;
end;
$$;
revoke all on function public.get_purchase_shipment(uuid,uuid) from public,anon;
grant execute on function public.get_purchase_shipment(uuid,uuid) to authenticated;

create function public.purchase_shipment_command(p_organization_id uuid,p_command_id uuid,p_shipment_id uuid,p_expected_version integer,p_action text,p_input jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
#variable_conflict use_variable
declare prior public.purchase_shipment_commands%rowtype;shipment public.purchase_shipments%rowtype;po public.purchase_orders%rowtype;line public.purchase_order_lines%rowtype;planned public.purchase_shipment_lines%rowtype;
 request jsonb;result jsonb;item jsonb;doc jsonb;currency text;fx numeric;basis text;charges bigint:=0;vat bigint;charge numeric;quantity numeric;price numeric;goods bigint;weight numeric;residual bigint;
 reference text;note text;documents jsonb;costs jsonb:='{}';inventory bigint;receipt_result jsonb;version integer;reserved numeric;
 fabric_unit text; has_ordinary boolean:=false; is_fabric boolean;
begin
 perform inventory_internal.require_purchase_authority(p_organization_id);
 if p_command_id is null or p_shipment_id is null or p_expected_version is null or p_expected_version<0 or p_action is null or p_action not in ('save','dispatch','land','receive','cancel','close_short') or jsonb_typeof(p_input) is distinct from 'object' then raise exception 'Invalid shipment command'; end if;
 request:=jsonb_build_object('shipment',p_shipment_id,'version',p_expected_version,'action',p_action,'input',p_input);
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('shipment-command:'||p_organization_id::text||p_command_id::text,0));
 select * into prior from public.purchase_shipment_commands where organization_id=p_organization_id and command_id=p_command_id;
 if found then if prior.request<>request then raise exception 'Shipment command key was reused with different details'; end if;return prior.result;end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('shipment:'||p_organization_id::text||p_shipment_id::text,0));
 select * into shipment from public.purchase_shipments where organization_id=p_organization_id and id=p_shipment_id for update;
 if found then
   if shipment.version<>p_expected_version then raise exception 'Shipment changed on another device. Refresh before continuing.'; end if;
   if p_action='save' and shipment.status<>'draft' then raise exception 'Only a draft shipment can be edited'; end if;
 elsif p_action<>'save' or p_expected_version<>0 then raise exception 'Shipment not found in this company'; end if;
 select * into po from public.purchase_orders where organization_id=p_organization_id and id=coalesce(shipment.purchase_order_id,p_input->>'order_id') for update;
 if not found then raise exception 'Shipment purchase order not found in this company'; end if;
 if p_action='save' then
   if po.status not in ('pending','partial') then raise exception 'Choose an open purchase order'; end if;
   if shipment.id is not null and p_input->>'order_id' is distinct from shipment.purchase_order_id then raise exception 'A shipment cannot move to another order'; end if;
   currency:=p_input->>'currency';fx:=(p_input->>'exchange_rate')::numeric;basis:=p_input->>'basis';reference:=nullif(btrim(p_input->>'reference'),'');note:=coalesce(p_input->>'note','');documents:=coalesce(p_input->'documents','[]'::jsonb);
   if currency not in ('LKR','USD','EUR','GBP','INR','AED','CNY') or currency is null or fx is null or fx<=0 or fx::text in ('NaN','Infinity','-Infinity') or round(fx,6)<>fx or (currency='LKR' and fx<>1) or basis not in ('value','quantity') or basis is null or reference is null or length(reference)>100 or length(note)>2000 then raise exception 'Supply valid reference, currency, FX, allocation basis and note'; end if;
   if jsonb_typeof(p_input->'charges') is distinct from 'object' or (p_input->'charges')-array['freight','duty','insurance','clearing','vat']<>'{}'::jsonb then raise exception 'Invalid shipment charges'; end if;
   for item in select value from jsonb_each(p_input->'charges') loop charge:=item::text::numeric;if charge<0 or charge::text in ('NaN','Infinity','-Infinity') or round(charge,2)<>charge then raise exception 'Shipment charges require nonnegative two-decimal amounts';end if;end loop;
   charges:=round((coalesce((p_input#>>'{charges,freight}')::numeric,0)+coalesce((p_input#>>'{charges,duty}')::numeric,0)+coalesce((p_input#>>'{charges,insurance}')::numeric,0)+coalesce((p_input#>>'{charges,clearing}')::numeric,0))*100)::bigint;
   vat:=round(coalesce((p_input#>>'{charges,vat}')::numeric,0)*100)::bigint;
   if jsonb_typeof(documents) is distinct from 'array' then raise exception 'Shipment documents must be a list';end if;
   if jsonb_array_length(documents)>20 then raise exception 'Attach up to 20 document links';end if;
   for doc in select value from jsonb_array_elements(documents) loop if nullif(btrim(doc->>'name'),'') is null or length(doc->>'name')>200 or coalesce(doc->>'url','')!~'^https://[^[:space:]]+$' or length(doc->>'url')>2000 or coalesce(doc->>'kind','') not in ('invoice','packing_list','bill_of_lading','customs','other') then raise exception 'Supply a named HTTPS document link and document type';end if;end loop;
   if jsonb_typeof(p_input->'lines') is distinct from 'array' then raise exception 'Shipment lines must be a list';end if;
   if jsonb_array_length(p_input->'lines') not between 1 and 200 or (select count(distinct value->>'line_id') from jsonb_array_elements(p_input->'lines'))<>jsonb_array_length(p_input->'lines') then raise exception 'Supply 1 to 200 different order lines';end if;
   if shipment.id is null then
     insert into public.purchase_shipments(organization_id,id,purchase_order_id,reference,currency,exchange_rate,allocation_basis,charges_minor,recoverable_vat_minor,charges,documents,note,created_by)
       values(p_organization_id,p_shipment_id,po.id,reference,currency,fx,basis,charges,vat,p_input->'charges',documents,note,auth.uid());
   else update public.purchase_shipments set reference=reference,currency=currency,exchange_rate=fx,allocation_basis=basis,charges_minor=charges,recoverable_vat_minor=vat,charges=p_input->'charges',documents=documents,note=note where organization_id=p_organization_id and id=p_shipment_id;end if;
   delete from public.purchase_shipment_lines where organization_id=p_organization_id and shipment_id=p_shipment_id;
   for item in select value from jsonb_array_elements(p_input->'lines') order by value->>'line_id' loop
     select * into line from public.purchase_order_lines where organization_id=p_organization_id and purchase_order_id=po.id and id=(item->>'line_id')::uuid for update;
     if not found then raise exception 'Shipment line does not belong to this order';end if;
     select sector_id='textile' into is_fabric from public.products_base where organization_id=p_organization_id and id=line.product_id;
     if coalesce(is_fabric,false) then
       if has_ordinary or line.length_unit is null or (fabric_unit is not null and fabric_unit<>line.length_unit) then raise exception 'Fabric shipments need one confirmed length unit and cannot mix ordinary stock'; end if;
       fabric_unit:=line.length_unit;
     else
       if fabric_unit is not null then raise exception 'Fabric and ordinary stock require separate shipments'; end if;
       has_ordinary:=true;
     end if;
     quantity:=(item->>'qty')::numeric;price:=(item->>'unit_cost')::numeric;
     if quantity is null or quantity<=0 or round(quantity,3)<>quantity or quantity::text in ('NaN','Infinity','-Infinity') or quantity>line.qty_ordered-line.qty_received or price is null or price<0 or round(price,2)<>price or price::text in ('NaN','Infinity','-Infinity') then raise exception 'Invalid shipment quantity or foreign unit price';end if;
     goods:=round(round(quantity*price*100)*fx)::bigint;
     insert into public.purchase_shipment_lines(organization_id,shipment_id,line_id,product_id,product_name,qty,foreign_unit_minor,goods_minor) values(p_organization_id,p_shipment_id,line.id,line.product_id,line.product_name,quantity,(price*100)::bigint,goods);
   end loop;
   select sum(case when basis='value' then goods_minor else qty*1000 end) into weight from public.purchase_shipment_lines where organization_id=p_organization_id and shipment_id=p_shipment_id;
   if weight=0 and charges>0 then raise exception 'Free goods require quantity allocation';end if;
   update public.purchase_shipment_lines set allocated_minor=case when weight>0 then floor(charges*(case when basis='value' then goods_minor else qty*1000 end)/weight)::bigint else 0 end where organization_id=p_organization_id and shipment_id=p_shipment_id;
   select charges-coalesce(sum(allocated_minor),0) into residual from public.purchase_shipment_lines where organization_id=p_organization_id and shipment_id=p_shipment_id;
   with ranked as(select line_id,row_number() over(order by (case when weight>0 then mod(charges*(case when basis='value' then goods_minor else qty*1000 end),weight) else 0 end) desc,line_id) as rank from public.purchase_shipment_lines where organization_id=p_organization_id and shipment_id=p_shipment_id)
   update public.purchase_shipment_lines l set allocated_minor=l.allocated_minor+1 from ranked r where l.organization_id=p_organization_id and l.shipment_id=p_shipment_id and l.line_id=r.line_id and r.rank<=residual;
 elsif p_action in ('dispatch','land') then
   if (p_action='dispatch' and shipment.status<>'draft') or (p_action='land' and shipment.status<>'in_transit') then raise exception 'Shipment stage changed. Refresh before continuing.';end if;
   if p_action='dispatch' then
     if po.status not in ('pending','partial') then raise exception 'Order is no longer open';end if;
     for planned in select * from public.purchase_shipment_lines where organization_id=p_organization_id and shipment_id=p_shipment_id order by line_id loop
       select * into line from public.purchase_order_lines where id=planned.line_id and organization_id=p_organization_id for update;
       select coalesce(sum(l.qty-l.received_qty),0) into reserved from public.purchase_shipment_lines l join public.purchase_shipments s on s.organization_id=l.organization_id and s.id=l.shipment_id where l.organization_id=p_organization_id and l.line_id=planned.line_id and s.id<>p_shipment_id and s.status in ('in_transit','landed');
       if planned.qty+reserved>line.qty_ordered-line.qty_received then raise exception 'Other active shipments or receipts consumed this order quantity';end if;
     end loop;
   end if;
   update public.purchase_shipments set status=case when p_action='dispatch' then 'in_transit' else 'landed' end where organization_id=p_organization_id and id=p_shipment_id;
 elsif p_action='receive' then
   if shipment.status<>'landed' then raise exception 'Land this shipment before receiving';end if;
   if jsonb_typeof(p_input->'lines') is distinct from 'array' then raise exception 'Supply receiving lines';end if;
   if jsonb_array_length(p_input->'lines') not between 1 and 200 or (select count(distinct value->>'line_id') from jsonb_array_elements(p_input->'lines'))<>jsonb_array_length(p_input->'lines') then raise exception 'Supply distinct receipt lines';end if;
   perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_organization_id::text||p_command_id::text,0));
   if exists(select 1 from public.purchase_order_receipts where organization_id=p_organization_id and receipt_id=p_command_id) then raise exception 'This command key is already used by another receipt';end if;
   for item in select value from jsonb_array_elements(p_input->'lines') order by value->>'line_id' loop
     select * into planned from public.purchase_shipment_lines where organization_id=p_organization_id and shipment_id=p_shipment_id and line_id=(item->>'line_id')::uuid for update;
     quantity:=(item->>'qty')::numeric;
     if not found or quantity is null or quantity<=0 or round(quantity,3)<>quantity or quantity::text in ('NaN','Infinity','-Infinity') or quantity>planned.qty-planned.received_qty then raise exception 'Receipt exceeds this shipment line';end if;
     inventory:=round((planned.goods_minor+planned.allocated_minor)*(planned.received_qty+quantity)/planned.qty)::bigint-round((planned.goods_minor+planned.allocated_minor)*planned.received_qty/planned.qty)::bigint;
     costs:=costs||jsonb_build_object(planned.line_id::text,round(inventory::numeric/100/quantity,2));
   end loop;
   receipt_result:=inventory_internal.receive_purchase_order_costed(p_organization_id,po.id,p_command_id,p_input->'lines',costs);
   for item in select value from jsonb_array_elements(p_input->'lines') loop
     select * into planned from public.purchase_shipment_lines where organization_id=p_organization_id and shipment_id=p_shipment_id and line_id=(item->>'line_id')::uuid;
     quantity:=(item->>'qty')::numeric;inventory:=round((planned.goods_minor+planned.allocated_minor)*(planned.received_qty+quantity)/planned.qty)::bigint-round((planned.goods_minor+planned.allocated_minor)*planned.received_qty/planned.qty)::bigint;
     insert into public.purchase_shipment_receipts(organization_id,shipment_id,receipt_id,line_id,qty,inventory_minor) values(p_organization_id,p_shipment_id,p_command_id,planned.line_id,quantity,inventory);
     update public.purchase_shipment_lines set received_qty=received_qty+quantity where organization_id=p_organization_id and shipment_id=p_shipment_id and line_id=planned.line_id;
   end loop;
   if not exists(select 1 from public.purchase_shipment_lines where organization_id=p_organization_id and shipment_id=p_shipment_id and received_qty<qty) then update public.purchase_shipments set status='received' where organization_id=p_organization_id and id=p_shipment_id;end if;
 else
   if length(btrim(coalesce(p_input->>'reason','')))<5 or length(p_input->>'reason')>500 then raise exception 'Record a clear closure reason';end if;
   if shipment.status in ('received','cancelled','closed_short') then raise exception 'Shipment is already closed';end if;
   if p_action='cancel' and exists(select 1 from public.purchase_shipment_receipts where organization_id=p_organization_id and shipment_id=p_shipment_id) then raise exception 'Received stock cannot be cancelled. Close the undelivered remainder explicitly.';end if;
   if p_action='close_short' and (shipment.status<>'landed' or not exists(select 1 from public.purchase_shipment_receipts where organization_id=p_organization_id and shipment_id=p_shipment_id)) then raise exception 'Short closure requires a partially received landed shipment';end if;
   update public.purchase_shipments s set status=case when p_action='cancel' then 'cancelled' else 'closed_short' end,note=s.note||E'\nClosure: '||(p_input->>'reason') where organization_id=p_organization_id and id=p_shipment_id;
 end if;
 version:=case when shipment.id is null then 1 else shipment.version+1 end;
 update public.purchase_shipments set version=version,updated_at=now() where organization_id=p_organization_id and id=p_shipment_id;
 result:=public.get_purchase_shipment(p_organization_id,p_shipment_id)||jsonb_build_object('command_id',p_command_id);
 insert into public.purchase_shipment_commands(organization_id,command_id,shipment_id,request,result,actor_id) values(p_organization_id,p_command_id,p_shipment_id,request,result,auth.uid());
 return result;
end;
$$;
revoke all on function public.purchase_shipment_command(uuid,uuid,uuid,integer,text,jsonb) from public,anon;
grant execute on function public.purchase_shipment_command(uuid,uuid,uuid,integer,text,jsonb) to authenticated;

create or replace function public.cancel_purchase_order_atomic(p_organization_id uuid,p_purchase_order_id text)
returns text language plpgsql security definer set search_path='' as $$
declare po public.purchase_orders%rowtype;
begin
 perform inventory_internal.require_purchase_authority(p_organization_id);
 select * into po from public.purchase_orders where id=p_purchase_order_id and organization_id=p_organization_id for update;
 if not found then raise exception 'Purchase order not found in this organization';end if;
 if po.status='cancelled' then return po.id;end if;
 if exists(select 1 from public.purchase_shipments where organization_id=p_organization_id and purchase_order_id=po.id and status in ('in_transit','landed')) then raise exception 'Close active shipments before cancelling their purchase order';end if;
 perform 1 from public.purchase_order_lines where purchase_order_id=po.id order by id for update;
 if po.status<>'pending' or exists(select 1 from public.purchase_order_lines where purchase_order_id=po.id and qty_received<>0) then raise exception 'An order with receipts cannot be cancelled';end if;
 update public.purchase_orders set status='cancelled' where id=po.id;return po.id;
end;
$$;
revoke all on function public.cancel_purchase_order_atomic(uuid,text) from public,anon;
grant execute on function public.cancel_purchase_order_atomic(uuid,text) to authenticated;
