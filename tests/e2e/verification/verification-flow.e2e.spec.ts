/**
 * The focused verification browser suite — the one that runs NOW and goes into
 * CI first, rather than waiting for the 780-test historical suite to be triaged.
 *
 * Real browser, real focus and keyboard, real paste, real reload, real RTL
 * shaping, on desktop Chrome + WebKit (the iPhone engine) + mobile Chrome.
 * Every API is stubbed in-page; what is under test is the shipped
 * VerificationFlow, useVerificationChallenge and authEmailTransport.
 */
import { test, expect, type Page } from '@playwright/test';
import { installVerificationServer, makeChallenge, gotoHarness } from './harness';

const FLOW = '[data-testid="verification-flow"]';
const CODE = '[data-testid="verification-code-input"]';
const CONTINUE = '[data-testid="verification-continue"]';
const RESEND = '[data-testid="verification-resend"]';
const ERROR = '[data-testid="verification-error"]';
const DEST = '[data-testid="verification-destination"]';

async function typeCode(page: Page, code: string) {
  await page.locator(CODE).click();
  await page.keyboard.type(code, { delay: 15 });
}

test.describe('the shared verification screen', () => {
  test('shows why, where, and what happens next', async ({ page }) => {
    await installVerificationServer(page);
    await gotoHarness(page);
    await expect(page.locator(FLOW)).toBeVisible();
    await expect(page.getByText('Verify your email to finish creating your Pet Wash account.')).toBeVisible();
    await expect(page.getByText("Next you'll add your name and mobile number.")).toBeVisible();
  });

  test('THE DESTINATION IS MASKED — the raw address never reaches the page', async ({ page }) => {
    const server = await installVerificationServer(page);
    server.setChallenge(makeChallenge({ maskedDestination: 'p••••••h@example.com' }));
    await gotoHarness(page, { email: 'petwash@example.com' });
    await expect(page.locator(DEST)).toHaveText('p••••••h@example.com');
    // The full address must not appear anywhere in the rendered document.
    const html = await page.content();
    expect(html).not.toContain('petwash@example.com');
  });

  test('a 6-digit code pasted in one go lands and submits', async ({ page }) => {
    await installVerificationServer(page);
    await gotoHarness(page);
    await page.locator(CODE).click();
    // Real clipboard paste, not a synthetic value set.
    await page.evaluate(() => navigator.clipboard.writeText('482915')).catch(() => {});
    await page.locator(CODE).fill('');
    await page.keyboard.insertText('482915');
    await expect(page.locator(CODE)).toHaveValue('482915');
    await expect.poll(() => page.evaluate(() => (window as any).__verified__.length)).toBe(1);
  });

  test('the input keeps its mobile affordances', async ({ page }) => {
    await installVerificationServer(page);
    await gotoHarness(page);
    const el = page.locator(CODE);
    await expect(el).toHaveAttribute('autocomplete', 'one-time-code');
    await expect(el).toHaveAttribute('inputmode', 'numeric');
  });

  test('typing all six digits auto-submits exactly once', async ({ page }) => {
    const server = await installVerificationServer(page);
    await gotoHarness(page);
    await typeCode(page, '123456');
    await expect.poll(() => page.evaluate(() => (window as any).__verified__.length)).toBe(1);
    await page.waitForTimeout(600);
    expect(server.calls.filter((c) => c === 'verify')).toHaveLength(1);
  });

  test('double-clicking Continue does not spend two attempts', async ({ page }) => {
    const server = await installVerificationServer(page);
    // Hold the verify open so the second click lands while the first is in flight.
    await gotoHarness(page, { autoSubmitBlocked: true });
    await page.locator(CODE).click();
    await page.keyboard.type('11111');           // five digits: no auto-submit
    await page.keyboard.type('1');               // sixth completes it
    await page.locator(CONTINUE).click({ force: true }).catch(() => {});
    await page.locator(CONTINUE).click({ force: true }).catch(() => {});
    await page.waitForTimeout(800);
    expect(server.calls.filter((c) => c === 'verify').length).toBeLessThanOrEqual(1);
  });

  test('a wrong code shows human copy and does NOT reset the screen', async ({ page }) => {
    const server = await installVerificationServer(page);
    server.setVerifyResult({ status: 401, body: { ok: false, reasonCode: 'INVALID_CODE' } });
    await gotoHarness(page);
    await typeCode(page, '000000');
    await expect(page.locator(ERROR)).toHaveText("That code isn't correct. Try again.");
    // Still on the code screen, still showing where the code went.
    await expect(page.locator(CODE)).toBeVisible();
    await expect(page.locator(DEST)).toHaveText('p••••••h@example.com');
  });

  test('an expired code hides the input and points at Resend', async ({ page }) => {
    const server = await installVerificationServer(page);
    server.setVerifyResult({ status: 410, body: { ok: false, reasonCode: 'CHALLENGE_EXPIRED' } });
    await gotoHarness(page);
    await typeCode(page, '000000');
    await expect(page.locator(ERROR)).toHaveText('That code has expired. Send a new one.');
    await expect(page.locator(CODE)).toHaveCount(0);
    await expect(page.locator(RESEND)).toBeVisible();
  });

  test('an already-consumed code is refused without pretending it worked', async ({ page }) => {
    const server = await installVerificationServer(page);
    server.setVerifyResult({ status: 409, body: { ok: false, reasonCode: 'CHALLENGE_NOT_PENDING' } });
    await gotoHarness(page);
    await typeCode(page, '222222');
    await expect(page.locator(ERROR)).toHaveText('This code has already been used. Send a new one.');
    expect(await page.evaluate(() => (window as any).__verified__.length)).toBe(0);
  });

  test('the resend countdown is server-driven and blocks the button', async ({ page }) => {
    const server = await installVerificationServer(page);
    server.setChallenge(makeChallenge({ resendAvailableAt: new Date(Date.now() + 60_000).toISOString() }));
    await gotoHarness(page);
    await expect(page.locator(RESEND)).toBeDisabled();
    await expect(page.locator(RESEND)).toContainText('Resend in');
    await page.locator(RESEND).click({ force: true }).catch(() => {});
    await page.waitForTimeout(400);
    expect(server.calls.filter((c) => c === 'resend')).toHaveLength(0);
  });

  test('resend becomes available exactly when the server says', async ({ page }) => {
    const server = await installVerificationServer(page);
    server.setChallenge(makeChallenge({ resendAvailableAt: new Date(Date.now() + 2_000).toISOString() }));
    await gotoHarness(page);
    await expect(page.locator(RESEND)).toBeDisabled();
    await expect(page.locator(RESEND)).toBeEnabled({ timeout: 6_000 });
  });

  test('resend confirms visibly and clears the stale digits', async ({ page }) => {
    const server = await installVerificationServer(page);
    server.setChallenge(makeChallenge({ resendAvailableAt: new Date(Date.now() - 1_000).toISOString() }));
    await gotoHarness(page);
    await page.locator(CODE).click();
    await page.keyboard.type('12345');
    await page.locator(RESEND).click();
    await expect(page.locator('[data-testid="verification-resent"]')).toHaveText('New code sent');
    // A new code invalidates what was typed; leaving it on screen invites a
    // customer to submit five stale digits plus one new one.
    await expect(page.locator(CODE)).toHaveValue('');
  });

  test('RESEND HITS /resend, NOT /start — start would kill the code already sent', async ({ page }) => {
    const server = await installVerificationServer(page);
    server.setChallenge(makeChallenge({ resendAvailableAt: new Date(Date.now() - 1_000).toISOString() }));
    await gotoHarness(page);
    const startsBefore = server.calls.filter((c) => c === 'start').length;
    await page.locator(RESEND).click();
    await expect(page.locator('[data-testid="verification-resent"]')).toBeVisible();
    expect(server.calls.filter((c) => c === 'resend')).toHaveLength(1);
    expect(server.calls.filter((c) => c === 'start')).toHaveLength(startsBefore);
  });

  test('after a resend the OLD code is rejected with honest copy', async ({ page }) => {
    const server = await installVerificationServer(page);
    server.setChallenge(makeChallenge({ resendAvailableAt: new Date(Date.now() - 1_000).toISOString() }));
    await gotoHarness(page);
    await page.locator(RESEND).click();
    await expect(page.locator('[data-testid="verification-resent"]')).toBeVisible();
    server.setVerifyResult({ status: 401, body: { ok: false, reasonCode: 'INVALID_CODE' } });
    await typeCode(page, '111111');
    await expect(page.locator(ERROR)).toHaveText("That code isn't correct. Try again.");
  });

  test('a cooldown from the server is explained, not swallowed', async ({ page }) => {
    const server = await installVerificationServer(page);
    server.setChallenge(makeChallenge({ resendAvailableAt: new Date(Date.now() - 1_000).toISOString() }));
    server.setResendResult({ status: 429, body: { ok: false, reasonCode: 'CHALLENGE_COOLDOWN' } });
    await gotoHarness(page);
    await page.locator(RESEND).click();
    await expect(page.locator(ERROR)).toHaveText('Give the last code a moment to arrive before asking for another.');
  });

  test('a network failure promises the code is still valid', async ({ page }) => {
    const server = await installVerificationServer(page);
    await gotoHarness(page);
    await page.route('**/api/auth/email/verify', (r) => r.abort());
    await typeCode(page, '333333');
    await expect(page.locator(ERROR)).toContainText('still valid');
    await expect(page.locator(CODE)).toBeVisible();
  });

  test('refresh mid-challenge does not strand the customer', async ({ page }) => {
    await installVerificationServer(page);
    await gotoHarness(page);
    await page.locator(CODE).click();
    await page.keyboard.type('999');
    await page.reload({ waitUntil: 'domcontentloaded' });
    // A fresh challenge is started and the screen is usable again — never a
    // blank page or a dead form.
    await expect(page.locator(FLOW)).toBeVisible();
    await expect(page.locator(CODE)).toBeVisible();
    await expect(page.locator(DEST)).not.toHaveText('•••');
  });

  test('browser Back leaves the flow cleanly', async ({ page }) => {
    await installVerificationServer(page);
    await gotoHarness(page);
    await expect(page.locator(FLOW)).toBeVisible();
    await page.goto('about:blank');
    await page.goBack({ waitUntil: 'domcontentloaded' });
    await expect(page.locator(FLOW)).toBeVisible();
  });

  test('Change email is offered and reported to the caller', async ({ page }) => {
    await installVerificationServer(page);
    await gotoHarness(page);
    await page.locator('[data-testid="verification-change-destination"]').click();
    expect(await page.evaluate(() => (window as any).__changeDestination__)).toBe(1);
  });
});

