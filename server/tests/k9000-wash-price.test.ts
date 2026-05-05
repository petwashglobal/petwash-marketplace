/**
 * K9000 wash-price single-source-of-truth test
 *
 * Pins the CEO-confirmed national price of ₪55.00 for a single K9000 wash.
 * This price applies to:
 *   • cashWalletBalanceCents debit at K9000 redemption
 *   • egiftBalanceCents       debit at K9000 redemption
 *   • promoBalanceCents       debit at K9000 redemption
 *   • lifetimeRedeemedCents   credit at K9000 redemption
 *   • auto-compensation reversal of the above
 *
 * Wash-package redemption (units, not money) is unaffected: it decrements
 * walletAccounts.washPackageCredits by 1 regardless of this constant.
 *
 * The wash-packages catalogue ships its own per-product prices (1, 3, 5,
 * 10 wash packs). The 1-wash pack price MUST equal this constant for the
 * "buy one wash" path to match the "redeem one wash" path; the test below
 * locks that invariant against the seed data.
 */

import { describe, it, expect } from 'vitest';
import { WASH_PRICE_ILS_CENTS } from '../services/K9000RedemptionService';
import { createWashPackageData } from '../utils';

describe('K9000 wash price — single source of truth', () => {
  it('WASH_PRICE_ILS_CENTS equals 5500 (₪55.00 national)', () => {
    expect(WASH_PRICE_ILS_CENTS).toBe(5500);
  });

  it('₪55.00 is the per-wash price (5500 cents / 100)', () => {
    expect(WASH_PRICE_ILS_CENTS / 100).toBe(55);
  });

  it('matches the 1-wash package price in the seed', () => {
    const seed = createWashPackageData();
    const onePack = seed.find((p) => p.washCount === 1);
    expect(onePack).toBeDefined();
    // seed price is decimal shekels; multiply by 100 to compare in cents
    const seedCents = Math.round(parseFloat(onePack!.price) * 100);
    expect(seedCents).toBe(WASH_PRICE_ILS_CENTS);
  });

  it('per-wash math implied by the catalogue is internally consistent', () => {
    const seed = createWashPackageData();
    const findByCount = (n: number) =>
      seed.find((p) => p.washCount === n);

    // 3-pack ₪150 → ₪50/wash (CEO-confirmed: "10%-ish" discount)
    const three = findByCount(3);
    if (three) {
      const perWash = parseFloat(three.price) / 3;
      expect(perWash).toBeCloseTo(50, 2);
    }

    // 5-pack ₪220 → ₪44/wash
    const five = findByCount(5);
    if (five) {
      const perWash = parseFloat(five.price) / 5;
      expect(perWash).toBeCloseTo(44, 2);
    }

    // 10-pack ₪440 → ₪44/wash (only present after the 10-pack seed PR)
    const ten = findByCount(10);
    if (ten) {
      const perWash = parseFloat(ten.price) / 10;
      expect(perWash).toBeCloseTo(44, 2);
    }
  });

  it('the 1-wash unit price is the most expensive per-wash bracket', () => {
    const seed = createWashPackageData();
    const perWashPrices = seed.map((p) => parseFloat(p.price) / p.washCount);
    const maxPerWash = Math.max(...perWashPrices);
    // The single-wash price (₪55) should be the highest unit price; bulk packs
    // give a discount per wash. If this fails, someone introduced a "bulk
    // pack" that costs MORE per wash than the single-wash redemption — which
    // would be an obvious pricing bug.
    expect(maxPerWash).toBeCloseTo(WASH_PRICE_ILS_CENTS / 100, 2);
  });
});
