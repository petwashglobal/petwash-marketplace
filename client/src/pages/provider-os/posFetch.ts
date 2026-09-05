/**
 * ProviderOS fetch helper — attaches the Firebase Bearer token and FAILS LOUD.
 *
 * Two bugs this replaces, both live on /provider-os (the surface that the
 * walker, sitter, groomer and contractor dashboards all redirect to):
 *
 * 1. NO TOKEN. The local `fetchWithAuth` helpers sent `credentials: 'include'`
 *    only. `server/routes/provider-dashboard-v2.ts:35` accepts a Bearer header
 *    and nothing else, so every accept / decline / start / cancel / complete /
 *    payout-request came back 401 "Authentication required".
 *
 * 2. NO res.ok CHECK. They ended in `.then(r => r.json())`, so that 401 body
 *    resolved as a normal value, react-query called `onSuccess`, and the
 *    provider saw "Job accepted" while the server had written nothing.
 *
 * POSCalendar.tsx and POSServices.tsx already attached the token (with a
 * comment about this exact 401) but still skipped the res.ok check. This is
 * the one helper both halves of that fix live in.
 */
import { auth } from '@/lib/firebase';

export class PosFetchError extends Error {
  constructor(public status: number, message: string, public body?: any) {
    super(message);
    this.name = 'PosFetchError';
  }
}

/** Human-readable message for a failed ProviderOS call. */
function messageFor(status: number, body: any): string {
  const serverMsg = body?.error || body?.message;
  if (status === 401) return 'Your session expired. Please sign in again.';
  if (status === 403) return serverMsg || 'You are not allowed to do that.';
  if (status === 404) return serverMsg || 'That job no longer exists. Refresh and try again.';
  if (status === 409) return serverMsg || 'That job already changed. Refresh and try again.';
  if (status === 429) return 'Too many requests. Please wait a moment and try again.';
  if (status >= 500) return 'Something went wrong on our end. Please try again.';
  return serverMsg || `Request failed (${status}).`;
}

export async function posFetch<T = any>(url: string, opts?: RequestInit): Promise<T> {
  const token = await auth?.currentUser?.getIdToken().catch(() => null);
  const res = await fetch(url, {
    ...opts,
    credentials: 'include',
    headers: {
      ...(opts?.headers || {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

  if (!res.ok) {
    let body: any = null;
    try { body = await res.json(); } catch { /* non-JSON error body */ }
    throw new PosFetchError(res.status, messageFor(res.status, body), body);
  }

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}
