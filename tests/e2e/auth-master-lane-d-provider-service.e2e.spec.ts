/**
 * AUTH MASTER Lane D — BROWSER-INTEGRATION-VERIFIED (NOT full auth E2E).
 *
 * CEO 2026-08-29 §7 §17 §21 — "a test called 'provider signup' that
 * only verifies the URL still contains ?flow=provider is NOT provider-
 * signup verification". This spec drives REAL controls in a real
 * Chromium and proves the Lane B (PR #2170) requestedService wire and
 * the Lane C (PR #2171) canonical customer destination.
 *
 * IMPORTANT SCOPE LIMIT (CEO §1 §17):
 *   These tests are BROWSER-INTEGRATION-VERIFIED, not FULL AUTH E2E.
 *   They exercise:
 *     * the provider-onboarding chip UI (real DOM, real clicks,
 *       real keyboard, real reload)
 *     * server post-login → /pet-parent/home for a signed-in customer
 *   They do NOT yet exercise:
 *     * CTA → Firebase auth → PetWash session → post-login → onboarding
 *       (a Firebase test/emulator adapter is a separate lane —
 *       AUTH-JOURNEY-E2E gate)
 *     * server-draft second-device resume
 *     * Prestige + Provider multi-role
 *   Those live in the AUTH-JOURNEY-E2E gate whose PRs will land
 *   separately. This spec does not certify them — pretending it did
 *   would be exactly the false-confidence §7 banned.
 *
 * Scenarios (7):
 *   A. /provider-onboarding?type=sitter        → sitter chip selected
 *   B. /provider-onboarding?role=trainer       → trainer chip selected
 *   C. /provider-onboarding?requestedService=pet_sitting
 *                                              → sitter chip selected
 *   D. tap Sitter, tap Walker, reload          → BOTH chips selected
 *      (Lane B additive-union survives refresh via sessionStorage)
 *   F. seed sitter, add walker, DESELECT SITTER, reload
 *                                              → walker ONLY
 *      (CEO §7 §8 §10 regression pin — the union bug caught in review;
 *       replaceProviderServiceSelection must not resurrect sitter)
 *   G. keyboard: tab to Sitter card, press Space → sitter selected
 *      (CEO §13 — role=button carries real keyboard semantics)
 *   H. one click on the Sitter card = exactly ONE state transition
 *      (CEO §11 — single event owner; the inner Checkbox must NOT
 *       also fire toggle, or a single click would flip twice → no-op)
 *   E. /signin with a completed customer profile lands on
 *      /pet-parent/home — NEVER /prestige/home  (Lane C)
 *
 * Depends on Lane B (PR #2170) + Lane C (PR #2171) landing on the
 * base branch. When run against a build that has neither, the
 * assertions fail — which is exactly the CEO §7 intent: a fake E2E
 * green is worse than a red one.
 *
 * Usage:
 *   npm run build && npx serve dist/public -s -p 4173
 *   BASE_URL=http://localhost:4173 \
 *   TEST_BYPASS_TOKEN=... TEST_USER_ROLE=customer TEST_USER_STATUS=active \
 *     npx playwright test auth-master-lane-d-provider-service
 *
 * CI gate discipline (CEO §6):
 *   Test E fail-skips when TEST_BYPASS_TOKEN is absent — that is
 *   acceptable ONLY for optional local runs. The required
 *   AUTH-JOURNEY-E2E CI job MUST provide the bypass token. If it
 *   cannot, the required job MUST report NOT_VERIFIED — not green
 *   because skipped.
 */
import { test, expect } from '@playwright/test';

const chipSelectors = (key: string) => [
  `[data-testid="provider-type-${key}"][data-selected="true"]`,
  `[data-testid="provider-type-${key}"].selected`,
  `[data-testid="provider-type-${key}"][aria-pressed="true"]`,
].join(', ');

const chipUnselectedSelectors = (key: string) => [
  `[data-testid="provider-type-${key}"][data-selected="false"]`,
  `[data-testid="provider-type-${key}"][aria-pressed="false"]`,
].join(', ');

