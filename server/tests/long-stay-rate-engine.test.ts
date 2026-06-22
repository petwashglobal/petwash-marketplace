/**
 * Build C — long-stay / house-hosting rate engine.
 * Verifies the real money math in BookingLifecycleService.calculateQuote with a
 * mocked rate-card row: flat baseline unchanged, cleaning fee, security deposit
 * (held, not in total), bi-weekly discount tier, tiered nightly progression, and
 * per-day peak surcharge.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

let RATE_CARD: any = null;
vi.mock('../db', () => {
  const chain: any = {
    select: () => chain,
    from: () => chain,
    where: () => chain,
    limit: () => Promise.resolve(RATE_CARD ? [RATE_CARD] : []),
  };
  return { db: chain };
});

import { bookingLifecycleService } from '../services/BookingLifecycleService';

const COMMISSION = 0.15;
const VAT = 0.18;

const baseCard = {
  baseRatePerNightCents: 10000,
  baseRatePerHourCents: null,
  baseRatePerVisitCents: null,
  additionalPetSurchargeCents: 0,
  weekendSurchargePercent: 0,
  holidaySurchargePercent: 0,
  weeklyDiscountPercent: 0,
  biweeklyDiscountPercent: 0,
  monthlyDiscountPercent: 0,
  cleaningFeeCents: 0,
  securityDepositPercent: 0,
  nightlyRateProgression: null,
  peakDateRanges: [],
  addonPricing: {},
  isActive: true,
};
const card = (over: any = {}) => ({ ...baseCard, ...over });

// Monday 2026-07-06 12:00 UTC (a weekday, midday avoids day-boundary issues).
const mon = new Date('2026-07-06T12:00:00Z');
const plusDays = (n: number) => new Date(mon.getTime() + n * 24 * 3600 * 1000);
const quote = (start: Date, end: Date, pets = 1) =>
  bookingLifecycleService.calculateQuote('p', 'sitter_suite', 'pet_sitting', start, end, pets, []);

beforeEach(() => {
  RATE_CARD = null;
});

describe('Build C — long-stay rate engine', () => {
  it('flat baseline is unchanged when all C fields are off', async () => {
    RATE_CARD = card();
    const q = await quote(mon, plusDays(5));
    expect(q.baseAmountCents).toBe(50000);
    expect(q.cleaningFeeCents).toBe(0);
    expect(q.depositCents).toBe(0);
    expect(q.peakSurchargeCents).toBe(0);
    expect(q.subtotalCents).toBe(50000);
  });

  it('cleaning fee adds once after discounts; deposit is a separate hold (not in total)', async () => {
    RATE_CARD = card({ cleaningFeeCents: 8000, securityDepositPercent: 20 });
    const q = await quote(mon, plusDays(5));
    expect(q.cleaningFeeCents).toBe(8000);
    expect(q.subtotalCents).toBe(58000); // 50000 + 8000
    expect(q.depositCents).toBe(11600); // 20% of 58000 — HELD, not charged
    const expectedTotal = 58000 + Math.round(Math.round(58000 * COMMISSION) * VAT);
    expect(q.totalCents).toBe(expectedTotal);
  });

  it('bi-weekly discount applies for 14–29 nights (between weekly and monthly)', async () => {
    RATE_CARD = card({ biweeklyDiscountPercent: 10, weeklyDiscountPercent: 5, monthlyDiscountPercent: 15 });
    const q = await quote(mon, plusDays(14));
    expect(q.baseAmountCents).toBe(140000);
    expect(q.durationDiscountCents).toBe(14000); // 10% of base, not weekly/monthly
  });

  it('tiered nightly progression prices each night by its stay-length bucket', async () => {
    RATE_CARD = card({ nightlyRateProgression: { night1Percent: 110, nights2to7Percent: 100, nights8to30Percent: 85 } });
    const q = await quote(mon, plusDays(10));
    // night1 11000 + nights2-7 (6×10000=60000) + nights8-10 (3×8500=25500) = 96500
    expect(q.baseAmountCents).toBe(96500);
  });

  it('per-day peak surcharge applies for each night in a peak range', async () => {
    RATE_CARD = card({ peakDateRanges: [{ start: '2026-07-06', end: '2026-07-08', surchargePercent: 50 }] });
    const q = await quote(new Date('2026-07-06T12:00:00Z'), new Date('2026-07-09T12:00:00Z'));
    // 3 nights (Jul 6,7,8) all in range → 3 × (10000×50%) = 15000
    expect(q.peakSurchargeCents).toBe(15000);
  });
});
