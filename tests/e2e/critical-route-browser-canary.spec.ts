/**
 * critical-route-browser-canary — CEO 2026-08-29 P0 §4 §5 §6 §7 §18.
 *
 * The curl canary is NOT enough. A page can HTTP-200 with a valid
 * index.html and then the React client crashes at
 * "Cannot read properties of undefined (reading 'default')" — the
 * exact production incident 2026-08-28.
 *
 * This suite drives a REAL browser at the same critical routes and
 * fails the deploy if:
 *   * any pageerror fires
 *   * console.error records the P0 fingerprint or any lazy-chunk
 *     failure message
 *   * a network requestfailed / 5xx affects a JS or CSS asset
 *   * an unhandledrejection carries the fingerprint
 *   * AuthRouteErrorBoundary rendered instead of the real auth UI
 *
 * Baseline (per CEO §6): points at a target BASE_URL and runs the
 * SAME production bundle. Set BASE_URL to https://petwash.co.il for
 * post-deploy VERIFIED-LIVE. Default falls through to the
 * playwright.config.ts baseURL.
 *
 * Usage:
 *   BASE_URL=https://petwash.co.il npx playwright test critical-route-browser-canary
 *   # or against a locally-served built app:
 *   npm run build && npx serve dist/public -s -p 4173
 *   BASE_URL=http://localhost:4173 npx playwright test critical-route-browser-canary
 */
import { test, expect, type Page, type ConsoleMessage, type Response } from '@playwright/test';

const BASE = process.env.BASE_URL ?? '';

/** The exact P0 fingerprint set. Never let ANY of these reach a
 *  customer's screen. */
