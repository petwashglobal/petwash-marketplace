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
 * Medical fields that a provider may receive when the pet owner has given
 * explicit consent (medicalShareConsent=true).
 *
 * This is an ALLOWLIST — fields not in this list are NEVER forwarded to a
 * provider, even with consent.  This prevents any future or unknown field
 * (e.g. internal document storage URLs, audit fields) from accidentally
 * leaking through a "spread + delete" pattern.
 */
export const PET_PROVIDER_CONSENT_MEDICAL_FIELDS = [
  'skinSensitivity',
  'allergies',
  'medications',
  'specialNeeds',
  'vetName',           // customerPets table
  'vetPhone',          // customerPets table
  'vetContactName',    // petProfilesForSitting table
  'vetContactPhone',   // petProfilesForSitting table
  'emergencyContactName',
  'emergencyContactPhone',
  'vaccinationStatus',
  'lastVaccinationDate',
  'nextVaccinationDate',
  'vaccinationNotes',
] as const;

/**
 * Returns a filtered pet object suitable for a *service provider*.
 *
 * Medical fields are included ONLY when:
 *   1. `medicalShareConsent` is true on the pet record, AND
 *   2. `consentOverride` is not explicitly set to false (e.g., booking cancelled)
 *
 * In all other cases only the safe provider-visible fields are returned.
 *
 * IMPORTANT: Both paths use an ALLOWLIST (not a denylist).  This ensures any
 * future or unknown field on the pet object — such as internal document storage
 * URLs, database internals, or audit columns — can never leak to a provider.
 */
