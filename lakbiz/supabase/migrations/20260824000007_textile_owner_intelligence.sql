-- LakBiz Textile Phase 7: owner-only operational intelligence and immutable
-- audit snapshots. Units remain separated; missing cost is reported, not zeroed silently.

create table if not exists public.textile_audit_snapshots(
 id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.organizations(id) on delete cascade,
 period_from date not null,period_to date not null,payload jsonb not null,created_by uuid not null default auth.uid(),created_at timestamptz not null default now()
);
create index if not exists textile_audit_snapshots_org_time_idx on public.textile_audit_snapshots(organization_id,created_at desc);
alter table public.textile_audit_snapshots enable row level security;
create policy textile_audit_snapshots_owner on public.textile_audit_snapshots for select to authenticated using(public.org_member_role_in(organization_id,array['owner']));
revoke insert,update,delete on public.textile_audit_snapshots from authenticated;grant select on public.textile_audit_snapshots to authenticated;

create or replace function public.block_textile_audit_snapshot_mutation()returns trigger language plpgsql as $$begin raise exception 'Textile audit snapshots are immutable';end$$;
revoke all on function public.block_textile_audit_snapshot_mutation() from public;
create trigger block_textile_audit_snapshot_mutation_trigger before update or delete on public.textile_audit_snapshots for each row execute function public.block_textile_audit_snapshot_mutation();

