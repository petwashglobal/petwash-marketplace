/**
 * BookingParty compatibility — behavior pins (business doctrine §5.3, §5.4, §10).
 *
 * The core rule the audit anchors on: the server MUST NOT silently drop a
 * pet from a mixed-eligibility party. The customer sees the ineligible
 * pet(s) and picks explicitly.
 */
import { describe, it, expect } from 'vitest';
import {
  checkPartyCompatibility,
  type BookingParty,
  type OfferCompatibilityInput,
} from '../../shared/marketplace/bookingParty';

const offer = (o: Partial<OfferCompatibilityInput> = {}): OfferCompatibilityInput => ({
  serviceType: 'DAYCARE',
  acceptedSpecies: ['dog'],
  approvalStatus: 'approved',
  ...o,
});

describe('doctrine §5.3 mixed eligibility — dogs eligible, cat surfaced', () => {
  it('daycare (dogs only) with 2 dogs + 1 cat → 2 eligible, 1 SPECIES_NOT_ACCEPTED', () => {
    const party: BookingParty = {
      pets: [
        { petId: 'bruno', species: 'dog' },
        { petId: 'charlie', species: 'dog' },
        { petId: 'milo', species: 'cat' },
      ],
    };
    const r = checkPartyCompatibility(party, offer());
    expect(r.eligiblePetIds).toEqual(['bruno', 'charlie']);
    expect(r.ineligiblePetIds).toEqual(['milo']);
    expect(r.fullyCompatible).toBe(false);
    const catVerdict = r.perPet.find((p) => p.petId === 'milo')!;
    expect(catVerdict.eligible).toBe(false);
    expect(catVerdict.reason).toBe('SPECIES_NOT_ACCEPTED');
    expect(catVerdict.reasonText).toMatch(/does not accept cat/i);
  });
});

describe('doctrine §5.4 maxPets — over-cap pets are marked ineligible', () => {
  it('offer maxPets=2 with 3 dogs → first 2 eligible, third MAX_PETS_EXCEEDED', () => {
    const party: BookingParty = {
      pets: [
        { petId: 'a', species: 'dog' },
        { petId: 'b', species: 'dog' },
        { petId: 'c', species: 'dog' },
      ],
    };
    const r = checkPartyCompatibility(party, offer({ maxPets: 2 }));
    expect(r.eligiblePetIds).toEqual(['a', 'b']);
    expect(r.ineligiblePetIds).toEqual(['c']);
    expect(r.perPet.find((p) => p.petId === 'c')!.reason).toBe('MAX_PETS_EXCEEDED');
  });

  it('offer without maxPets → no cap enforcement', () => {
    const party: BookingParty = {
      pets: [
        { petId: 'a', species: 'dog' },
        { petId: 'b', species: 'dog' },
        { petId: 'c', species: 'dog' },
      ],
    };
    const r = checkPartyCompatibility(party, offer());
    expect(r.fullyCompatible).toBe(true);
  });
});

describe('doctrine §4.4 provider approval — not-approved rejects the whole party', () => {
  it('provider status pending → every pet ineligible with PROVIDER_NOT_APPROVED', () => {
    const party: BookingParty = {
      pets: [
        { petId: 'a', species: 'dog' },
        { petId: 'b', species: 'dog' },
      ],
    };
    const r = checkPartyCompatibility(party, offer({ approvalStatus: 'pending' }));
    expect(r.eligiblePetIds).toEqual([]);
    expect(r.fullyCompatible).toBe(false);
    for (const p of r.perPet) {
      expect(p.reason).toBe('PROVIDER_NOT_APPROVED');
    }
  });
});

describe('doctrine §5.3 — full household example (dog + cat + bird)', () => {
  it('home visit offer accepts dog+cat+bird → fully compatible', () => {
    const party: BookingParty = {
      pets: [
        { petId: 'bruno', species: 'dog' },
        { petId: 'milo', species: 'cat' },
        { petId: 'kiwi', species: 'bird' },
      ],
    };
    const r = checkPartyCompatibility(
      party,
      offer({
        serviceType: 'HOME_VISIT',
        acceptedSpecies: ['dog', 'cat', 'bird', 'rabbit'],
      }),
    );
    expect(r.fullyCompatible).toBe(true);
    expect(r.eligiblePetIds).toHaveLength(3);
  });
});

describe('server MUST NOT silently drop pets (§5.3 discipline)', () => {
  it('perPet verdicts are one-per-pet even when some are ineligible', () => {
    const party: BookingParty = {
      pets: [
        { petId: 'a', species: 'dog' },
        { petId: 'b', species: 'cat' },
        { petId: 'c', species: 'bird' },
      ],
    };
    const r = checkPartyCompatibility(party, offer({ acceptedSpecies: ['dog'] }));
    expect(r.perPet).toHaveLength(3);
    // Not a filter — the caller sees every pet and picks explicitly.
    expect(r.perPet.map((p) => p.petId)).toEqual(['a', 'b', 'c']);
  });
});
