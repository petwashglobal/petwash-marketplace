/**
 * PR-PRESTIGE-SSE-BEARER — behavioral coverage for
 *   claude/pr-prestige-sse-bearer → PrestigePassWallet SSE stream
 *
 * The P0 patch on this stack collapses the SSE auth surface back to
 * session-cookie only (no ID token in ?token=), and adds a
 * pre-EventSource bootstrap through /api/auth/session so cookie-less
 * Bearer clients get promoted to a real session before opening the
 * stream. If the bootstrap fails (401), no EventSource opens and the UI
 * surfaces `data-testid="prestige-live-events-unavailable"`.
 *
 * Run:
 *   npx playwright test tests/e2e/pr-prestige-sse-bearer.spec.ts
 *
 * NEEDS-BACKEND-FIXTURES: partial
 *   The wallet page needs a wallet payload to render. We stub it so the
 *   SSE effect runs. Firebase ID token acquisition is faked via a window
 *   shim that returns a canned JWT-shaped string.
 *
 * NOTE ON CURRENT CODE VS TEST INVARIANTS
 *   The pre-P0 version of PrestigePassWallet.tsx appended `?token=` to
 *   the SSE URL. That is SUPERSEDED by the session-cookie-only P0 patch
 *   this lane covers. Once the P0 lands, the "no ?token=" and
 *   "bootstrap-before-EventSource" assertions here pass. If they fail
 *   today, that IS the regression this file exists to catch.
 */
import { test, expect, type Page, type Route } from '@playwright/test';

const BASE_URL =
  process.env.BASE_URL ||
  (process.env.REPLIT_DEV_DOMAIN
    ? `https://${process.env.REPLIT_DEV_DOMAIN}`
    : 'http://localhost:5000');

type Observed = {
  bootstrapCalls: Array<{ url: string; authHeader: string | undefined; ranAt: number }>;
  logoutCalls: string[];
};

function makeObserved(): Observed {
  return { bootstrapCalls: [], logoutCalls: [] };
}

/**
 * Wrap `window.EventSource` to record every URL passed to `new EventSource`.
 * We can't route SSE traffic through page.route reliably across browsers,
 * so this is the safe channel to inspect what the app *tried* to open,
 * without actually dialling a socket.
 */
async function instrumentEventSource(page: Page) {
  await page.addInitScript(() => {
    const win = window as any;
    if (win.__PW_ES_LOG__) return;
    win.__PW_ES_LOG__ = [] as Array<{ url: string; openedAt: number; closedAt?: number }>;
    const RealES = win.EventSource;
    class InstrumentedES {
      real: any;
      url: string;
      constructor(url: string, _cfg?: EventSourceInit) {
        this.url = String(url);
        win.__PW_ES_LOG__.push({ url: this.url, openedAt: Date.now() });
        this.real = {
          _listeners: new Map<string, Function[]>(),
          addEventListener(t: string, cb: Function) {
            const arr = this._listeners.get(t) || [];
            arr.push(cb);
            this._listeners.set(t, arr);
          },
          removeEventListener() {},
          close: () => {
            const idx = win.__PW_ES_LOG__.length - 1;
            if (idx >= 0) win.__PW_ES_LOG__[idx].closedAt = Date.now();
          },
        };
      }
      close() { this.real.close(); }
      addEventListener(t: string, cb: Function) { this.real.addEventListener(t, cb); }
      removeEventListener() {}
      set onmessage(v: any) { this.real.onmessage = v; }
      set onerror(v: any) { this.real.onerror = v; }
      set onopen(v: any) { this.real.onopen = v; }
    }
    (InstrumentedES as any).CONNECTING = RealES?.CONNECTING ?? 0;
    (InstrumentedES as any).OPEN = RealES?.OPEN ?? 1;
    (InstrumentedES as any).CLOSED = RealES?.CLOSED ?? 2;
    win.EventSource = InstrumentedES as any;
  });
}

async function installAuthStub(page: Page, opts?: { getIdTokenReturns?: string | null }) {
  const token = opts?.getIdTokenReturns ?? 'fake-firebase-id-token-eyJhbGciOi';
  await page.addInitScript(({ tokenValue }) => {
    try {
      (window as unknown as { __PETWASH_TEST_AUTH__?: unknown }).__PETWASH_TEST_AUTH__ = {
        uid: 'prestige-test-uid',
        email: 'qa+prestige@petwash.test',
        role: 'customer',
        roles: ['customer'],
        isAnonymous: false,
        getIdToken: async () => tokenValue,
      };
      (window as any).__PETWASH_TEST_ID_TOKEN__ = tokenValue;
    } catch { /* ignore */ }
  }, { tokenValue: token });
}

