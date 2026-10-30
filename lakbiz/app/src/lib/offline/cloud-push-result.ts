export type CloudPushResult = { err: string | null; conflict: boolean };

/**
 * Keep the sync state machine alive when a cloud operation throws instead of
 * returning its normal error result. A thrown failure remains retryable.
 */
export async function captureCloudPushResult(
  sync: () => Promise<CloudPushResult>,
): Promise<CloudPushResult> {
  try {
    return await sync();
  } catch (error) {
    return {
      err: error instanceof Error ? error.message : "Cloud sync failed",
      conflict: false,
    };
  }
}
