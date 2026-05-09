/**
 * Curated dog breed list (PR-PET-3).
 *
 * Read-only seed for the future autocomplete (PR-PET-5). The list is
 * deliberately curated, not exhaustive — it covers the most-frequently-
 * matched breeds in marketplaces of comparable scale (about 40 entries).
 * The list grows in subsequent locale-translation / dataset PRs; the
 * canonical id of each existing entry is stable across growth.
 *
 * Localisation: `en` is canonical; non-English fields are populated
 * where confident (most breed names are loanwords). Where omitted,
 * `getLabel()` falls back to English — matches PR-PET-2 English-stub
 * pattern. A separate translator-workflow PR class will fill in the
 * remaining gaps over time.
 *
 * Always present (the placeholders the PR-PET-2 i18n keys require):
 *   • dog-mixed     ↔ petOnboarding.breed.mixed
 *   • dog-unknown   ↔ petOnboarding.breed.unknown
 *   • dog-other     ↔ petOnboarding.breed.cantFind
 */

import type { BreedEntry } from './types';

export const DOG_BREEDS: BreedEntry[] = [
  // ── placeholders (always available; UI labels them differently) ───────
  {
    id: 'dog-mixed',
    species: 'dog',
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
    id: 'dog-unknown',
    species: 'dog',
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
    id: 'dog-other',
    species: 'dog',
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

  // ── popular breeds (curated; ~10 most-searched globally) ─────────────
  { id: 'dog-labrador-retriever', species: 'dog', popular: true,
    label: { en: 'Labrador Retriever' },
    aliases: ['lab', 'labrador'] },
  { id: 'dog-golden-retriever', species: 'dog', popular: true,
    label: { en: 'Golden Retriever' },
    aliases: ['golden'] },
  { id: 'dog-german-shepherd', species: 'dog', popular: true,
    label: { en: 'German Shepherd' },
    aliases: ['gsd', 'alsatian'] },
  { id: 'dog-french-bulldog', species: 'dog', popular: true,
    label: { en: 'French Bulldog' },
    aliases: ['frenchie'] },
  { id: 'dog-poodle', species: 'dog', popular: true,
    label: { en: 'Poodle' },
    aliases: ['standard poodle', 'miniature poodle', 'toy poodle'] },
  { id: 'dog-beagle', species: 'dog', popular: true,
    label: { en: 'Beagle' } },
  { id: 'dog-bulldog', species: 'dog', popular: true,
    label: { en: 'Bulldog' },
    aliases: ['english bulldog'] },
  { id: 'dog-rottweiler', species: 'dog', popular: true,
    label: { en: 'Rottweiler' },
    aliases: ['rottie'] },
  { id: 'dog-dachshund', species: 'dog', popular: true,
    label: { en: 'Dachshund' },
    aliases: ['sausage dog', 'wiener dog'] },
  { id: 'dog-yorkshire-terrier', species: 'dog', popular: true,
    label: { en: 'Yorkshire Terrier' },
    aliases: ['yorkie'] },

  // ── full curated list (alphabetical after popular) ───────────────────
  { id: 'dog-akita', species: 'dog', label: { en: 'Akita' } },
  { id: 'dog-alaskan-malamute', species: 'dog', label: { en: 'Alaskan Malamute' } },
  { id: 'dog-australian-shepherd', species: 'dog', label: { en: 'Australian Shepherd' },
    aliases: ['aussie'] },
  { id: 'dog-basset-hound', species: 'dog', label: { en: 'Basset Hound' } },
  { id: 'dog-bernese-mountain-dog', species: 'dog', label: { en: 'Bernese Mountain Dog' } },
  { id: 'dog-bichon-frise', species: 'dog', label: { en: 'Bichon Frise' } },
  { id: 'dog-border-collie', species: 'dog', label: { en: 'Border Collie' } },
  { id: 'dog-boston-terrier', species: 'dog', label: { en: 'Boston Terrier' } },
  { id: 'dog-boxer', species: 'dog', label: { en: 'Boxer' } },
  { id: 'dog-cane-corso', species: 'dog', label: { en: 'Cane Corso' } },
  { id: 'dog-cavalier-king-charles', species: 'dog', label: { en: 'Cavalier King Charles Spaniel' } },
  { id: 'dog-chihuahua', species: 'dog', label: { en: 'Chihuahua' } },
  { id: 'dog-cocker-spaniel', species: 'dog', label: { en: 'Cocker Spaniel' } },
  { id: 'dog-collie', species: 'dog', label: { en: 'Collie' } },
  { id: 'dog-dalmatian', species: 'dog', label: { en: 'Dalmatian' } },
  { id: 'dog-doberman', species: 'dog', label: { en: 'Doberman Pinscher' },
    aliases: ['dobie'] },
  { id: 'dog-english-springer-spaniel', species: 'dog', label: { en: 'English Springer Spaniel' } },
  { id: 'dog-great-dane', species: 'dog', label: { en: 'Great Dane' } },
  { id: 'dog-husky', species: 'dog', label: { en: 'Siberian Husky' },
    aliases: ['husky'] },
  { id: 'dog-irish-setter', species: 'dog', label: { en: 'Irish Setter' } },
  { id: 'dog-jack-russell-terrier', species: 'dog', label: { en: 'Jack Russell Terrier' },
    aliases: ['jrt'] },
  { id: 'dog-maltese', species: 'dog', label: { en: 'Maltese' } },
  { id: 'dog-mastiff', species: 'dog', label: { en: 'Mastiff' } },
  { id: 'dog-newfoundland', species: 'dog', label: { en: 'Newfoundland' },
    aliases: ['newfie'] },
  { id: 'dog-papillon', species: 'dog', label: { en: 'Papillon' } },
  { id: 'dog-pekingese', species: 'dog', label: { en: 'Pekingese' } },
  { id: 'dog-pomeranian', species: 'dog', label: { en: 'Pomeranian' },
    aliases: ['pom'] },
  { id: 'dog-pug', species: 'dog', label: { en: 'Pug' } },
  { id: 'dog-rhodesian-ridgeback', species: 'dog', label: { en: 'Rhodesian Ridgeback' } },
  { id: 'dog-saint-bernard', species: 'dog', label: { en: 'Saint Bernard' } },
  { id: 'dog-samoyed', species: 'dog', label: { en: 'Samoyed' } },
  { id: 'dog-schnauzer', species: 'dog', label: { en: 'Schnauzer' } },
  { id: 'dog-shar-pei', species: 'dog', label: { en: 'Shar-Pei' } },
  { id: 'dog-shih-tzu', species: 'dog', label: { en: 'Shih Tzu' } },
  { id: 'dog-vizsla', species: 'dog', label: { en: 'Vizsla' } },
  { id: 'dog-weimaraner', species: 'dog', label: { en: 'Weimaraner' } },
  { id: 'dog-whippet', species: 'dog', label: { en: 'Whippet' } },
];
