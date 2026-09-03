/**
 * Lane D · real-browser E2E for the two Lane A + Lane B routing fixes.
 * Real Chromium, real DOM, real user clicks — no URL-string tests.
 *
 * Covers:
 *   1. ChoosePath "Continue as Pet Parent" → /pet-parent/home
 *      (Lane A CEO ruling 2026-09-03 — canonical customer workspace)
 *   2. ChoosePath "decide later" link → /pet-parent/home
 *   3. /provider-onboarding?type=sitter → sitter chip is pre-selected
 *      (Lane B — legacy `type=` alias)
 *   4. /provider-onboarding?role=trainer → trainer chip pre-selected
 *      (Lane B — legacy `role=` alias)
 *   5. /provider-onboarding?requestedService=pet_sitting → sitter chip
 *      pre-selected (CEO §A7 canonical vocabulary)
 *   6. Additive-union: tap Sitter then Walker then reload → both
 *      chips still selected (sessionStorage never demotes)
 *
 * Uses stubbed server so runs on any environment. HE + EN both covered
 * by the shared `data-testid` handles.
 */

import { test, expect, type Page } from '@playwright/test';

// Signed-in Pet Parent, no active provider — a Pet Parent tapping
// ChoosePath (the "what do you want to do?" screen after signup).
const WHOAMI_PET_PARENT = {
  authenticated: true,
  uid: 'usr_lane_d_e2e_1',
  email: 'lane-d-e2e@petwash.co.il',
  role: 'customer',
  isSuperAdmin: false,
  dashboardsAllowed: ['member'],
  profileStatus: 'complete',
  providerStatus: 'none',
  prestigeStatus: 'active',
  roles: ['customer'],
  session: { ageSeconds: 30, maxAgeSeconds: 3600, ip: '127.0.0.1', createdAt: null },
  claims: { role: 'customer', accountType: 'external' },
};
const CAPS_PET_PARENT = {
  ok: true,
  capabilities: {
    identity: { emailVerified: true, mobileVerified: true, activated: true },
    provider: { active: false, applicant: false, applicationStatus: null, services: [] },
    prestige: { enrolled: true, tier: 'gold', memberId: 'PM-2024-1' },
    staff: { active: false },
    admin: { admin: false, superAdmin: false },
  },
};

async function stubAuth(page: Page) {
  await page.route('**/api/session/whoami', (r) =>
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(WHOAMI_PET_PARENT) }));
  await page.route('**/api/me/capabilities', (r) =>
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(CAPS_PET_PARENT) }));
  // Post-login: customer intent → /pet-parent/home (Lane A).
  await page.route('**/api/auth/post-login', (r) =>
    r.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true, nextUrl: '/pet-parent/home', reason: 'OK' }),
    }));
  // Provider apply endpoint — never hit in these tests but stub to avoid
  // an accidental real POST if a test drifts.
  await page.route('**/api/provider-applications**', (r) =>
    r.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ ok: true }) }));
}

test.describe('Lane A · canonical customer destination via ChoosePath', () => {
  test('"Continue as Pet Parent" tile navigates to /pet-parent/home', async ({ page }) => {
    await stubAuth(page);
    await page.goto('/choose-path');
    // Primary tile carries a stable data-testid tied to the option key.
    await page.getByTestId('choosepath-pet_parent').click();
    await page.waitForURL('**/pet-parent/home', { timeout: 5000 });
    expect(new URL(page.url()).pathname).toBe('/pet-parent/home');
  });

  test('"decide later" link navigates to /pet-parent/home (not /home marketing)', async ({ page }) => {
    await stubAuth(page);
    await page.goto('/choose-path');
    // Lane A added a data-testid for the decide-later link so this
    // exact assertion is possible without label-scraping.
    await page.getByTestId('choosepath-decide-later').click();
    await page.waitForURL('**/pet-parent/home', { timeout: 5000 });
    expect(new URL(page.url()).pathname).toBe('/pet-parent/home');
  });
});

test.describe('Lane B · provider requestedService preservation', () => {
  test('?type=sitter (legacy alias) pre-selects the Sitter chip', async ({ page }) => {
    await stubAuth(page);
    await page.goto('/provider-onboarding?type=sitter');
    // The Sitter picker card exposes data-testid="provider-type-sitter"
    // and data-selected=<bool> so the pre-selection is provable.
    const card = page.getByTestId('provider-type-sitter').first();
    await expect(card).toBeVisible({ timeout: 5000 });
    await expect(card).toHaveAttribute('data-selected', 'true');
  });

  test('?role=trainer (legacy alias) pre-selects the Trainer chip', async ({ page }) => {
    await stubAuth(page);
    await page.goto('/provider-onboarding?role=trainer');
    const card = page.getByTestId('provider-type-trainer').first();
    await expect(card).toBeVisible({ timeout: 5000 });
    await expect(card).toHaveAttribute('data-selected', 'true');
  });

  test('?requestedService=pet_sitting (CEO §A7 canonical) pre-selects Sitter', async ({ page }) => {
    await stubAuth(page);
    await page.goto('/provider-onboarding?requestedService=pet_sitting');
    const card = page.getByTestId('provider-type-sitter').first();
    await expect(card).toBeVisible({ timeout: 5000 });
    await expect(card).toHaveAttribute('data-selected', 'true');
  });

  test('additive union: tap Sitter, tap Walker, reload → both chips still selected', async ({ page }) => {
    await stubAuth(page);
    await page.goto('/provider-onboarding');
    // Tap Sitter, then Walker.
    await page.getByTestId('provider-type-sitter').first().click();
    await page.getByTestId('provider-type-walker').first().click();
    // Reload — the sessionStorage union must survive the refresh.
    await page.reload();
    await expect(page.getByTestId('provider-type-sitter').first()).toHaveAttribute('data-selected', 'true');
    await expect(page.getByTestId('provider-type-walker').first()).toHaveAttribute('data-selected', 'true');
  });
});
