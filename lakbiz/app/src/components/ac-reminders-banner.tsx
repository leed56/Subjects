"use client";

import Link from "next/link";
import { useLocale } from "@/lib/i18n/locale-provider";
import { loadNotificationSettings } from "@/lib/messaging/settings";
import { useSmsApiConfigured } from "@/lib/messaging/use-sms-api-configured";
import { AlertRow } from "@/components/ui/primitives";
import { BellIcon } from "@/components/ui/icons";

/** Global premium UI phase, Part 11 — "compact inline status... move
 * detailed reminder configuration out of the main page." Was a 3-line
 * bordered box (title + body + link) when reminders were off, and
 * rendered nothing at all when on — replaced with one AlertRow either
 * way, so the AC Jobs page always shows *some* honest status rather than
 * silence, without the old box's weight. */
export function AcRemindersBanner() {
  const { t } = useLocale();
  const settings = loadNotificationSettings();
  const smsApiConfigured = useSmsApiConfigured();
  const enabled = settings.autoSendServiceDueSms && smsApiConfigured;

  return (
    <AlertRow
      tone={enabled ? "positive" : "warning"}
      icon={<BellIcon className="h-4 w-4" />}
      action={
        <Link href="/settings/notifications" className="font-semibold underline underline-offset-2">
          {enabled ? t("jobs.reminders_manage") : t("jobs.reminders_enable")}
        </Link>
      }
    >
      {enabled ? t("jobs.reminders_on_compact") : t("jobs.reminders_off_compact")}
    </AlertRow>
  );
}
