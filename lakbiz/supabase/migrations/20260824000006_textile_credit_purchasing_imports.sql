-- LakBiz Textile Phase 6: governed wholesale credit, collection evidence,
-- PDC exceptions, supplier quotes, import landed costs and commissions.

alter table public.cheques drop constraint if exists cheques_status_check;
alter table public.cheques add constraint cheques_status_check check(status in('pending','deposited','cleared','bounced','returned'));

create table if not exists public.textile_customer_terms(
 organization_id uuid not null references public.organizations(id) on delete cascade, customer_id text primary key references public.customers(id) on delete cascade,
 payment_terms_days integer not null default 30 check(payment_terms_days between 0 and 365), credit_hold boolean not null default false,
 hold_reason text, collection_owner uuid, updated_by uuid not null default auth.uid(), updated_at timestamptz not null default now()
);
create table if not exists public.textile_receivables(
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
 sale_id text not null unique references public.sales_base(id) on delete restrict, customer_id text not null references public.customers(id) on delete restrict,
 original_amount numeric(14,2) not null check(original_amount>0), outstanding_amount numeric(14,2) not null check(outstanding_amount>=0),
 invoice_date date not null, due_date date not null, source text not null default 'credit_sale' check(source in('credit_sale','cheque_exception')),
 status text not null default 'open' check(status in('open','part_paid','paid','written_off')), created_at timestamptz not null default now()
);
create table if not exists public.textile_receivable_allocations(
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
 receivable_id uuid not null references public.textile_receivables(id) on delete restrict, customer_payment_id text not null references public.customer_payments(id) on delete restrict,
 amount numeric(14,2) not null check(amount>0), allocated_by uuid not null default auth.uid(), allocated_at timestamptz not null default now(), unique(receivable_id,customer_payment_id)
);
create table if not exists public.textile_collection_actions(
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
 customer_id text not null references public.customers(id) on delete restrict, action_type text not null check(action_type in('call','whatsapp','visit','promise','dispute','hold','release')),
 note text not null, promise_date date, promise_amount numeric(14,2), status text not null default 'open' check(status in('open','kept','broken','closed')),
 created_by uuid not null default auth.uid(), created_at timestamptz not null default now()
);
create table if not exists public.textile_cheque_exceptions(
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
 cheque_id text not null unique references public.cheques(id) on delete restrict, sale_id text not null references public.sales_base(id) on delete restrict,
 customer_id text not null references public.customers(id) on delete restrict, amount numeric(14,2) not null check(amount>0), status text not null default 'open' check(status in('open','recovered','written_off')),
 created_at timestamptz not null default now(), resolved_at timestamptz, resolved_by uuid
);
create table if not exists public.textile_supplier_prices(
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
 supplier_id text not null references public.suppliers(id) on delete cascade, product_id text not null references public.products_base(id) on delete cascade,
 currency text not null default 'LKR', unit_price numeric(14,4) not null check(unit_price>=0), fx_rate_lkr numeric(14,6) not null default 1 check(fx_rate_lkr>0),
 min_quantity numeric(14,3) not null default 0, lead_time_days integer, quoted_at date not null default current_date, valid_until date, reference text,
 created_by uuid not null default auth.uid(), created_at timestamptz not null default now()
);
create table if not exists public.textile_import_shipments(
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
 shipment_no text not null, container_no text, supplier_id text references public.suppliers(id) on delete set null,
 origin_country text, currency text not null default 'USD', fx_rate_lkr numeric(14,6) not null default 1 check(fx_rate_lkr>0),
 freight_lkr numeric(14,2) not null default 0, duty_lkr numeric(14,2) not null default 0, insurance_lkr numeric(14,2) not null default 0,
 port_lkr numeric(14,2) not null default 0, handling_lkr numeric(14,2) not null default 0,
 eta date, status text not null default 'planned' check(status in('planned','in_transit','customs','received','costed','cancelled')),
 created_by uuid not null default auth.uid(), created_at timestamptz not null default now(), costed_at timestamptz, unique(organization_id,shipment_no)
);
create table if not exists public.textile_import_rolls(
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
 shipment_id uuid not null references public.textile_import_shipments(id) on delete restrict, roll_id uuid not null unique references public.textile_rolls(id) on delete restrict,
 supplier_value_lkr numeric(14,2) not null check(supplier_value_lkr>=0), weight_kg numeric(14,3) not null default 0,
 allocated_landed_cost numeric(14,2), created_at timestamptz not null default now()
);
create table if not exists public.textile_commission_policies(
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
 salesperson_user_id uuid not null, basis text not null check(basis in('collected_revenue','approved_margin')), rate_percent numeric(7,4) not null check(rate_percent between 0 and 100),
 effective_from date not null default current_date, active boolean not null default true, created_by uuid not null default auth.uid(), created_at timestamptz not null default now()
);
create table if not exists public.textile_commission_entries(
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
 policy_id uuid not null references public.textile_commission_policies(id) on delete restrict, salesperson_user_id uuid not null,
 sale_id text not null references public.sales_base(id) on delete restrict, evidence_type text not null check(evidence_type in('customer_payment','owner_margin_approval')),
 evidence_id text not null, eligible_base numeric(14,2) not null check(eligible_base>=0), commission_amount numeric(14,2) not null check(commission_amount>=0),
 status text not null default 'pending' check(status in('pending','approved','paid','reversed')), approved_by uuid, paid_at timestamptz, created_at timestamptz not null default now(),
 unique(policy_id,sale_id,evidence_type,evidence_id)
);

