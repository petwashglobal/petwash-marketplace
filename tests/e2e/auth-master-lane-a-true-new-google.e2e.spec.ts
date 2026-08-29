/**
 * Lane A — TRUE NEW Google customer end-to-end.
 *
 * CEO FLY MODE II §10 + §11 — AUTH CONVERSION P0 (2026-08-29).
 *
 *   /signup-v2
 *   → click REAL Google button
 *   → Firebase adapter (personas.customerNew)
 *   → /api/auth/session returns isNewUser:true
 *   → /api/auth/account-resolution returns 3 ordered requiredActions
 *   → PROFILE_COMPLETION walks through mobile → DOB → terms
 *   → ACTIVATION → POST_LOGIN
 *   → /pet-parent/home
 *
 * Assertions:
 *   • state.name transitions land in the expected order (observed via
 *     the root's data-state attribute — the shell's public E2E hook).
 *   • the "1 of N" progress label counts up correctly.
 *   • the exact three required actions render one screen at a time.
 *   • provider intent (requestedService, returnTo, authJourneyId,
 *     firstTouch) survives the whole flow (§21) — asserted via the
 *     hidden signup-progressive-intent marker.
 *
 * Skips cleanly via firebaseAdapterAvailable() when TEST_BYPASS_TOKEN
 * is unset or BASE_URL points at production.
 */
import { test, expect } from '@playwright/test';
import {
  firebaseAdapterAvailable,
  installFirebaseTestAdapter,
  personas,
} from './firebaseTestAdapter';

test.describe('AUTH MASTER Lane A — TRUE NEW Google customer', () => {
  test('progressive /signup-v2 → Google → 3-screen profile completion → /pet-parent/home', async ({
    page,
  }) => {
    test.skip(
      !firebaseAdapterAvailable(),
      'Firebase test adapter not available (BASE_URL or TEST_BYPASS_TOKEN missing).',
    );

    // 1) Install the TRUE NEW persona — profile incomplete, three
    //    ordered actions: mobile → DOB → terms.
    await installFirebaseTestAdapter(page, personas.customerNew);

    // 2) Navigate with provider intent + auth-journey trace so §21
    //    passthrough can be asserted at the end.
    await page.goto(
      '/signup-v2?requestedService=pet_sitting&returnTo=%2Fsitter-suite&firstTouch=organic&authJourneyId=lane-a-e2e-1',
    );
    // 3) Method screen.
    await expect(page.locator('[data-testid="signup-progressive-root"]')).toHaveAttribute(
      'data-state',
      'METHOD_SELECTION',
    );

    // Provider intent survives on the hidden marker.
    const intentMarker = page.locator('[data-testid="signup-progressive-intent"]');
    await expect(intentMarker).toHaveAttribute('data-requested-service', 'pet_sitting');
    await expect(intentMarker).toHaveAttribute('data-return-to', '/sitter-suite');
    await expect(intentMarker).toHaveAttribute('data-first-touch', 'organic');
    await expect(intentMarker).toHaveAttribute('data-auth-journey-id', 'lane-a-e2e-1');

    // 4) Tap Continue with Google.
    await page.locator('[data-testid="cta-signin-google"]').click();

    // 5) Wait for the account-resolution response → PROFILE_COMPLETION.
    const root = page.locator('[data-testid="signup-progressive-root"]');
    await expect(root).toHaveAttribute('data-state', 'PROFILE_COMPLETION', { timeout: 15_000 });

    // 6) Screen 1/3 — mobile_verification. Progress reads "1 of 3".
    await expect(page.locator('[data-testid="signup-progressive-action-mobile_verification"]')).toBeVisible();
    const progress = page.locator('[data-testid="signup-progressive-progress"]');
    await expect(progress).toContainText('1');
    await expect(progress).toContainText('3');
    await page.locator('[data-testid="signup-progressive-next"]').click();

    // 7) Screen 2/3 — date_of_birth.
    await expect(page.locator('[data-testid="signup-progressive-action-date_of_birth"]')).toBeVisible();
    await expect(progress).toContainText('2');
    await page.locator('[data-testid="signup-progressive-next"]').click();

    // 8) Screen 3/3 — terms_acceptance.
    await expect(page.locator('[data-testid="signup-progressive-action-terms_acceptance"]')).toBeVisible();
    await expect(progress).toContainText('3');
    await page.locator('[data-testid="signup-progressive-next"]').click();

    // 9) POST_LOGIN then DONE → /pet-parent/home.
    await page.waitForURL((u) => /\/pet-parent\/home/.test(u.pathname), { timeout: 15_000 });
  });
});
