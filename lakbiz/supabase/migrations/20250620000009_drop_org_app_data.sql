-- Remove unused JSON snapshot table (business-sync uses normalized tables).

drop table if exists public.org_app_data cascade;
