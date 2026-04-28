/**
 * petPrivacy.ts — Pet medical data privacy utilities
 *
 * Enforces the privacy-first pet data model:
 *   - Medical fields are PRIVATE BY DEFAULT (medicalDataPrivate = true)
 *   - Providers may only receive medical fields when the owner has explicitly
 *     set medicalShareConsent = true
 *   - Public API responses never include medical or audit fields
 *
 * Rules enforced here match the schema contract in shared/schema.ts.
 */

// ── Field lists ──────────────────────────────────────────────────────────────

/**
 * Fields that are ALWAYS stripped from public/provider API responses.
 * These fields must never leave the server unless the owner has given
 * explicit consent AND the requesting party is an authorised provider.
 */
export const PET_MEDICAL_PRIVATE_FIELDS = [
  'skinSensitivity',
  'allergies',
  'medications',
  'specialNeeds',
  'vetName',
  'vetPhone',
  'vaccinationStatus',
  'lastVaccinationDate',
  'nextVaccinationDate',
  'vaccinationNotes',
  // internal/audit fields
  'temperamentArchived',
  'medicalDataPrivate',
  'medicalShareConsent',
  'medicalConsentUpdatedAt',
] as const;

/**
 * Fields that are safe to expose to a service provider when working with a
 * booked pet.  This list is intentionally conservative — only what a provider
 * needs to perform the service safely.
 */
export const PET_PROVIDER_SAFE_FIELDS = [
  'id',
  'name',
  'species',
  'breed',
  'age',
  'dateOfBirth',
  'weight',
  'gender',
  'size',
  'color',
  'microchipId',
  'photoUrl',
  'temperament',      // enum value only; no archived free-text
  'goodWithKids',
  'goodWithDogs',
  'goodWithCats',
  'notes',            // general care notes, NOT medical notes
  'washFrequency',
  'lastWashDate',
  'lastWalkDate',
  'lastGroomDate',
] as const;

/**
 * Subset of fields safe for public-facing pet profile display
 * (e.g., lost-and-found listing, public sitter search).
 */
export const PET_PUBLIC_FIELDS = [
  'id',
  'name',
  'species',
  'breed',
  'gender',
  'size',
  'color',
  'photoUrl',
] as const;

// ── Helper types ─────────────────────────────────────────────────────────────

type AnyPet = Record<string, unknown>;

// ── Utility functions ────────────────────────────────────────────────────────

/**
 * Returns a copy of `pet` with all private medical and audit fields removed.
 *
 * Use this for the pet *owner's* GET response — they can see their own pet's
 * non-medical fields freely.  Medical fields are still removed because they
 * should only be sent when explicitly requested via a separate consent-gated
 * endpoint.
 *
 * If you need to include medical fields for the owner, use
 * `withOwnerMedicalFields` instead.
 */
export function stripMedicalFields(pet: AnyPet): AnyPet {
  const result = { ...pet };
  for (const field of PET_MEDICAL_PRIVATE_FIELDS) {
    delete result[field];
  }
  return result;
}

/**
 * Returns the full pet object for the authenticated *owner* including medical
 * fields.  Only call this when the request has been authenticated as the pet's
 * owner.
 */
export function withOwnerMedicalFields(pet: AnyPet): AnyPet {
  // Omit internal/audit-only fields even for owners
  const result = { ...pet };
  delete result['temperamentArchived'];
  return result;
}

/**
 * Returns a filtered pet object suitable for a *service provider*.
 *
 * Medical fields are included ONLY when:
 *   1. `medicalShareConsent` is true on the pet record, AND
 *   2. `consentOverride` is not explicitly set to false (e.g., booking cancelled)
 *
 * In all other cases only the safe provider-visible fields are returned.
 */
export function filterPetForProvider(
  pet: AnyPet,
  options: { consentOverride?: boolean } = {}
): AnyPet {
  const hasConsent =
    options.consentOverride !== false &&
    pet['medicalShareConsent'] === true &&
    pet['medicalDataPrivate'] !== true;

  if (hasConsent) {
    // Include medical fields but still strip internal audit fields
    const result = { ...pet };
    delete result['temperamentArchived'];
    delete result['medicalDataPrivate'];
    delete result['medicalShareConsent'];
    delete result['medicalConsentUpdatedAt'];
    return result;
  }

  // No consent — return only provider-safe fields
  const result: AnyPet = {};
  for (const field of PET_PROVIDER_SAFE_FIELDS) {
    if (field in pet) {
      result[field] = pet[field];
    }
  }
  return result;
}

/**
 * Returns a minimal public-safe pet object.
 * Used for lost-and-found listings and any unauthenticated API response.
 */
export function filterPetPublic(pet: AnyPet): AnyPet {
  const result: AnyPet = {};
  for (const field of PET_PUBLIC_FIELDS) {
    if (field in pet) {
      result[field] = pet[field];
    }
  }
  return result;
}

/**
 * Type-safe check: does a provider have medical access for this pet?
 * Returns true only when both consent flags are set correctly.
 */
export function providerHasMedicalConsent(pet: AnyPet): boolean {
  return pet['medicalShareConsent'] === true && pet['medicalDataPrivate'] !== true;
}
