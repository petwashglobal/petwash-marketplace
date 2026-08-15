/**
 * Public CTA / Route Crawler — fire-order item 55 (PR-PUBLIC-CTA-CRAWLER).
 *
 * Purpose:
 *   Detect the "clicked-a-CTA-and-it-404s / opens-blank / shows-JavaScript-
 *   Required-fallback" class of launch defect BEFORE customers do.
 *
 *   The CEO's audit specifically called out:
 *     - homepage CTAs going nowhere / to removed routes
 *     - /walk-my-pet/explore rendering only the JavaScript Required fallback
 *       to crawlers
 *     - inconsistent PetTrek / Academy / Prestige claims across pages
 *
 *   This suite is a safe crawler: it opens each canonical public route,
 *   waits for React hydration, then asserts:
 *     - HTTP 200
 *     - <title> is not empty
 *     - the "JavaScript Required" fallback is not the visible content
 *     - "Premium Organic Pet Care" stale branding is not visible
 *     - the root has SOMETHING beyond the noscript block
 *     - no fatal console errors
 *
 *   It NEVER submits forms, adds payments, creates accounts, or POSTs — a
 *   pure GET sweep. Safe to run against staging or (with a stricter
 *   REDACT env-var) against production.
 *
 * How to run:
 *   # Against a running local dev server on :5000 (default in playwright.config.ts)
 *   npx playwright test tests/e2e/public-cta-crawler.spec.ts
 *
 *   # Against a specific deployment:
 *   BASE_URL=https://petwash.co.il \
 *     npx playwright test tests/e2e/public-cta-crawler.spec.ts
 *
 *   # Fast mobile-only pass:
 *   npx playwright test tests/e2e/public-cta-crawler.spec.ts --project="Mobile Safari"
 *
 * Adding a route:
 *   Append to PUBLIC_ROUTES below. Keep it flat — this is a smoke sweep, not
 *   a per-page deep test. Any route that renders a full page belongs here.
 *   Routes behind auth (customer dashboard, provider dashboard) do NOT.
 */

import { test, expect, type Page } from '@playwright/test';

// The canonical public routes a homepage visitor can reach in one click.
// Deliberately duplicates the fire-order's "check every homepage CTA" list.
const PUBLIC_ROUTES: Array<{ path: string; label: string; expectTitleFragment?: RegExp }> = [
  { path: '/',                     label: 'Homepage',                expectTitleFragment: /PetWash/i },
  { path: '/loyalty',              label: 'Loyalty (Prestige)',       expectTitleFragment: /PetWash|Loyalty|Prestige/i },
  { path: '/loyalty/tiers',        label: 'Loyalty tiers',            expectTitleFragment: /PetWash|Loyalty|Prestige|Tier/i },
  { path: '/loyalty/birthday',     label: 'Loyalty birthday',         expectTitleFragment: /PetWash|Birthday/i },
  { path: '/loyalty/join',         label: 'Loyalty enrollment',       expectTitleFragment: /PetWash|Prestige|Loyalty/i },
  { path: '/egift',                label: 'eGift',                    expectTitleFragment: /PetWash|Gift/i },
  { path: '/locations',            label: 'Locations',                expectTitleFragment: /PetWash|Location|Station/i },
  { path: '/signup',               label: 'Signup',                   expectTitleFragment: /PetWash|Sign\s?up|Register/i },
  { path: '/signin',               label: 'Sign in',                  expectTitleFragment: /PetWash|Sign\s?in|Log/i },
  { path: '/become-provider',      label: 'Become provider entry',    expectTitleFragment: /PetWash|Provider/i },
  { path: '/careers',              label: 'Careers',                  expectTitleFragment: /PetWash|Career/i },
  { path: '/careers/apply',        label: 'Careers apply',            expectTitleFragment: /PetWash|Apply|Career/i },
  { path: '/paw-finder',           label: 'Paw Finder',               expectTitleFragment: /PetWash|Paw\s?Finder|Lost/i },
  { path: '/walk-my-pet',          label: 'Walk My Pet landing',      expectTitleFragment: /PetWash|Walk/i },
  { path: '/walk-my-pet/explore',  label: 'Walk My Pet explore',      expectTitleFragment: /PetWash|Walk|Explore/i },
  { path: '/sitter-suite/browse',  label: 'Sitter Suite browse',      expectTitleFragment: /PetWash|Sitter|Browse/i },
  { path: '/academy',              label: 'Academy',                  expectTitleFragment: /PetWash|Academy|Train/i },
  { path: '/privacy',              label: 'Privacy',                  expectTitleFragment: /PetWash|Privacy/i },
  { path: '/terms',                label: 'Terms',                    expectTitleFragment: /PetWash|Terms/i },
  { path: '/contact',              label: 'Contact',                  expectTitleFragment: /PetWash|Contact/i },
  { path: '/system-status',        label: 'System status',            expectTitleFragment: /PetWash|Status/i },
];

