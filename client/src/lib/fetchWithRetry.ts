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

/**
 * Origins an absolute API URL may point at besides the page's own origin.
 *
 * 2026-09-13 (P0, native apps): the native shell serves the bundle from
 * capacitor://localhost (iOS) / https://localhost (Android), and apiConfig
 * points native builds at https://petwash.co.il (#611, 2026-06-06). The guard
 * below compared against window.location.origin only, so EVERY apiRequest /
 * React Query call in the customer and provider apps threw "Blocked request to
 * disallowed external URL" before fetch — present in TestFlight build 15.
 * Our own API origins are allowed; anything else stays blocked.
 */
export function allowedApiOrigins(): string[] {
  const env = ((import.meta as any)?.env ?? {}) as Record<string, string | undefined>;
  const out = new Set<string>(['https://petwash.co.il']);
  for (const v of [env.VITE_API_URL, env.VITE_NATIVE_API_URL]) {
    if (!v) continue;
    try { out.add(new URL(v).origin); } catch { /* ignore malformed */ }
  }
  return Array.from(out);
}

/**
 * A 503 is retried only when it is the cold-start "still initializing" answer,
 * or the request is a safe GET/HEAD. A deliberate 503 on a POST
 * (ONLINE_CARD_NOT_LIVE, EGIFT_DISABLED, "Payments not enabled yet") used to be
 * replayed 5 times — a ~22 s spinner on the Pay button, and the server ran its
 * claim → session → rollback six times before the honest message showed.
 */
async function isRetryable503(res: Response, method: string): Promise<boolean> {
  if (method === 'GET' || method === 'HEAD') return true;
  try {
    const body = await res.clone().text();
    return /SERVICE_STARTING|initializ|starting up|warming/i.test(body);
  } catch {
    return false;
  }
}

export async function fetchWithRetry(
  url: string,
  options: RequestInit,
  retries: number = FETCH_RETRY_503_DELAYS_MS.length,
): Promise<Response> {
  // SSRF guard: reject cross-origin absolute URLs in the browser, except our own API.
  if (url && (url.startsWith('http://') || url.startsWith('https://'))) {
    if (typeof window !== 'undefined') {
      const parsedUrl = new URL(url);
      if (parsedUrl.origin !== window.location.origin && !allowedApiOrigins().includes(parsedUrl.origin)) {
        throw new Error(`Blocked request to disallowed external URL: ${parsedUrl.origin}`);
      }
    }
  }

  const res = await fetch(url, options);
  const method = String(options?.method || 'GET').toUpperCase();
  if (res.status === 503 && retries > 0 && (await isRetryable503(res, method))) {
    const attempt = FETCH_RETRY_503_DELAYS_MS.length - retries;
    const wait = FETCH_RETRY_503_DELAYS_MS[attempt] ?? FETCH_RETRY_503_DELAYS_MS[FETCH_RETRY_503_DELAYS_MS.length - 1];
    await new Promise(r => setTimeout(r, wait));
    return fetchWithRetry(url, options, retries - 1);
  }
  return res;
}
