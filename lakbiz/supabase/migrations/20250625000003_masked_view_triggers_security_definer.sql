-- Masked view writes: run as definer so authenticated users need not hold *_base table grants.
-- RLS is enforced via org_member_can_write_module inside each trigger.

create or replace function public.products_view_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.org_member_can_write_module(new.organization_id, 'stock') then
    raise exception 'permission denied for table products_base' using errcode = '42501';
  end if;
  insert into public.products_base (
    id, organization_id, name, sku, category, sector_id, condition,
    buy_price, sell_price, stock_qty, reorder_level, unit, custom_fields,
    created_at, updated_at
  ) values (
    new.id, new.organization_id, new.name, new.sku, new.category, new.sector_id, new.condition,
    new.buy_price, new.sell_price, new.stock_qty, new.reorder_level, new.unit, new.custom_fields,
    coalesce(new.created_at, now()), coalesce(new.updated_at, now())
  );
  return new;
end;
$$;

create or replace function public.products_view_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.org_member_can_write_module(new.organization_id, 'stock') then
    raise exception 'permission denied for table products_base' using errcode = '42501';
  end if;
  update public.products_base set
    name = new.name,
    sku = new.sku,
    category = new.category,
    sector_id = new.sector_id,
    condition = new.condition,
    buy_price = new.buy_price,
    sell_price = new.sell_price,
    stock_qty = new.stock_qty,
    reorder_level = new.reorder_level,
    unit = new.unit,
    custom_fields = new.custom_fields,
    updated_at = coalesce(new.updated_at, now())
  where id = old.id and organization_id = old.organization_id;
  return new;
end;
$$;

create or replace function public.products_view_delete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.org_member_can_write_module(old.organization_id, 'stock') then
    raise exception 'permission denied for table products_base' using errcode = '42501';
  end if;
  delete from public.products_base
  where id = old.id and organization_id = old.organization_id;
  return old;
end;
$$;

create or replace function public.sales_view_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.org_member_can_write_module(new.organization_id, 'sales') then
    raise exception 'permission denied for table sales_base' using errcode = '42501';
  end if;
  insert into public.sales_base (
    id, organization_id, bill_no, sale_date, subtotal, output_vat, discount, total, profit,
    payment_method, customer_id, customer_name, credit_amount, cheque_id, created_at
  ) values (
    new.id, new.organization_id, new.bill_no, new.sale_date, new.subtotal, new.output_vat,
    new.discount, new.total, new.profit, new.payment_method, new.customer_id, new.customer_name,
    new.credit_amount, new.cheque_id, coalesce(new.created_at, now())
  );
  return new;
end;
$$;

create or replace function public.sales_view_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.org_member_can_write_module(new.organization_id, 'sales') then
    raise exception 'permission denied for table sales_base' using errcode = '42501';
  end if;
  update public.sales_base set
    bill_no = new.bill_no,
    sale_date = new.sale_date,
    subtotal = new.subtotal,
    output_vat = new.output_vat,
    discount = new.discount,
    total = new.total,
    profit = new.profit,
    payment_method = new.payment_method,
    customer_id = new.customer_id,
    customer_name = new.customer_name,
    credit_amount = new.credit_amount,
    cheque_id = new.cheque_id
  where id = old.id and organization_id = old.organization_id;
  return new;
end;
$$;

create or replace function public.sales_view_delete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.org_member_can_write_module(old.organization_id, 'sales') then
    raise exception 'permission denied for table sales_base' using errcode = '42501';
  end if;
  delete from public.sales_base
  where id = old.id and organization_id = old.organization_id;
  return old;
end;
$$;

create or replace function public.sale_lines_view_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.org_member_can_write_module(new.organization_id, 'sales') then
    raise exception 'permission denied for table sale_lines_base' using errcode = '42501';
  end if;
  insert into public.sale_lines_base (
    id, sale_id, organization_id, product_id, product_name, qty, unit_price, buy_price, line_order
  ) values (
    coalesce(new.id, gen_random_uuid()), new.sale_id, new.organization_id, new.product_id,
    new.product_name, new.qty, new.unit_price, new.buy_price, new.line_order
  );
  return new;
end;
$$;

create or replace function public.sale_lines_view_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.org_member_can_write_module(new.organization_id, 'sales') then
    raise exception 'permission denied for table sale_lines_base' using errcode = '42501';
  end if;
  update public.sale_lines_base set
    sale_id = new.sale_id,
    product_id = new.product_id,
    product_name = new.product_name,
    qty = new.qty,
    unit_price = new.unit_price,
    buy_price = new.buy_price,
    line_order = new.line_order
  where id = old.id and organization_id = old.organization_id;
  return new;
end;
$$;

create or replace function public.sale_lines_view_delete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.org_member_can_write_module(old.organization_id, 'sales') then
    raise exception 'permission denied for table sale_lines_base' using errcode = '42501';
  end if;
  delete from public.sale_lines_base
  where id = old.id and organization_id = old.organization_id;
  return old;
end;
$$;
