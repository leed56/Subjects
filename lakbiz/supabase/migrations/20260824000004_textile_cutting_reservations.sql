-- LakBiz Textile Phase 4: reservations, dye-lot control, cutting evidence,
-- waste and automatic remnant classification.

alter table public.textile_rolls
  add column if not exists is_remnant boolean not null default false,
  add column if not exists remnant_since timestamptz;

alter table public.textile_sale_allocations
  add column if not exists reservation_id uuid;

create table if not exists public.textile_settings (
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  remnant_threshold numeric(14,3) not null default 5 check (remnant_threshold >= 0),
  reservation_hours integer not null default 48 check (reservation_hours between 1 and 8760),
  updated_at timestamptz not null default now(), updated_by uuid default auth.uid()
);

create table if not exists public.textile_reservations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  order_reference text not null, customer_id text references public.customers(id) on delete set null,
  customer_name text, roll_id uuid not null references public.textile_rolls(id) on delete restrict,
  product_id text not null references public.products_base(id) on delete restrict,
  quantity numeric(14,3) not null check (quantity > 0), length_unit text not null check (length_unit in ('metre','yard')),
  dye_lot text, shade text, status text not null default 'active' check (status in ('active','fulfilled','released','expired')),
  expires_at timestamptz not null, exception_approved boolean not null default false, exception_reason text,
  created_by uuid not null default auth.uid(), created_at timestamptz not null default now(),
  released_by uuid, released_at timestamptz, release_reason text,
  check (not exception_approved or nullif(btrim(exception_reason), '') is not null)
);

alter table public.textile_sale_allocations
  drop constraint if exists textile_sale_allocations_reservation_id_fkey,
  add constraint textile_sale_allocations_reservation_id_fkey foreign key (reservation_id) references public.textile_reservations(id) on delete restrict;

create table if not exists public.textile_cut_tasks (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
  sale_allocation_id uuid not null unique references public.textile_sale_allocations(id) on delete restrict,
  sale_id text not null references public.sales_base(id) on delete restrict, reservation_id uuid references public.textile_reservations(id) on delete set null,
  roll_id uuid not null references public.textile_rolls(id) on delete restrict, product_id text not null references public.products_base(id) on delete restrict,
  planned_quantity numeric(14,3) not null check (planned_quantity > 0), length_unit text not null check (length_unit in ('metre','yard')),
  status text not null default 'pending' check (status in ('pending','completed','cancelled')),
  actual_cut_quantity numeric(14,3), waste_quantity numeric(14,3) not null default 0 check (waste_quantity >= 0), waste_reason text,
  is_remnant boolean not null default false, remaining_after numeric(14,3), created_at timestamptz not null default now(),
  completed_by uuid, completed_at timestamptz
);

create index if not exists textile_reservations_active_order_idx on public.textile_reservations(organization_id, order_reference, product_id) where status = 'active';
create index if not exists textile_reservations_roll_idx on public.textile_reservations(organization_id, roll_id, expires_at);
create index if not exists textile_cut_tasks_queue_idx on public.textile_cut_tasks(organization_id, status, created_at);

alter table public.textile_settings enable row level security;
alter table public.textile_reservations enable row level security;
alter table public.textile_cut_tasks enable row level security;
create policy textile_settings_select_org on public.textile_settings for select to authenticated using (organization_id in (select organization_id from public.org_members where user_id = (select auth.uid())));
create policy textile_reservations_select_org on public.textile_reservations for select to authenticated using (organization_id in (select organization_id from public.org_members where user_id = (select auth.uid())));
create policy textile_cut_tasks_select_org on public.textile_cut_tasks for select to authenticated using (organization_id in (select organization_id from public.org_members where user_id = (select auth.uid())));

