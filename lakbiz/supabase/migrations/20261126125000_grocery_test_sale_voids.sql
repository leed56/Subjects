create table public.grocery_test_sale_voids (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  sale_id text not null references public.sales_base(id) on delete restrict,
  bill_no text not null,
  reason text not null check (char_length(btrim(reason)) between 8 and 500),
  voided_by uuid not null,
  voided_at timestamptz not null default now(),
  constraint grocery_test_sale_voids_shop_sale_unique unique (organization_id, sale_id)
);

create index grocery_test_sale_voids_shop_voided_idx
  on public.grocery_test_sale_voids (organization_id, voided_at desc);

alter table public.grocery_test_sale_voids enable row level security;

revoke all on table public.grocery_test_sale_voids from anon, authenticated;
grant select on table public.grocery_test_sale_voids to authenticated;
grant insert (organization_id, sale_id, bill_no, reason, voided_by)
  on table public.grocery_test_sale_voids to authenticated;

create policy grocery_test_sale_voids_select_for_sales_members
  on public.grocery_test_sale_voids
  for select
  to authenticated
  using (public.org_member_can_write_module(organization_id, 'sales'));

create policy grocery_test_sale_voids_insert_for_shop_owner
  on public.grocery_test_sale_voids
  for insert
  to authenticated
  with check (
    public.org_member_role_in(organization_id, array['owner'])
    and voided_by = (select auth.uid())
    and exists (
      select 1
      from public.sales_base s
      where s.id = grocery_test_sale_voids.sale_id
        and s.organization_id = grocery_test_sale_voids.organization_id
        and s.bill_no = grocery_test_sale_voids.bill_no
    )
  );
