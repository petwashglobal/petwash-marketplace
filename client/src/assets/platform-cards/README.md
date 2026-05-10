# Premium Platform Card Assets

This directory holds the approved binary `.webp` card images for the
six platforms in the PetWash ecosystem. Per CEO directive
(2026-05-10), assets are **uploaded separately** by the design team
and are NOT generated, recreated, or auto-translated at runtime.

## Expected files (12 total — 6 platforms × 2 locales)

```
pet-sitter-card.he.webp
pet-sitter-card.en.webp
petfinder-card.he.webp
petfinder-card.en.webp
pettrek-card.he.webp
pettrek-card.en.webp
academy-card.he.webp
academy-card.en.webp
smart-hub-card.he.webp
smart-hub-card.en.webp
walk-my-pet-card.he.webp
walk-my-pet-card.en.webp
```

## Hard rules

- Smart Hub uses the **IP-locked K9000 station image** (1:1 exact;
  never recreate, never resize one bay differently, never alter
  proportions, never modify roof / panels / signage / logo /
  fencing / colors / machine shape).
- Card text inside the image is part of the approved static asset.
  The runtime never auto-translates text inside images.
- Asset language priority is **locale-first** (explicit → profile →
  navigator → IP → English). IP is **never** the primary signal.
  See `client/src/lib/platformCardAsset.ts` for the resolver.
- If a locale variant is missing, the resolver falls back to
  English (`*.en.webp`). If the English variant is also missing,
  the card renders a luxury CSS gradient + heading text only —
  never a fake station drawing, never a synthesized hardware
  illustration.

## Feature flag

The premium card grid renders only when
`VITE_PREMIUM_PLATFORM_CARDS_ENABLED='true'`. Default OFF until
the design team confirms all 12 binaries are committed and the CEO
visual review (mobile + desktop) is complete.
