/**
 * Lane A — TRUE NEW email + returning email end-to-end.
 *
 * CEO FLY MODE II §4 + §5 + §14 — AUTH CONVERSION P0 (2026-08-29).
 *
 * NEW EMAIL:
 *   /signup-v2 → Continue with email → email-only screen → Send code
 *   → OTP → Verify → account resolves as new → PROFILE_COMPLETION
 *   collects mobile_verification / first_name / last_name / DOB / terms
 *   → /pet-parent/home.
 *
 * RETURNING EMAIL (§5):
 *   /signup-v2 → email → OTP → Pet Parent home. No DOB. No signup
 *   Terms screen. No profile completion. Straight through.
 *
 * These specs assert the CEO §4 discipline: the user typed ONLY an
 * email address and an OTP before the server made the new-vs-
 * returning call — no name/DOB/password/terms up front.
 */
import { test, expect } from '@playwright/test';
import {
  firebaseAdapterAvailable,
  installFirebaseTestAdapter,
  personas,
} from './firebaseTestAdapter';

test.describe('AUTH MASTER Lane A — TRUE NEW email customer', () => {
  test('email → email entry → OTP → 5-screen profile completion → /pet-parent/home', async ({
    page,
  }) => {
    test.skip(
      !firebaseAdapterAvailable(),
      'Firebase test adapter not available (BASE_URL or TEST_BYPASS_TOKEN missing).',
    );

    // §14 wire: customerNewEmail omits email_verification (the signup
    // handshake already verified it) — client renders exactly five
    // required actions.
    await installFirebaseTestAdapter(page, personas.customerNewEmail);
    await page.goto('/signup-v2');

    // 1) Method screen → tap Continue with email.
    const root = page.locator('[data-testid="signup-progressive-root"]');
    await expect(root).toHaveAttribute('data-state', 'METHOD_SELECTION');
    await page.locator('[data-testid="cta-signin-email"]').click();

    // 2) Email entry screen. Exactly ONE input.
    await expect(root).toHaveAttribute('data-state', 'AUTHENTICATING');
    const emailInput = page.locator('[data-testid="signup-progressive-input-email"]');
    await expect(emailInput).toBeVisible();
    // Sanity: no password / DOB / name fields on this screen.
    await expect(page.locator('input[type="password"]')).toHaveCount(0);
    await expect(page.locator('input[type="date"]')).toHaveCount(0);

    await emailInput.fill('newcomer@petwash.co.il');
    await page.locator('[data-testid="signup-progressive-send-code"]').click();

    // 3) CONTACT_VERIFY. sentTo surfaces on its own testid.
    await expect(root).toHaveAttribute('data-state', 'CONTACT_VERIFY');
    await expect(page.locator('[data-testid="signup-progressive-sent-to"]')).toContainText(
      'newcomer@petwash.co.il',
    );

    await page.locator('[data-testid="signup-progressive-input-otp"]').fill('123456');
    await page.locator('[data-testid="signup-progressive-verify"]').click();

    // 4) PROFILE_COMPLETION — 5 screens in canonical §6 order:
    //    mobile_verification → first_name → last_name → date_of_birth
    //    → terms_acceptance.
    await expect(root).toHaveAttribute('data-state', 'PROFILE_COMPLETION', { timeout: 15_000 });
    const progress = page.locator('[data-testid="signup-progressive-progress"]');

    await expect(
      page.locator('[data-testid="signup-progressive-action-mobile_verification"]'),
    ).toBeVisible();
    await expect(progress).toContainText('1');
    await expect(progress).toContainText('5');
    await page.locator('[data-testid="signup-progressive-next"]').click();

    await expect(page.locator('[data-testid="signup-progressive-action-first_name"]')).toBeVisible();
    await expect(progress).toContainText('2');
    await page.locator('[data-testid="signup-progressive-next"]').click();

    await expect(page.locator('[data-testid="signup-progressive-action-last_name"]')).toBeVisible();
    await expect(progress).toContainText('3');
    await page.locator('[data-testid="signup-progressive-next"]').click();

    await expect(
      page.locator('[data-testid="signup-progressive-action-date_of_birth"]'),
    ).toBeVisible();
    await expect(progress).toContainText('4');
    await page.locator('[data-testid="signup-progressive-next"]').click();

    await expect(
      page.locator('[data-testid="signup-progressive-action-terms_acceptance"]'),
    ).toBeVisible();
    await expect(progress).toContainText('5');
    await page.locator('[data-testid="signup-progressive-next"]').click();

    // 5) POST_LOGIN → /pet-parent/home.
    await page.waitForURL((u) => /\/pet-parent\/home/.test(u.pathname), { timeout: 15_000 });
  });
});

test.describe('AUTH MASTER Lane A — RETURNING email customer (§5)', () => {
  test('email → OTP → /pet-parent/home (NO DOB, NO Terms, NO profile completion)', async ({
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

    await page.locator('[data-testid="cta-signin-email"]').click();
    await page
      .locator('[data-testid="signup-progressive-input-email"]')
      .fill('returning@petwash.co.il');
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
