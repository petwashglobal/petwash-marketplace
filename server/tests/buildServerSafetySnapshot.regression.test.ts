/**
 * CEO §22 (2026-08-28) — SERVER-ENFORCED KYA snapshot.
 *
 * The client's `petSafetySnapshot.medicalConsented` boolean is NOT
 * authority. A modified client can post allergies/medications/vet
 * contact even when the owner's real consent is false. The server
 * ignores any client-supplied medical field and composes the persisted
 * snapshot from AUTHORITATIVE pet data + the DB consent flag.
 *
 * This is a behavior-level test on the helper — no source pins.
 * A refactor that starts trusting the client medicalConsented flag
 * fails these assertions.
 */
import { describe, it, expect } from 'vitest';
import { buildServerSafetySnapshot } from '../lib/petPrivacy';

describe('buildServerSafetySnapshot — server-enforced KYA privacy (CEO §22)', () => {
  const canonicalWithConsent = {
    id: 1,
    userId: 'usr_a',
    name: 'Bruno',
    allergies: 'peanuts',
    medications: 'metacam 5mg AM',
    vetName: 'Dr. Mizrahi',
    vetPhone: '+972-3-123-4567',
    aggressionWarning: '',
    escapeRisk: false,
    medicalShareConsent: true,
    medicalDataPrivate: false,
  };
  const canonicalWithoutConsent = {
    ...canonicalWithConsent,
    medicalShareConsent: false,
    medicalDataPrivate: true,
  };

  const maliciousClientSnapshot = {
    aggressionWarning: null,
    escapeRisk: false,
    behaviourNotes: 'good boy',
    feedingInstructions: '',
    handlingInstructions: '',
    sensitiveSkin: false,
    // Client lies about consent AND injects medical PII.
    medicalConsented: true,
    allergies:       'INJECTED-BY-CLIENT (should be dropped)',
    medicationNotes: 'INJECTED-BY-CLIENT (should be dropped)',
    vetName:         'INJECTED-BY-CLIENT (should be dropped)',
    vetPhone:        'INJECTED-BY-CLIENT (should be dropped)',
  };

  it('under DB consent=false, medical fields are STRIPPED even when the client claims consent=true', () => {
    const snap = buildServerSafetySnapshot(canonicalWithoutConsent, maliciousClientSnapshot);
    expect(snap.medicalConsented).toBe(false);
    expect(snap.allergies).toBeUndefined();
    expect(snap.medicationNotes).toBeUndefined();
    expect(snap.vetName).toBeUndefined();
    expect(snap.vetPhone).toBeUndefined();
  });

  it('under DB consent=true, medical fields come from the CANONICAL row — client injection is never persisted', () => {
    const snap = buildServerSafetySnapshot(canonicalWithConsent, maliciousClientSnapshot);
    expect(snap.medicalConsented).toBe(true);
    // Not the "INJECTED-BY-CLIENT" strings.
    expect(snap.allergies).toBe('peanuts');
    expect(snap.medicationNotes).toBe('metacam 5mg AM');
    expect(snap.vetName).toBe('Dr. Mizrahi');
    expect(snap.vetPhone).toBe('+972-3-123-4567');
  });

  it('safety subset is always kept — behaviour/feeding/handling notes from the owner survive', () => {
    const snap = buildServerSafetySnapshot(canonicalWithoutConsent, {
      ...maliciousClientSnapshot,
      behaviourNotes: 'shy around men',
    });
    expect(snap.behaviourNotes).toBe('shy around men');
  });

  it('medicalDataPrivate=true beats medicalShareConsent=true — private overrides consent', () => {
    // Defense in depth: a pet marked private stays private even if the
    // share-consent bool was flipped on by a bug.
    const pet = { ...canonicalWithConsent, medicalDataPrivate: true };
    const snap = buildServerSafetySnapshot(pet, maliciousClientSnapshot);
    expect(snap.medicalConsented).toBe(false);
    expect(snap.allergies).toBeUndefined();
  });

  it('malformed client snapshot (null, string, array) is safe — non-object treated as empty', () => {
    for (const bad of [null, undefined, 'oops', 42, [1, 2, 3]] as const) {
      const snap = buildServerSafetySnapshot(canonicalWithoutConsent, bad);
      expect(snap.medicalConsented).toBe(false);
      expect(snap.allergies).toBeUndefined();
      // Safety fallback fields come from the canonical row.
      expect(typeof snap.behaviourNotes).toBe('string');
    }
  });

  it('escape risk aggregates client + canonical — either "true" wins (safety-preserving)', () => {
    const pet = { ...canonicalWithoutConsent, escapeRisk: true };
    const snap = buildServerSafetySnapshot(pet, { escapeRisk: false });
    expect(snap.escapeRisk).toBe(true);
  });

  it('aggressionWarning falls back to canonical when the client omitted it', () => {
    const pet = { ...canonicalWithoutConsent, aggressionWarning: 'reactive to bikes' };
    const snap = buildServerSafetySnapshot(pet, {
      behaviourNotes: 'good with people',
      // No aggressionWarning on the client.
    });
    expect(snap.aggressionWarning).toBe('reactive to bikes');
  });
});
