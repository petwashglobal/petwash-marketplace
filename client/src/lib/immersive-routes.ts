/**
 * immersive-routes.ts
 *
 * Canonical "is this an immersive flow?" check. SINGLE source of truth
 * for shell-chrome suppression on auth / onboarding / KYC / verification /
 * loyalty-join routes.
 *
 * Issue #153 — CEO architectural directive (Shell Isolation Audit):
 *
 *   "the bottom navigation bar is still alive underneath onboarding/KYC
 *    flows. … the global app shell is still mounted. … bottom nav +
 *    floating systems are leaking into auth/KYC routes. … you need a
 *    dedicated immersiveFlow / fullscreenFlow route mode. … centralize
 *    shell suppression in one place. … stop route-by-route hacks."
 *
 * Before this helper, three drifting exclusion lists tried to do the same
 * job and disagreed:
 *
 *   • client/src/components/MobileBottomNav.tsx HIDDEN_PREFIXES (14 entries)
 *   • client/src/App.tsx PROMO_EXCLUDED_PATTERN (regex; ~50 prefixes)
 *   • client/src/App.tsx FLOATING_WIDGETS_EXCLUDED_PATTERN (regex; subset)
 *   • client/src/lib/sticky-account-paths.ts STICKY_ACCOUNT_PATHS (24 entries)
 *
 * Concrete leak the CEO observed: MobileBottomNav HIDDEN_PREFIXES is
 * MISSING /activate-account, /consent-onboarding, /forms/onboarding,
 * /loyalty/join, /prestige-pass, /apply-provider, /join-team, /join/walker,
 * /join/sitter, /join/trainer, /kyc, /admin/kyc, /pet-wash-ltd/executive/kyc.
 * On those routes the bottom nav rendered behind the iOS keyboard, capturing
 * taps meant for form fields.
 *
 * Concept boundary
 * ────────────────
 *   isImmersiveRoute(pathname) → "should the shell chrome be SUPPRESSED here?"
 *   isStickyAccountPath(pathname) → "should the post-login redirect NOT
 *                                    kick the user out of this route?"
 *
 * They overlap a lot but are NOT identical. Sticky is a routing-state
 * concern; immersive is a UI-shell concern. Every immersive route is also
 * sticky (the form must not get yanked away mid-flow), but a few non-form
 * routes are immersive-only (e.g. /access-pending, /blocked — full-screen
 * "your access is pending" messages with no shell chrome).
 *
 * Matcher behaviour
 * ─────────────────
 *   • Exact match OR sub-path match (e.g. /provider-onboarding/step-2 is
 *     immersive too).
 *   • Trailing-slash normalised so /signup/ === /signup.
 *   • Pure function. No I/O. No React. Safe to call from any component
 *     mount (App.tsx, MobileBottomNav.tsx, future global mounts).
 *
 * Centralised wiring
 * ──────────────────
 *   client/src/App.tsx wraps the MobileBottomNav mount and the
 *   PromoAdPopup / FloatingStack / AiChatWidget gates with isImmersiveRoute.
 *   New global components MUST consult this helper at the App.tsx
 *   boundary — never re-implement the route list.
 */

export const IMMERSIVE_ROUTES: readonly string[] = [
  // ── Auth flows ──────────────────────────────────────────────────────────
  '/signin',
  '/sign-in',
  '/signup',
  '/sign-up',
  '/login',
  '/register',

  // Firebase email-link / oobCode return handler
  '/__/auth/action',
  '/auth/action',

  // ── Verification + activation ──────────────────────────────────────────
  '/verify',
  '/verify-email',
  '/verify-phone',
  '/activate-account',

  // ── Onboarding flows ───────────────────────────────────────────────────
  '/complete-profile',
  '/choose-role',
  '/consent-onboarding',
  '/internal/onboard',
  '/internal/onboarding',
  '/forms/onboarding',

  // ── Provider lifecycle (every form / pending / rejected screen) ────────
  '/provider-onboarding',
  '/become-provider',
  '/provider/pending',
  '/provider/rejected',
  '/provider-application/status',
  '/apply-provider',
  '/join-team',
  '/join',
  '/join/walker',
  '/join/sitter',
  '/join/trainer',

  // ── Loyalty / Prestige join flows ─────────────────────────────────────
  '/prestige-club',
  '/prestige-pass',
  '/privilege',
  '/loyalty',
  '/loyalty/join',

  // ── KYC flows (consent + document collection — must be isolated) ──────
  '/kyc',
  '/pet-wash-ltd/executive/kyc',
  '/admin/kyc',
  '/admin/staff-onboarding',

  // ── Pending / blocked states (full-screen "your access is pending") ───
  '/access-pending',
  '/staff-pending',
  '/staff-rejected',
  '/blocked',
] as const;

/**
 * True if the pathname is an immersive flow that must render WITHOUT the
 * global app shell (no MobileBottomNav, no FloatingStack, no PromoAdPopup,
 * no AiChatWidget, no marketing overlays). Sub-paths inherit immersive
 * mode (e.g. /provider-onboarding/step-2 is immersive).
 *
 * Pure function. Returns false for null / undefined / empty / non-string
 * input so callers do not need to guard.
 */
export function isImmersiveRoute(pathname: string | null | undefined): boolean {
  if (!pathname || typeof pathname !== 'string') return false;
  // Normalise trailing slash so /signup/ matches /signup.
  const normalized = pathname.replace(/\/+$/, '') || '/';
  return IMMERSIVE_ROUTES.some(
    (p) => normalized === p || normalized.startsWith(`${p}/`),
  );
}
