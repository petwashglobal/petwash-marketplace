/**
 * useAccountNavigation — single source of truth for the "go to my account" route.
 *
 * Two resolvers are exported:
 *
 *   getAccountRoute()           — synchronous, claims-only. Returns '#' while
 *                                 Firebase is still resolving so callers can
 *                                 no-op. Kept for backwards compatibility.
 *
 *   resolveAccountRoute()       — async, server-fallback aware. Always returns
 *                                 a real route (never '#'). On iPhone Safari,
 *                                 Firebase custom claims may arrive late or
 *                                 not at all (ITP cookie partitioning, slow
 *                                 token refresh). When the claims-only path
 *                                 cannot decide, this calls
 *                                     POST /api/auth/post-login
 *                                 and uses the server's authoritative
 *                                 nextUrl. Bearer token is attached when
 *                                 available so the call works even if the
 *                                 session cookie was dropped.
 *
 * Use resolveAccountRoute() from any tap-target on mobile — never silent-fail
 * the gold profile icon.
 *
 * Priority order (both resolvers):
 *  - franchise_owner             → '/franchise/dashboard'
 *  - provider                    → '/provider-os'
 *  - staff / admin / management / super_admin → '/admin/dashboard'
 *  - Email in VITE_ADMIN_EMAILS  → '/admin/dashboard'  (build-time fallback)
 *  - Server post-login decider   → server-decided nextUrl
 *  - Authenticated, no role      → '/home'  (universal safe fallback — never dead)
 *  - Unauthenticated             → '/signin'
 */

import { onAuthStateChanged, type User } from 'firebase/auth';
import { useFirebaseAuth, type UserRole } from '@/auth/AuthProvider';
import { auth } from '@/lib/firebase';
import { isStickyAccountPath } from '@/lib/sticky-account-paths';
import { resolvePostLogin } from '@/lib/postLoginCoordinator';
// MULTI-ROLE CONTRACT (2026-08-20): a provider-customer must be able to
// reach /my-account (their eGift / wallet / pets / bookings) when their
// UI mode is "customer". Routing the Account tap by raw role locked
// providers OUT of their member surfaces. Route by uiMode instead — the
// same user, additive capabilities. Read the persisted mode without a
// hook so the async resolver works inside a click handler.
import { readUiMode } from '@/lib/uiMode';

/**
 * Resolve the LIVE Firebase user. The React `user`/`loading`/`claims` values are
 * captured stale inside async callbacks, and on iPhone Safari the React state can
 * still read `null` while the SDK already holds a persisted session in IndexedDB
 * (ITP delays the whoami round-trip, not the SDK restore). So we consult
 * `auth.currentUser` directly and, only if it's empty, give the SDK a brief,
 * bounded window to surface a restored session before concluding "not logged in".
 */
export function getLiveFirebaseUser(timeoutMs = 1500): Promise<User | null> {
  if (auth.currentUser) return Promise.resolve(auth.currentUser);
  return new Promise((resolve) => {
    let settled = false;
    const finish = (u: User | null) => {
      if (settled) return;
      settled = true;
      try { unsub(); } catch { /* noop */ }
      resolve(u);
    };
    const unsub = onAuthStateChanged(auth, (u) => finish(u));
    setTimeout(() => finish(auth.currentUser), timeoutMs);
  });
}

// Keep aligned with `shared/adminRoles.ts` ADMIN_ROLES — ceo/hr/finance/ops
// must route to the admin dashboard, not /my-account. See P0 audit Bug 1.
const ADMIN_ROLES: UserRole[] = [
  'staff',
  'admin',
  'management',
  'super_admin',
  'ceo',
  'hr',
  'finance',
  'ops',
];

function adminEmailMatch(email: string | null | undefined): boolean {
  if (!email) return false;
  const allow = (import.meta.env.VITE_ADMIN_EMAILS || '')
    .split(',')
    .map((e: string) => e.trim().toLowerCase())
    .filter(Boolean);
  return allow.includes(email.toLowerCase());
}

function routeFromRole(role: UserRole | undefined): string | null {
  if (role === 'franchise_owner') return '/franchise/dashboard';
  if (role && ADMIN_ROLES.includes(role)) return '/admin/dashboard';
  // MULTI-ROLE CONTRACT (2026-08-20): DO NOT route `role === 'provider'`
  // here. A provider tapping "Account" while in customer uiMode wants
  // /my-account (their eGift / wallet / pets), not /provider-os. Provider
  // routing is decided by uiMode inside {get,resolve}AccountRoute below.
  // 'customer' isn't a UserRole literal — customers carry no role claim.
  return null;
}

