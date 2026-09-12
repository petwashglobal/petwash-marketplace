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
    // Email proof only — the acceptTerms flag was removed 2026-09-12 (consent audit
    // P0-2): verifying an inbox is not accepting the Terms.
    expect(s).toMatch(/await markEmailVerified\(user\.uid\);/);
    expect(s).not.toContain('acceptTerms: true');
  });

  it('verify-signup-email advances activation (timestamp, not just the boolean)', () => {
    // The route logs '[Signup] verify-signup-email activation advance FAILED'.
    // This asserted the lowercase spelling, so it went red the day the log line
    // was written and stayed red — asserting nothing ever since. Match the
    // spelling case-insensitively, and assert it INSIDE the handler rather than
    // anywhere in a 9k-line file (the `block` slice was computed and dropped).
    const i = s.indexOf('publicAuthRouter.post("/api/auth/verify-signup-email"');
    expect(i).toBeGreaterThan(-1);
    // Bound the region by the NEXT route definition, not a character count —
    // a fixed window silently stops covering the handler as the file grows.
    const next = s.indexOf('publicAuthRouter.post(', i + 30);
    const block = s.slice(i, next > -1 ? next : s.length);
    expect(block).toMatch(/verify-signup-email activation advance failed/i);
    // The point of the pin: the advance is awaited and its failure is NOT
    // swallowed — a 5xx goes back to the caller.
    expect(block).toMatch(/await markMobileVerified\(|await markEmailVerified\(/);
  });

  it('the markers write BOTH the boolean and the timestamp (single source)', () => {
    expect(svc).toMatch(/phoneVerified: true,\n      activationStatus/);
    expect(svc).toMatch(/emailVerified: true,/);
    expect(svc).toMatch(/mobileVerifiedAt: now,/);
    expect(svc).toMatch(/emailVerifiedAt: now,/);
  });
});
