/**
 * CEO §12 (2026-08-28) — the safety wire must reach the walker's Today card.
 *
 * Companion to bookingPetSafetySnapshot.regression.test.ts (which pins
 * PERSISTENCE onto walk_bookings + sitter_bookings). This one pins the
 * READ side:
 *
 *   (a) legacyBookingBridge accepts + writes petDetails onto the mirror
 *       (booking_requests.pet_details) — otherwise the mirror row that
 *       the walker's inbox actually reads is empty, and the safety flags
 *       stop at the customer-side row.
 *   (b) the two walk-my-pet caller sites (walker create) pass petDetails
 *       containing `safety: safeSnapshot`.
 *   (c) the sitter-suite caller site does the same.
 *   (d) /walker/requests and /walker/active surface `petSafety` in the
 *       JSON response so the client Today card can render it.
 *
 * Rename or drop any link and CI fails.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const R = (rel: string) =>
  fs.readFileSync(path.resolve(__dirname, '..', 'routes', rel), 'utf8');
const S = (rel: string) =>
  fs.readFileSync(path.resolve(__dirname, '..', 'services', rel), 'utf8');

describe('booking safety wire — persistence → bridge → walker inbox (CEO §12)', () => {
  describe('legacyBookingBridge writes petDetails onto the mirror', () => {
    const src = S('legacyBookingBridge.ts');
    it('declares an optional petDetails input', () => {
      expect(src).toMatch(/petDetails\?:\s*Record<string, unknown>\s*\|\s*null/);
    });
    it('rejects arrays / primitives (safe object shape only)', () => {
      expect(src).toMatch(/safePetDetails/);
      expect(src).toMatch(/typeof input\.petDetails === 'object' && !Array\.isArray/);
    });
    it('writes petDetails: safePetDetails into the bookingRequests insert', () => {
      expect(src).toMatch(/petDetails:\s*safePetDetails/);
    });
  });

  describe('walk-my-pet booking route passes safety into petDetails', () => {
    const src = R('walk-my-pet.ts');
    it('the bridge call includes petDetails.safety = safeSnapshot', () => {
      // Anchor to the bridgeLegacyBooking call — find the closest call
      // and confirm the petDetails block includes safety: safeSnapshot.
      const bridgeCallIdx = src.indexOf("legacyRef: { table: 'walk_bookings'");
      expect(bridgeCallIdx).toBeGreaterThan(0);
      // The petDetails argument sits within the same options object.
      const window = src.slice(Math.max(0, bridgeCallIdx - 800), bridgeCallIdx + 800);
      expect(window).toMatch(/petDetails:\s*\{/);
      expect(window).toMatch(/safety:\s*safeSnapshot/);
    });
  });

  describe('sitter-suite booking route passes safety into petDetails', () => {
    const src = R('sitter-suite.ts');
    it('the bridge call includes petDetails.safety = safeSnapshot', () => {
      const bridgeCallIdx = src.indexOf("legacyRef: { table: 'sitter_bookings'");
      expect(bridgeCallIdx).toBeGreaterThan(0);
      const window = src.slice(Math.max(0, bridgeCallIdx - 800), bridgeCallIdx + 800);
      expect(window).toMatch(/petDetails:\s*\{/);
      expect(window).toMatch(/safety:\s*safeSnapshot/);
    });
  });

  describe('walker inbox reads the safety block back out', () => {
    const src = R('walk-my-pet.ts');
    it('/walker/requests exposes petSafety in the JSON response', () => {
      // Isolate the /walker/requests block so a match in /walker/active
      // can't accidentally satisfy this assertion.
      const requestsBlock = src.slice(
        src.indexOf("router.get('/walker/requests'"),
        src.indexOf("router.get('/walker/active'"),
      );
      expect(requestsBlock).toMatch(/petSafety:\s*\(r\.petDetails as any\)\?\.safety\s*\?\?\s*null/);
    });
    it('/walker/active exposes petSafety in the JSON response', () => {
      const activeStart = src.indexOf("router.get('/walker/active'");
      const activeEnd   = src.indexOf("router.get('/walker/completed'", activeStart);
      expect(activeStart).toBeGreaterThan(0);
      expect(activeEnd).toBeGreaterThan(activeStart);
      const activeBlock = src.slice(activeStart, activeEnd);
      expect(activeBlock).toMatch(/petSafety:\s*\(active\.petDetails as any\)\?\.safety\s*\?\?\s*null/);
    });
  });
});
