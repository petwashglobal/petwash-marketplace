/**
 * AUTH MASTER Lane E — BROWSER-INTEGRATION-VERIFIED end-to-end
 * Sitter journey (§3.1 partial).
 *
 * CEO MASTER §3.1 wants: /sitter-suite → click "Become a Sitter" →
 * auth → session → post-login → onboarding with Sitter preselected.
 * The full journey requires a Firebase test adapter (Lane F).
 *
 * This spec exercises everything EXCEPT the Firebase step — it
 * proves the CTA → resume gate → onboarding chain is correct end
 * to end using the existing dev-only test bypass so the "signed
 * in" branch of the resume gate can be reached without a real
 * Firebase user.
 *
 * SCENARIOS
 *
 *   A. anonymous /sitter-suite → tap "Become a Sitter" → land at
 *      /become-provider?requestedService=pet_sitting (Lane E URL
 *      emitter contract). Then the resume gate bounces to sign-in
 *      preserving the canonical URL as the redirect param — no
 *      requestedService drop.
 *
 *   B. signed-in customer (bypass persona) opens /become-provider
 *      ?requestedService=pet_sitting → resume gate lands on
 *      /provider-onboarding?requestedService=pet_sitting → Sitter
 *      chip is selected on arrival.
 *
 *   C. signed-in customer taps "Become a Sitter" on the marketing
 *      page → route through the gate → onboarding → Sitter
 *      preselected (full CTA→onboarding chain).
 *
 * The bypass persona is set via test.use({ extraHTTPHeaders: ... })
 * per test. TEST_BYPASS_TOKEN must be present in the environment;
 * scenarios B and C skip gracefully when it is absent.
 *
 * Depends on Lane B + Lane C + Lane D + Lane E landing on the base
 * branch (the CTA + gate + BecomeProviderResume + ProviderOnboarding
 * chip UI). A build missing any of them fails these tests loudly.
 *
 * Usage:
 *   npm run build && npx serve dist/public -s -p 4173
 *   BASE_URL=http://localhost:4173 \
 *   TEST_BYPASS_TOKEN=... \
 *     npx playwright test auth-master-lane-e-sitter-full-journey
 */
import { test, expect } from '@playwright/test';
import { bypassAvailable, headersForPersona } from './testBypassHeaders';

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
}
const JOURNEYS: Record<'sitter' | 'walker' | 'trainer', Journey> = {
  sitter: {
    overviewPath: '/sitter-suite',
    serviceCode: 'pet_sitting',
    chipKey: 'sitter',
    ctaSelector: '[data-testid="button-become-sitter"], [data-testid="provider-tile-sitter"]',
  },
  walker: {
    overviewPath: '/walk-my-pet',
    serviceCode: 'dog_walking',
    chipKey: 'walker',
    ctaSelector: '[data-testid="button-become-walker"], [data-testid="provider-tile-walker"]',
  },
  trainer: {
    overviewPath: '/academy',
    serviceCode: 'training',
    chipKey: 'trainer',
    ctaSelector: '[data-testid="button-become-trainer"], [data-testid="provider-tile-trainer"]',
  },
};

