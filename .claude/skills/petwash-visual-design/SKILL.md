---
name: petwash-visual-design
description: Make any PetWash screen visually flawless — like a top fashion house. Use before/after touching any UI to check icon & logo placement, alignment, spacing rhythm, borders/lines, mobile overflow, RTL (Hebrew), and brand palette. Enforces the hard brand rules (real logo asset only — never redraw it; white/black/gold, green-marble only for Pet Passport). Includes a repeatable "designer's eye" audit that finds broken/misplaced elements objectively (overflow, misalignment, off-brand color, broken images), not by guessing.
---

# PetWash Visual Design & Polish Skill

PetWash is a **luxury** pet brand. The bar is a top fashion house: clean, precise, nothing out of place. A single misaligned icon, a logo an inch off-center, a card whose text bleeds past the screen edge, or an off-brand color reads as cheap and kills trust. This skill is the "little designer with smart logic" — it makes screens **perfect**, and it finds imperfection **objectively** instead of eyeballing.

## 0. The hard brand rules (NEVER violate — these override taste)
1. **The logo is a real asset — NEVER hand-draw, recreate, or approximate it.** No inline SVG paw/crown, no emoji stand-in, no "close enough" mark. Use the actual brand file (top-center crown wordmark). If a screen or image shows a *different* mark (e.g. a green heart/paw "PetWash Smart Hub" badge that isn't the official logo), that is a **bug** — flag it for the real asset, do not redraw a replacement. (See memory: `logo-rule`.)
2. **Palette is disciplined:** primary **white + black + gold `#D4AF37`**. The **green-marble** set (`#063B22` / `#D6B56D` / `#FAFAF7`) is **only** for the Pet Passport surface — do not spray green across the rest of the app. Never introduce a new accent color without CEO sign-off. Semantic colors (success/warn/error) are separate and don't count as brand accent.
3. **Product/brand names stay in English**, ™ after the word (`Pet Wash™`, `The Sitter Suite™`, `Pet Wash™ Smart Hub`) — never translate them, even in Hebrew UI. (See memory: `brand-language-platform-names`.)
4. **Mockups are canonical where they exist** (CEO's own designs — Pet Passport, Shop, Signup, 32-screen flow). Wire pixel-faithful; do not "improve" an approved design. (See memory: `canonical-app-designs`.)

## 1. The designer's eye — 8 checks, every screen
Run all eight before declaring a screen done. Each has an **objective** test, not a vibe.

1. **No mobile overflow.** Nothing may be wider than the viewport. On a 390px-wide screen, `document.documentElement.scrollWidth` must equal `clientWidth`. Any horizontal scrollbar or content cut off at the right edge = a bug. Usual causes: a fixed `w-[…]`, `whitespace-nowrap` on long text, a `flex` row that doesn't `flex-wrap`, negative margins, an image without `max-w-full`, or a `min-w` child inside a grid cell that lacks `min-w-0`.
2. **Alignment & grid.** Icons, titles, prices, CTAs line up on a shared baseline/left edge across sibling cards. Optical centering for logos/icons (a crown/paw isn't centered by its bounding box). Cards in a row are equal height (`items-stretch` / `h-full`).
3. **Spacing rhythm.** Use one spacing scale (4/8/12/16/24/32). Gaps between siblings come from the parent's `gap`, not ad-hoc per-child margins that collapse or double. Consistent section padding top and bottom.
4. **Borders & lines.** Hairlines are crisp and consistent (same color token, same width). Radii are consistent within a surface. No doubled borders where a divider meets a card edge.
5. **Logo & icon placement.** Real logo asset, correct position (top-center crown), never stretched (lock aspect ratio). Icons from one set, one stroke weight, one size step. No emoji as a structural icon in luxury surfaces.
6. **Typography.** One display face (Playfair/Didot for headings) + one clean body face; a real type scale; headings `text-wrap: balance`; body ~65ch; uppercase labels get letter-spacing. No orphaned single words, no clipped ascenders/descenders (`leading-tight` + adequate line-height).
7. **RTL / Hebrew.** In Hebrew the layout mirrors: text right-aligned, arrows flip (`rotate-180`), padding/margin swap sides. Numbers and English product names stay LTR. Check the screen in both `he` and `en`.
8. **Images.** Every `<img>` has real dimensions or aspect-ratio (no layout shift), `max-w-full`, `object-cover`/`object-contain` chosen deliberately, and is not a broken/placeholder asset. Marketing renders must show the **real** logo (see rule 1).

## 2. How to audit objectively (the "logic", not eyeballing)
Prefer measurement over screenshots for anything precise:
- **Overflow sweep (do this first, it catches the most "broken" reports):** at mobile width, walk the DOM and list every element whose `scrollWidth > clientWidth` or whose right edge exceeds the viewport. Those are the "outside / broken / not in place" elements. Example probe to run in the page:
  ```js
  [...document.querySelectorAll('*')].filter(el => {
    const r = el.getBoundingClientRect();
    return r.right > window.innerWidth + 1 || el.scrollWidth > el.clientWidth + 1;
  }).map(el => ({ tag: el.tagName, cls: el.className, right: Math.round(el.getBoundingClientRect().right) }));
  ```
- **Verify CSS with the inspector, not a screenshot** — read computed `padding`, `color`, `font-size`, `gap` (see the preview `preview_inspect` tool). Colors/spacing must be verified as numbers.
- **Check both breakpoints** (mobile 390, desktop ≥1280) and **both languages** (en, he).
- **Confirm the fix** by re-running the overflow probe → empty result.

## 3. Common PetWash fixes (reach for these)
- Grid cell text bleeding: add `min-w-0` to the flex/grid child and `line-clamp-*` / `break-words` to the text.
- Row overflowing on mobile: `flex-wrap`, or make it an intentional `overflow-x-auto` scroller (with `snap`), never a silent cut-off.
- Image overflow / stretch: `max-w-full h-auto` + explicit aspect-ratio; `object-contain` for logos, `object-cover` for photos.
- Off-center logo: wrap in a flex container with `justify-center` AND nudge for optical center; never scale the logo file non-uniformly.
- Off-brand green leaking out of Pet Passport: replace with black/gold tokens.

## Definition of done
Zero mobile overflow (probe returns empty) · alignment & equal-height cards verified · one spacing scale · crisp consistent borders/radii · REAL logo asset in the correct place (no redrawn mark) · palette on-brand (green only on Pet Passport) · type scale + balanced headings · RTL correct in Hebrew · no broken/stretched images · CSS verified by inspector numbers, not a screenshot.
