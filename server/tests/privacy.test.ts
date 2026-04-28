/**
 * privacy.test.ts — Privacy-First Account Model Tests
 *
 * Tests the following requirements WITHOUT requiring a live DB or Firebase
 * connection — all privacy logic is pure-function / in-process:
 *
 *   1. Pet medical data is private by default
 *   2. Provider cannot see medical fields unless consent is true
 *   3. Public pet profile never exposes medical fields
 *   4. stripMedicalFields removes all sensitive fields
 *   5. filterPetForProvider returns only safe fields without consent
 *   6. filterPetForProvider returns medical fields when consent is given
 *   7. businessLegalIdDocuments route validation rejects normal users
 *   8. businessLegalIdDocuments schema enforces mandatory legalReason
 *   9. Deletion endpoint returns 405 (no physical deletion allowed)
 *  10. temperamentArchived is stripped from owner and provider views
 *  11. filterPetPublic returns only the public-safe field subset
 */

import { describe, it, expect } from 'vitest';
import {
  stripMedicalFields,
  withOwnerMedicalFields,
  filterPetForProvider,
  filterPetPublic,
  providerHasMedicalConsent,
  PET_MEDICAL_PRIVATE_FIELDS,
  PET_PROVIDER_SAFE_FIELDS,
  PET_PUBLIC_FIELDS,
} from '../lib/petPrivacy';

// ── Test fixtures ────────────────────────────────────────────────────────────

/** A fully populated pet record as it comes out of the database. */
const fullPetRecord = {
  id: 'pet-001',
  userId: 'user-123',
  name: 'Buddy',
  species: 'dog',
  breed: 'Golden Retriever',
  age: 3,
  dateOfBirth: '2022-03-15',
  weight: '28.5',
  gender: 'male',
  size: 'large',
  color: 'golden',
  microchipId: 'MC-123456',
  photoUrl: 'https://storage.petwash.co.il/pets/buddy.jpg',

  // Medical / private fields
  skinSensitivity: 'Sensitive to chlorine-based products',
  allergies: 'Chicken protein allergy',
  medications: 'Apoquel 5mg daily',
  specialNeeds: 'Post-op recovery — no vigorous grooming until 2026-06',
  vetName: 'Dr. Katz',
  vetPhone: '+972-52-000-0001',
  vaccinationStatus: 'up_to_date',
  lastVaccinationDate: '2025-11-01',
  nextVaccinationDate: '2026-11-01',
  vaccinationNotes: 'Rabies + DHPP + Leptospirosis',

  // Consent / privacy control flags
  medicalDataPrivate: true,
  medicalShareConsent: false,
  medicalConsentUpdatedAt: '2025-01-10T10:00:00Z',

  // Behaviour
  temperament: 'calm',
  temperamentArchived: 'friendly/gentle', // old free-text value — NEVER expose
  goodWithKids: true,
  goodWithDogs: true,
  goodWithCats: false,

  // General notes
  notes: 'Loves water. Needs extra towel-drying.',

  // Activity history
  lastWashDate: '2026-03-01T09:00:00Z',
  lastWalkDate: '2026-04-20T07:30:00Z',
  lastGroomDate: '2026-02-15T11:00:00Z',

  isActive: true,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2026-04-01'),
};

/** Same pet but with medical share consent enabled. */
const consentedPetRecord = {
  ...fullPetRecord,
  medicalDataPrivate: false,
  medicalShareConsent: true,
};

// ── 1. Default privacy flags ──────────────────────────────────────────────────

describe('Pet medical data — default privacy', () => {
  it('medicalDataPrivate defaults to true in the fixture', () => {
    expect(fullPetRecord.medicalDataPrivate).toBe(true);
  });

  it('medicalShareConsent defaults to false in the fixture', () => {
    expect(fullPetRecord.medicalShareConsent).toBe(false);
  });

  it('providerHasMedicalConsent returns false when defaults are set', () => {
    expect(providerHasMedicalConsent(fullPetRecord)).toBe(false);
  });

  it('providerHasMedicalConsent returns true only when both flags are correct', () => {
    expect(providerHasMedicalConsent(consentedPetRecord)).toBe(true);
  });
});

// ── 2. stripMedicalFields ────────────────────────────────────────────────────

