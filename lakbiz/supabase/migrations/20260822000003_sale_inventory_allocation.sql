-- LakBiz advanced inventory — transactional POS allocation.
--
-- Bridges the existing sale/stock workflow to the additive advanced identity
-- layer without double-decrementing products_base.stock_qty. The existing sale
-- workflow remains authoritative for aggregate product quantity; this function
-- updates only variant/lot/unit identity balances + the allocation audit trail.
--
-- Behaviour by tracking mode:
--   simple         -> no advanced allocation required
--   lot            -> FEFO allocation across valid batches automatically
--   variant        -> explicit variant required
--   serial         -> exact available unit ids required
--   variant_lot    -> explicit variant + FEFO batch allocation
--   variant_serial -> explicit variant + exact available unit ids
--
-- The whole advanced allocation runs in one PostgreSQL transaction. A race on
-- the same IMEI/batch/variant therefore fails the allocation instead of silently
-- overselling identity stock. Replays are idempotent per sale_id.

create or replace function public.allocate_sale_inventory(
  p_organization_id uuid,
  p_sale_id text,
  p_customer_id text default null,
  p_lines jsonb default '[]'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  line jsonb;
  v_product_id text;
  v_qty numeric(14,3);
  v_variant_id uuid;
  v_mode text;
  v_fefo boolean;
  v_sale_qty numeric(14,3);
  v_variant_qty numeric(14,3);
  v_needed numeric(14,3);
  v_take numeric(14,3);
  v_lot record;
  v_unit_id uuid;
  v_unit record;
  v_unit_ids jsonb;
  v_unit_count integer;
  v_alloc_count integer := 0;
  v_existing_count integer := 0;
begin
  if p_organization_id is null or p_sale_id is null or btrim(p_sale_id) = '' then
    raise exception 'organization_id and sale_id are required' using errcode = '22023';
  end if;

  if not public.org_member_can_write_module(p_organization_id, 'sales')
     or not public.org_member_role_in(
       p_organization_id,
       array['owner','manager','data_entry','cashier']
     ) then
    raise exception 'permission denied for advanced sale allocation' using errcode = '42501';
  end if;

  if not exists (
    select 1 from public.sales_base s
    where s.id = p_sale_id and s.organization_id = p_organization_id
  ) then
    raise exception 'sale not found for organization' using errcode = 'P0002';
  end if;

  -- Idempotent retry: sync/retry may invoke this more than once after the sale
  -- itself has already reached Supabase. Never consume identity stock twice.
  select count(*) into v_existing_count
  from public.inventory_allocations a
  where a.organization_id = p_organization_id
    and a.reference_type = 'sale'
    and a.reference_id = p_sale_id;

  if v_existing_count > 0 then
    return jsonb_build_object(
      'ok', true,
      'replayed', true,
      'allocations', v_existing_count
    );
  end if;

  if jsonb_typeof(coalesce(p_lines, '[]'::jsonb)) <> 'array' then
    raise exception 'p_lines must be a JSON array' using errcode = '22023';
  end if;

  for line in select value from jsonb_array_elements(coalesce(p_lines, '[]'::jsonb))
  loop
    v_product_id := nullif(btrim(line->>'product_id'), '');
    v_qty := coalesce(nullif(line->>'qty', '')::numeric, 0);
    v_variant_id := nullif(line->>'variant_id', '')::uuid;

    if v_product_id is null or v_qty <= 0 then
      raise exception 'each allocation line needs product_id and qty > 0' using errcode = '22023';
    end if;

    -- Never allow advanced identity allocation beyond what the saved sale line
    -- actually sold. This also prevents a valid staff session being used to
    -- consume unrelated stock through a crafted RPC call.
    select coalesce(sum(sl.qty), 0) into v_sale_qty
    from public.sale_lines_base sl
    where sl.organization_id = p_organization_id
      and sl.sale_id = p_sale_id
      and sl.product_id = v_product_id;

    if v_sale_qty <= 0 or v_qty > v_sale_qty then
      raise exception 'allocation quantity exceeds saved sale quantity for product %', v_product_id
        using errcode = '22023';
    end if;

    select p.tracking_mode, p.fefo_enabled
      into v_mode, v_fefo
    from public.product_inventory_profiles p
    where p.organization_id = p_organization_id
      and p.product_id = v_product_id;

    v_mode := coalesce(v_mode, 'simple');
    v_fefo := coalesce(v_fefo, false);

    if v_mode = 'simple' then
      continue;
    end if;

    if v_mode in ('variant', 'variant_lot', 'variant_serial') then
      if v_variant_id is null then
        raise exception 'variant selection required for product %', v_product_id using errcode = '22023';
      end if;

      select pv.stock_qty into v_variant_qty
      from public.product_variants pv
      where pv.id = v_variant_id
        and pv.organization_id = p_organization_id
        and pv.product_id = v_product_id
        and pv.active = true
      for update;

      if not found then
        raise exception 'selected variant is unavailable for product %', v_product_id using errcode = 'P0002';
      end if;
      if v_variant_qty < v_qty then
        raise exception 'insufficient variant stock for product %', v_product_id using errcode = '23514';
      end if;
    end if;

    if v_mode = 'variant' then
      update public.product_variants
      set stock_qty = stock_qty - v_qty
      where id = v_variant_id;

      insert into public.inventory_allocations (
        organization_id, product_id, variant_id, reference_type, reference_id, qty
      ) values (
        p_organization_id, v_product_id, v_variant_id, 'sale', p_sale_id, v_qty
      );
      v_alloc_count := v_alloc_count + 1;
      continue;
    end if;

    if v_mode in ('lot', 'variant_lot') then
      v_needed := v_qty;

      -- Earliest valid expiry first. NULL expiry sorts last. The FOR UPDATE lock
      -- closes the classic two-cashiers-selling-the-last-batch race.
      for v_lot in
        select il.id, il.variant_id, il.qty_on_hand, il.expiry_date, il.received_date
        from public.inventory_lots il
        where il.organization_id = p_organization_id
          and il.product_id = v_product_id
          and (v_mode = 'lot' or il.variant_id = v_variant_id)
          and il.status = 'available'
          and il.qty_on_hand > 0
          and (il.expiry_date is null or il.expiry_date >= current_date)
        order by il.expiry_date asc nulls last, il.received_date asc, il.created_at asc
        for update
      loop
        exit when v_needed <= 0;
        v_take := least(v_needed, v_lot.qty_on_hand);

        update public.inventory_lots
        set qty_on_hand = qty_on_hand - v_take,
            status = case when qty_on_hand - v_take <= 0 then 'depleted' else status end
        where id = v_lot.id;

        insert into public.inventory_allocations (
          organization_id, product_id, variant_id, lot_id,
          reference_type, reference_id, qty
        ) values (
          p_organization_id, v_product_id, v_variant_id, v_lot.id,
          'sale', p_sale_id, v_take
        );

        v_alloc_count := v_alloc_count + 1;
        v_needed := v_needed - v_take;
      end loop;

      if v_needed > 0 then
        raise exception 'insufficient non-expired batch stock for product %', v_product_id using errcode = '23514';
      end if;

      if v_mode = 'variant_lot' then
        update public.product_variants
        set stock_qty = stock_qty - v_qty
        where id = v_variant_id;
      end if;

      continue;
    end if;

    if v_mode in ('serial', 'variant_serial') then
      if trunc(v_qty) <> v_qty then
        raise exception 'serialized product quantity must be a whole number for product %', v_product_id using errcode = '22023';
      end if;

      v_unit_ids := coalesce(line->'unit_ids', '[]'::jsonb);
      if jsonb_typeof(v_unit_ids) <> 'array' then
        raise exception 'unit_ids must be an array for serialized product %', v_product_id using errcode = '22023';
      end if;

      select count(distinct value) into v_unit_count
      from jsonb_array_elements_text(v_unit_ids);

      if v_unit_count <> v_qty::integer then
        raise exception 'select exactly % unique serialized unit(s) for product %', v_qty::integer, v_product_id
          using errcode = '22023';
      end if;

      for v_unit_id in
        select value::uuid from jsonb_array_elements_text(v_unit_ids)
      loop
        select iu.id, iu.variant_id, iu.status
          into v_unit
        from public.inventory_units iu
        where iu.id = v_unit_id
          and iu.organization_id = p_organization_id
          and iu.product_id = v_product_id
          and iu.status = 'available'
          and (v_mode = 'serial' or iu.variant_id = v_variant_id)
        for update;

        if not found then
          raise exception 'serialized unit % is no longer available', v_unit_id using errcode = '23514';
        end if;

        update public.inventory_units
        set status = 'sold',
            sale_id = p_sale_id,
            customer_id = nullif(p_customer_id, ''),
            updated_at = now()
        where id = v_unit_id;

        insert into public.inventory_allocations (
          organization_id, product_id, variant_id, unit_id,
          reference_type, reference_id, qty
        ) values (
          p_organization_id,
          v_product_id,
          case when v_mode = 'variant_serial' then v_variant_id else v_unit.variant_id end,
          v_unit_id,
          'sale', p_sale_id, 1
        );
        v_alloc_count := v_alloc_count + 1;
      end loop;

      if v_mode = 'variant_serial' then
        update public.product_variants
        set stock_qty = stock_qty - v_qty
        where id = v_variant_id;
      end if;

      continue;
    end if;

    raise exception 'unsupported inventory tracking mode % for product %', v_mode, v_product_id using errcode = '22023';
  end loop;

  return jsonb_build_object(
    'ok', true,
    'replayed', false,
    'allocations', v_alloc_count
  );
end;
$$;

revoke all on function public.allocate_sale_inventory(uuid, text, text, jsonb) from public, anon;
grant execute on function public.allocate_sale_inventory(uuid, text, text, jsonb) to authenticated;

comment on function public.allocate_sale_inventory(uuid, text, text, jsonb) is
  'Transactionally allocates variants, FEFO lots and serialized units to an already-saved sale. Aggregate products_base.stock_qty remains owned by the existing sale workflow, so this function never double-decrements product stock.';
