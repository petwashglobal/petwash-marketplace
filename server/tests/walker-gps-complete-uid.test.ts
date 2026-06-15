/**
 * Walk /gps and /complete: resolve the walker profile before the owner check.
 *
 * walkBookings.walkerId stores the walker PROFILE id (WALKER-…), not the Firebase
 * uid. The /gps and /complete handlers compared `booking.walkerId !== callerId`
 * (profile id vs uid) — which NEVER matches, so the real walker was always 403'd
 * and could not stream GPS or complete the walk. (/confirm already does the
 * correct walkerProfiles.userId lookup.)
 *
 * Fix: resolve walkerProfiles by booking.walkerId and compare its userId to the
 * caller. Source-introspection guard.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const src = fs.readFileSync(
  path.resolve(__dirname, '..', 'routes', 'walk-my-pet.ts'),
  'utf8',
);

describe('walk /gps + /complete — walker ownership via profile lookup', () => {
  it('no longer compares booking.walkerId directly to the caller uid', () => {
    expect(src).not.toMatch(/if \(booking\.walkerId !== callerId\)/);
  });

  it('resolves walkerProfiles.userId and compares THAT to the caller (both handlers)', () => {
    const matches = src.match(/walkerRow\.userId !== callerId/g) || [];
    expect(matches.length).toBeGreaterThanOrEqual(2); // /gps and /complete
    expect(src).toMatch(/\.where\(eq\(walkerProfiles\.walkerId, booking\.walkerId\)\)/);
  });
});
