-- Optional grocery catalogue. This migration creates no shop products.
-- Owners invoke the RPC for their own grocery shop after an explicit UI choice.
create table if not exists public.grocery_mill_templates (
  sku text primary key,
  name text not null,
  category text not null,
  pack text not null,
  image_url text not null
);
alter table public.grocery_mill_templates enable row level security;
revoke all on public.grocery_mill_templates from public, anon, authenticated;

insert into public.grocery_mill_templates (sku, name, category, pack, image_url)
values
  ('GRC-MILL-CHP-001','Chilli Powder','Spices & Seasoning','100 g','/images/grocery/grinding-mill/chp.svg'),
  ('GRC-MILL-CHL-001','Chilli Pieces','Spices & Seasoning','100 g','/images/grocery/grinding-mill/chl.svg'),
  ('GRC-MILL-RCH-001','Roasted Chilli Powder','Spices & Seasoning','100 g','/images/grocery/grinding-mill/rch.svg'),
  ('GRC-MILL-TUR-001','Turmeric Powder','Spices & Seasoning','100 g','/images/grocery/grinding-mill/tur.svg'),
  ('GRC-MILL-COR-001','Coriander Powder','Spices & Seasoning','100 g','/images/grocery/grinding-mill/cor.svg'),
  ('GRC-MILL-CUM-001','Cumin Powder','Spices & Seasoning','100 g','/images/grocery/grinding-mill/cum.svg'),
  ('GRC-MILL-RCU-001','Roasted Cumin Powder','Spices & Seasoning','100 g','/images/grocery/grinding-mill/rcu.svg'),
  ('GRC-MILL-FEN-001','Fennel Powder','Spices & Seasoning','100 g','/images/grocery/grinding-mill/fen.svg'),
  ('GRC-MILL-FGK-001','Fenugreek Powder','Spices & Seasoning','100 g','/images/grocery/grinding-mill/fgk.svg'),
  ('GRC-MILL-PEP-001','Black Pepper Powder','Spices & Seasoning','50 g','/images/grocery/grinding-mill/pep.svg'),
  ('GRC-MILL-CIN-001','Cinnamon Powder','Spices & Seasoning','50 g','/images/grocery/grinding-mill/cin.svg'),
  ('GRC-MILL-MUS-001','Mustard Powder','Spices & Seasoning','100 g','/images/grocery/grinding-mill/mus.svg'),
  ('GRC-MILL-GIN-001','Ginger Powder','Spices & Seasoning','100 g','/images/grocery/grinding-mill/gin.svg'),
  ('GRC-MILL-CLO-001','Clove Powder','Spices & Seasoning','50 g','/images/grocery/grinding-mill/clo.svg'),
  ('GRC-MILL-CAR-001','Cardamom Powder','Spices & Seasoning','50 g','/images/grocery/grinding-mill/car.svg'),
  ('GRC-MILL-NUT-001','Nutmeg Powder','Spices & Seasoning','50 g','/images/grocery/grinding-mill/nut.svg'),
  ('GRC-MILL-GOR-001','Goraka Powder','Spices & Seasoning','100 g','/images/grocery/grinding-mill/gor.svg'),
  ('GRC-MILL-CLF-001','Curry Leaf Powder','Spices & Seasoning','50 g','/images/grocery/grinding-mill/clf.svg'),
  ('GRC-MILL-RAW-001','Raw Curry Powder','Spices & Seasoning','100 g','/images/grocery/grinding-mill/raw.svg'),
  ('GRC-MILL-RST-001','Roasted Curry Powder','Spices & Seasoning','100 g','/images/grocery/grinding-mill/rst.svg'),
  ('GRC-MILL-JAF-001','Jaffna Curry Powder','Spices & Seasoning','100 g','/images/grocery/grinding-mill/jaf.svg'),
  ('GRC-MILL-MEA-001','Meat Curry Powder','Spices & Seasoning','100 g','/images/grocery/grinding-mill/mea.svg'),
  ('GRC-MILL-FIS-001','Fish Curry Powder','Spices & Seasoning','100 g','/images/grocery/grinding-mill/fis.svg'),
  ('GRC-MILL-CKM-001','Chicken Masala','Spices & Seasoning','100 g','/images/grocery/grinding-mill/ckm.svg'),
  ('GRC-MILL-FSM-001','Fish Masala','Spices & Seasoning','100 g','/images/grocery/grinding-mill/fsm.svg'),
  ('GRC-MILL-BIR-001','Biryani Masala','Spices & Seasoning','100 g','/images/grocery/grinding-mill/bir.svg'),
  ('GRC-MILL-GAR-001','Garam Masala','Spices & Seasoning','100 g','/images/grocery/grinding-mill/gar.svg'),
  ('GRC-MILL-SAM-001','Sambar Powder','Spices & Seasoning','100 g','/images/grocery/grinding-mill/sam.svg'),
  ('GRC-MILL-RRF-001','Red Rice Flour','Rice, Flour & Grains','1 kg','/images/grocery/grinding-mill/rrf.svg'),
  ('GRC-MILL-WRF-001','White Rice Flour','Rice, Flour & Grains','1 kg','/images/grocery/grinding-mill/wrf.svg'),
  ('GRC-MILL-KUR-001','Kurakkan Flour','Rice, Flour & Grains','400 g','/images/grocery/grinding-mill/kur.svg'),
  ('GRC-MILL-GRF-001','Gram Flour','Rice, Flour & Grains','500 g','/images/grocery/grinding-mill/grf.svg'),
  ('GRC-MILL-UND-001','Undu Flour','Rice, Flour & Grains','200 g','/images/grocery/grinding-mill/und.svg'),
  ('GRC-MILL-ATT-001','Atta Flour','Rice, Flour & Grains','1 kg','/images/grocery/grinding-mill/att.svg'),
  ('GRC-MILL-THO-001','Thosai Mix','Rice, Flour & Grains','400 g','/images/grocery/grinding-mill/tho.svg'),
  ('GRC-MILL-HOP-001','Hopper Mix','Rice, Flour & Grains','400 g','/images/grocery/grinding-mill/hop.svg')
