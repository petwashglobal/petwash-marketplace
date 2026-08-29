/**
 * BookingPartyAdapter — Business Doctrine §5, §7, §18.2.
 *
 * The current repo stores booking pet references in three legacy shapes:
 *   • `petId: number | null`     — scalar single-pet on booking-requests row
 *   • `petIds: number[]`         — array on newer routes
 *   • `pets: { petId, species, carePlan }[]` — enriched projection where a
 *                                              join has been done already
 *
 * Doctrine §7 says: a booking has a BookingParty, not a scalar. This
 * adapter accepts any of the legacy shapes and returns the canonical
 * `BookingParty`. Callers pass in a `speciesLookup` (petId → species) so
 * the adapter stays free of DB imports.
 *
 * The audit
 * (docs/architecture/marketplace-doctrine-repo-audit-2026.md §4) flagged
 * booking-requests.ts:777, 4884 for the scalar shape. This adapter is the
 * migration path — new code reads through it, legacy writes remain until
 * Round 2 clears the last caller.
 */
import type {
  BookingParty,
  BookingPet,
  PetId,
} from '../../../shared/marketplace/bookingParty';
import type { Species } from '../../../shared/marketplace/actors';

export type LegacyPetInput =
  | { petId: number | string | null | undefined }
  | { petIds: Array<number | string> }
  | { pets: Array<{ petId: number | string; species?: Species }> };

export type SpeciesLookup = (petId: PetId) => Species | undefined;

/**
 * Project any legacy shape into a BookingParty. Unknown species falls back
 * to 'other' — callers should decide whether to reject the booking rather
 * than commit a party with unknown pet types. Returning 'other' surfaces
 * the ambiguity instead of silently dropping the pet (§5.3 discipline).
 */
export function toBookingParty(
  input: LegacyPetInput,
  speciesLookup: SpeciesLookup,
): BookingParty {
  const rawIds: PetId[] = [];
  const preloadedSpecies = new Map<PetId, Species>();

  if ('pets' in input && Array.isArray(input.pets)) {
    for (const p of input.pets) {
      const id = normaliseId(p.petId);
      if (id === null) continue;
      rawIds.push(id);
      if (p.species) preloadedSpecies.set(id, p.species);
    }
  } else if ('petIds' in input && Array.isArray(input.petIds)) {
    for (const raw of input.petIds) {
      const id = normaliseId(raw);
      if (id === null) continue;
      rawIds.push(id);
    }
  } else if ('petId' in input) {
    const id = normaliseId(input.petId);
    if (id !== null) rawIds.push(id);
  }

  const pets: BookingPet[] = [];
  for (const id of rawIds) {
    const species = preloadedSpecies.get(id) ?? speciesLookup(id) ?? 'other';
    pets.push({ petId: id, species });
  }
  return { pets };
}

function normaliseId(v: number | string | null | undefined): PetId | null {
  if (v === null || v === undefined || v === '') return null;
  return String(v);
}

/**
 * Deterministic — a legacy row with an EMPTY party is a doctrine bug shape,
 * not a normal path. Callers use this guard to refuse booking creation
 * until the party is non-empty (§5.1 — a booking has pets).
 */
export function isEmptyParty(party: BookingParty): boolean {
  return party.pets.length === 0;
}