const FAIL_PATTERNS: readonly RegExp[] = [
  /Cannot read properties of undefined \(reading ['"]default['"]\)/i,
  /reading ['"]default['"]/i,
  /ChunkLoadError/i,
  /Failed to fetch dynamically imported module/i,
  /error loading dynamically imported/i,
  /Importing a module script failed/i,
  /module script failed/i,
  /Loading chunk \S+ failed/i,
  /Loading CSS chunk \S+ failed/i,
  /vite:preloadError/i,
  /'text\/html' is not a valid JavaScript MIME type/i,
];

interface RouteSpec {
  /** Path relative to BASE. */
  path: string;
  /** A CSS/testid selector proving the REAL page rendered, not the boundary. */
  proofSelector: string;
  /** Human-readable label for the report. */
  label: string;
}

const AUTH_PROOF = [
  '[data-testid="signup-panel"]',
  '[data-testid="signup-form"]',
  '[data-testid="auth-page"]',
  '[data-testid="signin-panel"]',
  'form',
  'input[type="email"]',
  'input[type="tel"]',
  'button:has-text("Continue")',
  'button:has-text("המשך")',
].join(', ');

const HOME_PROOF = [
  'main',
  'header',
  '[data-testid="landing"]',
  '[data-testid="home"]',
].join(', ');

const AUTH_ROUTES: RouteSpec[] = [
  { path: '/signin',                    proofSelector: AUTH_PROOF, label: 'sign-in' },
  { path: '/sign-in',                   proofSelector: AUTH_PROOF, label: 'sign-in-hyphen' },
  { path: '/login',                     proofSelector: AUTH_PROOF, label: 'login' },
  { path: '/signup',                    proofSelector: AUTH_PROOF, label: 'signup' },
  { path: '/signup?flow=provider',      proofSelector: AUTH_PROOF, label: 'signup-provider' },
  { path: '/signup?flow=prestige',      proofSelector: AUTH_PROOF, label: 'signup-prestige' },
];

const HOME_ROUTES: RouteSpec[] = [
  { path: '/',                          proofSelector: HOME_PROOF, label: 'root' },
];

// Signed-out-safe versions of the authenticated routes: they may
// redirect to /signin or render a "please sign in" screen. Either
// outcome is acceptable — what MUST NOT happen is a fingerprinted
// crash on the way there. The proof selector for these is the auth
// UI OR any main/header (redirect landed).
const PROTECTED_ROUTES_SIGNED_OUT: RouteSpec[] = [
  { path: '/pet-parent/home',           proofSelector: [AUTH_PROOF, HOME_PROOF].join(', '), label: 'pet-parent-home' },
  { path: '/provider/home',             proofSelector: [AUTH_PROOF, HOME_PROOF].join(', '), label: 'provider-home' },
  { path: '/my-account',                proofSelector: [AUTH_PROOF, HOME_PROOF].join(', '), label: 'my-account' },
  { path: '/account/transactions',      proofSelector: [AUTH_PROOF, HOME_PROOF].join(', '), label: 'account-transactions' },
];

interface CrashRecord {
  path: string;
  kind: 'pageerror' | 'console' | 'unhandled' | 'requestfailed' | '5xx';
  detail: string;
}

async function drive(page: Page, spec: RouteSpec): Promise<CrashRecord[]> {
  const crashes: CrashRecord[] = [];
  const record = (kind: CrashRecord['kind'], detail: string) => {
    crashes.push({ path: spec.path, kind, detail });
  };
  const matchesFingerprint = (s: string): boolean =>
    FAIL_PATTERNS.some((r) => r.test(s));

  page.on('pageerror', (err) => {
    record('pageerror', String(err?.message ?? err));
  });
  page.on('console', (msg: ConsoleMessage) => {
    if (msg.type() !== 'error') return;
    const text = msg.text();
    if (matchesFingerprint(text)) record('console', text);
  });
  page.on('response', (res: Response) => {
    const url = res.url();
    // Only JS / CSS asset failures matter here — user-facing HTML
    // will be caught by proofSelector timeouts.
    if (!/\.(js|css)(\?|$)/i.test(url)) return;
    if (res.status() >= 500) {
      record('5xx', `${res.status()} ${url}`);
    }
  });
  page.on('requestfailed', (req) => {
    const url = req.url();
    if (!/\.(js|css)(\?|$)/i.test(url)) return;
    record('requestfailed', `${req.failure()?.errorText ?? 'unknown'} ${url}`);
  });

  // Capture window.onunhandledrejection at first tick.
  await page.addInitScript(() => {
    window.addEventListener('unhandledrejection', (e: any) => {
      const message = String(e?.reason?.message ?? e?.reason ?? '');
      // Stamp into the DOM so the test can read it out — Playwright's
      // pageerror hook does not always fire on unhandled promise
      // rejection.
      const el = document.createElement('div');
      el.dataset.canaryUnhandled = message.slice(0, 500);
      el.style.display = 'none';
      document.documentElement.appendChild(el);
    });
  });

  await page.goto(spec.path, { waitUntil: 'domcontentloaded', timeout: 15_000 });

  // CEO §5: the AuthRouteErrorBoundary is recovery UX, NOT a healthy
  // render. Fail if it appears.
  const boundary = await page.locator('[data-testid="auth-boundary-fallback"]').count();
  if (boundary > 0) {
    record('pageerror', 'AuthRouteErrorBoundary rendered — the real page did not mount');
  }

  // Wait for the proof selector so a bounce-to-login also lands on a
  // real UI, not a blank body.
  try {
    await page.waitForSelector(spec.proofSelector, { timeout: 8_000, state: 'attached' });
  } catch {
    record('pageerror', `proof selector "${spec.proofSelector}" not found within 8s`);
  }

  // Sweep any unhandled-rejection stamps the init script recorded.
  const unhandledStamps = await page.$$eval('[data-canary-unhandled]', (nodes) =>
    nodes.map((n) => (n as HTMLElement).dataset.canaryUnhandled ?? '')
  );
  for (const s of unhandledStamps) {
    if (matchesFingerprint(s)) record('unhandled', s);
  }

  return crashes;
}

function summarise(records: CrashRecord[]): string {
  if (records.length === 0) return '(no crashes)';
  const byPath = new Map<string, CrashRecord[]>();
  for (const r of records) {
    const arr = byPath.get(r.path) ?? [];
    arr.push(r);
    byPath.set(r.path, arr);
  }
  const lines: string[] = [];
  for (const [path, arr] of byPath.entries()) {
    lines.push(`  ${path}`);
    for (const r of arr) {
      lines.push(`    [${r.kind}] ${r.detail.slice(0, 300)}`);
    }
  }
  return lines.join('\n');
}

test.describe('CRITICAL ROUTE BROWSER CANARY (CEO 2026-08-29 §4 §5 §6)', () => {
  test.describe.configure({ retries: 0 });

  const allRoutes: RouteSpec[] = [
    ...HOME_ROUTES,
    ...AUTH_ROUTES,
    ...PROTECTED_ROUTES_SIGNED_OUT,
  ];

  for (const spec of allRoutes) {
    test(`${spec.label} — no lazy-module crash, real UI rendered`, async ({ page }) => {
      test.info().annotations.push({ type: 'base', description: BASE || '(playwright baseURL)' });
      const crashes = await drive(page, spec);
      expect(crashes, `crashes on ${spec.path}:\n${summarise(crashes)}`).toEqual([]);
    });
  }

  test('release-info surface is reachable — client can classify stale vs current', async ({ request }) => {
    const res = await request.get('/api/release-info');
    expect(res.status(), 'expected 200 from /api/release-info').toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(typeof body.releaseBuildId).toBe('string');
    expect(body.releaseBuildId.length).toBeGreaterThan(0);
  });
});
