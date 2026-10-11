-- Cosmetics uses the existing retail, batch/variant, returns and financial engines.
-- Apply with the matching application release: old clients do not recognize this sector.
-- Existing products, stock quantities, permissions and invoices are not rewritten.

insert into public.business_templates
  (id, name_en, name_si, sector_id, default_plan_id, sort_order, is_active)
values ('cosmetics', 'Cosmetics & Beauty', 'රූපලාවණ්‍ය සහ සුවඳ විලවුන්', 'cosmetics', 'business', 25, true)
on conflict (id) do update set
  name_en = excluded.name_en, name_si = excluded.name_si,
  sector_id = excluded.sector_id, default_plan_id = excluded.default_plan_id,
  sort_order = excluded.sort_order, is_active = excluded.is_active;

insert into public.sector_modules (sector_id, module_key, allowed) values
  ('cosmetics', 'sales', true), ('cosmetics', 'stock', true),
  ('cosmetics', 'bills', true), ('cosmetics', 'customers', true),
  ('cosmetics', 'suppliers', true), ('cosmetics', 'banking', true),
  ('cosmetics', 'ac_jobs', false), ('cosmetics', 'vehicles', false),
  ('cosmetics', 'export', true), ('cosmetics', 'offline', false),
  ('cosmetics', 'bulk_messaging', true)
on conflict (sector_id, module_key) do update set allowed = excluded.allowed;

-- Keep the existing catalogue isolation constraint, adding only the new sector.
alter table public.product_reference_catalog
  drop constraint if exists product_reference_catalog_sector_id_check;
alter table public.product_reference_catalog
  add constraint product_reference_catalog_sector_id_check
  check (sector_id in (
    'grocery','pharmacy','cosmetics','electronics','mobile_shop','electricals',
    'spare_parts','footwear','textile','ac_hvac','car_sales'
  ));

create or replace function public.default_inventory_mode_for_sector(sector_id text)
returns text
language sql
immutable
set search_path = public
as $$
  select case sector_id
    when 'pharmacy' then 'lot'
    when 'cosmetics' then 'lot'
    when 'mobile_shop' then 'variant_serial'
    when 'footwear' then 'variant'
    when 'electronics' then 'serial'
    else 'simple'
  end;
$$;

create or replace function public.default_inventory_axes_for_sector(sector_id text)
returns jsonb
language sql
immutable
set search_path = public
as $$
  select case sector_id
    when 'pharmacy' then '["strength","pack"]'::jsonb
    when 'cosmetics' then '["shade","pack"]'::jsonb
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
    org_sector in ('pharmacy', 'cosmetics'),
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
