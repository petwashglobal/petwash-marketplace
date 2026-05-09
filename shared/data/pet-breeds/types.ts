/**
 * Pet breed + species dataset — types (PR-PET-3).
 *
 * Source spec: docs/product/pet-profile-luxury-onboarding-master-plan.md
 *              §2 (species), §3 (breed autocomplete), §11 (localisation).
 *
 * Foundation only:
 *   • Read-only static reference data.
 *   • TypeScript modules so both client (future autocomplete in
 *     PR-PET-5) and server (future validation) can import without
 *     a runtime database round-trip.
 *   • Localised label shape per the PR-PET-2 i18n locale set
 *     (en / he / ar / ru / fr / es). Where a translation is not yet
 *     provided, callers fall back to English via `getLabel()` —
 *     matches the existing English-stub pattern pinned by PR-PET-2.
 *
 * NOT in this PR:
 *   • No autocomplete UI (PR-PET-5).
 *   • No DB seed / migration (separate schema-migration PR class).
 *   • No i18next loader change (PR-PET-2 dormant pattern preserved).
 *   • No money / wallet / payment surface anywhere here.
 */

export const SUPPORTED_LANGS = [
  'en',
  'he',
  'ar',
  'ru',
  'fr',
  'es',
] as const;

export type Lang = typeof SUPPORTED_LANGS[number];

/** Localised label. `en` is the canonical authoritative value; other
 *  languages may be filled in by the translator workflow (a separate
 *  future PR class). When a value is absent, callers fall back to
 *  `en` via `getLabel()`. */
export interface LocalizedLabel {
  en: string;
  he?: string;
  ar?: string;
  ru?: string;
  fr?: string;
  es?: string;
}

export const SUPPORTED_SPECIES = [
  'dog',
  'cat',
  'bird',
  'rabbit',
  'guinea_pig',
  'reptile',
  'snake',
  'small_mammal',
  'other',
] as const;

export type SpeciesId = typeof SUPPORTED_SPECIES[number];

export interface SpeciesEntry {
  id: SpeciesId;
  label: LocalizedLabel;
  /** true: a curated breed list exists for this species (dog, cat
   *  today). false: free-text only at v1; "mixed" / "unknown"
   *  placeholders still apply. */
  hasBreedList: boolean;
}

export interface BreedEntry {
  /** Canonical kebab-case id, namespaced by species, globally unique
   *  across the entire dataset (e.g. `dog-labrador-retriever`).
   *  This is the id stored in any future DB column / API payload —
   *  human-readable + stable across UI relayouts. */
  id: string;
  species: SpeciesId;
  label: LocalizedLabel;
  /** true → eligible for the "popular breeds" surface in the
   *  autocomplete (limited curated list, not a search ranking). */
  popular?: boolean;
  /** Common alternative English spellings users might type into
   *  search; aliases participate in the future fuzzy matcher. */
  aliases?: string[];
  /** A breed marked `placeholder` represents a non-specific entry
   *  (mixed-breed, unknown, closest-match) — UI should treat it
   *  differently from a real breed. */
  placeholder?: 'mixed' | 'unknown' | 'other';
}

/** Resolve the localised label for a given language, falling back to
 *  English when the requested language is not yet translated. */
export function getLabel(label: LocalizedLabel, lang: Lang): string {
  const v = (label as unknown as Record<string, string | undefined>)[lang];
  return v && v.length > 0 ? v : label.en;
}