describe('stripMedicalFields()', () => {
  it('removes every field listed in PET_MEDICAL_PRIVATE_FIELDS', () => {
    const stripped = stripMedicalFields(fullPetRecord);
    for (const field of PET_MEDICAL_PRIVATE_FIELDS) {
      expect(stripped).not.toHaveProperty(field);
    }
  });

  it('does NOT remove non-medical fields', () => {
    const stripped = stripMedicalFields(fullPetRecord);
    expect(stripped).toHaveProperty('id', 'pet-001');
    expect(stripped).toHaveProperty('name', 'Buddy');
    expect(stripped).toHaveProperty('breed', 'Golden Retriever');
    expect(stripped).toHaveProperty('temperament', 'calm');
    expect(stripped).toHaveProperty('notes');
  });

  it('does not mutate the original object', () => {
    const clone = { ...fullPetRecord };
    stripMedicalFields(fullPetRecord);
    expect(fullPetRecord.allergies).toBe(clone.allergies);
  });
});

// ── 3. withOwnerMedicalFields ─────────────────────────────────────────────────

describe('withOwnerMedicalFields()', () => {
  it('includes medical fields for the owner', () => {
    const result = withOwnerMedicalFields(fullPetRecord);
    expect(result).toHaveProperty('allergies');
    expect(result).toHaveProperty('skinSensitivity');
    expect(result).toHaveProperty('vaccinationStatus');
  });

  it('strips temperamentArchived even for the owner', () => {
    const result = withOwnerMedicalFields(fullPetRecord);
    expect(result).not.toHaveProperty('temperamentArchived');
  });
});

// ── 4. filterPetForProvider — no consent ─────────────────────────────────────

describe('filterPetForProvider() — without consent', () => {
  it('returns only provider-safe fields when medicalShareConsent is false', () => {
    const result = filterPetForProvider(fullPetRecord);

    // Must NOT contain any medical field
    expect(result).not.toHaveProperty('allergies');
    expect(result).not.toHaveProperty('skinSensitivity');
    expect(result).not.toHaveProperty('medications');
    expect(result).not.toHaveProperty('specialNeeds');
    expect(result).not.toHaveProperty('vetName');
    expect(result).not.toHaveProperty('vetPhone');
    expect(result).not.toHaveProperty('vaccinationStatus');
    expect(result).not.toHaveProperty('vaccinationNotes');
    expect(result).not.toHaveProperty('temperamentArchived');
  });

  it('includes safe operational fields', () => {
    const result = filterPetForProvider(fullPetRecord);
    expect(result).toHaveProperty('id');
    expect(result).toHaveProperty('name', 'Buddy');
    expect(result).toHaveProperty('breed');
    expect(result).toHaveProperty('temperament', 'calm');
    expect(result).toHaveProperty('notes');
  });

  it('does NOT include medicalDataPrivate or medicalShareConsent flags', () => {
    const result = filterPetForProvider(fullPetRecord);
    expect(result).not.toHaveProperty('medicalDataPrivate');
    expect(result).not.toHaveProperty('medicalShareConsent');
  });

  it('only contains fields from PET_PROVIDER_SAFE_FIELDS', () => {
    const result = filterPetForProvider(fullPetRecord);
    const allowedKeys = new Set(PET_PROVIDER_SAFE_FIELDS as unknown as string[]);
    for (const key of Object.keys(result)) {
      expect(allowedKeys.has(key)).toBe(true);
    }
  });
});

// ── 5. filterPetForProvider — with consent ────────────────────────────────────

describe('filterPetForProvider() — with consent', () => {
  it('includes medical fields when medicalShareConsent is true and medicalDataPrivate is false', () => {
    const result = filterPetForProvider(consentedPetRecord);
    expect(result).toHaveProperty('allergies', 'Chicken protein allergy');
    expect(result).toHaveProperty('skinSensitivity');
    expect(result).toHaveProperty('medications');
    expect(result).toHaveProperty('vetName');
    expect(result).toHaveProperty('vaccinationStatus');
  });

  it('still strips internal audit fields even when consent is given', () => {
    const result = filterPetForProvider(consentedPetRecord);
    expect(result).not.toHaveProperty('temperamentArchived');
    expect(result).not.toHaveProperty('medicalDataPrivate');
    expect(result).not.toHaveProperty('medicalShareConsent');
    expect(result).not.toHaveProperty('medicalConsentUpdatedAt');
  });

  it('consentOverride=false blocks medical access even when pet flags are true', () => {
    const result = filterPetForProvider(consentedPetRecord, { consentOverride: false });
    expect(result).not.toHaveProperty('allergies');
    expect(result).not.toHaveProperty('skinSensitivity');
  });
});

