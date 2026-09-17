/**
 * ONE MONEY MODEL FOR EVERY MARKETPLACE JOB (CEO, 2026-09-14 / 2026-09-17).
 *
 * "the best to pet wash and same as … madpaws rover.com … fin model need to be
 *  logic" — the customer pays the provider's rate plus the Pet Wash fee on top,
 * the provider gets the full rate, Pet Wash keeps the fee with its VAT inside.
 */
import { describe, expect, it } from 'vitest';
import {
  MARKETPLACE_SERVICE_FEE_RATE,
  splitMarketplaceJob,
  cardProcessingCostCents,
} from '../../shared/marketplaceMoney';
import { PETWASH_COMMISSION_RATE } from '../../shared/schema';

describe('the split', () => {
  it('₪1,000 rate → customer ₪1,150, provider ₪1,000, Pet Wash ₪150 (VAT ₪22.88 inside)', () => {
    const s = splitMarketplaceJob(100_000);
    expect(s).toEqual({
      rateCents: 100_000,
      serviceFeeCents: 15_000,
      serviceFeeVatCents: 2_288,
      serviceFeeNetCents: 12_712,
      customerTotalCents: 115_000,
      providerPayoutCents: 100_000,
    });
  });

  it('the money always adds up: customer = provider + Pet Wash, to the agora', () => {
    for (const rate of [1, 99, 4_999, 12_345, 35_000, 100_000, 288_000, 1_234_567]) {
      const s = splitMarketplaceJob(rate);
      expect(s.customerTotalCents).toBe(s.providerPayoutCents + s.serviceFeeCents);
      expect(s.serviceFeeNetCents + s.serviceFeeVatCents).toBe(s.serviceFeeCents);
    }
  });

  it('the provider is never short-changed: payout is the full rate', () => {
    for (const rate of [5_000, 48_000, 90_000]) {
      expect(splitMarketplaceJob(rate).providerPayoutCents).toBe(rate);
    }
  });

  it('VAT is on the fee only — never on the provider’s money', () => {
    const s = splitMarketplaceJob(100_000);
    // 18% of the provider's ₪1,000 would be ₪180; the VAT here is under ₪23.
    expect(s.serviceFeeVatCents).toBeLessThan(0.18 * s.serviceFeeCents);
    expect(s.serviceFeeVatCents).toBe(Math.round(15_000 * 18 / 118));
  });

  it('nonsense input cannot produce a negative or fractional charge', () => {
    for (const bad of [-500, NaN, Infinity, 12.7] as number[]) {
      const s = splitMarketplaceJob(bad);
      expect(Number.isInteger(s.customerTotalCents)).toBe(true);
      expect(s.customerTotalCents).toBeGreaterThanOrEqual(0);
    }
  });

  it('the fee rate is the same 15% the booking quote engine uses', () => {
    expect(MARKETPLACE_SERVICE_FEE_RATE).toBe(PETWASH_COMMISSION_RATE);
    expect(MARKETPLACE_SERVICE_FEE_RATE).toBe(0.15);
  });
});

describe('card processing is a Pet Wash cost on the WHOLE charge', () => {
  it('at 1.5% on a ₪1,150 charge the clearing company takes ₪17.25', () => {
    expect(cardProcessingCostCents(115_000, 0.015)).toBe(1_725);
  });
  it('an unknown rate costs nothing rather than a guessed amount', () => {
    expect(cardProcessingCostCents(115_000, 0)).toBe(0);
    expect(cardProcessingCostCents(115_000, NaN)).toBe(0);
  });
});
