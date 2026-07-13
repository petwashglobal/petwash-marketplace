import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const ROOT = resolve(__dirname, '..', '..', '..');
const read = (p: string) => readFileSync(resolve(ROOT, p), 'utf8');

describe('signup SMS fallback and real errors', () => {
  it('exposes the feature flag with a rollback env var', () => {
    const flags = read('client/src/lib/authSignupFlags.ts');

    expect(flags).toContain('smsFallbackAndRealErrors');
    expect(flags).toContain('VITE_FEATURE_SMS_FALLBACK_AND_REAL_ERRORS');
  });

  it('checks SMS health and defaults to email when the provider is unhealthy', () => {
    const src = read('client/src/pages/SignUpLuxury.tsx');

    expect(src).toContain("fetch(getApiUrl('/api/auth/sms/status')");
    expect(src).toContain('status?.smsProviderHealthy !== false');
    expect(src).toContain("setMethod((current) => current === 'mobile' ? 'email' : current)");
  });

  it('moves the user to email and shows the backend message when SMS start fails', () => {
    const src = read('client/src/pages/SignUpLuxury.tsx');
    const block = src.slice(src.indexOf('const d = await r.json();'), src.indexOf('setSent(true);'));

    expect(block).toContain('setSmsProviderHealthy(false)');
    expect(block).toContain("setMethod('email')");
    expect(block).toContain('d.message');
    expect(block).toContain('continue with email');
  });

  it('renders the SMS-unavailable banner only in the pre-send form, gated on provider health', () => {
    // The signup form was unified (#): instead of separate mobile/email
    // method panels, there is now ONE pre-send form (`{!sent && (`) that
    // offers phone AND email together, with the OTP screens rendered
    // separately once `sent` is true. The SMS-unavailable banner must live
    // inside that pre-send form, gated on the feature flag + !smsProviderHealthy,
    // and steer the user to email — never render in the post-send OTP view.
    const src = read('client/src/pages/SignUpLuxury.tsx');
    const preSendStart = src.indexOf('{!sent && (');
    expect(preSendStart).toBeGreaterThan(0);
    // The pre-send form ends where the post-send OTP block begins.
    const otpStart = src.indexOf("{method === 'mobile' && sent && (");
    expect(otpStart).toBeGreaterThan(preSendStart);
    const preSendForm = src.slice(preSendStart, otpStart);

    expect(preSendForm).toContain('signupFlags.smsFallbackAndRealErrors && !smsProviderHealthy');
    expect(preSendForm).toContain('SMS is temporarily unavailable');
    // The banner must NOT appear in the post-send OTP region.
    const otpRegion = src.slice(otpStart);
    expect(otpRegion).not.toContain('SMS is temporarily unavailable');
  });

  it('does not log full phone numbers before SMS send', () => {
    // Unified login is SignUpLuxury (the old SignIn.tsx was retired 2026-06-28).
    // It must never log the raw phone number.
    const src = read('client/src/pages/SignUpLuxury.tsx');

    expect(src).not.toContain("Sending code to:', formattedPhone");
    expect(src).not.toContain("Sending code to:', phone");
  });
});
