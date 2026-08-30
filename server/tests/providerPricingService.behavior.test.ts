/**
 * ProviderPricingService — Program 22.
 *
 * Doctrine: NO universal pricePerHour assumption. Every dimension
 * either has a declared rate OR the evaluator refuses to guess.
 */
import { describe, it, expect } from 'vitest';
import { priceBooking } from '../services/marketplace/ProviderPricingService';

describe('ProviderPricingService', () => {
  it('per-walk with a single pet → BASE_WALK only', () => {
    const r = priceBooking({
      rateModel: { kind: 'PER_WALK', baseCents: 6500 },
      petCount: 1,
    });
    expect(r.code).toBe('OK');
    if (r.code !== 'OK') throw new Error();
    expect(r.lines).toEqual([{ code: 'BASE_WALK', amountCents: 6500 }]);
    expect(r.totalCents).toBe(6500);
  });

  it('per-walk with 2 pets AND no ADDITIONAL_PET declared → PRICING_INCOMPLETE (never silent zero)', () => {
    const r = priceBooking({
      rateModel: { kind: 'PER_WALK', baseCents: 6500 },
      petCount: 2,
    });
    expect(r.code).toBe('PRICING_INCOMPLETE');
    if (r.code !== 'PRICING_INCOMPLETE') throw new Error();
    expect(r.missingDimension).toBe('ADDITIONAL_PET');
  });

  it('per-walk with 3 pets AND declared ADDITIONAL_PET → 2 additional-pet lines rolled into one line', () => {
    const r = priceBooking({
      rateModel: { kind: 'PER_WALK', baseCents: 6500 },
      addOns: [{ code: 'ADDITIONAL_PET', amountCents: 2000 }],
      petCount: 3,
    });
    expect(r.code).toBe('OK');
    if (r.code !== 'OK') throw new Error();
    expect(r.totalCents).toBe(6500 + 2 * 2000);
    const addLine = r.lines.find((l) => l.code === 'ADDITIONAL_PET');
    expect(addLine?.units).toBe(2);
  });

  it('per-duration without durationMinutes → PRICING_INCOMPLETE(DURATION_MINUTES)', () => {
    const r = priceBooking({
      rateModel: { kind: 'PER_DURATION', perMinuteCents: 200 },
      petCount: 1,
    });
    expect(r.code).toBe('PRICING_INCOMPLETE');
    if (r.code !== 'PRICING_INCOMPLETE') throw new Error();
    expect(r.missingDimension).toBe('DURATION_MINUTES');
  });

  it('per-duration enforces minMinutes', () => {
    const r = priceBooking({
      rateModel: { kind: 'PER_DURATION', perMinuteCents: 200, minMinutes: 30 },
      durationMinutes: 20,
      petCount: 1,
    });
    expect(r.code).toBe('OK');
    if (r.code !== 'OK') throw new Error();
    expect(r.totalCents).toBe(30 * 200);
  });

  it('per-night 3 nights → total = 3 × perNightCents', () => {
    const r = priceBooking({
      rateModel: { kind: 'PER_NIGHT', perNightCents: 18000 },
      nights: 3,
      petCount: 1,
    });
    expect(r.code).toBe('OK');
    if (r.code !== 'OK') throw new Error();
    expect(r.totalCents).toBe(54000);
  });

  it('applied add-on not in the provider catalog → PRICING_INCOMPLETE(ADDON_CODE)', () => {
    const r = priceBooking({
      rateModel: { kind: 'PER_WALK', baseCents: 6500 },
      petCount: 1,
      appliedAddOns: [{ code: 'MEDICATION' }],
    });
    expect(r.code).toBe('PRICING_INCOMPLETE');
    if (r.code !== 'PRICING_INCOMPLETE') throw new Error();
    expect(r.missingDimension).toBe('MEDICATION');
  });

  it('applied add-on with units multiplies rate', () => {
    const r = priceBooking({
      rateModel: { kind: 'PER_WALK', baseCents: 6500 },
      petCount: 1,
      addOns: [{ code: 'DISTANCE_KM', amountCents: 200 }],
      appliedAddOns: [{ code: 'DISTANCE_KM', units: 8 }],
    });
    expect(r.code).toBe('OK');
    if (r.code !== 'OK') throw new Error();
    const line = r.lines.find((l) => l.code === 'DISTANCE_KM');
    expect(line?.amountCents).toBe(8 * 200);
    expect(line?.units).toBe(8);
  });

  it('holiday flag WITHOUT a declared HOLIDAY_SURCHARGE → no surcharge (evaluator does not invent)', () => {
    const r = priceBooking({
      rateModel: { kind: 'PER_WALK', baseCents: 6500 },
      petCount: 1,
      isHoliday: true,
    });
    expect(r.code).toBe('OK');
    if (r.code !== 'OK') throw new Error();
    expect(r.lines.some((l) => l.code === 'HOLIDAY_SURCHARGE')).toBe(false);
    expect(r.totalCents).toBe(6500);
  });

  it('holiday flag WITH declared HOLIDAY_SURCHARGE → surcharge added', () => {
    const r = priceBooking({
      rateModel: { kind: 'PER_WALK', baseCents: 6500 },
      addOns: [{ code: 'HOLIDAY_SURCHARGE', amountCents: 3000 }],
      petCount: 1,
      isHoliday: true,
    });
    expect(r.code).toBe('OK');
    if (r.code !== 'OK') throw new Error();
    expect(r.totalCents).toBe(6500 + 3000);
  });
});
