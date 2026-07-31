import { describe, it, expect } from 'vitest';
import {
  validateProviderRates,
  getProviderMinPriceCents,
  getProviderMaxPriceCents,
  PROVIDER_MIN_PRICE_CENTS,
  DEFAULT_MIN_PRICE_CENTS,
  DEFAULT_MAX_PRICE_CENTS,
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

describe('provider maximum-price ceiling', () => {
  it('rejects the "typo / gouging" cases above the ceiling', () => {
    // walk ceiling = ₪500. A ₪5,000 (typo of ₪500) walk must be rejected.
    const r = validateProviderRates('walk_my_pet', [500000]);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.reason).toBe('too_high');
      expect(r.maxPriceCents).toBe(50000);
      expect(r.message).toContain('₪500');
    }
  });

  it('accepts a premium rate at or below the ceiling', () => {
    expect(validateProviderRates('sitter_suite', [200000]).ok).toBe(true); // exactly ₪2,000/day
    expect(validateProviderRates('academy', [140000]).ok).toBe(true);      // ₪1,400 ≤ ₪1,500
  });

  it('rejects when the HIGHEST of several rates is above the ceiling', () => {
    // one sane rate, one absurd → reject (no ₪9,999 sneaking in on a second field)
    const r = validateProviderRates('sitter_suite', [15000, 999900]);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('too_high');
  });

  it('reports too_low reason when below the floor', () => {
    const r = validateProviderRates('walk_my_pet', [2]);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('too_low');
  });

  it('accepts a rate inside [floor, ceiling]', () => {
    expect(validateProviderRates('walk_my_pet', [6000]).ok).toBe(true); // ₪60 in [₪49, ₪500]
  });

  it('unknown platform falls back to the default ceiling (₪2,000)', () => {
    expect(getProviderMaxPriceCents('something_new')).toBe(DEFAULT_MAX_PRICE_CENTS);
    expect(validateProviderRates('something_new', [300000]).ok).toBe(false); // ₪3,000 > ₪2,000
  });
});
