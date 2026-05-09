/**
 * Curated bird species list (PR-PET-3).
 *
 * Birds are kept species-specific (parakeet, cockatiel, etc.) rather
 * than breed-specific because the popular-pet bird population is
 * dominated by a small number of distinct species, not breeds within
 * a species. The "breed" surface for birds therefore returns this
 * species list.
 *
 * Read-only seed; same shape as dog + cat.
 */

import type { BreedEntry } from './types';

export const BIRD_BREEDS: BreedEntry[] = [
  // ── placeholders ──────────────────────────────────────────────────────
  {
    id: 'bird-mixed',
    species: 'bird',
    placeholder: 'mixed',
    label: {
      en: 'Mixed / hybrid',
      he: 'תערובת',
      ar: 'هجين',
      ru: 'Гибрид',
      fr: 'Hybride',
      es: 'Híbrido',
    },
  },
  {
    id: 'bird-unknown',
    species: 'bird',
    placeholder: 'unknown',
    label: {
      en: 'Unknown species',
      he: 'מין לא ידוע',
      ar: 'نوع غير معروف',
      ru: 'Неизвестный вид',
      fr: 'Espèce inconnue',
      es: 'Especie desconocida',
    },
  },
  {
    id: 'bird-other',
    species: 'bird',
    placeholder: 'other',
    label: {
      en: 'Other / not listed',
      he: 'אחר / לא ברשימה',
      ar: 'أخرى / غير مدرج',
      ru: 'Другое / не в списке',
      fr: 'Autre / non listé',
      es: 'Otro / no listado',
    },
  },

  // ── popular bird species ─────────────────────────────────────────────
  { id: 'bird-parakeet', species: 'bird', popular: true,
    label: { en: 'Parakeet' },
    aliases: ['budgerigar', 'budgie'] },
  { id: 'bird-cockatiel', species: 'bird', popular: true,
    label: { en: 'Cockatiel' } },
  { id: 'bird-canary', species: 'bird', popular: true,
    label: { en: 'Canary' } },
  { id: 'bird-lovebird', species: 'bird', popular: true,
    label: { en: 'Lovebird' } },
  { id: 'bird-african-grey-parrot', species: 'bird',
    label: { en: 'African Grey Parrot' } },
  { id: 'bird-amazon-parrot', species: 'bird',
    label: { en: 'Amazon Parrot' } },
  { id: 'bird-cockatoo', species: 'bird',
    label: { en: 'Cockatoo' } },
  { id: 'bird-conure', species: 'bird',
    label: { en: 'Conure' } },
  { id: 'bird-finch', species: 'bird',
    label: { en: 'Finch' } },
  { id: 'bird-macaw', species: 'bird',
    label: { en: 'Macaw' } },
];
