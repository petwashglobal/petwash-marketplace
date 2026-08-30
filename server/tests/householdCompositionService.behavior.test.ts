/**
 * HouseholdCompositionService — Program 5 (Household).
 */
import { describe, it, expect } from 'vitest';
import {
  composeHousehold,
  isSameHousehold,
  type HouseholdPet,
} from '../services/marketplace/HouseholdCompositionService';

const four: HouseholdPet[] = [
  { petId: 'bruno', species: 'dog', name: 'Bruno' },
  { petId: 'charlie', species: 'dog', name: 'Charlie' },
  { petId: 'milo', species: 'cat', name: 'Milo' },
  { petId: 'kiwi', species: 'bird', name: 'Kiwi' },
];

describe('HouseholdCompositionService', () => {
  it('composes a household with counts', () => {
    const out = composeHousehold({ ownerUid: 'sarah', pets: four });
    expect(out.code).toBe('OK');
    if (out.code !== 'OK') throw new Error();
    expect(out.household.petCount).toBe(4);
    expect(out.household.distinctSpeciesCount).toBe(3);
  });

  it('pets sorted by species then petId (stable comparison for downstream)', () => {
    const out = composeHousehold({ ownerUid: 'sarah', pets: four });
    if (out.code !== 'OK') throw new Error();
    expect(out.household.pets.map((p) => p.petId)).toEqual(['kiwi', 'milo', 'bruno', 'charlie']);
  });

  it('missing ownerUid → INVALID_INPUT(NO_OWNER_UID)', () => {
    const out = composeHousehold({ ownerUid: '', pets: [] });
    expect(out.code).toBe('INVALID_INPUT');
  });

  it('duplicate petId → INVALID_INPUT(DUPLICATE_PET_ID)', () => {
    const out = composeHousehold({ ownerUid: 'sarah', pets: [
      { petId: 'bruno', species: 'dog' },
      { petId: 'bruno', species: 'dog' },
    ]});
    expect(out.code).toBe('INVALID_INPUT');
    if (out.code !== 'INVALID_INPUT') throw new Error();
    expect(out.reasonCode).toBe('DUPLICATE_PET_ID');
  });

  it('isSameHousehold detects identical households (order-invariant)', () => {
    const a = composeHousehold({ ownerUid: 'sarah', pets: four });
    const b = composeHousehold({ ownerUid: 'sarah', pets: [...four].reverse() });
    if (a.code !== 'OK' || b.code !== 'OK') throw new Error();
    expect(isSameHousehold(a.household, b.household)).toBe(true);
  });

  it('isSameHousehold detects a swapped pet species', () => {
    const a = composeHousehold({ ownerUid: 'sarah', pets: four });
    const b = composeHousehold({ ownerUid: 'sarah', pets: [
      { petId: 'bruno', species: 'cat' },
      ...four.slice(1),
    ]});
    if (a.code !== 'OK' || b.code !== 'OK') throw new Error();
    expect(isSameHousehold(a.household, b.household)).toBe(false);
  });

  it('generalInstructionsCode change → not-same', () => {
    const a = composeHousehold({ ownerUid: 'sarah', pets: four, generalInstructionsCode: 'GATE_LEFT_UNLOCKED' });
    const b = composeHousehold({ ownerUid: 'sarah', pets: four, generalInstructionsCode: 'RING_BELL_TWICE' });
    if (a.code !== 'OK' || b.code !== 'OK') throw new Error();
    expect(isSameHousehold(a.household, b.household)).toBe(false);
  });

  it('empty household is valid (no pets is still a shape)', () => {
    const out = composeHousehold({ ownerUid: 'sarah', pets: [] });
    expect(out.code).toBe('OK');
    if (out.code !== 'OK') throw new Error();
    expect(out.household.petCount).toBe(0);
    expect(out.household.distinctSpeciesCount).toBe(0);
  });
});
