# PetWash Smart Luxury Icon System (CEO spec, 2026-06-23)

Replace ALL basic emojis with a controlled, asset-based luxury icon system. Emojis
make the brand look cheap — this is a brand-quality requirement.

## Status

- ✅ **Extraction pipeline**: `scripts/extract-pet-icons.mjs` — auto-detects icon
  content boxes (NOT blind row bands), cuts the white background (edge flood-fill,
  preserves interior whites via the gold outlines), trims, centers on a **white
  square tile with breathing space** (icon ~74%, ≥13% padding), names by `icon_key`,
  writes to the category folder. No labels, no header text, no clipping, no grey.
- ✅ **24 colour (Mode B) icons extracted** from board 1 → `client/public/assets/icons/petwash/{animals,products,nature,trust,brand}/`.
- ✅ **Registry** `client/src/lib/petwash-icons.ts` (`PETWASH_ICONS`, `PetWashIconName`,
  `resolvePetWashIcon`, `DEFAULT_PETWASH_ICON`) + **component** `client/src/components/PetWashIcon.tsx`
  (`<PetWashIcon name="animal_dog" size={44} label="Dog"/>`) with luxury default
  fallback — **never an emoji**.
- (Supersedes the earlier simpler `PetIcon`/`petIconRegistry` from #1002, which had an
  emoji fallback. New code should use `PetWashIcon`.)

## Folder + naming (spec)

`client/public/assets/icons/petwash/<category>/<icon_key>.png` served at
`/assets/icons/petwash/...`. Categories: animals, services, products, nature, trust,
app, station, status, finance, brand. Keys are stable: `animal_dog`, `service_grooming`,
`product_shampoo`, `trust_insured`, `app_wallet`, `status_approved` — never emoji.

## Two visual modes

- **Mode A — Luxury outline** (thin gold line, white bg): app nav, admin, forms, legal,
  settings. (Source: the CEO's gold line-art board — NOT yet extracted.)
- **Mode B — Colour luxury** (soft colour + gold trim + pearl/emerald/blush): marketing,
  onboarding, animal family, shop, welcome. (Board 1 — DONE.)

## Design tokens (spec §17)

`--petwash-gold #C79A3B · --petwash-deep-gold #9E7428 · --petwash-black #111111 ·
--petwash-charcoal #2A2A2A · --petwash-white #FFFFFF · --petwash-pearl #F8F5EF ·
--petwash-emerald #0F6B4F · --petwash-teal #2BAEAE · --petwash-blush #E7A7A7 ·
--petwash-soft-lilac #B8A7D9`. Black text for readability; gold = accent only, never
unreadable body text; white/pearl backgrounds; emerald/teal/blush as soft accents.

White-card style for UI (spec §13): `.petwash-icon-card` — white bg, 1px gold-28%
border, radius 22, soft shadow, padding 14; img object-contain.

## Remaining work (NOT done — sequenced)

**More icon assets to extract** (the CEO has more boards in Downloads):
- Mode A gold outline set (board 2) → same pipeline, new coordinates.
- Colour collection board (40+ incl. hamster, ferret, lizard, hedgehog, chick, swan,
  butterfly, goat, sheep, pig, organic soap, comb, scissors, perfume, gift box, heart,
  bone, leash, pet bed, carrier bag, engraved tag).
- Ecosystem board → services (self_wash, grooming, mobile_wash, pet_sitting,
  dog_walking, hosting, transport, training, vet_care, pet_shop), trust badges
  (id_verified, insured, background_checked, top_provider, 5_star, 24_7_support,
  paw_care_certified), app (wallet, qr, booking, live_tracking, rewards, support,
  location, calendar, upload_document), station (smart_hub, k9000_dual_bay,
  uv_sanitized, paw_dryer, hydro_massage, aroma_spa, flea_tick_care, dental_care).

**Emoji removal sweep** (spec §13/§16) — ~66 client files use inline emojis; replace
with `<PetWashIcon>`. Priority order (spec §18): 1) provider onboarding 2) Prestige
wallet/rewards 3) service category cards 4) animal-type picker 5) trust/safety badges
6) Smart Hub stations 7) shop product categories 8) admin status icons.

**Data model** (spec §12/§14) — add `icon_key TEXT` to: pet_types, service_categories,
provider_badges, product_categories, station_features, onboarding_steps, trust_badges,
app_navigation_items. Migrate seed emoji → icon_key. Never store emoji as icon value.

**iOS/Xcode** (spec §7) — asset catalogs `Assets.xcassets/PetWashIcons/<key>.imageset`
+ SwiftUI `Image(name)`. (CEO-side build; I can prep the asset files + a manifest.)

## QC checklist (spec §16) — before each rollout step
No emoji in UI/onboarding/wallet/admin/cards/pickers/stations/shop · all load on mobile ·
alt labels · consistent · white screens clean · gold accent only · He/En RTL ok · dark mode ok.
