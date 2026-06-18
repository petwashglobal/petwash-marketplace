// Resilient Firebase token + session-cookie verification (ROOT-CAUSE FIX 2026-06-18).
//
// Background: verifyIdToken(token, /*checkRevoked*/ true) AND verifySessionCookie(
// cookie, /*checkRevoked*/ true) each make an extra Identity-Toolkit NETWORK lookup
// (getAccountInfo) to read tokensValidAfterTime. That lookup needs API/IAM access on
// the runtime service account. When it fails for an infra reason (permission /
// network / internal), the whole call throws and the caller maps it to INVALID_TOKEN
// / invalid-session — silently 401'ing EVERY login, every Bearer API call, AND every
// page-load session restore (/api/auth/me-session), even though the token/cookie is
// cryptographically valid. createCustomToken (the old signing-health probe) signs
// LOCALLY and can pass while these lookups are broken, which is why the bug hid.
//
// These helpers verify cryptographically on every call (signature, aud, iss, exp — no
// SA API needed) and degrade ONLY the revocation check: on an infra failure they
// re-verify without checkRevoked and accept. Genuine failures (expired / wrong-project
// / malformed / explicitly-revoked / disabled user) stay REJECTED via HARD_TOKEN_ERRORS
// and, as a backstop, the fallback verify still rejects anything cryptographically bad.

// Token/cookie-level Firebase auth error codes that MUST stay rejected — never fall
// back to a non-revocation verify on these. Covers BOTH verifyIdToken and
// verifySessionCookie error namespaces.
export const HARD_TOKEN_ERRORS = new Set<string>([
  // verifyIdToken
  'auth/id-token-expired',
  'auth/id-token-revoked',
  'auth/invalid-id-token',
  // verifySessionCookie
  'auth/session-cookie-expired',
  'auth/session-cookie-revoked',
  'auth/invalid-session-cookie',
  // shared
  'auth/argument-error',
  'auth/invalid-argument',
  'auth/user-disabled',
  'auth/user-not-found',
]);

export function isHardTokenError(code: string | undefined | null): boolean {
  return !!code && HARD_TOKEN_ERRORS.has(code);
}

type RawVerify = (token: string, checkRevoked: boolean) => Promise<any>;

/**
 * Core: wrap a Firebase Admin verify function (verifyIdToken OR verifySessionCookie)
 * with graceful degradation of the revocation check. `rawVerify` is the real SDK method.
 */
async function resilientVerify(
  rawVerify: RawVerify,
  token: string,
  checkRevoked: boolean | undefined,
  onDegrade?: (code: string) => void,
): Promise<any> {
  try {
    return await rawVerify(token, checkRevoked === true);
  } catch (err: any) {
    const code: string = err?.code || err?.errorInfo?.code || '';
    // Only degrade when the caller asked for revocation AND the failure is an
    // infra/permission error — not when the token itself is invalid.
    if (checkRevoked === true && !isHardTokenError(code)) {
      const decoded = await rawVerify(token, false);
      if (onDegrade) onDegrade(code || 'unknown');
      return decoded;
    }
    throw err;
  }
}

export function verifyIdTokenResilient(
  rawVerify: RawVerify,
  idToken: string,
  checkRevoked: boolean | undefined,
  onDegrade?: (code: string) => void,
): Promise<any> {
  return resilientVerify(rawVerify, idToken, checkRevoked, onDegrade);
}

export function verifySessionCookieResilient(
  rawVerify: RawVerify,
  sessionCookie: string,
  checkRevoked: boolean | undefined,
  onDegrade?: (code: string) => void,
): Promise<any> {
  return resilientVerify(rawVerify, sessionCookie, checkRevoked, onDegrade);
}
