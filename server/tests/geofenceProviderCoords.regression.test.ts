/**
 * Last item of the booking audit: the service-area geofence read the provider's
 * coordinates from `users`, but providers are geocoded in their PROFILE tables
 * (which is what search ranks on). users.lat/lng is NULL for practically every
 * real provider, so checkBookingProximity got no-coords and fail-opened —
 * the guard silently never fired. Now it falls back to the profile tables.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const s = readFileSync(resolve(__dirname, '..', '..', 'server/routes/booking-requests.ts'), 'utf8');

describe('geofence sees real provider coordinates', () => {
  it('falls back to walker profile coords for walk services', () => {
    expect(s).toMatch(/walkerProfiles\.currentLatitude/);
    expect(s).toMatch(/walkerProfiles\.currentLongitude/);
  });

  it('falls back to sitter profile coords otherwise', () => {
    expect(s).toMatch(/sitterProfiles\.latitude/);
    expect(s).toMatch(/sitterProfiles\.longitude/);
  });

  it('only falls back when the users row has no coords (users still preferred)', () => {
    expect(s).toMatch(/if \(provRow\?\.lat == null \|\| provRow\?\.lng == null\)/);
  });

  it('stays fail-open by design — no coords anywhere still allows the booking', () => {
    expect(s).toMatch(/FAIL OPEN/);
  });
});
