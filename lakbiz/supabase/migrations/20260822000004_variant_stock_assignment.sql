-- LakBiz advanced inventory — assign existing aggregate stock to pure variants.
--
-- The existing Product.stockQty remains the aggregate quantity ledger. A pure
-- variant product (e.g. footwear size/colour) needs that aggregate stock split
-- across variants so POS can prevent selling a missing size. This RPC DOES NOT
-- change products_base.stock_qty. Instead it assigns/reassigns part of the
-- already-recorded aggregate quantity to one variant, with a hard invariant:
--
--   sum(product_variants.stock_qty for product) <= products_base.stock_qty
--
-- Positive assignment therefore requires unassigned aggregate stock. Negative
-- adjustment returns quantity to the product's unassigned pool. Actual sale
-- checkout decrements both the existing aggregate ledger and the selected pure
-- variant, preserving the invariant.

create or replace function public.adjust_product_variant_stock(
  p_organization_id uuid,
  p_product_id text,
  p_variant_id uuid,
  p_delta numeric,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_mode text;
  v_product_qty numeric(14,3);
  v_variant_qty numeric(14,3);
  v_other_qty numeric(14,3);
  v_new_qty numeric(14,3);
  v_total_after numeric(14,3);
begin
  if p_organization_id is null or p_product_id is null or p_variant_id is null then
    raise exception 'organization, product and variant are required' using errcode = '22023';
  end if;
  if p_delta is null or p_delta = 0 then
    raise exception 'delta must be non-zero' using errcode = '22023';
  end if;

  if not public.org_member_can_write_module(p_organization_id, 'stock')
     or not public.org_member_role_in(
       p_organization_id,
       array['owner','manager','data_entry','cashier']
     ) then
    raise exception 'permission denied for variant stock assignment' using errcode = '42501';
  end if;

  select coalesce(p.tracking_mode, 'simple')
    into v_mode
  from public.product_inventory_profiles p
  where p.organization_id = p_organization_id
    and p.product_id = p_product_id;

  if coalesce(v_mode, 'simple') <> 'variant' then
    raise exception 'manual variant quantity applies only to pure variant tracking' using errcode = '22023';
  end if;

  select pb.stock_qty
    into v_product_qty
  from public.products_base pb
  where pb.organization_id = p_organization_id
    and pb.id = p_product_id
  for update;

  if not found then
    raise exception 'product not found' using errcode = 'P0002';
  end if;

  select pv.stock_qty
    into v_variant_qty
  from public.product_variants pv
  where pv.organization_id = p_organization_id
    and pv.product_id = p_product_id
    and pv.id = p_variant_id
    and pv.active = true
  for update;

  if not found then
    raise exception 'variant not found or inactive' using errcode = 'P0002';
  end if;

  v_new_qty := v_variant_qty + p_delta;
  if v_new_qty < 0 then
    raise exception 'variant stock cannot become negative' using errcode = '23514';
  end if;

  -- Lock sibling variants as part of the same product allocation decision so
  -- two simultaneous positive assignments cannot both consume the same
  -- unassigned aggregate quantity.
  perform 1
  from public.product_variants pv
  where pv.organization_id = p_organization_id
    and pv.product_id = p_product_id
  for update;

  select coalesce(sum(pv.stock_qty), 0)
    into v_other_qty
  from public.product_variants pv
  where pv.organization_id = p_organization_id
    and pv.product_id = p_product_id
    and pv.id <> p_variant_id;

  v_total_after := v_other_qty + v_new_qty;
  if v_total_after > v_product_qty then
    raise exception 'assigned variant stock (%) exceeds aggregate product stock (%)', v_total_after, v_product_qty
      using errcode = '23514';
  end if;

  update public.product_variants
  set stock_qty = v_new_qty,
      updated_at = now()
  where id = p_variant_id;

  return jsonb_build_object(
    'ok', true,
    'variant_qty', v_new_qty,
    'assigned_total', v_total_after,
    'aggregate_qty', v_product_qty,
    'unassigned_qty', v_product_qty - v_total_after,
    'note', nullif(btrim(coalesce(p_note, '')), '')
  );
end;
$$;

revoke all on function public.adjust_product_variant_stock(uuid, text, uuid, numeric, text) from public, anon;
grant execute on function public.adjust_product_variant_stock(uuid, text, uuid, numeric, text) to authenticated;

comment on function public.adjust_product_variant_stock(uuid, text, uuid, numeric, text) is
  'Assigns/reassigns existing aggregate Product stock to a pure size/colour/etc variant. Never changes products_base.stock_qty and never allows total variant stock to exceed it.';
