/**
 * becomeProvider.ts
 *
 * Canonical "Become Provider / הפוך למטפל" CTA helper.
 *
 * Issue #153 PR-FRES-3:
 *   Audit found 15+ CTAs scattered across the app, mixing five route
 *   targets (/become-provider, /join/walker, /join/sitter, /join/trainer,
 *   /apply-provider), three element types (Link, Button onClick, raw
 *   <a href>) and ZERO of them set `localStorage.signup_intent='provider'`
 *   before navigation. The provider intent only got set later inside
 *   SignIn.tsx:220 when the user happened to land there with a
 *   ?redirect= containing 'provider-onboarding' — every other path
 *   (already-signed-in users, deep-linked /join/walker, ProviderDashboard
 *   <a> full-reload) silently fell back to intent=customer at post-login,
 *   and the canonical pipeline that #182 stabilised got bypassed.
 *
 * This module is the ONE place every CTA must go through:
 *
 *   becomeProviderHref(type?)
 *     Returns the canonical href: '/become-provider' or
 *     '/become-provider?type=walker' (etc.). Type is whitelisted; any
 *     non-whitelisted value is dropped silently and the bare path is
 *     returned. Use for `<Link href={...}>`.
 *
 *   setProviderSignupIntent()
 *     Sets `localStorage.signup_intent = 'provider'`. Idempotent. Safe in
 *     private mode (try/catch). Use as the onClick handler of a Link, or
 *     call it before navigate() inside a Button onClick.
 *
 *   onClickBecomeProvider(navigate, type?)
 *     One-shot helper for Button onClick handlers — sets the intent and
 *     navigates to the canonical href in one call.
 *
 * The /become-provider route already routes signed-in users straight to
 * /provider-onboarding (PR-FRES-1 BecomeProviderRedirect) and anonymous
 * users to /sign-in?redirect=/provider-onboarding (where SignIn sets
 * intent itself). So routing through /become-provider AND setting
 * signup_intent locally is the belt-and-braces guarantee that the
 * provider intent is visible to:
 *   • the post-login coordinator's body in every subsequent call (#182)
 *   • the /api/auth/seed-intent HttpOnly cookie before iPhone redirect (FRES-2)
 *   • the post-login decider's intentToRole branch (PR-BPV-2 V3)
 *
 * Out of scope (locked):
 *   - no AuthProvider rewrite, no whoami collapse
 *   - no schema, no money/wallet/tax, no BookingEngine
 *   - no K9000/Nayax/Tranzila, no provider approval policy
 *   - the /join/walker, /join/sitter, /join/trainer routes are NOT
 *     retired — those are deep-link sub-pipelines that flow to the same
 *     provider-onboarding eventually. Callers that want walker-specific
 *     onboarding can keep deep-linking; this helper only canonicalises
 *     the generic "become provider" CTA + ensures intent is set
 *     regardless of which route the caller ultimately uses.
 */

export const PROVIDER_TYPE_WHITELIST = [
  'walker',
  'sitter',
  'driver',
  'trainer',
  'station_operator',
  'pet_trek',
] as const;

export type ProviderType = (typeof PROVIDER_TYPE_WHITELIST)[number];

export const BECOME_PROVIDER_PATH = '/become-provider';

export function isProviderType(value: unknown): value is ProviderType {
  return typeof value === 'string'
    && (PROVIDER_TYPE_WHITELIST as readonly string[]).includes(value);
}

export function becomeProviderHref(type?: string | null): string {
  if (isProviderType(type)) {
    return `${BECOME_PROVIDER_PATH}?type=${encodeURIComponent(type)}`;
  }
  return BECOME_PROVIDER_PATH;
}

export function setProviderSignupIntent(): void {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem('signup_intent', 'provider');
    }
  } catch {
    // private mode / quota — non-fatal
  }
}

export function onClickBecomeProvider(
  navigate: (path: string) => void,
  type?: string | null,
): void {
  setProviderSignupIntent();
  navigate(becomeProviderHref(type));
}