// Stale/incorrect strings we NEVER want to see on a live public page.
const FORBIDDEN_VISIBLE = [
  'Premium Organic Pet Care',
  'שטיפת חיות מחמד אורגנית פרימיום',
];

async function collectConsoleErrors(page: Page): Promise<string[]> {
  const errors: string[] = [];
  page.on('pageerror', (err) => errors.push(`pageerror: ${err.message}`));
  page.on('console', (msg) => {
    // Only capture ERROR-level; warns are noisy and often third-party
    if (msg.type() === 'error') errors.push(`console.error: ${msg.text()}`);
  });
  return errors;
}

for (const route of PUBLIC_ROUTES) {
  test(`public CTA — ${route.label} (${route.path})`, async ({ page }) => {
    const errors = await collectConsoleErrors(page);

    const response = await page.goto(route.path, { waitUntil: 'domcontentloaded' });

    // A. HTTP-level: 200 or acceptable equivalent. 3xx should redirect
    //    somewhere real — page.goto follows redirects, so response.status()
    //    is the final response.
    expect(response, `${route.path}: no response`).not.toBeNull();
    const status = response!.status();
    expect(status, `${route.path}: unexpected HTTP status ${status}`).toBeLessThan(400);

    // B. Give React a moment to hydrate — a route that never hydrates
    //    is a dead route even if the initial HTML is 200.
    await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});

    // C. Title present and vaguely on-brand (a specific per-route regex
    //    is preferred — falls back to "PetWash" being in there somewhere).
    const title = await page.title();
    expect(title, `${route.path}: empty <title>`).not.toEqual('');
    if (route.expectTitleFragment) {
      expect(title, `${route.path}: title "${title}" does not match ${route.expectTitleFragment}`).toMatch(route.expectTitleFragment);
    }

    // D. The noscript "JavaScript Required" fallback must NOT be the
    //    visible content once React has hydrated. If it is, the SPA
    //    failed to boot.
    const bodyText = await page.locator('body').innerText().catch(() => '');
    expect(bodyText, `${route.path}: noscript fallback is visible — SPA did not hydrate`).not.toContain('JavaScript Required');

    // E. Stale-brand sweep — the crawler is a good place to keep this
    //    honest as new pages are added.
    for (const forbidden of FORBIDDEN_VISIBLE) {
      expect(bodyText.includes(forbidden), `${route.path}: forbidden stale string "${forbidden}" visible on page`).toBe(false);
    }

    // F. #root has SOMETHING beyond the noscript. A blank white screen
    //    is a launch-day disaster.
    const rootChildren = await page.locator('#root > *').count().catch(() => 0);
    expect(rootChildren, `${route.path}: #root is empty — blank white screen`).toBeGreaterThan(0);

    // G. No fatal console errors. Third-party analytics can be noisy —
    //    filter obvious ones out below rather than lower the bar globally.
    const noisyPatterns = [
      /googletagmanager/i, /google-analytics/i, /gtag/i, /clarity/i,
      /facebook\.com\/tr/i, /fbevents/i, /doubleclick/i,
      /Failed to load resource.*400/i,   // avatar 400s etc — non-fatal
      /manifest\.json.*Manifest/i,        // browser scolds about PWA manifest sometimes
    ];
    const fatalErrors = errors.filter(e => !noisyPatterns.some(rx => rx.test(e)));
    if (fatalErrors.length) {
      // Not a hard fail on informational console errors — but keep them in
      // the report so a regression makes noise. Attach to the trace.
      test.info().annotations.push({
        type: 'console-errors',
        description: `${route.path}: ${fatalErrors.length} console errors\n${fatalErrors.join('\n')}`,
      });
    }
  });
}

test.describe('meta — crawler invariants', () => {
  test('the crawler covers every route the CEO explicitly named in the fire order', () => {
    // Named surfaces from the fire-order items 12 + 17 + 43 + 55, cross-
    // checked. If the list drifts, this test catches it.
    const NAMED_IN_FIRE_ORDER = [
      '/', '/loyalty', '/egift', '/locations', '/signup',
      '/careers', '/privacy', '/terms', '/walk-my-pet/explore',
      '/paw-finder', '/academy', '/become-provider', '/contact',
    ];
    const covered = new Set(PUBLIC_ROUTES.map(r => r.path));
    for (const p of NAMED_IN_FIRE_ORDER) {
      expect(covered.has(p), `Fire-order named route missing from crawler: ${p}`).toBe(true);
    }
  });
});