create or replace function public.reserve_textile_roll(
  p_organization_id uuid, p_order_reference text, p_customer_id text, p_customer_name text,
  p_roll_id uuid, p_quantity numeric, p_expires_at timestamptz,
  p_allow_dye_lot_exception boolean default false, p_exception_reason text default null
) returns public.textile_reservations language plpgsql security definer set search_path = public as $$
declare v_roll public.textile_rolls%rowtype; v_conflict public.textile_reservations%rowtype; v_result public.textile_reservations;
begin
  if not public.org_member_can_write_module(p_organization_id, 'stock') or not public.org_member_role_in(p_organization_id, array['owner','manager','data_entry']) then raise exception 'Permission denied for Textile reservation' using errcode='42501'; end if;
  if nullif(btrim(p_order_reference),'') is null then raise exception 'Order reference is required'; end if;
  if p_quantity <= 0 or p_expires_at <= now() then raise exception 'Quantity and future expiry are required'; end if;
  select * into v_roll from public.textile_rolls where id=p_roll_id and organization_id=p_organization_id for update;
  if not found or v_roll.status in ('quarantined','returned','exhausted') then raise exception 'Roll is unavailable'; end if;
  if round(p_quantity,3) > v_roll.remaining_length-v_roll.reserved_length then raise exception 'Only % % is available', v_roll.remaining_length-v_roll.reserved_length, v_roll.length_unit; end if;
  select * into v_conflict from public.textile_reservations where organization_id=p_organization_id and lower(order_reference)=lower(btrim(p_order_reference)) and product_id=v_roll.product_id and status='active' and expires_at>now() and (coalesce(lower(dye_lot),'')<>coalesce(lower(v_roll.dye_lot),'') or coalesce(lower(shade),'')<>coalesce(lower(v_roll.shade),'')) limit 1;
  if found and not (p_allow_dye_lot_exception and public.org_member_role_in(p_organization_id,array['owner','manager']) and nullif(btrim(p_exception_reason),'') is not null) then raise exception 'Order already uses dye lot %, shade %. Manager approval is required to mix it.', coalesce(v_conflict.dye_lot,'unrecorded'), coalesce(v_conflict.shade,'unrecorded'); end if;
  insert into public.textile_reservations(organization_id,order_reference,customer_id,customer_name,roll_id,product_id,quantity,length_unit,dye_lot,shade,expires_at,exception_approved,exception_reason)
  values(p_organization_id,btrim(p_order_reference),p_customer_id,nullif(btrim(p_customer_name),''),v_roll.id,v_roll.product_id,round(p_quantity,3),v_roll.length_unit,v_roll.dye_lot,v_roll.shade,p_expires_at,found,p_exception_reason) returning * into v_result;
  update public.textile_rolls set reserved_length=reserved_length+v_result.quantity,status='reserved',updated_at=now() where id=v_roll.id;
  insert into public.textile_roll_movements(organization_id,roll_id,movement_type,quantity_delta,balance_after,reason,reference_type,reference_id,actor_user_id) values(p_organization_id,v_roll.id,'reservation',0,v_roll.remaining_length,'Reserved '||v_result.quantity||' for order '||v_result.order_reference,'reservation',v_result.id::text,auth.uid());
  return v_result;
end $$;
revoke all on function public.reserve_textile_roll(uuid,text,text,text,uuid,numeric,timestamptz,boolean,text) from public,anon;
grant execute on function public.reserve_textile_roll(uuid,text,text,text,uuid,numeric,timestamptz,boolean,text) to authenticated;

create or replace function public.release_textile_reservation(p_reservation_id uuid,p_reason text) returns void language plpgsql security definer set search_path=public as $$
declare v_res public.textile_reservations%rowtype; v_roll public.textile_rolls%rowtype;
begin
 select * into v_res from public.textile_reservations where id=p_reservation_id for update;
 if not found or not public.org_member_can_write_module(v_res.organization_id,'stock') or not public.org_member_role_in(v_res.organization_id,array['owner','manager','data_entry']) then raise exception 'Reservation not found or inaccessible' using errcode='42501'; end if;
 if v_res.status<>'active' then raise exception 'Only active reservations can be released'; end if;
 if nullif(btrim(p_reason),'') is null then raise exception 'Release reason is required'; end if;
 select * into v_roll from public.textile_rolls where id=v_res.roll_id for update;
 update public.textile_reservations set status=case when expires_at<=now() then 'expired' else 'released' end,released_by=auth.uid(),released_at=now(),release_reason=btrim(p_reason) where id=v_res.id;
 update public.textile_rolls set reserved_length=greatest(0,reserved_length-v_res.quantity),status=case when remaining_length<=0.0005 then 'exhausted' else 'opened' end,updated_at=now() where id=v_roll.id;
 insert into public.textile_roll_movements(organization_id,roll_id,movement_type,quantity_delta,balance_after,reason,reference_type,reference_id,actor_user_id) values(v_res.organization_id,v_res.roll_id,'reservation_release',0,v_roll.remaining_length,btrim(p_reason),'reservation',v_res.id::text,auth.uid());
