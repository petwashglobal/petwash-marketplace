/**
 * AUTH MASTER Lane F — Firebase test adapter (SCAFFOLD, 2026-08-29).
 *
 * Why this exists
 * ---------------
 * The Lane E behavioural specs
 * (auth-master-lane-e-sitter-full-journey.e2e.spec.ts) can prove the
 * anonymous → sign-in branch and the "already signed-in (persona bypass)"
 * branches, but they CANNOT drive the actual Firebase step of the CTA
 * → resume gate → onboarding chain without a real Firebase Auth
 * instance. The persona-bypass header (`x-test-user-bypass`) sets a
 * server-side identity for subsequent API calls; it does NOT exercise
 * the Firebase client SDK, and it does NOT exchange a real ID token
 * through /api/auth/session.
 *
 * The Firebase test adapter is the seam that lets an E2E run drive
 * the whole chain without a real emulator: it installs a synthetic
 * client-side shim BEFORE any page script runs and intercepts the
 * session-cookie exchange to return a pre-shaped success response
 * matching the persona.
 *
 * Two-phase rollout
 * -----------------
 * Phase F1 (THIS FILE — scaffold only):
 *   - Define the persona catalog + contract shape.
 *   - Provide `installFirebaseTestAdapter(page, persona)` that:
 *       (a) page.addInitScript()s the shim onto window.
 *       (b) page.route()s /api/auth/session and /api/auth/post-login
 *           to return a persona-shaped response with a synthetic
 *           Set-Cookie the client's downstream flow accepts.
 *   - Refuse to install unless TEST_BYPASS_TOKEN is present in env
 *     (matches the existing bypass gate discipline).
 *   - Refuse to install when BASE_URL points at production
 *     (`petwash.co.il` or `www.petwash.co.il`) — the adapter is a
 *     dev-only surface and a production canary must NEVER use it.
 *
 * Phase F2 (FOLLOW-UP PR, not shipped here):
 *   - Client-side detection: authGuardian / SignUpLuxury check
 *     `window.__FIREBASE_TEST_ADAPTER__?.enabled` and short-circuit
 *     the real signInWithPopup / signInWithRedirect calls with the
 *     synthetic ID token the adapter provides. The check MUST be
 *     import.meta.env.DEV-only AND require the shim to be present —
 *     fail-CLOSED to real Firebase in production.
 *   - The full sitter/walker/trainer §3.1 §3.2 §3.3 specs are then
 *     unskipped end-to-end.
 *
 * Security invariants (SCAFFOLD ENFORCES THESE ALREADY)
 * -----------------------------------------------------
 *   • No real Firebase credentials pass through this helper. It never
 *     touches VITE_FIREBASE_* config, never reads a real ID token,
 *     never mints a session cookie against Firebase Admin.
 *   • The synthetic Set-Cookie is a marker value that the server
 *     bypass path can still ignore — production servers WILL reject
 *     it via signature verification. The adapter is not a way to
 *     forge a real session against a running server.
 *   • Refuses to install against a production BASE_URL. Refuses to
 *     install without TEST_BYPASS_TOKEN.
 *
 * Usage (once F2 lands):
 *
 *   import { test } from '@playwright/test';
 *   import { installFirebaseTestAdapter, personas } from './firebaseTestAdapter';
 *
 *   test('signed-in customer → gate → onboarding', async ({ page }) => {
 *     await installFirebaseTestAdapter(page, personas.customerActive);
 *     await page.goto('/sitter-suite');
 *     // click Become a Sitter, wait for /provider-onboarding, assert chip.
 *   });
 */
import type { Page } from '@playwright/test';

/**
 * The identity a persona presents to the client + the server-side
 * response the adapter feeds back through the intercepted routes.
 *
 * uid + email match what the server's persona bypass would return for
 * the same role/status combination — keeping the two paths coherent
 * lets a spec swap between real-Firebase-mocked and header-persona
 * flows without changing its assertions.
 */
export interface FirebaseTestPersona {
  /** Stable string ID — matches server persona bypass mapping. */
  uid: string;
  email: string;
  displayName: string;
  /** The role the persona presents. Maps 1:1 to headersForPersona role. */
  role:
    | 'customer'
    | 'provider'
    | 'staff'
    | 'management'
    | 'admin'
    | 'super_admin';
  /** Provider/staff sub-status — undefined for pure customer. */
  status?:
    | 'active'
    | 'provider_active'
    | 'staff_active'
    | 'pending'
    | 'suspended';
  /**
   * Where the server's /api/auth/post-login canonical destination
   * routes THIS persona. Kept in the persona for clarity in specs;
   * the intercept uses it verbatim.
   */
  canonicalDestination: string;
  /**
   * Lane A — CEO FLY MODE II §10 "TRUE NEW-GOOGLE PERSONA."
   *
   * True new-user shape. When present, the persona's session-cookie
   * response signals { isNewUser: true, profileState: 'incomplete',
   * requiredActions: [...] } so the client's progressive signup
   * state machine runs the profile-completion path. Absent = the
   * persona is treated as "returning" — isNewUser:false, no
   * required actions, straight to POST_LOGIN.
   */
  newUser?: {
    profileState: 'incomplete' | 'complete';
    /** ORDERED — matches the RequiredAction[] shape the client consumes. */
    requiredActions: Array<
      | 'mobile_verification'
      | 'email_verification'
      | 'first_name'
      | 'last_name'
      | 'date_of_birth'
      | 'terms_acceptance'
    >;
  };
}

