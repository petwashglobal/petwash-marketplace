/**
 * useAccountNavigation — shared hook for the gold profile/account icon.
 *
 * All header buttons, mobile icons, and the hero CTA must use this hook so that
 * the routing logic is consistent across every entry point.
 *
 * Routing matrix:
 *   - auth still loading            → '#'  (do nothing, prevents race-condition false sign-in)
 *   - not logged in                 → '/signin'
 *   - super_admin / admin / staff   → '/admin/dashboard'
 *   - provider (active)             → '/provider-os'
 *   - franchise_owner               → '/franchise/dashboard'
 *   - any other logged-in user      → '/my-account'
 *     (customer, loyalty, privilege, prestige, public, unknown role)
 *     A logged-in user NEVER gets sent to sign-in, register, or choose-role.
 */

import { useFirebaseAuth } from '@/auth/AuthProvider';
import type { User } from 'firebase/auth';
import { useWhoami } from '@/auth/useWhoami';

function normalizeRole(value?: string | null): string {
  return String(value ?? '').trim().toLowerCase();
}

const ADMIN_ROLES = new Set(['super_admin', 'admin', 'management', 'staff']);

/**
 * Pure function — compute the correct account route.
 * Exposed separately so it can be unit-tested without a React environment.
 */
export function computeAccountRoute(params: {
  authLoading: boolean;
  claimsLoading: boolean;
  firebaseUser: User | null;
  claimsRole?: string | null;
  claimsAccountType?: string | null;
  whoamiRole?: string | null;
  whoamiAccountType?: string | null;
  userEmail?: string | null;
  adminEmails: string[];
}): string {
  const {
    authLoading,
    claimsLoading,
    firebaseUser,
    claimsRole,
    claimsAccountType,
    whoamiRole,
    whoamiAccountType,
    userEmail,
    adminEmails,
  } = params;

  // 1. Auth is still loading — do nothing.
  //    This is the root cause of the original bug: a null `user` during loading
  //    was treated as "logged-out" and sent to /signin → post-login → /choose-role.
  if (authLoading || claimsLoading) return '#';

  // 2. Truly not logged in → sign-in
  if (!firebaseUser) return '/signin';
  // 3. Derive the effective role from the most authoritative source first.
  //    whoami (server-side session) > Firebase claims > empty string
  const role = normalizeRole(whoamiRole || claimsRole);
  const accountType = normalizeRole(whoamiAccountType || claimsAccountType);

  // 4. Admin roles (strongest priority)
  if (ADMIN_ROLES.has(role)) return '/admin/dashboard';

  // 5. Email-based admin fallback (for when Firebase claims haven't propagated yet)
  if (userEmail && adminEmails.includes(userEmail.toLowerCase())) {
    return '/admin/dashboard';
  }

  // 6. Active provider
  if (role === 'provider' || accountType === 'provider') return '/provider-os';

  // 7. Franchise owner
  if (role === 'franchise_owner') return '/franchise/dashboard';

  // 8. Any other logged-in user (customer / loyalty / privilege / prestige / new / public / unknown)
  //    → /my-account.  Never send to sign-in, register, or choose-role.
  return '/my-account';
}

/**
 * React hook — provides `getAccountRoute()` for use in click handlers.
 * Reads auth state and whoami from context so callers don't need to pass them.
 */
export function useAccountNavigation() {
  const { user, claims, loading, claimsLoading } = useFirebaseAuth();
  const { whoami } = useWhoami();

  const adminEmails = (import.meta.env.VITE_ADMIN_EMAILS ?? '')
    .split(',')
    .map((e: string) => e.trim().toLowerCase())
    .filter(Boolean);

  function getAccountRoute(): string {
    return computeAccountRoute({
      authLoading: loading,
      claimsLoading,
      firebaseUser: user,
      claimsRole: claims?.role,
      claimsAccountType: claims?.accountType,
      whoamiRole: whoami?.role,
      whoamiAccountType: whoami?.accountType,
      userEmail: user?.email ?? null,
      adminEmails,
    });
  }

  return {
    getAccountRoute,
    user,
    isAuthLoading: loading || claimsLoading,
  };
}