end $$;
revoke all on function public.release_textile_reservation(uuid,text) from public,anon; grant execute on function public.release_textile_reservation(uuid,text) to authenticated;

create or replace function public.expire_textile_reservations(p_organization_id uuid) returns integer language plpgsql security definer set search_path=public as $$
declare v_res record; v_count integer:=0;
begin
 if not public.org_member_can_write_module(p_organization_id,'stock') or not public.org_member_role_in(p_organization_id,array['owner','manager','data_entry']) then raise exception 'Permission denied for Textile reservation expiry' using errcode='42501'; end if;
 for v_res in select id from public.textile_reservations where organization_id=p_organization_id and status='active' and expires_at<=now() for update skip locked loop
   perform public.release_textile_reservation(v_res.id,'Reservation expired automatically'); v_count:=v_count+1;
 end loop;
 return v_count;
end $$;
revoke all on function public.expire_textile_reservations(uuid) from public,anon; grant execute on function public.expire_textile_reservations(uuid) to authenticated;

create or replace function public.create_textile_cut_task() returns trigger language plpgsql security definer set search_path=public as $$
begin
 if new.sale_mode<>'full_roll' then insert into public.textile_cut_tasks(organization_id,sale_allocation_id,sale_id,reservation_id,roll_id,product_id,planned_quantity,length_unit) values(new.organization_id,new.id,new.sale_id,new.reservation_id,new.roll_id,new.product_id,new.quantity,new.length_unit) on conflict(sale_allocation_id) do nothing; end if; return new;
end $$;
revoke all on function public.create_textile_cut_task() from public;
create trigger create_textile_cut_task_after_allocation after insert on public.textile_sale_allocations for each row execute function public.create_textile_cut_task();

create or replace function public.complete_textile_cut_task(p_task_id uuid,p_actual_quantity numeric,p_waste_quantity numeric default 0,p_waste_reason text default null) returns public.textile_cut_tasks language plpgsql security definer set search_path=public as $$
declare v_task public.textile_cut_tasks%rowtype; v_roll public.textile_rolls%rowtype; v_threshold numeric:=5; v_remnant boolean;
begin
 select * into v_task from public.textile_cut_tasks where id=p_task_id for update;
 if not found or not public.org_member_can_write_module(v_task.organization_id,'stock') or not public.org_member_role_in(v_task.organization_id,array['owner','manager','data_entry']) then raise exception 'Cut task not found or inaccessible' using errcode='42501'; end if;
 if v_task.status<>'pending' then raise exception 'Cut task is not pending'; end if;
 if abs(round(p_actual_quantity,3)-v_task.planned_quantity)>0.0005 then raise exception 'Actual customer cut must match invoiced quantity'; end if;
 if coalesce(p_waste_quantity,0)<0 or (coalesce(p_waste_quantity,0)>0 and nullif(btrim(p_waste_reason),'') is null) then raise exception 'Waste requires a non-negative quantity and reason'; end if;
 select * into v_roll from public.textile_rolls where id=v_task.roll_id for update;
 if round(coalesce(p_waste_quantity,0),3)>v_roll.remaining_length-v_roll.reserved_length then raise exception 'Waste exceeds unreserved roll balance'; end if;
 update public.textile_rolls set remaining_length=remaining_length-round(coalesce(p_waste_quantity,0),3),damaged_length=damaged_length+round(coalesce(p_waste_quantity,0),3),updated_at=now() where id=v_roll.id returning * into v_roll;
 select coalesce(remnant_threshold,5) into v_threshold from public.textile_settings where organization_id=v_task.organization_id;
 v_remnant:=v_roll.remaining_length>0.0005 and v_roll.remaining_length<=coalesce(v_threshold,5);
 update public.textile_rolls set is_remnant=v_remnant,remnant_since=case when v_remnant then coalesce(remnant_since,now()) else null end,status=case when remaining_length<=0.0005 then 'exhausted' when reserved_length>0 then 'reserved' else 'opened' end where id=v_roll.id;
 update public.products_base set stock_qty=greatest(0,stock_qty-round(coalesce(p_waste_quantity,0),3)),updated_at=now() where id=v_task.product_id and organization_id=v_task.organization_id;
 insert into public.textile_roll_movements(organization_id,roll_id,movement_type,quantity_delta,balance_after,reason,reference_type,reference_id,actor_user_id) values(v_task.organization_id,v_task.roll_id,'cut',0,v_roll.remaining_length,'Cut desk confirmed invoice '||v_task.sale_id,'cut_task',v_task.id::text,auth.uid());
 if coalesce(p_waste_quantity,0)>0 then insert into public.textile_roll_movements(organization_id,roll_id,movement_type,quantity_delta,balance_after,reason,reference_type,reference_id,actor_user_id) values(v_task.organization_id,v_task.roll_id,'damage',-round(p_waste_quantity,3),v_roll.remaining_length,btrim(p_waste_reason),'cut_task',v_task.id::text,auth.uid()); end if;
 update public.textile_cut_tasks set status='completed',actual_cut_quantity=round(p_actual_quantity,3),waste_quantity=round(coalesce(p_waste_quantity,0),3),waste_reason=nullif(btrim(p_waste_reason),''),is_remnant=v_remnant,remaining_after=v_roll.remaining_length,completed_by=auth.uid(),completed_at=now() where id=v_task.id returning * into v_task; return v_task;
