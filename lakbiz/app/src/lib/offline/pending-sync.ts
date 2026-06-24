export type OfflinePendingInfo = {
  since: number;
  changeCount: number;
};

const KEY_PREFIX = "lakbiz-offline-pending";

function key(orgId: string) {
  return `${KEY_PREFIX}-${orgId}`;
}

function read(orgId: string): OfflinePendingInfo | null {
  if (typeof localStorage === "undefined") return null;
  const raw = localStorage.getItem(key(orgId));
  if (!raw) return null;
  if (/^\d+$/.test(raw)) {
    return { since: Number(raw), changeCount: 1 };
  }
  try {
    const parsed = JSON.parse(raw) as OfflinePendingInfo;
    if (typeof parsed.since === "number" && typeof parsed.changeCount === "number") {
      return parsed;
    }
  } catch {
    /* ignore */
  }
  return null;
}

function write(orgId: string, info: OfflinePendingInfo): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(key(orgId), JSON.stringify(info));
}

/** Record one local edit made while offline (or before cloud save). */
export function bumpOfflinePendingChange(orgId: string): OfflinePendingInfo {
  const prev = read(orgId);
  const next: OfflinePendingInfo = {
    since: prev?.since ?? Date.now(),
    changeCount: (prev?.changeCount ?? 0) + 1,
  };
  write(orgId, next);
  return next;
}

/** Mark pending sync without incrementing (e.g. failed cloud push). */
export function touchOfflinePending(orgId: string): OfflinePendingInfo {
  const prev = read(orgId);
  if (prev) return prev;
  const next: OfflinePendingInfo = { since: Date.now(), changeCount: 1 };
  write(orgId, next);
  return next;
}

export function clearOfflinePendingSync(orgId: string): void {
  if (typeof localStorage === "undefined") return;
  localStorage.removeItem(key(orgId));
}

export function hasOfflinePendingSync(orgId: string): boolean {
  return read(orgId) != null;
}

export function getOfflinePendingSync(orgId: string): OfflinePendingInfo | null {
  return read(orgId);
}
