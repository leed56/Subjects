-- Correct obvious non-food Grocery demo/reference taxonomy without touching
-- real customer inventory. The tenant update is restricted to the named demo
-- organization and deterministic demo:grocery:* rows. Reference catalogue
-- rows are non-financial product identity metadata only.

do $$
declare
  v_grocery_org uuid;
begin
  select id into v_grocery_org
  from public.organizations
  where name = 'LakBiz Grocery Demo' and sector = 'grocery'
  order by created_at
  limit 1;

  if v_grocery_org is null then
    raise notice 'LakBiz Grocery Demo not present; tenant cleanup skipped';
  else
    update public.products_base
    set
      category = case
        when lower(name) ~ '(fabric[[:space:]]+conditioner|laundry|washing[[:space:]]+powder|detergent|dish[ -]?wash|floor[[:space:]]+clean|toilet[[:space:]]+clean|bleach|surface[[:space:]]+clean|cleaner|air[[:space:]]+fresh|pest|insecticide|\mvim\M|\msurf\M)' then 'Cleaning'
        when lower(name) ~ '(face[[:space:]]+wash|body[[:space:]]+wash|shower[[:space:]]+gel|shampoo|conditioner|hair[[:space:]]+oil|hair[[:space:]]+gel|deodorant|body[[:space:]]+spray|cologne|perfume|eau[[:space:]]+de|hand[[:space:]]*wash|beauty[[:space:]]+bar|toothpaste|toothbrush|mouthwash|lotion|serum|moisturi|sunscreen|sun[[:space:]]+screen|aloe[[:space:]]+vera[[:space:]]+gel|\msoap\M|sanitary|panty[[:space:]]+liner|diaper|nappy|baby[[:space:]]+wipes?|face[[:space:]]+cream|body[[:space:]]+cream|hand[[:space:]]+cream|skin[[:space:]]+cream|beauty[[:space:]]+cream|face[[:space:]]+scrub|facial|lip[[:space:]]+balm|nail[[:space:]]+polish|razor|shaving)' then 'Personal Care'
        else category
      end,
      custom_fields = case
        when lower(name) ~ '(fabric[[:space:]]+conditioner|laundry|washing[[:space:]]+powder|detergent|dish[ -]?wash|floor[[:space:]]+clean|toilet[[:space:]]+clean|bleach|surface[[:space:]]+clean|cleaner|air[[:space:]]+fresh|pest|insecticide|\mvim\M|\msurf\M)' then
          jsonb_set(jsonb_set(jsonb_set(coalesce(custom_fields, '{}'::jsonb), '{department}', to_jsonb('Household'::text), true), '{subcategory}', to_jsonb('Household'::text), true), '{taxonomyMethod}', to_jsonb('grocery_taxonomy_cleanup_v2'::text), true)
        when lower(name) ~ '(face[[:space:]]+wash|body[[:space:]]+wash|shower[[:space:]]+gel|shampoo|conditioner|hair[[:space:]]+oil|hair[[:space:]]+gel|deodorant|body[[:space:]]+spray|cologne|perfume|eau[[:space:]]+de|hand[[:space:]]*wash|beauty[[:space:]]+bar|toothpaste|toothbrush|mouthwash|lotion|serum|moisturi|sunscreen|sun[[:space:]]+screen|aloe[[:space:]]+vera[[:space:]]+gel|\msoap\M|sanitary|panty[[:space:]]+liner|diaper|nappy|baby[[:space:]]+wipes?|face[[:space:]]+cream|body[[:space:]]+cream|hand[[:space:]]+cream|skin[[:space:]]+cream|beauty[[:space:]]+cream|face[[:space:]]+scrub|facial|lip[[:space:]]+balm|nail[[:space:]]+polish|razor|shaving)' then
          jsonb_set(jsonb_set(jsonb_set(coalesce(custom_fields, '{}'::jsonb), '{department}', to_jsonb('Personal & Baby'::text), true), '{subcategory}', to_jsonb('Personal & Baby'::text), true), '{taxonomyMethod}', to_jsonb('grocery_taxonomy_cleanup_v2'::text), true)
        else custom_fields
      end
    where organization_id = v_grocery_org
      and id like 'demo:grocery:%'
      and (
        lower(name) ~ '(fabric[[:space:]]+conditioner|laundry|washing[[:space:]]+powder|detergent|dish[ -]?wash|floor[[:space:]]+clean|toilet[[:space:]]+clean|bleach|surface[[:space:]]+clean|cleaner|air[[:space:]]+fresh|pest|insecticide|\mvim\M|\msurf\M)'
        or lower(name) ~ '(face[[:space:]]+wash|body[[:space:]]+wash|shower[[:space:]]+gel|shampoo|conditioner|hair[[:space:]]+oil|hair[[:space:]]+gel|deodorant|body[[:space:]]+spray|cologne|perfume|eau[[:space:]]+de|hand[[:space:]]*wash|beauty[[:space:]]+bar|toothpaste|toothbrush|mouthwash|lotion|serum|moisturi|sunscreen|sun[[:space:]]+screen|aloe[[:space:]]+vera[[:space:]]+gel|\msoap\M|sanitary|panty[[:space:]]+liner|diaper|nappy|baby[[:space:]]+wipes?|face[[:space:]]+cream|body[[:space:]]+cream|hand[[:space:]]+cream|skin[[:space:]]+cream|beauty[[:space:]]+cream|face[[:space:]]+scrub|facial|lip[[:space:]]+balm|nail[[:space:]]+polish|razor|shaving)'
      );
  end if;

  update public.product_reference_catalog
  set
    category = case
      when lower(name) ~ '(fabric[[:space:]]+conditioner|laundry|washing[[:space:]]+powder|detergent|dish[ -]?wash|floor[[:space:]]+clean|toilet[[:space:]]+clean|bleach|surface[[:space:]]+clean|cleaner|air[[:space:]]+fresh|pest|insecticide|\mvim\M|\msurf\M)' then 'Cleaning'
      when lower(name) ~ '(face[[:space:]]+wash|body[[:space:]]+wash|shower[[:space:]]+gel|shampoo|conditioner|hair[[:space:]]+oil|hair[[:space:]]+gel|deodorant|body[[:space:]]+spray|cologne|perfume|eau[[:space:]]+de|hand[[:space:]]*wash|beauty[[:space:]]+bar|toothpaste|toothbrush|mouthwash|lotion|serum|moisturi|sunscreen|sun[[:space:]]+screen|aloe[[:space:]]+vera[[:space:]]+gel|\msoap\M|sanitary|panty[[:space:]]+liner|diaper|nappy|baby[[:space:]]+wipes?|face[[:space:]]+cream|body[[:space:]]+cream|hand[[:space:]]+cream|skin[[:space:]]+cream|beauty[[:space:]]+cream|face[[:space:]]+scrub|facial|lip[[:space:]]+balm|nail[[:space:]]+polish|razor|shaving)' then 'Personal Care'
      else category
    end,
    updated_at = now()
  where sector_id = 'grocery'
    and (
      lower(name) ~ '(fabric[[:space:]]+conditioner|laundry|washing[[:space:]]+powder|detergent|dish[ -]?wash|floor[[:space:]]+clean|toilet[[:space:]]+clean|bleach|surface[[:space:]]+clean|cleaner|air[[:space:]]+fresh|pest|insecticide|\mvim\M|\msurf\M)'
      or lower(name) ~ '(face[[:space:]]+wash|body[[:space:]]+wash|shower[[:space:]]+gel|shampoo|conditioner|hair[[:space:]]+oil|hair[[:space:]]+gel|deodorant|body[[:space:]]+spray|cologne|perfume|eau[[:space:]]+de|hand[[:space:]]*wash|beauty[[:space:]]+bar|toothpaste|toothbrush|mouthwash|lotion|serum|moisturi|sunscreen|sun[[:space:]]+screen|aloe[[:space:]]+vera[[:space:]]+gel|\msoap\M|sanitary|panty[[:space:]]+liner|diaper|nappy|baby[[:space:]]+wipes?|face[[:space:]]+cream|body[[:space:]]+cream|hand[[:space:]]+cream|skin[[:space:]]+cream|beauty[[:space:]]+cream|face[[:space:]]+scrub|facial|lip[[:space:]]+balm|nail[[:space:]]+polish|razor|shaving)'
    );
end $$;
