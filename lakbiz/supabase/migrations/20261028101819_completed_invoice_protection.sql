-- Existing invoices are sealed. New headers and their lines are assembled in
-- one transaction; private registrations disappear before commit. Do not store
-- an xid on historical rows: logical restores can reuse transaction numbers.
create schema if not exists ledger_internal;
revoke all on schema ledger_internal from public, anon;
grant usage on schema ledger_internal to authenticated;

create table ledger_internal.open_invoice_commits(
  invoice_id text primary key,
  organization_id uuid not null,
  creation_xid xid8 not null
);
alter table ledger_internal.open_invoice_commits enable row level security;
revoke all on ledger_internal.open_invoice_commits from public,anon,authenticated;

create function ledger_internal.guard_invoice_header() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    insert into ledger_internal.open_invoice_commits values(new.id,new.organization_id,pg_catalog.pg_current_xact_id());
    return new;
  end if;
  if tg_op = 'DELETE' or not exists(select 1 from ledger_internal.open_invoice_commits c where c.invoice_id=old.id and c.organization_id=old.organization_id and c.creation_xid=pg_catalog.pg_current_xact_id()) then
    raise exception 'Completed invoices are immutable; record a return or correction document' using errcode='42501';
  end if;
  if new.id is distinct from old.id or new.organization_id is distinct from old.organization_id then
    raise exception 'Invoice identity cannot be changed' using errcode='42501';
  end if;
  return new;
end $$;
revoke all on function ledger_internal.guard_invoice_header() from public, anon, authenticated;
create trigger sales_base_immutable before insert or update or delete on public.sales_base
for each row execute function ledger_internal.guard_invoice_header();

-- Private definer is necessary to inspect the parent behind its masked view.
-- No base-table SELECT privilege or hidden buy cost is given to staff.
create function ledger_internal.guard_invoice_line() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'Invoice lines cannot be deleted; record a return instead' using errcode='42501';
  end if;
  if tg_op = 'UPDATE' and (new.sale_id is distinct from old.sale_id or new.organization_id is distinct from old.organization_id or new.id is distinct from old.id) then
    raise exception 'Invoice line identity cannot be changed' using errcode='42501';
  end if;
  if not exists(select 1 from ledger_internal.open_invoice_commits c join public.sales_base s on s.id=c.invoice_id and s.organization_id=c.organization_id
     where c.invoice_id=new.sale_id and c.organization_id=new.organization_id and c.creation_xid=pg_catalog.pg_current_xact_id()) then
    raise exception 'Completed invoice lines are immutable' using errcode='42501';
  end if;
  return new;
end $$;
revoke all on function ledger_internal.guard_invoice_line() from public, anon, authenticated;
create trigger sale_lines_base_immutable before insert or update or delete on public.sale_lines_base
for each row execute function ledger_internal.guard_invoice_line();

create function ledger_internal.validate_completed_invoice() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_header record; v_count int; v_distinct int; v_gross numeric; v_bad boolean;
begin
  select * into v_header from public.sales_base s where s.id=new.id and s.organization_id=new.organization_id;
  select count(*),count(distinct l.line_order),sum(l.qty*l.unit_price),
    bool_or(l.qty is null or l.qty<=0 or l.unit_price is null or l.unit_price<0)
  into v_count,v_distinct,v_gross,v_bad from public.sale_lines_base l
  where l.sale_id=new.id and l.organization_id=new.organization_id;
  if v_count=0 or v_count<>v_distinct or v_bad or v_header.total<=0
     or coalesce(v_header.discount,0)<0
     or v_header.total is distinct from round(v_gross-coalesce(v_header.discount,0),2)
     or round(coalesce(v_header.subtotal,0)+coalesce(v_header.output_vat,0),2)<>v_header.total then
    raise exception 'Invoice header and complete valid lines must commit together' using errcode='23514';
  end if;
  delete from ledger_internal.open_invoice_commits c where c.invoice_id=new.id and c.organization_id=new.organization_id and c.creation_xid=pg_catalog.pg_current_xact_id();
  return null;
end $$;
revoke all on function ledger_internal.validate_completed_invoice() from public, anon, authenticated;
create constraint trigger sales_base_complete after insert on public.sales_base
deferrable initially deferred for each row execute function ledger_internal.validate_completed_invoice();

create function ledger_internal.keep_invoice_references() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if (tg_table_name='products_base' and exists(select 1 from public.sale_lines_base l where l.organization_id=old.organization_id and l.product_id=old.id))
     or (tg_table_name='customers' and exists(select 1 from public.sales_base s where s.organization_id=old.organization_id and s.customer_id=old.id)) then
    raise exception 'This record is linked to completed invoices; retain it and edit its details instead' using errcode='23503';
  end if;
  return old;
end $$;
revoke all on function ledger_internal.keep_invoice_references() from public,anon,authenticated;
create trigger products_keep_invoice_history before delete on public.products_base
for each row execute function ledger_internal.keep_invoice_references();
create trigger customers_keep_invoice_history before delete on public.customers
for each row execute function ledger_internal.keep_invoice_references();

