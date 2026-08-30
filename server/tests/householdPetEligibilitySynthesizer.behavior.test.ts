/**
 * HouseholdPetEligibilitySynthesizer — composition of Household + Eligibility.
 */
import { describe, it, expect } from 'vitest';
import { composeHousehold } from '../services/marketplace/HouseholdCompositionService';
import { synthesiseHouseholdEligibility } from '../services/marketplace/HouseholdPetEligibilitySynthesizer';

const household = (() => {
  const out = composeHousehold({
    ownerUid: 'sarah',
    pets: [
      { petId: 'bruno', species: 'dog' },
      { petId: 'charlie', species: 'dog' },
      { petId: 'milo', species: 'cat' },
      { petId: 'kiwi', species: 'bird' },
    ],
  });
  if (out.code !== 'OK') throw new Error();
  return out.household;
})();

describe('HouseholdPetEligibilitySynthesizer — Program 46 doctrine scenario', () => {
  it('provider accepts dogs+cats → book subset via proposal, Kiwi excluded', () => {
    const out = synthesiseHouseholdEligibility({
      household,
      capability: { acceptedSpecies: ['dog', 'cat'] },
      serviceCode: 'PET_SITTING',
    });
    expect(out.serviceCode).toBe('PET_SITTING');
    expect(out.acceptedPetIds.sort()).toEqual(['bruno', 'charlie', 'milo']);
    expect(out.excludedPetIds).toEqual(['kiwi']);
    expect(out.requiresProviderProposal).toBe(true);
    expect(out.clientHintCode).toBe('BOOK_SUBSET_VIA_PROPOSAL');
    expect(out.suggestedProposal?.includePetIds.sort()).toEqual(['bruno', 'charlie', 'milo']);
  });

  it('provider accepts all species → BOOK_ALL_PETS', () => {
    const out = synthesiseHouseholdEligibility({
      household,
      capability: { acceptedSpecies: ['dog', 'cat', 'bird', 'rabbit'] },
      serviceCode: 'PET_SITTING',
    });
    expect(out.clientHintCode).toBe('BOOK_ALL_PETS');
    expect(out.requiresProviderProposal).toBe(false);
  });

  it('provider accepts only reptiles → NO_PET_ELIGIBLE_DECLINE_ONLY', () => {
    const out = synthesiseHouseholdEligibility({
      household,
      capability: { acceptedSpecies: ['reptile'] },
      serviceCode: 'PET_SITTING',
    });
    expect(out.clientHintCode).toBe('NO_PET_ELIGIBLE_DECLINE_ONLY');
    expect(out.requiresProviderProposal).toBe(false);
    expect(out.suggestedProposal).toBeUndefined();
  });
});
