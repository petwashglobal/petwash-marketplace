import { describe, it, expect } from 'vitest';
import { normalizePhoneE164 } from './authUtils';

describe('normalizePhoneE164 — Israeli numbers', () => {
  it('local mobile with leading 0', () => {
    expect(normalizePhoneE164('0501234567')).toBe('+972501234567');
    expect(normalizePhoneE164('050-123-4567')).toBe('+972501234567');
  });

  it('BUGFIX: mobile WITHOUT leading 0 routes to Israel, not a wrong country', () => {
    expect(normalizePhoneE164('501234567')).toBe('+972501234567');
    expect(normalizePhoneE164('54-123-4567')).toBe('+972541234567');
  });

  it('country code without +', () => {
    expect(normalizePhoneE164('972501234567')).toBe('+972501234567');
  });

  it('00 international prefix', () => {
    expect(normalizePhoneE164('00972501234567')).toBe('+972501234567');
  });

  it('already E.164 is preserved (separators stripped)', () => {
    expect(normalizePhoneE164('+972 50 123 4567')).toBe('+972501234567');
  });

  it('landline with leading 0', () => {
    expect(normalizePhoneE164('03-1234567')).toBe('+97231234567');
  });
});
