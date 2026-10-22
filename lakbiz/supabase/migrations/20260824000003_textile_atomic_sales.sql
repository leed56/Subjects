-- LakBiz Textile Phase 3: atomically finalize invoice/tenders and deduct the
-- exact physical rolls in one transaction.

create table if not exists public.textile_sale_allocations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  sale_id text not null references public.sales_base(id) on delete restrict,
  roll_id uuid not null references public.textile_rolls(id) on delete restrict,
  product_id text not null references public.products_base(id) on delete restrict,
  sale_mode text not null check (sale_mode in ('retail_cut','wholesale_cut','full_roll')),
  quantity numeric(14, 3) not null check (quantity > 0),
  length_unit text not null check (length_unit in ('metre','yard')),
  unit_price numeric(14, 2) not null check (unit_price >= 0),
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);

-- Prevent an earlier generic-inventory setup from competing with the dedicated
-- Textile roll ledger during the nested standard POS finalizer.
update public.product_inventory_profiles p set
  tracking_mode = 'simple', variant_axes = '[]'::jsonb,
  fefo_enabled = false, require_serial_on_sale = false, allow_negative_stock = false,
  updated_at = now()
from public.organizations o
where o.id = p.organization_id and o.sector = 'textile';
create index if not exists textile_sale_allocations_sale_idx
  on public.textile_sale_allocations(organization_id, sale_id);
create index if not exists textile_sale_allocations_roll_idx
  on public.textile_sale_allocations(organization_id, roll_id, created_at desc);

alter table public.textile_sale_allocations enable row level security;
drop policy if exists textile_sale_allocations_select_org on public.textile_sale_allocations;
create policy textile_sale_allocations_select_org on public.textile_sale_allocations
  for select to authenticated using (
    organization_id in (select organization_id from public.org_members where user_id = auth.uid())
  );
-- No client writes. The atomic finalizer owns allocation evidence.

-- From Phase 3 onward, a newly received roll contributes its usable measured
-- quantity to the compatibility aggregate used by Stock and legacy reports.
create or replace function public.textile_roll_receipt_movement()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_product_name text;
begin
  update public.products_base
  set stock_qty = stock_qty + new.remaining_length, updated_at = now()
  where id = new.product_id and organization_id = new.organization_id
  returning name into v_product_name;

  insert into public.stock_logs (
    id, organization_id, product_id, product_name, log_type, qty,
    note, log_date, user_id, created_at
  ) values (
    gen_random_uuid()::text, new.organization_id, new.product_id, v_product_name,
    'purchase', new.remaining_length,
    'Textile roll ' || new.roll_no || ' received', now(), new.created_by, now()
  );

  insert into public.textile_roll_movements (
    organization_id, roll_id, movement_type, quantity_delta, balance_after,
    reason, reference_type, reference_id, actor_user_id
  ) values (
    new.organization_id, new.id, 'receipt', new.remaining_length, new.remaining_length,
    case when new.damaged_length > 0
      then 'Physical roll received; damaged measure excluded from usable balance'
      else 'Physical roll received' end,
    case when new.source_reference is null then null else 'source_reference' end,
    new.source_reference, new.created_by
  );
  return new;
end;
$$;
revoke all on function public.textile_roll_receipt_movement() from public;

-- Block generic POS finalization for Textile. Only the wrapper below sets this
-- transaction-local flag after validating and locking physical rolls.
create or replace function public.guard_textile_sale_context()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if exists (
    select 1 from public.organizations o
    where o.id = new.organization_id and o.sector = 'textile'
  ) and coalesce(current_setting('app.textile_sale_context', true), '') <> 'on' then
    raise exception 'Textile sales must use the physical-roll checkout' using errcode = '23514';
  end if;
  return new;
end;
$$;
revoke all on function public.guard_textile_sale_context() from public;
drop trigger if exists guard_textile_sale_context_trigger on public.sales_base;
create trigger guard_textile_sale_context_trigger
  before insert on public.sales_base
  for each row execute function public.guard_textile_sale_context();

