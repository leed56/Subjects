-- LakBiz Textile Phase 1: make wholesale/retail textile a provisionable
-- first-class sector while reusing the mature retail, supplier and finance core.

insert into public.business_templates (
  id, name_en, name_si, sector_id, default_plan_id, sort_order, is_active
) values (
  'textile',
  'Textile Wholesale & Retail',
  'රෙදි තොග සහ සිල්ලර වෙළඳාම',
  'textile',
  'business',
  75,
  true
)
on conflict (id) do update set
  name_en = excluded.name_en,
  name_si = excluded.name_si,
  sector_id = excluded.sector_id,
  default_plan_id = excluded.default_plan_id,
  sort_order = excluded.sort_order,
  is_active = excluded.is_active;

insert into public.sector_modules (sector_id, module_key, allowed) values
  ('textile', 'sales', true),
  ('textile', 'stock', true),
  ('textile', 'bills', true),
  ('textile', 'customers', true),
  ('textile', 'suppliers', true),
  ('textile', 'banking', true),
  ('textile', 'ac_jobs', false),
  ('textile', 'vehicles', false),
  ('textile', 'export', true),
  ('textile', 'offline', false)
on conflict (sector_id, module_key) do update set allowed = excluded.allowed;

-- The reference catalogue originally constrained the known sector list. Add
-- Textile now so curated fabric references can be loaded later without
-- weakening sector isolation.
alter table public.product_reference_catalog
  drop constraint if exists product_reference_catalog_sector_id_check;

alter table public.product_reference_catalog
  add constraint product_reference_catalog_sector_id_check
  check (sector_id in (
    'grocery','pharmacy','electronics','mobile_shop','electricals',
    'spare_parts','footwear','textile','ac_hvac','car_sales'
  ));

