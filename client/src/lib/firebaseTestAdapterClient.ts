/**
 * AUTH MASTER Lane F — client-side probe for the E2E Firebase test
 * adapter shim (Phase F1 scaffold: tests/e2e/firebaseTestAdapter.ts).
 *
 * This module is the ONE place any auth surface reads the shim from.
 * Every call site — SignUpLuxury, GoogleOneTap, AdminLoginV2,
 * authGuardian — routes through `getFirebaseTestAdapter()` so the
 * production-safety guard is enforced once, not re-derived in every
 * handler.
 *
 * Guard discipline (fail-CLOSED):
 *   1. `import.meta.env.DEV` — a Vite compile-time constant. In a
 *      production build the whole `if (import.meta.env.DEV) { ... }`
 *      branch is eliminated by the bundler. This is the primary line
 *      of defense — the shim never even appears in the shipped JS.
 *   2. `import.meta.env.PROD` — belt + suspenders. If either flag is
 *      not what we expect, refuse.
 *   3. `typeof window !== 'undefined'` — SSR / worker guard.
 *   4. `shim.enabled === true` — the strict equality is deliberate:
 *      any truthy-but-not-true value (a leaked default, an object,
 *      etc) MUST NOT enable the shortcut.
 *   5. `shim.version === 1` — pin the contract version. A mismatched
 *      version means the harness is speaking a different dialect and
 *      the client must not proceed with a synthetic identity.
 *
 * Returns `null` on any guard miss. Callers unconditionally check
 * `=== null` and proceed with real Firebase; when non-null, they may
 * short-circuit signInWithPopup/Redirect and POST the persona's
 * synthetic ID token to /api/auth/session (which the harness has
 * page.route()-intercepted to fulfill).
 *
 * SECURITY NOTE: this module MUST NEVER be imported into a
 * server-side or worker context, and MUST NEVER be re-exported from
 * a public entry that could reach a mobile-app build the shim
 * couldn't tree-shake. Import it only from client React surfaces
 * that Vite's DEV/PROD replacement fully covers.
 */

export interface FirebaseTestAdapterShim {
  enabled: true;
  version: 1;
  persona: {
    uid: string;
    email: string;
    displayName: string;
    role:
      | 'customer'
      | 'provider'
      | 'staff'
      | 'management'
      | 'admin'
      | 'super_admin';
    status?:
      | 'active'
      | 'provider_active'
      | 'staff_active'
      | 'pending'
      | 'suspended';
    canonicalDestination: string;
  };
  syntheticIdToken: string;
}

/**
 * Returns the installed adapter shim iff EVERY guard is satisfied.
 * Returns `null` otherwise — the vast majority of the time.
 *
 * Any exception during the check is swallowed and treated as "no
 * adapter" (fail-CLOSED). We never want a broken shim to derail the
 * real auth journey.
 */
export function getFirebaseTestAdapter(): FirebaseTestAdapterShim | null {
  try {
    // Vite compile-time guard — the whole body of this if() is
    // eliminated in production builds by the bundler.
    if (!import.meta.env.DEV) return null;
    if (import.meta.env.PROD) return null;
    if (typeof window === 'undefined') return null;

    const raw = (window as any).__FIREBASE_TEST_ADAPTER__;
    if (!raw || typeof raw !== 'object') return null;
    if (raw.enabled !== true) return null;
    if (raw.version !== 1) return null;
    if (!raw.persona || typeof raw.persona !== 'object') return null;
    if (typeof raw.syntheticIdToken !== 'string') return null;
    if (!raw.syntheticIdToken.startsWith('synthetic-id-token::')) return null;

    return raw as FirebaseTestAdapterShim;
  } catch {
    return null;
  }
}

/**
 * True iff the shim is installed AND all guards pass. A thin wrapper
 * around getFirebaseTestAdapter() for call sites that only want the
 * boolean.
 */
export function isFirebaseTestAdapterActive(): boolean {
  return getFirebaseTestAdapter() !== null;
}
