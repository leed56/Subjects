-- Platform-wide SMS / cron policy (super-admin only — not shop-editable)

create table if not exists public.platform_settings (
  id text primary key default 'default',
  messaging_policy jsonb not null default '{
    "serviceDueRepeatDays": 7,
    "dailySmsLimitPerOrg": 100,
    "maxSmsLength": 640,
    "defaultRemindDays": [14, 7, 2, 0],
    "defaultServiceIntervalDays": 180,
    "cronEnabled": true
  }'::jsonb,
  updated_at timestamptz not null default now()
);

insert into public.platform_settings (id, messaging_policy)
values ('default', '{
  "serviceDueRepeatDays": 7,
  "dailySmsLimitPerOrg": 100,
  "maxSmsLength": 640,
  "defaultRemindDays": [14, 7, 2, 0],
  "defaultServiceIntervalDays": 180,
  "cronEnabled": true
}'::jsonb)
on conflict (id) do nothing;

alter table public.platform_settings enable row level security;

drop policy if exists "platform_settings_select_authenticated" on public.platform_settings;
create policy "platform_settings_select_authenticated"
  on public.platform_settings for select to authenticated
  using (true);

drop policy if exists "platform_settings_update_admin" on public.platform_settings;
create policy "platform_settings_update_admin"
  on public.platform_settings for update to authenticated
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

drop policy if exists "platform_settings_insert_admin" on public.platform_settings;
create policy "platform_settings_insert_admin"
  on public.platform_settings for insert to authenticated
  with check (public.is_platform_admin());

drop trigger if exists platform_settings_updated_at on public.platform_settings;
create trigger platform_settings_updated_at before update on public.platform_settings
  for each row execute function public.set_updated_at();

comment on table public.platform_settings is 'LakBiz platform policy — SMS limits, cron guards, new-shop defaults';
