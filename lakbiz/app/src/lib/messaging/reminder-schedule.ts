import { addDaysToDate, daysUntilDate } from "@/lib/ac-service";
import type { NotificationLogEntry, NotificationSettings } from "./types";

export type ReminderTimelineEntry = {
  daysBefore: number;
  remindOn: string;
  status: "sent" | "due_today" | "upcoming" | "missed";
};

const CUSTOMER_REMINDER_TEMPLATES = new Set([
  "job_service_due",
  "job_service_due_upcoming",
  "job_service_due_today",
]);

export function computeRemindOnDate(
  serviceDueDate: string,
  daysBefore: number,
): string {
  return addDaysToDate(serviceDueDate, -daysBefore);
}

export function buildReminderTimeline(
  serviceDueDate: string | undefined,
  settings: Pick<
    NotificationSettings,
    "serviceDueRemindDays" | "autoSendServiceDueSms"
  >,
  logs: NotificationLogEntry[],
  jobId: string,
): ReminderTimelineEntry[] {
  if (!serviceDueDate || !settings.autoSendServiceDueSms) return [];

  const today = new Date().toISOString().slice(0, 10);
  const jobLogs = logs.filter(
    (l) =>
      l.contextId === jobId &&
      l.delivery !== "api_failed" &&
      (l.channel === "api_sms" || l.delivery === "api_sent"),
  );

  return [...settings.serviceDueRemindDays]
    .sort((a, b) => b - a)
    .map((daysBefore) => {
      const remindOn = computeRemindOnDate(serviceDueDate, daysBefore);
      const sent = jobLogs.some(
        (l) =>
          CUSTOMER_REMINDER_TEMPLATES.has(l.templateId) &&
          l.sentAt.slice(0, 10) === remindOn,
      );

      let status: ReminderTimelineEntry["status"];
      if (sent) status = "sent";
      else if (remindOn < today) status = "missed";
      else if (remindOn === today) status = "due_today";
      else status = "upcoming";

      return { daysBefore, remindOn, status };
    });
}

export function nextReminderEntry(
  timeline: ReminderTimelineEntry[],
): ReminderTimelineEntry | null {
  const pending = timeline.filter(
    (e) => e.status === "upcoming" || e.status === "due_today",
  );
  if (pending.length === 0) return null;
  return pending.sort((a, b) => a.remindOn.localeCompare(b.remindOn))[0];
}

export function daysUntilNextReminder(
  serviceDueDate: string | undefined,
  remindDays: number[],
): number | null {
  if (!serviceDueDate || remindDays.length === 0) return null;
  const today = new Date().toISOString().slice(0, 10);
  const upcoming = remindDays
    .map((d) => computeRemindOnDate(serviceDueDate, d))
    .filter((d) => d >= today)
    .sort();
  if (upcoming.length === 0) return null;
  return daysUntilDate(upcoming[0]);
}
