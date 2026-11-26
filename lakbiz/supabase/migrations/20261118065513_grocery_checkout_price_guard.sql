-- Enforce grocery sellability at the database boundary for every sale-line
-- insert, including callers that do not use the browser checkout component.
-- This is a narrow follow-up to the optional catalogue migrations and does not
-- change existing products, prices, stock, or other business sectors.
create or replace function public.guard_grocery_sale_line()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sector text;
  v_product record;
  v_customer_id text;
  v_customer_price numeric;
  v_role text;
begin
  select o.sector into v_sector
  from public.organizations o
  where o.id = new.organization_id;

  if v_sector is distinct from 'grocery' then
    return new;
  end if;

  select p.id, p.active, p.sell_price, p.stock_qty into v_product
  from public.products_base p
  where p.id = new.product_id and p.organization_id = new.organization_id
  for update;

  if not found
     or not coalesce(v_product.active, false)
     or coalesce(v_product.sell_price, 0) <= 0
     or coalesce(new.unit_price, 0) <= 0
     or coalesce(new.qty, 0) <= 0
     or coalesce(v_product.stock_qty, 0) < coalesce(new.qty, 0) then
    raise exception 'grocery item is inactive, unpriced or unavailable' using errcode = '23514';
  end if;

  select m.role::text into v_role
  from public.org_members m
  where m.organization_id = new.organization_id
    and m.user_id = (select auth.uid());

  if v_role in ('cashier', 'data_entry') then
    select s.customer_id into v_customer_id
    from public.sales_base s
    where s.id = new.sale_id and s.organization_id = new.organization_id;

    select cpp.price into v_customer_price
    from public.customer_product_prices cpp
    where cpp.organization_id = new.organization_id
      and cpp.customer_id = v_customer_id
      and cpp.product_id = new.product_id;

    if new.unit_price is distinct from v_product.sell_price
       and (v_customer_price is null or new.unit_price is distinct from v_customer_price) then
      raise exception 'cashier price override is not permitted' using errcode = '42501';
    end if;
  end if;

  return new;
end;
$$;

revoke all on function public.guard_grocery_sale_line() from public, anon, authenticated;

drop trigger if exists guard_grocery_sale_line_insert on public.sale_lines_base;
create trigger guard_grocery_sale_line_insert
before insert on public.sale_lines_base
for each row execute function public.guard_grocery_sale_line();
