import type { ACJob } from "@/lib/store/types";
import {
  daysUntilDate,
  isServiceDueWithinDays,
  isServiceOverdue,
} from "@/lib/ac-service";

export type AcInAppAlertKind = "overdue" | "due_today" | "upcoming";

export type AcInAppAlertPrefs = {
  overdue: boolean;
  dueToday: boolean;
  upcoming: boolean;
  upcomingDays: number;
};

export type AcInAppAlert = {
  id: string;
  kind: AcInAppAlertKind;
  jobId: string;
  jobNo: string;
  customerName: string;
  serviceDueDate: string;
};

const PREFS_KEY = "lakbiz-ac-in-app-alert-prefs-v1";
const SEEN_PREFIX = "lakbiz-ac-alerts-seen-v1";

export const defaultAcInAppAlertPrefs = (): AcInAppAlertPrefs => ({
  overdue: true,
  dueToday: true,
  upcoming: false,
  upcomingDays: 3,
});

function seenKey(orgId: string) {
  return `${SEEN_PREFIX}-${orgId}`;
}

export function loadAcInAppAlertPrefs(): AcInAppAlertPrefs {
  if (typeof localStorage === "undefined") return defaultAcInAppAlertPrefs();
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (!raw) return defaultAcInAppAlertPrefs();
    const row = JSON.parse(raw) as Partial<AcInAppAlertPrefs>;
    const defaults = defaultAcInAppAlertPrefs();
    return {
      overdue: row.overdue ?? defaults.overdue,
      dueToday: row.dueToday ?? defaults.dueToday,
      upcoming: row.upcoming ?? defaults.upcoming,
      upcomingDays:
        typeof row.upcomingDays === "number" && row.upcomingDays > 0
          ? row.upcomingDays
          : defaults.upcomingDays,
    };
  } catch {
    return defaultAcInAppAlertPrefs();
  }
}

export function saveAcInAppAlertPrefs(prefs: AcInAppAlertPrefs): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
}

export function loadAcAlertsSeen(orgId: string): Set<string> {
  if (typeof localStorage === "undefined" || !orgId) return new Set();
  try {
    const raw = localStorage.getItem(seenKey(orgId));
    if (!raw) return new Set();
    const ids = JSON.parse(raw) as string[];
    return new Set(Array.isArray(ids) ? ids : []);
  } catch {
    return new Set();
  }
}

export function saveAcAlertsSeen(orgId: string, seen: Set<string>): void {
  if (typeof localStorage === "undefined" || !orgId) return;
  localStorage.setItem(seenKey(orgId), JSON.stringify([...seen]));
}

function isTrackableAcJob(job: ACJob): boolean {
  if (!job.serviceDueDate) return false;
  return job.status !== "cancelled" && job.status !== "completed";
}

export function buildAcInAppAlerts(
  jobs: ACJob[],
  prefs: AcInAppAlertPrefs,
): AcInAppAlert[] {
  const alerts: AcInAppAlert[] = [];

  for (const job of jobs) {
    if (!isTrackableAcJob(job) || !job.serviceDueDate) continue;
    const due = job.serviceDueDate;
    const days = daysUntilDate(due);

    if (prefs.overdue && isServiceOverdue(due)) {
      alerts.push({
        id: `${job.id}-overdue`,
        kind: "overdue",
        jobId: job.id,
        jobNo: job.jobNo,
        customerName: job.customerName,
        serviceDueDate: due,
      });
      continue;
    }

    if (prefs.dueToday && days === 0) {
      alerts.push({
        id: `${job.id}-due_today`,
        kind: "due_today",
        jobId: job.id,
        jobNo: job.jobNo,
        customerName: job.customerName,
        serviceDueDate: due,
      });
      continue;
    }

    if (
      prefs.upcoming &&
      days > 0 &&
      isServiceDueWithinDays(due, prefs.upcomingDays)
    ) {
      alerts.push({
        id: `${job.id}-upcoming`,
        kind: "upcoming",
        jobId: job.id,
        jobNo: job.jobNo,
        customerName: job.customerName,
        serviceDueDate: due,
      });
    }
  }

  const order: Record<AcInAppAlertKind, number> = {
    overdue: 0,
    due_today: 1,
    upcoming: 2,
  };

  return alerts.sort(
    (a, b) =>
      order[a.kind] - order[b.kind] ||
      a.serviceDueDate.localeCompare(b.serviceDueDate),
  );
}

export function countUnreadAcAlerts(
  alerts: AcInAppAlert[],
  seen: Set<string>,
): number {
  return alerts.filter((alert) => !seen.has(alert.id)).length;
}
