/**
 * Tests for the e-gift denomination allowlist.
 *
 * Pins the four CEO-confirmed denominations and verifies the parser
 * rejects every off-list value (including the legacy abuse vectors:
 * ₪0.01, ₪999_999, negative, NaN, infinity, non-numeric strings).
 */

import { describe, it, expect } from 'vitest';
import {
  EGIFT_ALLOWED_DENOMINATIONS,
  parseEgiftDenomination,
  describeAllowedDenominations,
} from '../lib/egift-denominations';

describe('e-gift denomination allowlist', () => {
  it('exports exactly the four CEO-confirmed denominations', () => {
    expect(EGIFT_ALLOWED_DENOMINATIONS).toEqual([100, 250, 500, 1000]);
  });

  it('describeAllowedDenominations renders the canonical list', () => {
    expect(describeAllowedDenominations()).toBe('₪100, ₪250, ₪500, ₪1000');
    expect(describeAllowedDenominations('NIS ')).toBe(
      'NIS 100, NIS 250, NIS 500, NIS 1000',
    );
  });

  it('accepts each allowed denomination as a number', () => {
    for (const n of EGIFT_ALLOWED_DENOMINATIONS) {
      expect(parseEgiftDenomination(n)).toBe(n);
    }
  });

  it('accepts each allowed denomination as a numeric string', () => {
    expect(parseEgiftDenomination('100')).toBe(100);
    expect(parseEgiftDenomination('250')).toBe(250);
    expect(parseEgiftDenomination('500')).toBe(500);
    expect(parseEgiftDenomination('1000')).toBe(1000);
  });

  it('trims whitespace before parsing', () => {
    expect(parseEgiftDenomination('  100  ')).toBe(100);
  });

  it('rejects sub-shekel and zero', () => {
    expect(parseEgiftDenomination(0.01)).toBeNull();
    expect(parseEgiftDenomination(0)).toBeNull();
    expect(parseEgiftDenomination('0.01')).toBeNull();
    expect(parseEgiftDenomination('0')).toBeNull();
  });

  it('rejects huge / abuse values', () => {
    expect(parseEgiftDenomination(999_999)).toBeNull();
    expect(parseEgiftDenomination('999999')).toBeNull();
    expect(parseEgiftDenomination(Number.MAX_SAFE_INTEGER)).toBeNull();
  });

  it('rejects negative numbers', () => {
    expect(parseEgiftDenomination(-100)).toBeNull();
    expect(parseEgiftDenomination('-100')).toBeNull();
  });

  it('rejects off-list near-neighbours', () => {
    expect(parseEgiftDenomination(99)).toBeNull();
    expect(parseEgiftDenomination(101)).toBeNull();
    expect(parseEgiftDenomination(150)).toBeNull(); // 3-pack price — wrong product
    expect(parseEgiftDenomination(220)).toBeNull(); // 5-pack price
    expect(parseEgiftDenomination(440)).toBeNull(); // 10-pack price
  });

  it('rejects non-integer values inside the range', () => {
    expect(parseEgiftDenomination(100.5)).toBeNull();
    expect(parseEgiftDenomination(1000.01)).toBeNull();
    expect(parseEgiftDenomination('100.5')).toBeNull();
  });

  it('accepts integer-valued decimal strings (250.00 → 250)', () => {
    // Form payloads sometimes serialize integers as "250.00". Number()
    // collapses these to a real integer, which is a valid denomination.
    expect(parseEgiftDenomination('250.00')).toBe(250);
    expect(parseEgiftDenomination('1000.0')).toBe(1000);
  });

  it('rejects non-numeric input', () => {
    expect(parseEgiftDenomination('abc')).toBeNull();
    expect(parseEgiftDenomination('')).toBeNull();
    expect(parseEgiftDenomination('  ')).toBeNull();
    expect(parseEgiftDenomination(NaN)).toBeNull();
    expect(parseEgiftDenomination(Infinity)).toBeNull();
    expect(parseEgiftDenomination(-Infinity)).toBeNull();
  });

  it('rejects non-string non-number input safely', () => {
    expect(parseEgiftDenomination(null)).toBeNull();
    expect(parseEgiftDenomination(undefined)).toBeNull();
    expect(parseEgiftDenomination({})).toBeNull();
    expect(parseEgiftDenomination([])).toBeNull();
    expect(parseEgiftDenomination(true)).toBeNull();
    expect(parseEgiftDenomination(false)).toBeNull();
  });
});
