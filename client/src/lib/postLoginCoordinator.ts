/**
 * postLoginCoordinator.ts
 *
 * SINGLE canonical pipeline for POST /api/auth/post-login on the client.
 *
 * Issue #153 deep-forensic finding (PR-FRES-B):
 *   Seven independent client call sites fire POST /api/auth/post-login
 *   with no coordination — every one races every other on every sign-in:
 *
 *     SignIn.tsx:164          (navigatePostLogin)
 *     SignUp.tsx:58           (navigatePostLogin)
 *     SignUp.tsx:257          (performOAuthSignup new-user profile sync)
 *     SignUp.tsx:423          (handlePhoneNameSubmit)
 *     GoogleOneTap.tsx:144    (setTimeout(500ms) post-One-Tap)
 *     useAccountNavigation:155 (account-tab tap, sticky-paths gated)
 *     NotificationConsent:30   (consent gate)
 *     CompleteProfile:192      (profile complete)
 *
 *   Symptom (CEO Nir, iPhone Safari): "Become Provider appears for ~1s
 *   then bounces to /home" — two callers concurrently fetched post-login,
 *   each got a (potentially different) nextUrl, each called navigate,
 *   browser kept the last one. V1+V2+V3+V4 fixed individual races but
 *   the structural problem — no coordination layer — remained.
 *
 * Behaviour:
 *   1. Single-flight de-duplication.
 *      Concurrent callers with identical (body, idToken) signature share
 *      ONE in-flight Promise. Two simultaneous resolvePostLogin() calls
 *      produce ONE network request.
 *   2. 30 s result cache for the common "give me nextUrl" form.
 *      Cacheable when body is empty or contains only `intent`.
 *      Cache key includes body signature + idToken tail so that, for
 *      example, intent='provider' and intent='loyalty' do not collide
 *      and cannot reuse each other's result.
 *      Profile-write bodies (firstName, displayName, etc.) are NEVER
 *      cached — each invocation makes a fresh request.
 *   3. Fail-closed.
 *      Network errors propagate. Non-2xx responses are returned with
 *      ok:false / status set so callers can branch. No silent /home
 *      fallback inside the coordinator — callers decide their own
 *      fallback.
 *
 * Usage:
 *   import { resolvePostLogin, invalidatePostLoginCache } from '@/lib/postLoginCoordinator';
 *
 *   const { nextUrl, redirectTo, ok, status } = await resolvePostLogin({
 *     body: { intent: localStorage.getItem('signup_intent') || undefined },
 *     idToken: await user?.getIdToken?.(),
 *   });
 *   if (ok && nextUrl) navigate(nextUrl); else navigate('/home');
 *
 * On sign-out, callers must call invalidatePostLoginCache() so a
 * subsequent different user does not inherit the previous user's
 * cached nextUrl.
 */

import { getApiUrl } from '@/lib/apiConfig';
import { logger } from '@/lib/logger';

export interface PostLoginRequestBody {
  intent?: string;
  uid?: string;
  email?: string;
  displayName?: string;
  photoURL?: string;
  provider?: string;
  isNewUser?: boolean;
  firstName?: string;
  lastName?: string;
  [key: string]: unknown;
}

export interface PostLoginResult {
  nextUrl?: string;
  redirectTo?: string;
  ok: boolean;
  status: number;
  raw: any;
}

export interface ResolvePostLoginOptions {
  body?: PostLoginRequestBody;
  idToken?: string;
}

export const POST_LOGIN_CACHE_TTL_MS = 30_000;

interface CacheEntry {
  result: PostLoginResult;
  expiresAt: number;
}

interface InFlightEntry {
  promise: Promise<PostLoginResult>;
}

const cache = new Map<string, CacheEntry>();
const inFlight = new Map<string, InFlightEntry>();

function bodySignature(body: PostLoginRequestBody | undefined): string {
  if (!body) return '';
  const keys = Object.keys(body).sort();
  if (keys.length === 0) return '';
  const stable: Record<string, unknown> = {};
  for (const k of keys) stable[k] = body[k];
  return JSON.stringify(stable);
}

function tokenSignature(idToken: string | undefined): string {
  if (!idToken || typeof idToken !== 'string') return 'no-token';
  return idToken.slice(-16);
}

function buildKey(body: PostLoginRequestBody | undefined, idToken: string | undefined): string {
  return `${tokenSignature(idToken)}::${bodySignature(body)}`;
}

function isCacheableBody(body: PostLoginRequestBody | undefined): boolean {
  if (!body) return true;
  const keys = Object.keys(body);
  if (keys.length === 0) return true;
  if (keys.length === 1 && keys[0] === 'intent') return true;
  return false;
}

export async function resolvePostLogin(
  opts: ResolvePostLoginOptions = {},
): Promise<PostLoginResult> {
  const { body, idToken } = opts;
  const key = buildKey(body, idToken);

  if (isCacheableBody(body)) {
    const hit = cache.get(key);
    if (hit && hit.expiresAt > Date.now()) {
      return hit.result;
    }
  }

  const existing = inFlight.get(key);
  if (existing) {
    return existing.promise;
  }

  const promise = (async (): Promise<PostLoginResult> => {
    try {
      const headers: Record<string, string> = {};
      const hasBody = !!body && Object.keys(body).length > 0;
      if (hasBody) headers['Content-Type'] = 'application/json';
      if (idToken) headers.Authorization = `Bearer ${idToken}`;

      const res = await fetch(getApiUrl('/api/auth/post-login'), {
        method: 'POST',
        credentials: 'include',
        headers,
        body: hasBody ? JSON.stringify(body) : undefined,
      });

      let data: any = null;
      try {
        data = await res.json();
      } catch {
        // Non-JSON response is acceptable — leave data null.
      }

      const result: PostLoginResult = {
        nextUrl: typeof data?.nextUrl === 'string' ? data.nextUrl : undefined,
        redirectTo: typeof data?.redirectTo === 'string' ? data.redirectTo : undefined,
        ok: res.ok,
        status: res.status,
        raw: data,
      };

      if (res.ok && isCacheableBody(body)) {
        cache.set(key, { result, expiresAt: Date.now() + POST_LOGIN_CACHE_TTL_MS });
      }

      return result;
    } catch (err: any) {
      logger.warn('[postLoginCoordinator] network error', { err: String(err?.message || err) });
      throw err;
    } finally {
      inFlight.delete(key);
    }
  })();

  inFlight.set(key, { promise });
  return promise;
}

export function invalidatePostLoginCache(): void {
  cache.clear();
  inFlight.clear();
}

export function __postLoginCoordinatorTestReset(): void {
  cache.clear();
  inFlight.clear();
}
