-- LakBiz platform super-admin + business templates

create table if not exists public.platform_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  created_at timestamptz not null default now()
);

alter table public.platform_admins enable row level security;

drop policy if exists "platform_admins_select_self" on public.platform_admins;
create policy "platform_admins_select_self"
  on public.platform_admins for select to authenticated
  using (user_id = auth.uid());

create or replace function public.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.platform_admins where user_id = auth.uid()
  );
$$;

revoke all on function public.is_platform_admin() from public;
grant execute on function public.is_platform_admin() to authenticated;

-- Platform admins can list all shops
drop policy if exists "orgs_select_platform_admin" on public.organizations;
create policy "orgs_select_platform_admin"
  on public.organizations for select to authenticated
  using (public.is_platform_admin());

drop policy if exists "org_members_select_platform_admin" on public.org_members;
create policy "org_members_select_platform_admin"
  on public.org_members for select to authenticated
  using (public.is_platform_admin());

drop policy if exists "subscriptions_select_platform_admin" on public.subscriptions;
create policy "subscriptions_select_platform_admin"
  on public.subscriptions for select to authenticated
  using (public.is_platform_admin());

-- Business templates (admin picks when provisioning)
create table if not exists public.business_templates (
  id text primary key,
  name_en text not null,
  name_si text not null,
  sector_id text not null,
  default_plan_id text not null references public.plans(id),
  features jsonb not null default '{}'::jsonb,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.business_templates enable row level security;

drop policy if exists "business_templates_read_all" on public.business_templates;
create policy "business_templates_read_all"
  on public.business_templates for select to authenticated
  using (is_active = true or public.is_platform_admin());

insert into public.business_templates (id, name_en, name_si, sector_id, default_plan_id, features, sort_order)
values
  ('grocery', 'Grocery & Supermarket', 'සිල්ලර සහ සුපිරි වෙළඳසැල්', 'grocery', 'business',
   '{"sales":true,"stock":true,"bills":true,"customers":true,"suppliers":true,"banking":false,"ac_jobs":false,"vehicles":false}'::jsonb, 1),
  ('electronics', 'Electronics', 'ඉලෙක්ට්‍රොනික උපකරණ', 'electronics', 'business',
   '{"sales":true,"stock":true,"bills":true,"customers":true,"suppliers":true,"banking":true,"ac_jobs":false,"vehicles":false}'::jsonb, 2),
  ('electricals', 'Electricals', 'විදුලි උපකරණ', 'electricals', 'business',
   '{"sales":true,"stock":true,"bills":true,"customers":true,"suppliers":true,"banking":true,"ac_jobs":false,"vehicles":false}'::jsonb, 3),
  ('spare_parts', 'Spare Parts', 'අමතර කොටස්', 'spare_parts', 'business',
   '{"sales":true,"stock":true,"bills":true,"customers":true,"suppliers":true,"banking":true,"ac_jobs":false,"vehicles":false}'::jsonb, 4),
  ('ac_hvac', 'Air Conditioning', 'වායු සමනය', 'ac_hvac', 'pro',
   '{"sales":true,"stock":true,"bills":true,"customers":true,"suppliers":true,"banking":true,"ac_jobs":true,"vehicles":false}'::jsonb, 5),
  ('car_sales', 'Car Sales', 'මෝටර් රථ වෙළඳාම', 'car_sales', 'pro',
   '{"sales":true,"stock":true,"bills":true,"customers":true,"suppliers":true,"banking":true,"ac_jobs":false,"vehicles":true}'::jsonb, 6)
on conflict (id) do update set
  name_en = excluded.name_en,
  name_si = excluded.name_si,
  sector_id = excluded.sector_id,
  default_plan_id = excluded.default_plan_id,
  features = excluded.features,
  sort_order = excluded.sort_order;

comment on table public.platform_admins is 'LakBiz super-admin users — insert via service role after first login';
comment on table public.business_templates is 'Shop provisioning templates selected by super admin';
