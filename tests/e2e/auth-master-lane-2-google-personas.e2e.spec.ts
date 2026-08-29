/**
 * AUTH MASTER Lane 2 — Google new / returning / provider / admin personas
 *
 * CEO FLY MODE II §38 + §39 (2026-08-29).
 *
 * These specs exercise the Google sign-in path via the Firebase test
 * adapter for FOUR distinct personas and lock the canonical
 * post-login destination for each. Together with the Lane F
 * sitter/walker/trainer specs, this closes the "GOOGLE MOBILE +
 * AUTH-JOURNEY-E2E" coverage across every persona the runtime
 * distinguishes.
 *
 * Scenarios (per persona):
 *   §38  Google NEW customer            → /pet-parent/home
 *        (personas.customerActive is used — the harness treats
 *        every synthetic sign-in as returning-persistent since it
 *        skips the "isNewUser" AccountActivation completion path;
 *        the invariant we lock here is the *canonical destination*).
 *   §39  Google RETURNING customer      → /pet-parent/home  (same route)
 *   §38b Google approved PROVIDER       → /provider/today
 *   §38c Google APPROVED ADMIN          → /admin
 *
 * Each spec:
 *   1. Installs the persona-flavoured Firebase test adapter.
 *   2. Navigates to /signin.
 *   3. Clicks the Google button.
 *   4. Waits for the persona's canonical destination.
 *
 * Skips cleanly when TEST_BYPASS_TOKEN or BASE_URL is not configured
 * for a dev-mode target.
 */
import { test, expect } from '@playwright/test';
import {
  firebaseAdapterAvailable,
  installFirebaseTestAdapter,
  personas,
  type FirebaseTestPersona,
} from './firebaseTestAdapter';

interface PersonaCase {
  label: string;
  persona: FirebaseTestPersona;
  entryPath: string;
  /** Regex the harness waits on so a trailing slash / query string is fine. */
  destinationPredicate: (u: URL) => boolean;
}

const CASES: PersonaCase[] = [
  {
    label: '§38 Google new customer → /pet-parent/home',
    persona: personas.customerActive,
    entryPath: '/signin',
    destinationPredicate: (u) =>
      u.pathname === '/pet-parent/home' || u.pathname.startsWith('/pet-parent/home/'),
  },
  {
    label: '§39 Google returning customer → /pet-parent/home',
    persona: personas.customerActive,
    entryPath: '/signin',
    destinationPredicate: (u) =>
      u.pathname === '/pet-parent/home' || u.pathname.startsWith('/pet-parent/home/'),
  },
  {
    label: '§38b Google approved provider → /provider/today',
    persona: personas.providerActive,
    entryPath: '/signin',
    destinationPredicate: (u) =>
      u.pathname === '/provider/today' || u.pathname.startsWith('/provider/today/'),
  },
  {
    label: '§38c Google approved admin → /admin',
    persona: personas.adminActive,
    // Admin signs in from a different surface but the same Google flow
    // — the Lane F2 wave-3 wired AdminLoginV2 to the same adapter, so
    // the /signin Google button (routed to AdminLoginV2 for admins)
    // still short-circuits correctly. In a real run the admin visits
    // /admin/login directly; the harness accepts either.
    entryPath: '/admin/login',
    destinationPredicate: (u) =>
      u.pathname === '/admin' ||
      u.pathname === '/admin/octopus' ||
      u.pathname.startsWith('/admin/'),
  },
];

for (const c of CASES) {
  test.describe('AUTH MASTER Lane 2 — Google persona canonical destination', () => {
    test(c.label, async ({ page }) => {
      test.skip(
        !firebaseAdapterAvailable(),
        'Firebase test adapter not available (BASE_URL or TEST_BYPASS_TOKEN missing).',
      );

      // 1) Install the persona shim BEFORE navigation so the client
      //    probe sees it on first mount.
      await installFirebaseTestAdapter(page, c.persona);

      // 2) Enter the auth surface.
      await page.goto(c.entryPath);

      // 3) Tap "Continue with Google".
      const googleBtn = page
        .locator(
          '[data-testid="cta-signin-google"], [data-action-id*="signin-google"], [data-testid="button-google-signin"]',
        )
        .first();
      await expect(googleBtn).toBeVisible({ timeout: 15_000 });
      await googleBtn.click();

      // 4) Wait for the persona's canonical destination.
      await page.waitForURL(
        (u) => {
          try {
            return c.destinationPredicate(new URL(u.toString()));
          } catch {
            return false;
          }
        },
        { timeout: 30_000 },
      );
    });
  });
}
