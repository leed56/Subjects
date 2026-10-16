-- Application commands for opt-in atomic purchasing.
create table public.purchase_order_create_requests (
  purchase_order_id text primary key references public.purchase_orders(id),
  organization_id uuid not null references public.organizations(id),
  request jsonb not null, created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);
alter table public.purchase_order_create_requests enable row level security;
revoke all on public.purchase_order_create_requests from public,anon,authenticated;
grant select on public.purchase_order_create_requests to authenticated;
create policy purchase_order_create_requests_read on public.purchase_order_create_requests
for select to authenticated using(public.can_see_org_financials(organization_id));

create function inventory_internal.require_purchase_authority(tenant uuid)
returns void language plpgsql security definer set search_path='' as $$
begin
  if auth.uid() is null or not public.can_see_org_financials(tenant)
    or not public.org_member_can_write_module(tenant,'suppliers')
    or not public.org_member_can_write_module(tenant,'stock') then
    raise exception 'Purchasing requires owner purchasing and stock access' using errcode='42501'; end if;
  perform 1 from public.purchase_receipt_settings where organization_id=tenant and enabled for share;
  if not found then raise exception 'Atomic purchasing is not enabled'; end if;
end;
$$;
revoke all on function inventory_internal.require_purchase_authority(uuid) from public,anon,authenticated;

create function public.get_purchase_order_authority_snapshot(p_organization_id uuid,p_purchase_order_id text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare po public.purchase_orders%rowtype;
begin
  perform inventory_internal.require_purchase_authority(p_organization_id);
  -- Exclude a concurrent receipt/cancel while building a consistent response.
  select * into po from public.purchase_orders where id=p_purchase_order_id and organization_id=p_organization_id for share;
  if not found then raise exception 'Purchase order not found in this organization'; end if;
  return jsonb_build_object('order',to_jsonb(po),
    'lines',(select coalesce(jsonb_agg(to_jsonb(l) order by l.line_order,l.id),'[]'::jsonb) from public.purchase_order_lines l where l.purchase_order_id=po.id and l.organization_id=p_organization_id),
    'products',(select coalesce(jsonb_agg(jsonb_build_object('id',p.id,'organization_id',p.organization_id,'stock_qty',p.stock_qty,'buy_price',p.buy_price)),'[]'::jsonb)
      from public.products_base p where p.organization_id=p_organization_id and p.id in(select product_id from public.purchase_order_lines where purchase_order_id=po.id)),
    'logs',(select coalesce(jsonb_agg(to_jsonb(l)),'[]'::jsonb) from public.stock_logs l where l.organization_id=p_organization_id and exists(
      select 1 from public.purchase_order_receipts r where r.organization_id=p_organization_id and r.purchase_order_id=po.id and l.id like 'po-receipt:'||r.receipt_id::text||':%')));
end;
$$;

create function public.create_purchase_order_atomic(p_organization_id uuid,p_purchase_order_id text,p_input jsonb)
returns text language plpgsql security definer set search_path='' as $$
declare prior public.purchase_order_create_requests%rowtype; item jsonb;
  supplier_name text; product_name text; quantity numeric; cost numeric; total numeric:=0; position integer:=0;
begin
  perform inventory_internal.require_purchase_authority(p_organization_id);
  if p_purchase_order_id is null or p_purchase_order_id::uuid is null or jsonb_typeof(p_input) is distinct from 'object'
    or jsonb_typeof(p_input->'lines') is distinct from 'array' then raise exception 'Invalid purchase order request'; end if;
  if jsonb_array_length(p_input->'lines') not between 1 and 200 then raise exception 'Submit 1 to 200 order lines'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_organization_id::text||p_purchase_order_id,0));
  select * into prior from public.purchase_order_create_requests where purchase_order_id=p_purchase_order_id;
  if found then
    if prior.organization_id<>p_organization_id or prior.request<>p_input then raise exception 'Order key was reused with different details'; end if;
    return p_purchase_order_id;
  end if;
  select s.name into supplier_name from public.suppliers s where s.id=p_input->>'supplierId' and s.organization_id=p_organization_id for share;
  if not found then raise exception 'Supplier must belong to this organization'; end if;
  if nullif(p_input->>'relatedJobId','') is not null and not exists(
    select 1 from public.ac_jobs_base where id=p_input->>'relatedJobId' and organization_id=p_organization_id
  ) then raise exception 'Related job must belong to this organization'; end if;
  if (select count(distinct value->>'productId') from jsonb_array_elements(p_input->'lines'))<>jsonb_array_length(p_input->'lines') then
    raise exception 'Every order line requires a unique product'; end if;
  insert into public.purchase_orders(id,organization_id,po_no,supplier_id,supplier_name,related_job_id,note)
    values(p_purchase_order_id,p_organization_id,'PO-'||upper(replace(p_purchase_order_id,'-','')),p_input->>'supplierId',supplier_name,
      nullif(p_input->>'relatedJobId',''),nullif(btrim(p_input->>'note'),''));
  for item in select value from jsonb_array_elements(p_input->'lines') loop
    quantity:=(item->>'qty')::numeric; cost:=(item->>'unitCost')::numeric;
    if quantity is null or cost is null or quantity<=0 or cost<0
      or quantity::text in ('NaN','Infinity','-Infinity') or cost::text in ('NaN','Infinity','-Infinity')
      or round(quantity,3)<>quantity or round(cost,2)<>cost then raise exception 'Invalid order quantity or cost'; end if;
    select p.name into product_name from public.products_base p where p.id=item->>'productId' and p.organization_id=p_organization_id for share;
    if not found then raise exception 'Product must belong to this organization'; end if;
    insert into public.purchase_order_lines(purchase_order_id,organization_id,product_id,product_name,qty_ordered,unit_cost,line_order)
      values(p_purchase_order_id,p_organization_id,item->>'productId',product_name,quantity,cost,position);
    total:=total+quantity*cost; position:=position+1;
  end loop;
  update public.purchase_orders set expected_total=total where id=p_purchase_order_id;
  insert into public.purchase_order_create_requests(purchase_order_id,organization_id,request,created_by)
    values(p_purchase_order_id,p_organization_id,p_input,auth.uid());
  return p_purchase_order_id;