on conflict (sku) do update set
  name = excluded.name,
  category = excluded.category,
  pack = excluded.pack,
  image_url = excluded.image_url;

-- Stop on pre-existing duplicate template identities; never delete or merge
-- shop records as part of a release migration.
do $$
begin
  if exists (
    select 1 from public.products_base p
    where upper(btrim(coalesce(p.sku, ''))) like 'GRC-MILL-%'
       or upper(btrim(coalesce(p.custom_fields->>'templateSku', ''))) like 'GRC-MILL-%'
    group by p.organization_id,
      coalesce(nullif(upper(btrim(p.custom_fields->>'templateSku')), ''),
               upper(btrim(p.sku)))
    having count(*) > 1
  ) then
    raise exception 'duplicate grinding-mill SKU already exists; review shop data before applying this migration';
  end if;
end;
$$;

create unique index if not exists products_base_grocery_mill_org_sku_uq
on public.products_base (
  organization_id,
  (coalesce(nullif(upper(btrim(custom_fields->>'templateSku')), ''),
            upper(btrim(sku))))
)
where upper(btrim(coalesce(sku, ''))) like 'GRC-MILL-%'
   or upper(btrim(coalesce(custom_fields->>'templateSku', ''))) like 'GRC-MILL-%';

create or replace function public.import_grocery_mill_catalogue(
  p_organization_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sector text;
  v_limit integer;
  v_current integer;
  v_missing integer;
  v_added integer := 0;
  v_rows integer;
  v_template record;
begin
  if p_organization_id is null
     or (select auth.uid()) is null
     or not public.org_member_role_in(p_organization_id, array['owner'])
     or not public.org_member_can_write_module(p_organization_id, 'stock') then
    raise exception 'owner access to this shop is required' using errcode = '42501';
  end if;

  -- Serializes two owners importing for the same shop, without locking others.
  select o.sector into v_sector
  from public.organizations o
  where o.id = p_organization_id
  for update;
  if not found or v_sector is distinct from 'grocery' then
    raise exception 'this catalogue is only available to grocery shops' using errcode = '42501';
  end if;

  select p.max_products into v_limit
  from public.subscriptions s
  join public.plans p on p.id = s.plan_id
  where s.organization_id = p_organization_id;
  select count(*) into v_current
  from public.products_base p
  where p.organization_id = p_organization_id;
  select count(*) into v_missing
  from public.grocery_mill_templates t
  where not exists (
    select 1 from public.products_base p
    where p.organization_id = p_organization_id
      and (upper(btrim(coalesce(p.sku, ''))) = t.sku
        or upper(btrim(coalesce(p.custom_fields->>'templateSku', ''))) = t.sku)
  );
  if v_limit is not null and v_current + v_missing > v_limit then
    raise exception 'product limit reached: % slots required, % available',
      v_missing, greatest(v_limit - v_current, 0) using errcode = '23514';
  end if;

  for v_template in select * from public.grocery_mill_templates order by sku loop
    if exists (
      select 1 from public.products_base p
      where p.organization_id = p_organization_id
        and (upper(btrim(coalesce(p.sku, ''))) = v_template.sku
          or upper(btrim(coalesce(p.custom_fields->>'templateSku', ''))) = v_template.sku)
    ) then
      continue;
    end if;
    insert into public.products_base (
      id, organization_id, name, sku, category, sector_id, condition,
      buy_price, sell_price, stock_qty, reorder_level, unit,
      custom_fields, active, notes, created_at, updated_at
    ) values (
      'mill-' || gen_random_uuid()::text, p_organization_id,
      v_template.name, v_template.sku, v_template.category, 'grocery', 'new',
      0, 0, 0, 0, 'pack',
      jsonb_build_object(
        'unitVariant', v_template.pack,
        'imageUrl', v_template.image_url,
        'templateSku', v_template.sku
      ),
      false,
      'Grinding-mill catalogue template. Confirm ingredients, pack, price and stock before activation.',
      now(), now()
    ) on conflict do nothing;
    get diagnostics v_rows = row_count;
    v_added := v_added + v_rows;
  end loop;

  select count(*) into v_missing
  from public.grocery_mill_templates t
  where not exists (
    select 1 from public.products_base p
    where p.organization_id = p_organization_id
      and (upper(btrim(coalesce(p.sku, ''))) = t.sku
        or upper(btrim(coalesce(p.custom_fields->>'templateSku', ''))) = t.sku)
  );
  if v_missing <> 0 then
    raise exception 'catalogue import conflicted; retry after checking shop sync' using errcode = '40001';
  end if;
  return jsonb_build_object('added', v_added, 'existing',
    (select count(*) from public.grocery_mill_templates) - v_added,
    'total', (select count(*) from public.grocery_mill_templates));
end;
$$;
revoke all on function public.import_grocery_mill_catalogue(uuid) from public, anon;
grant execute on function public.import_grocery_mill_catalogue(uuid) to authenticated;

-- This guard runs inside the existing atomic checkout transaction. It covers
-- every entrypoint that inserts a grocery sale line, including direct view
-- writes; it leaves other sectors' historical workflows untouched.
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
  if not found or coalesce(v_product.active, false) = false
     or v_product.sell_price <= 0 or new.unit_price <= 0
     or new.qty <= 0 or v_product.stock_qty < new.qty then
    raise exception 'grocery item is inactive, unpriced or unavailable' using errcode = '23514';
  end if;

  select m.role::text into v_role
  from public.org_members m
  where m.organization_id = new.organization_id and m.user_id = (select auth.uid());
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
