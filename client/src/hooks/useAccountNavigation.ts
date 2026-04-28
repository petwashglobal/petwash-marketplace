/**
 * useAccountNavigation — single source of truth for the "go to my account" route.
 *
 * Rules (in priority order):
 *  - Auth still loading          → '#'  (caller must no-op on '#')
 *  - Not logged in               → '/signin'
 *  - franchise_owner             → '/franchise/dashboard'
 *  - provider                    → '/provider-os'
 *  - staff / admin / management / super_admin → '/admin/dashboard'
 *  - Email in VITE_ADMIN_EMAILS  → '/admin/dashboard'  (claim not yet propagated)
 *  - Everyone else (customer…)   → '/my-account'
 *
 * Usage:
 *   const { getAccountRoute } = useAccountNavigation();
 *   const route = getAccountRoute();  // '#' | '/signin' | '/my-account' | …
 */

import { useFirebaseAuth, type UserRole } from '@/auth/AuthProvider';

const ADMIN_ROLES: UserRole[] = ['staff', 'admin', 'management', 'super_admin'];

export function useAccountNavigation() {
  const { user, loading, claims } = useFirebaseAuth();

  /**
   * Returns the canonical destination for the logged-in user's account button.
   * Returns '#' while Firebase auth is still initialising so callers can no-op.
   */
  const getAccountRoute = (): string => {
    if (loading) return '#';
    if (!user) return '/signin';

    const role = claims?.role as UserRole | undefined;

    if (role === 'franchise_owner') return '/franchise/dashboard';
    if (role === 'provider') return '/provider-os';
    if (role && ADMIN_ROLES.includes(role)) return '/admin/dashboard';

    // Email-based fallback: custom claims may not have been written yet on the
    // very first login (token not yet refreshed). Mirror the server-side check.
    const adminEmails = (import.meta.env.VITE_ADMIN_EMAILS || '')
      .split(',')
      .map((e: string) => e.trim().toLowerCase())
      .filter(Boolean);
    if (user.email && adminEmails.includes(user.email.toLowerCase())) {
      return '/admin/dashboard';
    }

    return '/my-account';
  };

  return { getAccountRoute, loading, user };
}
