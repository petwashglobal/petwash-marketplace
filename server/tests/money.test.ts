import { describe, it, expect } from 'vitest';
import {
  roundAgorot, toAgorot, fromAgorot,
  vatFromInclusive, netFromInclusive, vatOnNet,
  assertNonNegativeAgorot, clampDeduction,
} from '@shared/money';

describe('money guard — agorot conversion', () => {
  it('toAgorot / fromAgorot round-trip', () => {
    expect(toAgorot(14.99)).toBe(1499);
    expect(toAgorot(100)).toBe(10000);
    expect(fromAgorot(1499)).toBe(14.99);
  });
  it('roundAgorot rejects non-finite (NaN must never become money)', () => {
    expect(() => roundAgorot(NaN)).toThrow();
    expect(() => roundAgorot(Infinity)).toThrow();
    expect(roundAgorot(4.9995)).toBe(5);
  });
});

describe('money guard — VAT 18/118', () => {
  it('extracts VAT from a VAT-INCLUSIVE total (not forward × 0.18)', () => {
    // ₪100 inclusive → 1525 agorot VAT (~15.25%), NOT 1800
    expect(vatFromInclusive(10000)).toBe(1525);
    expect(vatFromInclusive(11800)).toBe(1800); // ₪118 incl → ₪18 VAT
  });
  it('net + VAT reconstructs the inclusive gross', () => {
    const gross = 10000;
    expect(netFromInclusive(gross) + vatFromInclusive(gross)).toBe(gross);
  });
  it('vatOnNet adds VAT on top of a net base', () => {
    expect(vatOnNet(10000)).toBe(1800); // ₪100 net → ₪18 VAT on top
  });
});

describe('money guard — never-negative / never-overdraw', () => {
  it('assertNonNegativeAgorot throws on negative / non-finite', () => {
    expect(() => assertNonNegativeAgorot(-1)).toThrow();
    expect(() => assertNonNegativeAgorot(NaN, 'balance')).toThrow();
    expect(assertNonNegativeAgorot(500)).toBe(500);
  });
  it('clampDeduction never overdraws and never goes negative', () => {
    expect(clampDeduction(1500, 1000)).toBe(1000); // can't take more than available
    expect(clampDeduction(-50, 1000)).toBe(0);      // can't take negative
    expect(clampDeduction(300, 1000)).toBe(300);
  });
});
