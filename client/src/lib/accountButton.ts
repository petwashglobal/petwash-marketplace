/**
 * Global account button — decision logic (pure, testable).
 *
 * The gold profile/dashboard button is the single global account control. Its
 * destination + label are decided from BACKEND TRUTH (GET /api/session/whoami,
 * via useWhoami), never from localStorage. PetWashHeader / MobileBottomNav wire
 * it to the existing icon (no redesign).
 *
 * ROUTING (canonical paths — all real today; ideal names alias to real pages):
 *   guest                → /signup?flow=general&returnTo=<url>
 *   guest in checkout ctx → /signup?flow=guest&returnTo=<url>
 *   admin                → /octopus            (alias → /admin/dashboard)
 *   profile incomplete   → /profile/complete   (alias → /complete-profile)
 *   provider pending     → /provider/onboarding (alias → /provider-onboarding)
 *   provider approved    → /provider/dashboard
 *   prestige active      → /prestige/dashboard (alias → /loyalty/dashboard)
 *   customer             → /account            (alias → /my-account)
 *
 * Priority (authenticated): admin > incomplete > provider(pending) >
 *   provider(approved) > prestige > customer. (Admin always wins; incomplete
 *   beats dashboards unless admin — per spec.)
 *
 * iOS-Safari resilience: when the whoami session cookie is dropped (ITP) but
 * Firebase still has the user, whoami is null. We must NOT show "Sign Up" and
 * must NOT mis-route an admin to /account. In that case `useServerResolver` is
 * set so the caller defers to the P0-tested resolveAccountRoute() server
 * decider (Bearer-token fallback + sticky-path guard).
 */
import type { WhoamiResponse } from '@/auth/useWhoami';

export type AccountState =
  | 'guest'
  | 'guest_checkout'
  | 'admin'
  | 'incomplete'
  | 'provider_pending'
  | 'provider_approved'
  | 'prestige'
  | 'customer';

export interface AccountView {
  state: AccountState;
  labelEn: string;
  labelHe: string;
  /** Concrete destination. Absent only when useServerResolver is true. */
  to?: string;
  /** Cookie dropped but Firebase-authed → caller should use resolveAccountRoute(). */
  useServerResolver?: boolean;
}

export interface AccountCtx {
  pathname: string;
  search?: string;
  /** Firebase client auth — true even if the whoami session cookie was dropped. */
  firebaseAuthed?: boolean;
}

const CHECKOUT_PREFIXES = ['/egift', '/checkout', '/cart', '/booking', '/gift'];

export function isCheckoutContext(pathname: string): boolean {
  return CHECKOUT_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export function accountButtonView(whoami: WhoamiResponse | null, ctx: AccountCtx): AccountView {
  const whoamiAuthed = whoami?.authenticated === true;
  const returnTo = encodeURIComponent(`${ctx.pathname || '/'}${ctx.search || ''}`);

  // Guest — not authenticated by whoami AND not by Firebase.
  if (!whoamiAuthed && ctx.firebaseAuthed !== true) {
    if (isCheckoutContext(ctx.pathname)) {
      return {
        state: 'guest_checkout',
        to: `/signup?flow=guest&returnTo=${returnTo}`,
        labelEn: 'Continue Checkout', labelHe: 'המשך לתשלום',
      };
    }
    return {
      state: 'guest',
      to: `/signup?flow=general&returnTo=${returnTo}`,
      labelEn: 'Sign In / Sign Up', labelHe: 'כניסה / הרשמה',
    };
  }

  // Firebase says authed but whoami is missing/unauth (ITP cookie loss) — never
  // show "Sign Up", never mis-route. Defer the exact route to the P0 resolver.
  if (!whoamiAuthed) {
    return { state: 'customer', labelEn: 'My Profile', labelHe: 'הפרופיל שלי', useServerResolver: true };
  }

  const dash = whoami?.dashboardsAllowed ?? [];
  const claims = whoami?.claims;
  const isAdmin = whoami?.isSuperAdmin === true || dash.includes('admin') || dash.includes('staff');

  if (isAdmin) {
    return { state: 'admin', to: '/octopus', labelEn: 'Octopus Control Panel', labelHe: 'לוח בקרה Octopus' };
  }
  // Incomplete profile beats dashboards (unless admin, handled above).
  if (whoami?.profileStatus === 'incomplete') {
    return { state: 'incomplete', to: '/profile/complete', labelEn: 'Continue Setup', labelHe: 'המשך הגדרה' };
  }
  if (whoami?.providerStatus === 'pending') {
    return { state: 'provider_pending', to: '/provider/onboarding', labelEn: 'Provider Setup', labelHe: 'השלמת ספק' };
  }
  if (whoami?.providerStatus === 'approved' || dash.includes('provider')) {
    return { state: 'provider_approved', to: '/provider/dashboard', labelEn: 'Provider Dashboard', labelHe: 'דשבורד ספק' };
  }
  if (whoami?.prestigeStatus === 'active' || claims?.loyaltyMember === true || claims?.program === 'prestige') {
    return { state: 'prestige', to: '/prestige/dashboard', labelEn: 'Prestige', labelHe: 'פרסטיז׳' };
  }
  return { state: 'customer', to: '/account', labelEn: 'My Profile', labelHe: 'הפרופיל שלי' };
}

export function accountLabel(view: AccountView, lang: string): string {
  return lang === 'he' ? view.labelHe : view.labelEn;
}
