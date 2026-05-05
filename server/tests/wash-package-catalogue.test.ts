/**
 * Tests for the wash-package catalogue (createWashPackageData seed).
 *
 * Locks the four CEO-confirmed packs visible on petwash.co.il:
 *   1 wash   ₪55   (price === K9000 single-wash debit price)
 *   3 washes ₪150  (₪50 / wash)
 *   5 washes ₪220  (₪44 / wash)
 *  10 washes ₪440  (₪44 / wash)
 *
 * Pre-PR-W8, the seed stopped at 5 washes — so a request to
 * POST /api/checkout with packageId=4 (the 10-pack) returned 404.
 * This test pins the four packs in place; any future change must
 * update this test deliberately.
 */

import { describe, it, expect } from 'vitest';
import { createWashPackageData } from '../utils';
import { WASH_PRICE_ILS_CENTS } from '../services/K9000RedemptionService';

describe('wash package catalogue', () => {
  const seed = createWashPackageData();

  it('contains exactly the four CEO-confirmed packs', () => {
    const counts = seed.map((p) => p.washCount).sort((a, b) => a - b);
    expect(counts).toEqual([1, 3, 5, 10]);
  });

  it('every pack is active', () => {
    for (const p of seed) {
      expect(p.isActive).toBe(true);
    }
  });

  it('every pack carries Hebrew name + description', () => {
    for (const p of seed) {
      expect(typeof p.nameHe).toBe('string');
      expect((p as any).nameHe.length).toBeGreaterThan(0);
      expect(typeof p.descriptionHe).toBe('string');
      expect((p as any).descriptionHe.length).toBeGreaterThan(0);
    }
  });

  it('1-pack price equals the K9000 single-wash debit price', () => {
    const onePack = seed.find((p) => p.washCount === 1);
    expect(onePack).toBeDefined();
    const cents = Math.round(parseFloat(onePack!.price) * 100);
    expect(cents).toBe(WASH_PRICE_ILS_CENTS);
  });

  it('3-pack price = ₪150 (₪50 / wash)', () => {
    const p = seed.find((x) => x.washCount === 3);
    expect(p).toBeDefined();
    expect(parseFloat(p!.price)).toBeCloseTo(150, 2);
    expect(parseFloat(p!.price) / 3).toBeCloseTo(50, 2);
  });

  it('5-pack price = ₪220 (₪44 / wash)', () => {
    const p = seed.find((x) => x.washCount === 5);
    expect(p).toBeDefined();
    expect(parseFloat(p!.price)).toBeCloseTo(220, 2);
    expect(parseFloat(p!.price) / 5).toBeCloseTo(44, 2);
  });

  it('10-pack price = ₪440 (₪44 / wash) — PR-W8 closes the 404 gap', () => {
    const p = seed.find((x) => x.washCount === 10);
    expect(p).toBeDefined();
    expect(parseFloat(p!.price)).toBeCloseTo(440, 2);
    expect(parseFloat(p!.price) / 10).toBeCloseTo(44, 2);
  });

  it('per-wash math is monotonically non-increasing as pack size grows', () => {
    const ordered = [...seed].sort((a, b) => a.washCount - b.washCount);
    let prev = Infinity;
    for (const p of ordered) {
      const perWash = parseFloat(p.price) / p.washCount;
      expect(perWash).toBeLessThanOrEqual(prev);
      prev = perWash;
    }
  });

  it('every price is a positive decimal-shekel string', () => {
    for (const p of seed) {
      expect(typeof p.price).toBe('string');
      const n = parseFloat(p.price);
      expect(Number.isFinite(n)).toBe(true);
      expect(n).toBeGreaterThan(0);
    }
  });
});
