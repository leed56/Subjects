import type { AppData } from "@/lib/store/types";

const LOCAL_TOUCH_PREFIX = "lakbiz-local-touch";

export function touchLocalSyncWatermark(orgId: string | null | undefined): void {
  if (typeof window === "undefined" || !orgId) return;
  localStorage.setItem(`${LOCAL_TOUCH_PREFIX}-${orgId}`, new Date().toISOString());
}

export function getLocalSyncWatermark(orgId: string | null | undefined): number {
  if (typeof window === "undefined" || !orgId) return 0;
  const raw = localStorage.getItem(`${LOCAL_TOUCH_PREFIX}-${orgId}`);
  if (raw) return Date.parse(raw) || 0;
  return 0;
}

function maxIsoTimestamp(values: string[]): number {
  let max = 0;
  for (const value of values) {
    const ts = Date.parse(value);
    if (Number.isFinite(ts) && ts > max) max = ts;
  }
  return max;
}

/** Best-effort local edit time from touch marker + entity dates. */
export function localDataWatermark(data: AppData, orgId: string | null): number {
  const touch = getLocalSyncWatermark(orgId);
  const entityMax = maxIsoTimestamp([
    ...data.sales.map((s) => s.date),
    ...data.purchases.map((p) => p.date),
    ...data.stockLogs.map((l) => l.date),
    ...data.customerPayments.map((p) => p.date),
    ...data.supplierPayments.map((p) => p.date),
    ...data.acJobs.map((j) => j.date),
    ...data.vehicles.map((v) => v.dateAdded),
    ...data.vehicles.map((v) => v.soldDate ?? ""),
    ...data.bankTransactions.map((t) => t.date),
    ...data.bankTransfers.map((t) => t.date),
    ...data.jobStatusHistory.map((h) => h.date),
    ...data.contractorPayments.map((p) => p.date),
    ...data.cheques.map((c) => c.chequeDate),
  ]);
  return Math.max(touch, entityMax);
}
