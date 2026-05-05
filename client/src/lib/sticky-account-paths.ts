/**
 * sticky-account-paths.ts
 *
 * Shared helper: returns true when the current pathname is a "sticky"
 * onboarding / signup-flow page that MUST NOT be overridden by an async
 * post-login redirect.
 *
 * Why this exists:
 *   The Account-tab tap (MobileBottomNav) and any other caller of
 *   `useAccountNavigation.resolveAccountRoute()` will fire
 *   `POST /api/auth/post-login` and then `setLocation(nextUrl)`. If the
 *   user is in the middle of /provider-onboarding (or similar), nextUrl
 *   often resolves to a different page (e.g. `/home` if no draft
 *   provider_application exists yet), kicking the user out of their
 *   form. P0 production blocker — see audit "Issue A" / "Become מטפל
 *   disappears".
 *
 * Pure function. No I/O. Safe to unit-test in isolation. Exported with
 * its sticky path list so tests can assert the canonical set.
 */

export const STICKY_ACCOUNT_PATHS: readonly string[] = [
  // Provider lifecycle (must not be overridden mid-form)
  '/provider-onboarding',
  '/become-provider',
  '/provider/pending',
  '/provider-application/status',
  '/provider/rejected',
  // Customer onboarding flows
  '/complete-profile',
  '/choose-role',
  '/verify-email',
  // Sign-in / sign-up flows (Firebase OAuth callbacks ride these)
  '/signin',
  '/sign-in',
  '/signup',
  '/sign-up',
] as const;

/**
 * True if the given pathname matches one of the sticky account paths
 * (exact match or sub-path). Sub-paths like `/provider-onboarding/step-2`
 * stay sticky.
 */
export function isStickyAccountPath(pathname: string | null | undefined): boolean {
  if (!pathname || typeof pathname !== 'string') return false;
  // Normalize trailing slash so `/provider-onboarding/` matches `/provider-onboarding`
  const normalized = pathname.replace(/\/+$/, '') || '/';
  return STICKY_ACCOUNT_PATHS.some(
    (p) => normalized === p || normalized.startsWith(`${p}/`),
  );
}
