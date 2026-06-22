import { describe, it, expect } from 'vitest';
import {
  validateProviderRates,
  getProviderMinPriceCents,
  PROVIDER_MIN_PRICE_CENTS,
  DEFAULT_MIN_PRICE_CENTS,
} from '../../shared/providerMinPrices';

describe('provider minimum-price floor', () => {
  it('rejects the "stupid pricing" cases below the floor', () => {
    // walk floor = ₪49. ₪0.02 (2 agorot) and ₪10 must be rejected.
    const r2 = validateProviderRates('walk_my_pet', [2]);
    expect(r2.ok).toBe(false);
    if (!r2.ok) {
      expect(r2.minPriceCents).toBe(4900);
      expect(r2.message).toContain('₪49');
    }
    expect(validateProviderRates('walk_my_pet', [1000]).ok).toBe(false); // ₪10 < ₪49
  });

  it('accepts a rate at or above the floor', () => {
    expect(validateProviderRates('walk_my_pet', [4900]).ok).toBe(true);  // exactly ₪49
    expect(validateProviderRates('sitter_suite', [12000]).ok).toBe(true); // ₪120 ≥ ₪99
  });

  it('rejects when the LOWEST of several rates is below the floor', () => {
    // one good rate, one too-low → reject (a provider can't sneak a ₪5 visit in)
    expect(validateProviderRates('sitter_suite', [15000, 500]).ok).toBe(false);
  });

  it('ignores zero/null rates (not this gate\'s job to require a price)', () => {
    expect(validateProviderRates('walk_my_pet', [0, null, undefined]).ok).toBe(true);
  });

  it('unknown platform falls back to the default floor', () => {
    expect(getProviderMinPriceCents('something_new')).toBe(DEFAULT_MIN_PRICE_CENTS);
    expect(validateProviderRates('something_new', [100]).ok).toBe(false); // ₪1 < ₪39
  });

  it('floors match the spec (₪49 walk, ₪99 sit, ₪149 training)', () => {
    expect(PROVIDER_MIN_PRICE_CENTS.walk_my_pet).toBe(4900);
    expect(PROVIDER_MIN_PRICE_CENTS.sitter_suite).toBe(9900);
    expect(PROVIDER_MIN_PRICE_CENTS.academy).toBe(14900);
  });
});