/**
 * Persona catalog — matches the personas the server-side bypass
 * (server/customAuth.ts:170) synthesizes and the Lane C canonical
 * destination map (server/routes/post-login.ts).
 *
 * Uid strings use the `usr_e2e_*` prefix so they are trivially
 * distinguishable from real production uids in any log grep.
 */
export const personas = {
  customerActive: {
    uid: 'usr_e2e_customer_active',
    email: 'customer.active@e2e.petwash.local',
    displayName: 'E2E Customer',
    role: 'customer',
    status: 'active',
    canonicalDestination: '/pet-parent/home',
  },
  /**
   * Lane A — TRUE NEW Google customer (CEO §10). Distinct from
   * customerActive: the session-cookie response signals isNewUser:true
   * and lists the ordered requiredActions the progressive signup
   * client must render before it can navigate to the destination.
   *
   * The list here mirrors what a real Google signup would produce:
   *   • email pre-verified by Google (no email_verification action);
   *   • display name pre-populated by Google (no first/last name);
   *   • mobile still missing → SMS verification;
   *   • DOB still missing → date_of_birth;
   *   • Terms not yet accepted → terms_acceptance.
   */
  customerNew: {
    uid: 'usr_e2e_customer_new',
    email: 'customer.new@e2e.petwash.local',
    displayName: 'E2E Customer (new)',
    role: 'customer',
    status: 'active',
    canonicalDestination: '/pet-parent/home',
    newUser: {
      profileState: 'incomplete',
      requiredActions: [
        'mobile_verification',
        'date_of_birth',
        'terms_acceptance',
      ],
    },
  },
  providerActive: {
    uid: 'usr_e2e_provider_active',
    email: 'provider.active@e2e.petwash.local',
    displayName: 'E2E Provider',
    role: 'provider',
    status: 'provider_active',
    canonicalDestination: '/provider/today',
  },
  providerPending: {
    uid: 'usr_e2e_provider_pending',
    email: 'provider.pending@e2e.petwash.local',
    displayName: 'E2E Provider (pending)',
    role: 'provider',
    status: 'pending',
    canonicalDestination: '/provider/pending',
  },
  staffActive: {
    uid: 'usr_e2e_staff_active',
    email: 'staff.active@e2e.petwash.local',
    displayName: 'E2E Staff',
    role: 'staff',
    status: 'staff_active',
    canonicalDestination: '/staff/home',
  },
  adminActive: {
    uid: 'usr_e2e_admin_active',
    email: 'admin.active@e2e.petwash.local',
    displayName: 'E2E Admin',
    role: 'admin',
    status: 'active',
    canonicalDestination: '/admin',
  },
} as const satisfies Record<string, FirebaseTestPersona>;

export type FirebaseTestPersonaName = keyof typeof personas;

/**
 * True when the adapter is safe to install (bypass token present,
 * not aimed at production). Specs can use this in `test.skip(...)`
 * to skip cleanly in environments where the adapter isn't wired.
 */
export function firebaseAdapterAvailable(baseUrl?: string): boolean {
  if (!process.env.TEST_BYPASS_TOKEN) return false;
  const target = baseUrl ?? process.env.BASE_URL ?? '';
  if (isProductionUrl(target)) return false;
  return true;
}

function isProductionUrl(url: string): boolean {
  if (!url) return false;
  try {
    const host = new URL(url).hostname.toLowerCase();
    return host === 'petwash.co.il' || host === 'www.petwash.co.il';
  } catch {
    return false;
  }
}

/**
 * Install the Firebase test adapter shim on `page` BEFORE any page
 * script runs. Also route-intercepts the two server endpoints the
 * client uses to complete the auth journey:
 *
 *   POST /api/auth/session      → 200 + synthetic Set-Cookie
 *   POST /api/auth/post-login   → 200 + persona.canonicalDestination
 *
 * The intercepts short-circuit BEFORE the request hits the server, so
 * the server never sees the synthetic ID token and Firebase Admin's
 * verifyIdToken is never called. This is by design — Phase F1 does
 * NOT need a running Firebase emulator.
 *
 * Refuses to install (throws) when:
 *   • TEST_BYPASS_TOKEN is unset — matches the bypass gate discipline.
 *   • BASE_URL points at production — the adapter is dev-only.
 *
 * Callers should either check `firebaseAdapterAvailable()` first or
 * be prepared to handle the thrown Error.
 */
