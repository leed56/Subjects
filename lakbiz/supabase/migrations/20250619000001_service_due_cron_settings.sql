-- Extend notification_settings defaults for AC service-due auto SMS cron

alter table public.organizations
  alter column notification_settings set default '{
    "defaultChannel": "whatsapp",
    "preferredLanguage": "si",
    "autoPromptOnJobStatus": true,
    "autoSendServiceDueSms": false,
    "serviceDueRemindDaysBefore": 3,
    "serviceDueRepeatDays": 7
  }'::jsonb;
