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

import { useFirebaseAuth, type UserRole } from '@/auth/AuthProvider';
import { isStickyAccountPath } from '@/lib/sticky-account-paths';
import { resolvePostLogin } from '@/lib/postLoginCoordinator';

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
  if (role === 'provider') return '/provider-os';
  if (role && ADMIN_ROLES.includes(role)) return '/admin/dashboard';
  // 'customer' isn't a UserRole literal — customers carry no role claim and
  // fall through to the default '/my-account' below in the sync resolver, or
  // to the server post-login decider in the async resolver.
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

    // 1. Settle period for auth — bounded so the click never feels frozen.
    const settleStart = Date.now();
    // We can't await the React state, so probe directly via the auth context.
    // useFirebaseAuth is stable across the closure; capture latest via fresh refs.
    while ((loading) && Date.now() - settleStart < 1500) {
      // eslint-disable-next-line no-await-in-loop
      await new Promise((r) => setTimeout(r, 100));
    }

    if (!loading && !user) return '/signin';

    // 2. Claims-based fast path
    const role = claims?.role as UserRole | undefined;
    const fromRole = routeFromRole(role);
    if (fromRole) return fromRole;

    if (adminEmailMatch(user?.email)) return '/admin/dashboard';

    // 3. Server fallback — authoritative, role-resolves from DB.
    //    PR-FRES-B: routed through postLoginCoordinator so a tap on the
    //    Account icon during a concurrent SignIn/SignUp/GoogleOneTap
    //    flow shares the same in-flight Promise instead of firing a
    //    second POST /api/auth/post-login.
    try {
      let token: string | undefined;
      try {
        token = user ? await (user as any).getIdToken?.() : undefined;
      } catch {
        // Bearer-token attachment is best-effort. Session cookie still works.
      }

      const data = await resolvePostLogin({ idToken: token });
      if (data.status === 401) return '/signin';
      if (data.ok && data.nextUrl) return data.nextUrl;
    } catch {
      // Network error — fall through to safe default
    }

    // 4. Universal safe default. Never '#', never empty.
    return user ? '/home' : '/signin';
  };

  return { getAccountRoute, resolveAccountRoute, loading, user };
}
