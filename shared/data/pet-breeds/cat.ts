/**
 * Curated cat breed list (PR-PET-3).
 *
 * Read-only seed for the future autocomplete (PR-PET-5). Same shape
 * as the dog list. ~25 entries — most-frequently-matched cat breeds
 * globally + the standard placeholders.
 */

import type { BreedEntry } from './types';

export const CAT_BREEDS: BreedEntry[] = [
  // ── placeholders (always available) ──────────────────────────────────
  {
    id: 'cat-mixed',
    species: 'cat',
    placeholder: 'mixed',
    label: {
      en: 'Mixed breed',
      he: 'תערובת',
      ar: 'سلالة مختلطة',
      ru: 'Метис',
      fr: 'Bâtard',
      es: 'Mestizo',
    },
  },
  {
    id: 'cat-unknown',
    species: 'cat',
    placeholder: 'unknown',
    label: {
      en: 'Unknown breed',
      he: 'גזע לא ידוע',
      ar: 'سلالة غير معروفة',
      ru: 'Неизвестная порода',
      fr: 'Race inconnue',
      es: 'Raza desconocida',
    },
  },
  {
    id: 'cat-other',
    species: 'cat',
    placeholder: 'other',
    label: {
      en: 'Other / not listed',
      he: 'אחר / לא ברשימה',
      ar: 'أخرى / غير مدرج',
      ru: 'Другое / не в списке',
      fr: 'Autre / non listé',
      es: 'Otra / no listada',
    },
  },

  // ── popular breeds (curated; ~6 most-searched globally) ──────────────
  { id: 'cat-persian', species: 'cat', popular: true,
    label: { en: 'Persian' } },
  { id: 'cat-maine-coon', species: 'cat', popular: true,
    label: { en: 'Maine Coon' } },
  { id: 'cat-siamese', species: 'cat', popular: true,
    label: { en: 'Siamese' } },
  { id: 'cat-ragdoll', species: 'cat', popular: true,
    label: { en: 'Ragdoll' } },
  { id: 'cat-british-shorthair', species: 'cat', popular: true,
    label: { en: 'British Shorthair' } },
  { id: 'cat-bengal', species: 'cat', popular: true,
    label: { en: 'Bengal' } },

  // ── full curated list (alphabetical) ─────────────────────────────────
  { id: 'cat-abyssinian', species: 'cat', label: { en: 'Abyssinian' } },
  { id: 'cat-american-shorthair', species: 'cat', label: { en: 'American Shorthair' } },
  { id: 'cat-birman', species: 'cat', label: { en: 'Birman' } },
  { id: 'cat-burmese', species: 'cat', label: { en: 'Burmese' } },
  { id: 'cat-cornish-rex', species: 'cat', label: { en: 'Cornish Rex' } },
  { id: 'cat-devon-rex', species: 'cat', label: { en: 'Devon Rex' } },
  { id: 'cat-exotic-shorthair', species: 'cat', label: { en: 'Exotic Shorthair' } },
  { id: 'cat-himalayan', species: 'cat', label: { en: 'Himalayan' } },
  { id: 'cat-manx', species: 'cat', label: { en: 'Manx' } },
  { id: 'cat-norwegian-forest', species: 'cat', label: { en: 'Norwegian Forest Cat' } },
  { id: 'cat-oriental-shorthair', species: 'cat', label: { en: 'Oriental Shorthair' } },
  { id: 'cat-russian-blue', species: 'cat', label: { en: 'Russian Blue' } },
  { id: 'cat-savannah', species: 'cat', label: { en: 'Savannah' } },
  { id: 'cat-scottish-fold', species: 'cat', label: { en: 'Scottish Fold' } },
  { id: 'cat-somali', species: 'cat', label: { en: 'Somali' } },
  { id: 'cat-sphynx', species: 'cat', label: { en: 'Sphynx' } },
  { id: 'cat-tonkinese', species: 'cat', label: { en: 'Tonkinese' } },
  { id: 'cat-turkish-angora', species: 'cat', label: { en: 'Turkish Angora' } },
  { id: 'cat-turkish-van', species: 'cat', label: { en: 'Turkish Van' } },
];
