/**
 * Regression pin — verification wiring (2026-07-25, CEO "didn't verify fully").
 *
 * The OTP CODE endpoints validated the code but never persisted the verified
 * state to the user record / activation state machine — only the email LINK path
 * did. So the UI showed "verified ✓" while users.emailVerified / phoneVerified
 * stayed false. Both code paths must now complete the verification.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const route = readFileSync(join(__dirname, '..', 'routes', 'onboarding-verification.ts'), 'utf8');
const otp = readFileSync(join(__dirname, '..', '..', 'client', 'src', 'components', 'OtpCodeInput.tsx'), 'utf8');

describe('verify-code endpoints persist the verified state', () => {
  it('verify-email-code calls markEmailVerified', () => {
    const seg = route.slice(route.indexOf("'/verify-email-code'"), route.indexOf("'/send-sms-code'"));
    expect(seg).toMatch(/markEmailVerified\(/);
  });
  it('verify-sms-code calls markMobileVerified on success', () => {
    const seg = route.slice(route.indexOf("'/verify-sms-code'"));
    expect(seg).toMatch(/result\.success/);
    expect(seg).toMatch(/markMobileVerified\(/);
  });
  it('phone lookup is prefix-robust (matches last 9 digits)', () => {
    const seg = route.slice(route.indexOf("'/verify-sms-code'"));
    expect(seg).toMatch(/slice\(-9\)/);
  });
});

describe('OTP boxes are responsive (no overflow on mobile)', () => {
  it('boxes flex/shrink instead of a fixed width', () => {
    // The old fixed w-11 boxes could not shrink and overflowed narrow screens.
    expect(otp).toMatch(/flex-1 min-w-0/);
    expect(otp).not.toMatch(/'w-11 h-14/);
  });
});
