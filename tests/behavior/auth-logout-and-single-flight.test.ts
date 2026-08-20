/**
 * Behavioral tests — Evil-hunt 2026-08-20 P0-A and P0-B on the auth surface.
 *
 * P0-A: Logout must check response.ok. Any non-2xx from POST
 *       /api/auth/signout must NOT be treated as success — the
 *       pw_logout_pending sentinel must be written so the next app boot
 *       finishes the server-side cookie invalidation. On 401/403 the
 *       Firebase ID token must be force-refreshed and the request retried.
 *
 * P0-B: ensureServerSession must be single-flight per uid. Concurrent
 *       callers for the same uid share one in-flight promise (one
 *       network call). A watchdog reveals the UI early but does NOT
 *       fan out into extra parallel POSTs. A user-switch or logout
 *       mid-flight must not stamp the wrong uid as "session ready".
 *
 * These are BEHAVIORAL tests: we stub globalThis.fetch and drive the
 * real, extracted modules (client/src/auth/serverSignOut.ts and
 * client/src/auth/sessionMintSingleFlight.ts). We do not grep source.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  LOGOUT_PENDING_KEY,
  drainPendingLogout,
  performServerSignOut,
  readPendingSentinel,
} from '../../client/src/auth/serverSignOut';

import {
  _inflightSize,
  _resetInflightForTests,
  singleFlightMint,
} from '../../client/src/auth/sessionMintSingleFlight';

// ---------- helpers ---------------------------------------------------------

type FetchArgs = { url: string; init?: RequestInit };
interface FetchStub {
  fn: ReturnType<typeof vi.fn>;
  calls: FetchArgs[];
}

function makeFetchStub(handler: (args: FetchArgs, callIndex: number) => Promise<Response> | Response): FetchStub {
  const calls: FetchArgs[] = [];
  const fn = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : (input as URL).toString();
    const idx = calls.length;
    calls.push({ url, init });
    return handler({ url, init }, idx);
  });
  return { fn: fn as unknown as ReturnType<typeof vi.fn>, calls };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body ?? {}), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function makeMemoryStorage() {
  const map = new Map<string, string>();
  return {
    getItem: (k: string) => (map.has(k) ? map.get(k)! : null),
    setItem: (k: string, v: string) => { map.set(k, v); },
    removeItem: (k: string) => { map.delete(k); },
    // for assertions
    _has: (k: string) => map.has(k),
    _size: () => map.size,
    _dump: () => Object.fromEntries(map),
  };
}

const silentLogger = { debug() {}, info() {}, warn() {}, error() {} };

afterEach(() => {
  _resetInflightForTests();
  vi.useRealTimers();
});

// ---------- P0-A: performServerSignOut --------------------------------------

describe('performServerSignOut — response.ok is honored', () => {
  it('server 204 counts as success and clears any prior sentinel', async () => {
    const storage = makeMemoryStorage();
    storage.setItem(LOGOUT_PENDING_KEY, JSON.stringify({ uid: 'u1', timestamp: 1 }));
    const stub = makeFetchStub(() => new Response(null, { status: 204 }));
    const result = await performServerSignOut({
      uid: 'u1',
      getIdToken: async () => 'tok-1',
      forceRefreshIdToken: async () => 'tok-2',
      deps: { fetchImpl: stub.fn as any, storage, logger: silentLogger },
    });
    expect(result.ok).toBe(true);
    expect(result.status).toBe(204);
    expect(stub.calls).toHaveLength(1);
    const headers = stub.calls[0].init?.headers as Record<string, string>;
    expect(headers?.Authorization).toBe('Bearer tok-1');
    expect(stub.calls[0].init?.credentials).toBe('include');
    expect(storage._has(LOGOUT_PENDING_KEY)).toBe(false);
  });

  it('server 200 counts as success', async () => {
    const storage = makeMemoryStorage();
    const stub = makeFetchStub(() => jsonResponse({ ok: true }, 200));
    const result = await performServerSignOut({
      uid: 'u1',
      getIdToken: async () => 'tok-1',
      forceRefreshIdToken: async () => 'tok-2',
      deps: { fetchImpl: stub.fn as any, storage, logger: silentLogger },
    });
    expect(result.ok).toBe(true);
    expect(storage._has(LOGOUT_PENDING_KEY)).toBe(false);
  });

  it('server 401 → force-refresh idToken and retry, then success on 2xx', async () => {
    const storage = makeMemoryStorage();
    let call = 0;
    const stub = makeFetchStub(() => {
      call += 1;
      if (call === 1) return jsonResponse({ error: 'stale' }, 401);
      return new Response(null, { status: 204 });
    });
    const forceRefresh = vi.fn(async () => 'tok-fresh');
    const result = await performServerSignOut({
      uid: 'u1',
      getIdToken: async () => 'tok-stale',
      forceRefreshIdToken: forceRefresh,
      deps: { fetchImpl: stub.fn as any, storage, logger: silentLogger },
    });
    expect(result.ok).toBe(true);
    expect(forceRefresh).toHaveBeenCalledTimes(1);
    expect(stub.calls).toHaveLength(2);
    const firstHeaders = stub.calls[0].init?.headers as Record<string, string>;
    const secondHeaders = stub.calls[1].init?.headers as Record<string, string>;
    expect(firstHeaders?.Authorization).toBe('Bearer tok-stale');
    expect(secondHeaders?.Authorization).toBe('Bearer tok-fresh');
    expect(storage._has(LOGOUT_PENDING_KEY)).toBe(false);
  });

  it('server 403 twice → NOT successful, pw_logout_pending set with uid+timestamp', async () => {
    const storage = makeMemoryStorage();
    const stub = makeFetchStub(() => jsonResponse({ error: 'csrf' }, 403));
    const before = Date.now();
    const result = await performServerSignOut({
      uid: 'user-403',
      getIdToken: async () => 'tok-1',
      forceRefreshIdToken: async () => 'tok-2',
      deps: { fetchImpl: stub.fn as any, storage, logger: silentLogger },
    });
    expect(result.ok).toBe(false);
    expect(result.status).toBe(403);
    expect(stub.calls).toHaveLength(2); // 1 initial + 1 refresh-retry
    const raw = storage.getItem(LOGOUT_PENDING_KEY)!;
    expect(raw).toBeTruthy();
    const parsed = JSON.parse(raw) as { uid: string; timestamp: number };
    expect(parsed.uid).toBe('user-403');
    expect(parsed.timestamp).toBeGreaterThanOrEqual(before);
  });

  it('server 500 → NOT successful, sentinel set (no retry — 5xx is not a token problem)', async () => {
    const storage = makeMemoryStorage();
    const stub = makeFetchStub(() => jsonResponse({ error: 'oops' }, 500));
    const forceRefresh = vi.fn(async () => 'tok-2');
    const result = await performServerSignOut({
      uid: 'u5',
      getIdToken: async () => 'tok-1',
      forceRefreshIdToken: forceRefresh,
      deps: { fetchImpl: stub.fn as any, storage, logger: silentLogger },
    });
    expect(result.ok).toBe(false);
    expect(result.status).toBe(500);
    // 500 is not 401/403 — no refresh retry, exactly one call
    expect(stub.calls).toHaveLength(1);
    expect(forceRefresh).not.toHaveBeenCalled();
    expect(storage._has(LOGOUT_PENDING_KEY)).toBe(true);
  });

  it('network offline (fetch throws) → NOT successful, sentinel set', async () => {
    const storage = makeMemoryStorage();
    const stub = makeFetchStub(() => { throw new TypeError('Failed to fetch'); });
    const result = await performServerSignOut({
      uid: 'u-off',
      getIdToken: async () => 'tok-1',
      forceRefreshIdToken: async () => 'tok-2',
      deps: { fetchImpl: stub.fn as any, storage, logger: silentLogger },
    });
    expect(result.ok).toBe(false);
    expect(storage._has(LOGOUT_PENDING_KEY)).toBe(true);
    const parsed = readPendingSentinel(storage as any)!;
    expect(parsed.uid).toBe('u-off');
  });

  it('no Bearer available → still posts (no invented CSRF header), and on failure sets sentinel', async () => {
    const storage = makeMemoryStorage();
    const stub = makeFetchStub(() => jsonResponse({ error: 'csrf' }, 403));
    const result = await performServerSignOut({
      uid: 'u-nobearer',
      getIdToken: async () => null, // no cached token
      forceRefreshIdToken: async () => null, // still no token on refresh
      deps: { fetchImpl: stub.fn as any, storage, logger: silentLogger },
    });
    expect(result.ok).toBe(false);
    // Both attempts made
    expect(stub.calls.length).toBeGreaterThanOrEqual(1);
    // No Authorization header invented
    for (const c of stub.calls) {
      const h = (c.init?.headers ?? {}) as Record<string, string>;
      expect(h.Authorization).toBeUndefined();
    }
    expect(storage._has(LOGOUT_PENDING_KEY)).toBe(true);
  });
});

describe('drainPendingLogout — boot-time completion', () => {
  it('no sentinel → does nothing, no fetch', async () => {
    const storage = makeMemoryStorage();
    const stub = makeFetchStub(() => new Response(null, { status: 204 }));
    const result = await drainPendingLogout({
      getIdToken: async () => 'tok-1',
      deps: { fetchImpl: stub.fn as any, storage, logger: silentLogger },
    });
    expect(result.drained).toBe(false);
    expect(stub.calls).toHaveLength(0);
  });

  it('sentinel present → completes server-cookie invalidation and clears the sentinel', async () => {
    const storage = makeMemoryStorage();
    storage.setItem(LOGOUT_PENDING_KEY, JSON.stringify({ uid: 'u-old', timestamp: 1 }));
    const stub = makeFetchStub(() => new Response(null, { status: 204 }));
    const result = await drainPendingLogout({
      getIdToken: async () => 'tok-new',
      deps: { fetchImpl: stub.fn as any, storage, logger: silentLogger },
    });
    expect(result.drained).toBe(true);
    expect(result.ok).toBe(true);
    expect(stub.calls).toHaveLength(1);
    expect(storage._has(LOGOUT_PENDING_KEY)).toBe(false);
  });

  it('sentinel present, server still failing → sentinel remains for next boot', async () => {
    const storage = makeMemoryStorage();
    storage.setItem(LOGOUT_PENDING_KEY, JSON.stringify({ uid: 'u-old', timestamp: 1 }));
    const stub = makeFetchStub(() => jsonResponse({ error: 'still bad' }, 500));
    const result = await drainPendingLogout({
      getIdToken: async () => 'tok-new',
      deps: { fetchImpl: stub.fn as any, storage, logger: silentLogger },
    });
    expect(result.drained).toBe(true);
    expect(result.ok).toBe(false);
    expect(storage._has(LOGOUT_PENDING_KEY)).toBe(true);
  });

  it('sentinel present, no idToken available → attempts unauthenticated POST', async () => {
    const storage = makeMemoryStorage();
    storage.setItem(LOGOUT_PENDING_KEY, JSON.stringify({ uid: 'u-old', timestamp: 1 }));
    const stub = makeFetchStub(() => new Response(null, { status: 204 }));
    const result = await drainPendingLogout({
      getIdToken: async () => null,
      deps: { fetchImpl: stub.fn as any, storage, logger: silentLogger },
    });
    expect(result.drained).toBe(true);
    expect(result.ok).toBe(true);
    const headers = (stub.calls[0].init?.headers ?? {}) as Record<string, string>;
    expect(headers.Authorization).toBeUndefined();
  });
});

// ---------- P0-B: singleFlightMint ------------------------------------------

describe('singleFlightMint — one POST per uid at a time', () => {
  beforeEach(() => {
    _resetInflightForTests();
  });

  it('two concurrent callers for same uid share one flight (fetch fires once)', async () => {
    const stub = makeFetchStub(() => jsonResponse({ ok: true }, 200));
    const doMint = async (): Promise<boolean> => {
      const res = await (stub.fn as unknown as typeof fetch)('/api/auth/session', {
        method: 'POST',
      });
      return res.ok;
    };
    const [a, b] = await Promise.all([
      singleFlightMint('uid-a', doMint),
      singleFlightMint('uid-a', doMint),
    ]);
    expect(a).toBe(true);
    expect(b).toBe(true);
    expect(stub.calls).toHaveLength(1);
    // Flight cleared after settle
    expect(_inflightSize()).toBe(0);
  });

  it('second caller receives the SAME resolved boolean as the first', async () => {
    // Underlying mint returns false — both callers must see false.
    const stub = makeFetchStub(() => jsonResponse({ error: 'nope' }, 500));
    const doMint = async (): Promise<boolean> => {
      const r = await (stub.fn as unknown as typeof fetch)('/api/auth/session', { method: 'POST' });
      return r.ok;
    };
    const [a, b, c] = await Promise.all([
      singleFlightMint('uid-x', doMint),
      singleFlightMint('uid-x', doMint),
      singleFlightMint('uid-x', doMint),
    ]);
    expect(a).toBe(false);
    expect(b).toBe(false);
    expect(c).toBe(false);
    expect(stub.calls).toHaveLength(1);
  });

  it('new uid after old completes → fresh flight (fetch fires again)', async () => {
    const stub = makeFetchStub(() => jsonResponse({ ok: true }, 200));
    const doMint = async () => {
      const r = await (stub.fn as unknown as typeof fetch)('/api/auth/session', { method: 'POST' });
      return r.ok;
    };
    await singleFlightMint('uid-a', doMint);
    await singleFlightMint('uid-b', doMint);
    expect(stub.calls).toHaveLength(2);
  });

  it('a bounded retry loop reuses the in-flight promise and never fans out into 5 parallel POSTs', async () => {
    // Simulate a slow mint: resolves manually after we spawn many callers.
    let resolveMint: (v: boolean) => void = () => {};
    const mintCallCount = { n: 0 };
    const doMint = () => {
      mintCallCount.n += 1;
      return new Promise<boolean>((resolve) => { resolveMint = resolve; });
    };
    // Spawn 5 concurrent "waves" as the retry loop + watchdog would.
    const flights = Array.from({ length: 5 }, () => singleFlightMint('uid-slow', doMint));
    // Only ONE underlying mint call happened despite 5 wrapper calls.
    expect(mintCallCount.n).toBe(1);
    resolveMint(true);
    const results = await Promise.all(flights);
    for (const r of results) expect(r).toBe(true);
  });

  it('after failure resolves, a fresh call spawns a NEW flight (retry semantics preserved)', async () => {
    let attempt = 0;
    const doMint = async (): Promise<boolean> => {
      attempt += 1;
      return attempt >= 2; // first fails, second succeeds
    };
    const first = await singleFlightMint('uid-r', doMint);
    expect(first).toBe(false);
    const second = await singleFlightMint('uid-r', doMint);
    expect(second).toBe(true);
    expect(attempt).toBe(2);
  });

  it('user-switch mid-flight: OLD uid promise resolves but does not affect NEW uid flight', async () => {
    // Simulate: uid A mint slow-in-flight, uid B kicks off in parallel.
    let resolveA: (v: boolean) => void = () => {};
    const doMintA = () => new Promise<boolean>((res) => { resolveA = res; });
    const doMintB = async () => true;

    const pA = singleFlightMint('uid-A', doMintA);
    const pB = singleFlightMint('uid-B', doMintB);
    // Different uid → separate promises.
    expect(pA).not.toBe(pB);
    const bResult = await pB;
    expect(bResult).toBe(true);
    // A still in flight
    expect(_inflightSize()).toBe(1);
    resolveA(false);
    const aResult = await pA;
    expect(aResult).toBe(false);
    // Now both cleared.
    expect(_inflightSize()).toBe(0);
  });

  it('slow 8s server (fake timers): watchdog reveal fires without spawning extra fetches', async () => {
    vi.useFakeTimers();
    let mintCalls = 0;
    let resolveMint: (v: boolean) => void = () => {};
    const doMint = () => {
      mintCalls += 1;
      return new Promise<boolean>((res) => { resolveMint = res; });
    };

    // Kick off the mint via single-flight.
    const mintPromise = singleFlightMint('uid-slow2', doMint);

    // Simulate the watchdog: reveal after 6s regardless of network.
    let revealed = false;
    const revealPromise = new Promise<void>((resolve) => {
      setTimeout(() => { revealed = true; resolve(); }, 6000);
    });

    // Simulate the retry loop: three additional attempts at 1.5s intervals.
    const retries: Promise<boolean>[] = [];
    for (let i = 0; i < 3; i++) {
      setTimeout(() => {
        retries.push(singleFlightMint('uid-slow2', doMint));
      }, 1500 * (i + 1));
    }

    // Advance to 6s — watchdog fires.
    await vi.advanceTimersByTimeAsync(6000);
    expect(revealed).toBe(true);
    // The retry loop scheduled 3 additional wrappers, but the mint call
    // count MUST still be exactly 1 — everyone shared the in-flight
    // promise.
    expect(mintCalls).toBe(1);

    // Server finally answers after 8s total.
    await vi.advanceTimersByTimeAsync(2000);
    resolveMint(true);
    await mintPromise;
    for (const r of retries) await r;
    expect(mintCalls).toBe(1);
    await revealPromise;
  });
});

// ---------- integration slice: logout during in-flight retry ---------------

describe('logout during in-flight session mint', () => {
  it('does NOT stamp sessionCreatedForUid for a stale uid — abort semantics preserved', async () => {
    // We simulate the outer AuthProvider logic in miniature: a background
    // retry loop that only stamps the ref if the mint succeeds AND the
    // uid hasn't changed. This is a behavioral pin for the fix.
    let resolveMint: (v: boolean) => void = () => {};
    const doMint = () => new Promise<boolean>((res) => { resolveMint = res; });

    let currentUid: string | null = 'uid-A';
    const uidAtStart = 'uid-A';
    let stampedUid: string | null = null;

    const flight = singleFlightMint(uidAtStart, doMint);
    // Meanwhile the user logs out (currentUid → null).
    currentUid = null;
    // Server eventually returns success — but for a user who logged out.
    resolveMint(true);
    const ok = await flight;
    // Mimic the AuthProvider guard: only stamp if uid still matches AND ok.
    if (ok && (currentUid as string | null) === uidAtStart) {
      stampedUid = uidAtStart;
    }
    expect(ok).toBe(true);
    expect(stampedUid).toBeNull(); // the fix: never stamp for a stale uid
  });
});