create index if not exists textile_receivables_age_idx on public.textile_receivables(organization_id,status,due_date) where status in('open','part_paid');
create index if not exists textile_collection_customer_idx on public.textile_collection_actions(organization_id,customer_id,created_at desc);
create index if not exists textile_supplier_prices_lookup_idx on public.textile_supplier_prices(organization_id,product_id,supplier_id,quoted_at desc);
create index if not exists textile_import_status_idx on public.textile_import_shipments(organization_id,status,eta);
create index if not exists textile_commission_status_idx on public.textile_commission_entries(organization_id,status,created_at);

alter table public.textile_customer_terms enable row level security; alter table public.textile_receivables enable row level security;
alter table public.textile_receivable_allocations enable row level security; alter table public.textile_collection_actions enable row level security;
alter table public.textile_cheque_exceptions enable row level security; alter table public.textile_supplier_prices enable row level security;
alter table public.textile_import_shipments enable row level security; alter table public.textile_import_rolls enable row level security;
alter table public.textile_commission_policies enable row level security; alter table public.textile_commission_entries enable row level security;
create policy textile_customer_terms_finance on public.textile_customer_terms for select to authenticated using(public.can_see_org_financials(organization_id));
create policy textile_receivables_finance on public.textile_receivables for select to authenticated using(public.can_see_org_financials(organization_id));
create policy textile_receivable_allocations_finance on public.textile_receivable_allocations for select to authenticated using(public.can_see_org_financials(organization_id));
create policy textile_collection_actions_finance on public.textile_collection_actions for select to authenticated using(public.can_see_org_financials(organization_id));
create policy textile_cheque_exceptions_finance on public.textile_cheque_exceptions for select to authenticated using(public.can_see_org_financials(organization_id));
create policy textile_supplier_prices_finance on public.textile_supplier_prices for select to authenticated using(public.can_see_org_financials(organization_id));
create policy textile_import_shipments_finance on public.textile_import_shipments for select to authenticated using(public.can_see_org_financials(organization_id));
create policy textile_import_rolls_finance on public.textile_import_rolls for select to authenticated using(public.can_see_org_financials(organization_id));
create policy textile_commission_policies_finance on public.textile_commission_policies for select to authenticated using(public.can_see_org_financials(organization_id));
create policy textile_commission_entries_finance on public.textile_commission_entries for select to authenticated using(public.can_see_org_financials(organization_id));
revoke insert,update,delete on public.textile_customer_terms,public.textile_receivables,public.textile_receivable_allocations,public.textile_collection_actions,public.textile_cheque_exceptions,public.textile_supplier_prices,public.textile_import_shipments,public.textile_import_rolls,public.textile_commission_policies,public.textile_commission_entries from authenticated;
grant select on public.textile_customer_terms,public.textile_receivables,public.textile_receivable_allocations,public.textile_collection_actions,public.textile_cheque_exceptions,public.textile_supplier_prices,public.textile_import_shipments,public.textile_import_rolls,public.textile_commission_policies,public.textile_commission_entries to authenticated;

