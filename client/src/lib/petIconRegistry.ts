/**
 * petIconRegistry.ts — ONE source of truth for PetWash's luxury icon set.
 *
 * The CEO designed a premium colour icon system (gold + emerald + blush on white)
 * to replace basic emojis everywhere. This registry maps a stable semantic name
 * → its emoji FALLBACK + human label. The <PetIcon> component renders the real
 * cut-out asset from /pet-icons/<name>.<ext> once it exists, and falls back to
 * the emoji until then — so the UI is never broken while assets are being added.
 *
 * To go live with the real icons:
 *   1. Export each icon from the master sheet as a TRANSPARENT-background file
 *      (PNG or WEBP, ≥256px square, cut tight to the artwork) named exactly by the
 *      key below — e.g. dog.png, shampoo.png, paw.png — into client/public/pet-icons/.
 *   2. Set VITE_PET_ICONS_ENABLED='true'. That flips the whole app from emoji to
 *      your icons in one switch. (Per-device crispness: transparent + ≥256px.)
 */

export interface PetIconEntry {
  /** Emoji shown until the real asset is dropped in. */
  emoji: string;
  /** Accessible label (English). */
  label: string;
}

export const PET_ICONS = {
  // ── Animals (the "animal family") ──────────────────────────────────────────
  dog:          { emoji: '🐶', label: 'Dog' },
  cat:          { emoji: '🐱', label: 'Cat' },
  rabbit:       { emoji: '🐰', label: 'Rabbit' },
  'guinea-pig': { emoji: '🐹', label: 'Guinea pig' },
  hamster:      { emoji: '🐹', label: 'Hamster' },
  ferret:       { emoji: '🦡', label: 'Ferret' },
  snake:        { emoji: '🐍', label: 'Snake' },
  lizard:       { emoji: '🦎', label: 'Lizard' },
  hedgehog:     { emoji: '🦔', label: 'Hedgehog' },
  chick:        { emoji: '🐥', label: 'Chick' },
  bird:         { emoji: '🦜', label: 'Bird / Parrot' },
  swan:         { emoji: '🦢', label: 'Swan' },
  butterfly:    { emoji: '🦋', label: 'Butterfly' },
  fish:         { emoji: '🐠', label: 'Fish' },
  turtle:       { emoji: '🐢', label: 'Turtle' },
  pony:         { emoji: '🐴', label: 'Pony' },
  horse:        { emoji: '🐴', label: 'Horse' },
  goat:         { emoji: '🐐', label: 'Goat' },
  sheep:        { emoji: '🐑', label: 'Sheep' },
  pig:          { emoji: '🐷', label: 'Pig' },

  // ── Care, products, grooming ───────────────────────────────────────────────
  paw:               { emoji: '🐾', label: 'Paw print' },
  'pet-owner':       { emoji: '🤗', label: 'Pet owner with pet' },
  'botanical-leaf':  { emoji: '🌿', label: 'Botanical leaf' },
  'organic-sprig':   { emoji: '🌱', label: 'Organic sprig' },
  shampoo:           { emoji: '🧴', label: 'Shampoo' },
  conditioner:       { emoji: '🧴', label: 'Conditioner' },
  'organic-soap':    { emoji: '🧼', label: 'Organic soap' },
  bubbles:           { emoji: '🫧', label: 'Wash bubbles' },
  'water-droplet':   { emoji: '💧', label: 'Water droplet' },
  'grooming-brush':  { emoji: '🪮', label: 'Grooming brush' },
  comb:              { emoji: '🪮', label: 'Comb' },
  scissors:          { emoji: '✂️', label: 'Scissors' },
  towel:             { emoji: '🧖', label: 'Towel' },
  'natural-ingredients': { emoji: '🌿', label: 'Natural ingredients' },

  // ── Accessories & extras ───────────────────────────────────────────────────
  collar:        { emoji: '🦮', label: 'Collar / tag' },
  tag:           { emoji: '🏷️', label: 'Engraved tag' },
  treat:         { emoji: '🍪', label: 'Treat' },
  bone:          { emoji: '🦴', label: 'Bone' },
  sparkle:       { emoji: '✨', label: 'Sparkle / clean' },
  heart:         { emoji: '❤️', label: 'Heart' },
  'pet-safe':    { emoji: '🛡️', label: 'Pet-safe care' },
  perfume:       { emoji: '🌸', label: 'Perfume mist' },
  'gift-box':    { emoji: '🎁', label: 'Gift box' },
  leash:         { emoji: '🦮', label: 'Luxury leash' },
  'pet-bed':     { emoji: '🛏️', label: 'Pet bed' },
  'carrier-bag': { emoji: '👜', label: 'Carrier bag' },

  // ── Services ───────────────────────────────────────────────────────────────
  'self-wash':    { emoji: '🛁', label: 'Self wash' },
  grooming:       { emoji: '✂️', label: 'Grooming' },
  'mobile-wash':  { emoji: '🚐', label: 'Mobile wash' },
  'pet-sitting':  { emoji: '🏠', label: 'Pet sitting' },
  'dog-walking':  { emoji: '🐾', label: 'Dog walking' },
  'pet-hosting':  { emoji: '🛏️', label: 'Pet hosting' },
  'pet-transport':{ emoji: '🚗', label: 'Pet transport' },
  training:       { emoji: '🎓', label: 'Training' },
  'vet-care':     { emoji: '🩺', label: 'Vet care' },
  'pet-shop':     { emoji: '🛍️', label: 'Pet shop' },
} as const;

export type PetIconName = keyof typeof PET_ICONS;

/** True once the real cut-out assets are uploaded + the flag is flipped. */
export const PET_ICONS_ENABLED =
  (import.meta as any).env?.VITE_PET_ICONS_ENABLED === 'true';
