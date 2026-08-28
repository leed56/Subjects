-- LakBiz: WhatsApp API channel (WasenderAPI) — additive, widens the
-- existing notification_log.channel check constraint to allow a new
-- 'api_whatsapp' value alongside the existing 'whatsapp' (wa.me deep
-- link), 'sms' (sms: deep link), and 'api_sms' (Text.lk) channels.
-- No data is touched — only the allowed value set grows.

alter table public.notification_log
  drop constraint if exists notification_log_channel_check;

alter table public.notification_log
  add constraint notification_log_channel_check
  check (channel in ('whatsapp', 'sms', 'api_sms', 'api_whatsapp'));
