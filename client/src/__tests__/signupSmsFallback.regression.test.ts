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

  it('only renders the SMS-unavailable banner inside the mobile method panel', () => {
    const src = read('client/src/pages/SignUpLuxury.tsx');
    const mobilePanel = src.slice(
      src.indexOf("{method === 'mobile' && !sent && ("),
      src.indexOf("{(method === 'email' || method === 'other') && !sent && ("),
    );

    expect(mobilePanel).toContain('!smsProviderHealthy');
    expect(mobilePanel).toContain('SMS is temporarily unavailable');
  });

  it('does not log full phone numbers before SMS send', () => {
    const signIn = read('client/src/pages/SignIn.tsx');

    expect(signIn).not.toContain("logger.info('[PhoneAuth] Sending code to:', formattedPhone)");
    expect(signIn).toContain("logger.info('[PhoneAuth] Sending code', { phone: formattedPhone.slice(-4) })");
  });
});