create or replace function public.create_textile_receivable() returns trigger language plpgsql security definer set search_path=public as $$
declare v_terms integer:=30;
begin
 if new.customer_id is not null and new.credit_amount>0 and exists(select 1 from public.organizations where id=new.organization_id and sector='textile') then
  select payment_terms_days into v_terms from public.textile_customer_terms where customer_id=new.customer_id and organization_id=new.organization_id;
  insert into public.textile_receivables(organization_id,sale_id,customer_id,original_amount,outstanding_amount,invoice_date,due_date) values(new.organization_id,new.id,new.customer_id,new.credit_amount,new.credit_amount,new.sale_date::date,new.sale_date::date+coalesce(v_terms,30)) on conflict(sale_id) do nothing;
 end if; return new;
end $$;
revoke all on function public.create_textile_receivable() from public;
create trigger create_textile_receivable_after_sale after insert on public.sales_base for each row execute function public.create_textile_receivable();

create or replace function public.finalize_textile_sale_v4(p_organization_id uuid,p_sale_id text,p_customer_id text default null,p_customer_name text default null,p_discount numeric default 0,p_allocations jsonb default '[]'::jsonb,p_tenders jsonb default '[]'::jsonb)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_credit numeric:=0;v_cheque numeric:=0;v_pending numeric:=0;v_customer public.customers%rowtype;v_hold boolean:=false;v_overdue boolean:=false;
begin
 select coalesce(sum(case when value->>'kind'='credit' then (value->>'amount')::numeric else 0 end),0),coalesce(sum(case when value->>'kind'='cheque' then (value->>'amount')::numeric else 0 end),0) into v_credit,v_cheque from jsonb_array_elements(coalesce(p_tenders,'[]'::jsonb));
 if v_credit+v_cheque>0 then
  if p_customer_id is null then raise exception 'Wholesale credit or cheque requires a customer account'; end if;
  select * into v_customer from public.customers where id=p_customer_id and organization_id=p_organization_id for update; if not found then raise exception 'Customer not found'; end if;
  select coalesce(credit_hold,false) into v_hold from public.textile_customer_terms where customer_id=p_customer_id and organization_id=p_organization_id;
  select exists(select 1 from public.textile_receivables where customer_id=p_customer_id and organization_id=p_organization_id and outstanding_amount>0.005 and due_date<current_date) into v_overdue;
  if v_hold then raise exception 'Customer account is on credit hold'; end if;
  if v_overdue and not public.org_member_role_in(p_organization_id,array['owner','manager']) then raise exception 'Customer has overdue Textile invoices; manager approval is required'; end if;
  select coalesce(sum(amount),0) into v_pending from public.cheques where organization_id=p_organization_id and customer_id=p_customer_id and direction='received' and status in('pending','deposited');
  if v_customer.credit_limit is not null and v_customer.credit_balance+v_pending+v_credit+v_cheque>v_customer.credit_limit+0.005 then raise exception 'Customer total credit and cheque exposure exceeds the approved limit'; end if;
 end if;
 return public.finalize_textile_sale_v3(p_organization_id,p_sale_id,p_customer_id,p_customer_name,p_discount,p_allocations,p_tenders);
end $$;
revoke all on function public.finalize_textile_sale_v4(uuid,text,text,text,numeric,jsonb,jsonb) from public,anon;grant execute on function public.finalize_textile_sale_v4(uuid,text,text,text,numeric,jsonb,jsonb) to authenticated;

