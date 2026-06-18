// Resilient Firebase ID-token verification (ROOT-CAUSE FIX 2026-06-18).
//
// Background: verifyIdToken(idToken, /*checkRevoked*/ true) makes an extra
// Identity-Toolkit NETWORK lookup (getAccountInfo) to read tokensValidAfterTime.
// That lookup needs API/IAM access on the runtime service account. When it
// fails for an infra reason (permission / network / internal), the whole call
// throws and the caller maps it to INVALID_TOKEN — silently 401'ing EVERY login
// and Bearer API call, even though the token is cryptographically valid.
// createCustomToken (the old signing-health probe) signs LOCALLY and can pass
// while this lookup is broken, which is why the bug hid for so long.
//
// This helper verifies the token cryptographically on every call (signature,
// aud, iss, exp — no SA API needed) and degrades ONLY the revocation check:
// on an infra failure it re-verifies without checkRevoked and accepts. Genuine
// token failures (expired / wrong-project / malformed / explicitly-revoked /
// disabled user) stay REJECTED via the HARD_TOKEN_ERRORS allowlist and, as a
// backstop, the fallback verify still rejects anything cryptographically bad.

// Token-level Firebase auth error codes that MUST stay rejected — never fall
// back to a non-revocation verify on these.
export const HARD_TOKEN_ERRORS = new Set<string>([
  'auth/id-token-expired',
  'auth/id-token-revoked',
  'auth/argument-error',
  'auth/invalid-id-token',
  'auth/invalid-argument',
  'auth/user-disabled',
  'auth/user-not-found',
]);

export function isHardTokenError(code: string | undefined | null): boolean {
  return !!code && HARD_TOKEN_ERRORS.has(code);
}

type RawVerify = (idToken: string, checkRevoked: boolean) => Promise<any>;

/**
 * Wrap a Firebase Admin verifyIdToken implementation with graceful degradation
 * of the revocation check. `rawVerify` is the real SDK method.
 */
export async function verifyIdTokenResilient(
  rawVerify: RawVerify,
  idToken: string,
  checkRevoked: boolean | undefined,
  onDegrade?: (code: string) => void,
): Promise<any> {
  try {
    return await rawVerify(idToken, checkRevoked === true);
  } catch (err: any) {
    const code: string = err?.code || err?.errorInfo?.code || '';
    // Only degrade when the caller asked for revocation AND the failure is an
    // infra/permission error — not when the token itself is invalid.
    if (checkRevoked === true && !isHardTokenError(code)) {
      const decoded = await rawVerify(idToken, false);
      if (onDegrade) onDegrade(code || 'unknown');
      return decoded;
    }
    throw err;
  }
}
