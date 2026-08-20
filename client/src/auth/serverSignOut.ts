/**
 * Robust server-side sign-out helper — canonical implementation.
 *
 * WHY (Evil-hunt 2026-08-20 P0-A):
 * The previous inline logout call did:
 *   await fetch(getApiUrl('/api/auth/signout'), { method: 'POST', ... });
 * and then unconditionally proceeded to signOut(auth) + redirect.
 * fetch() resolves on ANY HTTP status — 401/403/500 all look successful
 * to unchecked code. When the server returned 403 (CSRF), 401 (stale
 * token), or 500 (transient), the __session HttpOnly cookie stayed on
 * the device for its full 14-day TTL. The next user on the same browser
 * inherited the previous user's server session while Firebase was
 * signed out — a classic session-fixation / privilege-carryover bug.
 *
 * Contract:
 *  - Response.ok is checked. Only 2xx counts as success.
 *  - On 401/403, force-refresh the Firebase ID token once and retry.
 *  - On persistent failure (still !ok, or fetch threw), persist a
 *    `pw_logout_pending` sentinel to localStorage. On next app boot,
 *    `drainPendingLogout` finishes the server-side cookie destruction
 *    BEFORE onAuthStateChanged is allowed to restore any session.
 *
 * The module is intentionally React-free and takes its dependencies as
 * arguments so it can be exercised by behavioral tests without a DOM.
 */

export const LOGOUT_PENDING_KEY = 'pw_logout_pending';

export const DEFAULT_SIGNOUT_PATH = '/api/auth/signout';

export interface LogoutPendingRecord {
  uid: string | null;
  timestamp: number;
}

export interface SignOutDeps {
  /** Injected fetch. Defaults to globalThis.fetch. */
  fetchImpl?: typeof fetch;
  /** Injected Storage. Defaults to globalThis.localStorage. */
  storage?: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
  /** Logger. Defaults to no-op. */
  logger?: {
    debug?: (...a: unknown[]) => void;
    info?: (...a: unknown[]) => void;
    warn?: (...a: unknown[]) => void;
    error?: (...a: unknown[]) => void;
  };
  /** Endpoint URL (or relative path). Defaults to /api/auth/signout. */
  endpoint?: string;
}

const NOOP_LOGGER = {
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
};

function resolveDeps(deps?: SignOutDeps) {
  const fetchImpl =
    deps?.fetchImpl ??
    (typeof globalThis !== 'undefined'
      ? (globalThis.fetch?.bind(globalThis) as typeof fetch | undefined)
      : undefined);
  const storage =
    deps?.storage ??
    (typeof globalThis !== 'undefined' && (globalThis as any).localStorage
      ? ((globalThis as any).localStorage as Storage)
      : undefined);
  const logger = { ...NOOP_LOGGER, ...(deps?.logger ?? {}) };
  const endpoint = deps?.endpoint ?? DEFAULT_SIGNOUT_PATH;
  return { fetchImpl, storage, logger, endpoint };
}

function writePendingSentinel(
  storage: SignOutDeps['storage'] | undefined,
  uid: string | null,
): void {
  if (!storage) return;
  try {
    const record: LogoutPendingRecord = { uid, timestamp: Date.now() };
    storage.setItem(LOGOUT_PENDING_KEY, JSON.stringify(record));
  } catch {
    /* storage full / disabled — best-effort only */
  }
}

function clearPendingSentinel(storage: SignOutDeps['storage'] | undefined): void {
  if (!storage) return;
  try {
    storage.removeItem(LOGOUT_PENDING_KEY);
  } catch {
    /* ignore */
  }
}

