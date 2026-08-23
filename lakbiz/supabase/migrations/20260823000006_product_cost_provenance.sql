-- Owner-only provenance for product-level buy costs.
--
-- Product facts remain in products_base/custom_fields. The numeric buy_price is
-- already masked by the existing products view. This table keeps the *source*
-- of that cost (for example factual SPC wholesale vs synthetic demo cost)
-- behind the same owner-only financial boundary instead of leaking it through
-- operational custom_fields.

create unique index if not exists products_base_org_product_uq
  on public.products_base (organization_id, id);

create table if not exists public.product_cost_provenance (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  product_id text not null,
  cost_source text not null check (cost_source in ('spc_wholesale', 'synthetic_demo', 'manual', 'unknown')),
  source_url text,
  source_price_date date,
  retrieved_at timestamptz not null default now(),
  is_synthetic boolean not null default false,
  note text,
  primary key (organization_id, product_id),
  constraint product_cost_provenance_product_fk
    foreign key (organization_id, product_id)
    references public.products_base (organization_id, id)
    on delete cascade,
  constraint product_cost_provenance_synthetic_check
    check (not is_synthetic or cost_source = 'synthetic_demo')
);

alter table public.product_cost_provenance enable row level security;

revoke all on table public.product_cost_provenance from public, anon;
grant select, insert, update, delete on table public.product_cost_provenance to authenticated;

create index if not exists product_cost_provenance_product_idx
  on public.product_cost_provenance (product_id);

drop policy if exists product_cost_provenance_select_owner on public.product_cost_provenance;
create policy product_cost_provenance_select_owner
on public.product_cost_provenance
for select to authenticated
using (public.can_see_org_financials(organization_id));

drop policy if exists product_cost_provenance_insert_owner on public.product_cost_provenance;
create policy product_cost_provenance_insert_owner
on public.product_cost_provenance
for insert to authenticated
with check (public.can_see_org_financials(organization_id));

drop policy if exists product_cost_provenance_update_owner on public.product_cost_provenance;
create policy product_cost_provenance_update_owner
on public.product_cost_provenance
for update to authenticated
using (public.can_see_org_financials(organization_id))
with check (public.can_see_org_financials(organization_id));

drop policy if exists product_cost_provenance_delete_owner on public.product_cost_provenance;
create policy product_cost_provenance_delete_owner
on public.product_cost_provenance
for delete to authenticated
using (public.can_see_org_financials(organization_id));
