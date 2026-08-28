/**
 * CANONICAL pet species enum. Single source of truth for every KYA
 * surface (Pets.tsx, MyAccount.tsx, AddPetPassport.tsx, PetPassportHome,
 * BookingFlow, provider Today card, admin pet detail).
 *
 * CEO 2026-08-28 §22 — until this file existed, four surfaces defined
 * their own species enum and drifted:
 *   • shared/firestore-schema.ts     — 10 (canonical, includes turtle)
 *   • client/src/pages/Pets.tsx      —  9 (missing turtle)
 *   • client/src/pages/MyAccount.tsx —  8 (has turtle, no reptile)
 *   • client/src/pages/AddPetPassport.tsx — 10 (added a `snake` tile
 *     that aliases to `reptile` on the API)
 *
 * Result: a pet added via one surface could be un-editable via another
 * (Zod refuses the value the other page saved). Every UI now imports
 * `SPECIES_VALUES` for validation and `SPECIES_LABELS` for display.
 *
 * Adding a new species (or renaming) MUST land here first — every
 * caller picks the change up automatically. Backfill legacy string
 * values only through `normalizeLegacySpecies()` so pre-existing pet
 * docs continue to load.
 */

export const SPECIES_VALUES = [
  'dog',
  'cat',
  'bird',
  'rabbit',
  'guinea_pig',
  'hamster',
  'reptile',
  'turtle',
  'fish',
  'other',
] as const;

export type PetSpecies = (typeof SPECIES_VALUES)[number];

/** Display labels in HE + EN + emoji. Presentation-only — never used
 *  for validation. Keys mirror SPECIES_VALUES exactly. */
export const SPECIES_LABELS: Record<PetSpecies, { he: string; en: string; emoji: string }> = {
  dog:        { he: 'כלב',    en: 'Dog',        emoji: '🐕' },
  cat:        { he: 'חתול',   en: 'Cat',        emoji: '🐈' },
  bird:       { he: 'ציפור',  en: 'Bird',       emoji: '🦜' },
  rabbit:     { he: 'ארנב',   en: 'Rabbit',     emoji: '🐇' },
  guinea_pig: { he: 'שרקן',   en: 'Guinea Pig', emoji: '🐹' },
  hamster:    { he: 'אוגר',   en: 'Hamster',    emoji: '🐹' },
  reptile:    { he: 'זוחל',   en: 'Reptile',    emoji: '🦎' },
  turtle:     { he: 'צב',     en: 'Turtle',     emoji: '🐢' },
  fish:       { he: 'דג',     en: 'Fish',       emoji: '🐠' },
  other:      { he: 'אחר',    en: 'Other',      emoji: '🐾' },
};

/**
 * Map any legacy species string a pre-existing pet doc might carry
 * onto a canonical value. Handles:
 *   • upper/mixed case (DOG, Dog → dog)
 *   • pre-canonical aliases (snake → reptile, canine → dog, feline → cat)
 *   • whitespace / hyphen variants (guinea-pig → guinea_pig)
 *   • unknown / empty → 'other' so the UI still renders
 *
 * A brand-new write MUST use SPECIES_VALUES directly. This function
 * exists ONLY to keep old records loadable while the shared source
 * migrates in place.
 */
export function normalizeLegacySpecies(raw: unknown): PetSpecies {
  const s = String(raw ?? '').trim().toLowerCase().replace(/[-\s]/g, '_');
  if ((SPECIES_VALUES as readonly string[]).includes(s)) return s as PetSpecies;
  if (s === 'canine' || s === 'puppy') return 'dog';
  if (s === 'feline' || s === 'kitten') return 'cat';
  if (s === 'snake' || s === 'lizard' || s === 'gecko') return 'reptile';
  if (s === 'tortoise') return 'turtle';
  if (s === 'guineapig' || s === 'cavy') return 'guinea_pig';
  return 'other';
}
