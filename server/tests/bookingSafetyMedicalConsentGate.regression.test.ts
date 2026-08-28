/**
 * CEO §22 (2026-08-28) — medical fields in petSafetySnapshot are
 * gated on medicalShareConsent.
 *
 * The safety snapshot ships from client to walker Today card (see
 * bookingPetSafetySnapshot.regression.test.ts + bookingSafetyBridgeExposure
 * .regression.test.ts for the persistence + exposure halves). The SAFETY
 * subset — aggression, escape risk, behaviour, feeding, handling —
 * protects the walker from physical harm and must go every time. But the
 * MEDICAL subset — allergies, medications, vet name, vet phone — is
 * private health information about the pet, and must ONLY leave the
 * owner's browser when medicalShareConsent === true.
 *
 * Server already applies this gate at the availability engine
 * (sitter-suite.ts line ~820). This test pins the SAME gate at both
 * booking-create call sites so the two paths behave identically.
 *
 * A refactor that unconditionally spreads the medical fields into the
 * snapshot leaks pet medical data to unauthorized walkers and trips
 * this test.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const WALK   = fs.readFileSync(path.resolve(__dirname, '..', '..', 'client', 'src', 'pages', 'walk-my-pet',   'BookingFlow.tsx'), 'utf8');
const SITTER = fs.readFileSync(path.resolve(__dirname, '..', '..', 'client', 'src', 'pages', 'sitter-suite', 'BookingFlow.tsx'), 'utf8');

describe('petSafetySnapshot medical fields are gated on medicalShareConsent (CEO §22)', () => {
  for (const [name, src] of [['walk-my-pet', WALK], ['sitter-suite', SITTER]] as const) {
    describe(`${name}/BookingFlow.tsx`, () => {
      it('reads medicalShareConsent off the primary pet', () => {
        expect(src).toMatch(/const medicalConsented = primaryPet\?\.medicalShareConsent === true/);
      });

      it('signals medicalConsented in the snapshot payload', () => {
        // So the walker's Today card can render "medical data
        // withheld — ask owner" instead of assuming an empty allergies
        // string means "no allergies".
        expect(src).toMatch(/medicalConsented,/);
      });

      it('conditionally spreads allergies / medications / vet fields only under consent', () => {
        expect(src).toMatch(/\.\.\.\(medicalConsented \? \{/);
        // The four medical fields must live INSIDE the conditional
        // spread. Anchor to the medicalConsented spread block.
        const spreadIdx = src.indexOf('...(medicalConsented ? {');
        expect(spreadIdx).toBeGreaterThan(0);
        // The spread ends at the closing brace of the ternary.
        const blockEnd  = src.indexOf('} : {}),', spreadIdx);
        expect(blockEnd).toBeGreaterThan(spreadIdx);
        const block = src.slice(spreadIdx, blockEnd);
        expect(block).toMatch(/allergies:/);
        expect(block).toMatch(/medicationNotes:/);
        expect(block).toMatch(/vetName:/);
        expect(block).toMatch(/vetPhone:/);
      });

      it('the four medical fields are NOT written unconditionally (no bare key: primaryPet?.field)', () => {
        // Search for the medical keys assigned WITHOUT the conditional
        // spread wrapping them. A regression that removes the spread
        // would put e.g. `allergies: primaryPet?.allergies ?? ''` on a
        // top-level line — which is exactly what we ban.
        const spreadIdx = src.indexOf('...(medicalConsented ? {');
        const blockEnd  = src.indexOf('} : {}),', spreadIdx);
        const outside   = src.slice(0, spreadIdx) + src.slice(blockEnd);
        // Restrict the check to the petSafetySnapshot literal to avoid
        // false positives from unrelated code that just happens to
        // read allergies elsewhere.
        const snapIdx = outside.indexOf('const petSafetySnapshot');
        const snapEnd = outside.indexOf('};', snapIdx);
        const snap = outside.slice(snapIdx, snapEnd);
        for (const key of ['allergies:', 'medicationNotes:', 'vetName:', 'vetPhone:']) {
          expect(snap).not.toContain(key);
        }
      });
    });
  }
});
