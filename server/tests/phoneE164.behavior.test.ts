/**
 * Behavioral test for the canonical server-side E.164 normaliser.
 *
 * Regression it pins: `users.phone` is UNIQUE and `users.phone_hash` is an
 * HMAC of the string as written. Before server/lib/phoneE164.ts existed the
 * login path (auth-sms.ts) and the profile-write paths normalised
 * differently, so `0541234567` written by the profile PATCH hashed to a
 * different key than `+972541234567` computed by the SMS-login lookup — the
 * OTP login then reported "no account" for a user who plainly had one.
 */
import { describe, it, expect } from 'vitest';
import { normalizePhoneE164, isE164 } from '../lib/phoneE164';

describe('normalizePhoneE164', () => {
  it('maps every Israeli representation of one subscriber to ONE E.164 string', () => {
    const canonical = '+972541234567';
    for (const variant of [
      '+972541234567',
      '+972-54-123-4567',
      '+972 (54) 123 4567',
      '0541234567',
      '054-123-4567',
      '054 123 4567',
      '972541234567',
      '00972541234567',
      '541234567',
    ]) {
      expect(normalizePhoneE164(variant), variant).toBe(canonical);
    }
  });

  it('keeps international numbers intact instead of forcing +972', () => {
    expect(normalizePhoneE164('+447700900123')).toBe('+447700900123');
    expect(normalizePhoneE164('+1 (415) 555-0142')).toBe('+14155550142');
    expect(normalizePhoneE164('00447700900123')).toBe('+447700900123');
  });

  it('normalises Israeli landlines too, not just mobiles', () => {
    expect(normalizePhoneE164('03-1234567')).toBe('+97231234567');
    expect(normalizePhoneE164('097654321')).toBe('+97297654321');
  });

  it('never throws and never invents a country code for garbage input', () => {
    expect(() => normalizePhoneE164('')).not.toThrow();
    expect(isE164(normalizePhoneE164('not-a-phone'))).toBe(false);
    expect(isE164(normalizePhoneE164('12345'))).toBe(false);
  });

  it('isE164 accepts canonical output and rejects national format', () => {
    expect(isE164('+972541234567')).toBe(true);
    expect(isE164('0541234567')).toBe(false);
    expect(isE164('+0541234567')).toBe(false);
  });
});
