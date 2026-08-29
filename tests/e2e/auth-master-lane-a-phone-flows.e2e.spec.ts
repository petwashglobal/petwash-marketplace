/**
 * Lane A — TRUE NEW phone + returning phone end-to-end.
 *
 * CEO FLY MODE II §4 + §5 + §14 — AUTH CONVERSION P0 (2026-08-29).
 *
 * NEW PHONE:
 *   /signup-v2 → Continue with mobile → phone-only screen → Send code
 *   → OTP → Verify → account resolves as new → PROFILE_COMPLETION
 *   collects first_name / last_name / DOB / terms → /pet-parent/home.
 *
 * RETURNING PHONE (§5):
 *   /signup-v2 → mobile → OTP → Pet Parent home. No DOB. No signup
 *   Terms screen. No second email verification. Straight through.
 *
 * These specs assert the CEO §4 discipline: the user typed ONLY a
 * phone number and an OTP before the server made the new-vs-
 * returning call — no name/DOB/password/terms up front.
 */
import { test, expect } from '@playwright/test';
import {
  firebaseAdapterAvailable,
  installFirebaseTestAdapter,
  personas,
} from './firebaseTestAdapter';

test.describe('AUTH MASTER Lane A — TRUE NEW phone customer', () => {
  test('mobile → phone entry → OTP → 4-screen profile completion → /pet-parent/home', async ({
    page,
  }) => {
    test.skip(
      !firebaseAdapterAvailable(),
      'Firebase test adapter not available (BASE_URL or TEST_BYPASS_TOKEN missing).',
    );

    // §14 wire: customerNewPhone omits mobile_verification (the
    // signup handshake already verified it) — client renders exactly
    // four required actions.
    await installFirebaseTestAdapter(page, personas.customerNewPhone);
    await page.goto('/signup-v2');

    // 1) Method screen → tap Continue with mobile.
    const root = page.locator('[data-testid="signup-progressive-root"]');
    await expect(root).toHaveAttribute('data-state', 'METHOD_SELECTION');
    await page.locator('[data-testid="cta-signin-mobile"]').click();

    // 2) Phone entry screen. Exactly ONE input.
    await expect(root).toHaveAttribute('data-state', 'AUTHENTICATING');
    const phoneInput = page.locator('[data-testid="signup-progressive-input-mobile"]');
    await expect(phoneInput).toBeVisible();
    // Sanity: no name / DOB / password fields on this screen.
    await expect(page.locator('input[type="password"]')).toHaveCount(0);
    await expect(page.locator('input[type="date"]')).toHaveCount(0);

    await phoneInput.fill('+972 50 1234567');
    await page.locator('[data-testid="signup-progressive-send-code"]').click();

    // 3) CONTACT_VERIFY. sentTo surfaces on its own testid.
    await expect(root).toHaveAttribute('data-state', 'CONTACT_VERIFY');
    await expect(page.locator('[data-testid="signup-progressive-sent-to"]')).toContainText('+972');

    await page.locator('[data-testid="signup-progressive-input-otp"]').fill('123456');
    await page.locator('[data-testid="signup-progressive-verify"]').click();

    // 4) PROFILE_COMPLETION — 4 screens in canonical order.
    await expect(root).toHaveAttribute('data-state', 'PROFILE_COMPLETION', { timeout: 15_000 });
    const progress = page.locator('[data-testid="signup-progressive-progress"]');

    await expect(page.locator('[data-testid="signup-progressive-action-first_name"]')).toBeVisible();
    await expect(progress).toContainText('1');
    await expect(progress).toContainText('4');
    await page.locator('[data-testid="signup-progressive-next"]').click();

    await expect(page.locator('[data-testid="signup-progressive-action-last_name"]')).toBeVisible();
    await expect(progress).toContainText('2');
    await page.locator('[data-testid="signup-progressive-next"]').click();

    await expect(page.locator('[data-testid="signup-progressive-action-date_of_birth"]')).toBeVisible();
    await expect(progress).toContainText('3');
    await page.locator('[data-testid="signup-progressive-next"]').click();

    await expect(page.locator('[data-testid="signup-progressive-action-terms_acceptance"]')).toBeVisible();
    await expect(progress).toContainText('4');
    await page.locator('[data-testid="signup-progressive-next"]').click();

    // 5) POST_LOGIN → /pet-parent/home.
    await page.waitForURL((u) => /\/pet-parent\/home/.test(u.pathname), { timeout: 15_000 });
  });
});

test.describe('AUTH MASTER Lane A — RETURNING phone customer (§5)', () => {
  test('mobile → OTP → /pet-parent/home (NO DOB, NO Terms, NO email verification)', async ({
    page,
  }) => {
    test.skip(
      !firebaseAdapterAvailable(),
      'Firebase test adapter not available (BASE_URL or TEST_BYPASS_TOKEN missing).',
    );

    await installFirebaseTestAdapter(page, personas.customerActive);
    await page.goto('/signup-v2');

    // Record every data-state so we can assert PROFILE_COMPLETION
    // never fired.
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

    await page.locator('[data-testid="cta-signin-mobile"]').click();
    await page.locator('[data-testid="signup-progressive-input-mobile"]').fill('+972 50 7654321');
    await page.locator('[data-testid="signup-progressive-send-code"]').click();
    await page.locator('[data-testid="signup-progressive-input-otp"]').fill('987654');
    await page.locator('[data-testid="signup-progressive-verify"]').click();

    await page.waitForURL((u) => /\/pet-parent\/home/.test(u.pathname), { timeout: 15_000 });

    const states: string[] = await page.evaluate(
      () => (window as any).__recordedStates ?? [],
    );
    expect(states).not.toContain('PROFILE_COMPLETION');
    expect(
      await page.locator('[data-testid^="signup-progressive-action-"]').count(),
    ).toBe(0);
    expect(
      await page.locator('[data-testid="signup-progressive-progress"]').count(),
    ).toBe(0);
  });
});