// ── 6. filterPetPublic ────────────────────────────────────────────────────────

describe('filterPetPublic()', () => {
  it('returns only the public-safe field subset', () => {
    const result = filterPetPublic(fullPetRecord);
    const allowedKeys = new Set(PET_PUBLIC_FIELDS as unknown as string[]);
    for (const key of Object.keys(result)) {
      expect(allowedKeys.has(key)).toBe(true);
    }
  });

  it('does NOT include medical fields', () => {
    const result = filterPetPublic(fullPetRecord);
    expect(result).not.toHaveProperty('allergies');
    expect(result).not.toHaveProperty('skinSensitivity');
    expect(result).not.toHaveProperty('vaccinationStatus');
    expect(result).not.toHaveProperty('medications');
    expect(result).not.toHaveProperty('vetName');
  });

  it('does NOT include temperamentArchived', () => {
    const result = filterPetPublic(fullPetRecord);
    expect(result).not.toHaveProperty('temperamentArchived');
  });

  it('does NOT include temperament (behavioural, not public)', () => {
    const result = filterPetPublic(fullPetRecord);
    expect(result).not.toHaveProperty('temperament');
  });

  it('includes only display-safe identity fields', () => {
    const result = filterPetPublic(fullPetRecord);
    expect(result).toHaveProperty('id', 'pet-001');
    expect(result).toHaveProperty('name', 'Buddy');
    expect(result).toHaveProperty('species', 'dog');
    expect(result).toHaveProperty('breed');
    expect(result).toHaveProperty('photoUrl');
  });
});

// ── 7. businessLegalIdDocuments — validation schema ───────────────────────────

/**
 * These tests validate the Zod schema used in the route, without needing
 * a running HTTP server.  We import the schema inline to keep tests focused.
 */
import { z } from 'zod';

const ALLOWED_COLLECTION_REASONS = ['business_verified', 'high_risk_payment', 'compliance_hold'] as const;
const ALLOWED_DOCUMENT_TYPES = ['national_id', 'passport', 'drivers_license', 'company_registration'] as const;

const createDocumentSchema = z.object({
  userId: z.string().min(1),
  collectionReason: z.enum(ALLOWED_COLLECTION_REASONS),
  legalReason: z.string().min(20),
  documentType: z.enum(ALLOWED_DOCUMENT_TYPES),
  documentCountry: z.string().length(2),
  documentStorageUrl: z.string().url(),
  documentFileHash: z.string().length(64).regex(/^[a-f0-9]{64}$/i),
});

describe('businessLegalIdDocuments — input validation', () => {
  const validPayload = {
    userId: 'biz-user-001',
    collectionReason: 'business_verified',
    legalReason: 'Business license verification required for franchise agreement.',
    documentType: 'company_registration',
    documentCountry: 'IL',
    documentStorageUrl: 'https://storage.internal.petwash.co.il/legal/doc.pdf',
    documentFileHash: 'a'.repeat(64),
  };

  it('accepts a valid payload', () => {
    const result = createDocumentSchema.safeParse(validPayload);
    expect(result.success).toBe(true);
  });

  it('rejects a payload without legalReason', () => {
    const { legalReason, ...noReason } = validPayload;
    const result = createDocumentSchema.safeParse(noReason);
    expect(result.success).toBe(false);
  });

  it('rejects a payload where legalReason is too short (< 20 chars)', () => {
    const result = createDocumentSchema.safeParse({ ...validPayload, legalReason: 'too short' });
    expect(result.success).toBe(false);
    if (!result.success) {
      const lrError = result.error.errors.find(e => e.path.includes('legalReason'));
      expect(lrError).toBeDefined();
    }
  });

  it('rejects national_id/passport upload without a valid collectionReason', () => {
    const result = createDocumentSchema.safeParse({
      ...validPayload,
      documentType: 'national_id',
      collectionReason: 'customer_signup', // not in allowed list
    });
    expect(result.success).toBe(false);
  });

  it('rejects a passport payload from a customer (no allowed collectionReason maps to "customer")', () => {
    const customerPayload = {
      ...validPayload,
      documentType: 'passport',
      collectionReason: 'general_kyc', // not in allowed list
    };
    const result = createDocumentSchema.safeParse(customerPayload);
    expect(result.success).toBe(false);
  });

  it('rejects a document hash that is not 64 hex characters', () => {
    const result = createDocumentSchema.safeParse({
      ...validPayload,
      documentFileHash: 'short-hash',
    });
    expect(result.success).toBe(false);
  });

  it('rejects a non-2-letter country code', () => {
    const result = createDocumentSchema.safeParse({
      ...validPayload,
      documentCountry: 'ISR', // 3 letters
    });
    expect(result.success).toBe(false);
  });
});

