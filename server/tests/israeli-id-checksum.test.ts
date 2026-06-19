import { describe, it, expect } from 'vitest';
import { isValidIsraeliId, maskId, lastFour, looksLikeIsraeliId } from '../lib/israeliId';

describe('isValidIsraeliId — checksum', () => {
  // Known-valid IDs (checksum passes). 033554437 is the sample used in
  // server/company-registration-secure.ts; the rest were generated to satisfy
  // the official check-digit algorithm.
  const VALID = ['033554437', '000000018', '100000009', '100000017', '100000025'];
  // Same digits with leading zeros stripped — must still validate (left-pad).
  const VALID_UNPADDED = ['33554437'];

  it.each(VALID)('accepts valid 9-digit ID %s', (id) => {
    expect(isValidIsraeliId(id)).toBe(true);
  });

  it.each(VALID_UNPADDED)('left-pads and accepts %s', (id) => {
    expect(isValidIsraeliId(id)).toBe(true);
  });

  it('accepts IDs entered with spaces/dashes', () => {
    expect(isValidIsraeliId('03-355 4437')).toBe(true);
  });

  // Known-invalid: correct length but wrong check digit, plus malformed input.
  const INVALID = ['033554438', '123456789', '100000000', '100000001', '111111111'];

  it.each(INVALID)('rejects invalid ID %s', (id) => {
    expect(isValidIsraeliId(id)).toBe(false);
  });

  it('rejects empty / non-numeric / too-long input', () => {
    expect(isValidIsraeliId('')).toBe(false);
    expect(isValidIsraeliId('abc')).toBe(false);
    expect(isValidIsraeliId('0000000000')).toBe(false); // 10 digits
    expect(isValidIsraeliId('000000000')).toBe(false); // all-zeros degenerate
  });
});

describe('maskId', () => {
  it('masks all but the last 4 digits', () => {
    expect(maskId('033554437')).toBe('*****4437');
  });
  it('never leaks more than the last 4', () => {
    expect(maskId('033554437')).not.toContain('033');
  });
  it('handles short input without leaking', () => {
    expect(maskId('12')).toBe('**');
    expect(maskId('')).toBe('');
  });
  it('ignores separators when masking', () => {
    expect(maskId('03-355 4437')).toBe('*****4437');
  });
});

describe('lastFour', () => {
  it('returns the last four digits', () => {
    expect(lastFour('033554437')).toBe('4437');
  });
  it('returns null when fewer than 4 digits', () => {
    expect(lastFour('12')).toBeNull();
  });
});

describe('looksLikeIsraeliId', () => {
  it('treats pure 9-or-fewer-digit strings as Israeli-ID candidates', () => {
    expect(looksLikeIsraeliId('033554437')).toBe(true);
    expect(looksLikeIsraeliId('12345678')).toBe(true);
  });
  it('treats passports / licences (with letters) as NOT Israeli IDs', () => {
    expect(looksLikeIsraeliId('A1234567')).toBe(false);
    expect(looksLikeIsraeliId('X99887766')).toBe(false);
  });
  it('treats overly-long digit strings as NOT Israeli IDs', () => {
    expect(looksLikeIsraeliId('1234567890')).toBe(false);
  });
});
