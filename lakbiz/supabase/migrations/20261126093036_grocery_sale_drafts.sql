-- Cloud-synced unpaid POS drafts. Drafts never create sales, tenders,
-- stock movements, or invoice numbers.
create table public.sale_drafts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 100),
  payload jsonb not null check (
    jsonb_typeof(payload) = 'object'
    and octet_length(payload::text) <= 131072
  ),
  created_by uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index sale_drafts_org_updated_idx
  on public.sale_drafts (organization_id, updated_at desc);

alter table public.sale_drafts enable row level security;

revoke all on public.sale_drafts from anon;
grant select, delete on public.sale_drafts to authenticated;
grant insert (organization_id, title, payload) on public.sale_drafts to authenticated;
grant update (title, payload, updated_at) on public.sale_drafts to authenticated;
grant all on public.sale_drafts to service_role;

create policy sale_drafts_select_for_shop_members
  on public.sale_drafts for select to authenticated
  using (public.org_member_can_write_module(organization_id, 'sales'));

create policy sale_drafts_insert_for_shop_members
  on public.sale_drafts for insert to authenticated
  with check (
    public.org_member_can_write_module(organization_id, 'sales')
    and created_by = (select auth.uid())
  );

create policy sale_drafts_update_for_shop_members
  on public.sale_drafts for update to authenticated
  using (public.org_member_can_write_module(organization_id, 'sales'))
  with check (public.org_member_can_write_module(organization_id, 'sales'));

create policy sale_drafts_delete_for_shop_members
  on public.sale_drafts for delete to authenticated
  using (public.org_member_can_write_module(organization_id, 'sales'));
