-- LakBiz Phase 19 follow-up to 20250712000001_role_aware_write_rls.sql
-- (that migration is already merged/applied — this layers a correction on
-- top rather than rewriting it, since rewriting a merged migration file
-- would desync it from what actually ran).
--
-- Disclosed gap: job_items_view_update already clamps
-- unit_price/line_total/customer_price to the existing row's value for a
-- non-financial role via `case when can_see_org_financials(...) then
-- new.X else job_items_base.X end`. job_items_view_insert had no
-- equivalent — a non-financial role with job_items write access
-- (data_entry, technician) could set an arbitrary cost on a brand-new
-- job item, even though they can't read it back afterward.
--
-- First attempt at this fix (applied and then corrected within the same
-- session before ever reaching this file) simply clamped
-- unit_price/line_total to 0 for any non-financial-role insert. That
-- would have been a real regression: data_entry and technician are both
-- designed, frequent users of the "add a stock part to this job" flow,
-- and stock-sourced parts DO have a real, legitimate cost
-- (products_base.buy_price) that must be recorded for job costing to be
-- accurate — zeroing it out would have silently corrupted every
-- non-owner/manager-added stock part's cost.
--
-- Correct fix: for source='stock', never trust client-supplied
-- unit_price at all, for ANY role — derive it server-side from
-- products_base.buy_price (the authoritative, frozen-at-use-time cost).
-- This is safe for a non-financial role to trigger (they never see the
-- resolved value; SELECT stays masked as always) and is a stronger form
-- of "do not calculate historical jobs using today's part cost" than
-- trusting a client-computed snapshot. For source in ('purchased',
-- 'customer_supplied') — genuinely free-text, user-entered costs, only
-- meaningful/enterable via the UI for financial roles — the
-- can_see_org_financials clamp (0/null fallback) still applies.
-- line_total is now always server-computed from the resolved unit_price
-- (qty * unit_price, rounded to 2dp) so it can never drift from it.
--
-- UPDATE is deliberately left as-is: re-deriving a stock item's price
-- from today's products_base.buy_price on every edit would itself
-- violate "do not calculate historical jobs using today's part cost" in
-- the other direction (silently repricing an already-frozen snapshot
-- just because qty or notes changed). Preserving the existing value for
-- non-financial edits, and trusting the financial role's explicit
-- correction, is the correct behaviour for UPDATE.

create or replace function public.job_items_view_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_unit_price numeric(14,2);
  v_line_total numeric(14,2);
begin
  if not (public.org_member_can_write_module(new.organization_id, 'ac_jobs')
      and public.org_member_role_in(new.organization_id, array['owner','manager','data_entry','technician'])) then
    raise exception 'permission denied for table job_items_base' using errcode = '42501';
  end if;

  if new.source = 'stock' and new.product_id is not null then
    select p.buy_price into v_unit_price
    from public.products_base p
    where p.id = new.product_id and p.organization_id = new.organization_id;
    v_unit_price := coalesce(v_unit_price, 0);
  elsif public.can_see_org_financials(new.organization_id) then
    v_unit_price := coalesce(new.unit_price, 0);
  else
    v_unit_price := 0;
  end if;

  v_line_total := round(coalesce(new.qty, 0) * v_unit_price, 2);

  insert into public.job_items_base (
    id, organization_id, job_id, item_type, name, qty, unit_price, line_total,
    created_at, updated_at, source, product_id, supplier_id, purchase_ref, purchase_date,
    customer_price, technician_id
  ) values (
    new.id, new.organization_id, new.job_id, new.item_type, new.name, new.qty,
    v_unit_price, v_line_total,
    coalesce(new.created_at, now()), coalesce(new.updated_at, now()), new.source, new.product_id, new.supplier_id,
    new.purchase_ref, new.purchase_date,
    case when public.can_see_org_financials(new.organization_id) then new.customer_price else null end,
    new.technician_id
  );
  return new;
end;
$$;
