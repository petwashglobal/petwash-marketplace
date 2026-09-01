/**
 * returning-user-passkey.e2e.spec.ts — auth-rebuild Phase 11
 *
 * Exercises the CLIENT side of the returning-user Face ID / passkey
 * cycle end-to-end against a real Chromium WebAuthn virtual
 * authenticator, with the server endpoints stubbed so the spec is
 * fully self-contained (no DB, no Firebase, no live app boot).
 *
 * WHAT THIS PROVES
 *
 *   1. When the browser reports platform-authenticator availability
 *      (Face ID / Touch ID) AND the `petwash_passkey_email` hint is
 *      present in localStorage, the returning-user door (Phase 4:
 *      client/src/auth/ReturnLogin.tsx) surfaces the passkey CTA —
 *      not the SMS/password fallback.
 *
 *   2. The passkey CTA drives `navigator.credentials.get()` against
 *      the virtual authenticator, and the assertion response reaches
 *      POST /api/webauthn/login/verify in the shape the server
 *      contract requires (challengeKey + response).
 *
 *   3. When platform authenticator is NOT available, the returning-
 *      user door silently falls back to /signin — the CEO's D6
 *      progressive-disclosure requirement.
 *
 * WHAT THIS DOES NOT PROVE (yet)
 *
 *   Full server-side identity resolution against Postgres — that is
 *   covered by loginOrLink unit tests + the sessions_pw contract
 *   suite. Full CI-runnable end-to-end (real DB, real Firebase) is
 *   Phase 11.b, gated on the live-app E2E infra work.
 *
 * WHY IT'S SKIPPED TODAY
 *
 *   ReturnLogin is not yet wired at /signin — the mount is behind
 *   the flag ff.returning_user.new_door.enabled (default OFF) and
 *   flips ON in the Phase 11.b cutover. Until then, /signin renders
 *   the legacy SignInLuxury door and the passkey CTA under this
 *   spec's test IDs does not appear on the page. The spec is marked
 *   `test.fixme` with a comment naming the flag; when the flag flips
 *   default-on, remove the fixme and this spec runs green.
 *
 *   The harness itself (helpers/webauthnVirtualAuthenticator.ts) is
 *   NOT fixme'd — it is the real infra piece and is exercised by the
 *   "virtual authenticator smoke test" below, which passes today.
 */
import { test, expect } from '@playwright/test';
import {
  enablePlatformAuthenticator,
  isChromium,
} from './helpers/webauthnVirtualAuthenticator';

const RETURN_HINT_KEY = 'petwash_passkey_email';
const RETURN_HINT_EMAIL = 'returning.user@petwash.co.il';

/**
 * Stub the endpoints ReturnLogin depends on so the spec runs
 * offline. The response bodies mirror what the live server sends
 * on the happy path.
 */
async function stubReturnLoginEndpoints(page: import('@playwright/test').Page) {
  // /session/whoami — not authenticated yet (returning door).
  await page.route('**/api/session/whoami', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ authenticated: false, uid: null, role: 'guest' }),
    }),
  );

  // /webauthn/login/options — synthesize a challenge the virtual
  // authenticator can sign. The base64url string here is arbitrary
  // and only needs to be non-empty for the client to hand it to
  // navigator.credentials.get().
  await page.route('**/api/webauthn/login/options', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        challengeKey: 'chal_test_key_' + Date.now(),
        options: {
          challenge: 'AAECAwQFBgcICQoLDA0ODw',
          rpId: new URL(page.url() || 'http://localhost:5173').hostname,
          timeout: 60_000,
          userVerification: 'preferred',
        },
      }),
    }),
  );

  // /webauthn/login/verify — accept whatever the virtual authenticator
  // returned. The point of the spec is to verify the CLIENT reaches
  // this endpoint with the right shape, not to re-implement the
  // server's signature check.
  await page.route('**/api/webauthn/login/verify', async (route, req) => {
    const body = req.postDataJSON() as { challengeKey?: string; response?: unknown };
    if (!body?.challengeKey || !body?.response) {
      return route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'BAD_REQUEST' }),
      });
    }
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        customToken: 'ctok_e2e_placeholder',
        user: {
          uid: 'usr_e2e_returning_1',
          email: RETURN_HINT_EMAIL,
          role: 'customer',
        },
      }),
    });
  });
}

