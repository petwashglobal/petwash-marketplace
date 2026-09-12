/**
 * The custom OAuth parameters every Google sign-in entry point must send.
 *
 * CEO 2026-09-13, verbatim: "gmail must require password".
 *
 * WHAT WE CAN AND CANNOT DO, honestly:
 *
 *   We already send `prompt: 'select_account'`, which makes Google show the
 *   account chooser. It does NOT make Google ask for a credential — while a
 *   live Google session exists in that browser, Google just hands the token
 *   back. That is why the CEO was signed in without being asked for anything.
 *
 *   `max_age` is the OIDC parameter that changes it: it is the maximum age, in
 *   seconds, that Google's own authentication may be. With 0, Google's existing
 *   session is never old enough, so it must re-authenticate the person before
 *   returning a token.
 *
 *   What that re-authentication LOOKS like is Google's decision, not ours — a
 *   password, a passkey, Face ID, or a 2-step push, depending on how the
 *   account is set up. We cannot demand "a password" specifically; no relying
 *   party can. We can demand "prove it's you, again, now".
 *
 *   And because a client-side parameter is a request, not a guarantee, the
 *   thing that actually ENFORCES freshness is server-side: Firebase ID tokens
 *   carry `auth_time`, and server/adminAuth.ts already rejects any admin call
 *   whose auth_time is older than ADMIN_SESSION_MAX_AGE_SECONDS. This parameter
 *   makes the prompt happen; that check makes it matter.
 *
 * COST, stated plainly: every returning customer re-authenticates with Google
 * on every sign-in. That is friction on the signup funnel. Flip
 * GOOGLE_FORCE_REAUTH to false to go back to today's behaviour — one line.
 */

/** CEO switch. false = previous behaviour (chooser only, no re-authentication). */
export const GOOGLE_FORCE_REAUTH = true;

/**
 * Custom parameters for GoogleAuthProvider.setCustomParameters().
 *
 * `max_age` must be a STRING — setCustomParameters serialises values into the
 * query string, and a numeric 0 is falsy in enough places along that path that
 * passing the number is a silent no-op risk. '0' is unambiguous.
 */
export function googleAuthCustomParameters(): Record<string, string> {
  const params: Record<string, string> = { prompt: 'select_account' };
  if (GOOGLE_FORCE_REAUTH) params.max_age = '0';
  return params;
}
