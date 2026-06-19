"use client";

import Link from "next/link";
import { useLocale } from "@/lib/i18n/locale-provider";
import { loadNotificationSettings } from "@/lib/messaging/settings";
import { useSmsApiConfigured } from "@/lib/messaging/use-sms-api-configured";

export function AcRemindersBanner() {
  const { t } = useLocale();
  const settings = loadNotificationSettings();
  const smsApiConfigured = useSmsApiConfigured();

  if (settings.autoSendServiceDueSms && smsApiConfigured) return null;

  return (
    <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
      <p className="font-medium">{t("jobs.reminders_banner_title")}</p>
      <p className="mt-1 text-amber-900">{t("jobs.reminders_banner_body")}</p>
      <Link
        href="/settings/notifications"
        className="mt-2 inline-block font-semibold text-amber-950 underline"
      >
        {t("jobs.reminders_banner_link")}
      </Link>
    </div>
  );
}
