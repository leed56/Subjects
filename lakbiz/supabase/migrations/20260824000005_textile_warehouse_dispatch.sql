-- LakBiz Textile Phase 5: scan-confirmed pick/pack/dispatch, partial
-- fulfilment, whole-roll custody transfers and sale-linked return inspection.

alter table public.textile_rolls
  add column if not exists custody_status text not null default 'available'
    check (custody_status in ('available','in_transit'));

create table if not exists public.textile_dispatches (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
  dispatch_no text not null, sale_id text not null references public.sales_base(id) on delete restrict,
  customer_name text, delivery_address text, status text not null default 'draft' check (status in ('draft','picking','packed','dispatched','delivered','cancelled')),
  carrier text, vehicle_no text, tracking_reference text, notes text,
  created_by uuid not null default auth.uid(), created_at timestamptz not null default now(),
  picked_at timestamptz, packed_at timestamptz, dispatched_at timestamptz, delivered_at timestamptz,
  unique(organization_id,dispatch_no)
);
create table if not exists public.textile_dispatch_items (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
  dispatch_id uuid not null references public.textile_dispatches(id) on delete restrict,
  sale_allocation_id uuid not null references public.textile_sale_allocations(id) on delete restrict,
  roll_id uuid not null references public.textile_rolls(id) on delete restrict,
  quantity numeric(14,3) not null check(quantity>0), picked_quantity numeric(14,3) not null default 0 check(picked_quantity>=0),
  packed_quantity numeric(14,3) not null default 0 check(packed_quantity>=0),
  created_at timestamptz not null default now(), unique(dispatch_id,sale_allocation_id),
  check(picked_quantity<=quantity and packed_quantity<=picked_quantity)
);
create table if not exists public.textile_roll_transfers (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
  transfer_no text not null, roll_id uuid not null references public.textile_rolls(id) on delete restrict,
  from_location text not null, to_location text not null, status text not null default 'in_transit' check(status in ('in_transit','received','cancelled')),
  initiated_by uuid not null default auth.uid(), initiated_at timestamptz not null default now(), received_by uuid, received_at timestamptz, notes text,
  unique(organization_id,transfer_no)
);
create table if not exists public.textile_return_inspections (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
  return_hold_id uuid not null unique references public.inventory_return_holds(id) on delete restrict,
  sale_allocation_id uuid not null references public.textile_sale_allocations(id) on delete restrict,
  original_roll_id uuid not null references public.textile_rolls(id) on delete restrict,
  quantity numeric(14,3) not null check(quantity>0), decision text not null check(decision in ('reusable_remnant','damaged','rejected')),
  new_roll_id uuid references public.textile_rolls(id) on delete restrict, reason text not null,
  inspected_by uuid not null default auth.uid(), inspected_at timestamptz not null default now()
);
create index if not exists textile_dispatches_queue_idx on public.textile_dispatches(organization_id,status,created_at);
create index if not exists textile_dispatch_items_alloc_idx on public.textile_dispatch_items(organization_id,sale_allocation_id);
create index if not exists textile_roll_transfers_queue_idx on public.textile_roll_transfers(organization_id,status,initiated_at);

alter table public.textile_dispatches enable row level security; alter table public.textile_dispatch_items enable row level security;
alter table public.textile_roll_transfers enable row level security; alter table public.textile_return_inspections enable row level security;
create policy textile_dispatches_select_org on public.textile_dispatches for select to authenticated using(organization_id in(select organization_id from public.org_members where user_id=(select auth.uid())));
create policy textile_dispatch_items_select_org on public.textile_dispatch_items for select to authenticated using(organization_id in(select organization_id from public.org_members where user_id=(select auth.uid())));
create policy textile_roll_transfers_select_org on public.textile_roll_transfers for select to authenticated using(organization_id in(select organization_id from public.org_members where user_id=(select auth.uid())));
create policy textile_return_inspections_select_org on public.textile_return_inspections for select to authenticated using(organization_id in(select organization_id from public.org_members where user_id=(select auth.uid())));
revoke insert,update,delete on public.textile_dispatches,public.textile_dispatch_items,public.textile_roll_transfers,public.textile_return_inspections from authenticated;
grant select on public.textile_dispatches,public.textile_dispatch_items,public.textile_roll_transfers,public.textile_return_inspections to authenticated;

