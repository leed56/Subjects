-- Phase F follow-up: hide financial data at the database layer for non-owner/manager roles.
-- - Deny SELECT on purchase/supplier/banking tables for shop staff without financial access.
-- - Mask buy_price / profit on read via security-barrier views.
-- - Preserve server-side buy_price / profit on sync writes from non-financial roles.

create or replace function public.can_see_org_financials(org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.org_members m
    where m.organization_id = org_id
      and m.user_id = auth.uid()
      and m.role in ('owner', 'manager')
  );
$$;

revoke all on function public.can_see_org_financials(uuid) from public;
grant execute on function public.can_see_org_financials(uuid) to authenticated;

-- ─── Financial-only tables: owner/manager SELECT ─────────────────────────────
do $$
declare
  t text;
begin
  foreach t in array array[
    'suppliers',
    'purchases',
    'purchase_lines',
    'supplier_payments',
    'bank_accounts',
    'cheques',
    'bank_transactions',
    'bank_transfers'
  ] loop
    execute format('drop policy if exists %I on public.%I', t || '_select_member', t);
    execute format(
      'create policy %I on public.%I for select to authenticated using (
        organization_id in (select m.organization_id from public.org_members m where m.user_id = auth.uid())
        and public.can_see_org_financials(organization_id)
      )',
      t || '_select_financial', t
    );
  end loop;
end $$;

-- ─── Preserve financial columns when shop staff sync with zeroed values ───────
create or replace function public.preserve_product_buy_price()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if not public.can_see_org_financials(new.organization_id) then
    new.buy_price := old.buy_price;
  end if;
  return new;
end;
$$;

create or replace function public.preserve_sale_profit()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if not public.can_see_org_financials(new.organization_id) then
    new.profit := old.profit;
  end if;
  return new;
end;
$$;

create or replace function public.preserve_sale_line_buy_price()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if not public.can_see_org_financials(new.organization_id) then
    new.buy_price := old.buy_price;
  end if;
  return new;
end;
$$;

-- ─── Masked read views (rename base tables) ───────────────────────────────────
alter table public.products rename to products_base;
alter table public.sales rename to sales_base;
alter table public.sale_lines rename to sale_lines_base;

create view public.products with (security_barrier = true) as
select
  p.id,
  p.organization_id,
  p.name,
  p.sku,
  p.category,
  p.sector_id,
  p.condition,
  case
    when public.can_see_org_financials(p.organization_id) then p.buy_price
    else 0::numeric(14, 2)
  end as buy_price,
  p.sell_price,
  p.stock_qty,
  p.reorder_level,
  p.unit,
  p.custom_fields,
  p.created_at,
  p.updated_at
from public.products_base p;

create view public.sales with (security_barrier = true) as
select
  s.id,
  s.organization_id,
  s.bill_no,
  s.sale_date,
  s.subtotal,
  s.output_vat,
  s.discount,
  s.total,
  case
    when public.can_see_org_financials(s.organization_id) then s.profit
    else 0::numeric(14, 2)
  end as profit,
  s.payment_method,
  s.customer_id,
  s.customer_name,
  s.credit_amount,
  s.cheque_id,
  s.created_at
from public.sales_base s;

create view public.sale_lines with (security_barrier = true) as
select
  l.id,
  l.sale_id,
  l.organization_id,
  l.product_id,
  l.product_name,
  l.qty,
  l.unit_price,
  case
    when public.can_see_org_financials(l.organization_id) then l.buy_price
    else 0::numeric(14, 2)
  end as buy_price,
  l.line_order
from public.sale_lines_base l;

grant select, insert, update, delete on public.products to authenticated;
grant select, insert, update, delete on public.sales to authenticated;
grant select, insert, update, delete on public.sale_lines to authenticated;

create or replace function public.products_view_insert()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
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
security invoker
set search_path = public
as $$
begin
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
security invoker
set search_path = public
as $$
begin
  delete from public.products_base
  where id = old.id and organization_id = old.organization_id;
  return old;
end;
$$;

create or replace function public.sales_view_insert()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
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
security invoker
set search_path = public
as $$
begin
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
security invoker
set search_path = public
as $$
begin
  delete from public.sales_base
  where id = old.id and organization_id = old.organization_id;
  return old;
end;
$$;

create or replace function public.sale_lines_view_insert()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
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
security invoker
set search_path = public
as $$
begin
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
security invoker
set search_path = public
as $$
begin
  delete from public.sale_lines_base
  where id = old.id and organization_id = old.organization_id;
  return old;
end;
$$;

create trigger products_view_insert_trg
  instead of insert on public.products
  for each row execute function public.products_view_insert();

create trigger products_view_update_trg
  instead of update on public.products
  for each row execute function public.products_view_update();

create trigger products_view_delete_trg
  instead of delete on public.products
  for each row execute function public.products_view_delete();

create trigger sales_view_insert_trg
  instead of insert on public.sales
  for each row execute function public.sales_view_insert();

create trigger sales_view_update_trg
  instead of update on public.sales
  for each row execute function public.sales_view_update();

create trigger sales_view_delete_trg
  instead of delete on public.sales
  for each row execute function public.sales_view_delete();

create trigger sale_lines_view_insert_trg
  instead of insert on public.sale_lines
  for each row execute function public.sale_lines_view_insert();

create trigger sale_lines_view_update_trg
  instead of update on public.sale_lines
  for each row execute function public.sale_lines_view_update();

create trigger sale_lines_view_delete_trg
  instead of delete on public.sale_lines
  for each row execute function public.sale_lines_view_delete();

drop trigger if exists products_preserve_buy_price on public.products_base;
create trigger products_preserve_buy_price
  before update on public.products_base
  for each row
  when (not public.can_see_org_financials(new.organization_id))
  execute function public.preserve_product_buy_price();

drop trigger if exists sales_preserve_profit on public.sales_base;
create trigger sales_preserve_profit
  before update on public.sales_base
  for each row
  when (not public.can_see_org_financials(new.organization_id))
  execute function public.preserve_sale_profit();

drop trigger if exists sale_lines_preserve_buy_price on public.sale_lines_base;
create trigger sale_lines_preserve_buy_price
  before update on public.sale_lines_base
  for each row
  when (not public.can_see_org_financials(new.organization_id))
  execute function public.preserve_sale_line_buy_price();

comment on function public.can_see_org_financials(uuid) is
  'True when auth.uid() is owner or manager of the org — used to gate financial SELECT and column masking.';
