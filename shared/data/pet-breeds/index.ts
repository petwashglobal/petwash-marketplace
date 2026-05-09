/**
 * Unified accessor for the pet-breed dataset (PR-PET-3).
 *
 * Read-only. No runtime activation. No i18next dependency. No DB
 * dependency. Pure TypeScript reference data.
 *
 * Consumers (future PRs only — nothing imports this yet):
 *   • PR-PET-5 breed-autocomplete UI on the client.
 *   • Future server-side validators that need to confirm a stored
 *     breed id is canonical.
 */

import type { BreedEntry, SpeciesId } from './types';
import { DOG_BREEDS } from './dog';
import { CAT_BREEDS } from './cat';
import { BIRD_BREEDS } from './bird';
import { OTHER_BREEDS } from './other';

export { type BreedEntry, type SpeciesId, type LocalizedLabel, type Lang,
         SUPPORTED_LANGS, SUPPORTED_SPECIES, getLabel } from './types';

/** All breeds across every species, in source order
 *  (placeholders → popular → alphabetical, per-species). */
export const ALL_BREEDS: BreedEntry[] = [
  ...DOG_BREEDS,
  ...CAT_BREEDS,
  ...BIRD_BREEDS,
  ...OTHER_BREEDS,
];

/** Per-species lookup. */
export function getBreedsForSpecies(species: SpeciesId): BreedEntry[] {
  return ALL_BREEDS.filter((b) => b.species === species);
}

/** Breed by canonical id (kebab-case namespaced). */
export function getBreedById(id: string): BreedEntry | undefined {
  return ALL_BREEDS.find((b) => b.id === id);
}

/** Popular breeds for a species (the curated subset surfaced
 *  ahead of search results in the autocomplete). Excludes
 *  placeholders. */
export function getPopularBreeds(species: SpeciesId): BreedEntry[] {
  return ALL_BREEDS.filter(
    (b) => b.species === species && b.popular === true && !b.placeholder,
  );
}

/** Placeholders for a species (mixed / unknown / other) — always
 *  present, separate from real breeds. */
export function getPlaceholderBreeds(species: SpeciesId): BreedEntry[] {
  return ALL_BREEDS.filter(
    (b) => b.species === species && b.placeholder !== undefined,
  );
}

/** Defensive: does a given id refer to a known breed in the dataset? */
export function isKnownBreedId(id: string): boolean {
  return ALL_BREEDS.some((b) => b.id === id);
}

// Re-export per-species lists for direct access where helpful.
export { DOG_BREEDS } from './dog';
export { CAT_BREEDS } from './cat';
export { BIRD_BREEDS } from './bird';
export { OTHER_BREEDS } from './other';