create or replace function public.create_textile_dispatch(p_organization_id uuid,p_sale_id text,p_dispatch_id uuid,p_customer_name text,p_delivery_address text,p_items jsonb,p_notes text default null)
returns public.textile_dispatches language plpgsql security definer set search_path=public as $$
declare v_dispatch public.textile_dispatches%rowtype; v_line jsonb; v_alloc public.textile_sale_allocations%rowtype; v_qty numeric; v_assigned numeric;
begin
 if not public.org_member_can_write_module(p_organization_id,'stock') or not public.org_member_role_in(p_organization_id,array['owner','manager','data_entry']) then raise exception 'Permission denied for Textile dispatch' using errcode='42501'; end if;
 if jsonb_typeof(coalesce(p_items,'[]'::jsonb))<>'array' or jsonb_array_length(coalesce(p_items,'[]'::jsonb))=0 then raise exception 'At least one dispatch allocation is required'; end if;
 insert into public.textile_dispatches(id,organization_id,dispatch_no,sale_id,customer_name,delivery_address,notes) values(p_dispatch_id,p_organization_id,'DSP-'||upper(substr(replace(p_dispatch_id::text,'-',''),1,8)),p_sale_id,nullif(btrim(p_customer_name),''),nullif(btrim(p_delivery_address),''),nullif(btrim(p_notes),'')) returning * into v_dispatch;
 for v_line in select value from jsonb_array_elements(p_items) loop
  v_qty:=round((v_line->>'quantity')::numeric,3);
  select * into v_alloc from public.textile_sale_allocations where id=(v_line->>'sale_allocation_id')::uuid and organization_id=p_organization_id and sale_id=p_sale_id for update;
  if not found then raise exception 'Sale allocation not found'; end if;
  if v_alloc.sale_mode<>'full_roll' and not exists(select 1 from public.textile_cut_tasks where sale_allocation_id=v_alloc.id and status='completed') then raise exception 'Measured allocation must be completed at Cutting Desk first'; end if;
  select coalesce(sum(i.quantity),0) into v_assigned from public.textile_dispatch_items i join public.textile_dispatches d on d.id=i.dispatch_id where i.sale_allocation_id=v_alloc.id and d.status<>'cancelled';
  if v_qty<=0 or v_assigned+v_qty>v_alloc.quantity+0.0005 then raise exception 'Dispatch quantity exceeds unfulfilled sold quantity'; end if;
  insert into public.textile_dispatch_items(organization_id,dispatch_id,sale_allocation_id,roll_id,quantity) values(p_organization_id,v_dispatch.id,v_alloc.id,v_alloc.roll_id,v_qty);
 end loop; return v_dispatch;
end $$;
revoke all on function public.create_textile_dispatch(uuid,text,uuid,text,text,jsonb,text) from public,anon; grant execute on function public.create_textile_dispatch(uuid,text,uuid,text,text,jsonb,text) to authenticated;

create or replace function public.transition_textile_dispatch(p_dispatch_id uuid,p_next_status text,p_carrier text default null,p_vehicle_no text default null,p_tracking_reference text default null)
returns public.textile_dispatches language plpgsql security definer set search_path=public as $$
declare v_dispatch public.textile_dispatches%rowtype; v_incomplete boolean;
begin
 select * into v_dispatch from public.textile_dispatches where id=p_dispatch_id for update;
 if not found or not public.org_member_can_write_module(v_dispatch.organization_id,'stock') or not public.org_member_role_in(v_dispatch.organization_id,array['owner','manager','data_entry']) then raise exception 'Dispatch not found or inaccessible' using errcode='42501'; end if;
 if not ((v_dispatch.status='draft' and p_next_status in('picking','cancelled')) or (v_dispatch.status='picking' and p_next_status in('packed','cancelled')) or (v_dispatch.status='packed' and p_next_status in('dispatched','cancelled')) or (v_dispatch.status='dispatched' and p_next_status='delivered')) then raise exception 'Invalid dispatch status transition'; end if;
 if p_next_status='packed' then select exists(select 1 from public.textile_dispatch_items where dispatch_id=v_dispatch.id and picked_quantity<quantity) into v_incomplete; if v_incomplete then raise exception 'Every item must be fully scan-picked before packing'; end if; update public.textile_dispatch_items set packed_quantity=picked_quantity where dispatch_id=v_dispatch.id; end if;
 if p_next_status='dispatched' and (nullif(btrim(coalesce(p_vehicle_no,'')),'') is null and nullif(btrim(coalesce(p_tracking_reference,'')),'') is null) then raise exception 'Vehicle or tracking reference is required'; end if;
 update public.textile_dispatches set status=p_next_status,carrier=coalesce(nullif(btrim(p_carrier),''),carrier),vehicle_no=coalesce(nullif(btrim(p_vehicle_no),''),vehicle_no),tracking_reference=coalesce(nullif(btrim(p_tracking_reference),''),tracking_reference),picked_at=case when p_next_status='picking' then now() else picked_at end,packed_at=case when p_next_status='packed' then now() else packed_at end,dispatched_at=case when p_next_status='dispatched' then now() else dispatched_at end,delivered_at=case when p_next_status='delivered' then now() else delivered_at end where id=v_dispatch.id returning * into v_dispatch; return v_dispatch;