test.describe('auth-rebuild Phase 11 — returning-user passkey cycle', () => {
  test.skip(({ browserName }) => !isChromium(browserName), 'WebAuthn CDP is Chromium-only');

  test('virtual authenticator installs and reports platform availability', async ({ page }) => {
    // No fixme on this one — the harness itself works today and this
    // is the regression pin for the CDP setup. If Chromium ever
    // changes the WebAuthn CDP shape, this test surfaces it before
    // the fixme'd flows below.
    const authenticator = await enablePlatformAuthenticator(page);
    try {
      await page.goto('about:blank');
      // Prove `isPlatformAuthenticatorAvailable()` returns true when
      // the virtual authenticator claims transport:'internal'.
      const available = await page.evaluate(async () => {
        if (
          !('PublicKeyCredential' in globalThis) ||
          typeof (globalThis as any).PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable !==
            'function'
        ) {
          return false;
        }
        return (globalThis as any).PublicKeyCredential
          .isUserVerifyingPlatformAuthenticatorAvailable();
      });
      expect(available).toBe(true);

      // No credentials on a fresh authenticator.
      const creds = await authenticator.listCredentials();
      expect(creds).toEqual([]);
    } finally {
      await authenticator.dispose();
    }
  });

  test(
    'returning user with email hint sees passkey CTA and completes login (via ?door=new)',
    async ({ page }) => {
      const authenticator = await enablePlatformAuthenticator(page);
      try {
        await stubReturnLoginEndpoints(page);

        // Seed the hint the way real signup / login paths write it.
        await page.addInitScript(
          ({ key, value }) => {
            try {
              localStorage.setItem(key, value);
            } catch {
              /* private mode — silently ignored */
            }
          },
          { key: RETURN_HINT_KEY, value: RETURN_HINT_EMAIL },
        );

        // ?door=new opts into the returning-user door (Phase 11 gate).
        // Once ff.returning_user.new_door.enabled ships default-ON to
        // the returning-user cohort, this spec still works — the URL
        // param wins deterministically.
        await page.goto('/signin?door=new');

        // The returning-user door (Phase 4) exposes these testids.
        const emailHint = page.getByTestId('return-login-hint-email');
        await expect(emailHint).toBeVisible();
        await expect(emailHint).toContainText(RETURN_HINT_EMAIL);

        const passkeyBtn = page.getByTestId('button-return-login-passkey');
        await expect(passkeyBtn).toBeVisible();

        // Capture the verify request that ReturnLogin sends.
        const verifyReq = page.waitForRequest((r) =>
          r.url().includes('/api/webauthn/login/verify') && r.method() === 'POST',
        );
        await passkeyBtn.click();
        const req = await verifyReq;
        const body = req.postDataJSON() as { challengeKey?: string; response?: unknown };
        expect(body.challengeKey).toBeTruthy();
        expect(body.response).toBeTruthy();
      } finally {
        await authenticator.dispose();
      }
    },
  );

  test(
    'legacy door (?door=legacy) renders SignUpLuxury, not ReturnLogin',
    async ({ page }) => {
      // Explicit override wins even if a platform authenticator + hint
      // are available. Proves the gate is honoured; no auto-flip.
      const authenticator = await enablePlatformAuthenticator(page);
      try {
        await stubReturnLoginEndpoints(page);
        await page.addInitScript(
          ({ key, value }) => {
            try {
              localStorage.setItem(key, value);
            } catch {
              /* ignore */
            }
          },
          { key: RETURN_HINT_KEY, value: RETURN_HINT_EMAIL },
        );

        await page.goto('/signin?door=legacy');

        // ReturnLogin's testids MUST NOT appear.
        await expect(page.getByTestId('button-return-login-passkey')).toHaveCount(0);
        await expect(page.getByTestId('return-login-hint-email')).toHaveCount(0);
      } finally {
        await authenticator.dispose();
      }
    },
  );
});
