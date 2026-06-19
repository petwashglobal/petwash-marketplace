import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mock the data layer + loyalty so we can exercise resolveWashDiscount
//    deterministically without a real DB / Firebase.
const mockRows: any[] = [];
vi.mock('../db', () => {
  const builder = {
    select: () => builder,
    from: () => builder,
    where: () => builder,
    orderBy: () => Promise.resolve(mockRows),
  };
  return { db: builder };
});

const loyaltyStatus = { value: null as null | { tier: string } };
vi.mock('../services/loyalty', () => ({
  getLoyaltyStatus: vi.fn(async () => loyaltyStatus.value),
}));

vi.mock('../lib/logger', () => ({ logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn() } }));

import {
  clampWashPercent,
  applyWashDiscountCents,
  resolveWashDiscount,
  PRESTIGE_BASIC_PERCENT,
} from '../services/memberDiscount';
import { MEMBER_DISCOUNT_MAX_PERCENT } from '../../shared/schema-member-discount';

beforeEach(() => {
  mockRows.length = 0;
  loyaltyStatus.value = null;
});

describe('clampWashPercent — never exceeds the 10% cap, never negative', () => {
  it('caps at the max percent', () => {
    expect(clampWashPercent(50)).toBe(MEMBER_DISCOUNT_MAX_PERCENT);
    expect(clampWashPercent(11)).toBe(10);
  });
  it('passes legal values through', () => {
    expect(clampWashPercent(5)).toBe(5);
    expect(clampWashPercent(7)).toBe(7);
    expect(clampWashPercent(10)).toBe(10);
  });
  it('floors junk / negatives to 0', () => {
    expect(clampWashPercent(0)).toBe(0);
    expect(clampWashPercent(-5)).toBe(0);
    expect(clampWashPercent(NaN)).toBe(0);
  });
});

describe('applyWashDiscountCents — discount math (server-authoritative)', () => {
  it('5% off a single wash (5500) = 5225, discount 275', () => {
    const r = applyWashDiscountCents(5500, 5);
    expect(r.discountCents).toBe(275);
    expect(r.netCents).toBe(5225);
    expect(r.percent).toBe(5);
  });
  it('10% off a 10-pack (44000) = 39600, discount 4400', () => {
    const r = applyWashDiscountCents(44000, 10);
    expect(r.discountCents).toBe(4400);
    expect(r.netCents).toBe(39600);
  });
  it('7% off 22000 = 20460, discount 1540', () => {
    const r = applyWashDiscountCents(22000, 7);
    expect(r.discountCents).toBe(1540);
    expect(r.netCents).toBe(20460);
  });
  it('clamps an over-cap percent before applying', () => {
    const r = applyWashDiscountCents(5500, 99);
    expect(r.percent).toBe(10);
    expect(r.netCents).toBe(4950);
  });
  it('0% leaves the amount untouched', () => {
    const r = applyWashDiscountCents(5500, 0);
    expect(r.netCents).toBe(5500);
    expect(r.discountCents).toBe(0);
  });
  it('never returns a negative net or more than gross', () => {
    const r = applyWashDiscountCents(100, 10);
    expect(r.netCents).toBeGreaterThanOrEqual(0);
    expect(r.netCents).toBeLessThanOrEqual(100);
  });
});

describe('resolveWashDiscount — combines prestige + admin-approved, picks the max', () => {
  it('no member, no record → 0%', async () => {
    const d = await resolveWashDiscount('u1');
    expect(d.percent).toBe(0);
    expect(d.source).toBe('none');
  });

  it('loyalty member only → automatic Prestige Basic 5%', async () => {
    loyaltyStatus.value = { tier: 'BRONZE' };
    const d = await resolveWashDiscount('u1');
    expect(d.percent).toBe(PRESTIGE_BASIC_PERCENT);
    expect(d.prestigeBasic).toBe(true);
    expect(d.source).toBe('prestige_basic');
  });

  it('approved senior 10% beats prestige 5% → 10%, labelled senior', async () => {
    loyaltyStatus.value = { tier: 'GOLD' };
    mockRows.push({ discountType: 'senior', discountPercent: 10, status: 'approved', expiresAt: null });
    const d = await resolveWashDiscount('u1');
    expect(d.percent).toBe(10);
    expect(d.source).toBe('senior');
    expect(d.approved).toBe(true);
  });

  it('approved disability 7% with no loyalty → 7%, labelled disability', async () => {
    mockRows.push({ discountType: 'disability', discountPercent: 7, status: 'approved', expiresAt: null });
    const d = await resolveWashDiscount('u1');
    expect(d.percent).toBe(7);
    expect(d.source).toBe('disability');
  });

  it('expired approved record is ignored', async () => {
    mockRows.push({ discountType: 'senior', discountPercent: 10, status: 'approved', expiresAt: new Date(Date.now() - 1000) });
    const d = await resolveWashDiscount('u1');
    expect(d.percent).toBe(0);
  });

  it('an over-cap stored percent is clamped to 10', async () => {
    mockRows.push({ discountType: 'senior', discountPercent: 25, status: 'approved', expiresAt: null });
    const d = await resolveWashDiscount('u1');
    expect(d.percent).toBe(10);
  });
});

// ── Wash-only SCOPE: replicate the catalog + the price-path predicate to prove
//    the discount is applied to K9000 wash SKUs ONLY and never to anything else.
describe('scope — discount applies to K9000 wash SKUs ONLY', () => {
  // Mirror of PHASE1_PRODUCTS surface/productType in payments-sumit.ts.
  const CATALOG: Record<string, { surface: string; productType: string }> = {
    ACCOUNT_CREDIT:  { surface: 'wallet_topup', productType: 'ACCOUNT_CREDIT' },
    SINGLE_WASH:     { surface: 'kiosk', productType: 'SINGLE_WASH' },
    WASH_PACKAGE_3:  { surface: 'kiosk', productType: 'WASH_PACKAGE' },
    WASH_PACKAGE_5:  { surface: 'kiosk', productType: 'WASH_PACKAGE' },
    WASH_PACKAGE_10: { surface: 'kiosk', productType: 'WASH_PACKAGE' },
  };
  // Mirror of the isWashSku predicate in payments-sumit.ts.
  const isWashSku = (surface: string, productType: string) =>
    surface === 'kiosk' && (productType === 'SINGLE_WASH' || productType === 'WASH_PACKAGE');

  it('all wash SKUs qualify', () => {
    for (const sku of ['SINGLE_WASH', 'WASH_PACKAGE_3', 'WASH_PACKAGE_5', 'WASH_PACKAGE_10']) {
      const { surface, productType } = CATALOG[sku];
      expect(isWashSku(surface, productType)).toBe(true);
    }
  });

  it('wallet top-up / account credit NEVER qualifies', () => {
    const { surface, productType } = CATALOG.ACCOUNT_CREDIT;
    expect(isWashSku(surface, productType)).toBe(false);
  });

  it('hypothetical non-kiosk products (egift / shop / service) never qualify', () => {
    expect(isWashSku('egift', 'EGIFT')).toBe(false);
    expect(isWashSku('shop', 'SHOP_ITEM')).toBe(false);
    expect(isWashSku('booking', 'GROOMING')).toBe(false);
    // even a wash-like productType on a non-kiosk surface is rejected
    expect(isWashSku('shop', 'SINGLE_WASH')).toBe(false);
  });
});
