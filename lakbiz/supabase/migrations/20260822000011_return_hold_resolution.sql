-- LakBiz controlled customer-return hold resolution.
--
-- Physical return intake (00008) deliberately puts questionable advanced
-- inventory on inventory_return_holds. This migration adds the missing second
-- half of that lifecycle without weakening the original audit trail:
--
--   inspection hold -> approve for resale
--                   -> write off
--
-- The original sale, return document and return line remain immutable. The
-- resolution lives on the hold itself. Aggregate Product.stock_qty was already
-- increased when the merchandise physically came back; therefore approving for
-- resale restores ONLY the exact advanced identity, while write-off removes the
-- physical quantity from aggregate stock. That avoids double stock movement.
--
-- Pharmacy returns are never allowed through generic resale approval.

alter table public.inventory_return_holds
  add column if not exists note text;
alter table public.inventory_return_holds
  add column if not exists resolution text;
alter table public.inventory_return_holds
  add column if not exists resolved_by uuid;

-- Idempotent check constraint for the new terminal resolution field.
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'inventory_return_holds_resolution_check'
      and conrelid = 'public.inventory_return_holds'::regclass
  ) then
    alter table public.inventory_return_holds
      add constraint inventory_return_holds_resolution_check
      check (resolution is null or resolution in ('resale', 'write_off'));
  end if;
end $$;