export function filterPetForProvider(
  pet: AnyPet,
  options: { consentOverride?: boolean } = {}
): AnyPet {
  const hasConsent =
    options.consentOverride !== false &&
    pet['medicalShareConsent'] === true &&
    pet['medicalDataPrivate'] !== true;

  // Build the result from the provider-safe allowlist first.
  const result: AnyPet = {};
  for (const field of PET_PROVIDER_SAFE_FIELDS) {
    if (field in pet) {
      result[field] = pet[field];
    }
  }

  if (hasConsent) {
    // Add only the explicitly-allowed medical fields — no spread, no denylist.
    for (const field of PET_PROVIDER_CONSENT_MEDICAL_FIELDS) {
      if (field in pet) {
        result[field] = pet[field];
      }
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

/**
 * CEO §22 (2026-08-28) — SERVER-ENFORCED KYA snapshot builder for booking-create.
 *
 * The client's `petSafetySnapshot.medicalConsented` flag is NEVER authority.
 * A modified client can POST allergies/medications/vet contact even with
 * consent=false. This builder ignores any client-supplied medical fields
 * and composes the persisted snapshot from AUTHORITATIVE pet data + the
 * canonical consent flag off the pet row.
 *
 * Contract:
 *   • The provider-visible SAFETY subset (aggression, escape risk,
 *     behaviour, feeding, handling notes, sensitive-skin flag) is
 *     always allowed — this protects the person about to hold the leash.
 *     Where the client supplies a note, it is taken as-is (behaviour
 *     notes belong to the owner). Where it is absent, we fall back to
 *     the pet row.
 *   • The MEDICAL subset (allergies, medications, vet name, vet phone)
 *     is written ONLY when the pet row's `medicalShareConsent === true`
 *     AND `medicalDataPrivate !== true`. The client's `medicalConsented`
 *     boolean is discarded — we always project the DB consent.
 *   • `medicalConsented` on the persisted snapshot is set FROM THE
 *     SERVER READ, so downstream readers know whether the medical block
 *     was intentionally withheld vs empty.
 *
 * Terminology: this is "pet medical data" / "sensitive care data". It
 * is not PHI in the legal sense (US HIPAA covers human health data).
 * Callers should use the neutral terminology in comments + logs.
 */
export interface KyaSafetySnapshot {
  aggressionWarning:    string | null;
  escapeRisk:           boolean;
  behaviourNotes:       string;
  feedingInstructions:  string;
  handlingInstructions: string;
  sensitiveSkin:        boolean;
  medicalConsented:     boolean;
  // Present only under authoritative consent.
  allergies?:      string;
  medicationNotes?: string;
  vetName?:        string;
  vetPhone?:       string;
}

/**
 * CEO §8 (2026-08-28) — read-time re-projection of a stored safety
 * snapshot against CURRENT owner consent.
 *
 * A booking created when medicalShareConsent=true may have persisted
 * allergies / medications / vet contact into booking_requests
 * .pet_details.safety. If the owner later WITHDRAWS consent, walker
 * reads must stop returning those fields — the stored blob is
 * evidence, not a permanent grant.
 *
 * This is the pragmatic separation of "stored evidence" (kept for
 * audit) from "current display permission" (what the walker sees).
 * Callers pass the stored blob + the CURRENT canonical pet row (or
 * null if the pet was deleted). Returns a copy with medical fields
 * removed when consent is now false.
 */
export function projectStoredSafetyForProvider(
  storedSafety: unknown,
  canonicalPetOrNull: AnyPet | null,
): Record<string, unknown> | null {
  if (!storedSafety || typeof storedSafety !== 'object' || Array.isArray(storedSafety)) {
    return null;
  }
  const s = { ...(storedSafety as Record<string, unknown>) };
  const nowConsented =
    canonicalPetOrNull != null && providerHasMedicalConsent(canonicalPetOrNull);
  if (!nowConsented) {
    delete s.allergies;
    delete s.medicationNotes;
    delete s.vetName;
    delete s.vetPhone;
    s.medicalConsented = false;
  }
  return s;
}

/**
 * Compose a server-authoritative safety snapshot.
 *
 * @param canonicalPet the pet row loaded from Postgres/Firestore by an
 *   authenticated + ownership-verified read. Passing an unauthenticated
 *   or cross-user pet violates the contract.
 * @param clientSnapshot the shape the client sent. May be null/malformed
 *   — non-object inputs are treated as empty. Any medical field on the
 *   input is IGNORED; medical fields always come from the pet row under
 *   the DB consent flag.
 */
export function buildServerSafetySnapshot(
  canonicalPet: AnyPet,
  clientSnapshot: unknown,
): KyaSafetySnapshot {
  const c: Record<string, unknown> =
    clientSnapshot && typeof clientSnapshot === 'object' && !Array.isArray(clientSnapshot)
      ? (clientSnapshot as Record<string, unknown>)
      : {};

  const asStr  = (v: unknown, fallback = ''): string  => (typeof v === 'string' ? v : fallback);
  const asBool = (v: unknown): boolean                => v === true;

  // Safety subset — always allowed. Owner-authored notes win over the
  // stale pet-row copy when the owner typed something at booking time.
  const snapshot: KyaSafetySnapshot = {
    aggressionWarning:    asStr(c.aggressionWarning,    asStr(canonicalPet['aggressionWarning'], '')) || null,
    escapeRisk:           asBool(c.escapeRisk) || asBool(canonicalPet['escapeRisk']),
    behaviourNotes:       asStr(c.behaviourNotes,       asStr(canonicalPet['behaviourNotes'])),
    feedingInstructions:  asStr(c.feedingInstructions,  asStr(canonicalPet['feedingInstructions'])),
    handlingInstructions: asStr(c.handlingInstructions, asStr(canonicalPet['handlingInstructions'])),
    sensitiveSkin:        asBool(c.sensitiveSkin) || (canonicalPet['skinSensitivity'] != null && String(canonicalPet['skinSensitivity']).trim() !== ''),
    // Canonical consent — from the pet row, not from the client.
    medicalConsented:     providerHasMedicalConsent(canonicalPet),
  };

  // Medical subset — server-only projection under DB consent.
  if (snapshot.medicalConsented) {
    snapshot.allergies       = asStr(canonicalPet['allergies']);
    snapshot.medicationNotes = asStr(canonicalPet['medications']);
    snapshot.vetName         = asStr(canonicalPet['vetName']);
    snapshot.vetPhone        = asStr(canonicalPet['vetPhone']);
  }

  return snapshot;
}
