/**
 * BookingParty — canonical multi-pet booking types (Business doctrine §5, §7).
 *
 * A booking does NOT have only `petId`. It has a BookingParty (many pets),
 * with per-pet care plans and per-pet eligibility against the provider's
 * offer.
 *
 * The current repo still stores a scalar `petId` on some booking rows
 * (booking-requests.ts:777, 4884) — the audit
 * (docs/architecture/marketplace-doctrine-repo-audit-2026.md §4) marks this
 * as CONFIRMED P0 drift. This module is the target shape read code should
 * converge on; a following commit adds the `BookingPartyAdapter` that
 * projects legacy scalar/array shapes into `BookingParty`.
 */
import type { Species, ServiceType } from './actors';

export type PetId = string;

export interface CarePlan {
  /**
   * Free-text per-pet care instructions the OWNER authorized for this
   * booking. Do NOT auto-populate this from the pet's private profile —
   * business doctrine §32 requires structured, per-booking authorization.
   */
  instructions?: string;
  feedingSchedule?: string;
  medication?: string;
  medicalNotes?: string;
  behaviorNotes?: string;
  emergencyInstructions?: string;
}

export interface BookingPet {
  petId: PetId;
  species: Species;
  perPetCarePlan?: CarePlan;
}

export interface BookingParty {
  pets: BookingPet[];
}

export type EligibilityReason =
  | 'SPECIES_NOT_ACCEPTED'
  | 'MAX_PETS_EXCEEDED'
  | 'PROVIDER_NOT_APPROVED';

export interface PetEligibility {
  petId: PetId;
  eligible: boolean;
  reason?: EligibilityReason;
  reasonText?: string;
}

export interface CompatibilityResult {
  serviceType: ServiceType;
  perPet: PetEligibility[];
  eligiblePetIds: PetId[];
  ineligiblePetIds: PetId[];
  fullyCompatible: boolean;
}

export interface OfferCompatibilityInput {
  serviceType: ServiceType;
  acceptedSpecies: Species[];
  maxPets?: number;
  approvalStatus: 'not_started' | 'pending' | 'approved' | 'rejected';
}

/**
 * Business doctrine §5.3, §5.4, §10.
 *
 * `checkPartyCompatibility` returns a per-pet + summary verdict. The server
 * MUST NOT silently drop a pet from the party (§5.3) — instead the UI
 * surfaces the ineligible pet(s) and the customer chooses to proceed with
 * the eligible subset OR pick a different provider.
 */
export function checkPartyCompatibility(
  party: BookingParty,
  offer: OfferCompatibilityInput,
): CompatibilityResult {
  const perPet: PetEligibility[] = [];

  if (offer.approvalStatus !== 'approved') {
    for (const p of party.pets) {
      perPet.push({
        petId: p.petId,
        eligible: false,
        reason: 'PROVIDER_NOT_APPROVED',
        reasonText: 'This provider is not yet approved for this service.',
      });
    }
    return summarize(offer.serviceType, perPet);
  }

  const overCap =
    offer.maxPets !== undefined && party.pets.length > offer.maxPets;

  for (let i = 0; i < party.pets.length; i += 1) {
    const pet = party.pets[i];
    if (!offer.acceptedSpecies.includes(pet.species)) {
      perPet.push({
        petId: pet.petId,
        eligible: false,
        reason: 'SPECIES_NOT_ACCEPTED',
        reasonText: `This provider does not accept ${pet.species}s for ${offer.serviceType}.`,
      });
      continue;
    }
    if (overCap && offer.maxPets !== undefined && i >= offer.maxPets) {
      perPet.push({
        petId: pet.petId,
        eligible: false,
        reason: 'MAX_PETS_EXCEEDED',
        reasonText: `This provider accepts at most ${offer.maxPets} pets per booking.`,
      });
      continue;
    }
    perPet.push({ petId: pet.petId, eligible: true });
  }

  return summarize(offer.serviceType, perPet);
}

function summarize(serviceType: ServiceType, perPet: PetEligibility[]): CompatibilityResult {
  const eligiblePetIds = perPet.filter((p) => p.eligible).map((p) => p.petId);
  const ineligiblePetIds = perPet.filter((p) => !p.eligible).map((p) => p.petId);
  return {
    serviceType,
    perPet,
    eligiblePetIds,
    ineligiblePetIds,
    fullyCompatible: ineligiblePetIds.length === 0 && eligiblePetIds.length > 0,
  };
}
