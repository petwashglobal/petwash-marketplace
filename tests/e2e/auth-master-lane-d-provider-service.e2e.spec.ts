/**
 * AUTH MASTER Lane D — real browser E2E for Lane B + Lane C fixes.
 * CEO 2026-08-29 §7 §21: existing signup-coverage.e2e.spec.ts is
 * insufficient (asserts URL only). This spec drives REAL controls.
 *
 *   A. /provider-onboarding?type=sitter    → sitter chip selected
 *   B. /provider-onboarding?role=trainer   → trainer chip selected
 *   C. /provider-onboarding?requestedService=pet_sitting
 *                                           → sitter chip selected
 *   D. tap Sitter, tap Walker, reload      → BOTH chips selected
 *      (Lane B additive-union survives refresh via sessionStorage)
 *   E. /signin with a completed customer profile lands on
 *      /pet-parent/home — NEVER /prestige/home  (Lane C)
 *
 * Depends on Lane B (PR #2170) + Lane C (PR #2171) landing on the
 * base branch. When run against a build that has neither, the
 * assertions will fail — which is exactly the CEO §7 intent: a
 * fake E2E green is worse than a red one.
 *
 * Usage:
 *   npm run build && npx serve dist/public -s -p 4173
 *   BASE_URL=http://localhost:4173 \
 *   TEST_BYPASS_TOKEN=... TEST_USER_ROLE=customer TEST_USER_STATUS=active \
 *     npx playwright test auth-master-lane-d-provider-service
 */
import { test, expect } from '@playwright/test';

test.describe('AUTH MASTER Lane B — requestedService preservation', () => {
  test('A. /provider-onboarding?type=sitter — sitter chip highlighted', async ({ page }) => {
    await page.goto('/provider-onboarding?type=sitter');
    // The sitter service chip should render selected. testid convention
    // is `provider-type-<key>`; alternative selectors below are for the
    // resilient case a refactor renamed the attribute.
    const sitter = page.locator([
      '[data-testid="provider-type-sitter"][data-selected="true"]',
      '[data-testid="provider-type-sitter"].selected',
      '[data-testid="provider-type-sitter"][aria-pressed="true"]',
    ].join(', '));
    await expect(sitter).toBeVisible({ timeout: 15_000 });
  });

  test('B. /provider-onboarding?role=trainer — trainer chip highlighted', async ({ page }) => {
    await page.goto('/provider-onboarding?role=trainer');
    const trainer = page.locator([
      '[data-testid="provider-type-trainer"][data-selected="true"]',
      '[data-testid="provider-type-trainer"].selected',
      '[data-testid="provider-type-trainer"][aria-pressed="true"]',
    ].join(', '));
    await expect(trainer).toBeVisible({ timeout: 15_000 });
  });

  test('C. /provider-onboarding?requestedService=pet_sitting normalises to sitter', async ({ page }) => {
    // The CEO canonical vocabulary `pet_sitting` maps to the legacy
    // `sitter` label; the chip UI still speaks `sitter`.
    await page.goto('/provider-onboarding?requestedService=pet_sitting');
    const sitter = page.locator([
      '[data-testid="provider-type-sitter"][data-selected="true"]',
      '[data-testid="provider-type-sitter"].selected',
      '[data-testid="provider-type-sitter"][aria-pressed="true"]',
    ].join(', '));
    await expect(sitter).toBeVisible({ timeout: 15_000 });
  });

  test('D. sitter + walker survive a page refresh (sessionStorage union)', async ({ page }) => {
    await page.goto('/provider-onboarding?type=sitter');
    // Add walker by tapping its card.
    await page.locator('[data-testid="provider-type-walker"]').click();
    await page.reload();
    // Both chips must still be selected — Lane B additive-union
    // rule, never demote.
    const sitter = page.locator([
      '[data-testid="provider-type-sitter"][data-selected="true"]',
      '[data-testid="provider-type-sitter"].selected',
      '[data-testid="provider-type-sitter"][aria-pressed="true"]',
    ].join(', '));
    const walker = page.locator([
      '[data-testid="provider-type-walker"][data-selected="true"]',
      '[data-testid="provider-type-walker"].selected',
      '[data-testid="provider-type-walker"][aria-pressed="true"]',
    ].join(', '));
    await expect(sitter).toBeVisible({ timeout: 15_000 });
    await expect(walker).toBeVisible({ timeout: 15_000 });
  });
});

test.describe('AUTH MASTER Lane C — canonical customer destination', () => {
  test('E. signed-in customer never lands on /prestige/home', async ({ page }) => {
    // Requires TEST_BYPASS_TOKEN + TEST_USER_ROLE=customer +
    // TEST_USER_STATUS=active per playwright.config.ts (2026-08-18).
    // The extraHTTPHeaders are auto-forwarded by the config so this
    // spec receives an authorised session.
    if (!process.env.TEST_BYPASS_TOKEN) {
      test.skip(true, 'TEST_BYPASS_TOKEN not set — the auth-master customer canary requires the dev bypass');
    }
    await page.goto('/signin');
    // Wait for the SPA to complete post-login. The router settles
    // on the canonical customer workspace.
    await page.waitForLoadState('networkidle', { timeout: 15_000 });
    const finalUrl = page.url();
    // Guard: /prestige/home must NEVER appear as the landing.
    expect(finalUrl, `landed at ${finalUrl} — Lane C requires /pet-parent/home`).not.toMatch(/\/prestige\/home/);
    // And /home (marketing) is also not a customer landing.
    expect(finalUrl).not.toMatch(/\/home(?!\/|$)/);
    // The canonical destination.
    expect(finalUrl).toMatch(/\/pet-parent\/home/);
  });
});