export async function installFirebaseTestAdapter(
  page: Page,
  persona: FirebaseTestPersona,
  opts: { baseUrl?: string } = {},
): Promise<void> {
  if (!process.env.TEST_BYPASS_TOKEN) {
    throw new Error(
      '[FirebaseTestAdapter] refusing to install: TEST_BYPASS_TOKEN is not set. ' +
        'The adapter is a dev-only surface and must not run without the shared bypass secret.',
    );
  }
  const target = opts.baseUrl ?? process.env.BASE_URL ?? '';
  if (isProductionUrl(target)) {
    throw new Error(
      '[FirebaseTestAdapter] refusing to install: BASE_URL points at production ' +
        `(${target}). The adapter must never touch a production surface.`,
    );
  }

  // Phase F1: shim installed on window BEFORE any client script runs.
  // Phase F2 (follow-up PR) is where the client-side SignUpLuxury /
  // GoogleOneTap / authGuardian branches read this and short-circuit
  // signInWithPopup / signInWithRedirect. Until then the shim is
  // inert — but the vitest pin
  // (server/tests/firebaseTestAdapter.regression.test.ts) locks in the
  // contract shape so the follow-up PR cannot drift.
  await page.addInitScript((p: FirebaseTestPersona) => {
    (window as any).__FIREBASE_TEST_ADAPTER__ = {
      enabled: true,
      version: 1,
      persona: p,
      // Synthetic ID token. Deliberately NOT a real JWT — it is a
      // marker string. The client will pass it to POST /api/auth/session
      // in Phase F2; the intercept below handles it without the token
      // ever leaving the browser process.
      syntheticIdToken: `synthetic-id-token::${p.uid}::${Date.now()}`,
    };
  }, persona);

  // Intercept /api/auth/session → return persona-shaped success.
  await page.route('**/api/auth/session', async (route, request) => {
    if (request.method() !== 'POST') {
      await route.continue();
      return;
    }
    await route.fulfill({
      status: 200,
      headers: {
        'content-type': 'application/json; charset=utf-8',
        // A marker cookie — decidedly NOT a signed session cookie. The
        // client-side journey does not verify signature, only presence.
        // The server-side persona bypass header takes over for
        // subsequent API calls from this page.
        'set-cookie':
          `pw_session_synthetic=e2e-${persona.uid}; Path=/; HttpOnly; SameSite=Lax`,
      },
      body: JSON.stringify({
        ok: true,
        source: 'firebase-test-adapter',
        // Lane A — CEO §10 TRUE NEW-GOOGLE PERSONA. Session response
        // now signals isNewUser so the client's progressive signup
        // state machine (not the shell alone) has the authority to
        // run the profile-completion path.
        isNewUser: !!persona.newUser,
        profileState: persona.newUser?.profileState ?? 'complete',
        user: {
          uid: persona.uid,
          email: persona.email,
          displayName: persona.displayName,
          role: persona.role,
          status: persona.status,
        },
      }),
    });
  });

  // Intercept /api/auth/post-login → return canonical destination.
  await page.route('**/api/auth/post-login', async (route, request) => {
    if (request.method() !== 'POST') {
      await route.continue();
      return;
    }
    await route.fulfill({
      status: 200,
      headers: { 'content-type': 'application/json; charset=utf-8' },
      body: JSON.stringify({
        ok: true,
        source: 'firebase-test-adapter',
        destination: persona.canonicalDestination,
        role: persona.role,
        status: persona.status,
      }),
    });
  });

  // Lane A — CEO §9 SERVER OWNS NEW VS RETURNING. Intercept the new
  // authoritative endpoint the progressive signup client calls
  // straight after session mint. Returns the exact { isNewUser,
  // profileState, requiredActions, destination } shape.
  await page.route('**/api/auth/account-resolution', async (route, request) => {
    if (request.method() !== 'GET') {
      await route.continue();
      return;
    }
    const requiredActions = persona.newUser?.requiredActions ?? [];
    await route.fulfill({
      status: 200,
      headers: { 'content-type': 'application/json; charset=utf-8' },
      body: JSON.stringify({
        isNewUser: !!persona.newUser,
        profileState: persona.newUser?.profileState ?? 'complete',
        requiredActions,
        destination: persona.canonicalDestination,
      }),
    });
  });
}

/**
 * Uninstall the shim and drop the route intercepts. Playwright's test
 * lifecycle already tears the context down between tests, so most
 * specs never need this — it exists for specs that want to swap
 * personas mid-flight.
 */
export async function uninstallFirebaseTestAdapter(page: Page): Promise<void> {
  await page.unroute('**/api/auth/session');
  await page.unroute('**/api/auth/post-login');
  await page.addInitScript(() => {
    try {
      delete (window as any).__FIREBASE_TEST_ADAPTER__;
    } catch {
      (window as any).__FIREBASE_TEST_ADAPTER__ = undefined;
    }
  });
}