create or replace function public.finalize_textile_sale(
  p_organization_id uuid,
  p_sale_id text,
  p_customer_id text default null,
  p_customer_name text default null,
  p_discount numeric default 0,
  p_allocations jsonb default '[]'::jsonb,
  p_tenders jsonb default '[]'::jsonb
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_existing public.sales_base%rowtype;
  v_line jsonb;
  v_roll public.textile_rolls%rowtype;
  v_product public.products_base%rowtype;
  v_qty numeric;
  v_price numeric;
  v_mode text;
  v_available numeric;
  v_lines jsonb := '[]'::jsonb;
  v_result jsonb;
  v_order integer := 0;
  v_product_id text;
  v_expected_price numeric;
  v_customer_price numeric;
  v_wholesale_price numeric;
  v_wholesale_min numeric;
  v_can_override_price boolean;
begin
  if not public.org_member_can_write_module(p_organization_id, 'sales')
     or not public.org_member_role_in(p_organization_id, array['owner','manager','data_entry','cashier']) then
    raise exception 'Permission denied for Textile checkout' using errcode = '42501';
  end if;
  if not exists (select 1 from public.organizations where id = p_organization_id and sector = 'textile') then
    raise exception 'Organization is not provisioned for Textile' using errcode = '23514';
  end if;
  v_can_override_price := public.org_member_role_in(p_organization_id, array['owner','manager']);

  select * into v_existing from public.sales_base where id = p_sale_id;
  if found then
    if v_existing.organization_id is distinct from p_organization_id then
      raise exception 'Sale id already belongs to another organization' using errcode = '23505';
    end if;
    return public.finalize_sale_with_private_tenders_v3(
      p_organization_id, p_sale_id, p_customer_id, p_customer_name,
      p_discount, '[]'::jsonb, p_tenders
    );
  end if;

  if jsonb_typeof(coalesce(p_allocations, '[]'::jsonb)) <> 'array'
     or jsonb_array_length(coalesce(p_allocations, '[]'::jsonb)) = 0 then
    raise exception 'At least one roll allocation is required' using errcode = '22023';
  end if;

  -- Lock and validate every physical roll before any invoice/tender write.
  for v_line in select value from jsonb_array_elements(p_allocations)
  loop
    v_qty := round((v_line->>'quantity')::numeric, 3);
    v_price := round((v_line->>'unit_price')::numeric, 2);
    v_mode := nullif(btrim(v_line->>'sale_mode'), '');
    if v_qty <= 0 or v_price < 0 then raise exception 'Quantity and price are invalid'; end if;
    if v_mode not in ('retail_cut','wholesale_cut','full_roll') then raise exception 'Invalid Textile sale mode'; end if;

    select * into v_roll from public.textile_rolls
    where id = (v_line->>'roll_id')::uuid and organization_id = p_organization_id
    for update;
    if not found then raise exception 'Roll not found or inaccessible'; end if;
    if v_roll.status in ('quarantined','returned','exhausted') then
      raise exception 'Roll % is not sellable', v_roll.roll_no;
    end if;
    v_available := v_roll.remaining_length - v_roll.reserved_length;
    if v_qty > v_available then raise exception 'Roll % has only % available', v_roll.roll_no, v_available; end if;
    if v_mode = 'full_roll' and abs(v_qty - v_available) > 0.0005 then
      raise exception 'Full-roll sale must use the entire available balance of roll %', v_roll.roll_no;
    end if;
    if v_mode = 'full_roll' and v_roll.reserved_length > 0 then
      raise exception 'Roll % has reserved material and cannot be sold as a full roll', v_roll.roll_no;
    end if;

    select * into v_product from public.products_base
    where id = v_roll.product_id and organization_id = p_organization_id;
    if not found then raise exception 'Fabric product not found'; end if;

    -- Client UI convenience is not a permission boundary. Cashier/data-entry
    -- prices must equal the server-resolved contract/tier/retail price.
    if not v_can_override_price then
      v_customer_price := null;
      if p_customer_id is not null then
        select cpp.price into v_customer_price
        from public.customer_product_prices cpp
        join public.customers c
          on c.id = cpp.customer_id and c.organization_id = cpp.organization_id
        where cpp.organization_id = p_organization_id
          and cpp.customer_id = p_customer_id
          and cpp.product_id = v_product.id
          and c.contact_type = 'company';
      end if;
      v_wholesale_price := case
        when nullif(v_product.custom_fields->>'wholesalePrice', '') is null then null
        else (v_product.custom_fields->>'wholesalePrice')::numeric end;
      v_wholesale_min := case
        when nullif(v_product.custom_fields->>'wholesaleMinQty', '') is null then 0
        else (v_product.custom_fields->>'wholesaleMinQty')::numeric end;
      v_expected_price := case
        when v_customer_price is not null then v_customer_price
        when v_mode = 'wholesale_cut' and v_wholesale_price is not null and v_qty >= v_wholesale_min
          then v_wholesale_price
        when v_mode = 'full_roll' and v_wholesale_price is not null and v_qty >= v_wholesale_min
          then v_wholesale_price
        else v_product.sell_price
      end;
      if abs(v_price - round(v_expected_price, 2)) > 0.005 then
        raise exception 'Price override requires owner or manager approval';
      end if;
    end if;

    v_lines := v_lines || jsonb_build_array(jsonb_build_object(
      'product_id', v_product.id,
      'qty', v_qty,
      'unit_price', v_price,
      'line_order', v_order
    ));
    v_order := v_order + 1;
  end loop;

  -- Physical rolls are authoritative. Reconcile the compatibility aggregate
  -- immediately before the standard sale finalizer checks and deducts it.
  for v_product_id in
    select distinct r.product_id
    from public.textile_rolls r
    join jsonb_array_elements(p_allocations) a
      on r.id = (a.value->>'roll_id')::uuid
    where r.organization_id = p_organization_id
  loop
    update public.products_base p set
      stock_qty = coalesce((
        select sum(r.remaining_length - r.reserved_length)
        from public.textile_rolls r
        where r.organization_id = p_organization_id
          and r.product_id = v_product_id
          and r.status not in ('quarantined','returned','exhausted')
      ), 0),
      updated_at = now()
    where p.id = v_product_id and p.organization_id = p_organization_id;
  end loop;

  perform set_config('app.textile_sale_context', 'on', true);
  v_result := public.finalize_sale_with_private_tenders_v3(
    p_organization_id, p_sale_id, p_customer_id, p_customer_name,
    p_discount, v_lines, p_tenders
  );

  v_order := 0;
  for v_line in select value from jsonb_array_elements(p_allocations)
  loop
    v_qty := round((v_line->>'quantity')::numeric, 3);
    v_price := round((v_line->>'unit_price')::numeric, 2);
    v_mode := btrim(v_line->>'sale_mode');
    select * into v_roll from public.textile_rolls
    where id = (v_line->>'roll_id')::uuid and organization_id = p_organization_id
    for update;

    update public.textile_rolls set
      remaining_length = remaining_length - v_qty,
      status = case when remaining_length - v_qty <= 0.0005 then 'exhausted' else 'opened' end,
      updated_at = now()
    where id = v_roll.id
      and remaining_length - reserved_length >= v_qty
    returning * into v_roll;
    if not found then raise exception 'Roll balance changed during checkout'; end if;

    insert into public.textile_sale_allocations (
      organization_id, sale_id, roll_id, product_id, sale_mode,
      quantity, length_unit, unit_price, created_by
    ) values (
      p_organization_id, p_sale_id, v_roll.id, v_roll.product_id, v_mode,
      v_qty, v_roll.length_unit, v_price, auth.uid()
    );
    insert into public.textile_roll_movements (
      organization_id, roll_id, movement_type, quantity_delta, balance_after,
      reason, reference_type, reference_id, actor_user_id
    ) values (
      p_organization_id, v_roll.id, 'sale', -v_qty, v_roll.remaining_length,
      replace(v_mode, '_', ' ') || ' sale', 'sale', p_sale_id, auth.uid()
    );
    v_order := v_order + 1;
  end loop;

  return v_result || jsonb_build_object('textile_allocations', jsonb_array_length(p_allocations));
end;
$$;

revoke all on function public.finalize_textile_sale(uuid,text,text,text,numeric,jsonb,jsonb) from public, anon;
grant execute on function public.finalize_textile_sale(uuid,text,text,text,numeric,jsonb,jsonb) to authenticated;

comment on function public.finalize_textile_sale(uuid,text,text,text,numeric,jsonb,jsonb) is
  'Atomically locks physical rolls, validates full/cut availability, finalizes invoice and tenders, then writes roll deductions and immutable allocation evidence.';