create or replace function public.set_textile_customer_terms(p_organization_id uuid,p_customer_id text,p_payment_terms_days integer,p_credit_limit numeric,p_credit_hold boolean,p_hold_reason text default null)
returns void language plpgsql security definer set search_path=public as $$ begin
 if not public.org_member_role_in(p_organization_id,array['owner','manager']) or not public.org_member_can_write_module(p_organization_id,'customers') then raise exception 'Permission denied for credit policy' using errcode='42501'; end if;
 if p_payment_terms_days<0 or p_payment_terms_days>365 or p_credit_limit<0 then raise exception 'Invalid payment terms or credit limit'; end if;
 update public.customers set credit_limit=p_credit_limit where id=p_customer_id and organization_id=p_organization_id; if not found then raise exception 'Customer not found'; end if;
 insert into public.textile_customer_terms(organization_id,customer_id,payment_terms_days,credit_hold,hold_reason,updated_by,updated_at) values(p_organization_id,p_customer_id,p_payment_terms_days,p_credit_hold,nullif(btrim(p_hold_reason),''),auth.uid(),now()) on conflict(customer_id) do update set payment_terms_days=excluded.payment_terms_days,credit_hold=excluded.credit_hold,hold_reason=excluded.hold_reason,updated_by=auth.uid(),updated_at=now();
end $$;
revoke all on function public.set_textile_customer_terms(uuid,text,integer,numeric,boolean,text) from public,anon; grant execute on function public.set_textile_customer_terms(uuid,text,integer,numeric,boolean,text) to authenticated;

create or replace function public.record_textile_collection_action(p_organization_id uuid,p_customer_id text,p_action_type text,p_note text,p_promise_date date default null,p_promise_amount numeric default null)
returns uuid language plpgsql security definer set search_path=public as $$ declare v_id uuid;
begin if not public.org_member_role_in(p_organization_id,array['owner','manager']) or nullif(btrim(p_note),'') is null then raise exception 'Permission and note are required' using errcode='42501'; end if;
 insert into public.textile_collection_actions(organization_id,customer_id,action_type,note,promise_date,promise_amount) values(p_organization_id,p_customer_id,p_action_type,btrim(p_note),p_promise_date,p_promise_amount) returning id into v_id; return v_id; end $$;
revoke all on function public.record_textile_collection_action(uuid,text,text,text,date,numeric) from public,anon; grant execute on function public.record_textile_collection_action(uuid,text,text,text,date,numeric) to authenticated;

create or replace function public.allocate_textile_customer_payment(p_organization_id uuid,p_customer_payment_id text)
returns numeric language plpgsql security definer set search_path=public as $$
declare v_payment public.customer_payments%rowtype; v_rec public.textile_receivables%rowtype; v_remaining numeric; v_apply numeric; v_total numeric:=0; v_policy public.textile_commission_policies%rowtype; v_salesperson uuid;
begin
 if not public.org_member_role_in(p_organization_id,array['owner','manager']) then raise exception 'Permission denied for payment allocation' using errcode='42501'; end if;
 select * into v_payment from public.customer_payments where id=p_customer_payment_id and organization_id=p_organization_id for update;
 if not found then raise exception 'Customer payment not found'; end if;
 select v_payment.amount-coalesce(sum(amount),0) into v_remaining from public.textile_receivable_allocations where customer_payment_id=v_payment.id;
 for v_rec in select * from public.textile_receivables where organization_id=p_organization_id and customer_id=v_payment.customer_id and status in('open','part_paid') order by due_date,invoice_date for update loop
  exit when v_remaining<=0.005; v_apply:=least(v_remaining,v_rec.outstanding_amount);
  insert into public.textile_receivable_allocations(organization_id,receivable_id,customer_payment_id,amount) values(p_organization_id,v_rec.id,v_payment.id,v_apply) on conflict do nothing;
  if found then update public.textile_receivables set outstanding_amount=outstanding_amount-v_apply,status=case when outstanding_amount-v_apply<=0.005 then 'paid' else 'part_paid' end where id=v_rec.id; v_remaining:=v_remaining-v_apply;v_total:=v_total+v_apply;
   select created_by into v_salesperson from public.textile_sale_allocations where sale_id=v_rec.sale_id limit 1;
   select * into v_policy from public.textile_commission_policies where organization_id=p_organization_id and salesperson_user_id=v_salesperson and basis='collected_revenue' and active and effective_from<=v_payment.payment_date::date order by effective_from desc limit 1;
   if found then insert into public.textile_commission_entries(organization_id,policy_id,salesperson_user_id,sale_id,evidence_type,evidence_id,eligible_base,commission_amount) values(p_organization_id,v_policy.id,v_salesperson,v_rec.sale_id,'customer_payment',v_payment.id,v_apply,round(v_apply*v_policy.rate_percent/100,2)) on conflict do nothing; end if;
  end if;
 end loop; return v_total;