create or replace function public.get_textile_owner_intelligence(p_organization_id uuid,p_from date,p_to date)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_stock jsonb;v_channels jsonb;v_ageing jsonb;v_slow jsonb;v_locations jsonb;v_waste jsonb;v_receivables jsonb;v_forecast jsonb;v_quality jsonb;
begin
 if p_from is null or p_to is null or p_from>p_to then raise exception 'Valid reporting period is required';end if;
 if not public.org_member_role_in(p_organization_id,array['owner']) then raise exception 'Owner access required for Textile intelligence' using errcode='42501';end if;
 if not exists(select 1 from public.organizations where id=p_organization_id and sector='textile') then raise exception 'Organization is not Textile';end if;

 select coalesce(jsonb_agg(to_jsonb(x) order by x.length_unit),'[]'::jsonb) into v_stock from(
  select r.length_unit,count(*) filter(where r.status not in('exhausted','returned'))::int active_rolls,
   round(sum(r.remaining_length) filter(where r.status not in('returned')),3) remaining,
   round(sum(r.reserved_length),3) reserved,round(sum(r.damaged_length),3) damaged,
   count(*) filter(where r.is_remnant and r.status not in('exhausted','returned'))::int remnants,
   round(sum(r.remaining_length*coalesce(c.landed_unit_cost,c.unit_cost)) filter(where r.status not in('returned')),2) stock_value_lkr,
   round(sum(r.remaining_length) filter(where c.roll_id is not null and r.status not in('returned')),3) costed_quantity,
   round(sum(r.remaining_length) filter(where c.roll_id is null and r.status not in('returned')),3) uncosted_quantity
  from public.textile_rolls r left join public.textile_roll_costs c on c.roll_id=r.id
  where r.organization_id=p_organization_id group by r.length_unit
 )x;

 with sale_gross as(select a.sale_id,sum(a.quantity*a.unit_price) gross from public.textile_sale_allocations a where a.organization_id=p_organization_id group by a.sale_id),
 lines as(select a.sale_mode,a.quantity,a.length_unit,a.quantity*a.unit_price*case when g.gross>0 then s.total/g.gross else 0 end net_revenue,
  a.quantity*coalesce(c.landed_unit_cost,c.unit_cost) cost,case when c.roll_id is null then a.quantity else 0 end uncosted_qty
  from public.textile_sale_allocations a join public.sales_base s on s.id=a.sale_id join sale_gross g on g.sale_id=a.sale_id
  left join public.textile_roll_costs c on c.roll_id=a.roll_id where a.organization_id=p_organization_id and s.sale_date::date between p_from and p_to)
 select coalesce(jsonb_agg(to_jsonb(x) order by x.sale_mode,x.length_unit),'[]'::jsonb) into v_channels from(
  select sale_mode,length_unit,round(sum(quantity),3) quantity,round(sum(net_revenue),2) revenue_lkr,
   round(sum(cost),2) known_cost_lkr,round(sum(net_revenue)-sum(cost),2) known_margin_lkr,round(sum(uncosted_qty),3) uncosted_quantity
  from lines group by sale_mode,length_unit)x;

 select coalesce(jsonb_agg(to_jsonb(x) order by x.age_days desc),'[]'::jsonb) into v_ageing from(
  select r.id,r.roll_no,r.product_id,r.length_unit,r.remaining_length,r.is_remnant,r.rack_location,
   current_date-r.received_at::date age_days,round(r.remaining_length*coalesce(c.landed_unit_cost,c.unit_cost),2) value_lkr,
   case when current_date-r.received_at::date<=30 then '0-30' when current_date-r.received_at::date<=60 then '31-60' when current_date-r.received_at::date<=90 then '61-90' when current_date-r.received_at::date<=180 then '91-180' else '180+' end age_band
  from public.textile_rolls r left join public.textile_roll_costs c on c.roll_id=r.id where r.organization_id=p_organization_id and r.remaining_length>0.0005 and r.status not in('returned','exhausted') order by age_days desc limit 250)x;

 select coalesce(jsonb_agg(to_jsonb(x) order by x.age_days desc),'[]'::jsonb) into v_slow from(
  select r.id,r.roll_no,r.product_id,r.length_unit,r.remaining_length,r.rack_location,current_date-r.received_at::date age_days,
   max(a.created_at)::date last_sale_date,round(r.remaining_length*coalesce(c.landed_unit_cost,c.unit_cost),2) value_lkr
  from public.textile_rolls r left join public.textile_sale_allocations a on a.roll_id=r.id left join public.textile_roll_costs c on c.roll_id=r.id
  where r.organization_id=p_organization_id and r.remaining_length>0.0005 and r.status not in('returned','exhausted')
  group by r.id,c.landed_unit_cost,c.unit_cost having coalesce(max(a.created_at)::date,r.received_at::date)<=current_date-interval '90 days' order by age_days desc limit 100)x;

 select coalesce(jsonb_agg(to_jsonb(x) order by x.location,x.length_unit),'[]'::jsonb) into v_locations from(
  select coalesce(nullif(btrim(r.rack_location),''),'Unassigned') location,r.length_unit,count(*)::int rolls,round(sum(r.remaining_length),3) remaining,
   round(sum(r.remaining_length*coalesce(c.landed_unit_cost,c.unit_cost)),2) value_lkr
  from public.textile_rolls r left join public.textile_roll_costs c on c.roll_id=r.id where r.organization_id=p_organization_id and r.status not in('returned','exhausted') group by location,r.length_unit)x;

 select coalesce(jsonb_agg(to_jsonb(x) order by x.length_unit),'[]'::jsonb) into v_waste from(
  select t.length_unit,round(sum(t.planned_quantity),3) planned_cut,round(sum(t.waste_quantity),3) waste,
   round(case when sum(t.planned_quantity)>0 then sum(t.waste_quantity)/sum(t.planned_quantity)*100 else 0 end,2) waste_percent,
   count(*) filter(where t.waste_quantity>0)::int waste_events
  from public.textile_cut_tasks t where t.organization_id=p_organization_id and t.status='completed' and t.completed_at::date between p_from and p_to group by t.length_unit)x;

 select jsonb_build_object('open_total',coalesce(sum(outstanding_amount),0),'overdue_total',coalesce(sum(outstanding_amount) filter(where due_date<current_date),0),
  'current',coalesce(sum(outstanding_amount) filter(where due_date>=current_date),0),'days_1_30',coalesce(sum(outstanding_amount) filter(where due_date<current_date and due_date>=current_date-30),0),
  'days_31_60',coalesce(sum(outstanding_amount) filter(where due_date<current_date-30 and due_date>=current_date-60),0),'days_61_90',coalesce(sum(outstanding_amount) filter(where due_date<current_date-60 and due_date>=current_date-90),0),
  'days_90_plus',coalesce(sum(outstanding_amount) filter(where due_date<current_date-90),0)) into v_receivables
 from public.textile_receivables where organization_id=p_organization_id and status in('open','part_paid');

 select jsonb_build_object(
  'receivables_due_7d',coalesce((select sum(outstanding_amount) from public.textile_receivables where organization_id=p_organization_id and status in('open','part_paid') and due_date between current_date and current_date+7),0),
  'receivables_due_30d',coalesce((select sum(outstanding_amount) from public.textile_receivables where organization_id=p_organization_id and status in('open','part_paid') and due_date between current_date and current_date+30),0),
  'cheques_due_7d',coalesce((select sum(amount) from public.cheques where organization_id=p_organization_id and direction='received' and status in('pending','deposited') and cheque_date between current_date and current_date+7),0),
  'cheques_due_30d',coalesce((select sum(amount) from public.cheques where organization_id=p_organization_id and direction='received' and status in('pending','deposited') and cheque_date between current_date and current_date+30),0)) into v_forecast;

 select jsonb_build_object(
  'measurement_adjustments',count(*) filter(where movement_type='measurement_adjustment'),
  'measurement_variance',coalesce(sum(abs(quantity_delta)) filter(where movement_type='measurement_adjustment'),0),
  'damage_movements',count(*) filter(where movement_type='damage'),
  'return_movements',count(*) filter(where movement_type='return'),
  'transfer_movements',count(*) filter(where movement_type='transfer')) into v_quality
 from public.textile_roll_movements where organization_id=p_organization_id and created_at::date between p_from and p_to;

 return jsonb_build_object('generated_at',now(),'period_from',p_from,'period_to',p_to,'stock_by_unit',v_stock,'channel_performance',v_channels,'roll_ageing',v_ageing,'slow_moving',v_slow,'locations',v_locations,'cutting_waste',v_waste,'receivables',v_receivables,'scheduled_inflows',v_forecast,'quality_events',v_quality);
end$$;
revoke all on function public.get_textile_owner_intelligence(uuid,date,date) from public,anon;grant execute on function public.get_textile_owner_intelligence(uuid,date,date) to authenticated;

create or replace function public.capture_textile_audit_snapshot(p_organization_id uuid,p_from date,p_to date)
returns uuid language plpgsql security definer set search_path=public as $$declare v_id uuid;v_payload jsonb;begin
 if not public.org_member_role_in(p_organization_id,array['owner']) then raise exception 'Owner access required' using errcode='42501';end if;
 v_payload:=public.get_textile_owner_intelligence(p_organization_id,p_from,p_to);
 insert into public.textile_audit_snapshots(organization_id,period_from,period_to,payload)values(p_organization_id,p_from,p_to,v_payload)returning id into v_id;return v_id;end$$;
revoke all on function public.capture_textile_audit_snapshot(uuid,date,date) from public,anon;grant execute on function public.capture_textile_audit_snapshot(uuid,date,date) to authenticated;