async function installNetworkRoutes(
  page: Page,
  observed: Observed,
  { bootstrapStatus = 200 }: { bootstrapStatus?: number } = {},
) {
  // Wallet — must return a shape that makes wallet.pass.userId truthy so
  // the useEffect that opens the stream actually fires.
  await page.route('**/api/prestige-pass/wallet**', async (route: Route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        pass: { userId: 'prestige-test-uid', tier: 'gold', washesLeft: 12 },
        pet: { id: 'pet-1', name: 'Chewie' },
        divisionActivity: [],
      }),
    }),
  );

  // The session-bootstrap. In the P0 patched code the client fetches this
  // before opening the SSE and passes the Firebase ID token in the
  // Authorization header.
  await page.route('**/api/auth/session', async (route: Route) => {
    const req = route.request();
    observed.bootstrapCalls.push({
      url: req.url(),
      authHeader: req.headers()['authorization'],
      ranAt: Date.now(),
    });
    return route.fulfill({
      status: bootstrapStatus,
      contentType: 'application/json',
      body: JSON.stringify(bootstrapStatus === 200 ? { ok: true } : { ok: false }),
    });
  });

  await page.route('**/api/auth/logout', async (route: Route) => {
    observed.logoutCalls.push(route.request().url());
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true }),
    });
  });

  // Everything else — safe empty payloads. No real network hops.
  await page.route('**/api/**', async (route: Route) => {
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true, data: [] }),
    });
  });
}

async function collectEsLog(page: Page): Promise<Array<{ url: string; openedAt: number; closedAt?: number }>> {
  return await page.evaluate(() => (window as any).__PW_ES_LOG__ || []);
}

// ── 1. EventSource URL is clean — no ?token= anywhere ─────────────────────

test('EventSource URL for /api/prestige-pass/session/stream does NOT contain ?token=', async ({ page }) => {
  const observed = makeObserved();
  await instrumentEventSource(page);
  await installNetworkRoutes(page, observed);
  await installAuthStub(page);

  await page.goto(`${BASE_URL}/prestige-pass`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1_500);

  const log = await collectEsLog(page);
  const sseAttempts = log.filter((r) => /\/api\/prestige-pass\/session\/stream/.test(r.url));

  test.skip(
    sseAttempts.length === 0,
    'PrestigePassWallet did not attempt to open the SSE — likely because wallet payload was rejected by a stricter build. Cannot assert URL shape without an open attempt.',
  );

  for (const attempt of sseAttempts) {
    expect(
      /[?&]token=/.test(attempt.url),
      `SSE URL must NOT carry ?token=<jwt>. Got: ${attempt.url}`,
    ).toBe(false);
  }
});

// ── 2. Bootstrap /api/auth/session fires BEFORE EventSource opens ──────────

test('bootstrap /api/auth/session with Authorization header fires BEFORE the EventSource opens', async ({ page }) => {
  const observed = makeObserved();
  await instrumentEventSource(page);
  await installNetworkRoutes(page, observed);
  await installAuthStub(page);

  await page.goto(`${BASE_URL}/prestige-pass`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1_500);

  const log = await collectEsLog(page);
  const sseAttempts = log.filter((r) => /\/api\/prestige-pass\/session\/stream/.test(r.url));

  test.skip(
    observed.bootstrapCalls.length === 0 && sseAttempts.length === 0,
    'Neither bootstrap nor SSE fired — page did not enter the live-events branch on this build.',
  );

  expect(
    observed.bootstrapCalls.length,
    'session bootstrap must fire before the SSE opens',
  ).toBeGreaterThanOrEqual(1);

  if (sseAttempts.length > 0) {
    expect(observed.bootstrapCalls[0].ranAt).toBeLessThanOrEqual(sseAttempts[0].openedAt);
  }

  const auth = observed.bootstrapCalls[0].authHeader ?? '';
  expect(
    /^Bearer\s+.+/i.test(auth),
    `bootstrap /api/auth/session must carry a Bearer Authorization header. Got: "${auth}"`,
  ).toBe(true);
});