end $$;
revoke all on function public.allocate_textile_customer_payment(uuid,text) from public,anon; grant execute on function public.allocate_textile_customer_payment(uuid,text) to authenticated;

create or replace function public.transition_textile_cheque(p_organization_id uuid,p_cheque_id text,p_next_status text)
returns void language plpgsql security definer set search_path=public as $$
declare v_cheque public.cheques%rowtype; v_sale public.sales_base%rowtype;
begin
 if not public.org_member_role_in(p_organization_id,array['owner','manager']) then raise exception 'Permission denied for cheque control' using errcode='42501'; end if;
 select * into v_cheque from public.cheques where id=p_cheque_id and organization_id=p_organization_id for update; if not found then raise exception 'Cheque not found'; end if;
 if not ((v_cheque.status='pending' and p_next_status in('deposited','bounced','returned')) or (v_cheque.status='deposited' and p_next_status in('cleared','bounced','returned'))) then raise exception 'Invalid cheque transition'; end if;
 update public.cheques set status=p_next_status,updated_at=now() where id=v_cheque.id;
 if p_next_status in('bounced','returned') and v_cheque.direction='received' and v_cheque.linked_sale_id is not null then
  select * into v_sale from public.sales_base where id=v_cheque.linked_sale_id and organization_id=p_organization_id;
  if v_sale.customer_id is null then raise exception 'Cannot create cheque recovery without a customer account'; end if;
  insert into public.textile_cheque_exceptions(organization_id,cheque_id,sale_id,customer_id,amount) values(p_organization_id,v_cheque.id,v_sale.id,v_sale.customer_id,v_cheque.amount) on conflict(cheque_id) do nothing;
  if found then update public.customers set credit_balance=credit_balance+v_cheque.amount where id=v_sale.customer_id and organization_id=p_organization_id;
   insert into public.textile_receivables(organization_id,sale_id,customer_id,original_amount,outstanding_amount,invoice_date,due_date,source) values(p_organization_id,v_sale.id,v_sale.customer_id,v_cheque.amount,v_cheque.amount,current_date,current_date,'cheque_exception') on conflict(sale_id) do update set original_amount=textile_receivables.original_amount+excluded.original_amount,outstanding_amount=textile_receivables.outstanding_amount+excluded.outstanding_amount,status='open';
  end if;
 end if;
end $$;
revoke all on function public.transition_textile_cheque(uuid,text,text) from public,anon; grant execute on function public.transition_textile_cheque(uuid,text,text) to authenticated;

create or replace function public.add_textile_supplier_price(p_organization_id uuid,p_supplier_id text,p_product_id text,p_currency text,p_unit_price numeric,p_fx_rate_lkr numeric,p_min_quantity numeric,p_lead_time_days integer,p_valid_until date,p_reference text)
returns uuid language plpgsql security definer set search_path=public as $$ declare v_id uuid; begin
 if not public.org_member_role_in(p_organization_id,array['owner','manager']) then raise exception 'Permission denied for supplier pricing' using errcode='42501'; end if;
 insert into public.textile_supplier_prices(organization_id,supplier_id,product_id,currency,unit_price,fx_rate_lkr,min_quantity,lead_time_days,valid_until,reference) values(p_organization_id,p_supplier_id,p_product_id,upper(btrim(p_currency)),p_unit_price,p_fx_rate_lkr,p_min_quantity,p_lead_time_days,p_valid_until,nullif(btrim(p_reference),'')) returning id into v_id; return v_id; end $$;
