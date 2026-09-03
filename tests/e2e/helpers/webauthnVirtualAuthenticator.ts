/**
 * webauthnVirtualAuthenticator — Playwright helper for exercising
 * real passkey flows against Chromium's built-in WebAuthn virtual
 * authenticator (CDP `WebAuthn.addVirtualAuthenticator`).
 *
 * Auth-rebuild Phase 11 (returning-user Face ID cycle) uses this to
 * drive the browser through a real passkey registration + sign-in
 * without a physical device — so the returning-user door
 * (client/src/auth/ReturnLogin.tsx) can be exercised end-to-end.
 *
 * ─── HOW A VIRTUAL AUTHENTICATOR WORKS ─────────────────────────────
 *
 * Chromium exposes a CDP domain (`WebAuthn`) that lets the test
 * inject an ephemeral, in-process authenticator into the page's
 * WebAuthn stack. When the page calls `navigator.credentials.get()`
 * or `.create()`, Chromium routes the request to the virtual
 * authenticator instead of dispatching to the OS platform
 * authenticator (Touch ID / Windows Hello / Android). The
 * authenticator satisfies the challenge with a synthetic key pair
 * and returns a well-formed WebAuthn response the RP can verify.
 *
 * The authenticator is per-CDP-session and is torn down when the
 * session ends (i.e. when the test's page context closes). Nothing
 * persists to disk — a fresh test always starts with no credentials
 * unless the test explicitly registers one, or opts into
 * `hasResidentKey: true` and adds credentials via `addCredential`.
 *
 * ─── DEFAULT SETUP ─────────────────────────────────────────────────
 *
 * `enablePlatformAuthenticator()` installs:
 *   - protocol: 'ctap2'          — supports passkeys (resident keys)
 *   - transport: 'internal'      — appears as a platform authenticator
 *                                  (`isPlatformAuthenticatorAvailable`
 *                                  returns true → Face ID / Touch ID
 *                                  UI branches will show)
 *   - hasResidentKey: true       — supports discoverable credentials
 *   - hasUserVerification: true  — biometric always succeeds
 *   - isUserVerified: true       — no prompt; UV auto-approves
 *   - automaticPresenceSimulation: true
 *                                — the authenticator answers itself,
 *                                  so tests don't hang waiting for a
 *                                  tap
 *
 * That is the "always-present, always-approves" model most
 * returning-user tests want. To exercise the "user cancels Face ID"
 * branch, set `isUserVerified: false` and Chromium will produce a
 * NotAllowedError.
 *
 * ─── PATTERN ───────────────────────────────────────────────────────
 *
 *   import { enablePlatformAuthenticator } from './helpers/webauthnVirtualAuthenticator';
 *
 *   test('returning-user Face ID cycle', async ({ page, context }) => {
 *     const authenticator = await enablePlatformAuthenticator(page);
 *     try {
 *       await page.goto('/signin');
 *       // ... exercise passkey flow ...
 *     } finally {
 *       await authenticator.dispose();
 *     }
 *   });
 *
 * ─── LIMITATIONS ───────────────────────────────────────────────────
 *
 *   - CDP virtual authenticators only exist in Chromium. WebKit /
 *     Firefox specs must be `test.skip()`-ed.
 *   - The RP-side server MUST accept origin `http://localhost:5173`
 *     (or whatever origin the Playwright base URL uses) — the WebAuthn
 *     library binds the RP ID to that origin. The test harness sets
 *     the RP ID via the standard signup/registration options; nothing
 *     to configure here.
 */
import type { CDPSession, Page } from '@playwright/test';

export interface VirtualAuthenticatorOptions {
  /** Present as platform (Face ID/Touch ID). Default true. */
  platform?: boolean;
  /** Auto-approve user verification. Default true. Set false to exercise "user cancelled". */
  isUserVerified?: boolean;
  /** Support resident keys (discoverable credentials). Default true. */
  hasResidentKey?: boolean;
}

export interface VirtualAuthenticatorHandle {
  /** The CDP authenticator id — needed for addCredential / removeCredential later. */
  readonly authenticatorId: string;
  /** The underlying CDP session — used to send further WebAuthn.* commands. */
  readonly cdp: CDPSession;
  /** Enumerate credentials currently held by the virtual authenticator. */
  listCredentials(): Promise<Array<{ credentialId: string; rpId: string; userHandle: string | null }>>;
  /** Remove and detach the authenticator so the test leaves no state behind. */
  dispose(): Promise<void>;
}

/**
 * Enable the WebAuthn CDP domain on the page and install a platform
 * authenticator with sensible defaults. Returns a handle so the test
 * can list credentials or dispose the authenticator.
 */
export async function enablePlatformAuthenticator(
  page: Page,
  opts: VirtualAuthenticatorOptions = {},
): Promise<VirtualAuthenticatorHandle> {
  const {
    platform = true,
    isUserVerified = true,
    hasResidentKey = true,
  } = opts;

  const cdp = await page.context().newCDPSession(page);
  await cdp.send('WebAuthn.enable', { enableUI: false });

  const { authenticatorId } = await cdp.send('WebAuthn.addVirtualAuthenticator', {
    options: {
      protocol: 'ctap2',
      transport: platform ? 'internal' : 'usb',
      hasResidentKey,
      hasUserVerification: true,
      isUserVerified,
      automaticPresenceSimulation: true,
    },
  });

  let disposed = false;

  return {
    authenticatorId,
    cdp,
    async listCredentials() {
      const res = (await cdp.send('WebAuthn.getCredentials', { authenticatorId })) as {
        credentials: Array<{ credentialId: string; rpId: string; userHandle?: string | null }>;
      };
      return res.credentials.map((c) => ({
        credentialId: c.credentialId,
        rpId: c.rpId,
        userHandle: c.userHandle ?? null,
      }));
    },
    async dispose() {
      if (disposed) return;
      disposed = true;
      try {
        await cdp.send('WebAuthn.removeVirtualAuthenticator', { authenticatorId });
      } catch {
        // The CDP session may already be torn down by page close —
        // that's fine, the authenticator is bound to the session.
      }
      try {
        await cdp.detach();
      } catch {
        // ditto
      }
    },
  };
}

/**
 * True when Chromium is the driver. Non-Chromium browsers do not have
 * the WebAuthn CDP domain, so spec-level `test.skip(!isChromium(...))`
 * lets a spec safely no-op on WebKit / Firefox rather than crashing
 * with a CDP handshake failure.
 */
export function isChromium(browserName: string): boolean {
  return browserName === 'chromium';
}
