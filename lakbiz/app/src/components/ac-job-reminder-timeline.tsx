"use client";

import {
  buildReminderTimeline,
  nextReminderEntry,
  type ReminderTimelineEntry,
} from "@/lib/messaging/reminder-schedule";
import { loadNotificationSettings } from "@/lib/messaging/settings";
import type { NotificationLogEntry, NotificationSettings } from "@/lib/messaging/types";
import { useLocale } from "@/lib/i18n/locale-provider";
import type { ACJob } from "@/lib/store/types";

type AcJobReminderTimelineProps = {
  job: ACJob;
  logs: NotificationLogEntry[];
  settings?: NotificationSettings;
  compact?: boolean;
};

function statusIcon(status: ReminderTimelineEntry["status"]): string {
  switch (status) {
    case "sent":
      return "✓";
    case "due_today":
      return "●";
    case "missed":
      return "✕";
    default:
      return "○";
  }
}

function statusClass(status: ReminderTimelineEntry["status"]): string {
  switch (status) {
    case "sent":
      return "text-emerald-700 bg-emerald-50 border-emerald-200";
    case "due_today":
      return "text-amber-900 bg-amber-50 border-amber-300";
    case "missed":
      return "text-red-700 bg-red-50 border-red-200";
    default:
      return "text-slate-600 bg-slate-50 border-slate-200";
  }
}

export function AcJobReminderTimeline({
  job,
  logs,
  settings: settingsProp,
  compact = false,
}: AcJobReminderTimelineProps) {
  const { t } = useLocale();
  const settings = settingsProp ?? loadNotificationSettings();

  if (!job.serviceDueDate) return null;

  const timeline = buildReminderTimeline(
    job.serviceDueDate,
    settings,
    logs,
    job.id,
  );
  const next = nextReminderEntry(timeline);

  if (!settings.autoSendServiceDueSms) {
    return (
      <div className="mt-2 rounded-lg border border-dashed border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
        <span className="font-medium">{t("jobs.reminders_off_short")}</span>
        {job.phone && (
          <span className="ml-2 text-slate-500">
            · {t("jobs.whatsapp_manual")}
          </span>
        )}
      </div>
    );
  }

  if (timeline.length === 0) return null;

  return (
    <div
      className={`mt-2 rounded-lg border border-sky-100 bg-sky-50/80 ${compact ? "px-2.5 py-2" : "px-3 py-2.5"}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-sky-900">
          📅 {t("jobs.reminder_timeline")}
        </p>
        {next && (
          <span className="text-[10px] font-medium text-sky-800">
            {t("jobs.next_sms")}: {next.remindOn}
          </span>
        )}
      </div>

      <ul className={`mt-2 space-y-1 ${compact ? "text-[11px]" : "text-xs"}`}>
        {timeline.map((entry) => (
          <li
            key={`${job.id}-${entry.daysBefore}`}
            className={`flex items-center justify-between gap-2 rounded-md border px-2 py-1 ${statusClass(entry.status)}`}
          >
            <span className="font-medium">
              {statusIcon(entry.status)}{" "}
              {entry.daysBefore === 0
                ? t("msg.remind_day_of")
                : t("msg.remind_days_before").replace(
                    "{{days}}",
                    String(entry.daysBefore),
                  )}
            </span>
            <span className="tabular-nums">{entry.remindOn}</span>
            <span className="shrink-0 text-[10px] uppercase opacity-80">
              {entry.status === "sent"
                ? t("jobs.reminder_sent")
                : entry.status === "due_today"
                  ? t("jobs.reminder_today")
                  : entry.status === "missed"
                    ? t("jobs.reminder_missed")
                    : t("jobs.reminder_pending")}
            </span>
          </li>
        ))}
      </ul>

      {job.phone && (
        <p className="mt-2 text-[10px] text-slate-500">
          SMS {t("jobs.reminder_auto")} · {t("jobs.whatsapp_manual")}
        </p>
      )}
    </div>
  );
}
