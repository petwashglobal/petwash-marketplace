/**
 * otpHmac — the ONE place OTP / verification codes get hashed for storage.
 *
 * Rule: a verification code (SMS/email OTP) must NEVER be written to a
 * datastore in plaintext. Persist only `hashOtpCode(code)` and compare with
 * `verifyOtpCode(input, storedHash)` (timing-safe). The raw code is sent to
 * the user over the delivery channel and then discarded.
 *
 * This mirrors the HMAC scheme already used by TwilioSMSService so the whole
 * platform shares one keyed-hash convention. Consolidating here also gives the
 * future CI guard a single legitimate hashing site to allowlist.
 */

import crypto from 'crypto';

/**
 * Resolve the HMAC key from server secrets. Mirrors TwilioSMSService's
 * resolution order so a code hashed by either path verifies against the other.
 * The literal fallback only ever applies in local/dev where these env vars are
 * unset; production sets APP_SESSION_SECRET / COOKIE_SECRET.
 */
function otpHmacSecret(): string {
  return (
    process.env.APP_SESSION_SECRET ||
    process.env.COOKIE_SECRET ||
    'petwash-otp-hmac'
  );
}

/** Keyed SHA-256 HMAC of a verification code, hex-encoded. Store THIS, never the code. */
export function hashOtpCode(code: string): string {
  return crypto.createHmac('sha256', otpHmacSecret()).update(String(code)).digest('hex');
}

/**
 * Timing-safe comparison of a user-supplied code against a stored HMAC.
 * Returns false (never throws) on any malformed input or length mismatch.
 */
export function verifyOtpCode(inputCode: string, storedHash: string | null | undefined): boolean {
  if (!inputCode || !storedHash) return false;
  const inputHash = hashOtpCode(inputCode);
  const a = Buffer.from(inputHash, 'hex');
  const b = Buffer.from(storedHash, 'hex');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
