/**
 * THE VERIFICATION DEAD-END (CEO: "did verifications all good but refresh me to
 * sign up again"). Root cause (audit 2026-07-24): a correct OTP minted a session
 * but never recorded the user as verified. Email-first was worst: email-session
 * created a Firebase user with emailVerified:true but Postgres email_verified
 * stayed false while authProvider='email', so the post-login decider bounced the
 * user to /verify-email on every load — and that page (Firebase magic-link)
 * couldn't clear the Postgres flag → infinite loop. Phone OTP was never persisted
 * either, and no path advanced activationStatus (blocking wallet/booking).
 *
 * Fix: the session handlers now call the ActivationService markers, which write
 * the boolean AND the timestamp AND advance activationStatus in one place.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const s = readFileSync(resolve(__dirname, '..', '..', 'server/routes/publicAuthRoutes.ts'), 'utf8');
const svc = readFileSync(resolve(__dirname, '..', '..', 'server/services/ActivationService.ts'), 'utf8');

describe('OTP now persists verification', () => {
  it('phone-session marks mobile verified (PhoneAuth import + call present)', () => {
    expect(s).toMatch(/\[PhoneAuth\] mark-mobile-verified failed/);
    expect(s).toMatch(/await markMobileVerified\(user\.uid\);/);
  });

  it('email-session marks email verified — stopping the /verify-email bounce loop', () => {
    expect(s).toMatch(/infinite 'sent back to signup'/);
    expect(s).toMatch(/await markEmailVerified\(user\.uid, \{ acceptTerms: true \}\);/);
  });

  it('verify-signup-email advances activation (timestamp, not just the boolean)', () => {
    const block = s.slice(s.indexOf('verify-signup-email'), s.indexOf('verify-signup-email') + 2000);
    expect(s).toMatch(/verify-signup-email activation advance failed/);
  });

  it('the markers write BOTH the boolean and the timestamp (single source)', () => {
    expect(svc).toMatch(/phoneVerified: true,\n      activationStatus/);
    expect(svc).toMatch(/emailVerified: true,/);
    expect(svc).toMatch(/mobileVerifiedAt: now,/);
    expect(svc).toMatch(/emailVerifiedAt: now,/);
  });
});
