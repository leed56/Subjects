import { isBrowserOnline } from "@/lib/offline/connectivity";

export const CLOUD_SYNC_MAX_RETRIES = 5;
export const CLOUD_SYNC_RETRY_BASE_MS = 2000;

export function cloudSyncRetryDelayMs(attempt: number): number {
  return CLOUD_SYNC_RETRY_BASE_MS * 2 ** attempt;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Retry while `shouldRetry(result)` is true (e.g. push returned an error). */
export async function withCloudSyncRetry<T>(
  fn: () => Promise<T>,
  shouldRetry: (result: T) => boolean,
  maxRetries = CLOUD_SYNC_MAX_RETRIES,
): Promise<T> {
  let last = await fn();
  for (let attempt = 0; attempt < maxRetries && shouldRetry(last); attempt++) {
    if (!isBrowserOnline()) return last;
    await sleep(cloudSyncRetryDelayMs(attempt));
    last = await fn();
  }
  return last;
}