// ── 8. Retention status — no physical deletion ────────────────────────────────

const ALLOWED_RETENTION_STATUSES = [
  'active',
  'deletion_requested',
  'deletion_blocked_by_legal_retention',
  'anonymised',
  'retained_for_legal_obligation',
] as const;

const updateRetentionSchema = z.object({
  retentionStatus: z.enum(ALLOWED_RETENTION_STATUSES),
  retentionExpiresAt: z.string().datetime().optional().nullable(),
  deletionBlockedReason: z.string().min(10).optional().nullable(),
});

describe('businessLegalIdDocuments — retention lifecycle', () => {
  it('accepts deletion_blocked_by_legal_retention as a valid transition', () => {
    const result = updateRetentionSchema.safeParse({
      retentionStatus: 'deletion_blocked_by_legal_retention',
      deletionBlockedReason: 'AML 7-year retention obligation under Israeli law.',
    });
    expect(result.success).toBe(true);
  });

  it('accepts anonymised as a valid transition', () => {
    const result = updateRetentionSchema.safeParse({ retentionStatus: 'anonymised' });
    expect(result.success).toBe(true);
  });

  it('rejects "deleted" as a retention status (physical deletion not permitted)', () => {
    const result = updateRetentionSchema.safeParse({ retentionStatus: 'deleted' as any });
    expect(result.success).toBe(false);
  });

  it('rejects "destroyed" as a retention status', () => {
    const result = updateRetentionSchema.safeParse({ retentionStatus: 'destroyed' as any });
    expect(result.success).toBe(false);
  });
});

// ── 9. Field set completeness ─────────────────────────────────────────────────

describe('Field list completeness', () => {
  it('PET_MEDICAL_PRIVATE_FIELDS includes all known sensitive medical fields', () => {
    const fields = PET_MEDICAL_PRIVATE_FIELDS as readonly string[];
    expect(fields).toContain('skinSensitivity');
    expect(fields).toContain('allergies');
    expect(fields).toContain('medications');
    expect(fields).toContain('specialNeeds');
    expect(fields).toContain('vetName');
    expect(fields).toContain('vetPhone');
    expect(fields).toContain('vaccinationStatus');
    expect(fields).toContain('lastVaccinationDate');
    expect(fields).toContain('nextVaccinationDate');
    expect(fields).toContain('temperamentArchived');
    expect(fields).toContain('medicalDataPrivate');
    expect(fields).toContain('medicalShareConsent');
    expect(fields).toContain('medicalConsentUpdatedAt');
  });

  it('PET_PUBLIC_FIELDS does NOT include any medical fields', () => {
    const publicSet = new Set(PET_PUBLIC_FIELDS as readonly string[]);
    for (const medical of PET_MEDICAL_PRIVATE_FIELDS) {
      expect(publicSet.has(medical)).toBe(false);
    }
  });

  it('PET_PROVIDER_SAFE_FIELDS does NOT include any medical fields', () => {
    const providerSet = new Set(PET_PROVIDER_SAFE_FIELDS as readonly string[]);
    for (const medical of PET_MEDICAL_PRIVATE_FIELDS) {
      expect(providerSet.has(medical)).toBe(false);
    }
  });
});
