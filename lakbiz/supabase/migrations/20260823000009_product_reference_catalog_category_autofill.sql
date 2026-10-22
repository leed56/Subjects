alter table public.product_reference_catalog
  add column if not exists category text;

update public.product_reference_catalog c
set category = (
  select min(p.category)
  from public.products_base p
  where p.sector_id = c.sector_id
    and p.name = c.name
)
where c.category is null;

drop function if exists public.search_product_reference_catalog(text, integer);

create function public.search_product_reference_catalog(p_query text, p_limit integer default 12)
returns table(
  id text,
  name text,
  sku text,
  unit text,
  category text,
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
    c.category,
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
grant execute on function public.search_product_reference_catalog(text, integer) to authenticated, service_role;
