/**
 * Canonical pet species list (PR-PET-3).
 *
 * Source spec: docs/product/pet-profile-luxury-onboarding-master-plan.md §2.
 *
 * Read-only data. No runtime activation. Localised labels for the
 * 6 PR-PET-2 languages. Where a non-English translation is not yet
 * provided, the helper `getLabel()` falls back to English (matches
 * the PR-PET-2 English-stub pattern; full translation is a separate
 * translator workflow PR class).
 *
 * The `hasBreedList` flag tells future UI which species offer a
 * curated breed autocomplete (dog + cat at v1). All other species
 * default to a free-text breed input at v1, with `mixed` / `unknown`
 * placeholders always available regardless.
 */

import {
  type SpeciesEntry,
  SUPPORTED_SPECIES,
} from './pet-breeds/types';

export const PET_SPECIES: SpeciesEntry[] = [
  {
    id: 'dog',
    hasBreedList: true,
    label: {
      en: 'Dog',
      he: 'כלב',
      ar: 'كلب',
      ru: 'Собака',
      fr: 'Chien',
      es: 'Perro',
    },
  },
  {
    id: 'cat',
    hasBreedList: true,
    label: {
      en: 'Cat',
      he: 'חתול',
      ar: 'قطة',
      ru: 'Кошка',
      fr: 'Chat',
      es: 'Gato',
    },
  },
  {
    id: 'bird',
    hasBreedList: true,
    label: {
      en: 'Bird',
      he: 'ציפור',
      ar: 'طائر',
      ru: 'Птица',
      fr: 'Oiseau',
      es: 'Pájaro',
    },
  },
  {
    id: 'rabbit',
    hasBreedList: false,
    label: {
      en: 'Rabbit',
      he: 'ארנב',
      ar: 'أرنب',
      ru: 'Кролик',
      fr: 'Lapin',
      es: 'Conejo',
    },
  },
  {
    id: 'guinea_pig',
    hasBreedList: false,
    label: {
      en: 'Guinea pig',
      he: 'שרקן',
      ar: 'خنزير غينيا',
      ru: 'Морская свинка',
      fr: "Cochon d'Inde",
      es: 'Cobaya',
    },
  },
  {
    id: 'reptile',
    hasBreedList: false,
    label: {
      en: 'Reptile',
      he: 'זוחל',
      ar: 'زاحف',
      ru: 'Рептилия',
      fr: 'Reptile',
      es: 'Reptil',
    },
  },
  {
    id: 'snake',
    hasBreedList: false,
    label: {
      en: 'Snake',
      he: 'נחש',
      ar: 'ثعبان',
      ru: 'Змея',
      fr: 'Serpent',
      es: 'Serpiente',
    },
  },
  {
    id: 'small_mammal',
    hasBreedList: false,
    label: {
      en: 'Small mammal',
      he: 'יונק קטן',
      ar: 'ثدييات صغيرة',
      ru: 'Мелкий зверёк',
      fr: 'Petit mammifère',
      es: 'Mamífero pequeño',
    },
  },
  {
    id: 'other',
    hasBreedList: false,
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

export function getSpecies(id: string): SpeciesEntry | undefined {
  return PET_SPECIES.find((s) => s.id === id);
}

export function isSupportedSpecies(id: string): id is SpeciesEntry['id'] {
  return (SUPPORTED_SPECIES as readonly string[]).includes(id);
}
