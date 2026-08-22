-- LakBiz advanced inventory core — vertical depth for pharmacy, mobile/electronics,
-- footwear/fashion and other Sri Lankan retail templates.
--
-- This migration is deliberately additive. Existing products/sales/stock routes
-- and the local-first AppData model remain valid. New tables provide the deeper
-- identity layer required by specific sectors without changing existing ids or
-- rewriting historical stock movements.
--
-- Security design:
--   * operational identity/availability rows are readable by org members and
--     writable only by normal Stock roles;
--   * internal unit/lot cost is physically separated into owner-only tables,
--     rather than relying on UI hiding;
--   * no manager/data-entry/cashier can query cost tables directly.
--
-- The next integration phase can allocate sale/job lines against these records
-- transactionally. Until a product is given a non-'simple' profile, current
-- stock behavior is unchanged.

-- ─────────────────────────────────────────────────────────────────────────────
-- Product tracking profile
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.product_inventory_profiles (
  product_id text primary key references public.products_base(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  tracking_mode text not null default 'simple'
    check (tracking_mode in ('simple', 'lot', 'serial', 'variant', 'variant_serial', 'variant_lot')),
  variant_axes jsonb not null default '[]'::jsonb,
  fefo_enabled boolean not null default false,
  require_serial_on_sale boolean not null default false,
  allow_negative_stock boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists product_inventory_profiles_org_idx
  on public.product_inventory_profiles(organization_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- Variants — e.g. footwear Style X / Black / EU 42, phone storage/colour.
-- Each variant can carry its own SKU/barcode, sell-price override and stock.
-- Internal purchase cost stays at the normal product/lot/unit financial layer.
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.product_variants (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  product_id text not null references public.products_base(id) on delete cascade,
  label text not null,
  sku text,
  barcode text,
  attributes jsonb not null default '{}'::jsonb,
  stock_qty numeric(14, 3) not null default 0 check (stock_qty >= 0),
  reorder_level numeric(14, 3),
  sell_price_override numeric(14, 2),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists product_variants_org_product_idx
  on public.product_variants(organization_id, product_id);
create unique index if not exists product_variants_org_sku_uq
  on public.product_variants(organization_id, sku) where sku is not null and sku <> '';
create unique index if not exists product_variants_org_barcode_uq
  on public.product_variants(organization_id, barcode) where barcode is not null and barcode <> '';

-- ─────────────────────────────────────────────────────────────────────────────
-- Lots/batches — pharmacy/grocery expiry-aware stock. Quantity lives at lot
-- level so FEFO allocation can select the earliest valid expiry later.
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.inventory_lots (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  product_id text not null references public.products_base(id) on delete cascade,
  variant_id uuid references public.product_variants(id) on delete cascade,
  batch_no text not null,
  manufactured_date date,
  expiry_date date,
  received_date date not null default current_date,
  supplier_id text references public.suppliers(id) on delete set null,
  qty_received numeric(14, 3) not null default 0 check (qty_received >= 0),
  qty_on_hand numeric(14, 3) not null default 0 check (qty_on_hand >= 0),
  status text not null default 'available'
    check (status in ('available', 'quarantine', 'expired', 'depleted', 'returned', 'recalled')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists inventory_lots_org_product_idx
  on public.inventory_lots(organization_id, product_id, expiry_date);
create index if not exists inventory_lots_fefo_idx
  on public.inventory_lots(organization_id, product_id, status, expiry_date, received_date);
create unique index if not exists inventory_lots_batch_uq
  on public.inventory_lots(organization_id, product_id, coalesce(variant_id::text, ''), batch_no);

-- Lot costs are OWNER ONLY. Keeping cost in a separate relation is stronger
-- than exposing the operational row and remembering to mask one column.
create table if not exists public.inventory_lot_costs (
  lot_id uuid primary key references public.inventory_lots(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  unit_cost numeric(14, 2) not null default 0 check (unit_cost >= 0),
  landed_cost numeric(14, 2),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists inventory_lot_costs_org_idx on public.inventory_lot_costs(organization_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- Individually serialized units — phones/IMEI, electronics serials, selected
-- HVAC units. A physical unit is one row; availability is explicit.
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.inventory_units (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  product_id text not null references public.products_base(id) on delete cascade,
  variant_id uuid references public.product_variants(id) on delete set null,
  lot_id uuid references public.inventory_lots(id) on delete set null,
  serial_no text,
  imei text,
  secondary_imei text,
  barcode text,
  warranty_expiry date,
  status text not null default 'available'
    check (status in ('available', 'reserved', 'sold', 'service', 'returned', 'damaged', 'written_off')),
  sale_id text,
  customer_id text references public.customers(id) on delete set null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (serial_no is not null or imei is not null or barcode is not null)
);
create index if not exists inventory_units_org_product_idx
  on public.inventory_units(organization_id, product_id, status);
create unique index if not exists inventory_units_org_serial_uq
  on public.inventory_units(organization_id, serial_no) where serial_no is not null and serial_no <> '';
create unique index if not exists inventory_units_org_imei_uq
  on public.inventory_units(organization_id, imei) where imei is not null and imei <> '';
create unique index if not exists inventory_units_org_secondary_imei_uq
  on public.inventory_units(organization_id, secondary_imei) where secondary_imei is not null and secondary_imei <> '';

create table if not exists public.inventory_unit_costs (
  unit_id uuid primary key references public.inventory_units(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  unit_cost numeric(14, 2) not null default 0 check (unit_cost >= 0),
  landed_cost numeric(14, 2),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists inventory_unit_costs_org_idx on public.inventory_unit_costs(organization_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- Allocation audit trail. Future POS/job integration writes exactly which
-- variant/lot/unit fulfilled a sale or job-material line; historical identity
-- remains recoverable even after the unit is sold or a lot is depleted.
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.inventory_allocations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  product_id text not null references public.products_base(id) on delete cascade,
  variant_id uuid references public.product_variants(id) on delete set null,
  lot_id uuid references public.inventory_lots(id) on delete set null,
  unit_id uuid references public.inventory_units(id) on delete set null,
  reference_type text not null check (reference_type in ('sale', 'job', 'return', 'adjustment')),
  reference_id text not null,
  qty numeric(14, 3) not null check (qty > 0),
  created_at timestamptz not null default now()
);
create index if not exists inventory_allocations_reference_idx
  on public.inventory_allocations(organization_id, reference_type, reference_id);
create index if not exists inventory_allocations_product_idx
  on public.inventory_allocations(organization_id, product_id, created_at desc);

-- ─────────────────────────────────────────────────────────────────────────────
-- RLS helpers / policies
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.product_inventory_profiles enable row level security;
alter table public.product_variants enable row level security;
alter table public.inventory_lots enable row level security;
alter table public.inventory_lot_costs enable row level security;
alter table public.inventory_units enable row level security;
alter table public.inventory_unit_costs enable row level security;
alter table public.inventory_allocations enable row level security;

-- Operational inventory tables: any org member may read. Only the normal
-- stock-operating roles may write, and only when Stock is enabled for the org.
do $$
declare
  t text;
begin
  foreach t in array array[
    'product_inventory_profiles',
    'product_variants',
    'inventory_lots',
    'inventory_units',
    'inventory_allocations'
  ] loop
    execute format('drop policy if exists %I on public.%I', t || '_select_org', t);
    execute format(
      'create policy %I on public.%I for select to authenticated using (
        organization_id in (select organization_id from public.org_members where user_id = auth.uid())
      )',
      t || '_select_org', t
    );

    execute format('drop policy if exists %I on public.%I', t || '_insert_stock_roles', t);
    execute format(
      'create policy %I on public.%I for insert to authenticated with check (
        public.org_member_can_write_module(organization_id, ''stock'')
        and public.org_member_role_in(organization_id, array[''owner'',''manager'',''data_entry'',''cashier''])
      )',
      t || '_insert_stock_roles', t
    );

    execute format('drop policy if exists %I on public.%I', t || '_update_stock_roles', t);
    execute format(
      'create policy %I on public.%I for update to authenticated using (
        public.org_member_can_write_module(organization_id, ''stock'')
        and public.org_member_role_in(organization_id, array[''owner'',''manager'',''data_entry'',''cashier''])
      ) with check (
        public.org_member_can_write_module(organization_id, ''stock'')
        and public.org_member_role_in(organization_id, array[''owner'',''manager'',''data_entry'',''cashier''])
      )',
      t || '_update_stock_roles', t
    );

    execute format('drop policy if exists %I on public.%I', t || '_delete_stock_roles', t);
    execute format(
      'create policy %I on public.%I for delete to authenticated using (
        public.org_member_can_write_module(organization_id, ''stock'')
        and public.org_member_role_in(organization_id, array[''owner'',''manager'',''data_entry'',''cashier''])
      )',
      t || '_delete_stock_roles', t
    );
  end loop;
end $$;

-- Cost relations: owner-only for both reads and writes.
do $$
declare
  t text;
begin
  foreach t in array array['inventory_lot_costs', 'inventory_unit_costs'] loop
    execute format('drop policy if exists %I on public.%I', t || '_select_owner', t);
    execute format(
      'create policy %I on public.%I for select to authenticated using (
        public.can_see_org_financials(organization_id)
      )',
      t || '_select_owner', t
    );
    execute format('drop policy if exists %I on public.%I', t || '_insert_owner', t);
    execute format(
      'create policy %I on public.%I for insert to authenticated with check (
        public.can_see_org_financials(organization_id)
      )',
      t || '_insert_owner', t
    );
    execute format('drop policy if exists %I on public.%I', t || '_update_owner', t);
    execute format(
      'create policy %I on public.%I for update to authenticated using (
        public.can_see_org_financials(organization_id)
      ) with check (
        public.can_see_org_financials(organization_id)
      )',
      t || '_update_owner', t
    );
    execute format('drop policy if exists %I on public.%I', t || '_delete_owner', t);
    execute format(
      'create policy %I on public.%I for delete to authenticated using (
        public.can_see_org_financials(organization_id)
      )',
      t || '_delete_owner', t
    );
  end loop;
end $$;

grant select, insert, update, delete on public.product_inventory_profiles to authenticated;
grant select, insert, update, delete on public.product_variants to authenticated;
grant select, insert, update, delete on public.inventory_lots to authenticated;
grant select, insert, update, delete on public.inventory_lot_costs to authenticated;
grant select, insert, update, delete on public.inventory_units to authenticated;
grant select, insert, update, delete on public.inventory_unit_costs to authenticated;
grant select, insert, update, delete on public.inventory_allocations to authenticated;

-- Reuse the project's standard updated_at trigger helper.
drop trigger if exists product_inventory_profiles_updated_at on public.product_inventory_profiles;
create trigger product_inventory_profiles_updated_at before update on public.product_inventory_profiles
  for each row execute function public.set_updated_at();
drop trigger if exists product_variants_updated_at on public.product_variants;
create trigger product_variants_updated_at before update on public.product_variants
  for each row execute function public.set_updated_at();
drop trigger if exists inventory_lots_updated_at on public.inventory_lots;
create trigger inventory_lots_updated_at before update on public.inventory_lots
  for each row execute function public.set_updated_at();
drop trigger if exists inventory_lot_costs_updated_at on public.inventory_lot_costs;
create trigger inventory_lot_costs_updated_at before update on public.inventory_lot_costs
  for each row execute function public.set_updated_at();
drop trigger if exists inventory_units_updated_at on public.inventory_units;
create trigger inventory_units_updated_at before update on public.inventory_units
  for each row execute function public.set_updated_at();
drop trigger if exists inventory_unit_costs_updated_at on public.inventory_unit_costs;
create trigger inventory_unit_costs_updated_at before update on public.inventory_unit_costs
  for each row execute function public.set_updated_at();

comment on table public.product_inventory_profiles is
  'Per-product advanced inventory strategy. simple leaves the existing LakBiz stock model unchanged; other modes enable vertical allocation workflows.';
comment on table public.inventory_lots is
  'Batch/lot identity and remaining quantity for expiry-aware sectors such as pharmacy. Cost is intentionally isolated in inventory_lot_costs.';
comment on table public.inventory_units is
  'One physical serialized device/unit per row (IMEI/serial/barcode identity). Cost is intentionally isolated in inventory_unit_costs.';
comment on table public.inventory_allocations is
  'Audit link from a sale/job/return/adjustment to the exact variant/lot/serialized unit that fulfilled it.';