test.describe('AUTH MASTER Lane D — BROWSER-INTEGRATION-VERIFIED (Lane B chip preservation)', () => {
  test('A. /provider-onboarding?type=sitter — sitter chip highlighted', async ({ page }) => {
    await page.goto('/provider-onboarding?type=sitter');
    await expect(page.locator(chipSelectors('sitter'))).toBeVisible({ timeout: 15_000 });
  });

  test('B. /provider-onboarding?role=trainer — trainer chip highlighted', async ({ page }) => {
    await page.goto('/provider-onboarding?role=trainer');
    await expect(page.locator(chipSelectors('trainer'))).toBeVisible({ timeout: 15_000 });
  });

  test('C. /provider-onboarding?requestedService=pet_sitting normalises to sitter', async ({ page }) => {
    // The CEO canonical vocabulary `pet_sitting` maps to the legacy
    // `sitter` label; the chip UI still speaks `sitter`.
    await page.goto('/provider-onboarding?requestedService=pet_sitting');
    await expect(page.locator(chipSelectors('sitter'))).toBeVisible({ timeout: 15_000 });
  });

  test('D. sitter + walker survive a page refresh (sessionStorage union)', async ({ page }) => {
    await page.goto('/provider-onboarding?type=sitter');
    await expect(page.locator(chipSelectors('sitter'))).toBeVisible({ timeout: 15_000 });
    // Add walker by activating its card. Click the outer card
    // (single event owner — see scenario H for the single-mutation pin).
    await page.locator('[data-testid="provider-type-walker"]').click();
    await expect(page.locator(chipSelectors('walker'))).toBeVisible({ timeout: 5_000 });
    await page.reload();
    // Both chips must still be selected — Lane B additive-union
    // survives refresh via sessionStorage.
    await expect(page.locator(chipSelectors('sitter'))).toBeVisible({ timeout: 15_000 });
    await expect(page.locator(chipSelectors('walker'))).toBeVisible({ timeout: 15_000 });
  });

  test('F. deselecting sitter (after adding walker) does NOT resurrect on reload — §7 §8 §10', async ({ page }) => {
    // CEO §7 §8 caught in review: the union-only storage model made
    // deselect impossible — reloading brought sitter back. The Lane B
    // fix split the API into intent-add (union) vs
    // selection-replace (exact). This spec pins the fix.
    await page.goto('/provider-onboarding?type=sitter');
    await expect(page.locator(chipSelectors('sitter'))).toBeVisible({ timeout: 15_000 });
    // Add walker.
    await page.locator('[data-testid="provider-type-walker"]').click();
    await expect(page.locator(chipSelectors('walker'))).toBeVisible({ timeout: 5_000 });
    // Now DESELECT sitter.
    await page.locator('[data-testid="provider-type-sitter"]').click();
    await expect(page.locator(chipUnselectedSelectors('sitter'))).toBeVisible({ timeout: 5_000 });
    // Reload — sitter MUST stay dropped.
    await page.reload();
    await expect(page.locator(chipSelectors('walker'))).toBeVisible({ timeout: 15_000 });
    // The primary assertion: sitter is NOT selected after reload.
    // If the union bug returns, sitter's data-selected flips back to
    // "true" here and this fails loudly — exactly the §7 intent.
    await expect(page.locator(chipUnselectedSelectors('sitter'))).toBeVisible({ timeout: 5_000 });
    await expect(page.locator(chipSelectors('sitter'))).toHaveCount(0);
  });

  test('G. keyboard: Tab to Sitter card, press Space → sitter selected (§13)', async ({ page }) => {
    // role="button" is only real if it also handles Enter/Space and is
    // in the tab order (tabIndex=0). Otherwise it is a lie to assistive
    // tech. This spec walks the DOM: focus the Sitter card and press
    // Space; the card must toggle just like a mouse click would.
    await page.goto('/provider-onboarding');
    // Wait for the picker to render.
    await expect(page.locator('[data-testid="provider-type-sitter"]')).toBeVisible({ timeout: 15_000 });
    // Focus the sitter card programmatically — a stable proxy for
    // "Tab landed here" that doesn't need to count Tab presses
    // through unrelated form fields.
    await page.locator('[data-testid="provider-type-sitter"]').focus();
    // Space activates.
    await page.keyboard.press(' ');
    await expect(page.locator(chipSelectors('sitter'))).toBeVisible({ timeout: 5_000 });
    // Space again toggles OFF.
    await page.keyboard.press(' ');
    await expect(page.locator(chipUnselectedSelectors('sitter'))).toBeVisible({ timeout: 5_000 });
    // Enter also activates.
    await page.keyboard.press('Enter');
    await expect(page.locator(chipSelectors('sitter'))).toBeVisible({ timeout: 5_000 });
  });

  test('H. ONE physical click = exactly ONE state transition (§11 double-toggle hazard)', async ({ page }) => {
    // The card has role="button" onClick + used to have a nested
    // Checkbox with its own onCheckedChange + a Label with htmlFor.
    // A single click on the label used to fire the toggle twice
    // (label→checkbox synthetic click + parent onClick bubble) which
    // cancels out. The Lane D semantic fix makes the outer card the
    // sole event owner (Checkbox is aria-hidden + pointer-events-none
    // + no onCheckedChange). Assert: clicking once flips the state.
    await page.goto('/provider-onboarding');
    await expect(page.locator('[data-testid="provider-type-sitter"]')).toBeVisible({ timeout: 15_000 });
    // Start unselected.
    await expect(page.locator(chipUnselectedSelectors('sitter'))).toBeVisible({ timeout: 5_000 });
    // Click the card once.
    await page.locator('[data-testid="provider-type-sitter"]').click();
    // Selected after ONE click.
    await expect(page.locator(chipSelectors('sitter'))).toBeVisible({ timeout: 5_000 });
    // Click again — deselected.
    await page.locator('[data-testid="provider-type-sitter"]').click();
    await expect(page.locator(chipUnselectedSelectors('sitter'))).toBeVisible({ timeout: 5_000 });
  });
});

test.describe('AUTH MASTER Lane D — BROWSER-INTEGRATION-VERIFIED (Lane C canonical customer destination)', () => {
  test('E. signed-in customer never lands on /prestige/home', async ({ page }) => {
    // Requires TEST_BYPASS_TOKEN + TEST_USER_ROLE=customer +
    // TEST_USER_STATUS=active per playwright.config.ts (2026-08-18).
    // CEO §6: this test skipping in a REQUIRED CI gate is not
    // acceptable — the AUTH-JOURNEY-E2E job must provide the token
    // or report NOT_VERIFIED. Local runs may skip freely.
    if (!process.env.TEST_BYPASS_TOKEN) {
      test.skip(true, 'TEST_BYPASS_TOKEN not set — required CI gate must provide it; local runs skip freely (CEO §6)');
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
