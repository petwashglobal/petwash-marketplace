/**
 * Global account button — decision logic (pure, testable). SAFE SCOPE.
 *
 * The gold profile/dashboard button is the single global account control. Its
 * LABEL is decided from BACKEND TRUTH (GET /api/session/whoami, via useWhoami),
 * never from localStorage. PetWashHeader / MobileBottomNav wire it to the
 * existing icon (no redesign).
 *
 * ROUTING (intentionally conservative for this PR):
 *   - GUEST (not authenticated) → /signup?flow=general&returnTo=<current_url>
 *     (previously /signin; this is the only routing change in this PR).
 *   - AUTHENTICATED → unchanged: the caller uses the existing P0-tested
 *     resolveAccountRoute() server decider. This module returns a LABEL only
 *     for authenticated users; it does NOT dictate the authenticated route.
 *
 * iOS-Safari note: callers pass `firebaseAuthed` so a logged-in user whose
 * whoami cookie was dropped (ITP) is never shown "Sign Up".
 *
 * FOLLOW-UP BLOCKERS (do NOT guess these now — whoami doesn't expose them):
 *   - profileStatus   → "Continue Setup" / /profile/complete
 *   - providerStatus  → provider pending vs approved → /provider/onboarding
 *   - prestigeStatus  → /prestige/dashboard
 *   - activeFlow      → guest-checkout express continue
 * Once whoami exposes these and the routes exist (/octopus, /account, etc.),
 * upgrade routing in the planned follow-up PR.
 */
import type { WhoamiResponse } from '@/auth/useWhoami';

export type AccountState =
  | 'guest'
  | 'admin'
  | 'provider'
  | 'prestige'
  | 'customer';

export interface AccountView {
  state: AccountState;
  labelEn: string;
  labelHe: string;
  /** Destination for GUEST only. Authenticated routing stays with resolveAccountRoute(). */
  guestTo?: string;
}

export interface AccountCtx {
  pathname: string;
  search?: string;
  /** Firebase client auth — true even if the whoami session cookie was dropped. */
  firebaseAuthed?: boolean;
}

export function accountButtonView(whoami: WhoamiResponse | null, ctx: AccountCtx): AccountView {
  const authed = whoami?.authenticated === true || ctx.firebaseAuthed === true;

  if (!authed) {
    const returnTo = encodeURIComponent(`${ctx.pathname || '/'}${ctx.search || ''}`);
    return {
      state: 'guest',
      labelEn: 'Sign In / Sign Up',
      labelHe: 'כניסה / הרשמה',
      guestTo: `/signup?flow=general&returnTo=${returnTo}`,
    };
  }

  // Authenticated — LABEL ONLY (route stays with resolveAccountRoute, unchanged).
  // Only label states whoami can prove. No guessing of profile/provider status.
  const dash = whoami?.dashboardsAllowed ?? [];
  const claims = whoami?.claims;

  if (whoami?.isSuperAdmin === true || dash.includes('admin') || dash.includes('staff')) {
    return { state: 'admin', labelEn: 'Octopus Control Panel', labelHe: 'לוח בקרה Octopus' };
  }
  if (dash.includes('provider')) {
    return { state: 'provider', labelEn: 'Provider Dashboard', labelHe: 'דשבורד ספק' };
  }
  if (claims?.loyaltyMember === true || claims?.program === 'prestige') {
    return { state: 'prestige', labelEn: 'Prestige', labelHe: 'פרסטיז׳' };
  }
  return { state: 'customer', labelEn: 'My Profile', labelHe: 'הפרופיל שלי' };
}

export function accountLabel(view: AccountView, lang: string): string {
  return lang === 'he' ? view.labelHe : view.labelEn;
}
