import { describe, it, expect } from 'vitest';
import { formatProviderCode, isProviderCode } from '../lib/providerCode';

describe('formatProviderCode', () => {
  it('formats with zero-padded id and the given year', () => {
    expect(formatProviderCode(42, '2026-06-12')).toBe('PW-PRV-2026-00042');
    expect(formatProviderCode(1, new Date('2026-01-01'))).toBe('PW-PRV-2026-00001');
  });

  it('widens past 5 digits without truncating', () => {
    expect(formatProviderCode(123456, '2027-03-01')).toBe('PW-PRV-2027-123456');
  });

  it('is collision-free: distinct ids give distinct codes', () => {
    const a = formatProviderCode(10, '2026-01-01');
    const b = formatProviderCode(11, '2026-01-01');
    expect(a).not.toBe(b);
  });

  it('rejects non-positive / non-integer ids', () => {
    expect(() => formatProviderCode(0)).toThrow();
    expect(() => formatProviderCode(-1)).toThrow();
    expect(() => formatProviderCode(1.5)).toThrow();
  });
});

describe('isProviderCode', () => {
  it('accepts well-formed codes', () => {
    expect(isProviderCode('PW-PRV-2026-00042')).toBe(true);
    expect(isProviderCode('PW-PRV-2027-123456')).toBe(true);
  });
  it('rejects malformed values', () => {
    expect(isProviderCode('PW-PRV-2026-42')).toBe(false); // too few digits
    expect(isProviderCode('PWV-2026-A3B7C2D1')).toBe(false); // voucher serial
    expect(isProviderCode('')).toBe(false);
  });
});
