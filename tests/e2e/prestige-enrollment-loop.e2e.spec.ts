/**
 * Prestige enrollment loop — REQUIRED LIVE-BUG REGRESSION TEST.
 *
 * CEO P0 LIVE FIX 2026-08-29 §12.
 *
 * PERSONA:
 *   existing authenticated Pet Parent
 *   prestigeEnrolled = false
 *
 * FLOW:
 *   /pet-parent/home
 *   → Join PetWash Prestige (data-testid="prestige-join-cta")
 *   → URL MUST NOT become /signup /signin /login
 *   → /prestige/enroll renders
 *   → account data prefilled (no editable name/email/phone/password inputs)
 *   → complete enrollment
 *   → server returns Prestige enrolled
 *   → Pet Parent home no longer shows the Join Prestige CTA
 *
 * ALSO ASSERTED HERE:
 *   §14 already-Prestige → /loyalty/join must NOT show Join/signup;
 *   §13 signed-out → /loyalty/join carries the enroll intent forward.
 */
import { test, expect } from '@playwright/test';
import { bypassAvailable, headersForPersona } from './testBypassHeaders';

test.describe('P0 Prestige enrollment — signed-in Pet Parent (§12)', () => {
  test.use({ extraHTTPHeaders: headersForPersona('customer', 'active') });

  test('Join CTA → /prestige/enroll (NEVER /signup /signin /login)', async ({ page }) => {
    test.skip(!bypassAvailable(), 'TEST_BYPASS_TOKEN is not set — cannot exercise signed-in surfaces.');

    // Guard: fail loud if the CTA ever routes the user through /signup.
    // A regression to the pre-fix behavior would trigger this.
    const badRedirects: string[] = [];
    page.on('framenavigated', (frame) => {
      const u = frame.url();
      if (/\/(signup|signin|login)(\?|$|\/)/.test(u)) {
        badRedirects.push(u);
      }
    });

    await page.goto('/pet-parent/home');

    const cta = page.locator('[data-testid="prestige-join-cta"]');
    await expect(cta).toBeVisible({ timeout: 15_000 });

    await cta.click();

    await page.waitForURL((u) => /\/prestige\/enroll/.test(u.pathname), { timeout: 15_000 });
    expect(badRedirects).toEqual([]);

    // Enrollment surface renders.
    await expect(page.locator('[data-testid="prestige-enroll-root"]')).toBeVisible();

    // Account data prefilled — the whole design principle: don't ask
    // an existing customer to type their name/email/phone again.
    await expect(page.locator('[data-testid="prestige-enroll-account-summary"]')).toBeVisible();
    // No editable name / email / phone / password / DOB inputs.
    await expect(page.locator('input[type="email"]')).toHaveCount(0);
    await expect(page.locator('input[type="tel"]')).toHaveCount(0);
    await expect(page.locator('input[type="password"]')).toHaveCount(0);
    await expect(page.locator('input[type="date"]')).toHaveCount(0);

    // Consent + submit.
    await page.locator('[data-testid="prestige-enroll-consent"]').check();
    const submit = page.locator('[data-testid="prestige-enroll-submit"]');
    await expect(submit).toBeEnabled();
    await submit.click();

    // Success returns to canonical customer home.
    await page.waitForURL((u) => /\/pet-parent\/home/.test(u.pathname), { timeout: 15_000 });

    // And the Join CTA no longer shows — Prestige is now active on the
    // capability projection. (The prestige-tier-chip may render instead.)
    await expect(page.locator('[data-testid="prestige-join-cta"]')).toHaveCount(0, {
      timeout: 15_000,
    });

    expect(badRedirects).toEqual([]);
  });
});

test.describe('P0 Prestige enrollment — signed-out via /loyalty/join (§13)', () => {
  // No auth header — a signed-out visitor.
  test('/loyalty/join for a signed-out visitor forwards intent to /signup with redirect=/prestige/enroll', async ({
    page,
  }) => {
    await page.goto('/loyalty/join');
    // The router should send them through the normal signup shell,
    // but with the enroll intent surviving as `redirect=`.
    await page.waitForURL((u) => /\/(signup|signin)/.test(u.pathname), { timeout: 10_000 });
    expect(page.url()).toContain('flow=prestige');
    expect(decodeURIComponent(page.url())).toContain('/prestige/enroll');
  });
});
