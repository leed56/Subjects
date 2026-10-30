/** True only for a verified, non-negative PostgreSQL sync generation. */
export function isValidSyncGeneration(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

/** Compare two verified generations without treating invalid sentinels as stable. */
export function isSameSyncGeneration(before: unknown, after: unknown): boolean {
  return isValidSyncGeneration(before) && isValidSyncGeneration(after) && before === after;
}
