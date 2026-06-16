/**
 * Proximity must be enforced at BOOKING, not just search. The checkout route now
 * re-checks haversine distance between customer and provider, FAIL-OPEN: it only
 * rejects when BOTH have coords AND distance exceeds the provider's radius —
 * never blocks a booking just because coordinates are missing.
 *
 * Source-introspection (the handler is DB/auth-bound).
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const src = fs.readFileSync(
  path.resolve(__dirname, '..', 'routes', 'marketplace-bookings.ts'),
  'utf8',
);
const start = src.indexOf('Proximity guard at booking');
const region = src.slice(start, start + 4000);

describe('proximity guard at booking', () => {
  it('exists in the checkout flow and reuses haversineKm', () => {
    expect(start).toBeGreaterThan(-1);
    expect(src).toMatch(/import \{ haversineKm \} from '\.\.\/utils\/providerSearch'/);
    expect(region).toMatch(/haversineKm\(/);
  });
  it('FAILS OPEN — skips when coords are missing (never blocks on missing geocoding)', () => {
    expect(region).toMatch(/some\(Number\.isNaN\)/);
    expect(region).toMatch(/skipped — missing coords \(fail open\)/);
  });
  it('rejects 422 OUT_OF_SERVICE_AREA only when too far', () => {
    expect(region).toMatch(/status\(422\)/);
    expect(region).toMatch(/OUT_OF_SERVICE_AREA/);
  });
  it('uses the walker service radius with a buffer for geocoding imprecision', () => {
    expect(region).toMatch(/walkerProfiles\.serviceRadiusKm/);
    expect(region).toMatch(/BUFFER/);
  });
});
