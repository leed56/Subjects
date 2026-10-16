-- Phase 3 checkpoint: prepared simple-stock PO receiving authority.
-- No organization is enabled by this migration. UI integration comes next.
create table public.purchase_receipt_settings (
  organization_id uuid primary key references public.organizations(id),
  enabled boolean not null default false
);
create table public.purchase_order_receipts (
  organization_id uuid not null references public.organizations(id),
  receipt_id uuid not null,
  purchase_order_id text not null references public.purchase_orders(id),
  request_lines jsonb not null,
  result jsonb not null,
  received_by uuid not null references auth.users(id),
  received_at timestamptz not null default now(),
  primary key (organization_id,receipt_id)
);
create index purchase_order_receipts_order_idx on public.purchase_order_receipts(purchase_order_id,received_at);
alter table public.purchase_receipt_settings enable row level security;
alter table public.purchase_order_receipts enable row level security;
revoke all on public.purchase_receipt_settings,public.purchase_order_receipts from public,anon,authenticated;
grant select on public.purchase_receipt_settings,public.purchase_order_receipts to authenticated;
create policy purchase_receipt_settings_read on public.purchase_receipt_settings
  for select to authenticated using(exists(select 1 from public.org_members m where m.organization_id=purchase_receipt_settings.organization_id and m.user_id=auth.uid()));
create policy purchase_order_receipts_read on public.purchase_order_receipts
  for select to authenticated using(public.can_see_org_financials(organization_id));

-- Direct legacy snapshots must not overwrite committed receipt quantities or
-- replace stable database line IDs after a controlled authority enablement.
-- Invoker security is intentional: current_user is the actual SQL writer.
create function inventory_internal.guard_authoritative_purchase_order()
returns trigger language plpgsql security invoker set search_path='' as $$
declare tenant uuid;
begin
  if tg_op='DELETE' then tenant:=old.organization_id; else tenant:=new.organization_id; end if;
  if current_user in ('authenticated','anon') and (
    exists(select 1 from public.purchase_receipt_settings where organization_id=tenant and enabled)
    or (tg_op='UPDATE' and exists(select 1 from public.purchase_receipt_settings where organization_id=old.organization_id and enabled))
  ) then raise exception 'Purchase orders require the atomic purchasing workflow' using errcode='42501'; end if;
  if tg_op='DELETE' then return old; else return new; end if;
end;
$$;
revoke all on function inventory_internal.guard_authoritative_purchase_order() from public,anon,authenticated;
create trigger purchase_orders_authority_guard before insert or update or delete on public.purchase_orders
for each row execute function inventory_internal.guard_authoritative_purchase_order();
create trigger purchase_order_lines_authority_guard before insert or update or delete on public.purchase_order_lines
for each row execute function inventory_internal.guard_authoritative_purchase_order();

create function public.receive_purchase_order_atomic(
  p_organization_id uuid,p_purchase_order_id text,p_receipt_id uuid,p_lines jsonb
) returns jsonb language plpgsql security definer set search_path='' as $$
declare
  po public.purchase_orders%rowtype; line public.purchase_order_lines%rowtype;
  prior public.purchase_order_receipts%rowtype; item jsonb; canonical jsonb;
  quantity numeric; expected numeric; current_stock numeric; product_name text; mode text;
  new_status text; result jsonb; delivery_time timestamptz:=now();
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
    if mode<>'simple' then raise exception 'Tracked products require exact lot, variant or serial receiving'; end if;
    update public.products_base set stock_qty=stock_qty+quantity,buy_price=line.unit_cost
      where id=line.product_id and organization_id=p_organization_id;
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
