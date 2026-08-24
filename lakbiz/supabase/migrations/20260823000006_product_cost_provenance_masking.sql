-- Keep product-level cost provenance with the existing product master while
-- extending the owner-only financial boundary to the provenance keys too.
--
-- `buy_price` was already masked to zero for nonowners. Demo/import provenance
-- such as `costSource=spc_wholesale` or `costSource=synthetic_demo` must also be
-- invisible to manager/data_entry/cashier/technician roles. Do not create a
-- parallel product master just to protect two metadata keys.
--
-- Column names/types are unchanged, so existing INSTEAD OF view triggers and
-- grants continue to apply.

create or replace view public.products as
select
  p.id,
  p.organization_id,
  p.name,
  p.sku,
  p.category,
  p.sector_id,
  p.condition,
  case
    when public.can_see_org_financials(p.organization_id) then p.buy_price
    else 0::numeric(14,2)
  end as buy_price,
  p.sell_price,
  p.stock_qty,
  p.reorder_level,
  p.unit,
  case
    when public.can_see_org_financials(p.organization_id) then p.custom_fields
    else coalesce(p.custom_fields, '{}'::jsonb) - 'costSource' - 'costIsSynthetic'
  end as custom_fields,
  p.created_at,
  p.updated_at,
  p.active,
  p.notes
from public.products_base p
where p.organization_id in (
  select m.organization_id
  from public.org_members m
  where m.user_id = (select auth.uid())
);

comment on view public.products is
  'Tenant-scoped product facade. Internal buy cost and cost provenance metadata are visible only to organization owners.';