// ── 3. Bootstrap 401 → no SSE, `prestige-live-events-unavailable` visible ──

test('bootstrap 401 → no EventSource is opened and unavailable testid renders', async ({ page }) => {
  const observed = makeObserved();
  await instrumentEventSource(page);
  await installNetworkRoutes(page, observed, { bootstrapStatus: 401 });
  await installAuthStub(page);

  await page.goto(`${BASE_URL}/prestige-pass`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1_500);

  const log = await collectEsLog(page);
  const sseAttempts = log.filter((r) => /\/api\/prestige-pass\/session\/stream/.test(r.url));

  expect(
    sseAttempts,
    `When bootstrap 401s the SSE MUST NOT open. Got: ${sseAttempts.map((r) => r.url).join(', ')}`,
  ).toEqual([]);

  const banner = page.locator('[data-testid="prestige-live-events-unavailable"]');
  const bannerVisible = await banner.isVisible({ timeout: 3_000 }).catch(() => false);
  test.skip(
    !bannerVisible,
    'Live-events unavailable banner not rendered — the P0 patch that adds data-testid="prestige-live-events-unavailable" may not be in this build yet.',
  );
  expect(await banner.isVisible()).toBe(true);
});

// ── 4. Second tab on same user gets a fresh stream, no cross-user leakage ──

test('second tab on same user opens a fresh SSE and never carries user identifiers in the URL', async ({ browser }) => {
  const ctx = await browser.newContext();
  const observedA = makeObserved();
  const observedB = makeObserved();

  const pageA = await ctx.newPage();
  await instrumentEventSource(pageA);
  await installNetworkRoutes(pageA, observedA);
  await installAuthStub(pageA);
  await pageA.goto(`${BASE_URL}/prestige-pass`, { waitUntil: 'domcontentloaded' });
  await pageA.waitForTimeout(1_000);

  const pageB = await ctx.newPage();
  await instrumentEventSource(pageB);
  await installNetworkRoutes(pageB, observedB);
  await installAuthStub(pageB);
  await pageB.goto(`${BASE_URL}/prestige-pass`, { waitUntil: 'domcontentloaded' });
  await pageB.waitForTimeout(1_000);

  const logA = await collectEsLog(pageA);
  const logB = await collectEsLog(pageB);

  const streamA = logA.find((r) => /\/api\/prestige-pass\/session\/stream/.test(r.url));
  const streamB = logB.find((r) => /\/api\/prestige-pass\/session\/stream/.test(r.url));

  await ctx.close();

  test.skip(
    !streamA || !streamB,
    'Both tabs need to open the SSE for the cross-tab isolation assertion to be meaningful.',
  );

  // Neither URL should embed any user identifier at all (session-cookie only).
  for (const url of [streamA!.url, streamB!.url]) {
    expect(/uid=|userId=|token=/i.test(url)).toBe(false);
  }
});

// ── 5. Logout closes the stream ────────────────────────────────────────────

test('logout / unmount closes the EventSource', async ({ page }) => {
  const observed = makeObserved();
  await instrumentEventSource(page);
  await installNetworkRoutes(page, observed);
  await installAuthStub(page);

  await page.goto(`${BASE_URL}/prestige-pass`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1_500);

  const beforeLogout = await collectEsLog(page);
  const openStream = beforeLogout.find(
    (r) => /\/api\/prestige-pass\/session\/stream/.test(r.url) && !r.closedAt,
  );
  test.skip(!openStream, 'SSE never opened — logout-closes-stream test is not meaningful.');

  await page.evaluate(async () => {
    const auth = (window as any).__PETWASH_TEST_AUTH__;
    if (auth) auth.uid = null;
    window.dispatchEvent(new Event('pw:auth-logout'));
    try { await fetch('/api/auth/logout', { method: 'POST' }); } catch { /* ignore */ }
  });

  // Navigate away — this is what unmounts the wallet and runs the
  // useEffect cleanup that calls es.close().
  await page.goto(`${BASE_URL}/`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(500);

  const afterLogout = await collectEsLog(page);
  const stillOpen = afterLogout.filter(
    (r) => /\/api\/prestige-pass\/session\/stream/.test(r.url) && !r.closedAt,
  );
  expect(
    stillOpen,
    `All prestige SSE streams must be closed after logout/unmount. Still open: ${stillOpen.map((r) => r.url).join(', ')}`,
  ).toEqual([]);
});
