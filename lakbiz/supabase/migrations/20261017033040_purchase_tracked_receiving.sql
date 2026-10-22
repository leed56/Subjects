-- Exact receipt provenance. No company gates are changed.
create table inventory_internal.unit_identifiers (
 organization_id uuid not null references public.organizations(id),kind text not null check(kind in ('serial','imei')),value text not null check(btrim(value)<>''),
 unit_id uuid not null references public.inventory_units(id) on delete cascade,primary key(organization_id,kind,value)
);
create index unit_identifiers_unit_idx on inventory_internal.unit_identifiers(unit_id);
alter table inventory_internal.unit_identifiers enable row level security;
revoke all on inventory_internal.unit_identifiers from public,anon,authenticated;
insert into inventory_internal.unit_identifiers(organization_id,kind,value,unit_id)
select distinct u.organization_id,v.kind,btrim(v.value),u.id from public.inventory_units u cross join lateral(values('serial',u.serial_no),('imei',u.imei),('imei',u.secondary_imei)) v(kind,value)
where nullif(btrim(v.value),'') is not null;
create function inventory_internal.sync_unit_identifiers()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 delete from inventory_internal.unit_identifiers where unit_id=new.id;
 insert into inventory_internal.unit_identifiers(organization_id,kind,value,unit_id)
 select distinct new.organization_id,v.kind,btrim(v.value),new.id from (values('serial',new.serial_no),('imei',new.imei),('imei',new.secondary_imei)) v(kind,value) where nullif(btrim(v.value),'') is not null;
 return new;
end;
$$;
revoke all on function inventory_internal.sync_unit_identifiers() from public,anon,authenticated;
create trigger inventory_units_identifiers_sync after insert or update of organization_id,serial_no,imei,secondary_imei on public.inventory_units for each row execute function inventory_internal.sync_unit_identifiers();

create table public.purchase_receipt_identities (
 id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.organizations(id),receipt_id uuid not null,
 purchase_order_line_id uuid not null references public.purchase_order_lines(id),product_id text not null references public.products_base(id),
 variant_id uuid references public.product_variants(id),lot_id uuid references public.inventory_lots(id),unit_id uuid references public.inventory_units(id),
 qty numeric(14,3) not null check(qty>0 and qty<>'NaN'::numeric),unit_cost numeric(14,2) not null check(unit_cost>=0 and unit_cost<>'NaN'::numeric),
 foreign key(organization_id,receipt_id) references public.purchase_order_receipts(organization_id,receipt_id) deferrable initially deferred,
 check(unit_id is null or qty=1)
);
create unique index purchase_receipt_identities_unit_uq on public.purchase_receipt_identities(organization_id,unit_id) where unit_id is not null;
create unique index purchase_receipt_identities_line_uq on public.purchase_receipt_identities(organization_id,receipt_id,purchase_order_line_id,coalesce(variant_id::text,''),coalesce(lot_id::text,''),coalesce(unit_id::text,''));
create index purchase_receipt_identities_receipt_idx on public.purchase_receipt_identities(organization_id,receipt_id);
alter table public.purchase_receipt_identities enable row level security;
revoke all on public.purchase_receipt_identities from public,anon,authenticated;
grant select on public.purchase_receipt_identities to authenticated;
create policy purchase_receipt_identities_read on public.purchase_receipt_identities for select to authenticated using(public.can_see_org_financials(organization_id));

create function inventory_internal.receive_purchase_identity(tenant uuid,receipt uuid,line_id uuid,pid text,quantity numeric,cost numeric,supplier text,allocations jsonb,stamp timestamptz)
returns void language plpgsql security invoker set search_path='' as $$
#variable_conflict use_variable
declare mode text; fefo boolean; allocation jsonb; amount numeric; assigned numeric:=0; variant uuid; lot uuid; unit uuid; location uuid;
 batch text; expiry date; manufactured date; serial text; imei text; lot_row public.inventory_lots%rowtype;