end $$;
revoke all on function public.transition_textile_dispatch(uuid,text,text,text,text) from public,anon; grant execute on function public.transition_textile_dispatch(uuid,text,text,text,text) to authenticated;

create or replace function public.scan_textile_dispatch_pick(p_dispatch_id uuid,p_roll_code text,p_quantity numeric)
returns public.textile_dispatch_items language plpgsql security definer set search_path=public as $$
declare v_dispatch public.textile_dispatches%rowtype; v_roll public.textile_rolls%rowtype; v_item public.textile_dispatch_items%rowtype;
begin
 select * into v_dispatch from public.textile_dispatches where id=p_dispatch_id for update;
 if not found or v_dispatch.status<>'picking' or not public.org_member_can_write_module(v_dispatch.organization_id,'stock') or not public.org_member_role_in(v_dispatch.organization_id,array['owner','manager','data_entry']) then raise exception 'Dispatch is not in an accessible picking state' using errcode='42501'; end if;
 select * into v_roll from public.textile_rolls where organization_id=v_dispatch.organization_id and (lower(roll_no)=lower(btrim(p_roll_code)) or lower(coalesce(barcode,''))=lower(btrim(p_roll_code))) for update;
 if not found then raise exception 'Scanned roll does not belong to this organization'; end if;
 select * into v_item from public.textile_dispatch_items where dispatch_id=v_dispatch.id and roll_id=v_roll.id for update;
 if not found then raise exception 'Wrong roll for this dispatch'; end if;
 if p_quantity<=0 or v_item.picked_quantity+round(p_quantity,3)>v_item.quantity+0.0005 then raise exception 'Pick quantity exceeds this dispatch item'; end if;
 update public.textile_dispatch_items set picked_quantity=picked_quantity+round(p_quantity,3) where id=v_item.id returning * into v_item; return v_item;
end $$;
revoke all on function public.scan_textile_dispatch_pick(uuid,text,numeric) from public,anon; grant execute on function public.scan_textile_dispatch_pick(uuid,text,numeric) to authenticated;

create or replace function public.initiate_textile_roll_transfer(p_organization_id uuid,p_transfer_id uuid,p_roll_code text,p_to_location text,p_notes text default null)
returns public.textile_roll_transfers language plpgsql security definer set search_path=public as $$
declare v_roll public.textile_rolls%rowtype; v_transfer public.textile_roll_transfers%rowtype;
begin
 if not public.org_member_can_write_module(p_organization_id,'stock') or not public.org_member_role_in(p_organization_id,array['owner','manager']) then raise exception 'Transfer initiation requires owner or manager' using errcode='42501'; end if;
 select * into v_roll from public.textile_rolls where organization_id=p_organization_id and (lower(roll_no)=lower(btrim(p_roll_code)) or lower(coalesce(barcode,''))=lower(btrim(p_roll_code))) for update;
 if not found or v_roll.custody_status<>'available' or v_roll.status in('exhausted','returned') or v_roll.reserved_length>0 then raise exception 'Roll is unavailable, reserved or already in transit'; end if;
 if nullif(btrim(v_roll.rack_location),'') is null or nullif(btrim(p_to_location),'') is null or lower(btrim(v_roll.rack_location))=lower(btrim(p_to_location)) then raise exception 'Valid different source and destination locations are required'; end if;
 insert into public.textile_roll_transfers(id,organization_id,transfer_no,roll_id,from_location,to_location,notes) values(p_transfer_id,p_organization_id,'TRF-'||upper(substr(replace(p_transfer_id::text,'-',''),1,8)),v_roll.id,v_roll.rack_location,btrim(p_to_location),nullif(btrim(p_notes),'')) returning * into v_transfer;
 update public.textile_rolls set custody_status='in_transit',updated_at=now() where id=v_roll.id;
 insert into public.textile_roll_movements(organization_id,roll_id,movement_type,quantity_delta,balance_after,reason,reference_type,reference_id,actor_user_id) values(p_organization_id,v_roll.id,'transfer',0,v_roll.remaining_length,'Transfer out: '||v_transfer.from_location||' → '||v_transfer.to_location,'roll_transfer',v_transfer.id::text,auth.uid()); return v_transfer;
