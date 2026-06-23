-- Phase C: per-company wholesale price overrides (company × product).

create table if not exists public.customer_product_prices (
  id text primary key,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  customer_id text not null references public.customers(id) on delete cascade,
  product_id text not null references public.products(id) on delete cascade,
  price numeric(14, 2) not null check (price >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, customer_id, product_id)
);

create index if not exists customer_product_prices_org_idx
  on public.customer_product_prices(organization_id);
create index if not exists customer_product_prices_customer_idx
  on public.customer_product_prices(customer_id);

drop trigger if exists set_customer_product_prices_updated_at on public.customer_product_prices;
create trigger set_customer_product_prices_updated_at
  before update on public.customer_product_prices
  for each row execute function public.set_updated_at();

alter table public.customer_product_prices enable row level security;

drop policy if exists customer_product_prices_select_member on public.customer_product_prices;
create policy customer_product_prices_select_member
  on public.customer_product_prices for select to authenticated
  using (
    organization_id in (
      select m.organization_id from public.org_members m where m.user_id = auth.uid()
    )
  );

drop policy if exists customer_product_prices_insert_member on public.customer_product_prices;
create policy customer_product_prices_insert_member
  on public.customer_product_prices for insert to authenticated
  with check (public.org_member_can_write_module(organization_id, 'customers'));

drop policy if exists customer_product_prices_update_member on public.customer_product_prices;
create policy customer_product_prices_update_member
  on public.customer_product_prices for update to authenticated
  using (public.org_member_can_write_module(organization_id, 'customers'))
  with check (public.org_member_can_write_module(organization_id, 'customers'));

drop policy if exists customer_product_prices_delete_member on public.customer_product_prices;
create policy customer_product_prices_delete_member
  on public.customer_product_prices for delete to authenticated
  using (public.org_member_can_write_module(organization_id, 'customers'));

comment on table public.customer_product_prices is
  'B2B wholesale price per company × product (Phase C). Falls back to retail sell_price when unset.';
