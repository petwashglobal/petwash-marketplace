/**
 * AUTH MASTER Lane E — BROWSER-INTEGRATION-VERIFIED.
 *
 * CEO 2026-08-29 correction pass §1 §3 §4 §5. Real browser proofs of
 * the /become-provider resume gate. NOT full AUTH-JOURNEY-E2E (no
 * Firebase adapter runs here yet); this suite proves the anonymous
 * → sign-in bounce preserves the CANONICAL journey URL.
 *
 * SCENARIOS
 *   A. /become-provider?requestedService=pet_sitting  (unauth)
 *      → /sign-in|/signin?redirect=<encoded canonical URL>
 *      → the redirect URL contains ?requestedService=pet_sitting
 *
 *   B. /become-provider?requestedService=pet_sitting&utm_source=google
 *      → sign-in redirect preserves BOTH the canonical intent AND
 *      the attribution query (utm_source=google) after decoding
 *
 *   C. /become-provider?type=sitter  (legacy alias)
 *      → sign-in redirect carries the CANONICAL `requestedService=
 *      pet_sitting` — not the legacy `type=sitter`
 *
 *   D. /become-provider?type=admin (hostile / non-canonical)
 *      → sign-in redirect has NO requestedService param at all
 *      (silent-drop discipline; hostile intent is not routable)
 *
 *   E. urlForProviderIntent's canonical URL never bypasses the gate:
 *      /become-provider?requestedService=training goes through the
 *      resume router, NOT direct to /provider-onboarding.
 *
 * All scenarios run against a running build (npm run build + serve).
 * They do NOT depend on a Firebase test adapter — the gate is
 * exercised at the anonymous branch which does not touch Firebase.
 *
 * Depends on Lane E's BecomeProviderResume canonical reader landing.
 * On a build without it, these tests fail red — the CEO §7 intent.
 */
import { test, expect } from '@playwright/test';

async function expectSignInBounceWithRedirect(
  page: import('@playwright/test').Page,
  expected: {
    hasRequestedService?: string | null;      // exact value expected (null → key absent)
    hasUtmSource?: string;
    hasTypeQuery?: false;                     // if set, redirect must NOT carry ?type=
  },
) {
  // Wait for the SPA to redirect to /sign-in?redirect=... . Timing depends on
  // how the BecomeProviderResume useEffect resolves; the target lives in a
  // useLocation navigate call.
  await page.waitForURL((url) => /\/sign-?in/.test(url.pathname), { timeout: 15_000 });
  const current = new URL(page.url());
  const redirect = current.searchParams.get('redirect');
  expect(redirect, 'sign-in URL must carry a redirect query').toBeTruthy();
  const decoded = new URL('http://x' + redirect!);
  expect(decoded.pathname, 'redirect must land back on the resume gate').toBe('/become-provider');
  if (expected.hasRequestedService === undefined) {
    // nothing to assert
  } else if (expected.hasRequestedService === null) {
    expect(decoded.searchParams.get('requestedService')).toBeNull();
  } else {
    expect(decoded.searchParams.get('requestedService')).toBe(expected.hasRequestedService);
  }
  if (expected.hasUtmSource) {
    expect(decoded.searchParams.get('utm_source')).toBe(expected.hasUtmSource);
  }
  if (expected.hasTypeQuery === false) {
    expect(decoded.searchParams.get('type')).toBeNull();
  }
}

test.describe('BecomeProvider gate — CEO §1 §4 §5 anonymous → sign-in bounce', () => {
  test('A. canonical requestedService survives sign-in bounce', async ({ page }) => {
    await page.goto('/become-provider?requestedService=pet_sitting');
    await expectSignInBounceWithRedirect(page, {
      hasRequestedService: 'pet_sitting',
    });
  });

  test('B. attribution (utm_source) survives alongside the canonical intent', async ({ page }) => {
    await page.goto('/become-provider?requestedService=pet_sitting&utm_source=google&utm_campaign=sitter_launch');
    await expectSignInBounceWithRedirect(page, {
      hasRequestedService: 'pet_sitting',
      hasUtmSource: 'google',
    });
  });

  test('C. legacy ?type=sitter normalises to canonical requestedService=pet_sitting', async ({ page }) => {
    await page.goto('/become-provider?type=sitter');
    await expectSignInBounceWithRedirect(page, {
      hasRequestedService: 'pet_sitting',
      hasTypeQuery: false,
    });
  });

  test('D. hostile ?type=admin is silently dropped — the redirect carries NO requestedService', async ({ page }) => {
    await page.goto('/become-provider?type=admin');
    await expectSignInBounceWithRedirect(page, {
      hasRequestedService: null,
    });
  });

  test('E. urlForProviderIntent-shaped URL still routes through the gate, not direct to /provider-onboarding', async ({ page }) => {
    // Direct hit on /become-provider (the URL emitter's output) MUST
    // bounce through /sign-in for anonymous users — never to
    // /provider-onboarding directly (the gate-bypass CEO §1 called out).
    await page.goto('/become-provider?requestedService=training');
    await page.waitForURL(
      (url) => /\/sign-?in/.test(url.pathname) || url.pathname === '/provider-onboarding',
      { timeout: 15_000 },
    );
    // A conforming Lane E build routes here:
    expect(new URL(page.url()).pathname).toMatch(/\/sign-?in/);
    // If a regression lands and the URL emitter starts writing
    // /provider-onboarding directly, this test fails loudly.
    expect(new URL(page.url()).pathname).not.toBe('/provider-onboarding');
  });
});
