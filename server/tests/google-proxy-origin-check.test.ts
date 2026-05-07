/**
 * Issue #153 Mission 5 PR-A — Google proxy origin-check regression pin.
 *
 * Before this fix:
 *   - /api/google/places-autocomplete called isAllowedPlacesOrigin() at
 *     line 339 ✓
 *   - /api/google/places-details DID NOT call isAllowedPlacesOrigin()
 *     (line 506 jumped from placesDetailsLimiter straight to handler
 *     logic) — external callers could enumerate placeIds through
 *     PetWash's Google API key budget.
 *   - /api/google/reverse-geocode DID NOT call isAllowedPlacesOrigin()
 *     (line 654 same pattern) — external callers could reverse-geocode
 *     arbitrary lat/lng pairs through PetWash's budget.
 *
 * After this fix: all three customer-facing Google proxy endpoints run
 * the origin allowlist before ANY billable Google API call.
 *
 * This source-pin test fails if any of the three handlers loses its
 * isAllowedPlacesOrigin call OR if a future endpoint ships without one.
 */

import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const SRC = fs.readFileSync(
  path.resolve(__dirname, '..', 'routes', 'google-services.ts'),
  'utf8',
);

/**
 * Slice the body of a router handler from `router.<verb>('<path>', ...) =>`
 * up to the next top-level `router.` declaration. Used to scope assertions
 * to a specific handler so we don't accidentally pass on a sibling's check.
 */
function sliceHandler(verb: string, routePath: string): string {
  const needle = new RegExp(`router\\.${verb}\\(\\s*['"]${routePath.replace(/\//g, '\\/')}['"]`);
  const start = SRC.search(needle);
  if (start < 0) return '';
  // Find the next `\nrouter.` after the start (handler boundary).
  const next = SRC.indexOf('\nrouter.', start + 50);
  return SRC.slice(start, next > 0 ? next : start + 6000);
}

describe('Google proxy origin-check coverage — Issue #153 Mission 5 PR-A', () => {
  it('isAllowedPlacesOrigin is defined and exported within this module', () => {
    expect(SRC).toMatch(/function isAllowedPlacesOrigin\(req:/);
  });

  it('/places-autocomplete still runs isAllowedPlacesOrigin (no regression)', () => {
    const block = sliceHandler('get', '/places-autocomplete');
    expect(block.length).toBeGreaterThan(0);
    expect(block).toMatch(/if\s*\(\s*!isAllowedPlacesOrigin\(\s*req\s*\)\s*\)/);
    expect(block).toMatch(/reasonCode:\s*['"]ORIGIN_NOT_ALLOWED['"]/);
  });

  it('/places-details now runs isAllowedPlacesOrigin (NEW guard)', () => {
    const block = sliceHandler('get', '/places-details');
    expect(block.length).toBeGreaterThan(0);
    expect(block).toMatch(/if\s*\(\s*!isAllowedPlacesOrigin\(\s*req\s*\)\s*\)/);
    expect(block).toMatch(/reasonCode:\s*['"]ORIGIN_NOT_ALLOWED['"]/);
  });

  it('/reverse-geocode now runs isAllowedPlacesOrigin (NEW guard)', () => {
    const block = sliceHandler('get', '/reverse-geocode');
    expect(block.length).toBeGreaterThan(0);
    expect(block).toMatch(/if\s*\(\s*!isAllowedPlacesOrigin\(\s*req\s*\)\s*\)/);
    expect(block).toMatch(/reasonCode:\s*['"]ORIGIN_NOT_ALLOWED['"]/);
  });

  it('all three customer-facing Google handlers return 403 with the same shape on rejection', () => {
    for (const route of ['/places-autocomplete', '/places-details', '/reverse-geocode']) {
      const block = sliceHandler('get', route);
      expect(block).toMatch(/return\s+res\.status\(403\)\.json\(\s*\{\s*error:\s*['"]Forbidden['"]/);
    }
  });

  it('the origin check fires BEFORE any GOOGLE_MAPS_API_KEY read in places-details', () => {
    const block = sliceHandler('get', '/places-details');
    const guardIdx = block.indexOf('isAllowedPlacesOrigin');
    const keyIdx = block.indexOf('GOOGLE_MAPS_API_KEY');
    expect(guardIdx).toBeGreaterThan(0);
    expect(keyIdx).toBeGreaterThan(0);
    expect(guardIdx).toBeLessThan(keyIdx);
  });

  it('the origin check fires BEFORE any GOOGLE_MAPS_API_KEY read in reverse-geocode', () => {
    const block = sliceHandler('get', '/reverse-geocode');
    const guardIdx = block.indexOf('isAllowedPlacesOrigin');
    const keyIdx = block.indexOf('GOOGLE_MAPS_API_KEY');
    expect(guardIdx).toBeGreaterThan(0);
    expect(keyIdx).toBeGreaterThan(0);
    expect(guardIdx).toBeLessThan(keyIdx);
  });

  it('the production allowlist remains strict (no widening in this PR)', () => {
    // Anchor the canonical allowlist values so a future PR that widens
    // the allowlist for a non-PetWash domain trips this test.
    const allowlistMatch = SRC.match(
      /return\s*\[\s*\n[\s\S]{0,400}'petwash\.co\.il'[\s\S]{0,400}'signinpetwash\.firebaseapp\.com'/,
    );
    expect(allowlistMatch).toBeTruthy();
  });

  it('Israel-only enforcement (includedRegionCodes) is still hardcoded in places-autocomplete', () => {
    // Defensive: confirm this PR did NOT accidentally regress the
    // Israel-region lock that lives in the autocomplete handler.
    const block = sliceHandler('get', '/places-autocomplete');
    expect(block).toMatch(/includedRegionCodes:\s*regionCodes/);
    expect(block).toMatch(/PLACES_ALLOW_NON_IL/);
  });
});
