-- LakBiz: one authoritative sector → module matrix.
--
-- Before: the sector/module rules existed in THREE places that disagreed —
--   1. TS SECTOR_FEATURES (full, drove the UI)
--   2. SQL sector_allows_module() (partial: "else true", drove RLS) — it let
--      electronics/electricals/spare_parts write ac_jobs/vehicles, which the UI hid.
--   3. business_templates.features (jsonb, never read by the app)
--
-- After: a single data-driven table (sector_modules) is the authoritative source
-- enforced by RLS. sector_allows_module() reads it (strict: unknown = false).
-- The TS SECTOR_FEATURES map mirrors this table exactly for synchronous UI gating.
-- The dead business_templates.features column is removed.

-- 1. Authoritative matrix.
create table if not exists public.sector_modules (
  sector_id text not null,
  module_key text not null,
  allowed boolean not null,
  primary key (sector_id, module_key)
);

insert into public.sector_modules (sector_id, module_key, allowed) values
  -- grocery: no banking, no ac_jobs, no vehicles
  ('grocery', 'sales', true), ('grocery', 'stock', true), ('grocery', 'bills', true),
  ('grocery', 'customers', true), ('grocery', 'suppliers', true), ('grocery', 'banking', false),
  ('grocery', 'ac_jobs', false), ('grocery', 'vehicles', false), ('grocery', 'export', true), ('grocery', 'offline', false),
  -- electronics
  ('electronics', 'sales', true), ('electronics', 'stock', true), ('electronics', 'bills', true),
  ('electronics', 'customers', true), ('electronics', 'suppliers', true), ('electronics', 'banking', true),
  ('electronics', 'ac_jobs', false), ('electronics', 'vehicles', false), ('electronics', 'export', true), ('electronics', 'offline', false),
  -- electricals
  ('electricals', 'sales', true), ('electricals', 'stock', true), ('electricals', 'bills', true),
  ('electricals', 'customers', true), ('electricals', 'suppliers', true), ('electricals', 'banking', true),
  ('electricals', 'ac_jobs', false), ('electricals', 'vehicles', false), ('electricals', 'export', true), ('electricals', 'offline', false),
  -- spare_parts
  ('spare_parts', 'sales', true), ('spare_parts', 'stock', true), ('spare_parts', 'bills', true),
  ('spare_parts', 'customers', true), ('spare_parts', 'suppliers', true), ('spare_parts', 'banking', true),
  ('spare_parts', 'ac_jobs', false), ('spare_parts', 'vehicles', false), ('spare_parts', 'export', true), ('spare_parts', 'offline', false),
  -- ac_hvac: ac_jobs yes, vehicles no, offline yes
  ('ac_hvac', 'sales', true), ('ac_hvac', 'stock', true), ('ac_hvac', 'bills', true),
  ('ac_hvac', 'customers', true), ('ac_hvac', 'suppliers', true), ('ac_hvac', 'banking', true),
  ('ac_hvac', 'ac_jobs', true), ('ac_hvac', 'vehicles', false), ('ac_hvac', 'export', true), ('ac_hvac', 'offline', true),
  -- car_sales: vehicles yes, ac_jobs no
  ('car_sales', 'sales', true), ('car_sales', 'stock', true), ('car_sales', 'bills', true),
  ('car_sales', 'customers', true), ('car_sales', 'suppliers', true), ('car_sales', 'banking', true),
  ('car_sales', 'ac_jobs', false), ('car_sales', 'vehicles', true), ('car_sales', 'export', true), ('car_sales', 'offline', false)
on conflict (sector_id, module_key) do update set allowed = excluded.allowed;

-- Reference data: readable by any authenticated user; only service role may change it.
alter table public.sector_modules enable row level security;
drop policy if exists "sector_modules_read" on public.sector_modules;
create policy "sector_modules_read"
  on public.sector_modules for select to authenticated using (true);

-- 2. Data-driven gate (strict: unknown sector/module = not allowed). Now STABLE (reads a table).
create or replace function public.sector_allows_module(sector text, module_key text)
returns boolean
language sql
stable
set search_path = public
as $$
  select coalesce(
    (
      select sm.allowed
      from public.sector_modules sm
      where sm.sector_id = coalesce(nullif(btrim(sector), ''), 'grocery')
        and sm.module_key = sector_allows_module.module_key
    ),
    false
  );
$$;

comment on table public.sector_modules is
  'Authoritative sector → module permission matrix. Enforced by RLS via sector_allows_module(); mirrored in TS lib/sector-features.ts.';

-- 3. Remove the dead, unused features copy.
alter table public.business_templates drop column if exists features;