revoke all on function public.add_textile_supplier_price(uuid,text,text,text,numeric,numeric,numeric,integer,date,text) from public,anon; grant execute on function public.add_textile_supplier_price(uuid,text,text,text,numeric,numeric,numeric,integer,date,text) to authenticated;

create or replace function public.create_textile_import_shipment(p_organization_id uuid,p_shipment_id uuid,p_shipment_no text,p_container_no text,p_supplier_id text,p_origin_country text,p_currency text,p_fx_rate numeric,p_freight numeric,p_duty numeric,p_insurance numeric,p_port numeric,p_handling numeric,p_eta date)
returns void language plpgsql security definer set search_path=public as $$ begin
 if not public.org_member_role_in(p_organization_id,array['owner','manager']) then raise exception 'Permission denied for imports' using errcode='42501'; end if;
 insert into public.textile_import_shipments(id,organization_id,shipment_no,container_no,supplier_id,origin_country,currency,fx_rate_lkr,freight_lkr,duty_lkr,insurance_lkr,port_lkr,handling_lkr,eta) values(p_shipment_id,p_organization_id,btrim(p_shipment_no),nullif(btrim(p_container_no),''),p_supplier_id,nullif(btrim(p_origin_country),''),upper(btrim(p_currency)),p_fx_rate,p_freight,p_duty,p_insurance,p_port,p_handling,p_eta); end $$;
revoke all on function public.create_textile_import_shipment(uuid,uuid,text,text,text,text,text,numeric,numeric,numeric,numeric,numeric,numeric,date) from public,anon; grant execute on function public.create_textile_import_shipment(uuid,uuid,text,text,text,text,text,numeric,numeric,numeric,numeric,numeric,numeric,date) to authenticated;

create or replace function public.add_textile_import_roll(p_organization_id uuid,p_shipment_id uuid,p_roll_id uuid,p_supplier_value_lkr numeric)
returns void language plpgsql security definer set search_path=public as $$ declare v_roll public.textile_rolls%rowtype; begin
 if not public.org_member_role_in(p_organization_id,array['owner','manager']) then raise exception 'Permission denied for import allocation' using errcode='42501'; end if;
 select * into v_roll from public.textile_rolls where id=p_roll_id and organization_id=p_organization_id; if not found then raise exception 'Roll not found'; end if;
 insert into public.textile_import_rolls(organization_id,shipment_id,roll_id,supplier_value_lkr,weight_kg) values(p_organization_id,p_shipment_id,p_roll_id,p_supplier_value_lkr,coalesce(v_roll.weight_kg,0)); end $$;
revoke all on function public.add_textile_import_roll(uuid,uuid,uuid,numeric) from public,anon; grant execute on function public.add_textile_import_roll(uuid,uuid,uuid,numeric) to authenticated;