test.describe('AUTH MASTER Lane E — Sitter journey (BROWSER-INTEGRATION-VERIFIED)', () => {
  test('A. anonymous /sitter-suite → Become a Sitter → gate bounces to sign-in with canonical URL preserved', async ({ page }) => {
    await page.goto('/sitter-suite');
    // The Sitter Suite Overview mounts the ProviderRegistrationBanner,
    // whose Become-a-Sitter card is testid=provider-tile-sitter.
    // The empty-state CTA (BrowseSitters) also exposes
    // testid=button-become-sitter — whichever is on this page.
    const sitterCta = page.locator(
      '[data-testid="button-become-sitter"], [data-testid="provider-tile-sitter"]',
    ).first();
    await expect(sitterCta).toBeVisible({ timeout: 15_000 });
    await sitterCta.click();

    // Resume gate for an anonymous user bounces to sign-in with the
    // FULL canonical URL preserved as redirect.
    await page.waitForURL((u) => /\/sign-?in/.test(u.pathname), { timeout: 15_000 });
    const current = new URL(page.url());
    const redirect = current.searchParams.get('redirect');
    expect(redirect, 'sign-in must carry a redirect').toBeTruthy();
    const decoded = new URL('http://x' + redirect!);
    expect(decoded.pathname).toBe('/become-provider');
    expect(decoded.searchParams.get('requestedService')).toBe('pet_sitting');
  });

  test.describe('signed-in customer (bypass persona)', () => {
    test.use({
      extraHTTPHeaders: headersForPersona('customer', 'active'),
    });

    test('B. /become-provider?requestedService=pet_sitting lands on /provider-onboarding with Sitter preselected', async ({ page }) => {
      test.skip(!bypassAvailable(), 'TEST_BYPASS_TOKEN not set — persona-scenarios skipped');
      await page.goto('/become-provider?requestedService=pet_sitting');
      // The resume gate for a signed-in user with no draft routes
      // to /provider-onboarding preserving the canonical shape.
      await page.waitForURL(
        (u) => u.pathname === '/provider-onboarding' && u.search.includes('requestedService=pet_sitting'),
        { timeout: 15_000 },
      );
      // Sitter chip is selected on arrival.
      await expect(page.locator(chipSelected('sitter'))).toBeVisible({ timeout: 15_000 });
    });

    test('C. /sitter-suite → click Become a Sitter → full chain lands on onboarding with Sitter preselected', async ({ page }) => {
      test.skip(!bypassAvailable(), 'TEST_BYPASS_TOKEN not set — persona-scenarios skipped');
      await page.goto('/sitter-suite');
      const sitterCta = page.locator(
        '[data-testid="button-become-sitter"], [data-testid="provider-tile-sitter"]',
      ).first();
      await expect(sitterCta).toBeVisible({ timeout: 15_000 });
      await sitterCta.click();
      // Signed-in: through the gate directly to onboarding.
      await page.waitForURL(
        (u) => u.pathname === '/provider-onboarding' && u.search.includes('requestedService=pet_sitting'),
        { timeout: 15_000 },
      );
      await expect(page.locator(chipSelected('sitter'))).toBeVisible({ timeout: 15_000 });
    });
  });
});

// ─── Walker + Trainer parallels (§3.2 + §3.3) ─────────────────────
for (const key of ['walker', 'trainer'] as const) {
  const j = JOURNEYS[key];
  test.describe(`AUTH MASTER Lane E — ${key} journey (BROWSER-INTEGRATION-VERIFIED)`, () => {
    test(`A. anonymous ${j.overviewPath} → Become CTA → gate bounces to sign-in with canonical URL preserved`, async ({ page }) => {
      await page.goto(j.overviewPath);
      const cta = page.locator(j.ctaSelector).first();
      await expect(cta).toBeVisible({ timeout: 15_000 });
      await cta.click();
      await page.waitForURL((u) => /\/sign-?in/.test(u.pathname), { timeout: 15_000 });
      const current = new URL(page.url());
      const redirect = current.searchParams.get('redirect');
      expect(redirect).toBeTruthy();
      const decoded = new URL('http://x' + redirect!);
      expect(decoded.pathname).toBe('/become-provider');
      expect(decoded.searchParams.get('requestedService')).toBe(j.serviceCode);
    });

    test.describe('signed-in customer (bypass persona)', () => {
      test.use({ extraHTTPHeaders: headersForPersona('customer', 'active') });

      test(`B. /become-provider?requestedService=${j.serviceCode} lands on /provider-onboarding with chip preselected`, async ({ page }) => {
        test.skip(!bypassAvailable(), 'TEST_BYPASS_TOKEN not set — persona-scenarios skipped');
        await page.goto(`/become-provider?requestedService=${j.serviceCode}`);
        await page.waitForURL(
          (u) => u.pathname === '/provider-onboarding' && u.search.includes(`requestedService=${j.serviceCode}`),
          { timeout: 15_000 },
        );
        await expect(page.locator(chipSelected(j.chipKey))).toBeVisible({ timeout: 15_000 });
      });

      test(`C. ${j.overviewPath} → click Become CTA → onboarding with chip preselected`, async ({ page }) => {
        test.skip(!bypassAvailable(), 'TEST_BYPASS_TOKEN not set — persona-scenarios skipped');
        await page.goto(j.overviewPath);
        const cta = page.locator(j.ctaSelector).first();
        await expect(cta).toBeVisible({ timeout: 15_000 });
        await cta.click();
        await page.waitForURL(
          (u) => u.pathname === '/provider-onboarding' && u.search.includes(`requestedService=${j.serviceCode}`),
          { timeout: 15_000 },
        );
        await expect(page.locator(chipSelected(j.chipKey))).toBeVisible({ timeout: 15_000 });
      });
    });
  });
}