end $$;
revoke all on function public.complete_textile_cut_task(uuid,numeric,numeric,text) from public,anon; grant execute on function public.complete_textile_cut_task(uuid,numeric,numeric,text) to authenticated;

-- Reservation-aware facade: releases only the exact reserved allocation inside
-- the same transaction, then delegates all invoice/price/tender/stock checks.
create or replace function public.finalize_textile_sale_v2(p_organization_id uuid,p_sale_id text,p_customer_id text default null,p_customer_name text default null,p_discount numeric default 0,p_allocations jsonb default '[]'::jsonb,p_tenders jsonb default '[]'::jsonb) returns jsonb language plpgsql security definer set search_path=public as $$
declare v_line jsonb; v_res public.textile_reservations%rowtype; v_clean jsonb:='[]'::jsonb; v_result jsonb;
begin
 if exists(select 1 from public.sales_base where id=p_sale_id and organization_id=p_organization_id) then return public.finalize_textile_sale(p_organization_id,p_sale_id,p_customer_id,p_customer_name,p_discount,p_allocations,p_tenders); end if;
 for v_line in select value from jsonb_array_elements(p_allocations) loop
   if nullif(v_line->>'reservation_id','') is not null then
    select * into v_res from public.textile_reservations where id=(v_line->>'reservation_id')::uuid and organization_id=p_organization_id for update;
    if not found or v_res.status<>'active' or v_res.expires_at<=now() or v_res.roll_id<>(v_line->>'roll_id')::uuid or abs(v_res.quantity-round((v_line->>'quantity')::numeric,3))>0.0005 then raise exception 'Reservation is expired, fulfilled or does not match this exact roll quantity'; end if;
    if v_res.customer_id is not null and v_res.customer_id is distinct from p_customer_id then raise exception 'Reservation belongs to a different customer'; end if;
    update public.textile_rolls set reserved_length=greatest(0,reserved_length-v_res.quantity),updated_at=now() where id=v_res.roll_id;
    update public.textile_reservations set status='fulfilled',released_by=auth.uid(),released_at=now(),release_reason='Consumed by sale '||p_sale_id where id=v_res.id;
   end if;
   v_clean:=v_clean||jsonb_build_array(v_line-'reservation_id');
 end loop;
 v_result:=public.finalize_textile_sale(p_organization_id,p_sale_id,p_customer_id,p_customer_name,p_discount,v_clean,p_tenders);
 for v_line in select value from jsonb_array_elements(p_allocations) loop if nullif(v_line->>'reservation_id','') is not null then update public.textile_sale_allocations set reservation_id=(v_line->>'reservation_id')::uuid where organization_id=p_organization_id and sale_id=p_sale_id and roll_id=(v_line->>'roll_id')::uuid; update public.textile_cut_tasks set reservation_id=(v_line->>'reservation_id')::uuid where organization_id=p_organization_id and sale_id=p_sale_id and roll_id=(v_line->>'roll_id')::uuid; end if; end loop;
 return v_result;
end $$;
revoke all on function public.finalize_textile_sale_v2(uuid,text,text,text,numeric,jsonb,jsonb) from public,anon; grant execute on function public.finalize_textile_sale_v2(uuid,text,text,text,numeric,jsonb,jsonb) to authenticated;
