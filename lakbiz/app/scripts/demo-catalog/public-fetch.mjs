// Bounded recovery for public source outages. The caller checks robots before
// entering this helper; access-denied responses are never retried.
const transientStatuses = new Set([429, 500, 502, 503, 504]);
class PublicFetchError extends Error {
  constructor(response, url) {
    super(`${response.status} ${response.statusText}: ${url}`);
    this.status = response.status;
    this.retryAfter = response.headers.get("retry-after");
  }
}

function retryDelay(error, attempt, now) {
  const fallback = Math.min(30000, 1000 * 2 ** (attempt - 1));
  if (!(error instanceof PublicFetchError) || !error.retryAfter) return fallback;
  const seconds = Number(error.retryAfter);
  const delay = Number.isFinite(seconds)
    ? seconds * 1000
    : Date.parse(error.retryAfter) - now();
  return Number.isFinite(delay) ? Math.min(30000, Math.max(fallback, delay)) : fallback;
}

export async function fetchPublicText(url, {
  fetchImpl = globalThis.fetch,
  headers = {},
  beforeAttempt = async () => {},
  wait = (ms) => new Promise(resolve => setTimeout(resolve, ms)),
  onRetry = () => {},
  now = Date.now,
  maxAttempts = 3,
  timeoutMs = 20000,
} = {}) {
  if (!Number.isInteger(maxAttempts) || maxAttempts < 1 || maxAttempts > 5 || !Number.isFinite(timeoutMs) || timeoutMs <= 0)
    throw new Error("Invalid public fetch retry limits");
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    await beforeAttempt();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    let failure;
    try {
      const response = await fetchImpl(url, { headers, redirect: "follow", signal: controller.signal });
      if (!response.ok) {
        const error = new PublicFetchError(response, url);
        if (response.body) await response.body.cancel().catch(() => {});
        throw error;
      }
      return await response.text();
    } catch (error) {
      const retryable = error instanceof PublicFetchError
        ? transientStatuses.has(error.status)
        : error instanceof TypeError || error?.name === "AbortError" || error?.name === "TimeoutError";
      if (!retryable || attempt === maxAttempts) throw error;
      failure = error;
    } finally {
      clearTimeout(timer);
    }
    const delay = retryDelay(failure, attempt, now);
    onRetry({ url, attempt, maxAttempts, delay, error: failure });
    await wait(delay);
  }
}
