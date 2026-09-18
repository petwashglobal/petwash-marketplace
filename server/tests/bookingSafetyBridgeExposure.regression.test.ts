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
import { readFileSync } from 'fs';
import { resolve } from 'path';

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
    // 2026-09-18: these demanded the stored block be handed to the walker
    // RAW — `petSafety: (r.petDetails as any)?.safety ?? null`. It is now
    // re-projected through projectStoredSafetyForProvider against the owner's
    // CURRENT consent, so medical fields (allergies, medication notes, vet
    // name and phone) disappear from the response if the owner withdrew
    // consent after the booking was made. The snapshot is a point-in-time
    // copy; consent is not. The pins were asserting the leak.
    it('/walker/requests exposes petSafety, re-checked against CURRENT consent', () => {
      const requestsBlock = src.slice(
        src.indexOf("router.get('/walker/requests'"),
        src.indexOf("router.get('/walker/active'"),
      );
      expect(requestsBlock).toMatch(/projectStoredSafetyForProvider\(stored, canonicalPet\)/);
      expect(requestsBlock).toMatch(/\n\s*petSafety,/);
      // Never the raw stored block.
      expect(requestsBlock).not.toMatch(/petSafety:\s*\([a-z]+\.petDetails as any\)\?\.safety/);
    });
    it('/walker/active exposes petSafety, re-checked against CURRENT consent', () => {
      const activeStart = src.indexOf("router.get('/walker/active'");
      const activeEnd   = src.indexOf("router.get('/walker/completed'", activeStart);
      expect(activeStart).toBeGreaterThan(0);
      expect(activeEnd).toBeGreaterThan(activeStart);
      const activeBlock = src.slice(activeStart, activeEnd);
      // Imported under a local alias here (projActive), so match the import
      // rather than the call name.
      expect(activeBlock).toMatch(/projectStoredSafetyForProvider: projActive/);
      expect(activeBlock).toMatch(/projActive\(\(active\.petDetails as any\)\?\.safety \?\? null, activeCanonicalPet\)/);
      expect(activeBlock).toMatch(/petSafety:\s*activePetSafety/);
      expect(activeBlock).not.toMatch(/petSafety:\s*\([a-z]+\.petDetails as any\)\?\.safety/);
    });
    it('the projector strips every medical field when consent is gone', () => {
      const priv = readFileSync(resolve(__dirname, '..', 'lib', 'petPrivacy.ts'), 'utf8');
      const fn = priv.slice(priv.indexOf('export function projectStoredSafetyForProvider'));
      expect(fn).toMatch(/providerHasMedicalConsent\(canonicalPetOrNull\)/);
      for (const field of ['allergies', 'medicationNotes', 'vetName', 'vetPhone']) {
        expect(fn).toContain(`delete s.${field};`);
      }
      expect(fn).toMatch(/s\.medicalConsented = false/);
    });
  });
});
