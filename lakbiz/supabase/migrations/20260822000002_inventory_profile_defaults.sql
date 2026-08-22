-- Auto-provision the correct advanced-inventory profile for every product.
--
-- This is what makes a newly created LakBiz shop behave like its chosen
-- vertical without a platform-admin manually configuring every product:
-- Pharmacy -> batch/expiry FEFO
-- Mobile -> storage/colour variants + IMEI/serial
-- Footwear -> size/colour variants
-- Electronics -> serial identity
-- Other sectors -> current simple quantity model unless explicitly upgraded.
--
-- The profile is additive metadata only. Existing stock quantities and sales
-- are not rewritten by this migration.

create or replace function public.default_inventory_mode_for_sector(sector_id text)
returns text
language sql
immutable
set search_path = public
as $$
  select case sector_id
    when 'pharmacy' then 'lot'
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
  select o.sector_id into org_sector
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
    org_sector = 'pharmacy',
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

-- Backfill existing catalogue rows without changing any existing stock value.
insert into public.product_inventory_profiles (
  product_id,
  organization_id,
  tracking_mode,
  variant_axes,
  fefo_enabled,
  require_serial_on_sale
)
select
  p.id,
  p.organization_id,
  public.default_inventory_mode_for_sector(coalesce(o.sector_id, p.sector_id, 'grocery')),
  public.default_inventory_axes_for_sector(coalesce(o.sector_id, p.sector_id, 'grocery')),
  coalesce(o.sector_id, p.sector_id, 'grocery') = 'pharmacy',
  public.default_inventory_mode_for_sector(coalesce(o.sector_id, p.sector_id, 'grocery')) in ('serial', 'variant_serial')
from public.products_base p
left join public.organizations o on o.id = p.organization_id
on conflict (product_id) do nothing;

drop trigger if exists products_ensure_inventory_profile on public.products_base;
create trigger products_ensure_inventory_profile
after insert on public.products_base
for each row execute function public.ensure_product_inventory_profile();

comment on function public.ensure_product_inventory_profile() is
  'Automatically assigns the correct advanced-inventory strategy when a product is created, based on the shop sector. Does not alter stock quantities.';
