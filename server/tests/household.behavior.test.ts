/**
 * Household + authorised snapshot — behavior pins (business §62, §63, §32, §33).
 */
import { describe, it, expect } from 'vitest';
import {
  buildAuthorizedSnapshot,
  isSnapshotValid,
  type Household,
} from '../../shared/marketplace/household';

function household(over: Partial<Household> = {}): Household {
  return {
    householdId: 'hh_1',
    ownerUid: 'sarah',
    serviceLocation: {
      addressLine: '5 King George',
      city: 'Tel Aviv',
      countryCode: 'IL',
      apartment: '12',
    },
    petIds: ['bruno', 'charlie', 'milo', 'kiwi'],
    emergencyContact: { displayName: 'David', maskedPhone: '•••• 4321' },
    vet: { clinicName: 'Cohen Vet', maskedPhone: '•••• 8888' },
    accessInstructions: { method: 'LOCKBOX', notes: 'code 4321', parkingHint: 'blue gate' },
    ...over,
  };
}

describe('buildAuthorizedSnapshot — opt-in flow (§32, §33)', () => {
  it('all opt-ins → full snapshot for the booking pets', () => {
    const snap = buildAuthorizedSnapshot(
      household(),
      'bkg_1',
      ['bruno', 'milo'],
      { emergencyContact: true, vet: true, accessInstructions: true },
      '2026-08-30T00:00:00Z',
    );
    expect(snap.bookingId).toBe('bkg_1');
    expect(snap.authorizedPetIds).toEqual(['bruno', 'milo']);
    expect(snap.emergencyContact?.displayName).toBe('David');
    expect(snap.vet?.clinicName).toBe('Cohen Vet');
    expect(snap.accessInstructions?.method).toBe('LOCKBOX');
    expect(snap.serviceLocation.city).toBe('Tel Aviv');
  });

  it('no opt-ins → snapshot omits emergencyContact / vet / accessInstructions', () => {
    const snap = buildAuthorizedSnapshot(
      household(),
      'bkg_1',
      ['bruno'],
      { emergencyContact: false, vet: false, accessInstructions: false },
    );
    expect(snap.emergencyContact).toBeUndefined();
    expect(snap.vet).toBeUndefined();
    expect(snap.accessInstructions).toBeUndefined();
    // serviceLocation always flows — it is the *destination*.
    expect(snap.serviceLocation.city).toBe('Tel Aviv');
  });

  it('partial opt-in — only emergency contact shared', () => {
    const snap = buildAuthorizedSnapshot(
      household(),
      'bkg_1',
      ['bruno'],
      { emergencyContact: true, vet: false, accessInstructions: false },
    );
    expect(snap.emergencyContact).toBeDefined();
    expect(snap.vet).toBeUndefined();
    expect(snap.accessInstructions).toBeUndefined();
  });
});

describe('booking pets ∩ household pets', () => {
  it('only pets that are BOTH on household AND on booking flow through', () => {
    const snap = buildAuthorizedSnapshot(
      household(),
      'bkg_1',
      ['bruno', 'stranger'], // stranger is not on the household
      { emergencyContact: false, vet: false, accessInstructions: false },
    );
    expect(snap.authorizedPetIds).toEqual(['bruno']);
  });

  it('booking pets entirely outside household → authorizedPetIds empty; isSnapshotValid false', () => {
    const snap = buildAuthorizedSnapshot(
      household(),
      'bkg_1',
      ['stranger'],
      { emergencyContact: true, vet: true, accessInstructions: true },
    );
    expect(snap.authorizedPetIds).toEqual([]);
    expect(isSnapshotValid(snap)).toBe(false);
  });
});

describe('isSnapshotValid guard', () => {
  it('non-empty pet ids → valid', () => {
    const snap = buildAuthorizedSnapshot(
      household(),
      'bkg_1',
      ['bruno'],
      { emergencyContact: false, vet: false, accessInstructions: false },
    );
    expect(isSnapshotValid(snap)).toBe(true);
  });
});

describe('household with no vet or access instructions', () => {
  it('opt-in choices honored even when household has no data', () => {
    const snap = buildAuthorizedSnapshot(
      household({ vet: undefined, accessInstructions: undefined }),
      'bkg_1',
      ['bruno'],
      { emergencyContact: true, vet: true, accessInstructions: true },
    );
    // Opt-in for vet/access is honoured, but the underlying household
    // has no data → snapshot values are undefined (UI shows "not shared").
    expect(snap.vet).toBeUndefined();
    expect(snap.accessInstructions).toBeUndefined();
    expect(snap.emergencyContact?.displayName).toBe('David');
  });
});
