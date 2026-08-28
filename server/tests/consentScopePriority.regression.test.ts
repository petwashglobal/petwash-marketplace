/**
 * CEO §4/§5 (2026-08-28) — booking-scoped consent architecture.
 *
 * buildServerSafetySnapshot must resolve consent from THREE sources
 * with an explicit priority order:
 *   1. service_requirement — service hard-requires medical (medicated
 *      sitting, e.g.) and owner acknowledged
 *   2. booking_scoped      — owner ticked "share for THIS booking"
 *   3. account_preference  — pet's global medicalShareConsent = true
 * If none apply → consentScope = 'none' and medical fields are absent.
 *
 * medicalDataPrivate=true is a hard veto — beats all three positive
 * signals so the owner's private setting is never bypassed.
 */
import { describe, it, expect } from 'vitest';
import { buildServerSafetySnapshot } from '../lib/petPrivacy';

const pet = {
  name: 'Bruno',
  userId: 'usr_a',
  allergies: 'peanuts',
  medications: 'metacam 5mg AM',
  vetName: 'Dr. Mizrahi',
  vetPhone: '+972-3-123-4567',
};

describe('buildServerSafetySnapshot — consentScope priority (CEO §4/§5)', () => {
  it('no consent from any source → scope "none" and no medical fields', () => {
    const snap = buildServerSafetySnapshot(
      { ...pet, medicalShareConsent: false, medicalDataPrivate: true },
      {},
    );
    expect(snap.consentScope).toBe('none');
    expect(snap.medicalConsented).toBe(false);
    expect(snap.allergies).toBeUndefined();
  });

  it('account preference alone → scope "account_preference"', () => {
    const snap = buildServerSafetySnapshot(
      { ...pet, medicalShareConsent: true, medicalDataPrivate: false },
      {},
    );
    expect(snap.consentScope).toBe('account_preference');
    expect(snap.medicalConsented).toBe(true);
    expect(snap.allergies).toBe('peanuts');
  });

  it('booking-scoped share flag ALONE (no account preference) → scope "booking_scoped"', () => {
    const snap = buildServerSafetySnapshot(
      { ...pet, medicalShareConsent: false, medicalDataPrivate: false },
      {},
      { bookingScopedShare: true },
    );
    expect(snap.consentScope).toBe('booking_scoped');
    expect(snap.medicalConsented).toBe(true);
  });

  it('service-required medical (owner ack) → scope "service_requirement" — beats booking_scoped', () => {
    const snap = buildServerSafetySnapshot(
      { ...pet, medicalShareConsent: false, medicalDataPrivate: false },
      {},
      { bookingScopedShare: true, serviceRequiresMedical: true },
    );
    expect(snap.consentScope).toBe('service_requirement');
    expect(snap.medicalConsented).toBe(true);
  });

  it('service_requirement beats account_preference in the scope label', () => {
    const snap = buildServerSafetySnapshot(
      { ...pet, medicalShareConsent: true, medicalDataPrivate: false },
      {},
      { serviceRequiresMedical: true },
    );
    // The FLAG is still true either way, but the label distinguishes
    // audit purposes — service_required consent tells reviewers this
    // was an operational necessity, not a passive default.
    expect(snap.consentScope).toBe('service_requirement');
  });

  it('medicalDataPrivate=true HARD-VETOES every positive signal (defense in depth)', () => {
    // All three positive signals present, but the owner marked the
    // pet privatemedical — nothing bypasses that.
    const snap = buildServerSafetySnapshot(
      { ...pet, medicalShareConsent: true, medicalDataPrivate: true },
      {},
      { bookingScopedShare: true, serviceRequiresMedical: true },
    );
    expect(snap.consentScope).toBe('none');
    expect(snap.medicalConsented).toBe(false);
    expect(snap.allergies).toBeUndefined();
  });

  it('opts.bookingScopedShare/serviceRequiresMedical must equal exactly true — no truthy coercion', () => {
    // A stray non-boolean must not silently unlock medical.
    for (const bad of [1, 'true', {}, [], 'yes'] as any[]) {
      const snap = buildServerSafetySnapshot(
        { ...pet, medicalShareConsent: false, medicalDataPrivate: false },
        {},
        { bookingScopedShare: bad },
      );
      expect(snap.consentScope).toBe('none');
      expect(snap.medicalConsented).toBe(false);
    }
  });
});