end $$;
revoke all on function public.initiate_textile_roll_transfer(uuid,uuid,text,text,text) from public,anon; grant execute on function public.initiate_textile_roll_transfer(uuid,uuid,text,text,text) to authenticated;

create or replace function public.receive_textile_roll_transfer(p_transfer_id uuid,p_roll_code text)
returns public.textile_roll_transfers language plpgsql security definer set search_path=public as $$
declare v_transfer public.textile_roll_transfers%rowtype; v_roll public.textile_rolls%rowtype;
begin
 select * into v_transfer from public.textile_roll_transfers where id=p_transfer_id for update;
 if not found or v_transfer.status<>'in_transit' or not public.org_member_can_write_module(v_transfer.organization_id,'stock') or not public.org_member_role_in(v_transfer.organization_id,array['owner','manager','data_entry']) then raise exception 'Transfer not found or inaccessible' using errcode='42501'; end if;
 select * into v_roll from public.textile_rolls where id=v_transfer.roll_id and (lower(roll_no)=lower(btrim(p_roll_code)) or lower(coalesce(barcode,''))=lower(btrim(p_roll_code))) for update;
 if not found then raise exception 'Wrong roll scanned at receiving'; end if;
 update public.textile_rolls set custody_status='available',rack_location=v_transfer.to_location,updated_at=now() where id=v_roll.id;
 update public.textile_roll_transfers set status='received',received_by=auth.uid(),received_at=now() where id=v_transfer.id returning * into v_transfer;
 insert into public.textile_roll_movements(organization_id,roll_id,movement_type,quantity_delta,balance_after,reason,reference_type,reference_id,actor_user_id) values(v_transfer.organization_id,v_roll.id,'transfer',0,v_roll.remaining_length,'Transfer received at '||v_transfer.to_location,'roll_transfer',v_transfer.id::text,auth.uid()); return v_transfer;
end $$;
revoke all on function public.receive_textile_roll_transfer(uuid,text) from public,anon; grant execute on function public.receive_textile_roll_transfer(uuid,text) to authenticated;

create or replace function public.textile_roll_receipt_movement()
returns trigger language plpgsql security definer set search_path=public as $$
declare v_product_name text;
begin
 if coalesce(current_setting('app.textile_return_remnant',true),'')='on' then return new; end if;
 update public.products_base set stock_qty=stock_qty+new.remaining_length,updated_at=now() where id=new.product_id and organization_id=new.organization_id returning name into v_product_name;
 insert into public.stock_logs(id,organization_id,product_id,product_name,log_type,qty,note,log_date,user_id,created_at) values(gen_random_uuid()::text,new.organization_id,new.product_id,v_product_name,'purchase',new.remaining_length,'Textile roll '||new.roll_no||' received',now(),new.created_by,now());
 insert into public.textile_roll_movements(organization_id,roll_id,movement_type,quantity_delta,balance_after,reason,reference_type,reference_id,actor_user_id) values(new.organization_id,new.id,'receipt',new.remaining_length,new.remaining_length,case when new.damaged_length>0 then 'Physical roll received; damaged measure excluded from usable balance' else 'Physical roll received' end,case when new.source_reference is null then null else 'source_reference' end,new.source_reference,new.created_by); return new;
end $$;
revoke all on function public.textile_roll_receipt_movement() from public;

