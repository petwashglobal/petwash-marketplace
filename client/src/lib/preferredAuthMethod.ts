/**
 * preferredAuthMethod — CEO MASTER §A3 §1.5 (2026-08-29).
 *
 * Remembers, per device, which auth method the human successfully
 * used LAST TIME so a returning visit can order the sign-in options
 * with their preferred method first.
 *
 * DISCIPLINE
 *   * NEVER stored — password, OTP, Firebase ID token, OAuth access
 *     token, refresh token, Google/Apple credential.
 *   * ONLY stored — the string label of the method that resulted in
 *     a COMPLETE PetWash session (not a mid-flow tap).
 *   * The value is a per-device UX preference, not authentication
 *     authority. Every provider still authenticates through its full
 *     server-side pipeline.
 *   * Set ONLY after a SUCCESSFUL server bootstrap (BOOTSTRAP_SUCCESS
 *     stage from authJourney). §1.5 — a failed / cancelled attempt
 *     must not create a preference.
 */

const LS_KEY = 'pw_preferred_auth_method';

export const PREFERRED_AUTH_METHODS = [
  'google',
  'apple',
  'phone',
  'email',
  'passkey',
] as const;
export type PreferredAuthMethod = (typeof PREFERRED_AUTH_METHODS)[number];

export function isPreferredAuthMethod(v: unknown): v is PreferredAuthMethod {
  return typeof v === 'string' && (PREFERRED_AUTH_METHODS as readonly string[]).includes(v);
}

/**
 * Read the last-preferred auth method for this device. Null if none
 * has been recorded or if storage is unavailable.
 */
export function readPreferredAuthMethod(): PreferredAuthMethod | null {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    const raw = window.localStorage.getItem(LS_KEY);
    return isPreferredAuthMethod(raw) ? raw : null;
  } catch {
    return null;
  }
}

/**
 * Record the method the user JUST successfully authenticated with.
 * Call ONLY after a full server bootstrap (a canonical PetWash
 * session was created). A UI click alone must NEVER call this.
 */
export function writePreferredAuthMethod(method: unknown): void {
  if (!isPreferredAuthMethod(method)) return;
  try {
    if (typeof window === 'undefined' || !window.localStorage) return;
    window.localStorage.setItem(LS_KEY, method);
  } catch {
    /* private mode / quota — non-fatal */
  }
}

/** Clear the preference — used on explicit "change device" / logout on shared device. */
export function clearPreferredAuthMethod(): void {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return;
    window.localStorage.removeItem(LS_KEY);
  } catch {
    /* non-fatal */
  }
}
