-- Optional, owner-confirmed grocery meat range. No shop rows are inserted by
-- this migration; all templates remain inactive, unpriced and without stock.
create table if not exists public.grocery_meat_templates (
  sku text primary key,
  name text not null,
  category text not null,
  pack text not null,
  image_url text not null
);
alter table public.grocery_meat_templates enable row level security;
revoke all on public.grocery_meat_templates from public, anon, authenticated;

insert into public.grocery_meat_templates (sku, name, category, pack, image_url)
values
  ('GRC-MEAT-BRE-001','Chicken Breast','Meat & Poultry','1 kg','/images/grocery/meat/bre.svg'),
  ('GRC-MEAT-DRM-001','Chicken Drumsticks','Meat & Poultry','1 kg','/images/grocery/meat/drm.svg'),
  ('GRC-MEAT-PRT-001','Mixed Chicken Parts','Meat & Poultry','1 kg','/images/grocery/meat/prt.svg'),
  ('GRC-MEAT-SAS-001','Chicken Sausages (Small Pack)','Meat & Poultry','80 g','/images/grocery/meat/sas.svg'),
  ('GRC-MEAT-SAL-001','Chicken Sausages (Large Pack)','Meat & Poultry','500 g','/images/grocery/meat/sal.svg'),
  ('GRC-MEAT-MBL-001','Chicken Meatballs','Meat & Poultry','200 g','/images/grocery/meat/mbl.svg'),
  ('GRC-MEAT-BRO-001','Whole Broiler Chicken','Meat & Poultry','1 kg','/images/grocery/meat/bro.svg'),
  ('GRC-MEAT-PAR-001','Broiler Parent Chicken','Meat & Poultry','1 kg','/images/grocery/meat/par.svg'),
  ('GRC-MEAT-FAR-001','Farm Chicken','Meat & Poultry','1 kg','/images/grocery/meat/far.svg')
on conflict (sku) do update set
  name = excluded.name, category = excluded.category,
  pack = excluded.pack, image_url = excluded.image_url;

do $$
begin
  if exists (
    select 1 from public.products_base p
    where upper(btrim(coalesce(p.sku, ''))) like 'GRC-MEAT-%'
       or upper(btrim(coalesce(p.custom_fields->>'templateSku', ''))) like 'GRC-MEAT-%'
    group by p.organization_id,
      coalesce(nullif(upper(btrim(p.custom_fields->>'templateSku')), ''), upper(btrim(p.sku)))
    having count(*) > 1
  ) then
    raise exception 'duplicate meat template SKU already exists; review shop data before applying this migration';
  end if;
end;
$$;

create unique index if not exists products_base_grocery_meat_org_sku_uq
on public.products_base (
  organization_id,
  (coalesce(nullif(upper(btrim(custom_fields->>'templateSku')), ''), upper(btrim(sku))))
)
where upper(btrim(coalesce(sku, ''))) like 'GRC-MEAT-%'
   or upper(btrim(coalesce(custom_fields->>'templateSku', ''))) like 'GRC-MEAT-%';

create or replace function public.import_grocery_meat_catalogue(p_organization_id uuid)
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
  from public.grocery_meat_templates t
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

  for v_template in select * from public.grocery_meat_templates order by sku loop
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
      'meat-' || gen_random_uuid()::text, p_organization_id,
      v_template.name, v_template.sku, v_template.category, 'grocery', 'new',
      0, 0, 0, 0, 'pack',
      jsonb_build_object(
        'unitVariant', v_template.pack,
        'imageUrl', v_template.image_url,
        'templateSku', v_template.sku
      ),
      false,
      'Grocery meat template. Confirm cut, handling, pack, price, barcode and received stock before activation.',
      now(), now()
    ) on conflict do nothing;
    get diagnostics v_rows = row_count;
    v_added := v_added + v_rows;
  end loop;

  select count(*) into v_missing
  from public.grocery_meat_templates t
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
    (select count(*) from public.grocery_meat_templates) - v_added,
    'total', (select count(*) from public.grocery_meat_templates));
end;
$$;
revoke all on function public.import_grocery_meat_catalogue(uuid) from public, anon;
grant execute on function public.import_grocery_meat_catalogue(uuid) to authenticated;
