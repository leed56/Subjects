-- LakBiz subscription + organization schema
-- Run via Supabase CLI or MCP apply_migration after project creation

-- Plans (seed data)
create table if not exists public.plans (
  id text primary key,
  name_en text not null,
  name_si text not null,
  price_monthly_lkr integer not null,
  price_annual_lkr integer not null,
  max_users integer not null default 1,
  max_branches integer not null default 1,
  max_products integer, -- null = unlimited
  features jsonb not null default '{}'::jsonb,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

insert into public.plans (id, name_en, name_si, price_monthly_lkr, price_annual_lkr, max_users, max_branches, max_products, features, sort_order)
values
  ('starter', 'Starter', 'ආරම්භක', 1490, 14900, 1, 1, 500,
   '{"sales":true,"stock":true,"bills":true,"customers":false,"suppliers":false,"banking":false,"ac_jobs":false,"vehicles":false,"export":false}'::jsonb, 1),
  ('business', 'Business', 'ව්‍යාපාර', 2990, 29900, 3, 1, null,
   '{"sales":true,"stock":true,"bills":true,"customers":true,"suppliers":true,"banking":true,"ac_jobs":false,"vehicles":false,"export":true}'::jsonb, 2),
  ('pro', 'Pro', 'ප්‍රො', 4990, 49900, 10, 3, null,
   '{"sales":true,"stock":true,"bills":true,"customers":true,"suppliers":true,"banking":true,"ac_jobs":true,"vehicles":true,"export":true,"offline":true}'::jsonb, 3)
on conflict (id) do nothing;

-- Organizations (tenant)
create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  name_si text,
  phone text,
  address text,
  tin text,
  sector text default 'grocery',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Org membership (roles stored here, NOT in user_metadata)
create type public.org_role as enum ('owner', 'manager', 'cashier', 'technician');

create table if not exists public.org_members (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.org_role not null default 'owner',
  created_at timestamptz not null default now(),
  unique (organization_id, user_id)
);

create index if not exists org_members_user_id_idx on public.org_members(user_id);

-- Subscription status
create type public.subscription_status as enum (
  'trialing', 'active', 'past_due', 'canceled', 'read_only'
);

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null unique references public.organizations(id) on delete cascade,
  plan_id text not null references public.plans(id),
  status public.subscription_status not null default 'trialing',
  billing_cycle text not null default 'monthly' check (billing_cycle in ('monthly', 'annual')),
  trial_ends_at timestamptz,
  current_period_start timestamptz,
  current_period_end timestamptz,
  payment_provider text,
  external_customer_id text,
  canceled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Add-ons
create type public.addon_type as enum (
  'extra_user', 'extra_branch', 'ac_jobs', 'vehicles', 'sector_pack'
);

create table if not exists public.subscription_addons (
  id uuid primary key default gen_random_uuid(),
  subscription_id uuid not null references public.subscriptions(id) on delete cascade,
  addon addon_type not null,
  quantity integer not null default 1,
  created_at timestamptz not null default now(),
  unique (subscription_id, addon)
);

-- Auto trial on new org
create or replace function public.create_org_subscription()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.subscriptions (
    organization_id, plan_id, status, trial_ends_at, current_period_start, current_period_end
  ) values (
    new.id,
    'business',
    'trialing',
    now() + interval '14 days',
    now(),
    now() + interval '14 days'
  );
  return new;
end;
$$;

drop trigger if exists on_organization_created on public.organizations;
create trigger on_organization_created
  after insert on public.organizations
  for each row execute function public.create_org_subscription();

-- Helper: is user member of org
create or replace function public.is_org_member(org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.org_members
    where organization_id = org_id and user_id = auth.uid()
  );
$$;

-- RLS
alter table public.plans enable row level security;
alter table public.organizations enable row level security;
alter table public.org_members enable row level security;
alter table public.subscriptions enable row level security;
alter table public.subscription_addons enable row level security;

-- Plans: readable by authenticated users
create policy "plans_read_authenticated"
  on public.plans for select to authenticated using (true);

-- Organizations: members can read their org
create policy "orgs_select_member"
  on public.organizations for select to authenticated
  using (public.is_org_member(id));

create policy "orgs_insert_authenticated"
  on public.organizations for insert to authenticated
  with check (true);

create policy "orgs_update_owner"
  on public.organizations for update to authenticated
  using (
    exists (
      select 1 from public.org_members m
      where m.organization_id = organizations.id
        and m.user_id = auth.uid()
        and m.role = 'owner'
    )
  )
  with check (
    exists (
      select 1 from public.org_members m
      where m.organization_id = organizations.id
        and m.user_id = auth.uid()
        and m.role = 'owner'
    )
  );

-- Org members
create policy "org_members_select_own_org"
  on public.org_members for select to authenticated
  using (public.is_org_member(organization_id));

create policy "org_members_insert_self_owner"
  on public.org_members for insert to authenticated
  with check (user_id = auth.uid());

-- Subscriptions
create policy "subscriptions_select_member"
  on public.subscriptions for select to authenticated
  using (public.is_org_member(organization_id));

-- Addons
create policy "addons_select_member"
  on public.subscription_addons for select to authenticated
  using (
    exists (
      select 1 from public.subscriptions s
      join public.org_members m on m.organization_id = s.organization_id
      where s.id = subscription_id and m.user_id = auth.uid()
    )
  );
