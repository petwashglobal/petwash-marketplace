import { describe, it, expect } from 'vitest';
import { isValidIsraeliId, isValidPhone, fieldSchemas } from './fieldSchemas';
import { vmsg } from './messages';

describe('isValidIsraeliId (checksum)', () => {
  it('accepts valid Israeli IDs', () => {
    // Known-valid checksums
    expect(isValidIsraeliId('000000018')).toBe(true);
    expect(isValidIsraeliId('123456782')).toBe(true);
  });
  it('rejects invalid checksums, empty, and all-zero', () => {
    expect(isValidIsraeliId('123456789')).toBe(false);
    expect(isValidIsraeliId('')).toBe(false);
    expect(isValidIsraeliId('000000000')).toBe(false);
    expect(isValidIsraeliId('abc')).toBe(false);
  });
});

describe('isValidPhone (E.164 via libphonenumber-js)', () => {
  it('accepts a valid IL mobile in E.164', () => {
    expect(isValidPhone('+972541234567')).toBe(true);
  });
  it('rejects junk and empty', () => {
    expect(isValidPhone('')).toBe(false);
    expect(isValidPhone('123')).toBe(false);
    expect(isValidPhone('not a phone')).toBe(false);
  });
});

describe('fieldSchemas', () => {
  const s = fieldSchemas('en');

  it('email: rejects bad format, accepts good', () => {
    expect(s.email.safeParse('nope').success).toBe(false);
    expect(s.email.safeParse('a@b.co').success).toBe(true);
  });

  it('postalCode: enforces 5–7 digits', () => {
    expect(s.postalCode.safeParse('1234').success).toBe(false);
    expect(s.postalCode.safeParse('1234567').success).toBe(true);
  });

  it('amount: enforces min/max and parses currency strings', () => {
    const amt = s.amount(10, 1000);
    expect(amt.safeParse('₪5').success).toBe(false); // below min
    expect(amt.safeParse('5000').success).toBe(false); // above max
    const ok = amt.safeParse('₪250');
    expect(ok.success).toBe(true);
    if (ok.success) expect(ok.data).toBe(250);
  });

  it('consent: requires true', () => {
    expect(s.consent.safeParse(false).success).toBe(false);
    expect(s.consent.safeParse(true).success).toBe(true);
  });
});

describe('vmsg localization', () => {
  it('returns he and en variants, falls back to en', () => {
    expect(vmsg('email_invalid', 'he')).toContain('אימייל');
    expect(vmsg('email_invalid', 'en')).toContain('email');
    expect(vmsg('email_invalid', 'ar')).toBe(vmsg('email_invalid', 'en')); // fallback
  });
});