begin
 if exists(select 1 from public.products_base where organization_id=tenant and id=pid and sector_id='textile') then raise exception 'Wholesale fabric stock must use Fabric Rolls receiving to preserve measured roll identities'; end if;
 select coalesce(tracking_mode,'simple'),fefo_enabled into mode,fefo from public.product_inventory_profiles where organization_id=tenant and product_id=pid;
 mode:=coalesce(mode,'simple');
 select id into location from public.inventory_locations where organization_id=tenant and is_default and active for share;
 if location is null then raise exception 'An active main receiving location is required'; end if;
 if mode='simple' then
   if allocations is not null and allocations<>'null'::jsonb and allocations<>'[]'::jsonb then raise exception 'Simple stock must not carry tracked allocations'; end if;
   insert into public.purchase_receipt_identities(organization_id,receipt_id,purchase_order_line_id,product_id,qty,unit_cost) values(tenant,receipt,line_id,pid,quantity,cost);
   return;
 end if;
 if jsonb_typeof(allocations) is distinct from 'array' then raise exception 'Exact lot, variant or serial allocations are required'; end if;
 if jsonb_array_length(allocations) not between 1 and 500 then raise exception 'Supply 1 to 500 exact receiving identities'; end if;
 for allocation in select value from jsonb_array_elements(allocations) loop
   if allocation-array['qty','variant_id','lot_id','batch_no','expiry_date','manufactured_date','serial_no','imei']<>'{}'::jsonb then raise exception 'Unknown receiving identity details'; end if;
   amount:=(allocation->>'qty')::numeric; variant:=nullif(allocation->>'variant_id','')::uuid; lot:=nullif(allocation->>'lot_id','')::uuid; unit:=null;
   serial:=nullif(btrim(allocation->>'serial_no'),'');imei:=nullif(btrim(allocation->>'imei'),'');
   if amount is null or amount<=0 or amount::text in ('NaN','Infinity','-Infinity') or round(amount,3)<>amount then raise exception 'Invalid identity quantity'; end if;
   if (mode in ('variant','variant_lot','variant_serial'))<>(variant is not null) then raise exception 'Choose the exact variant for this tracking mode'; end if;
   if variant is not null then
     perform 1 from public.product_variants where id=variant and organization_id=tenant and product_id=pid and active and stock_qty>=0 and stock_qty<>'NaN'::numeric for update;
     if not found then raise exception 'Variant is inactive or belongs to another product/company'; end if;
   end if;
   if mode in ('lot','variant_lot') then
     if serial is not null or imei is not null then raise exception 'Batch stock must not include serial identities'; end if;
     if lot is not null then
       if nullif(allocation->>'batch_no','') is not null or nullif(allocation->>'expiry_date','') is not null or nullif(allocation->>'manufactured_date','') is not null then raise exception 'Existing batch metadata cannot be replaced by receiving'; end if;
       select * into lot_row from public.inventory_lots where id=lot and organization_id=tenant and product_id=pid and variant_id is not distinct from variant for update;
       if not found or lot_row.status not in ('available','depleted') or lot_row.location_id is distinct from location or lot_row.qty_received::text in ('NaN','Infinity','-Infinity') or lot_row.qty_on_hand::text in ('NaN','Infinity','-Infinity') or lot_row.qty_received<0 or lot_row.qty_on_hand<0 or (lot_row.expiry_date is not null and (not isfinite(lot_row.expiry_date) or lot_row.expiry_date<(stamp at time zone 'Asia/Colombo')::date)) or (coalesce(fefo,false) and lot_row.expiry_date is null) then raise exception 'Choose a matching, unexpired main-location batch'; end if;
       update public.inventory_lots set qty_received=qty_received+amount,qty_on_hand=qty_on_hand+amount,status='available' where id=lot;
     else
       batch:=nullif(btrim(allocation->>'batch_no'),'');expiry:=nullif(allocation->>'expiry_date','')::date;manufactured:=nullif(allocation->>'manufactured_date','')::date;
       if batch is null or length(batch)>200 or (coalesce(fefo,false) and expiry is null) or (expiry is not null and (not isfinite(expiry) or expiry<(stamp at time zone 'Asia/Colombo')::date)) or (manufactured is not null and (not isfinite(manufactured) or manufactured>(stamp at time zone 'Asia/Colombo')::date or (expiry is not null and manufactured>expiry))) then raise exception 'Supply a valid batch number and required manufacturing/expiry dates'; end if;
       insert into public.inventory_lots(organization_id,product_id,variant_id,batch_no,manufactured_date,expiry_date,received_date,supplier_id,qty_received,qty_on_hand,status,location_id)
         values(tenant,pid,variant,batch,manufactured,expiry,(stamp at time zone 'Asia/Colombo')::date,supplier,amount,amount,'available',location) returning id into lot;
     end if;
     insert into public.inventory_lot_costs(lot_id,organization_id,unit_cost) values(lot,tenant,cost) on conflict(lot_id) do nothing;
   elsif mode in ('serial','variant_serial') then
     if amount<>1 or lot is not null or nullif(allocation->>'batch_no','') is not null or nullif(allocation->>'expiry_date','') is not null or nullif(allocation->>'manufactured_date','') is not null then raise exception 'Each serialized allocation must describe one unit'; end if;
     if (serial is null and imei is null) or length(serial)>200 or (imei is not null and imei!~'^[0-9]{15}$') then raise exception 'Supply a serial number or a valid 15-digit IMEI'; end if;
     if exists(select 1 from public.inventory_units where organization_id=tenant and ((serial is not null and serial_no=serial) or (imei is not null and (inventory_units.imei=imei or secondary_imei=imei)))) then raise exception 'This serial or IMEI is already registered'; end if;
     insert into public.inventory_units(organization_id,product_id,variant_id,serial_no,imei,status,location_id,custody_status)
       values(tenant,pid,variant,serial,imei,'available',location,'available') returning id into unit;
     insert into public.inventory_unit_costs(unit_id,organization_id,unit_cost) values(unit,tenant,cost);
   elsif mode='variant' then
     if lot is not null or serial is not null or imei is not null or nullif(allocation->>'batch_no','') is not null or nullif(allocation->>'expiry_date','') is not null or nullif(allocation->>'manufactured_date','') is not null then raise exception 'Variant stock must not carry lot or serial details'; end if;
     update public.product_variants set stock_qty=stock_qty+amount where id=variant;
   else raise exception 'Unsupported product tracking mode';
   end if;
   assigned:=assigned+amount;
   insert into public.purchase_receipt_identities(organization_id,receipt_id,purchase_order_line_id,product_id,variant_id,lot_id,unit_id,qty,unit_cost) values(tenant,receipt,line_id,pid,variant,lot,unit,amount,cost);
 end loop;
 if assigned<>quantity then raise exception 'Exact identity quantities must equal the received line quantity'; end if;
