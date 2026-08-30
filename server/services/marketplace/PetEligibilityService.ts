/**
 * PetEligibilityService — CEO PROGRAM 5 (Multi-Pet / Household).
 *
 * Pure evaluator. Given a household of pets and a provider's declared
 * accepted species (per service), decides which pets the provider
 * CAN handle and which pets must be either excluded via an EXPLICIT
 * provider proposal or booked separately.
 *
 * The rule (§ Program 5): NEVER silently remove a pet from a booking
 * request. If any pet in the request is ineligible for the target
 * provider service, the caller must SURFACE the exclusion — the
 * provider either proposes to exclude the ineligible pet (and the
 * customer accepts) or declines.
 *
 * Doctrine test (Program 46): owner has Bruno (dog), Charlie (dog),
 * Milo (cat), Kiwi (bird). Provider accepts dogs+cats, not birds.
 * The evaluator returns:
 *   accepted: [Bruno, Charlie, Milo], excluded: [Kiwi]
 *   requiresProposal: true                (because at least one pet
 *                                          is ineligible)
 *   suggestedProposal: { includePetIds: [Bruno, Charlie, Milo] }
 */

export type PetSpecies =
  | 'dog'
  | 'cat'
  | 'bird'
  | 'rabbit'
  | 'reptile'
  | 'rodent'
  | 'fish'
  | 'other';

export interface PetSummary {
  petId: string;
  name?: string;
  species: PetSpecies;
}

export interface ProviderServiceCapability {
  /** Species the provider has DECLARED they accept for this service. */
  acceptedSpecies: PetSpecies[];
  /** Optional per-species cap (e.g. maxDogs=2). Absent = unlimited within reason. */
  perSpeciesMax?: Partial<Record<PetSpecies, number>>;
  /** Optional total-pet cap across all species. */
  totalMax?: number;
}

export type IneligibilityReasonCode =
  | 'SPECIES_NOT_ACCEPTED'
  | 'PER_SPECIES_CAP_EXCEEDED'
  | 'TOTAL_CAP_EXCEEDED';

export interface PetVerdict {
  petId: string;
  eligible: boolean;
  reasonCode?: IneligibilityReasonCode;
}

export interface EligibilityOutcome {
  accepted: PetVerdict[];
  excluded: PetVerdict[];
  requiresProposal: boolean;
  suggestedProposal?: { includePetIds: string[] };
  allEligible: boolean;
}

export function evaluatePetEligibility(input: {
  pets: PetSummary[];
  capability: ProviderServiceCapability;
}): EligibilityOutcome {
  const accepted: Set<PetSpecies> = new Set(input.capability.acceptedSpecies);
  const perSpeciesMax = input.capability.perSpeciesMax ?? {};
  const totalMax = input.capability.totalMax;

  const perSpeciesTaken: Partial<Record<PetSpecies, number>> = {};
  let totalTaken = 0;

  const verdicts: PetVerdict[] = input.pets.map((p) => {
    if (!accepted.has(p.species)) {
      return { petId: p.petId, eligible: false, reasonCode: 'SPECIES_NOT_ACCEPTED' };
    }
    const capForSpecies = perSpeciesMax[p.species];
    const takenForSpecies = perSpeciesTaken[p.species] ?? 0;
    if (typeof capForSpecies === 'number' && takenForSpecies + 1 > capForSpecies) {
      return { petId: p.petId, eligible: false, reasonCode: 'PER_SPECIES_CAP_EXCEEDED' };
    }
    if (typeof totalMax === 'number' && totalTaken + 1 > totalMax) {
      return { petId: p.petId, eligible: false, reasonCode: 'TOTAL_CAP_EXCEEDED' };
    }
    perSpeciesTaken[p.species] = takenForSpecies + 1;
    totalTaken += 1;
    return { petId: p.petId, eligible: true };
  });

  const accepted_ = verdicts.filter((v) => v.eligible);
  const excluded_ = verdicts.filter((v) => !v.eligible);
  const allEligible = excluded_.length === 0;
  return {
    accepted: accepted_,
    excluded: excluded_,
    requiresProposal: !allEligible && accepted_.length > 0,
    suggestedProposal: !allEligible && accepted_.length > 0
      ? { includePetIds: accepted_.map((v) => v.petId) }
      : undefined,
    allEligible,
  };
}
