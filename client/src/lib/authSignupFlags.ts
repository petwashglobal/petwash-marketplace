/**
 * Signup feature flags (client).
 *
 * The platform plan names these with dots (e.g. `ff.auth.signup.apple_signin.enabled`).
 * Vite/env keys cannot contain dots, so each maps to a `VITE_AUTH_SIGNUP_*` env var.
 * The mapping is the single source of truth — keep the JSDoc names in sync.
 *
 * Default ON  → enabled unless the env var is explicitly the string "false".
 * Default OFF → enabled only when the env var is explicitly the string "true".
 *
 * Rationale per provider (from the auth audit):
 *  - google_signin  ON  — web Google works via the Firebase client SDK today.
 *  - email_password ON  — Firebase email/password works for any email domain.
 *  - unified_route  ON  — /signup is already the single canonical door.
 *  - apple_signin    ON  (CEO 2026-06-28) — REQUIRED for App Store (rule 4.8 when
 *                         Google is offered). The button is shown; until the Apple
 *                         provider is enabled in Firebase + an Apple Service ID is
 *                         configured, a tap returns a graceful "not switched on yet,
 *                         use Google/email/phone" message (SignIn.tsx auth/operation-
 *                         not-allowed) — never a crash. Native iOS uses iosAuthHandler.
 *  - facebook_signin ON  (CEO 2026-06-28) — shown; needs a configured Meta app +
 *                         OAuth redirect in Firebase to complete; graceful message until then.
 *  - instagram_signin ON (CEO 2026-06-28) — shown; server OAuth 503s until
 *                         INSTAGRAM_CLIENT_ID/SECRET set; graceful message until then.
 *  - tiktok_signin   ON  (CEO 2026-06-28) — shown; server OAuth 503s until
 *                         TIKTOK_CLIENT_KEY/SECRET set; graceful message until then.
 *  - passkey        ON   (CEO 2026-06-28) — WebAuthn (/api/webauthn/*) works device-side.
 *  - 2fa            OFF — email SMS-2FA step is NOT built; leaving ON would inject a
 *                         broken/fake step into login. Keep OFF until built (no fake step).
 *  - keychain_prompt OFF
 *  - legacy_panel_hidden OFF
 *
 * NOTE: turning a flag ON only makes the button APPEAR. A provider actually
 * completes a login only once its console config / API keys exist (your ops).
 * Until then the graceful "not switched on yet" message is shown — no dead crash.
 */

type Vite = Record<string, string | undefined>;
const env = (import.meta as unknown as { env: Vite }).env ?? {};

const on = (key: string) => env[key] !== 'false'; // default ON
const off = (key: string) => env[key] === 'true'; // default OFF

export const signupFlags = {
  /** ff.auth.signup.unified_route.enabled */
  unifiedRoute: on('VITE_AUTH_SIGNUP_UNIFIED_ROUTE_ENABLED'),
  /** ff.auth.signup.google_signin.enabled */
  googleSignin: on('VITE_AUTH_SIGNUP_GOOGLE_SIGNIN_ENABLED'),
  /** ff.auth.signup.apple_signin.enabled — ON (CEO 2026-06-28): App Store rule 4.8.
   *  Button shown; graceful "not switched on yet" until Firebase Apple provider +
   *  Apple Service ID are configured. Set env var to "false" to force-hide. */
  appleSignin: on('VITE_AUTH_SIGNUP_APPLE_SIGNIN_ENABLED'),
  /** ff.auth.signup.facebook_signin.enabled — DEFAULT OFF (CEO 2026-07-31): these
   *  were dead taps (needs a Meta app + business verification + Meta review — days
   *  of your-side setup). Hidden until the keys exist; set the env var to "true"
   *  the moment the Meta app is approved. NOTE: this is the LOGIN button only — the
   *  PetWash social-media page links (header/footer) are separate and untouched. */
  facebookSignin: off('VITE_AUTH_SIGNUP_FACEBOOK_SIGNIN_ENABLED'),
  /** ff.auth.signup.instagram_signin.enabled — DEFAULT OFF (CEO 2026-07-31). Server
   *  OAuth 503s until INSTAGRAM_CLIENT_ID/SECRET are set; flip env "true" when ready. */
  instagramSignin: off('VITE_AUTH_SIGNUP_INSTAGRAM_SIGNIN_ENABLED'),
  /** ff.auth.signup.tiktok_signin.enabled — DEFAULT OFF (CEO 2026-07-31). Needs
   *  TIKTOK_CLIENT_KEY/SECRET + TikTok Login-Kit review; flip env "true" when ready. */
  tiktokSignin: off('VITE_AUTH_SIGNUP_TIKTOK_SIGNIN_ENABLED'),
  /** ff.auth.signup.yahoo_signin.enabled — DEFAULT OFF (CEO 2026-08-01). Button is
   *  coded; needs a Yahoo OAuth app enabled in the Firebase console (yahoo.com
   *  provider + client id/secret). Graceful "not switched on yet" until then; flip
   *  env "true" when the console side is configured. Web-only (no native sheet). */
  yahooSignin: off('VITE_AUTH_SIGNUP_YAHOO_SIGNIN_ENABLED'),
  /** ff.auth.signup.microsoft_signin.enabled — DEFAULT OFF (CEO 2026-08-01). Needs
   *  a Microsoft/Azure app enabled in the Firebase console (microsoft.com provider).
   *  Covers Outlook/Hotmail/Live + work accounts. Flip env "true" when ready. */
  microsoftSignin: off('VITE_AUTH_SIGNUP_MICROSOFT_SIGNIN_ENABLED'),
  /** ff.auth.signup.email_password.enabled */
  emailPassword: on('VITE_AUTH_SIGNUP_EMAIL_PASSWORD_ENABLED'),
  /** ff.auth.signup.2fa.enabled — KEPT OFF: the SMS-2FA step is not built; turning
   *  it on would inject a broken/fake step into login. Enable only once built. */
  twoFactor: off('VITE_AUTH_SIGNUP_2FA_ENABLED'),
  /** ff.auth.signup.passkey.enabled — ON (CEO 2026-06-28): WebAuthn works device-side. */
  passkey: on('VITE_AUTH_SIGNUP_PASSKEY_ENABLED'),
  /** ff.auth.signup.keychain_prompt.enabled */
  keychainPrompt: off('VITE_AUTH_SIGNUP_KEYCHAIN_PROMPT_ENABLED'),
  /** ff.auth.signup.legacy_panel_hidden.enabled */
  legacyPanelHidden: off('VITE_AUTH_SIGNUP_LEGACY_PANEL_HIDDEN_ENABLED'),
  /** FEATURE_SMS_FALLBACK_AND_REAL_ERRORS */
  smsFallbackAndRealErrors: on('VITE_FEATURE_SMS_FALLBACK_AND_REAL_ERRORS'),
} as const;