end;
$$;
revoke all on function inventory_internal.receive_purchase_identity(uuid,uuid,uuid,text,numeric,numeric,text,jsonb,timestamptz) from public,anon,authenticated;

create function public.get_purchase_receiving_catalogue(p_organization_id uuid,p_purchase_order_id text,p_line_id uuid default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare product text; location uuid; output jsonb;
begin
 if auth.uid() is null or not public.can_see_org_financials(p_organization_id) then raise exception 'Owner financial access required' using errcode='42501'; end if;
 if not exists(select 1 from public.purchase_orders where organization_id=p_organization_id and id=p_purchase_order_id) then raise exception 'Purchase order not found in this company'; end if;
 if (select count(*) from public.purchase_order_lines where organization_id=p_organization_id and purchase_order_id=p_purchase_order_id)>200 then raise exception 'Legacy order needs line review before receiving'; end if;
 if p_line_id is not null then
   select product_id into product from public.purchase_order_lines where organization_id=p_organization_id and purchase_order_id=p_purchase_order_id and id=p_line_id;
   if not found then raise exception 'Order line not found in this company'; end if;
 end if;
 select id into location from public.inventory_locations where organization_id=p_organization_id and active and is_default;
 with lines as(select l.id,l.product_id,l.product_name,l.qty_ordered,l.qty_received,coalesce(p.tracking_mode,'simple') as tracking_mode,coalesce(p.fefo_enabled,false) as fefo_enabled
   from public.purchase_order_lines l left join public.product_inventory_profiles p on p.organization_id=l.organization_id and p.product_id=l.product_id where l.organization_id=p_organization_id and l.purchase_order_id=p_purchase_order_id),
 variants as(select id,label from public.product_variants where organization_id=p_organization_id and product_id=product and active order by label,id),
 lots as(select id,batch_no,expiry_date,variant_id from public.inventory_lots where organization_id=p_organization_id and product_id=product and location_id=location and status in ('available','depleted') and (expiry_date is null or expiry_date>=(now() at time zone 'Asia/Colombo')::date) order by expiry_date nulls last,id)
 select jsonb_build_object('organizationId',p_organization_id,'orderId',p_purchase_order_id,'lineId',p_line_id,'enabled',location is not null and coalesce((select enabled from public.purchase_receipt_settings where organization_id=p_organization_id),false) and coalesce((select enabled from public.inventory_transfer_settings where organization_id=p_organization_id),false),
 'lines',coalesce((select jsonb_agg(to_jsonb(l) order by l.id) from lines l),'[]'::jsonb),'variants',coalesce((select jsonb_agg(to_jsonb(v) order by v.label,v.id) from variants v),'[]'::jsonb),'lots',coalesce((select jsonb_agg(to_jsonb(l) order by l.expiry_date nulls last,l.id) from lots l),'[]'::jsonb)) into output;
 return output;
end;
$$;
revoke all on function public.get_purchase_receiving_catalogue(uuid,text,uuid) from public,anon;
grant execute on function public.get_purchase_receiving_catalogue(uuid,text,uuid) to authenticated;

create or replace function public.receive_purchase_order_atomic(
  p_organization_id uuid,p_purchase_order_id text,p_receipt_id uuid,p_lines jsonb
) returns jsonb language plpgsql security definer set search_path='' as $$
declare
  po public.purchase_orders%rowtype; line public.purchase_order_lines%rowtype;
  prior public.purchase_order_receipts%rowtype; item jsonb; canonical jsonb;
  quantity numeric; expected numeric; current_stock numeric; product_name text; mode text;
  new_status text; result jsonb; delivery_time timestamptz:=now(); identity_key text; identity_count integer:=0;
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
    select p.name,coalesce(profile.tracking_mode,'simple'),p.stock_qty into product_name,mode,current_stock from public.products_base p
      left join public.product_inventory_profiles profile on profile.product_id=p.id and profile.organization_id=p.organization_id
      where p.id=line.product_id and p.organization_id=p_organization_id;
    if not found then raise exception 'Receipt product not found in this organization'; end if;
    if current_stock is null or current_stock<0 or current_stock::text in ('NaN','Infinity','-Infinity') then
      raise exception 'Malformed source stock requires reconciliation before receiving'; end if;

    update public.products_base set stock_qty=stock_qty+quantity,buy_price=line.unit_cost
      where id=line.product_id and organization_id=p_organization_id;
    perform inventory_internal.receive_purchase_identity(p_organization_id,p_receipt_id,line.id,line.product_id,quantity,line.unit_cost,po.supplier_id,item->'allocations',delivery_time);
    update public.purchase_order_lines set qty_received=qty_received+quantity where id=line.id;
    insert into public.stock_logs(id,organization_id,product_id,product_name,log_type,qty,note,log_date,related_supplier_id,user_id)
      values('po-receipt:'||p_receipt_id::text||':'||line.id::text,p_organization_id,line.product_id,product_name,
        'purchase',quantity,'PO '||po.po_no,delivery_time,po.supplier_id,auth.uid());
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
revoke all on function public.receive_purchase_order_atomic(uuid,text,uuid,jsonb) from public,anon;
grant execute on function public.receive_purchase_order_atomic(uuid,text,uuid,jsonb) to authenticated;
