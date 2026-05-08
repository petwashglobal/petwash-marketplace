/**
 * intentParam.ts
 *
 * Canonical handler for the `?intent=` URL parameter on /signup, /sign-in,
 * and the email-verify return flow.
 *
 * Issue #153 PR-FRES-6:
 *   Before this helper, the signup_intent could only be set by:
 *     1. Click of a Become-Provider CTA wired through becomeProvider.ts (PR #183)
 *     2. SignIn.tsx:220 auto-detection of ?redirect=…provider-onboarding
 *   Direct landings on /signup?intent=provider or /sign-in?intent=loyalty —
 *   the canonical contract for marketing campaigns, deep links, and email
 *   return flows — were silently dropped. The user reached the form with
 *   no intent set and post-login routed them to /home as a customer.
 *
 *   This is exactly the kind of "one CTA, one canonical entry, one
 *   pipeline" guarantee the CEO asked for after #182 stabilised the
 *   post-login coordinator and #183 canonicalised the in-app CTAs.
 *
 * Contract:
 *   • Allowed values mirror the SERVER allowlist
 *     (server/routes/post-login.ts ALLOWED_INTENTS):
 *       'customer' | 'loyalty' | 'provider' | 'staff_request'
 *   • Marketing alias 'prestige' is mapped to canonical 'loyalty'.
 *   • All other values are dropped silently — no XSS / open-redirect
 *     surface, no cross-pollination with the seedIntent cookie or the
 *     localStorage.signup_intent key.
 *   • If the URL param is present and valid, it OVERWRITES any stale
 *     localStorage value. (The user clicked a link with explicit intent;
 *     trust the link.)
 *   • If the URL param is absent or invalid, do nothing — leave whatever
 *     was already in localStorage alone.
 *
 * Usage (in SignIn.tsx, SignUp.tsx, AuthAction.tsx / VerifyEmail.tsx):
 *
 *   useEffect(() => { applyIntentFromUrl(); }, []);
 *
 * Pure module; no React, no I/O outside `window.localStorage`. Safe in
 * private mode (try/catch).
 */

const SIGNUP_INTENT_KEY = 'signup_intent';

export const ALLOWED_INTENTS = [
  'customer',
  'loyalty',
  'provider',
  'staff_request',
] as const;

export type AllowedIntent = (typeof ALLOWED_INTENTS)[number];

/**
 * Marketing-friendly aliases that map to canonical intents.
 *   'prestige' → 'loyalty'  (Prestige Club is the Hebrew brand for the
 *                            loyalty programme; campaigns deep-link to
 *                            ?intent=prestige and we map it server-side)
 */
const INTENT_ALIASES: Record<string, AllowedIntent> = {
  prestige: 'loyalty',
};

export function isAllowedIntent(value: unknown): value is AllowedIntent {
  return typeof value === 'string'
    && (ALLOWED_INTENTS as readonly string[]).includes(value);
}

export function canonicalizeIntent(raw: string | null | undefined): AllowedIntent | null {
  if (!raw || typeof raw !== 'string') return null;
  const trimmed = raw.trim().toLowerCase();
  if (!trimmed) return null;
  const aliased = INTENT_ALIASES[trimmed];
  if (aliased) return aliased;
  if (isAllowedIntent(trimmed)) return trimmed;
  return null;
}

/**
 * Read the `?intent=` URL param and return the canonical AllowedIntent
 * if present and valid; otherwise null. Does NOT mutate storage.
 */
export function parseIntentFromUrl(search?: string): AllowedIntent | null {
  try {
    const raw = (search !== undefined)
      ? search
      : (typeof window !== 'undefined' ? window.location.search : '');
    const params = new URLSearchParams(raw || '');
    return canonicalizeIntent(params.get('intent'));
  } catch {
    return null;
  }
}

/**
 * Idempotent: if the URL has a valid `?intent=`, write the canonical
 * value to localStorage.signup_intent (overwriting whatever was there).
 * Returns the canonical intent that was applied, or null if nothing
 * was applied.
 */
export function applyIntentFromUrl(search?: string): AllowedIntent | null {
  const intent = parseIntentFromUrl(search);
  if (!intent) return null;
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(SIGNUP_INTENT_KEY, intent);
    }
  } catch {
    // private mode / quota — non-fatal
  }
  return intent;
}
