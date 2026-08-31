/**
 * OTP code generation — canonical entrypoint (task #186).
 *
 * The audit inventory (task #182) found 12 duplicates of the same
 * `crypto.randomInt(100000, 1000000|999999)` formula spread across
 * services and routes. This file is the SINGLE canonical
 * entrypoint every new OTP-issuing call-site MUST use.
 *
 * A source-anchored regression pin
 * (otpCodeGeneratorSprawl.regression.test.ts) rejects new
 * `crypto.randomInt(100000, …)` occurrences outside a documented
 * KNOWN_LEGACY set. The 12 existing generators are frozen in that
 * set as documented debt; a follow-up task migrates them one at a
 * time.
 *
 * Notes on the domain:
 *   • The code range is [100000, 999999] — always a 6-digit number
 *     with no leading-zero ambiguity. This matches iOS AutoFill and
 *     Android SMS Retriever's expected 4-8 digit windows (see
 *     otpAutofillFormat.ts).
 *   • crypto.randomInt is CSPRNG-grade — never use Math.random.
 */

import crypto from 'crypto';

/**
 * Generate one 6-digit OTP as a string, using the CSPRNG.
 *
 * ALWAYS returns exactly 6 characters, all digits, in the range
 * "100000" to "999999" (never a leading zero — that would confuse
 * autofill heuristics).
 */
export function generateOtpCode(): string {
  const lo = 100_000;
  const hi = 1_000_000;   // exclusive upper bound per crypto.randomInt(min, max)
  const n = crypto.randomInt(lo, hi);
  return String(n);
}
