/**
 * The KYC admin surface guards Israeli national IDs. Two defects, 2026-09-13.
 *
 * 1. THE SESSION WAS NEVER BOUND TO ITS OWNER. requireKYCMFA computed the
 *    caller's userId, called validateMFASession (which RETURNS the userId the
 *    token was minted for) — and never compared them. The only binding was
 *    source IP, so two reviewers behind one office NAT or VPN were
 *    interchangeable on approve/reject, the audit trail, role assignment and
 *    erasure. Same class as a proof that names a contact instead of an account.
 *
 * 2. THE "MFA VERIFY" ENDPOINT VERIFIED NOTHING. POST /admin/mfa/verify took a
 *    STRING naming a method ('totp' | 'sms' | 'email' | 'webauthn') and issued
 *    a 4-hour session. No code, no challenge, no digit. Anyone holding the
 *    lowest KYC permission could mint one and satisfy every requireKYCMFA gate.
 *    Staged like the other gates here: DARK by default (still issues, but says
 *    so and logs it), KYC_MFA_REQUIRE_REAL_FACTOR=true to enforce a validated
 *    one-time code bound to the same user.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const R = (p: string) => readFileSync(resolve(__dirname, '..', '..', p), 'utf8');

describe('1. the MFA session belongs to the caller', () => {
  const src = R('server/services/KYC2026/KYCAccessControl.ts');

  it('requireKYCMFA compares the session owner to the caller', () => {
    expect(src).toContain('validation.userId !== userId');
    expect(src).toContain('mfa_session_belongs_to_another_user');
  });

  it('the mismatch is refused, not just logged', () => {
    const at = src.indexOf('mfa_session_belongs_to_another_user');
    expect(src.slice(at, at + 600)).toContain('res.status(403)');
  });

  it('validateMFASession still returns the owner for that comparison to be possible', () => {
    expect(src).toContain('return { valid: true, userId: session.userId };');
  });
});

describe('2. an unverified session is never called MFA', () => {
  const src = R('server/routes/kyc2026.ts');

  it('a one-time code is checked when one is presented, and bound to this user', () => {
    expect(src).toContain('validateTransactionToken(otpToken)');
    expect(src).toContain("(result as any)?.userId === userId");
  });

  it('the flag enforces a real factor', () => {
    expect(src).toContain("process.env.KYC_MFA_REQUIRE_REAL_FACTOR");
    expect(src).toContain("error: 'MFA_FACTOR_REQUIRED'");
  });

  it('without the flag it still works, but the response and the log tell the truth', () => {
    expect(src).toContain('factorVerified,');
    expect(src).toContain('session issued WITHOUT a verified factor');
    expect(src).toContain('WITHOUT a verified second factor');
  });
});
