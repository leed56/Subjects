/**
 * Select only the sale stock movements created by this operation. Explicit
 * IDs avoid matching unrelated movements by a shortened bill-number fragment.
 */
export function selectNewSaleStockLogs<T extends { id: string; type: string }>(
  logs: T[],
  newStockLogIds: string[],
): T[] {
  const ids = new Set(newStockLogIds);
  if (ids.size === 0) return [];
  return logs.filter((log) => log.type === "sale" && ids.has(log.id));
}

/**
 * Convert both Supabase's returned errors and thrown transport/client errors
 * into one retryable result. The local sale is already persisted before this
 * helper runs, so callers must not turn a cloud failure into a failed sale.
 */
export async function captureSaleCloudSyncError(
  sync: () => Promise<string | null>,
): Promise<string | null> {
  try {
    return await sync();
  } catch (error) {
    return error instanceof Error ? error.message : "Cloud sync failed";
  }
}
