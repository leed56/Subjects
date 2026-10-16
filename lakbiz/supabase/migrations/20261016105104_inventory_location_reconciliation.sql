-- Read-only reconciliation of existing quantity authority against physical
-- custody. No repairs, enablement or source stock rewrites are performed.
create or replace function public.get_inventory_location_reconciliation(
  p_organization_id uuid,
  p_product_id text default null
)
returns table (
  product_id text, identity_kind text, variant_id uuid, lot_id uuid, unit_id uuid,
  source_qty numeric, located_qty numeric, transit_qty numeric, difference numeric
)
language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.uid() is null or not public.org_member_role_in(
    p_organization_id, array['owner','manager','data_entry']
  ) then
    raise exception 'Inventory reconciliation requires an organization stock operator' using errcode = '42501';
  end if;
  return query
  with products as (
    select p.id, p.stock_qty, coalesce(profile.tracking_mode, 'simple') as mode
    from public.products_base p
    left join public.product_inventory_profiles profile
      on profile.product_id = p.id and profile.organization_id = p.organization_id
    where p.organization_id = p_organization_id
      and (p_product_id is null or p.id = p_product_id)
  ), source as (
    select p.id as pid, 'simple'::text as kind,
      null::uuid as vid, null::uuid as lid, null::uuid as uid, p.stock_qty as qty
    from products p where p.mode = 'simple'
    union all
    select v.product_id, 'variant', v.id, null::uuid, null::uuid, v.stock_qty
    from public.product_variants v join products p on p.id = v.product_id
    where v.organization_id = p_organization_id and p.mode = 'variant'
    union all
    select l.product_id, 'lot', l.variant_id, l.id, null::uuid, l.qty_on_hand
    from public.inventory_lots l join products p on p.id = l.product_id
    where l.organization_id = p_organization_id and p.mode in ('lot','variant_lot')
    union all
    select u.product_id, 'unit', u.variant_id, u.lot_id, u.id,
      case when u.status not in ('sold','written_off') then 1 else 0 end::numeric
    from public.inventory_units u join products p on p.id = u.product_id
    where u.organization_id = p_organization_id and p.mode in ('serial','variant_serial')
  ), located as (
    select b.product_id as pid,
      case when b.lot_id is not null then 'lot' when b.variant_id is not null then 'variant' else 'simple' end as kind,
      b.variant_id as vid, b.lot_id as lid, null::uuid as uid, sum(b.qty_on_hand) as qty
    from public.inventory_location_balances b
    join products p on p.id = b.product_id
    join public.inventory_locations location
      on location.id = b.location_id and location.organization_id = b.organization_id
    where b.organization_id = p_organization_id
    group by b.product_id, b.variant_id, b.lot_id
    union all
    select u.product_id, 'unit', u.variant_id, u.lot_id, u.id, 1::numeric
    from public.inventory_units u join products p on p.id = u.product_id
    join public.inventory_locations location
      on location.id = u.location_id and location.organization_id = u.organization_id
    where u.organization_id = p_organization_id and p.mode in ('serial','variant_serial')
      and u.status not in ('sold','written_off') and u.custody_status = 'available'
  ), transit as (
    select line.product_id as pid,
      case when line.unit_id is not null then 'unit' when line.lot_id is not null then 'lot'
        when line.variant_id is not null then 'variant' else 'simple' end as kind,
      line.variant_id as vid, line.lot_id as lid, line.unit_id as uid,
      sum(line.dispatched_qty - line.received_qty) as qty
    from public.inventory_transfer_lines line
    join public.inventory_transfers transfer
      on transfer.id = line.transfer_id and transfer.organization_id = line.organization_id
    join products p on p.id = line.product_id
    where line.organization_id = p_organization_id and transfer.status in ('dispatched','in_transit')
    group by line.product_id, line.variant_id, line.lot_id, line.unit_id
  ), identities as (
    select pid, kind, vid, lid, uid from source
    union select pid, kind, vid, lid, uid from located
    union select pid, kind, vid, lid, uid from transit
  ), rows as (
    select k.pid, k.kind, k.vid, k.lid, k.uid,
      coalesce(s.qty, 0) as sq, coalesce(l.qty, 0) as lq, coalesce(t.qty, 0) as tq
    from identities k
    left join source s on s.pid = k.pid and s.kind = k.kind
      and s.vid is not distinct from k.vid and s.lid is not distinct from k.lid and s.uid is not distinct from k.uid
    left join located l on l.pid = k.pid and l.kind = k.kind
      and l.vid is not distinct from k.vid and l.lid is not distinct from k.lid and l.uid is not distinct from k.uid
    left join transit t on t.pid = k.pid and t.kind = k.kind
      and t.vid is not distinct from k.vid and t.lid is not distinct from k.lid and t.uid is not distinct from k.uid
  )
  select r.pid, r.kind, r.vid, r.lid, r.uid, r.sq, r.lq, r.tq, r.sq - r.lq - r.tq from rows r
  union all
  select p.id, 'product_total'::text, null::uuid, null::uuid, null::uuid,
    p.stock_qty, coalesce(sum(r.lq),0), coalesce(sum(r.tq),0),
    p.stock_qty - coalesce(sum(r.lq + r.tq),0)
  from products p left join rows r on r.pid = p.id
  group by p.id, p.stock_qty;
end;
$$;
revoke all on function public.get_inventory_location_reconciliation(uuid,text) from public, anon;
grant execute on function public.get_inventory_location_reconciliation(uuid,text) to authenticated;

-- Keep the already-tested movement implementation private. The public entry
-- point checks stock consistency while holding the same transfer/product locks.
create schema if not exists inventory_internal;
revoke all on schema inventory_internal from public, anon, authenticated;
alter function public.dispatch_inventory_transfer(uuid) set schema inventory_internal;
revoke all on function inventory_internal.dispatch_inventory_transfer(uuid) from public, anon, authenticated;

create function public.dispatch_inventory_transfer(p_transfer_id uuid)
returns public.inventory_transfers
language plpgsql security definer set search_path = '' as $$
declare
  transfer_row public.inventory_transfers%rowtype;
  product_row record;
begin
  select * into transfer_row from public.inventory_transfers where id = p_transfer_id for update;
  if not found or auth.uid() is null
    or not public.org_member_can_write_module(transfer_row.organization_id, 'stock')
    or not public.org_member_role_in(transfer_row.organization_id, array['owner','manager','data_entry']) then
    raise exception 'Transfer not found or inaccessible' using errcode = '42501';
  end if;
  for product_row in
    select p.id from public.products_base p
    where p.organization_id = transfer_row.organization_id and p.id in (
      select line.product_id from public.inventory_transfer_lines line where line.transfer_id = transfer_row.id
    ) order by p.id for update
  loop
    if exists (
      select 1 from public.get_inventory_location_reconciliation(transfer_row.organization_id, product_row.id) r
      where r.difference <> 0
    ) then
      raise exception 'Stock custody is out of balance for product %. Reconcile before dispatch.', product_row.id;
    end if;
  end loop;
  return inventory_internal.dispatch_inventory_transfer(p_transfer_id);
end;
$$;
revoke all on function public.dispatch_inventory_transfer(uuid) from public, anon;
grant execute on function public.dispatch_inventory_transfer(uuid) to authenticated;