export function useAccountNavigation() {
  const { user, loading, claims } = useFirebaseAuth();

  /**
   * Synchronous (claims-only). Returns '#' during auth loading. Kept so
   * existing callers that want a fast, sync answer keep working.
   */
  const getAccountRoute = (): string => {
    if (loading) return '#';
    if (!user) return '/signin';

    const role = claims?.role as UserRole | undefined;
    const fromRole = routeFromRole(role);
    if (fromRole) return fromRole;

    if (adminEmailMatch(user.email)) return '/admin/dashboard';

    // MULTI-ROLE CONTRACT (2026-08-20): a user who currently has provider
    // uiMode selected wants their provider surface; a customer uiMode user
    // (whether or not they also hold provider capability) wants /my-account.
    // Server-side capability is still the gate for whether provider uiMode
    // could be set (see client/src/components/ModeSwitch.tsx).
    if (readUiMode() === 'provider') return '/provider-os';
    return '/my-account';
  };

  /**
   * Async resolver with server fallback. Use from any user-facing tap target
   * (the gold profile icon, the account chip in the burger menu, etc.).
   *
   * Never returns '#' and never returns a route the user cannot reach — if
   * everything else fails, it returns '/home' (or '/signin' when we are
   * sure the user is not authenticated).
   *
   * Behaviour on iPhone Safari:
   *   1. If auth is still resolving, wait up to ~1.5 s for it to settle
   *      (15 × 100 ms). Most refreshes complete well under this budget.
   *   2. If claims arrived with a real role, route by claim (fast path).
   *   3. If user is authenticated but role is empty / 'public', call the
   *      server post-login decider with both session cookie *and* Bearer
   *      token attached. ITP can drop the cookie; the Bearer survives.
   *   4. On any failure, return '/home' so the gold icon always lands the
   *      user somewhere they can navigate from.
   */
  const resolveAccountRoute = async (): Promise<string> => {
    // 0. STICKY-PATH GUARD (P0 production blocker fix — Issue A).
    //    If the user is currently inside an onboarding / signup-flow page
    //    (e.g. /provider-onboarding), DO NOT call the post-login decider
    //    and DO NOT redirect away. The decider can return /home or
    //    /provider/pending depending on application state, which kicks
    //    the user out of their form. The current path is sticky until
    //    the form itself navigates the user forward.
    //
    //    Affected sticky paths: see client/src/lib/sticky-account-paths.ts
    if (typeof window !== 'undefined') {
      const here = window.location.pathname;
      if (isStickyAccountPath(here)) {
        return here;
      }
    }

    // 1. LIVE Firebase user — NOT the stale React `user`/`loading` closure.
    //    On iPhone Safari the React state reads null while the SDK still has a
    //    persisted session; the old code returned '/signin' for a logged-in user.
    const fbUser = await getLiveFirebaseUser(1500);
    if (!fbUser) return '/signin';

    // 2. Claims-based fast path — read FRESH claims from the live token, since
    //    the React `claims` snapshot can also be stale on iOS.
    let role = claims?.role as UserRole | undefined;
    try {
      const tokenResult = await fbUser.getIdTokenResult();
      role = (tokenResult.claims.role as UserRole | undefined) ?? role;
    } catch {
      // Token refresh best-effort; fall back to the context claims above.
    }
    const fromRole = routeFromRole(role);
    if (fromRole) return fromRole;

    if (adminEmailMatch(fbUser.email)) return '/admin/dashboard';

    // 2b. uiMode-driven routing (multi-role contract). After admin /
    //     franchise fast-paths above, everyone else is either a customer
    //     or a provider-customer. uiMode tells us which surface the user
    //     currently wants — the mode switch guarantees provider mode is
    //     only available when server-side capability allows it.
    //     Provider mode → /provider-os. Customer mode → /my-account.
    //     No server round-trip needed for this decision.
    const mode = readUiMode();
    if (mode === 'provider') return '/provider-os';
    if (mode === 'customer') return '/my-account';

    // 3. Server fallback — authoritative, role-resolves from DB.
    //    PR-FRES-B: routed through postLoginCoordinator so a tap on the
    //    Account icon during a concurrent SignIn/SignUp/GoogleOneTap
    //    flow shares the same in-flight Promise instead of firing a
    //    second POST /api/auth/post-login.
    try {
      let token: string | undefined;
      try {
        token = await fbUser.getIdToken();
      } catch {
        // Bearer-token attachment is best-effort. Session cookie still works.
      }

      const data = await resolvePostLogin({ idToken: token });
      if (data.status === 401) return '/signin';
      if (data.ok && data.nextUrl) return data.nextUrl;
    } catch {
      // Network error — fall through to safe default
    }

    // 4. Universal safe default — we KNOW the user is authed here, so never '/signin'.
    return '/home';
  };

  return { getAccountRoute, resolveAccountRoute, loading, user };
}
