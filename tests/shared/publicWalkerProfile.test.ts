/**
 * Pure unit tests for projectPublicWalker.
 *
 * SECURITY INVARIANT under test: the projector NEVER emits any field
 * from the walker_profiles PII / KYC / banking / commission / admin
 * categories, regardless of what the input row contains. If a future
 * change to the DTO shape accidentally starts leaking one of those,
 * a test here MUST fail.
 *
 * Per CEO §P0-2 + §P1-27 (BEHAVIORAL-VERIFIED discipline).
 */

import { describe, expect, it } from 'vitest';
import { projectPublicWalker } from '@shared/lib/publicWalkerProfile';

/**
 * A maximally-poisoned walker_profiles row — every sensitive field
 * agent 2 flagged, plus a few extras a future column-add might sneak
 * in. If any of these values appear in a projected DTO, the test
 * catches it.
 */
const POISONED_ROW = {
  // PUBLIC fields (should survive projection):
  id: 42,
  walkerId: 'WALKER-abc-123',
  firstName: 'Ronen',
  lastName: 'Levi',
  displayName: 'Ronen L.',
  profilePhotoUrl: 'https://cdn.petwash/ronen.jpg',
  bio: 'Loves dogs',
  city: 'Tel Aviv',
  citySymbol: 'TLV',
  country: 'IL',
  serviceRadiusKm: 5,
  yearsOfExperience: 3,
  specializations: ['puppies', 'seniors'],
  certifications: ['first_aid'],
  averageRating: '4.83',
  totalReviews: 128,
  totalWalks: 210,
  responseTimeMinutes: 12,
  hasBodyCamera: true,
  hasDroneAccess: false,
  hasFirstAidKit: true,
  hasCarTransport: false,
  baseHourlyRate: '80',
  minimumMinutes: 30,
  currency: 'ILS',
  walkPackages: [{ name: '30 min', price: 40 }],
  extraServices: [],
  verificationStatus: 'verified',
  isAvailable: true,
  isActive: true,
  instantBookEnabled: true,
  createdAt: '2024-01-01T00:00:00Z',

  // SENSITIVE fields that MUST NOT be projected:
  userId: 'FIREBASE_UID_SUPER_SECRET',
  kycCompleted: true,
  backgroundCheckStatus: 'passed',
  backgroundCheckDate: '2024-06-01T00:00:00Z',
  selfiePhotoUrl: 'https://kyc.internal/selfie.jpg',
  governmentIdUrl: 'https://kyc.internal/id.jpg',
  biometricMatchScore: '0.99',
  biometricVerifiedAt: '2024-06-01T00:00:00Z',
  bankAccountVerified: true,
  nayaxPayoutAccountId: 'NAYAX-PAYOUT-9999',
  commissionRate: '0.15',
  suspensionReason: 'internal-note',
  suspendedUntil: null,
  instantBookMinTrust: 80,
  acceptanceRate: '0.92',
  maxDailyWalks: 8,
  updatedAt: '2025-01-01T00:00:00Z',
  currentLatitude: '32.0853',
  currentLongitude: '34.7818',
};

const SENSITIVE_FIELDS = [
  'userId',
  'kycCompleted',
  'backgroundCheckStatus',
  'backgroundCheckDate',
  'selfiePhotoUrl',
  'governmentIdUrl',
  'biometricMatchScore',
  'biometricVerifiedAt',
  'bankAccountVerified',
  'nayaxPayoutAccountId',
  'commissionRate',
  'suspensionReason',
  'suspendedUntil',
  'instantBookMinTrust',
  'acceptanceRate',
  'maxDailyWalks',
  'updatedAt',
  'currentLatitude',
  'currentLongitude',
];

const SENSITIVE_VALUES = [
  'FIREBASE_UID_SUPER_SECRET',
  'https://kyc.internal/selfie.jpg',
  'https://kyc.internal/id.jpg',
  'NAYAX-PAYOUT-9999',
  'internal-note',
  '32.0853',
  '34.7818',
];

