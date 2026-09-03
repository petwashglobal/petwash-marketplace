import { useEffect } from "react";
import { useLocation, Redirect } from "wouter";
import { useFirebaseAuth, type UserRole } from "./AuthProvider";
import { useWhoami, type DashboardType } from "./useWhoami";

/**
 * Role hierarchy — higher number is more privileged. A route with
 * `minRole=X` accepts anyone whose serverRole level is >= X's level.
 */
const ROLE_HIERARCHY: Record<UserRole, number> = {
  public: 1,
  provider: 2,
  franchise_owner: 3,
  staff: 4,
  hr: 5,
  ops: 5,
  finance: 6,
  admin: 6,
  management: 8,
  ceo: 9,
  super_admin: 10,
};

interface RoleProtectedRouteProps {
  children: JSX.Element;
  minRole: UserRole;
  fallbackPath?: string;
  requiredDashboard?: DashboardType;
}

/**
 * PHASE 8 REFACTOR (CEO auth-rebuild directive, 2026-09-01):
 *
 *   Previous version called `setLocation(...)` DIRECTLY during render on four
 *   different code paths. React logs a warning for that pattern, and two
 *   guards on one page could chain redirects (documented in the architecture
 *   audit as defect D7). Two symptoms in production traffic:
 *     - Occasional "flash of protected page" before the redirect fired
 *     - Rare `/signin → /dashboard → /signin` ping-pong when the effect
 *       ordering flipped
 *
 *   Fixes:
 *   1. Navigation moved into `useEffect` — never during render.
 *   2. When we know we're going to redirect, render <Redirect> so wouter
 *      completes the nav synchronously and returns null without flashing
 *      the protected children.
 *   3. Loading and error branches return the spinner unchanged.
 *   4. The whoamiError retry stays inside a useEffect so it doesn't fire
 *      on every render.
 *
 *   Public API (`minRole`, `fallbackPath`, `requiredDashboard`, `children`)
 *   is unchanged. Callers do not need to update.
 */
export default function RoleProtectedRoute({
  children,
  minRole,
  fallbackPath = '/',
  requiredDashboard,
}: RoleProtectedRouteProps) {
  const { user, loading } = useFirebaseAuth();
  const {
    isLoading: whoamiLoading,
    isError: whoamiError,
    isAuthenticated,
    dashboardsAllowed,
    role: serverRole,
    refetch,
  } = useWhoami();
  const [location] = useLocation();

  // Effect: refetch on transient whoami error while Firebase still holds a
  // valid user. Previously this fired during render on every re-render.
  useEffect(() => {
    if (whoamiError && user) {
      refetch();
    }
  }, [whoamiError, user, refetch]);

  // Loading — both Firebase and the server-side whoami must resolve before
  // we can decide anything. This branch was correct in the previous
  // version and is preserved verbatim.
  if (loading || whoamiLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Transient whoami error but Firebase user still present — hold the
  // spinner while the useEffect above retries. NEVER bounce to /signin
  // on a single network blip (regression 2026-06-18).
  if (whoamiError && user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Server explicitly reports NOT authenticated — send to /signin. Preserve
  // the intended destination so the sign-in flow can restore it. Uses the
  // canonical `?returnTo=` convention (per CEO D6). SignUpLuxury still
  // reads legacy `?from` / `?redirect` too during the Phase 8 transition
  // window, so no user-visible break.
  if (!isAuthenticated) {
    const returnTo = location && location !== '/signin' ? `?returnTo=${encodeURIComponent(location)}` : '';
    return <Redirect to={`/signin${returnTo}`} />;
  }

  // Role check — server confirmed authenticated, now enforce level.
  const serverLevel = ROLE_HIERARCHY[serverRole as UserRole] ?? 1;
  const requiredLevel = ROLE_HIERARCHY[minRole] ?? 1;

  if (serverLevel < requiredLevel) {
    return <Redirect to={fallbackPath} />;
  }

  if (requiredDashboard && !dashboardsAllowed.includes(requiredDashboard)) {
    return <Redirect to={fallbackPath} />;
  }

  return children;
}
