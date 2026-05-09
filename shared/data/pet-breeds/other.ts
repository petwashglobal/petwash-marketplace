/**
 * Placeholder breed entries for species without a curated list (PR-PET-3).
 *
 * For rabbit, guinea_pig, reptile, snake, small_mammal, other — v1 uses
 * free-text breed input on the UI side (PR-PET-5 onward will wire that).
 * The placeholder rows below are still required so:
 *   • The autocomplete API can return mixed/unknown/other consistently
 *     across all species.
 *   • The PR-PET-2 i18n keys (petOnboarding.breed.mixed / unknown /
 *     cantFind) have a uniform target shape regardless of species.
 *   • Future curated growth (e.g. PR-PET-3.b adds a curated rabbit list)
 *     can append to this file without changing call-site code.
 */

import type { BreedEntry } from './types';

export const OTHER_BREEDS: BreedEntry[] = [
  // rabbit
  {
    id: 'rabbit-mixed', species: 'rabbit', placeholder: 'mixed',
    label: { en: 'Mixed breed', he: 'תערובת', ar: 'سلالة مختلطة',
             ru: 'Метис', fr: 'Bâtard', es: 'Mestizo' },
  },
  {
    id: 'rabbit-unknown', species: 'rabbit', placeholder: 'unknown',
    label: { en: 'Unknown breed' },
  },
  {
    id: 'rabbit-other', species: 'rabbit', placeholder: 'other',
    label: { en: 'Other / not listed' },
  },

  // guinea_pig
  {
    id: 'guinea-pig-mixed', species: 'guinea_pig', placeholder: 'mixed',
    label: { en: 'Mixed breed', he: 'תערובת', ar: 'سلالة مختلطة',
             ru: 'Метис', fr: 'Bâtard', es: 'Mestizo' },
  },
  {
    id: 'guinea-pig-unknown', species: 'guinea_pig', placeholder: 'unknown',
    label: { en: 'Unknown breed' },
  },
  {
    id: 'guinea-pig-other', species: 'guinea_pig', placeholder: 'other',
    label: { en: 'Other / not listed' },
  },

  // reptile
  {
    id: 'reptile-mixed', species: 'reptile', placeholder: 'mixed',
    label: { en: 'Mixed / hybrid' },
  },
  {
    id: 'reptile-unknown', species: 'reptile', placeholder: 'unknown',
    label: { en: 'Unknown species' },
  },
  {
    id: 'reptile-other', species: 'reptile', placeholder: 'other',
    label: { en: 'Other / not listed' },
  },

  // snake
  {
    id: 'snake-mixed', species: 'snake', placeholder: 'mixed',
    label: { en: 'Mixed / hybrid' },
  },
  {
    id: 'snake-unknown', species: 'snake', placeholder: 'unknown',
    label: { en: 'Unknown species' },
  },
  {
    id: 'snake-other', species: 'snake', placeholder: 'other',
    label: { en: 'Other / not listed' },
  },

  // small_mammal
  {
    id: 'small-mammal-mixed', species: 'small_mammal', placeholder: 'mixed',
    label: { en: 'Mixed / hybrid' },
  },
  {
    id: 'small-mammal-unknown', species: 'small_mammal', placeholder: 'unknown',
    label: { en: 'Unknown species' },
  },
  {
    id: 'small-mammal-other', species: 'small_mammal', placeholder: 'other',
    label: { en: 'Other / not listed' },
  },

  // other (catch-all species; no curated list ever — by definition)
  {
    id: 'other-unknown', species: 'other', placeholder: 'unknown',
    label: {
      en: 'Other pet',
      he: 'חיית מחמד אחרת',
      ar: 'حيوان أليف آخر',
      ru: 'Другой питомец',
      fr: 'Autre animal',
      es: 'Otra mascota',
    },
  },
];
