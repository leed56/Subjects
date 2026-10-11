-- Additive industry catalogue release; deploy only with a compatible application.
-- No existing organization sector, profile, quantity, cost or invoice is rewritten.
insert into public.business_templates (id,name_en,name_si,sector_id,default_plan_id,sort_order,is_active) values
 ('hardware','Hardware & Building Supplies','දෘඩාංග සහ ගොඩනැගිලි සැපයුම්','hardware','business',110,true),
 ('stationery','Stationery & Books','ලිපිද්‍රව්‍ය සහ පොත්','stationery','business',120,true),
 ('wholesale','Wholesale & Distribution','තොග වෙළඳාම සහ බෙදාහැරීම','wholesale','business',130,true)
on conflict(id) do update set name_en=excluded.name_en,name_si=excluded.name_si,
 sector_id=excluded.sector_id,default_plan_id=excluded.default_plan_id,sort_order=excluded.sort_order,is_active=excluded.is_active;

insert into public.sector_modules (sector_id,module_key,allowed)
select sector_id,module_key,module_key not in ('ac_jobs','vehicles','offline')
from unnest(array['hardware','stationery','wholesale']) as sectors(sector_id)
cross join unnest(array['sales','stock','bills','customers','suppliers','banking','ac_jobs','vehicles','export','offline','bulk_messaging']) as modules(module_key)
on conflict(sector_id,module_key) do update set allowed=excluded.allowed;

alter table public.product_reference_catalog drop constraint if exists product_reference_catalog_sector_id_check;
alter table public.product_reference_catalog add constraint product_reference_catalog_sector_id_check
 check(sector_id in ('grocery','pharmacy','cosmetics','electronics','mobile_shop','electricals','spare_parts','footwear','textile','ac_hvac','car_sales','hardware','stationery','wholesale'));

create or replace function public.default_inventory_axes_for_sector(sector_id text)
returns jsonb
language sql
immutable
set search_path = public
as $$
  select case sector_id
    when 'pharmacy' then '["strength","pack"]'::jsonb
    when 'cosmetics' then '["shade","pack"]'::jsonb
    when 'hardware' then '["size","pack"]'::jsonb
    when 'stationery' then '["size","pack"]'::jsonb
    when 'wholesale' then '["pack"]'::jsonb
    when 'mobile_shop' then '["storage","colour"]'::jsonb
    when 'footwear' then '["size","colour"]'::jsonb
    when 'electronics' then '["model","colour"]'::jsonb
    when 'electricals' then '["rating","length"]'::jsonb
    when 'spare_parts' then '["fitment"]'::jsonb
    when 'ac_hvac' then '["capacity","unitType"]'::jsonb
    when 'grocery' then '["pack"]'::jsonb
    else '[]'::jsonb
  end;
$$;

create or replace function public.ensure_product_inventory_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  org_sector text;
  mode text;
begin
  select o.sector into org_sector
  from public.organizations o
  where o.id = new.organization_id;

  org_sector := coalesce(org_sector, new.sector_id, 'grocery');
  mode := public.default_inventory_mode_for_sector(org_sector);

  insert into public.product_inventory_profiles (
    product_id,
    organization_id,
    tracking_mode,
    variant_axes,
    fefo_enabled,
    require_serial_on_sale
  ) values (
    new.id,
    new.organization_id,
    mode,
    public.default_inventory_axes_for_sector(org_sector),
    org_sector in ('pharmacy', 'cosmetics', 'wholesale'),
    mode in ('serial', 'variant_serial')
  )
  on conflict (product_id) do nothing;

  return new;
end;
$$;

revoke all on function public.default_inventory_mode_for_sector(text) from public, anon;
revoke all on function public.default_inventory_axes_for_sector(text) from public, anon;
revoke all on function public.ensure_product_inventory_profile() from public, anon;
grant execute on function public.default_inventory_mode_for_sector(text) to authenticated;
grant execute on function public.default_inventory_axes_for_sector(text) to authenticated;