describe('projectPublicWalker — security invariant', () => {
  it('returns null for null / non-object input', () => {
    expect(projectPublicWalker(null)).toBeNull();
    expect(projectPublicWalker(undefined)).toBeNull();
    expect(projectPublicWalker('string' as any)).toBeNull();
    expect(projectPublicWalker(42 as any)).toBeNull();
  });

  it('projects the poisoned row to a DTO with public fields present', () => {
    const dto = projectPublicWalker(POISONED_ROW);
    expect(dto).not.toBeNull();
    expect(dto!.walkerId).toBe('WALKER-abc-123');
    expect(dto!.displayName).toBe('Ronen L.');
    expect(dto!.bio).toBe('Loves dogs');
    expect(dto!.city).toBe('Tel Aviv');
    expect(dto!.baseHourlyRate).toBe(80);
    expect(dto!.averageRating).toBeCloseTo(4.83);
    expect(dto!.isVerified).toBe(true);
    expect(dto!.memberSince).toBe(2024);
  });

  it('projected DTO EXCLUDES every sensitive field', () => {
    const dto = projectPublicWalker(POISONED_ROW) as any;
    for (const field of SENSITIVE_FIELDS) {
      expect(dto, `sensitive field "${field}" leaked into DTO`).not.toHaveProperty(field);
    }
  });

  it('serialised DTO does NOT contain any sensitive VALUE', () => {
    // Belt-and-braces: even if a future refactor renamed a public field
    // AS a sensitive column value, the serialised JSON would leak it.
    // Catch that class of bug too.
    const dto = projectPublicWalker(POISONED_ROW);
    const serialised = JSON.stringify(dto);
    for (const v of SENSITIVE_VALUES) {
      expect(serialised, `sensitive value "${v}" leaked via JSON`).not.toContain(v);
    }
  });

  it('isVerified is a boolean derived from verificationStatus — never the raw enum', () => {
    for (const raw of ['suspended', 'rejected', 'pending', 'under_review', 'unknown', null, undefined]) {
      const dto = projectPublicWalker({ ...POISONED_ROW, verificationStatus: raw }) as any;
      expect(typeof dto.isVerified).toBe('boolean');
      expect(dto).not.toHaveProperty('verificationStatus');
      expect(JSON.stringify(dto)).not.toContain('suspended');
      expect(JSON.stringify(dto)).not.toContain('rejected');
    }
  });

  it('accepts snake_case rows equally (raw SQL) — no PII leaks via alt-shape', () => {
    const snake = {
      id: 7,
      walker_id: 'WALKER-snake',
      first_name: 'Amir',
      last_name: 'Cohen',
      profile_photo_url: null,
      user_id: 'FIREBASE_UID_SUPER_SECRET',
      nayax_payout_account_id: 'NAYAX-999',
      current_latitude: '32.0',
      current_longitude: '34.0',
      created_at: '2023-06-01',
      verification_status: 'verified',
    };
    const dto = projectPublicWalker(snake) as any;
    expect(dto.walkerId).toBe('WALKER-snake');
    expect(dto.memberSince).toBe(2023);
    expect(dto.isVerified).toBe(true);
    const serialised = JSON.stringify(dto);
    expect(serialised).not.toContain('FIREBASE_UID_SUPER_SECRET');
    expect(serialised).not.toContain('NAYAX-999');
    expect(serialised).not.toContain('34.0');
  });

  it('numeric coercion is safe on garbage', () => {
    const dto = projectPublicWalker({
      ...POISONED_ROW,
      averageRating: 'not-a-number',
      baseHourlyRate: null,
      totalReviews: undefined,
      totalWalks: '15',
    }) as any;
    expect(dto.averageRating).toBeNull();
    expect(dto.baseHourlyRate).toBeNull();
    expect(dto.totalReviews).toBe(0);
    expect(dto.totalWalks).toBe(15);
  });

  it('displayName falls back to firstName + lastName when displayName is empty', () => {
    const dto = projectPublicWalker({ ...POISONED_ROW, displayName: undefined }) as any;
    expect(dto.displayName).toBe('Ronen Levi');
  });

  it('displayName falls back to a safe placeholder when everything is missing', () => {
    const dto = projectPublicWalker({
      id: 1,
      walkerId: 'WALKER-x',
      displayName: undefined,
      firstName: undefined,
      lastName: undefined,
    }) as any;
    expect(dto.displayName).toBe('PetWash walker');
  });

  it('never lets a boolean-flag field come back as anything but a boolean', () => {
    // The projector uses `bool()` — verify a stringy-truthy garbage input
    // still yields a real boolean (not `"t"` or `1`).
    const dto = projectPublicWalker({
      ...POISONED_ROW,
      hasBodyCamera: 't',
      isAvailable: 1,
      instantBookEnabled: 'true',
    }) as any;
    expect(typeof dto.hasBodyCamera).toBe('boolean');
    expect(typeof dto.isAvailable).toBe('boolean');
    expect(typeof dto.instantBookEnabled).toBe('boolean');
    expect(dto.hasBodyCamera).toBe(true);
    expect(dto.isAvailable).toBe(true);
    expect(dto.instantBookEnabled).toBe(true);
  });
});
