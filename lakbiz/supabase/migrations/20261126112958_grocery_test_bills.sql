-- Shop-shared test invoices live outside sales, inventory, tender and tax ledgers.
create table if not exists public.grocery_test_bills (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  bill_no text not null,
  lines jsonb not null,
  discount numeric(12, 2) not null default 0,
  total numeric(12, 2) not null,
  created_by uuid not null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint grocery_test_bills_bill_no_format check (bill_no ~ '^TEST-[A-Z0-9-]{1,80}$'),
  constraint grocery_test_bills_lines_array check (
    jsonb_typeof(lines) = 'array'
    and jsonb_array_length(lines) between 1 and 200
  ),
  constraint grocery_test_bills_discount_nonnegative check (discount >= 0),
  constraint grocery_test_bills_total_positive check (total > 0),
  constraint grocery_test_bills_shop_bill_unique unique (organization_id, bill_no)
);

create index if not exists grocery_test_bills_shop_created_idx
  on public.grocery_test_bills (organization_id, created_at desc);

alter table public.grocery_test_bills enable row level security;
revoke all on table public.grocery_test_bills from anon, authenticated;
grant select, delete on table public.grocery_test_bills to authenticated;
grant insert (organization_id, bill_no, lines, discount, total)
  on table public.grocery_test_bills to authenticated;
grant update (bill_no, lines, discount, total)
  on table public.grocery_test_bills to authenticated;

create policy grocery_test_bills_select_for_shop_members
  on public.grocery_test_bills
  for select to authenticated
  using (public.org_member_can_write_module(organization_id, 'sales'));

create policy grocery_test_bills_insert_for_shop_members
  on public.grocery_test_bills
  for insert to authenticated
  with check (
    public.org_member_can_write_module(organization_id, 'sales')
    and created_by = (select auth.uid())
  );

create policy grocery_test_bills_update_for_shop_members
  on public.grocery_test_bills
  for update to authenticated
  using (public.org_member_can_write_module(organization_id, 'sales'))
  with check (public.org_member_can_write_module(organization_id, 'sales'));

create policy grocery_test_bills_delete_for_shop_members
  on public.grocery_test_bills
  for delete to authenticated
  using (public.org_member_can_write_module(organization_id, 'sales'));

create or replace function public.touch_grocery_test_bill_updated_at()
returns trigger
language plpgsql
set search_path = public
as $function$
begin
  new.updated_at := now();
  return new;
end;
$function$;

revoke all on function public.touch_grocery_test_bill_updated_at() from public, anon;
grant execute on function public.touch_grocery_test_bill_updated_at() to authenticated;

create trigger grocery_test_bills_touch_updated_at
  before update on public.grocery_test_bills
  for each row execute function public.touch_grocery_test_bill_updated_at();
