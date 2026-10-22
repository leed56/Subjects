-- Read-only rollout preflight. Re-run immediately before migration: these
-- checks cover opening quantities and tenant consistency, not full schema
-- compatibility, concurrent writes, backup recovery, or reconciliation.
select
  (select count(*) from public.organizations) as organizations,
  (select count(*) from public.products_base) as products,
  (select count(*) from public.inventory_lots) as lots,
  (select count(*) from public.inventory_units) as units,
  (select count(*) from public.textile_rolls) as textile_rolls,
  (select count(*) from public.products_base p
    left join public.product_inventory_profiles profile on profile.product_id = p.id
    where coalesce(profile.tracking_mode, 'simple') = 'simple'
      and (p.stock_qty is null or p.stock_qty < 0 or p.stock_qty = 'NaN'::numeric)) as invalid_simple_stock,
  (select count(*) from public.product_variants v
    join public.product_inventory_profiles profile on profile.product_id = v.product_id and profile.tracking_mode = 'variant'
    where v.stock_qty is null or v.stock_qty < 0 or v.stock_qty = 'NaN'::numeric) as invalid_variant_stock,
  (select count(*) from public.inventory_lots
    where qty_on_hand is null or qty_on_hand < 0 or qty_on_hand = 'NaN'::numeric) as invalid_lot_stock,
  (select count(*) from public.inventory_lots l join public.products_base p on p.id = l.product_id
    where p.organization_id <> l.organization_id) as cross_company_lots,
  (select count(*) from public.inventory_units u join public.products_base p on p.id = u.product_id
    where p.organization_id <> u.organization_id) as cross_company_units,
  (select count(*) from public.product_variants v join public.products_base p on p.id = v.product_id
    where p.organization_id <> v.organization_id) as cross_company_variants,
  to_regclass('public.inventory_locations') is not null as has_locations;
