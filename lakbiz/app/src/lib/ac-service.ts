import type { AppData } from "@/lib/store/types";

/** AC maintenance scheduling helpers */

export const DEFAULT_SERVICE_INTERVAL_MONTHS = 6;

export function addMonths(isoDate: string, months: number): string {
  const d = new Date(`${isoDate.slice(0, 10)}T12:00:00`);
  d.setMonth(d.getMonth() + months);
  return d.toISOString().slice(0, 10);
}

export function computeServiceDueDate(
  installedDate: string,
  intervalMonths = DEFAULT_SERVICE_INTERVAL_MONTHS,
): string {
  return addMonths(installedDate, intervalMonths);
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