-- Legacy counter sectors retain their existing customer/payment/job workflow.
-- This bridge replaces separate header/line HTTP writes, never the retail v3
-- finalizer or textile checkout. Financial inputs are derived here, not trusted.
create function ledger_internal.record_completed_invoice(p_organization_id uuid,p_sale jsonb,p_lines jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_org record; v_existing record; v_product record; v_vehicle record; v_line jsonb;
  v_id text; v_product_id text; v_customer_id text; v_customer_name text; v_method text;
  v_price numeric; v_qty numeric; v_cost numeric; v_gross numeric:=0; v_profit numeric:=0;
  v_discount numeric; v_total numeric; v_subtotal numeric; v_vat numeric;
  v_lines jsonb:='[]'; v_order int:=0; v_existing_lines jsonb; v_requested_lines jsonb;
begin
  if auth.uid() is null or not public.org_member_can_write_module(p_organization_id,'sales')
     or not public.org_member_role_in(p_organization_id,array['owner','manager','data_entry','cashier']) then
    raise exception 'Sale permission required' using errcode='42501';
  end if;
  if jsonb_typeof(p_sale) is distinct from 'object' or jsonb_typeof(p_lines) is distinct from 'array'
     or jsonb_array_length(p_lines) not between 1 and 1000 then
    raise exception 'Invoice and between 1 and 1000 lines required' using errcode='22023';
  end if;
  v_id:=nullif(btrim(p_sale->>'id'),'');
  if v_id is null or (p_sale->>'organization_id')::uuid is distinct from p_organization_id
     or exists(select 1 from jsonb_array_elements(p_lines) l where (l->>'organization_id')::uuid is distinct from p_organization_id or l->>'sale_id' is distinct from v_id) then
    raise exception 'Invoice shop and identity must match' using errcode='42501';
  end if;
  -- Same lock order as the retail engine: shop, then product IDs in order.
  select o.sector,o.vat_registered into v_org from public.organizations o where o.id=p_organization_id for update;
  if not found or v_org.sector not in ('ac_hvac','electricals','spare_parts','car_sales') then
    raise exception 'Use the sector checkout transaction for this shop' using errcode='42501';
  end if;
  select * into v_existing from public.sales_base where id=v_id;
  if found then
    if v_existing.organization_id<>p_organization_id then raise exception 'Invoice identity unavailable' using errcode='42501'; end if;
    select jsonb_agg(jsonb_build_array(l.product_id,l.qty,l.unit_price,l.line_order) order by l.line_order)
      into v_existing_lines from public.sale_lines_base l where l.sale_id=v_id and l.organization_id=p_organization_id;
    select jsonb_agg(jsonb_build_array(nullif(l->>'product_id',''),(l->>'qty')::numeric,(l->>'unit_price')::numeric,(l->>'line_order')::int) order by (l->>'line_order')::int)
      into v_requested_lines from jsonb_array_elements(p_lines) l;
    if v_existing_lines is distinct from v_requested_lines or v_existing.total is distinct from (p_sale->>'total')::numeric
       or coalesce(v_existing.discount,0)<>coalesce((p_sale->>'discount')::numeric,0)
       or v_existing.payment_method is distinct from p_sale->>'payment_method'
       or v_existing.customer_id is distinct from nullif(p_sale->>'customer_id','')
       or v_existing.bill_no is distinct from p_sale->>'bill_no' then
      raise exception 'Recorded invoice differs; completed invoices cannot be replaced' using errcode='42501';
    end if;
    return jsonb_build_object('ok',true,'replayed',true,'sale_id',v_id);
  end if;
  v_customer_id:=nullif(p_sale->>'customer_id','');
  v_customer_name:=nullif(btrim(p_sale->>'customer_name'),'');
  if v_customer_id is not null then
    select c.name into v_customer_name from public.customers c where c.id=v_customer_id and c.organization_id=p_organization_id;
    if not found then raise exception 'Customer not found in this shop' using errcode='42501'; end if;
  end if;
  v_method:=p_sale->>'payment_method';
  if v_method not in ('cash','card','bank_transfer','cheque','credit') or v_method is null or (v_method='credit' and v_customer_id is null) then
    raise exception 'Valid payment method and credit customer required' using errcode='22023';
  end if;
  if exists(select 1 from jsonb_array_elements(p_lines) l group by l->>'product_id' having count(*)>1) then
    raise exception 'Duplicate invoice product' using errcode='22023';
  end if;
  perform p.id from public.products_base p where p.organization_id=p_organization_id and p.id in (select l->>'product_id' from jsonb_array_elements(p_lines) l) order by p.id for update;
  for v_line in select value from jsonb_array_elements(p_lines) order by (value->>'line_order')::int loop
    if jsonb_typeof(v_line->'qty') is distinct from 'number' or jsonb_typeof(v_line->'unit_price') is distinct from 'number' then
      raise exception 'Numeric quantity and unit price required' using errcode='22023';
    end if;
    v_qty:=(v_line->>'qty')::numeric; v_price:=(v_line->>'unit_price')::numeric;
    if v_qty<=0 or v_price<0 or (v_line->>'line_order')::int is distinct from v_order then
      raise exception 'Positive quantity and ordered invoice lines required' using errcode='22023';
    end if;
    v_product_id:=nullif(v_line->>'product_id','');
    if v_product_id is not null then
      select p.name,p.buy_price,p.sell_price,p.active into v_product from public.products_base p where p.id=v_product_id and p.organization_id=p_organization_id;
      if not found or not v_product.active then raise exception 'Active product not found in this shop' using errcode='42501'; end if;
      if not public.org_member_role_in(p_organization_id,array['owner','manager']) and v_price is distinct from coalesce((select c.price from public.customer_product_prices c where c.organization_id=p_organization_id and c.customer_id=v_customer_id and c.product_id=v_product_id),v_product.sell_price) then
        raise exception 'Cashier price override is not permitted' using errcode='42501';
      end if;
      v_cost:=v_product.buy_price;
      v_line:=v_line||jsonb_build_object('product_name',v_product.name);
    else
      if v_org.sector<>'car_sales' or v_qty<>1 or not public.org_member_role_in(p_organization_id,array['owner','manager']) then
        raise exception 'A stock product is required' using errcode='42501';
      end if;
      select v.purchase_price,v.recondition_cost into v_vehicle from public.vehicles_base v where v.id=v_id and v.organization_id=p_organization_id for update;
      if not found then raise exception 'Vehicle not found in this shop' using errcode='42501'; end if;
      v_cost:=coalesce(v_vehicle.purchase_price,0)+coalesce(v_vehicle.recondition_cost,0);
    end if;
    v_gross:=v_gross+v_qty*v_price; v_profit:=v_profit+v_qty*(v_price-v_cost);
    v_lines:=v_lines||jsonb_build_array(v_line||jsonb_build_object('buy_price',v_cost));
    v_order:=v_order+1;
  end loop;
  v_discount:=coalesce((p_sale->>'discount')::numeric,0);
  if v_discount<0 or v_discount>v_gross then raise exception 'Invalid invoice discount' using errcode='22023'; end if;
  v_total:=round(v_gross-v_discount,2);
  if v_total<=0 or v_total is distinct from (p_sale->>'total')::numeric then raise exception 'Invoice total does not match its lines' using errcode='23514'; end if;
  v_subtotal:=case when v_org.vat_registered then round(v_total/1.18) else v_total end; v_vat:=v_total-v_subtotal;
  insert into public.sales_base(id,organization_id,bill_no,sale_date,subtotal,output_vat,discount,total,profit,payment_method,customer_id,customer_name,credit_amount,cheque_id)
  values(v_id,p_organization_id,p_sale->>'bill_no',(p_sale->>'sale_date')::timestamptz,v_subtotal,v_vat,v_discount,v_total,round(v_profit-v_discount,2),v_method,v_customer_id,v_customer_name,case when v_method='credit' then v_total else 0 end,nullif(p_sale->>'cheque_id',''));
  insert into public.sale_lines_base(sale_id,organization_id,product_id,product_name,qty,unit_price,buy_price,line_order)
  select v_id,p_organization_id,nullif(l->>'product_id',''),l->>'product_name',(l->>'qty')::numeric,(l->>'unit_price')::numeric,(l->>'buy_price')::numeric,(l->>'line_order')::smallint from jsonb_array_elements(v_lines) l;
  return jsonb_build_object('ok',true,'replayed',false,'sale_id',v_id);
end $$;
revoke all on function ledger_internal.record_completed_invoice(uuid,jsonb,jsonb) from public,anon;
grant execute on function ledger_internal.record_completed_invoice(uuid,jsonb,jsonb) to authenticated;
create function public.record_completed_invoice(p_organization_id uuid,p_sale jsonb,p_lines jsonb)
returns jsonb language sql security invoker set search_path='' as $$
  select ledger_internal.record_completed_invoice(p_organization_id,p_sale,p_lines);
$$;
revoke all on function public.record_completed_invoice(uuid,jsonb,jsonb) from public,anon;
grant execute on function public.record_completed_invoice(uuid,jsonb,jsonb) to authenticated;

create function public.completed_invoice_commit_ready(p_organization_id uuid)
returns boolean language sql stable security invoker set search_path='' as $$
  select auth.uid() is not null
    and public.org_member_can_write_module(p_organization_id,'sales')
    and public.org_member_role_in(p_organization_id,array['owner','manager','data_entry','cashier'])
    and exists(select 1 from public.organizations o where o.id=p_organization_id and o.sector in ('ac_hvac','electricals','spare_parts','car_sales'));
$$;
revoke all on function public.completed_invoice_commit_ready(uuid) from public,anon;
grant execute on function public.completed_invoice_commit_ready(uuid) to authenticated;

-- Views continue masking costs/profit. Do not grant base SELECT to make a
-- security_invoker view work: that would expose staff's hidden financial data.
revoke insert,update,delete,truncate on public.sales_base,public.sale_lines_base from public,anon,authenticated;
revoke insert,update,delete on public.sales,public.sale_lines from public,anon,authenticated;
notify pgrst,'reload schema';