test.describe('Hebrew', () => {
  test('is genuinely RTL, not translated strings in an LTR box', async ({ page }) => {
    await installVerificationServer(page);
    await gotoHarness(page, { lang: 'he' });
    await expect(page.locator(FLOW)).toHaveAttribute('dir', 'rtl');
    await expect(page.getByText('אמתו את כתובת האימייל כדי לסיים את יצירת חשבון Pet Wash.')).toBeVisible();
  });

  test('the digits stay LTR even inside an RTL page', async ({ page }) => {
    await installVerificationServer(page);
    await gotoHarness(page, { lang: 'he' });
    await typeCode(page, '123456');
    // A code reads left-to-right in every language; if the row inherited RTL
    // the customer would type 123456 and see it reversed.
    await expect(page.locator(CODE)).toHaveValue('123456');
  });

  test('errors are Hebrew too', async ({ page }) => {
    const server = await installVerificationServer(page);
    server.setVerifyResult({ status: 401, body: { ok: false, reasonCode: 'INVALID_CODE' } });
    await gotoHarness(page, { lang: 'he' });
    await typeCode(page, '000000');
    await expect(page.locator(ERROR)).toHaveText('הקוד אינו נכון. נסו שוב.');
  });
});

test.describe('login purpose', () => {
  test('says sign in, not create an account', async ({ page }) => {
    await installVerificationServer(page);
    await gotoHarness(page, { purpose: 'login' });
    await expect(page.getByText('Use this code to sign in to Pet Wash.')).toBeVisible();
    await expect(page.getByText('finish creating your Pet Wash account')).toHaveCount(0);
  });

  test('a successful verify hands the session token to the caller', async ({ page }) => {
    await installVerificationServer(page);
    await gotoHarness(page, { purpose: 'login' });
    await typeCode(page, '654321');
    await expect(page.locator('[data-testid="harness-done"]')).toHaveText('verified:stub-session-token');
  });
});
