/**
 * HouseholdPetEligibilitySynthesizer — composes Household + Eligibility.
 *
 * Pure evaluator. Given a Household (from HouseholdCompositionService)
 * and a Provider capability (from ProviderServiceApprovalEvaluator +
 * PetEligibilityService inputs), returns a single decision object
 * the client can render as a Program 46 four-pet scenario card.
 */
import type { Household } from './HouseholdCompositionService';
import {
  evaluatePetEligibility,
  type ProviderServiceCapability,
} from './PetEligibilityService';

export interface SynthesisInput {
  household: Household;
  capability: ProviderServiceCapability;
  serviceCode: string;
}

export interface SynthesisOutcome {
  serviceCode: string;
  acceptedPetIds: string[];
  excludedPetIds: string[];
  requiresProviderProposal: boolean;
  clientHintCode:
    | 'BOOK_ALL_PETS'
    | 'BOOK_SUBSET_VIA_PROPOSAL'
    | 'NO_PET_ELIGIBLE_DECLINE_ONLY';
  suggestedProposal?: { includePetIds: string[] };
}

export function synthesiseHouseholdEligibility(input: SynthesisInput): SynthesisOutcome {
  const eligibility = evaluatePetEligibility({
    pets: input.household.pets.map((p) => ({ petId: p.petId, species: p.species, name: p.name })),
    capability: input.capability,
  });
  const acceptedIds = eligibility.accepted.map((v) => v.petId);
  const excludedIds = eligibility.excluded.map((v) => v.petId);
  const hint: SynthesisOutcome['clientHintCode'] = eligibility.allEligible
    ? 'BOOK_ALL_PETS'
    : (eligibility.accepted.length > 0
        ? 'BOOK_SUBSET_VIA_PROPOSAL'
        : 'NO_PET_ELIGIBLE_DECLINE_ONLY');
  return {
    serviceCode: input.serviceCode,
    acceptedPetIds: acceptedIds,
    excludedPetIds: excludedIds,
    requiresProviderProposal: eligibility.requiresProposal,
    clientHintCode: hint,
    suggestedProposal: eligibility.suggestedProposal,
  };
}
