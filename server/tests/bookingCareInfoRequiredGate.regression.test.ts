/**
 * CEO §5 (2026-08-28) — CARE INFORMATION REQUIRED gate.
 *
 * Some services HARD-REQUIRE medical data to run safely: medicated
 * walks, senior-pet support, sick-pet day-care, medication
 * administration for the sitter suite. If the owner has not shared
 * medical (account preference is silent AND booking-scoped share is
 * off, OR the pet is marked medicalDataPrivate=true as a hard veto),
 * the booking MUST NOT proceed to the availability engine — the
 * provider would take on the pet blind to allergies / medications / vet
 * contact, which is exactly the safety failure §5 was written to
 * prevent.
 *
 * Fail-CLOSED with a stable errorCode CARE_INFO_REQUIRED so the client
 * can render the pre-confirm banner asking for consent or a different
 * service. Pinned in both booking-creation routes.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const WALK_SRC = fs.readFileSync(
  path.resolve(__dirname, '..', 'routes', 'walk-my-pet.ts'),
  'utf8',
);
const SITTER_SRC = fs.readFileSync(
  path.resolve(__dirname, '..', 'routes', 'sitter-suite.ts'),
  'utf8',
);

describe('booking creation — CARE_INFO_REQUIRED gate (CEO §5)', () => {
  it('walk-my-pet REJECTS the booking with 400 CARE_INFO_REQUIRED', () => {
    expect(WALK_SRC).toMatch(/if \(serviceRequiresMedical && safeSnapshot && \(safeSnapshot as any\)\.medicalConsented !== true\)/);
    expect(WALK_SRC).toMatch(/return res\.status\(400\)\.json\(\{[\s\S]*?errorCode:\s*'CARE_INFO_REQUIRED'/);
  });

  it('walk-my-pet gate runs BEFORE any availability / pricing branch', () => {
    // A refactor that moved the availability engine ABOVE this check
    // would silently let unauthorized-medical bookings hit price
    // discovery + walker matching, wasting engine cycles and racing the
    // reject window. Pin the check ahead of "Validate required fields".
    const gateIdx = WALK_SRC.indexOf("errorCode: 'CARE_INFO_REQUIRED'");
    const validateIdx = WALK_SRC.indexOf("'Missing required booking information'");
    expect(gateIdx).toBeGreaterThan(0);
    expect(validateIdx).toBeGreaterThan(gateIdx);
  });

  it('sitter-suite REJECTS the booking with 400 CARE_INFO_REQUIRED', () => {
    expect(SITTER_SRC).toMatch(/if \(serviceRequiresMedical && safeSnapshot && \(safeSnapshot as any\)\.medicalConsented !== true\)/);
    expect(SITTER_SRC).toMatch(/return res\.status\(400\)\.json\(\{[\s\S]*?errorCode:\s*'CARE_INFO_REQUIRED'/);
  });

  it('sitter-suite gate runs BEFORE the availability engine call', () => {
    // Same discipline as walk-my-pet: reject before checkAvailability
    // spends work.
    const gateIdx = SITTER_SRC.indexOf("errorCode: 'CARE_INFO_REQUIRED'");
    const availIdx = SITTER_SRC.indexOf('sitterAdvancedBookingEngine.checkAvailability');
    expect(gateIdx).toBeGreaterThan(0);
    expect(availIdx).toBeGreaterThan(gateIdx);
  });

  it('both routes use IDENTICAL error copy — one place for i18n / friendly-map', () => {
    // The client friendly-map for /apply already has a fixed HE/EN
    // copy per errorCode. Booking routes should share the same
    // convention: one code, one canonical EN message. A refactor that
    // customized either message would fragment the copy.
    const walkMatch = WALK_SRC.match(/error:\s*'This service requires medical information to be shared for the booking\.',\s*\n\s*errorCode:\s*'CARE_INFO_REQUIRED'/);
    const sitterMatch = SITTER_SRC.match(/error:\s*'This service requires medical information to be shared for the booking\.',\s*\n\s*errorCode:\s*'CARE_INFO_REQUIRED'/);
    expect(walkMatch).not.toBeNull();
    expect(sitterMatch).not.toBeNull();
  });

  it('gate depends on the SERVER-BUILT snapshot — never on the client-supplied medicalConsented', () => {
    // The check reads (safeSnapshot as any).medicalConsented, which is
    // the value buildServerSafetySnapshot computed under the three
    // authoritative consent sources. A refactor that read req.body's
    // medicalConsented (a client-owned flag) would re-open the CEO §22
    // bypass and let a hostile client claim consent it didn't have.
    expect(WALK_SRC).not.toMatch(/if \(serviceRequiresMedical && req\.body\.medicalConsented/);
    expect(SITTER_SRC).not.toMatch(/if \(serviceRequiresMedical && req\.body\.medicalConsented/);
  });
});
