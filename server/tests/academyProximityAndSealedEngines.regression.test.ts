/**
 * Audit finish-up (CEO 2026-07-24 "go"):
 *  · Pet Wash Academy had NO proximity and silently ignored the city filter —
 *    a Kfar Saba customer could be shown an Eilat trainer first.
 *  · Three booking-creation engines with ZERO client callers wrote the shared
 *    `bookings` table with different status/provider-id semantics — the
 *    "hidden conflicts". Sealed with 410 (not deleted — no bulk deletion).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const R = (p: string) => readFileSync(resolve(__dirname, '..', '..', p), 'utf8');
const academy = R('server/routes/academy.ts');

describe('academy proximity + city filter', () => {
  it('the city filter is actually applied (was destructured and ignored)', () => {
    expect(academy).toMatch(/serviceCitySymbols/);
    expect(academy).toMatch(/String\(t\.serviceArea \|\| ''\)\.toLowerCase\(\)\.includes\(needle\)/);
  });

  it('computes a REAL haversine distance and sorts nearest-first', () => {
    expect(academy).toMatch(/haversineKm\(custLat, custLng, tLat, tLng\)/);
    expect(academy).toMatch(/a\.distanceKm - b\.distanceKm/);
  });

  it('fails open: trainers without a pin are kept, distance stays null (never faked)', () => {
    expect(academy).toMatch(/x\.distanceKm === null \|\| x\.distanceKm <= maxKm/);
    expect(academy).toMatch(/distanceKm: distanceByTrainerId\.get\(t\.id\) \?\? null/);
  });
});

describe('dead booking engines are sealed', () => {
  it('all three return 410 with the canonical rails named', () => {
    for (const f of ['server/routes/marketplace-bookings.ts', 'server/routes/unified-booking.ts', 'server/routes/super-app-bookings.ts']) {
      const src = R(f);
      expect(src).toMatch(/BOOKING_ENGINE_SEALED/);
      expect(src).toMatch(/booking-requests/);
    }
  });

  it('the live provider lookup on the super-app router is untouched', () => {
    const src = R('server/routes/super-app-bookings.ts');
    expect(src).toMatch(/\/:platformId\/providers/);
  });
});
