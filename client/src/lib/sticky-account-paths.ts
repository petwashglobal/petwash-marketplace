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
 *   form. P0 production blocker — "Become מטפל disappears".
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
  '/join',
  '/join/walker',
  '/join/sitter',
  '/join/trainer',
  // Issue #153 PR-FRES-4 — /apply-provider and /join-team both redirect to
  // the canonical /provider-onboarding (RequireAuth provider funnel).
  // They were missing from STICKY_ACCOUNT_PATHS, so an Account-tab tap or
  // any other useAccountNavigation call mid-form would fire post-login and
  // overwrite the form with /home (returning customers) or /provider/pending
  // (returning providers). Same blast radius as /provider-onboarding.
  '/apply-provider',
  '/join-team',
  // Customer onboarding flows
  '/complete-profile',
  '/choose-role',
  '/verify-email',
  // Sign-in / sign-up flows (Firebase OAuth callbacks ride these)
  '/signin',
  '/sign-in',
  '/signup',
  '/sign-up',
  // Issue #153 PR-BPV-2 — Prestige / loyalty join flows. Diagnostic
  // 4404078588 V4: PromoAdPopup (z-9999, 100dvh shell, body scroll-lock
  // for 3.5s) was mounting on these routes and covering the join CTA
  // for the first 3.5s of every visit, creating the "Prestige hidden
  // blocker" symptom. Adding them here means the popup is suppressed
  // (matches /become-provider behaviour) so first-tap hits the join
  // button, not the white click-catcher. Display gate only — popup
  // internals (z-index, AUTO_DISMISS_MS, scroll-lock) unchanged.
  '/prestige-club',
  '/prestige-pass',
  '/privilege',
  '/loyalty',
  '/loyalty/join',
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