create or replace function public.inspect_textile_return(p_organization_id uuid,p_hold_id uuid,p_sale_allocation_id uuid,p_decision text,p_reason text,p_new_roll_no text default null)
returns public.textile_return_inspections language plpgsql security definer set search_path=public as $$
declare v_hold public.inventory_return_holds%rowtype; v_return public.sale_returns%rowtype; v_alloc public.textile_sale_allocations%rowtype; v_original public.textile_rolls%rowtype; v_new_roll uuid; v_result public.textile_return_inspections%rowtype;
begin
 if not public.org_member_can_write_module(p_organization_id,'stock') or not public.org_member_role_in(p_organization_id,array['owner','manager']) then raise exception 'Textile return inspection requires owner or manager' using errcode='42501'; end if;
 if p_decision not in('reusable_remnant','damaged','rejected') or nullif(btrim(p_reason),'') is null then raise exception 'Valid decision and reason are required'; end if;
 select * into v_hold from public.inventory_return_holds where id=p_hold_id and organization_id=p_organization_id for update;
 if not found or v_hold.released_at is not null then raise exception 'Return hold is unavailable or already resolved'; end if;
 select * into v_return from public.sale_returns where id=v_hold.return_id and organization_id=p_organization_id;
 select * into v_alloc from public.textile_sale_allocations where id=p_sale_allocation_id and organization_id=p_organization_id and sale_id=v_return.sale_id and product_id=v_hold.product_id;
 if not found or v_hold.qty>v_alloc.quantity+0.0005 then raise exception 'Return does not match the original Textile sale allocation'; end if;
 select * into v_original from public.textile_rolls where id=v_alloc.roll_id;
 if p_decision='reusable_remnant' then
  if nullif(btrim(p_new_roll_no),'') is null then raise exception 'A new remnant roll number is required'; end if;
  perform set_config('app.textile_return_remnant','on',true);
  insert into public.textile_rolls(organization_id,product_id,supplier_id,roll_no,supplier_lot,dye_lot,shade,width,width_unit,length_unit,received_length,remaining_length,grade,rack_location,source_reference,status,is_remnant,remnant_since,notes)
  values(p_organization_id,v_alloc.product_id,v_original.supplier_id,btrim(p_new_roll_no),v_original.supplier_lot,v_original.dye_lot,v_original.shade,v_original.width,v_original.width_unit,v_alloc.length_unit,v_hold.qty,v_hold.qty,'RETURN',v_original.rack_location,v_return.return_no,'opened',true,now(),'Reusable customer-return remnant from sale '||v_return.sale_id) returning id into v_new_roll;
  insert into public.textile_roll_movements(organization_id,roll_id,movement_type,quantity_delta,balance_after,reason,reference_type,reference_id,actor_user_id) values(p_organization_id,v_new_roll,'return',v_hold.qty,v_hold.qty,btrim(p_reason),'sale_return',v_return.id::text,auth.uid());
 else
  update public.products_base set stock_qty=greatest(0,stock_qty-v_hold.qty),updated_at=now() where id=v_hold.product_id and organization_id=p_organization_id;
  insert into public.stock_logs(id,organization_id,product_id,product_name,log_type,qty,note,log_date,user_id,created_at) select gen_random_uuid()::text,p_organization_id,p.id,p.name,'write_off',-v_hold.qty,'Textile return '||v_return.return_no||': '||btrim(p_reason),now(),auth.uid(),now() from public.products_base p where p.id=v_hold.product_id and p.organization_id=p_organization_id;
 end if;
 update public.inventory_return_holds set disposition=case when p_decision='damaged' then 'damaged' else 'inspection' end,resolution=case when p_decision='reusable_remnant' then 'resale' else 'write_off' end,note=btrim(p_reason),resolved_by=auth.uid(),released_at=now() where id=v_hold.id;
 insert into public.textile_return_inspections(organization_id,return_hold_id,sale_allocation_id,original_roll_id,quantity,decision,new_roll_id,reason) values(p_organization_id,v_hold.id,v_alloc.id,v_alloc.roll_id,v_hold.qty,p_decision,v_new_roll,btrim(p_reason)) returning * into v_result; return v_result;
end $$;
revoke all on function public.inspect_textile_return(uuid,uuid,uuid,text,text,text) from public,anon; grant execute on function public.inspect_textile_return(uuid,uuid,uuid,text,text,text) to authenticated;

create or replace function public.finalize_textile_sale_v3(p_organization_id uuid,p_sale_id text,p_customer_id text default null,p_customer_name text default null,p_discount numeric default 0,p_allocations jsonb default '[]'::jsonb,p_tenders jsonb default '[]'::jsonb)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_line jsonb;
begin
 for v_line in select value from jsonb_array_elements(p_allocations) loop if exists(select 1 from public.textile_rolls where id=(v_line->>'roll_id')::uuid and organization_id=p_organization_id and custody_status<>'available') then raise exception 'A selected roll is in transit and cannot be sold'; end if; end loop;
 return public.finalize_textile_sale_v2(p_organization_id,p_sale_id,p_customer_id,p_customer_name,p_discount,p_allocations,p_tenders);
end $$;
revoke all on function public.finalize_textile_sale_v3(uuid,text,text,text,numeric,jsonb,jsonb) from public,anon; grant execute on function public.finalize_textile_sale_v3(uuid,text,text,text,numeric,jsonb,jsonb) to authenticated;
