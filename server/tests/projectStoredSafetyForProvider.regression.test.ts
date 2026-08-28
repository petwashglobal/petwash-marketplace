/**
 * CEO §8 (2026-08-28) — read-time re-projection of stored safety snapshot.
 *
 * A booking created when medicalShareConsent=true may have persisted
 * allergies / medications / vet contact into booking_requests
 * .pet_details.safety. If the owner LATER withdraws consent, walker
 * reads must stop returning those fields — the stored blob is
 * evidence, not a permanent grant.
 *
 * Behavior tests on the helper directly (no source pins).
 */
import { describe, it, expect } from 'vitest';
import { projectStoredSafetyForProvider } from '../lib/petPrivacy';

describe('projectStoredSafetyForProvider — read-time consent re-projection (CEO §8)', () => {
  const storedWithMedical = {
    aggressionWarning: null,
    escapeRisk: false,
    behaviourNotes: 'shy around men',
    feedingInstructions: '',
    handlingInstructions: '',
    sensitiveSkin: false,
    medicalConsented: true,
    allergies: 'peanuts',
    medicationNotes: 'metacam 5mg AM',
    vetName: 'Dr. Mizrahi',
    vetPhone: '+972-3-123-4567',
  };

  it('strips medical fields when the owner has REVOKED consent since booking', () => {
    // The stored blob has medical from an earlier "consent=true" write.
    // Current pet row says consent=false. Reader must not see it.
    const currentPet = { medicalShareConsent: false, medicalDataPrivate: true };
    const projected = projectStoredSafetyForProvider(storedWithMedical, currentPet);
    expect(projected).not.toBeNull();
    expect(projected!.allergies).toBeUndefined();
    expect(projected!.medicationNotes).toBeUndefined();
    expect(projected!.vetName).toBeUndefined();
    expect(projected!.vetPhone).toBeUndefined();
    expect(projected!.medicalConsented).toBe(false);
    // Safety subset survives.
    expect(projected!.behaviourNotes).toBe('shy around men');
  });

  it('keeps medical fields when consent is still in place', () => {
    const currentPet = { medicalShareConsent: true, medicalDataPrivate: false };
    const projected = projectStoredSafetyForProvider(storedWithMedical, currentPet);
    expect(projected).not.toBeNull();
    expect(projected!.allergies).toBe('peanuts');
    expect(projected!.medicationNotes).toBe('metacam 5mg AM');
    expect(projected!.vetName).toBe('Dr. Mizrahi');
    expect(projected!.vetPhone).toBe('+972-3-123-4567');
    expect(projected!.medicalConsented).toBe(true);
  });

  it('strips medical when the pet was DELETED (canonical row is null)', () => {
    // Fail-safe: no canonical row means we cannot verify consent →
    // withhold medical. Better a walker missing information than
    // seeing data the owner no longer authorises.
    const projected = projectStoredSafetyForProvider(storedWithMedical, null);
    expect(projected!.allergies).toBeUndefined();
    expect(projected!.medicationNotes).toBeUndefined();
    expect(projected!.vetName).toBeUndefined();
    expect(projected!.vetPhone).toBeUndefined();
    expect(projected!.medicalConsented).toBe(false);
  });

  it('returns null on a malformed stored blob (null, non-object, array)', () => {
    for (const bad of [null, undefined, 'oops', 42, ['not', 'an', 'object']] as const) {
      expect(projectStoredSafetyForProvider(bad, { medicalShareConsent: true })).toBeNull();
    }
  });

  it('medicalDataPrivate=true overrides medicalShareConsent=true (defense in depth)', () => {
    const currentPet = { medicalShareConsent: true, medicalDataPrivate: true };
    const projected = projectStoredSafetyForProvider(storedWithMedical, currentPet);
    expect(projected!.medicalConsented).toBe(false);
    expect(projected!.allergies).toBeUndefined();
  });
});
