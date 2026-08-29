/**
 * AUTH MASTER Lane F — Firebase step full journey (SKIPPED, awaits F2)
 *
 * This spec exercises the ACTUAL Firebase step of the sitter/walker/
 * trainer CTA → auth → onboarding chain — the branch Lane E's
 * behavioural spec (auth-master-lane-e-sitter-full-journey.e2e.spec.ts)
 * cannot reach without a synthetic Firebase identity.
 *
 * PHASE STATUS
 *   • Phase F1 (SHIPPED — commits a7b6c3213 + 4dce10d18):
 *       - tests/e2e/firebaseTestAdapter.ts        — installer + intercepts.
 *       - client/src/lib/firebaseTestAdapterClient.ts — client-side probe.
 *
 *   • Phase F2 (PARTIALLY SHIPPED — 2026-08-29):
 *       - SignUpLuxury.tsx Google/Apple/Facebook popup path calls
 *         getFirebaseTestAdapter() BEFORE signInWithPopup() and
 *         short-circuits to /api/auth/session with the synthetic
 *         token when the shim is installed.
 *       - Not yet wired: signInWithRedirect fallback path, the
 *         native Capacitor OAuth path, GoogleOneTap, AdminLoginV2.
 *         The desktop web popup flow is enough for the sitter/
 *         walker/trainer full-journey E2E to run, but the specs
 *         stay `test.skip()`'d until wave-2 F2 covers the redirect
 *         + One-Tap paths so the harness can pick browser strategy
 *         freely.
 *
 * Every scenario below is `test.skip()`'d with a clear reason so the
 * suite passes as-is. When F2 lands, drop the `.skip` and the specs
 * become live — zero diff needed to the assertions.
 */
import { test, expect } from '@playwright/test';
import {
  firebaseAdapterAvailable,
  installFirebaseTestAdapter,
  personas,
} from './firebaseTestAdapter';

const chipSelected = (key: string) => [
  `[data-testid="provider-type-${key}"][data-selected="true"]`,
  `[data-testid="provider-type-${key}"].selected`,
  `[data-testid="provider-type-${key}"][aria-pressed="true"]`,
].join(', ');

interface Journey {
  overviewPath: string;
  serviceCode: 'pet_sitting' | 'dog_walking' | 'training';
  chipKey: 'sitter' | 'walker' | 'trainer';
  ctaSelector: string;
  ctaLabel: string;
}
const JOURNEYS: Record<'sitter' | 'walker' | 'trainer', Journey> = {
  sitter: {
    overviewPath: '/sitter-suite',
    serviceCode: 'pet_sitting',
    chipKey: 'sitter',
    ctaSelector:
      '[data-testid="button-become-sitter"], [data-testid="provider-tile-sitter"]',
    ctaLabel: 'Become a Sitter',
  },
  walker: {
    overviewPath: '/walk-my-pet',
    serviceCode: 'dog_walking',
    chipKey: 'walker',
    ctaSelector:
      '[data-testid="button-become-walker"], [data-testid="provider-tile-walker"]',
    ctaLabel: 'Become a Walker',
  },
  trainer: {
    overviewPath: '/academy',
    serviceCode: 'training',
    chipKey: 'trainer',
    ctaSelector:
      '[data-testid="button-become-trainer"], [data-testid="provider-tile-trainer"]',
    ctaLabel: 'Become a Trainer',
  },
};

for (const key of ['sitter', 'walker', 'trainer'] as const) {
  const j = JOURNEYS[key];
  test.describe(`AUTH MASTER Lane F — ${key} full Firebase-step journey`, () => {
    test(`anonymous → ${j.ctaLabel} → sign-in → Firebase (adapter) → gate → onboarding chip preselected`, async ({
      page,
    }) => {
      // Phase F2 wave-1..4 (commits d34af8599 → 528e291b5) wired the
      // adapter shortcut across SignUpLuxury popup + redirect +
      // native, GoogleOneTap credential, and AdminLoginV2 Google. This
      // spec now runs against a real dev server whenever
      // TEST_BYPASS_TOKEN is present and BASE_URL is not production.
      test.skip(
        !firebaseAdapterAvailable(),
        'Firebase test adapter not available in this environment (BASE_URL or TEST_BYPASS_TOKEN missing).',
      );

      // The persona the harness will present after "Firebase" completes.
      await installFirebaseTestAdapter(page, personas.customerActive);

      // 1) Anonymous marketing overview page.
      await page.goto(j.overviewPath);
      const cta = page.locator(j.ctaSelector).first();
      await expect(cta).toBeVisible({ timeout: 15_000 });
      await cta.click();

      // 2) Resume gate bounces anonymous → /signin?redirect=/become-provider?...
      await page.waitForURL((u) => /\/sign-?in/.test(u.pathname), {
        timeout: 15_000,
      });

      // 3) User taps the "Continue with Google" button. In Phase F2
      //    this call site reads the shim and short-circuits to the
      //    synthetic-token session POST (route-intercepted here).
      const googleBtn = page.locator(
        '[data-testid="cta-signin-google"], [data-action-id*="signin-google"]',
      ).first();
      await expect(googleBtn).toBeVisible({ timeout: 15_000 });
      await googleBtn.click();

      // 4) Session established, resume gate re-runs, signed-in user
      //    is routed to /provider-onboarding preserving the service.
      await page.waitForURL(
        (u) =>
          u.pathname === '/provider-onboarding' &&
          u.search.includes(`requestedService=${j.serviceCode}`),
        { timeout: 30_000 },
      );

      // 5) Provider type chip is pre-selected on arrival.
      await expect(page.locator(chipSelected(j.chipKey))).toBeVisible({
        timeout: 15_000,
      });
    });
  });
}
