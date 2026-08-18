-- LakBiz HVAC platform Phase 2: parts/materials catalogue support.
--
-- Adds two generic (not sector-specific) Product fields the audit found
-- genuinely missing: `active` (deactivate a discontinued part without
-- deleting it — deleting would orphan any job_items/stock_logs/sale_lines
-- that reference the product id by history) and `notes` (free text).
-- Everything else Phase 2 needed (HVAC parts categories, part
-- number/compatible-model/supplier-part-number/serial-required fields) is
-- covered by the existing configurable sector/category system
-- (sectors.ts, sector-fields.ts) — no schema change required for those.
--
-- `products` is a masked view over `products_base` (see
-- 20250623000001_financial_data_rls.sql, which hides buy_price from
-- non-financial roles) with INSTEAD OF triggers standing in for direct
-- insert/update/delete. New columns must be added to the base table, then
-- appended (not inserted) to the view and both trigger functions — Postgres
-- CREATE OR REPLACE VIEW rejects anything that isn't a pure column
-- append, same constraint noted in 20250629000001_ac_asset_lifecycle.sql.
--
-- CORRECTION (found during the live-DB audit, months after this migration
-- was written — see IMPLEMENTATION_PROGRESS.md's DB sync remediation
-- entry): this file was never actually applied to the live database.
-- Reported live: "Could not find the 'active' column of 'products' in
-- the schema cache." Applying the file as originally written would have
-- also REGRESSED two later, already-live security fixes:
--   - 20250625000003_masked_view_triggers_security_definer.sql made the
--     insert/update trigger functions SECURITY DEFINER with an
--     org_member_can_write_module(..., 'stock') permission check. The
--     original draft below was SECURITY INVOKER with no check at all.
--   - 20250628000003_fix_masked_view_grant_regression.sql gave the view
--     its own tenant WHERE clause and security_invoker=false (not the
--     security_invoker=true + base-table-grant shape this file's era
--     used, which that later migration deliberately reverted as a
--     column-masking bypass risk).
-- Corrected below to build on the actual current live shape (fetched via
-- pg_get_viewdef/pg_get_functiondef before writing this correction, not
-- assumed) instead of replaying the stale original.

alter table public.products_base add column if not exists active boolean not null default true;
alter table public.products_base add column if not exists notes text;

create or replace view public.products as
select id, organization_id, name, sku, category, sector_id, condition,
  case when public.can_see_org_financials(organization_id) then buy_price else 0::numeric(14,2) end as buy_price,
  sell_price, stock_qty, reorder_level, unit, custom_fields, created_at, updated_at,
  active, notes
from public.products_base p
where organization_id in (select organization_id from public.org_members where user_id = auth.uid());

alter view public.products set (security_invoker = false);

grant select, insert, update, delete on public.products to authenticated;

create or replace function public.products_view_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.org_member_can_write_module(new.organization_id, 'stock') then
    raise exception 'permission denied for table products_base' using errcode = '42501';
  end if;
  insert into public.products_base (
    id, organization_id, name, sku, category, sector_id, condition,
    buy_price, sell_price, stock_qty, reorder_level, unit, custom_fields,
    created_at, updated_at, active, notes
  ) values (
    new.id, new.organization_id, new.name, new.sku, new.category, new.sector_id, new.condition,
    new.buy_price, new.sell_price, new.stock_qty, new.reorder_level, new.unit, new.custom_fields,
    coalesce(new.created_at, now()), coalesce(new.updated_at, now()),
    coalesce(new.active, true), new.notes
  );
  return new;
end;
$$;

create or replace function public.products_view_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.org_member_can_write_module(new.organization_id, 'stock') then
    raise exception 'permission denied for table products_base' using errcode = '42501';
  end if;
  update public.products_base set
    name = new.name,
    sku = new.sku,
    category = new.category,
    sector_id = new.sector_id,
    condition = new.condition,
    buy_price = new.buy_price,
    sell_price = new.sell_price,
    stock_qty = new.stock_qty,
    reorder_level = new.reorder_level,
    unit = new.unit,
    custom_fields = new.custom_fields,
    updated_at = coalesce(new.updated_at, now()),
    active = coalesce(new.active, true),
    notes = new.notes
  where id = old.id and organization_id = old.organization_id;
  return new;
end;
$$;

comment on column public.products_base.active is 'Discontinued/retired items stay for history (job_items/stock_logs/sale_lines still reference the id) but drop out of sale pickers, reorder signals, and the default stock list.';
comment on column public.products_base.notes is 'Free-text notes, generic across every sector (unlike custom_fields, which is sector-specific).';
