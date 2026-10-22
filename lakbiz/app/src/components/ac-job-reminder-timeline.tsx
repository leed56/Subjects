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
      return "•";
    case "missed":
      return "×";
    default:
      return "○";
  }
}

function statusClass(status: ReminderTimelineEntry["status"]): string {
  switch (status) {
    case "sent":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    case "due_today":
      return "border-amber-200 bg-amber-50 text-amber-800";
    case "missed":
      return "border-rose-200 bg-rose-50 text-rose-700";
    default:
      return "border-slate-200 bg-white text-slate-500";
  }
}

function reminderLabel(entry: ReminderTimelineEntry, t: (key: string) => string): string {
  return entry.daysBefore === 0
    ? t("msg.remind_day_of")
    : t("msg.remind_days_before").replace("{{days}}", String(entry.daysBefore));
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

  const timeline = buildReminderTimeline(job.serviceDueDate, settings, logs, job.id);
  const next = nextReminderEntry(timeline);

  // On job cards this is status metadata, not a second panel. Keep it quiet
  // so the customer, equipment and financial data remain the visual focus.
  if (!settings.autoSendServiceDueSms) {
    return (
      <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] font-medium text-slate-400">
        <span className="h-1.5 w-1.5 rounded-full bg-slate-300" aria-hidden="true" />
        <span>{t("jobs.reminders_off_short")}</span>
        {job.phone && <span>· {t("jobs.whatsapp_manual")}</span>}
      </div>
    );
  }

  if (timeline.length === 0) return null;

  return (
    <div className={`mt-3 flex flex-wrap items-center gap-1.5 ${compact ? "text-[10px]" : "text-[11px]"}`}>
      <span className="mr-0.5 font-semibold text-slate-500">SMS</span>
      {timeline.map((entry) => (
        <span
          key={`${job.id}-${entry.daysBefore}`}
          title={`${reminderLabel(entry, t)} · ${entry.remindOn}`}
          className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 font-semibold ${statusClass(entry.status)}`}
        >
          <span aria-hidden="true">{statusIcon(entry.status)}</span>
          <span>{entry.daysBefore === 0 ? t("msg.remind_day_of") : `${entry.daysBefore}d`}</span>
        </span>
      ))}
      {next && (
        <span className="ml-0.5 text-slate-400">
          {t("jobs.next_sms")}: <span className="tabular-nums text-slate-500">{next.remindOn}</span>
        </span>
      )}
    </div>
  );
}
