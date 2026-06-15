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
 *  - apple_signin    OFF — no backend Apple OAuth; Firebase Apple needs console config first.
 *  - facebook_signin OFF — Firebase Facebook needs a configured Meta app + redirect URI.
 *  - instagram_signin OFF — server-mediated Instagram OAuth 503s until INSTAGRAM_CLIENT_ID/SECRET set.
 *  - passkey        OFF — WebAuthn exists (/api/webauthn/*) but the post-login setup step
 *                         is gated until verified on a real device.
 *  - 2fa            OFF — email SMS-2FA step not built yet (no fake step).
 *  - keychain_prompt OFF
 *  - legacy_panel_hidden OFF
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
  /** ff.auth.signup.apple_signin.enabled */
  appleSignin: off('VITE_AUTH_SIGNUP_APPLE_SIGNIN_ENABLED'),
  /** ff.auth.signup.facebook_signin.enabled — default OFF: Firebase Facebook
   *  needs a configured Meta app + OAuth redirect; until then the button errors. */
  facebookSignin: off('VITE_AUTH_SIGNUP_FACEBOOK_SIGNIN_ENABLED'),
  /** ff.auth.signup.instagram_signin.enabled — default OFF: server-mediated
   *  Instagram OAuth returns 503 until INSTAGRAM_CLIENT_ID/SECRET are set. */
  instagramSignin: off('VITE_AUTH_SIGNUP_INSTAGRAM_SIGNIN_ENABLED'),
  /** ff.auth.signup.tiktok_signin.enabled — default OFF: server-mediated
   *  TikTok OAuth returns 503 until TIKTOK_CLIENT_KEY/SECRET are set. */
  tiktokSignin: off('VITE_AUTH_SIGNUP_TIKTOK_SIGNIN_ENABLED'),
  /** ff.auth.signup.email_password.enabled */
  emailPassword: on('VITE_AUTH_SIGNUP_EMAIL_PASSWORD_ENABLED'),
  /** ff.auth.signup.2fa.enabled */
  twoFactor: off('VITE_AUTH_SIGNUP_2FA_ENABLED'),
  /** ff.auth.signup.passkey.enabled */
  passkey: off('VITE_AUTH_SIGNUP_PASSKEY_ENABLED'),
  /** ff.auth.signup.keychain_prompt.enabled */
  keychainPrompt: off('VITE_AUTH_SIGNUP_KEYCHAIN_PROMPT_ENABLED'),
  /** ff.auth.signup.legacy_panel_hidden.enabled */
  legacyPanelHidden: off('VITE_AUTH_SIGNUP_LEGACY_PANEL_HIDDEN_ENABLED'),
  /** FEATURE_SMS_FALLBACK_AND_REAL_ERRORS */
  smsFallbackAndRealErrors: on('VITE_FEATURE_SMS_FALLBACK_AND_REAL_ERRORS'),
} as const;
