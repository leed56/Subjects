-- Blocked-batch disposition — pharmacy operations UI audit, section 4.5.
--
-- Before this migration, a quarantined/recalled/expired inventory_lots row
-- had no next step: /stock/advanced showed its status as a read-only badge
-- and nothing else. The Batch & Expiry Control panel's "Blocked batches"
-- count (sector-command-center.tsx, retail-intelligence.ts) just sat there.
--
-- This adds the second half of that lifecycle, modeled directly on
-- 20260822000011_return_hold_resolution.sql's resolve_inventory_return_hold
-- (same locking, same idempotent-terminal-action shape, same
-- org_member_can_write_module/org_member_role_in authorization):
--
--   quarantine / recalled / expired batch -> dispose (write off)
--                                          -> return to supplier
--
-- Deliberately does NOT add a "release back to available" action — nothing
-- in the pharmacy dashboard audit asked for reversing a quarantine/recall,
-- and doing that safely (e.g. after a false-alarm recall) is a distinct,
-- more sensitive decision than disposing of a batch that should not be
-- sold. Out of scope here on purpose.
--
-- 'disposed' and 'supplier_returned' are new terminal lot statuses — reusing
-- the existing 'returned' status would have collided with its current
-- meaning in sector-command-center.tsx/retail-intelligence.ts (a CUSTOMER
-- return pending inspection, a different flow entirely from returning a
-- batch to the supplier who sold it to us).

alter table public.inventory_lots drop constraint if exists inventory_lots_status_check;
alter table public.inventory_lots add constraint inventory_lots_status_check
  check (status in (
    'available', 'quarantine', 'expired', 'depleted', 'returned', 'recalled',
    'disposed', 'supplier_returned'
  ));

create or replace function public.resolve_blocked_lot(
  p_organization_id uuid,
  p_lot_id uuid,
  p_action text,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_lot record;
  v_product record;
  v_new_status text;
  v_log_type text;
begin
  if p_organization_id is null or p_lot_id is null then
    raise exception 'organization and lot id are required' using errcode = '22023';
  end if;
  if p_action not in ('dispose', 'return_to_supplier') then
    raise exception 'invalid blocked-lot action' using errcode = '22023';
  end if;

  if not public.org_member_can_write_module(p_organization_id, 'stock')
     or not public.org_member_role_in(p_organization_id, array['owner','manager']) then
    raise exception 'owner or manager approval is required to dispose of a blocked batch' using errcode = '42501';
  end if;

  select * into v_lot
  from public.inventory_lots l
  where l.id = p_lot_id
    and l.organization_id = p_organization_id
  for update;

  if not found then
    raise exception 'batch not found' using errcode = 'P0002';
  end if;

  -- Idempotent terminal action: a network retry returns the stored result
  -- and never moves stock twice — same shape as resolve_inventory_return_hold.
  if v_lot.status in ('disposed', 'supplier_returned') then
    return jsonb_build_object(
      'ok', true,
      'replayed', true,
      'lot_id', v_lot.id,
      'status', v_lot.status
    );
  end if;

  if v_lot.status not in ('quarantine', 'expired', 'recalled')
     and not (v_lot.expiry_date is not null and v_lot.expiry_date < current_date) then
    raise exception 'only a quarantined, recalled or expired batch can be dispositioned this way'
      using errcode = '23514';
  end if;

  select p.id, p.name into v_product
  from public.products_base p
  where p.id = v_lot.product_id
    and p.organization_id = p_organization_id
  for update of p;

  if not found then
    raise exception 'product not found' using errcode = 'P0002';
  end if;

  if p_action = 'dispose' then
    v_new_status := 'disposed';
    v_log_type := 'write_off';
  else
    v_new_status := 'supplier_returned';
    v_log_type := 'supplier_return';
  end if;

  -- Aggregate stock_qty is decremented by exactly this batch's remaining
  -- quantity — the same "physical quantity leaves aggregate stock exactly
  -- once" rule resolve_inventory_return_hold's write-off branch follows.
  if v_lot.qty_on_hand > 0 then
    update public.products_base
    set stock_qty = greatest(0, stock_qty - v_lot.qty_on_hand),
        updated_at = now()
    where id = v_lot.product_id
      and organization_id = p_organization_id;

    insert into public.stock_logs (
      id, organization_id, product_id, product_name, log_type, qty,
      note, log_date, user_id
    ) values (
      gen_random_uuid()::text,
      p_organization_id,
      v_lot.product_id,
      v_product.name,
      v_log_type,
      v_lot.qty_on_hand,
      'Batch ' || v_lot.batch_no || ' (' || v_lot.status || ') ' ||
        case when p_action = 'dispose' then 'disposed' else 'returned to supplier' end ||
        coalesce(' · ' || nullif(btrim(p_note), ''), ''),
      now(),
      auth.uid()
    );
  end if;

  update public.inventory_lots
  set status = v_new_status,
      qty_on_hand = 0,
      updated_at = now()
  where id = p_lot_id;

  update public.organizations
  set sync_generation = sync_generation + 1
  where id = p_organization_id;

  return jsonb_build_object(
    'ok', true,
    'replayed', false,
    'lot_id', p_lot_id,
    'status', v_new_status
  );
end;
$$;

revoke all on function public.resolve_blocked_lot(uuid, uuid, text, text) from public, anon;
grant execute on function public.resolve_blocked_lot(uuid, uuid, text, text) to authenticated;

comment on function public.resolve_blocked_lot(uuid, uuid, text, text) is
  'Owner/manager controlled terminal disposition for a quarantined, recalled or expired batch: dispose (write off) or return to supplier. Zeroes the batch''s qty_on_hand and decrements aggregate product stock exactly once; does not support releasing a batch back to available.';
