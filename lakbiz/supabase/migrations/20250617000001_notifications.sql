-- LakBiz: notification log + org notification settings

alter table public.organizations
  add column if not exists notification_settings jsonb not null default '{
    "defaultChannel": "whatsapp",
    "preferredLanguage": "si",
    "autoPromptOnJobStatus": true
  }'::jsonb;

create table if not exists public.notification_log (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  channel text not null check (channel in ('whatsapp', 'sms', 'api_sms')),
  template_id text,
  recipient_phone text not null,
  recipient_name text,
  message_body text not null,
  context_type text,
  context_id text,
  status text not null default 'sent' check (status in ('sent', 'failed', 'opened')),
  provider_ref text,
  created_at timestamptz not null default now()
);

create index if not exists notification_log_org_idx
  on public.notification_log(organization_id, created_at desc);

alter table public.notification_log enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies where policyname = 'notification_log_select_member'
  ) then
    create policy notification_log_select_member on public.notification_log
      for select to authenticated
      using (public.is_org_member(organization_id));
  end if;
  if not exists (
    select 1 from pg_policies where policyname = 'notification_log_insert_member'
  ) then
    create policy notification_log_insert_member on public.notification_log
      for insert to authenticated
      with check (public.is_org_member(organization_id));
  end if;
end $$;