end;
$$;

create function public.cancel_purchase_order_atomic(p_organization_id uuid,p_purchase_order_id text)
returns text language plpgsql security definer set search_path='' as $$
declare po public.purchase_orders%rowtype;
begin
  perform inventory_internal.require_purchase_authority(p_organization_id);
  select * into po from public.purchase_orders where id=p_purchase_order_id and organization_id=p_organization_id for update;
  if not found then raise exception 'Purchase order not found in this organization'; end if;
  if po.status='cancelled' then return po.id; end if;
  perform 1 from public.purchase_order_lines where purchase_order_id=po.id order by id for update;
  if po.status<>'pending' or exists(select 1 from public.purchase_order_lines where purchase_order_id=po.id and qty_received<>0) then
    raise exception 'An order with receipts cannot be cancelled'; end if;
  update public.purchase_orders set status='cancelled' where id=po.id;
  return po.id;
end;
$$;
revoke all on function public.get_purchase_order_authority_snapshot(uuid,text),public.create_purchase_order_atomic(uuid,text,jsonb),public.cancel_purchase_order_atomic(uuid,text) from public,anon;
grant execute on function public.get_purchase_order_authority_snapshot(uuid,text),public.create_purchase_order_atomic(uuid,text,jsonb),public.cancel_purchase_order_atomic(uuid,text) to authenticated;

create function inventory_internal.guard_purchase_receipt_log()
returns trigger language plpgsql security invoker set search_path='' as $$
begin
  if current_user in ('authenticated','anon') then
    if (tg_op<>'DELETE' and new.id like 'po-receipt:%') or (tg_op<>'INSERT' and old.id like 'po-receipt:%') then
      raise exception 'Purchase receipt movements are server controlled' using errcode='42501'; end if;
  end if;
  if tg_op='DELETE' then return old; else return new; end if;
end;
$$;
revoke all on function inventory_internal.guard_purchase_receipt_log() from public,anon,authenticated;
create trigger stock_logs_purchase_receipt_guard before insert or update or delete on public.stock_logs
for each row execute function inventory_internal.guard_purchase_receipt_log();
