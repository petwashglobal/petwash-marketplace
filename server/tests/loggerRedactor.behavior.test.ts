/**
 * ServerLogger PII/secret redactor — P0-AUDIT-LOG-STRATEGIC (task #208).
 *
 * Every context object passed to logger.info/warn/error/debug is
 * scrubbed of sensitive fields BEFORE stdout/Sentry emission. This
 * pin verifies:
 *   • Sensitive-key allowlist replaces value with '[REDACTED]'
 *   • Email/phone key names get masked (not deleted)
 *   • Recursion works through nested objects and arrays
 *   • A ref-cycle / pathological object doesn't crash the logger
 *   • The redactor never mutates the input
 */
import { describe, it, expect } from 'vitest';
import { redactLogContext, redactEmail, redactPhone } from '../lib/redaction';

describe('redactLogContext — sensitive-key allowlist', () => {
  const sensitiveKeys = [
    'password', 'newPassword', 'passwordHash',
    'otp', 'otpCode', 'verificationCode', 'code',
    'token', 'idToken', 'accessToken', 'refreshToken', 'authToken', 'bearerToken',
    'sessionCookie', 'customToken', 'authorization', 'cookie', 'set-cookie',
    'apiKey', 'secret', 'clientSecret', 'webhookSecret',
    'idNumber', 'nationalId', 'teudatZehut',
    'iban', 'bankAccount', 'bankAccountNumber', 'routingNumber',
    'cardNumber', 'cvv', 'cvc',
    'pin', 'pinCode',
  ];

  it.each(sensitiveKeys)('%s → [REDACTED]', (key) => {
    const out = redactLogContext({ [key]: 'secret-value-123' }) as Record<string, unknown>;
    expect(out[key]).toBe('[REDACTED]');
  });

  it('case-insensitive: OTP / Otp / OTP_CODE all redact', () => {
    const out = redactLogContext({ OTP: '123456', Otp_Code: '654321' }) as Record<string, unknown>;
    expect(out.OTP).toBe('[REDACTED]');
    expect(out.Otp_Code).toBe('[REDACTED]');
  });
});

describe('redactLogContext — email/phone are MASKED (not redacted)', () => {
  it('email keys are masked so operators can correlate on domain', () => {
    const out = redactLogContext({ email: 'sarah@example.com' }) as Record<string, unknown>;
    expect(out.email).toBe(redactEmail('sarah@example.com'));
    expect(out.email).toContain('example.com'); // domain kept
    expect(out.email).not.toContain('sarah');   // local part stripped
  });

  it('phone keys are masked with last-3 kept for support', () => {
    const out = redactLogContext({ phone: '+972501234567' }) as Record<string, unknown>;
    expect(out.phone).toBe(redactPhone('+972501234567'));
    expect(out.phone).toContain('567');         // last-3 kept
    expect(out.phone).not.toContain('50123');   // rest stripped
  });

  it('recognises new/old/recipient variants', () => {
    const out = redactLogContext({
      newEmail: 'a@b.com', oldEmail: 'c@d.com', recipientEmail: 'e@f.com',
      newPhone: '+972501234567', toPhone: '+972501234567',
    }) as Record<string, unknown>;
    expect(String(out.newEmail)).not.toContain('a@b.com');
    expect(String(out.oldEmail)).not.toContain('c@d.com');
    expect(String(out.recipientEmail)).not.toContain('e@f.com');
    expect(String(out.newPhone)).not.toContain('501234567');
    expect(String(out.toPhone)).not.toContain('501234567');
  });
});

describe('redactLogContext — recursion + immutability', () => {
  it('recurses into nested objects', () => {
    const input = {
      user: { email: 'sarah@example.com', password: 'abc' },
      meta: { safeField: 'kept' },
    };
    const out = redactLogContext(input) as any;
    expect(out.user.password).toBe('[REDACTED]');
    expect(out.user.email).not.toContain('sarah');
    expect(out.meta.safeField).toBe('kept');
  });

  it('walks arrays element by element', () => {
    const input = { items: [{ code: '123', label: 'x' }, { code: '456', label: 'y' }] };
    const out = redactLogContext(input) as any;
    expect(out.items[0].code).toBe('[REDACTED]');
    expect(out.items[1].code).toBe('[REDACTED]');
    expect(out.items[0].label).toBe('x');
  });

  it('NEVER mutates the input', () => {
    const input = { password: 'secret', deep: { token: 't', arr: [{ email: 'a@b.com' }] } };
    const snapshot = JSON.parse(JSON.stringify(input));
    redactLogContext(input);
    expect(input).toEqual(snapshot);
  });

  it('caps recursion depth — pathological cycle does not hang', () => {
    const a: any = {};
    const b: any = { a };
    a.b = b;
    // A cycle would infinite-loop without a depth cap.
    const out = redactLogContext(a);
    expect(out).toBeDefined();
  });
});

describe('redactLogContext — non-object values pass through unchanged', () => {
  it('strings, numbers, booleans, null, undefined return as-is', () => {
    expect(redactLogContext('hello')).toBe('hello');
    expect(redactLogContext(42)).toBe(42);
    expect(redactLogContext(true)).toBe(true);
    expect(redactLogContext(null)).toBe(null);
    expect(redactLogContext(undefined)).toBe(undefined);
  });
  it('Date and Error instances are returned by reference (no walk)', () => {
    const d = new Date();
    expect(redactLogContext(d)).toBe(d);
    const e = new Error('oops');
    expect(redactLogContext(e)).toBe(e);
  });
});
