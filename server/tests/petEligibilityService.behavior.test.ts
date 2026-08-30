/**
 * PetEligibilityService — CEO PROGRAM 5, PROGRAM 46 four-pet scenario.
 *
 * Doctrine rule: never silently exclude a pet. Any ineligibility must
 * surface an explicit proposal path.
 */
import { describe, it, expect } from 'vitest';
import {
  evaluatePetEligibility,
  type PetSummary,
  type ProviderServiceCapability,
} from '../services/marketplace/PetEligibilityService';

const household: PetSummary[] = [
  { petId: 'bruno', species: 'dog' },
  { petId: 'charlie', species: 'dog' },
  { petId: 'milo', species: 'cat' },
  { petId: 'kiwi', species: 'bird' },
];

describe('PetEligibilityService — Program 5 / Program 46', () => {
  it('all species accepted → allEligible=true, no proposal needed', () => {
    const capability: ProviderServiceCapability = {
      acceptedSpecies: ['dog', 'cat', 'bird', 'rabbit'],
    };
    const r = evaluatePetEligibility({ pets: household, capability });
    expect(r.allEligible).toBe(true);
    expect(r.requiresProposal).toBe(false);
    expect(r.excluded).toEqual([]);
    expect(r.suggestedProposal).toBeUndefined();
  });

  it('bird ineligible → Program 46 exact expected outcome (Bruno+Charlie+Milo accepted; Kiwi excluded via proposal)', () => {
    const capability: ProviderServiceCapability = {
      acceptedSpecies: ['dog', 'cat'],
    };
    const r = evaluatePetEligibility({ pets: household, capability });
    expect(r.accepted.map((v) => v.petId)).toEqual(['bruno', 'charlie', 'milo']);
    expect(r.excluded.map((v) => v.petId)).toEqual(['kiwi']);
    expect(r.excluded[0].reasonCode).toBe('SPECIES_NOT_ACCEPTED');
    expect(r.requiresProposal).toBe(true);
    expect(r.suggestedProposal).toEqual({ includePetIds: ['bruno', 'charlie', 'milo'] });
  });

  it('per-species cap of 1 dog → the second dog is ineligible with PER_SPECIES_CAP_EXCEEDED', () => {
    const capability: ProviderServiceCapability = {
      acceptedSpecies: ['dog', 'cat', 'bird'],
      perSpeciesMax: { dog: 1 },
    };
    const r = evaluatePetEligibility({ pets: household, capability });
    const secondDog = r.excluded.find((v) => v.petId === 'charlie');
    expect(secondDog?.reasonCode).toBe('PER_SPECIES_CAP_EXCEEDED');
    expect(r.requiresProposal).toBe(true);
  });

  it('total cap of 2 → third and fourth pet in order become ineligible with TOTAL_CAP_EXCEEDED', () => {
    const capability: ProviderServiceCapability = {
      acceptedSpecies: ['dog', 'cat', 'bird'],
      totalMax: 2,
    };
    const r = evaluatePetEligibility({ pets: household, capability });
    expect(r.accepted.map((v) => v.petId)).toEqual(['bruno', 'charlie']);
    expect(r.excluded[0].reasonCode).toBe('TOTAL_CAP_EXCEEDED');
    expect(r.excluded[1].reasonCode).toBe('TOTAL_CAP_EXCEEDED');
  });

  it('no accepted species overlap → allEligible=false BUT requiresProposal=false (no valid subset to propose)', () => {
    const capability: ProviderServiceCapability = {
      acceptedSpecies: ['reptile', 'fish'],
    };
    const r = evaluatePetEligibility({ pets: household, capability });
    expect(r.allEligible).toBe(false);
    expect(r.accepted).toEqual([]);
    // No accepted subset exists — the caller must offer decline, not
    // a proposal (§7 discipline: never suggest a proposal that
    // includes zero pets).
    expect(r.requiresProposal).toBe(false);
    expect(r.suggestedProposal).toBeUndefined();
  });

  it('single-pet household with matching species → allEligible=true', () => {
    const r = evaluatePetEligibility({
      pets: [{ petId: 'bruno', species: 'dog' }],
      capability: { acceptedSpecies: ['dog'] },
    });
    expect(r.allEligible).toBe(true);
  });

  it('empty household → allEligible=true trivially (no ineligibility to raise)', () => {
    const r = evaluatePetEligibility({
      pets: [],
      capability: { acceptedSpecies: ['dog'] },
    });
    expect(r.allEligible).toBe(true);
    expect(r.accepted).toEqual([]);
    expect(r.excluded).toEqual([]);
  });
});
