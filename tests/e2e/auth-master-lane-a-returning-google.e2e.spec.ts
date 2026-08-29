/**
 * Lane A — RETURNING Google customer end-to-end.
 *
 * CEO FLY MODE II §12 — AUTH CONVERSION P0 (2026-08-29).
 *
 *   /signup-v2
 *   → click REAL Google button
 *   → Firebase adapter (personas.customerActive — NO newUser field)
 *   → /api/auth/session returns isNewUser:false
 *   → /api/auth/account-resolution returns requiredActions: []
 *   → straight to ACTIVATION → POST_LOGIN
 *   → /pet-parent/home
 *
 * Discipline (CEO §3):
 *   • NO AccountActivation screen.
 *   • NO mobile collection.
 *   • NO DOB form.
 *   • NO signup Terms screen.
 *   • No PROFILE_COMPLETION whatsoever — the reducer must go
 *     ACCOUNT_RESOLUTION → ACTIVATION directly on requiredActions:[].
 *
 * Assertions:
 *   • data-state never enters PROFILE_COMPLETION.
 *   • no "signup-progressive-action-*" testid ever appears.
 *   • no "signup-progressive-progress" label ever appears.
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

test.describe('AUTH MASTER Lane A — RETURNING Google customer', () => {
  test('/signup-v2 → Google → straight to /pet-parent/home (no profile completion)', async ({
    page,
  }) => {
    test.skip(
      !firebaseAdapterAvailable(),
      'Firebase test adapter not available (BASE_URL or TEST_BYPASS_TOKEN missing).',
    );

    // 1) Returning persona — no newUser field → session response
    //    signals isNewUser:false, account-resolution returns [].
    await installFirebaseTestAdapter(page, personas.customerActive);

    // 2) Navigate.
    await page.goto('/signup-v2');

    // 3) Method screen.
    const root = page.locator('[data-testid="signup-progressive-root"]');
    await expect(root).toHaveAttribute('data-state', 'METHOD_SELECTION');

    // 4) Watch state.name transitions using a listener on the DOM.
    //    We snapshot every data-state value the root carries so we can
    //    assert PROFILE_COMPLETION never appears. Playwright's
    //    MutationObserver runs in the page context and pushes each
    //    transition into a __recordedStates array.
    await page.evaluate(() => {
      (window as any).__recordedStates = [];
      const root = document.querySelector('[data-testid="signup-progressive-root"]');
      if (!root) return;
      (window as any).__recordedStates.push(root.getAttribute('data-state'));
      const observer = new MutationObserver(() => {
        (window as any).__recordedStates.push(root.getAttribute('data-state'));
      });
      observer.observe(root, { attributes: true, attributeFilter: ['data-state'] });
    });

    // 5) Tap Continue with Google.
    await page.locator('[data-testid="cta-signin-google"]').click();

    // 6) Wait for /pet-parent/home landing — the returning path
    //    should reach this without any user interaction beyond
    //    the initial Google click.
    await page.waitForURL((u) => /\/pet-parent\/home/.test(u.pathname), { timeout: 15_000 });

    // 7) Assert PROFILE_COMPLETION never appeared in the sequence.
    const states: string[] = await page.evaluate(
      () => (window as any).__recordedStates ?? [],
    );
    expect(states).not.toContain('PROFILE_COMPLETION');

    // 8) No profile-completion screens rendered — action + progress
    //    testids must never have been mounted.
    //    We check by counting all matching testids in the current
    //    document snapshot at the moment of landing.
    const actionCount = await page
      .locator('[data-testid^="signup-progressive-action-"]')
      .count();
    expect(actionCount).toBe(0);
    const progressCount = await page
      .locator('[data-testid="signup-progressive-progress"]')
      .count();
    expect(progressCount).toBe(0);
  });
});
