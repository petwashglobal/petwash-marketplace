/**
 * Walk booking now enforces the walker's service area instead of a hardcoded 5km.
 * Uses the shared checkBookingProximity (fail-open on missing coords, env-toggle),
 * rejects out-of-range with 422 OUT_OF_RANGE, and stores the REAL distance.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
const SRC = readFileSync(resolve(__dirname, '..', 'routes', 'walk-my-pet.ts'), 'utf8');

describe('walk booking proximity enforcement', () => {
  it('no longer hardcodes distanceKm = 5 before the check', () => {
    expect(SRC).not.toMatch(/const distanceKm = 5; \/\/ Most walks are local/);
  });
  it('runs checkBookingProximity on pickup vs walker radius and rejects OUT_OF_RANGE', () => {
    expect(SRC).toMatch(/checkBookingProximity\(\{[^]*providerLat: walkerProfile\.currentLatitude/);
    expect(SRC).toMatch(/maxKm: walkerProfile\.serviceRadiusKm/);
    expect(SRC).toMatch(/if \(!proximity\.ok\)/);
    expect(SRC).toMatch(/OUT_OF_RANGE/);
    expect(SRC).toMatch(/const distanceKm = proximity\.distanceKm \?\? 5/);
  });
});
