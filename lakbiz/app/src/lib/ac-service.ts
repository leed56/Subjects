import type { AppData } from "@/lib/store/types";

/** AC maintenance scheduling helpers */

export const DEFAULT_SERVICE_INTERVAL_MONTHS = 6;
export const DEFAULT_SERVICE_INTERVAL_DAYS = 180;

/** Common AC service cycles in Sri Lanka */
export const SERVICE_INTERVAL_DAY_PRESETS = [90, 180, 365] as const;

export function addDaysToDate(isoDate: string, days: number): string {
  const d = new Date(`${isoDate.slice(0, 10)}T12:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export function addMonths(isoDate: string, months: number): string {
  const d = new Date(`${isoDate.slice(0, 10)}T12:00:00`);
  d.setMonth(d.getMonth() + months);
  return d.toISOString().slice(0, 10);
}

export function computeServiceDueFromDays(
  baseDate: string,
  intervalDays = DEFAULT_SERVICE_INTERVAL_DAYS,
): string {
  return addDaysToDate(baseDate, intervalDays);
}

/** @deprecated prefer computeServiceDueFromDays */
export function computeServiceDueDate(
  installedDate: string,
  intervalMonths = DEFAULT_SERVICE_INTERVAL_MONTHS,
): string {
  return addMonths(installedDate, intervalMonths);
}

export function resolveServiceIntervalDays(job: {
  serviceIntervalDays?: number;
  serviceIntervalMonths?: number;
}): number {
  if (job.serviceIntervalDays != null && job.serviceIntervalDays > 0) {
    return job.serviceIntervalDays;
  }
  if (job.serviceIntervalMonths != null && job.serviceIntervalMonths > 0) {
    return job.serviceIntervalMonths * 30;
  }
  return DEFAULT_SERVICE_INTERVAL_DAYS;
}

export function daysUntilDate(dateStr: string): number {
  const target = new Date(`${dateStr.slice(0, 10)}T12:00:00`);
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  return Math.ceil((target.getTime() - today.getTime()) / 86400000);
}

export function isServiceOverdue(serviceDueDate?: string): boolean {
  if (!serviceDueDate) return false;
  return daysUntilDate(serviceDueDate) < 0;
}

export function isServiceDueWithinDays(
  serviceDueDate: string | undefined,
  days: number,
): boolean {
  if (!serviceDueDate) return false;
  const d = daysUntilDate(serviceDueDate);
  return d <= days;
}

export type ServiceDueUrgency = "ok" | "soon" | "today" | "overdue";

export function serviceDueUrgency(serviceDueDate?: string): ServiceDueUrgency {
  if (!serviceDueDate) return "ok";
  const days = daysUntilDate(serviceDueDate);
  if (days < 0) return "overdue";
  if (days === 0) return "today";
  if (days <= 7) return "soon";
  return "ok";
}

export function serviceDueUrgencyClass(urgency: ServiceDueUrgency): string {
  switch (urgency) {
    case "overdue":
      return "border-red-200 bg-red-50 text-red-800";
    case "today":
      return "border-amber-300 bg-amber-50 text-amber-900";
    case "soon":
      return "border-orange-200 bg-orange-50 text-orange-800";
    default:
      return "border-emerald-200 bg-emerald-50 text-emerald-800";
  }
}

/** Default: 14, 7, 2 days before + on service day */
export const DEFAULT_SERVICE_DUE_REMIND_DAYS: number[] = [14, 7, 2, 0];

export function serviceDueLabel(
  serviceDueDate: string | undefined,
  locale: "si" | "en",
): string {
  if (!serviceDueDate) return "";
  const days = daysUntilDate(serviceDueDate);
  if (days < 0) {
    return locale === "si"
      ? `${Math.abs(days)} දින ඉකුත්`
      : `${Math.abs(days)} days overdue`;
  }
  if (days === 0) {
    return locale === "si" ? "අද" : "Today";
  }
  if (days === 1) {
    return locale === "si" ? "හෙට" : "Tomorrow";
  }
  return locale === "si" ? `${days} දිනයි` : `In ${days} days`;
}

/** Jobs eligible for "Service done" workflow */
export function canMarkServiceDone(job: {
  status: string;
  jobType?: string;
}): boolean {
  if (
    job.status === "cancelled" ||
    job.status === "quote" ||
    job.status === "deposit_received"
  ) {
    return false;
  }
  if (["service_due", "installed", "completed"].includes(job.status)) {
    return true;
  }
  if (
    (job.jobType === "service" || job.jobType === "repair") &&
    job.status === "scheduled"
  ) {
    return true;
  }
  return false;
}

/** Bump jobs to service_due when their due date has arrived */
export function syncAcJobServiceStatuses(data: AppData): AppData {
  let changed = false;
  const acJobs = data.acJobs.map((j) => {
    if (!j.serviceDueDate) return j;
    if (
      ["cancelled", "quote", "deposit_received", "scheduled"].includes(j.status)
    ) {
      return j;
    }
    const due =
      isServiceOverdue(j.serviceDueDate) ||
      isServiceDueWithinDays(j.serviceDueDate, 0);
    if (due && j.status !== "service_due") {
      changed = true;
      return { ...j, status: "service_due" as const };
    }
    return j;
  });
  return changed ? { ...data, acJobs } : data;
}
