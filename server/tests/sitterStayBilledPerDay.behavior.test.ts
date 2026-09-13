/**
 * Sitter Suite stays are billed per calendar day, not per hour (2026-09-13).
 *
 * POST /api/sitter-suite/bookings prices with serviceType 'pet_sitting'. The
 * engine only recognised 'Boarding' / 'boarding' / 'House Sitting' as overnight,
 * so every real Sitter Suite stay took the HOURLY branch:
 *   sitter ₪450/day + ₪60/hour, 48h stay → 48 × ₪60 = ₪2,880 (should be ₪900).
 * With no hourly rate it used ₪450/24 per clock hour, ignoring calendar days.
 * A same-day stay counted 0 calendar days — a ₪0 booking.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const sitterRow: Record<string, unknown> = {};
vi.mock('../db', () => ({
  db: { query: { sitterProfiles: { findFirst: async () => ({ ...sitterRow }) } } },
}));
vi.mock('../lib/logger', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }));
vi.mock('../services/SitterGlobalConfig', () => ({
  globalConfig: {
    getLocalSettings: () => ({ currency: 'ILS', taxRate: 0.18 }),
    isHolidayPeriod: () => false,
    getCommissionRate: () => 0.15,
  },
}));

import { advancedBookingEngine } from '../services/SitterAdvancedBookingEngine';

// Jerusalem is UTC+2 in November.
const at = (iso: string) => new Date(iso);

async function quote(serviceType: string, start: string, end: string) {
  return (advancedBookingEngine as any).calculatePrice('7', serviceType, at(start), at(end), '127.0.0.1', 'owner-1');
}

beforeEach(() => {
  for (const k of Object.keys(sitterRow)) delete sitterRow[k];
  Object.assign(sitterRow, { id: 7, pricePerDayCents: 45000, pricePerHourCents: 6000 });
});

describe('pet_sitting (the Sitter Suite booking) bills per calendar day', () => {
  it('48h stay at ₪450/day + ₪60/h → ₪900, not ₪2,880', async () => {
    const p = await quote('pet_sitting', '2026-11-10T08:00:00Z', '2026-11-12T08:00:00Z');
    expect(p.duration).toBe(2);
    expect(p.subtotal).toBe(900);
    expect(p.totalPrice).toBe(900);
  });

  it('a 16h overnight (crosses midnight) is one day, not 16 hours', async () => {
    const p = await quote('pet_sitting', '2026-11-10T16:00:00Z', '2026-11-11T08:00:00Z');
    expect(p.subtotal).toBe(450);
  });

  it('a same-day stay is one day, never ₪0', async () => {
    const p = await quote('pet_sitting', '2026-11-10T07:00:00Z', '2026-11-10T15:00:00Z');
    expect(p.duration).toBe(1);
    expect(p.subtotal).toBe(450);
  });

  it('a sitter with only a day rate is still billed per day', async () => {
    sitterRow.pricePerHourCents = null;
    const p = await quote('pet_sitting', '2026-11-10T08:00:00Z', '2026-11-13T08:00:00Z');
    expect(p.subtotal).toBe(1350);
  });

  it('commission stays 15% of the stay (sitter nets 85%)', async () => {
    const p = await quote('pet_sitting', '2026-11-10T08:00:00Z', '2026-11-12T08:00:00Z');
    expect(p.platformFee).toBeCloseTo(135, 6);
    expect(p.sitterPayout).toBeCloseTo(765, 6);
  });
});

describe('unchanged: genuinely hourly services stay hourly', () => {
  it('a 3h drop-in bills 3 × ₪60', async () => {
    const p = await quote('drop_in', '2026-11-10T08:00:00Z', '2026-11-10T11:00:00Z');
    expect(p.subtotal).toBe(180);
  });

  it('Boarding keeps per-day billing', async () => {
    const p = await quote('Boarding', '2026-11-10T08:00:00Z', '2026-11-12T08:00:00Z');
    expect(p.subtotal).toBe(900);
  });
});
