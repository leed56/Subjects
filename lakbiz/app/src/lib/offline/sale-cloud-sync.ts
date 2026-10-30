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
