/**
 * HouseholdCompositionService — CEO PROGRAM 5 extension (Household).
 *
 * Pure evaluator. A household is the OWNER-scoped tuple of
 * (location, access rules, general instructions, emergency contact,
 * pets[]). This service composes a household DTO from primitive
 * inputs, applies canonicalisation, and exposes helpers so
 * consumers never invent their own household shape.
 *
 * The evaluator NEVER persists — it only shapes + validates. The
 * pets array is de-duped by petId and returned sorted for stable
 * downstream comparisons.
 */

export interface HouseholdLocation {
  areaCode?: string;                         // stable slug e.g. 'TLV_CENTER'
  address?: string;
  accessCode?: string;                       // door code slug (never raw pin)
  accessNotesCode?: string;                  // stable slug the UI translates
}

export interface EmergencyContact {
  contactUid?: string;                       // preferred when the contact is a PetWash account
  displayNameCode?: string;                  // slug when uid absent
}

export interface HouseholdPet {
  petId: string;
  species: 'dog' | 'cat' | 'bird' | 'rabbit' | 'reptile' | 'rodent' | 'fish' | 'other';
  name?: string;
}

export interface HouseholdInput {
  ownerUid: string;
  location?: HouseholdLocation;
  generalInstructionsCode?: string;          // stable slug
  emergencyContact?: EmergencyContact;
  pets: HouseholdPet[];
}

export interface Household {
  ownerUid: string;
  location?: HouseholdLocation;
  generalInstructionsCode?: string;
  emergencyContact?: EmergencyContact;
  pets: HouseholdPet[];
  petCount: number;
  distinctSpeciesCount: number;
}

export type HouseholdOutcome =
  | { code: 'OK'; household: Household }
  | { code: 'INVALID_INPUT'; reasonCode: 'NO_OWNER_UID' | 'DUPLICATE_PET_ID' };

export function composeHousehold(input: HouseholdInput): HouseholdOutcome {
  if (!input.ownerUid) return { code: 'INVALID_INPUT', reasonCode: 'NO_OWNER_UID' };

  const seen = new Set<string>();
  for (const p of input.pets) {
    if (seen.has(p.petId)) return { code: 'INVALID_INPUT', reasonCode: 'DUPLICATE_PET_ID' };
    seen.add(p.petId);
  }

  const pets = input.pets
    .slice()
    .sort((a, b) => a.species.localeCompare(b.species) || a.petId.localeCompare(b.petId));

  const distinctSpeciesCount = new Set(pets.map((p) => p.species)).size;

  return {
    code: 'OK',
    household: {
      ownerUid: input.ownerUid,
      location: input.location,
      generalInstructionsCode: input.generalInstructionsCode,
      emergencyContact: input.emergencyContact,
      pets,
      petCount: pets.length,
      distinctSpeciesCount,
    },
  };
}

/** Two households are "equivalent" (same shape) for change detection. */
export function isSameHousehold(a: Household, b: Household): boolean {
  if (a.ownerUid !== b.ownerUid) return false;
  if (a.generalInstructionsCode !== b.generalInstructionsCode) return false;
  if (a.pets.length !== b.pets.length) return false;
  for (let i = 0; i < a.pets.length; i++) {
    if (a.pets[i].petId !== b.pets[i].petId) return false;
    if (a.pets[i].species !== b.pets[i].species) return false;
  }
  return true;
}
