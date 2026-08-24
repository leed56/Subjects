-- Global, non-financial product reference catalogue used only for type-ahead
-- item creation. This is deliberately separate from tenant inventory: it has
-- no organization_id, stock quantity, buy cost, sell price, profit, supplier
-- finance or customer data.
--
-- Client users do not choose a sector. The search RPC derives the caller's
-- organization sector from org_members -> organizations, so a provisioned
-- Pharmacy/Grocery shop only receives suggestions appropriate to its sector.

create table if not exists public.product_reference_catalog (
  id text primary key,
  sector_id text not null check (sector_id in (
    'grocery','pharmacy','electronics','mobile_shop','electricals',
    'spare_parts','footwear','ac_hvac','car_sales'
  )),
  name text not null,
  sku text,
  unit text not null default 'pcs',
  source text,
  source_product_id text,
  source_url text,
  pack_size text,
  brand text,
  generic_name text,
  strength text,
  dosage_form text,
  manufacturer text,
  manufacturing_country text,
  regulatory_registration_number text,
  regulatory_source text,
  regulatory_source_url text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (sector_id, source, source_product_id)
);

create index if not exists product_reference_catalog_sector_name_idx
  on public.product_reference_catalog (sector_id, lower(name));
create index if not exists product_reference_catalog_sector_sku_idx
  on public.product_reference_catalog (sector_id, lower(sku));
create index if not exists product_reference_catalog_sector_generic_idx
  on public.product_reference_catalog (sector_id, lower(generic_name));

alter table public.product_reference_catalog enable row level security;
revoke all on table public.product_reference_catalog from anon, authenticated;

-- Bootstrap the reference catalogue from the already validated public-source
-- demo imports. Copy only factual identity/reference fields. Explicitly do not
-- copy demo stock, prices, cost provenance, synthetic flags, customers or
-- transaction history. The catalogue survives independently of demo shops.
insert into public.product_reference_catalog (
  id,
  sector_id,
  name,
  sku,
  unit,
  source,
  source_product_id,
  source_url,
  pack_size,
  brand,
  generic_name,
  strength,
  dosage_form,
  manufacturer,
  manufacturing_country,
  regulatory_registration_number,
  regulatory_source,
  regulatory_source_url,
  active
)
select
  p.sector_id || ':' || coalesce(nullif(p.custom_fields->>'source',''), 'reference') || ':' ||
    coalesce(nullif(p.custom_fields->>'sourceProductId',''), nullif(p.sku,''), p.id),
  p.sector_id,
  p.name,
  p.sku,
  coalesce(nullif(p.unit,''), 'pcs'),
  nullif(p.custom_fields->>'source',''),
  nullif(p.custom_fields->>'sourceProductId',''),
  nullif(p.custom_fields->>'sourceUrl',''),
  nullif(p.custom_fields->>'packSize',''),
  nullif(p.custom_fields->>'brand',''),
  nullif(p.custom_fields->>'genericName',''),
  nullif(p.custom_fields->>'strength',''),
  nullif(p.custom_fields->>'dosageForm',''),
  nullif(p.custom_fields->>'manufacturer',''),
  nullif(p.custom_fields->>'manufacturingCountry',''),
  nullif(p.custom_fields->>'regulatoryRegistrationNumber',''),
  nullif(p.custom_fields->>'regulatorySource',''),
  nullif(p.custom_fields->>'regulatorySourceUrl',''),
  true
from public.products_base p
join public.organizations o on o.id = p.organization_id
where
  ((o.name = 'LakBiz Pharmacy Demo' and p.sector_id = 'pharmacy')
   or (o.name = 'LakBiz Grocery Demo' and p.sector_id = 'grocery'))
  and p.active = true
on conflict (id) do nothing;

create or replace function public.search_product_reference_catalog(
  p_query text,
  p_limit integer default 12
)
returns table (
  id text,
  name text,
  sku text,
  unit text,
  source text,
  source_url text,
  pack_size text,
  brand text,
  generic_name text,
  strength text,
  dosage_form text,
  manufacturer text,
  manufacturing_country text,
  regulatory_registration_number text,
  regulatory_source text,
  regulatory_source_url text
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_sector text;
  v_query text := btrim(coalesce(p_query, ''));
  v_limit integer := least(greatest(coalesce(p_limit, 12), 1), 20);
begin
  if auth.uid() is null or length(v_query) < 1 then
    return;
  end if;

  select o.sector
    into v_sector
  from public.org_members m
  join public.organizations o on o.id = m.organization_id
  where m.user_id = auth.uid()
  order by m.created_at
  limit 1;

  if v_sector is null then
    return;
  end if;

  return query
  select
    c.id,
    c.name,
    c.sku,
    c.unit,
    c.source,
    c.source_url,
    c.pack_size,
    c.brand,
    c.generic_name,
    c.strength,
    c.dosage_form,
    c.manufacturer,
    c.manufacturing_country,
    c.regulatory_registration_number,
    c.regulatory_source,
    c.regulatory_source_url
  from public.product_reference_catalog c
  where c.active = true
    and c.sector_id = v_sector
    and (
      lower(c.name) like '%' || lower(v_query) || '%'
      or lower(coalesce(c.sku, '')) like '%' || lower(v_query) || '%'
      or lower(coalesce(c.generic_name, '')) like '%' || lower(v_query) || '%'
      or lower(coalesce(c.brand, '')) like '%' || lower(v_query) || '%'
    )
  order by
    case when lower(c.name) like lower(v_query) || '%' then 0 else 1 end,
    case when lower(coalesce(c.generic_name, '')) like lower(v_query) || '%' then 0 else 1 end,
    c.name
  limit v_limit;
end;
$$;

revoke all on function public.search_product_reference_catalog(text, integer) from public, anon;
grant execute on function public.search_product_reference_catalog(text, integer) to authenticated;

comment on table public.product_reference_catalog is
  'Global non-financial product identity/reference catalogue for client type-ahead item creation. No tenant stock, prices, costs or transaction data.';
comment on function public.search_product_reference_catalog(text, integer) is
  'Returns product suggestions only for the authenticated user organization sector; clients never submit or choose their sector.';
