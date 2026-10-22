"use client";

import Link from "next/link";
import { useLocale } from "@/lib/i18n/locale-provider";
import { loadNotificationSettings } from "@/lib/messaging/settings";
import { useSmsApiConfigured } from "@/lib/messaging/use-sms-api-configured";
import { BellIcon } from "@/components/ui/icons";

/**
 * Compact reminder status for the AC Jobs workspace. This deliberately
 * reads like supporting metadata rather than a warning banner so it does
 * not compete with jobs, filters, or primary workflow actions.
 */
export function AcRemindersBanner() {
  const { t } = useLocale();
  const settings = loadNotificationSettings();
  const smsApiConfigured = useSmsApiConfigured();
  const enabled = settings.autoSendServiceDueSms && smsApiConfigured;

  return (
    <div className="flex min-h-11 items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3.5 py-2 shadow-[0_1px_2px_rgba(15,23,42,0.03)] sm:px-4">
      <div className="flex min-w-0 items-center gap-2.5">
        <span
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
            enabled ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"
          }`}
        >
          <BellIcon className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-slate-800">
            {enabled ? t("jobs.reminders_on_compact") : t("jobs.reminders_off_compact")}
          </p>
          <p className="hidden text-xs text-slate-400 sm:block">
            {enabled ? t("jobs.reminders_manage") : t("jobs.reminders_enable")}
          </p>
        </div>
      </div>
      <Link
        href="/settings/notifications"
        className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
          enabled
            ? "bg-slate-100 text-slate-700 hover:bg-slate-200"
            : "bg-amber-50 text-amber-800 hover:bg-amber-100"
        }`}
      >
        {enabled ? t("jobs.reminders_manage") : t("jobs.reminders_enable")}
      </Link>
    </div>
  );
}
