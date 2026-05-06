/**
 * fetchWithRetry — bounded retries for the cold-start 503 case.
 *
 * Cloud Run cold starts gate /api/* with a startup-readiness middleware
 * that returns 503 ("Server is initializing routes…") until route
 * registration completes. The client absorbs this with a bounded retry
 * budget so the user does not see a raw 503 toast for a transient warmup.
 *
 * Mobile Safari/iOS often hits the API immediately after the app shell loads,
 * while Cloud Run is still waking. The previous 5.6 s retry budget was too
 * short for production cold starts. This keeps retries bounded, but gives the
 * backend about 22 s to become ready before surfacing the error.
 *
 * Pure module — no Firebase imports — so tests can import this without
 * pulling the entire app boot chain.
 */

/**
 * Backoff schedule. Five retries, exponential-ish. Total max wait
 * before giving up: 800 + 1600 + 3200 + 6400 + 10000 = 22_000 ms.
 */
export const FETCH_RETRY_503_DELAYS_MS: readonly number[] = [800, 1600, 3200, 6400, 10000];

export async function fetchWithRetry(
  url: string,
  options: RequestInit,
  retries: number = FETCH_RETRY_503_DELAYS_MS.length,
): Promise<Response> {
  // SSRF guard: reject cross-origin absolute URLs in the browser.
  if (url && (url.startsWith('http://') || url.startsWith('https://'))) {
    if (typeof window !== 'undefined') {
      const parsedUrl = new URL(url);
      if (parsedUrl.origin !== window.location.origin) {
        throw new Error(`Blocked request to disallowed external URL: ${parsedUrl.origin}`);
      }
    }
  }

  const res = await fetch(url, options);
  if (res.status === 503 && retries > 0) {
    const attempt = FETCH_RETRY_503_DELAYS_MS.length - retries;
    const wait = FETCH_RETRY_503_DELAYS_MS[attempt] ?? FETCH_RETRY_503_DELAYS_MS[FETCH_RETRY_503_DELAYS_MS.length - 1];
    await new Promise(r => setTimeout(r, wait));
    return fetchWithRetry(url, options, retries - 1);
  }
  return res;
}
