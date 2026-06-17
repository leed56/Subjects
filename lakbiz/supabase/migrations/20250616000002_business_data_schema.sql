-- LakBiz Phase 1: business data tables (org-scoped, RLS)
-- Mirrors localStorage AppData for cloud sync

-- ─── Products ───────────────────────────────────────────────────────────────
create table if not exists public.products (
  id text primary key,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  sku text,
  category text not null default 'General',
  sector_id text not null default 'grocery',
  buy_price numeric(14, 2) not null default 0,
  sell_price numeric(14, 2) not null default 0,
  stock_qty numeric(14, 3) not null default 0,
  reorder_level numeric(14, 3) default 5,
  unit text not null default 'pcs',
  custom_fields jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists products_org_idx on public.products(organization_id);

-- ─── Customers ──────────────────────────────────────────────────────────────
create table if not exists public.customers (
  id text primary key,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  phone text,
  address text,
  credit_balance numeric(14, 2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists customers_org_idx on public.customers(organization_id);

-- ─── Suppliers ──────────────────────────────────────────────────────────────
create table if not exists public.suppliers (
  id text primary key,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  phone text,
  address text,
  payable_balance numeric(14, 2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists suppliers_org_idx on public.suppliers(organization_id);

-- ─── Sales ──────────────────────────────────────────────────────────────────
create table if not exists public.sales (
  id text primary key,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  bill_no text,
  sale_date timestamptz not null default now(),
  subtotal numeric(14, 2),
  output_vat numeric(14, 2),
  total numeric(14, 2) not null default 0,
  profit numeric(14, 2) not null default 0,
  payment_method text not null default 'cash',
  customer_id text references public.customers(id) on delete set null,
  customer_name text,
  credit_amount numeric(14, 2) not null default 0,
  cheque_id text,
  created_at timestamptz not null default now()
);

create index if not exists sales_org_idx on public.sales(organization_id);
create index if not exists sales_date_idx on public.sales(organization_id, sale_date desc);

create table if not exists public.sale_lines (
  id uuid primary key default gen_random_uuid(),
  sale_id text not null references public.sales(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  product_id text,
  product_name text not null,
  qty numeric(14, 3) not null default 1,
  unit_price numeric(14, 2) not null default 0,
  buy_price numeric(14, 2) not null default 0,
  line_order smallint not null default 0
);

create index if not exists sale_lines_sale_idx on public.sale_lines(sale_id);

-- ─── Purchases (GRN) ────────────────────────────────────────────────────────
create table if not exists public.purchases (
  id text primary key,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  grn_no text not null,
  purchase_date timestamptz not null default now(),
  supplier_id text references public.suppliers(id) on delete set null,
  supplier_name text not null,
  subtotal numeric(14, 2),
  input_vat numeric(14, 2),
  total numeric(14, 2) not null default 0,
  payment_method text not null default 'cash',
  credit_amount numeric(14, 2) not null default 0,
  note text,
  created_at timestamptz not null default now()
);

create index if not exists purchases_org_idx on public.purchases(organization_id);

create table if not exists public.purchase_lines (
  id uuid primary key default gen_random_uuid(),
  purchase_id text not null references public.purchases(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  product_id text,
  product_name text not null,
  qty numeric(14, 3) not null default 1,
  unit_cost numeric(14, 2) not null default 0,
  line_order smallint not null default 0
);

create index if not exists purchase_lines_purchase_idx on public.purchase_lines(purchase_id);

-- ─── Payments ───────────────────────────────────────────────────────────────
create table if not exists public.customer_payments (
  id text primary key,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  customer_id text not null references public.customers(id) on delete cascade,
  customer_name text not null,
  amount numeric(14, 2) not null,
  payment_date timestamptz not null default now(),
  method text not null default 'cash',
  note text,
  created_at timestamptz not null default now()
);

create index if not exists customer_payments_org_idx on public.customer_payments(organization_id);

create table if not exists public.supplier_payments (
  id text primary key,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  supplier_id text not null references public.suppliers(id) on delete cascade,
  supplier_name text not null,
  amount numeric(14, 2) not null,
  payment_date timestamptz not null default now(),
  method text not null default 'cash',
  note text,
  created_at timestamptz not null default now()
);

create index if not exists supplier_payments_org_idx on public.supplier_payments(organization_id);

-- ─── Stock logs ─────────────────────────────────────────────────────────────
create table if not exists public.stock_logs (
  id text primary key,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  product_id text not null,
  product_name text not null,
  log_type text not null check (log_type in ('in', 'out', 'sale')),
  qty numeric(14, 3) not null,
  note text,
  log_date timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists stock_logs_org_idx on public.stock_logs(organization_id);

-- ─── Banking ────────────────────────────────────────────────────────────────
create table if not exists public.bank_accounts (
  id text primary key,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  bank_name text not null,
  branch text,
  account_name text not null,
  account_number text not null,
  balance numeric(14, 2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists bank_accounts_org_idx on public.bank_accounts(organization_id);

create table if not exists public.cheques (
  id text primary key,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  direction text not null check (direction in ('received', 'paid')),
  cheque_no text not null,
  bank_name text not null,
  party_name text not null,
  customer_id text references public.customers(id) on delete set null,
  amount numeric(14, 2) not null,
  cheque_date date not null,
  post_dated boolean not null default false,
  status text not null default 'pending'
    check (status in ('pending', 'deposited', 'cleared', 'bounced')),
  linked_sale_id text,
  bank_account_id text references public.bank_accounts(id) on delete set null,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists cheques_org_idx on public.cheques(organization_id);

-- ─── AC Jobs ────────────────────────────────────────────────────────────────
create table if not exists public.ac_jobs (
  id text primary key,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  job_no text not null,
  job_date timestamptz not null default now(),
  customer_id text references public.customers(id) on delete set null,
  customer_name text not null,
  phone text,
  address text not null,
  brand text,
  btu integer,
  unit_type text,
  unit_count integer not null default 1,
  description text not null default '',
  quoted_amount numeric(14, 2) not null default 0,
  deposit_amount numeric(14, 2) not null default 0,
  pipe_meters numeric(10, 2),
  status text not null default 'quote',
  scheduled_date date,
  installed_date date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists ac_jobs_org_idx on public.ac_jobs(organization_id);

-- ─── Vehicles ───────────────────────────────────────────────────────────────
create table if not exists public.vehicles (
  id text primary key,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  stock_id text not null,
  date_added timestamptz not null default now(),
  make text not null,
  model text not null,
  year integer not null,
  chassis_no text not null,
  engine_no text,
  reg_no text,
  color text,
  fuel text not null default 'petrol',
  transmission text not null default 'auto',
  mileage_km integer not null default 0,
  condition text not null default '',
  purchase_price numeric(14, 2) not null default 0,
  recondition_cost numeric(14, 2) not null default 0,
  ask_price numeric(14, 2) not null default 0,
  min_price numeric(14, 2),
  status text not null default 'for_sale',
  customer_id text references public.customers(id) on delete set null,
  customer_name text,
  sold_price numeric(14, 2),
  sold_date date,
  finance_partner text,
  payment_method text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, chassis_no)
);

create index if not exists vehicles_org_idx on public.vehicles(organization_id);

-- ─── Updated-at triggers ────────────────────────────────────────────────────
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists products_updated_at on public.products;
create trigger products_updated_at before update on public.products
  for each row execute function public.set_updated_at();

drop trigger if exists customers_updated_at on public.customers;
create trigger customers_updated_at before update on public.customers
  for each row execute function public.set_updated_at();

drop trigger if exists suppliers_updated_at on public.suppliers;
create trigger suppliers_updated_at before update on public.suppliers
  for each row execute function public.set_updated_at();

drop trigger if exists bank_accounts_updated_at on public.bank_accounts;
create trigger bank_accounts_updated_at before update on public.bank_accounts
  for each row execute function public.set_updated_at();

drop trigger if exists cheques_updated_at on public.cheques;
create trigger cheques_updated_at before update on public.cheques
  for each row execute function public.set_updated_at();

drop trigger if exists ac_jobs_updated_at on public.ac_jobs;
create trigger ac_jobs_updated_at before update on public.ac_jobs
  for each row execute function public.set_updated_at();

drop trigger if exists vehicles_updated_at on public.vehicles;
create trigger vehicles_updated_at before update on public.vehicles
  for each row execute function public.set_updated_at();

-- ─── RLS: org members only ───────────────────────────────────────────────────
alter table public.products enable row level security;
alter table public.customers enable row level security;
alter table public.suppliers enable row level security;
alter table public.sales enable row level security;
alter table public.sale_lines enable row level security;
alter table public.purchases enable row level security;
alter table public.purchase_lines enable row level security;
alter table public.customer_payments enable row level security;
alter table public.supplier_payments enable row level security;
alter table public.stock_logs enable row level security;
alter table public.bank_accounts enable row level security;
alter table public.cheques enable row level security;
alter table public.ac_jobs enable row level security;
alter table public.vehicles enable row level security;

-- Macro-style policies per table
do $$
declare
  t text;
begin
  foreach t in array array[
    'products', 'customers', 'suppliers', 'sales', 'purchases',
    'customer_payments', 'supplier_payments', 'stock_logs',
    'bank_accounts', 'cheques', 'ac_jobs', 'vehicles'
  ] loop
    execute format(
      'create policy %I on public.%I for select to authenticated using (public.is_org_member(organization_id))',
      t || '_select_member', t
    );
    execute format(
      'create policy %I on public.%I for insert to authenticated with check (public.is_org_member(organization_id))',
      t || '_insert_member', t
    );
    execute format(
      'create policy %I on public.%I for update to authenticated using (public.is_org_member(organization_id)) with check (public.is_org_member(organization_id))',
      t || '_update_member', t
    );
    execute format(
      'create policy %I on public.%I for delete to authenticated using (public.is_org_member(organization_id))',
      t || '_delete_member', t
    );
  end loop;
end $$;

-- Line tables inherit org check via organization_id column
create policy sale_lines_select_member on public.sale_lines for select to authenticated
  using (public.is_org_member(organization_id));
create policy sale_lines_insert_member on public.sale_lines for insert to authenticated
  with check (public.is_org_member(organization_id));
create policy sale_lines_update_member on public.sale_lines for update to authenticated
  using (public.is_org_member(organization_id)) with check (public.is_org_member(organization_id));
create policy sale_lines_delete_member on public.sale_lines for delete to authenticated
  using (public.is_org_member(organization_id));

create policy purchase_lines_select_member on public.purchase_lines for select to authenticated
  using (public.is_org_member(organization_id));
create policy purchase_lines_insert_member on public.purchase_lines for insert to authenticated
  with check (public.is_org_member(organization_id));
create policy purchase_lines_update_member on public.purchase_lines for update to authenticated
  using (public.is_org_member(organization_id)) with check (public.is_org_member(organization_id));
create policy purchase_lines_delete_member on public.purchase_lines for delete to authenticated
  using (public.is_org_member(organization_id));