create or replace function public.finalize_textile_import_cost(p_organization_id uuid,p_shipment_id uuid)
returns numeric language plpgsql security definer set search_path=public as $$
declare v_ship public.textile_import_shipments%rowtype; v_line public.textile_import_rolls%rowtype; v_value_total numeric;v_weight_total numeric;v_qty_total numeric;v_qty numeric;v_extra numeric;v_total numeric:=0;
begin
 if not public.org_member_role_in(p_organization_id,array['owner']) then raise exception 'Owner approval required for landed cost' using errcode='42501'; end if;
 select * into v_ship from public.textile_import_shipments where id=p_shipment_id and organization_id=p_organization_id for update; if not found or v_ship.status in('costed','cancelled') then raise exception 'Shipment unavailable for costing'; end if;
 select coalesce(sum(i.supplier_value_lkr),0),coalesce(sum(i.weight_kg),0),coalesce(sum(r.received_length),0) into v_value_total,v_weight_total,v_qty_total from public.textile_import_rolls i join public.textile_rolls r on r.id=i.roll_id where i.shipment_id=p_shipment_id;
 if v_value_total<=0 or v_qty_total<=0 then raise exception 'Import rolls and supplier values are required'; end if;
 for v_line in select * from public.textile_import_rolls where shipment_id=p_shipment_id for update loop
  select received_length into v_qty from public.textile_rolls where id=v_line.roll_id;
  v_extra:=round((v_ship.duty_lkr+v_ship.insurance_lkr)*(v_line.supplier_value_lkr/v_value_total)+v_ship.freight_lkr*(case when v_weight_total>0 then v_line.weight_kg/v_weight_total else v_qty/v_qty_total end)+(v_ship.port_lkr+v_ship.handling_lkr)*(v_qty/v_qty_total),2);
  update public.textile_import_rolls set allocated_landed_cost=v_extra where id=v_line.id;
  insert into public.textile_roll_costs(roll_id,organization_id,unit_cost,landed_unit_cost) values(v_line.roll_id,p_organization_id,round(v_line.supplier_value_lkr/v_qty,4),round((v_line.supplier_value_lkr+v_extra)/v_qty,4)) on conflict(roll_id) do update set unit_cost=excluded.unit_cost,landed_unit_cost=excluded.landed_unit_cost,updated_at=now(); v_total:=v_total+v_extra;
 end loop; update public.textile_import_shipments set status='costed',costed_at=now() where id=p_shipment_id; return v_total;
end $$;
revoke all on function public.finalize_textile_import_cost(uuid,uuid) from public,anon; grant execute on function public.finalize_textile_import_cost(uuid,uuid) to authenticated;

create or replace function public.set_textile_commission_policy(p_organization_id uuid,p_salesperson_user_id uuid,p_basis text,p_rate numeric,p_effective_from date)
returns uuid language plpgsql security definer set search_path=public as $$ declare v_id uuid; begin
 if not public.org_member_role_in(p_organization_id,array['owner']) then raise exception 'Owner approval required for commission policy' using errcode='42501'; end if;
 if p_basis not in('collected_revenue','approved_margin') or p_rate<0 or p_rate>100 then raise exception 'Invalid commission policy'; end if;
 update public.textile_commission_policies set active=false where organization_id=p_organization_id and salesperson_user_id=p_salesperson_user_id and basis=p_basis and active;
 insert into public.textile_commission_policies(organization_id,salesperson_user_id,basis,rate_percent,effective_from) values(p_organization_id,p_salesperson_user_id,p_basis,p_rate,p_effective_from) returning id into v_id; return v_id; end $$;
revoke all on function public.set_textile_commission_policy(uuid,uuid,text,numeric,date) from public,anon; grant execute on function public.set_textile_commission_policy(uuid,uuid,text,numeric,date) to authenticated;

create or replace function public.approve_textile_margin_commission(p_organization_id uuid,p_sale_id text,p_approved_margin numeric)
returns void language plpgsql security definer set search_path=public as $$ declare v_user uuid;v_policy public.textile_commission_policies%rowtype; begin
 if not public.org_member_role_in(p_organization_id,array['owner']) then raise exception 'Owner approval required' using errcode='42501'; end if;
 select created_by into v_user from public.textile_sale_allocations where organization_id=p_organization_id and sale_id=p_sale_id limit 1; if v_user is null then raise exception 'Textile sale not found'; end if;
 select * into v_policy from public.textile_commission_policies where organization_id=p_organization_id and salesperson_user_id=v_user and basis='approved_margin' and active order by effective_from desc limit 1; if not found then raise exception 'No active approved-margin policy'; end if;
 insert into public.textile_commission_entries(organization_id,policy_id,salesperson_user_id,sale_id,evidence_type,evidence_id,eligible_base,commission_amount,status,approved_by) values(p_organization_id,v_policy.id,v_user,p_sale_id,'owner_margin_approval',p_sale_id,p_approved_margin,round(p_approved_margin*v_policy.rate_percent/100,2),'approved',auth.uid()) on conflict do nothing; end $$;
revoke all on function public.approve_textile_margin_commission(uuid,text,numeric) from public,anon; grant execute on function public.approve_textile_margin_commission(uuid,text,numeric) to authenticated;