export function readPendingSentinel(
  storage?: SignOutDeps['storage'],
): LogoutPendingRecord | null {
  const store =
    storage ??
    (typeof globalThis !== 'undefined' && (globalThis as any).localStorage
      ? ((globalThis as any).localStorage as Storage)
      : undefined);
  if (!store) return null;
  try {
    const raw = store.getItem(LOGOUT_PENDING_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<LogoutPendingRecord>;
    if (typeof parsed !== 'object' || parsed === null) return null;
    return {
      uid: typeof parsed.uid === 'string' ? parsed.uid : null,
      timestamp: typeof parsed.timestamp === 'number' ? parsed.timestamp : 0,
    };
  } catch {
    return null;
  }
}

/**
 * POST /api/auth/signout with Bearer token (if available), with a single
 * 401/403 refresh-retry. Returns whether the server acknowledged with 2xx.
 * NEVER throws. Persists the pw_logout_pending sentinel on failure.
 */
export async function performServerSignOut(opts: {
  uid?: string | null;
  /** Return the current cached Firebase ID token (best-effort). */
  getIdToken?: () => Promise<string | null | undefined>;
  /** Force-refresh the ID token; called on 401/403 retry. */
  forceRefreshIdToken?: () => Promise<string | null | undefined>;
  deps?: SignOutDeps;
}): Promise<{ ok: boolean; status?: number }> {
  const { fetchImpl, storage, logger, endpoint } = resolveDeps(opts.deps);

  if (!fetchImpl) {
    logger.error?.('[serverSignOut] no fetch implementation available');
    writePendingSentinel(storage, opts.uid ?? null);
    return { ok: false };
  }

  const buildHeaders = (token?: string | null): HeadersInit | undefined => {
    if (token) return { Authorization: `Bearer ${token}` };
    return undefined;
  };

  const doPost = async (token?: string | null): Promise<Response> => {
    return fetchImpl(endpoint, {
      method: 'POST',
      credentials: 'include',
      headers: buildHeaders(token),
    });
  };

  let firstToken: string | null | undefined;
  try {
    firstToken = (await opts.getIdToken?.()) ?? undefined;
  } catch {
    firstToken = undefined;
  }

  // NOTE: If Bearer cannot be obtained, no client-side CSRF helper exists
  // in this repo (grepped for getCsrfToken / X-CSRF-Token). We do NOT
  // invent one here — we send the request without auth headers. The
  // server will reject with 403 (CSRF) and the sentinel will trigger a
  // boot-time retry once Firebase re-resolves an ID token.

  try {
    let response = await doPost(firstToken);

    if (!response.ok && (response.status === 401 || response.status === 403)) {
      logger.warn?.('[serverSignOut] first attempt rejected — refreshing token', {
        status: response.status,
      });
      let refreshed: string | null | undefined;
      try {
        refreshed = (await opts.forceRefreshIdToken?.()) ?? undefined;
      } catch (err) {
        logger.warn?.('[serverSignOut] token refresh failed', err);
        refreshed = undefined;
      }
      response = await doPost(refreshed ?? firstToken);
    }

    if (response.ok) {
      clearPendingSentinel(storage);
      logger.info?.('[serverSignOut] server session invalidated', {
        status: response.status,
      });
      return { ok: true, status: response.status };
    }

    logger.error?.('[serverSignOut] server rejected sign-out after retry', {
      status: response.status,
    });
    writePendingSentinel(storage, opts.uid ?? null);
    return { ok: false, status: response.status };
  } catch (err) {
    logger.warn?.('[serverSignOut] network error during sign-out', err);
    writePendingSentinel(storage, opts.uid ?? null);
    return { ok: false };
  }
}

/**
 * Boot-time drain. If a pw_logout_pending sentinel is present from a
 * previous session, POST /api/auth/signout again (with any current ID
 * token, or unauthenticated as a last resort) and clear the sentinel
 * only on 2xx. Must run BEFORE onAuthStateChanged is subscribed so the
 * server-side cookie cannot leak into a newly-restored session.
 */
export async function drainPendingLogout(opts: {
  getIdToken?: () => Promise<string | null | undefined>;
  forceRefreshIdToken?: () => Promise<string | null | undefined>;
  deps?: SignOutDeps;
}): Promise<{ drained: boolean; ok?: boolean }> {
  const { storage, logger } = resolveDeps(opts.deps);
  const pending = readPendingSentinel(storage);
  if (!pending) return { drained: false };

  logger.info?.('[serverSignOut] draining pending logout from previous session', {
    uid: pending.uid,
    ageMs: Date.now() - pending.timestamp,
  });

  const result = await performServerSignOut({
    uid: pending.uid,
    getIdToken: opts.getIdToken,
    forceRefreshIdToken: opts.forceRefreshIdToken,
    deps: opts.deps,
  });
  return { drained: true, ok: result.ok };
}