create or replace function public.set_inventory_return_hold_disposition(
  p_organization_id uuid,
  p_hold_id uuid,
  p_disposition text,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_hold record;
begin
  if p_organization_id is null or p_hold_id is null then
    raise exception 'organization and hold id are required' using errcode = '22023';
  end if;
  if p_disposition not in ('inspection', 'quarantine', 'damaged') then
    raise exception 'invalid return-hold disposition' using errcode = '22023';
  end if;

  if not public.org_member_can_write_module(p_organization_id, 'stock')
     or not public.org_member_role_in(p_organization_id, array['owner','manager']) then
    raise exception 'owner or manager approval is required for return inspection' using errcode = '42501';
  end if;

  select * into v_hold
  from public.inventory_return_holds h
  where h.id = p_hold_id
    and h.organization_id = p_organization_id
  for update;

  if not found then
    raise exception 'return hold not found' using errcode = 'P0002';
  end if;
  if v_hold.released_at is not null then
    raise exception 'return hold has already been resolved' using errcode = '23514';
  end if;

  update public.inventory_return_holds
  set disposition = p_disposition,
      note = nullif(btrim(coalesce(p_note, '')), '')
  where id = p_hold_id;

  return jsonb_build_object(
    'ok', true,
    'hold_id', p_hold_id,
    'disposition', p_disposition
  );
end;
$$;

revoke all on function public.set_inventory_return_hold_disposition(uuid, uuid, text, text) from public, anon;
grant execute on function public.set_inventory_return_hold_disposition(uuid, uuid, text, text) to authenticated;

create or replace function public.resolve_inventory_return_hold(
  p_organization_id uuid,
  p_hold_id uuid,
  p_action text,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_hold record;
  v_product record;
  v_mode text;
  v_sector text;
  v_variant record;
  v_lot record;
  v_unit record;
  v_resolution text;
begin
  if p_organization_id is null or p_hold_id is null then
    raise exception 'organization and hold id are required' using errcode = '22023';
  end if;
  if p_action not in ('approve_resale', 'write_off') then
    raise exception 'invalid return-hold action' using errcode = '22023';
  end if;

  if not public.org_member_can_write_module(p_organization_id, 'stock')
     or not public.org_member_role_in(p_organization_id, array['owner','manager']) then
    raise exception 'owner or manager approval is required for return-hold resolution' using errcode = '42501';
  end if;

  select * into v_hold
  from public.inventory_return_holds h
  where h.id = p_hold_id
    and h.organization_id = p_organization_id
  for update;

  if not found then
    raise exception 'return hold not found' using errcode = 'P0002';
  end if;

  -- Idempotent terminal resolution: a network retry returns the stored result
  -- and never changes stock twice.
  if v_hold.released_at is not null then
    return jsonb_build_object(
      'ok', true,
      'replayed', true,
      'hold_id', v_hold.id,
      'resolution', v_hold.resolution,
      'released_at', v_hold.released_at
    );
  end if;

  select p.id, p.name, p.active, o.sector as sector_id
  into v_product
  from public.products_base p
  join public.organizations o on o.id = p.organization_id
  where p.id = v_hold.product_id
    and p.organization_id = p_organization_id
  for update of p;

  if not found then
    raise exception 'product not found' using errcode = 'P0002';
  end if;
  v_sector := coalesce(v_product.sector_id, '');

  select coalesce(ip.tracking_mode, 'simple')
  into v_mode
  from public.product_inventory_profiles ip
  where ip.organization_id = p_organization_id
    and ip.product_id = v_hold.product_id;
  v_mode := coalesce(v_mode, 'simple');

  if p_action = 'approve_resale' then
    -- Returned medicine requires a regulated pharmacy-specific process. The
    -- generic retail release action is intentionally incapable of bypassing it.
    if v_sector = 'pharmacy' then
      raise exception 'pharmacy customer returns cannot be released to sellable stock through generic return inspection'
        using errcode = '23514';
    end if;
    if not coalesce(v_product.active, false) then
      raise exception 'inactive product cannot be released to sellable stock'
        using errcode = '23514';
    end if;

    if v_mode = 'variant' then
      if v_hold.variant_id is null then
        raise exception 'exact variant identity is unavailable; keep the item on hold or write it off'
          using errcode = '23514';
      end if;

      select * into v_variant
      from public.product_variants v
      where v.id = v_hold.variant_id
        and v.organization_id = p_organization_id
        and v.product_id = v_hold.product_id
      for update;
      if not found or not coalesce(v_variant.active, false) then
        raise exception 'inactive or missing variant cannot be released to sellable stock'
          using errcode = '23514';
      end if;

      update public.product_variants
      set stock_qty = stock_qty + v_hold.qty,
          updated_at = now()
      where id = v_hold.variant_id;

    elsif v_mode in ('lot', 'variant_lot') then
      if v_hold.lot_id is null then
        raise exception 'exact batch identity is unavailable; keep the item on hold or write it off'
          using errcode = '23514';
      end if;

      select * into v_lot
      from public.inventory_lots l
      where l.id = v_hold.lot_id
        and l.organization_id = p_organization_id
        and l.product_id = v_hold.product_id
      for update;
      if not found then
        raise exception 'return batch not found' using errcode = 'P0002';
      end if;
      if v_lot.status in ('quarantine', 'expired', 'recalled', 'returned')
         or (v_lot.expiry_date is not null and v_lot.expiry_date < current_date) then
        raise exception 'unsafe, quarantined, recalled or expired batch cannot be released to sellable stock'
          using errcode = '23514';
      end if;

      update public.inventory_lots
      set qty_on_hand = qty_on_hand + v_hold.qty,
          status = 'available',
          updated_at = now()
      where id = v_hold.lot_id;

    elsif v_mode in ('serial', 'variant_serial') then
      if v_hold.unit_id is null or v_hold.qty <> 1 then
        raise exception 'exact serialized identity is unavailable; keep the item on hold or write it off'
          using errcode = '23514';
      end if;

      select * into v_unit
      from public.inventory_units u
      where u.id = v_hold.unit_id
        and u.organization_id = p_organization_id
        and u.product_id = v_hold.product_id
      for update;
      if not found then
        raise exception 'returned serialized unit not found' using errcode = 'P0002';
      end if;
      if v_unit.status <> 'returned' then
        raise exception 'serialized unit is not in returned inspection state'
          using errcode = '23514';
      end if;

      update public.inventory_units
      set status = 'available',
          sale_id = null,
          customer_id = null,
          updated_at = now()
      where id = v_hold.unit_id;

    else
      -- Simple-stock holds are intentionally impossible in 00008 because POS
      -- has no separate simple-stock inspection availability layer. A legacy
      -- advanced hold with missing identity must also remain non-sellable.
      raise exception 'this hold has no safe advanced identity to release for resale; write it off or keep it on hold'
        using errcode = '23514';
    end if;

    v_resolution := 'resale';
  else
    -- Aggregate stock was increased when the physical customer return arrived.
    -- A write-off removes that physical item from stock exactly once. Variant /
    -- lot sellable quantities were never restored while held, so they require
    -- no decrement here.
    update public.products_base
    set stock_qty = stock_qty - v_hold.qty,
        updated_at = now()
    where id = v_hold.product_id
      and organization_id = p_organization_id
      and stock_qty >= v_hold.qty;
    if not found then
      raise exception 'aggregate stock is lower than the held return quantity; write-off aborted'
        using errcode = '23514';
    end if;

    if v_hold.unit_id is not null then
      update public.inventory_units
      set status = 'written_off',
          updated_at = now()
      where id = v_hold.unit_id
        and organization_id = p_organization_id
        and product_id = v_hold.product_id
        and status in ('returned', 'damaged');
      if not found then
        raise exception 'serialized return is no longer in a write-off eligible state'
          using errcode = '23514';
      end if;
    end if;

    insert into public.stock_logs (
      id, organization_id, product_id, product_name, log_type, qty,
      note, log_date, user_id
    ) values (
      gen_random_uuid()::text,
      p_organization_id,
      v_hold.product_id,
      v_product.name,
      'write_off',
      v_hold.qty,
      'Customer return hold written off · ' || coalesce(nullif(btrim(p_note), ''), 'inspection disposition'),
      now(),
      auth.uid()
    );

    v_resolution := 'write_off';
  end if;

  update public.inventory_return_holds
  set resolution = v_resolution,
      note = coalesce(nullif(btrim(coalesce(p_note, '')), ''), note),
      resolved_by = auth.uid(),
      released_at = now()
  where id = p_hold_id;

  update public.organizations
  set sync_generation = sync_generation + 1
  where id = p_organization_id;

  return jsonb_build_object(
    'ok', true,
    'replayed', false,
    'hold_id', p_hold_id,
    'resolution', v_resolution,
    'released_at', now()
  );
end;
$$;

revoke all on function public.resolve_inventory_return_hold(uuid, uuid, text, text) from public, anon;
grant execute on function public.resolve_inventory_return_hold(uuid, uuid, text, text) to authenticated;

comment on function public.resolve_inventory_return_hold(uuid, uuid, text, text) is
  'Owner/manager controlled terminal resolution for advanced customer-return inspection holds. Approve-for-resale restores exact identity only; write-off removes aggregate physical stock. Pharmacy generic resale is blocked.';
