# EGift Visual QA — Phase B + Phase E Scoping Proposal

**Status:** Read-only audit findings + tight scope proposal for the next two implementation PRs. NO code changes by this PR.
**Origin:** CEO live testing on iPhone + iPad, May 2026.
**Companion docs:** `EGIFT_LUXURY_ATMOSPHERE_REDESIGN.md` (the parent direction, merged in PR #262).
**Tokens already on main:** Phase A from PR #263 — `ink-900`, `ink-800`, `ink-400`, `stage-white`, `stage-50`, `gold-luxe`, `gold-600`, `gold-300`, `occasion-birthday/love/thanks/holiday`, `editorial-xs/sm/md/lg/xl`, `stage-soft/lifted/cinema`. **Zero consumers today** — Phase B is the first consumer.

---

## Important warnings

1. **Nothing in this PR changes code, schema, or infrastructure.** It is the scoping document for two small PRs (Phase B for atmosphere, Phase E for floating-button quieting). Both PRs are deferred to explicit CEO greenlight after this doc is approved.
2. **The card artwork and `LuxuryGiftCard` component stay untouched.** Out of scope, confirmed for the second time.
3. **No payment, checkout, server, schema, env, VAT, or legal-logic changes.** Phase B is pure visual/CSS. Phase E is a small frontend behavior change (one IntersectionObserver hook).
4. **Scope is /egift only.** Token migration to other pages is a future workstream not proposed here.

---

## 0. TL;DR — the single root cause

The egift page has **zero `md:` (iPad portrait) breakpoint variants anywhere in `client/src/pages/EGift.tsx`**. That single fact explains roughly 40 percent of the cross-breakpoint inconsistency the CEO reports. The page jumps from `sm:` (640px+, large iPhone landscape) straight to `lg:` (1024px+, iPad landscape and laptop) with no intermediate refinement, so iPad portrait (768–1023px) renders as "large mobile" — same text sizes, same paddings, same grid columns as a 7-inch phone.

Four secondary causes compound it:

- The hero block uses an inline cream gradient (`#F8F4EE` → `#F0EBE0` → `#F8F4EE`) that renders identically on all breakpoints. This is the "washed-out beige" the CEO sees.
- All body text uses warm muted grays (`#7A7068`, `#9A8A70`, `#BBAA90`) instead of deep luxury ink. Reads as low-energy on iPhone OLED.
- Section labels are inconsistent in size and tracking — some have `sm:` variants, some do not, creating visual rhythm breaks across the page.
- Floating WhatsApp + Accessibility buttons render unconditionally on every route with no awareness of the egift hero, dominating the visual hierarchy with saturated green and black above-the-fold.

Phase B fixes the first four. Phase E fixes the floating-buttons issue (with the user-approved Option 1 context-aware fade from Decision C).

---

## 1. The five root causes (from the audit)

### 1.1 ZERO `md:` variants in EGift.tsx

Audit counted: 48 `sm:` prefix uses, 12 `lg:` prefix uses, 0 `md:` prefix uses, 0 `xl:` or `2xl:` uses. The implication on iPad portrait (768–1023px):

- H1 stuck at `sm:text-4xl` (36px), then jumps to `lg:text-[3.2rem]` (51.2px). 15px jump at the laptop breakpoint, nothing intermediate.
- Form layout grid-cols-1 → `sm:grid-cols-2` → `lg:grid-cols-2` — iPad portrait inherits a 2-column form designed for a phone, no widening for the tablet.
- Section labels at `text-[10px]` or `sm:text-[11px]` stay at the smartphone size all the way through desktop.
- Padding on chips and toggles scales at `sm:` and then freezes through `lg:`, so iPad sees phone-sized chips.

### 1.2 Hero cream gradient is inline, not responsive

`EGift.tsx:1295` — `style={{ background: 'linear-gradient(120deg, #F8F4EE 0%, #F0EBE0 60%, #F8F4EE 100%)', minHeight: '200px' }}`. Same gradient on all viewports. `minHeight: 200px` is correct for a phone but underwhelming for a tablet or desktop hero.

### 1.3 Body text uses warm muted grays everywhere

Inventory from the audit:

- `#1A1A1A` — 14 uses, near-black for headings. Acceptable. Will become `text-ink-900` in Phase B.
- `#9A8A70` — 12 uses, muted warm gray. The "form labels feel faded" issue. Becomes `text-ink-800` in Phase B.
- `#7A7068` — 4 uses, warm brown. Body copy and chip text. Becomes `text-ink-800` or `text-ink-400` depending on context.
- `#c9a96e` — 11+ uses, warm tan for section labels and accents. Becomes `text-gold-luxe` (the deeper `#A88B4C` approved in Decision A).
- `#BBAA90`, `#0f0d08`, `#6a5f42`, `#5a5040`, `#7a6e55` — scattered usage on hero step labels, card pricing, and card decorative text.

### 1.4 Section labels are inconsistent in size/weight/tracking

- "PLATFORM CREDIT" (`EGift.tsx:1374`) — `text-[10px] sm:text-[11px] tracking-[0.35em]`.
- "Choose Occasion" (`EGift.tsx:1390`) — `text-[10px] tracking-[0.25em]` (no `sm:`).
- "Choose Services" (`EGift.tsx:1455`) — `text-[10px] tracking-[0.25em]` (no `sm:`).
- "PetWash Premium" hero subhead (`EGift.tsx:1327`) — `text-[10px] tracking-[0.4em]` (no `sm:`).

Same `font-medium` weight, same `#c9a96e` color, but three different tracking values and inconsistent `sm:` variants. Phase B standardizes them all to `font-semibold` + `text-gold-luxe` + `tracking-[0.4em]` with consistent `md:text-[12px]` scaling.

### 1.5 Floating WhatsApp + Accessibility buttons dominate the hero

- `WhatsAppChat.tsx` — rendered via `<FloatingStack>` in `App.tsx:3273`, NO pathname conditional. Always visible.
- Position: bottom-right, `bottom: calc(88px + safe-area)`, `right: 16px` mobile / 24px desktop.
- Color: `#25D366` saturated green with `animate-ping` opacity ring.
- z-index: 9050 (very high).
- AccessibilityButton: same FloatingStack, `bottom: calc(160px + safe-area)`, `#000` black, 56px diameter, z-index 9050. Modal opens at z-9200.
- Both rendered unconditionally on /egift — confirmed: NO `useLocation()` check, NO IntersectionObserver, NO conditional hiding.

On iPhone OLED with the cards-and-hero composition, these two saturated floating buttons are the brightest, most-contrasted elements above the fold. They dominate the visual hierarchy exactly as the CEO described.

---

## 2. Phase B scope — atmosphere fixes in EGift.tsx ONLY

**One file. Token swaps + `md:` variants. No new components, no new dependencies, no behavior change.**

### 2.1 Hero block (lines 1295–1328)

- **Replace** the inline cream gradient with `bg-stage-white` plus a 4-percent gold radial halo: `bg-stage-white bg-[radial-gradient(circle_at_50%_-20%,rgba(168,139,76,0.04)_0%,transparent_60%)]`.
- **Remove** the inline `style={{ background: ..., minHeight: '200px' }}` block entirely.
- **Increase** vertical rhythm: `py-editorial-xl` replaces `py-12 sm:py-16`.
- **Add** `md:py-20 lg:py-24` for explicit tablet/desktop pacing.
- H1: `text-3xl sm:text-4xl md:text-5xl lg:text-[3.2rem]` (adds `md:` variant). Weight changes from `font-light` to `font-extralight`. Color stays at deep ink (will read as `text-ink-900` after token migration in 2.2).
- Hero subhead: `text-2xl sm:text-3xl md:text-[2rem] lg:text-[2.4rem]` (adds `md:` and `lg:` variants).
- Card tier labels: `w-28 h-16 sm:w-36 sm:h-20 md:w-44 md:h-24` (adds `md:` variant).

### 2.2 Body text + label color migration

Every inline hex code becomes a Phase A token in this PR:

| Inline hex | Becomes token | Usage |
|---|---|---|
| `text-[#1A1A1A]` | `text-ink-900` | H1, H2, key marks |
| `text-[#9A8A70]` | `text-ink-800` | Body labels, form input labels |
| `text-[#7A7068]` | `text-ink-400` (utility) or `text-ink-800` (body) | Chip text, subtext — case by case |
| `text-[#c9a96e]` | `text-gold-luxe` | Section labels, accent icons, checkmarks |
| `text-[#BBAA90]` | `text-ink-400` | Hero step descriptions |
| `bg-[#FFFFFF]` | `bg-stage-white` | Form surfaces, input backgrounds |
| `border-[#E8E3D9]` | `border-ink-900/12` | Chip + toggle unselected borders |

Audit identified 11 `#c9a96e` uses, 14 `#1A1A1A` uses, 12 `#9A8A70` uses, 4 `#7A7068` uses, 2 `#BBAA90` uses. Total inline-hex swaps in this PR: roughly 50–60 substitutions across the 1583-line file. All mechanical.

### 2.3 Section labels — standardize

All "PLATFORM CREDIT" / "Choose Occasion" / "Choose Services" / "PetWash Premium" labels become:

- Size: `text-[11px] md:text-[12px]` (adds md scaling).
- Weight: `font-semibold` (was `font-medium`).
- Color: `text-gold-luxe` (deeper #A88B4C, approved Decision A).
- Tracking: `tracking-[0.4em]` standardized across all.
- Below each: a 1-pixel hairline `bg-gold-luxe/40` rule, `w-[clamp(40px,6vw,64px)]`, `h-px`. Single editorial mark.

### 2.4 Add `md:` variants throughout

For every section that currently has `sm:` and `lg:` without `md:`, add `md:` values that smoothly bridge the two. Concrete additions:

- Container padding: `px-4 py-6 sm:py-8 md:py-12 lg:py-16`.
- Hero outer padding: `px-4 py-12 sm:py-16 md:py-20 lg:py-24`.
- Form grid: keep `grid-cols-1 sm:grid-cols-2 lg:grid-cols-2`, but add `md:gap-8 lg:gap-10` for breathing room.
- Gift options grid: `grid-cols-2 md:grid-cols-3 lg:grid-cols-4` (this changes iPad portrait from a 2-up to a 3-up — confirms tablet has its own layout, not a blown-up phone).
- Occasion chip padding: `px-4 py-2.5 sm:px-5 sm:py-3 md:px-6 md:py-3.5`.
- Service toggle padding: `px-3 py-2 sm:px-4 md:px-5 md:py-2.5`.
- Card price: `text-2xl sm:text-3xl md:text-[2rem] lg:text-[2.2rem]` (currently regresses at lg — this fixes that).

### 2.5 Form input borders refined

Phase A `border-ink-900/12` on default state, `border-ink-900/40` on focus. No neon blue ring. No drop shadow change. The form fields read as crisp white surfaces with hairline edges instead of warm cream beige.

### 2.6 What Phase B does NOT do

- **No new `<MessagePreviewCard />` component.** That is Phase D (live message preview). Phase B only touches existing markup.
- **No occasion-driven atmosphere wiring.** Selecting "Birthday" still affects only the existing sidebar preview. The hero halo color does NOT shift in Phase B (that is Phase D).
- **No editorial-spacing-scale migration on every padding.** Adopting `editorial-xs/sm/md/lg/xl` everywhere is large; Phase B uses it only where it adds clarity (hero `py-editorial-xl`). Other paddings stay as `p-3 sm:p-4 md:p-5` style.
- **No `framer-motion`.** Confirmed by Decision E.
- **No card artwork or `LuxuryGiftCard` change.**
- **No floating-button change.** That is Phase E (separate PR).

### 2.7 Phase B file scope and risk

- One file modified: `client/src/pages/EGift.tsx`.
- Estimated diff: roughly 100–150 lines, mostly token substitutions and added `md:` variants.
- No new imports.
- No new dependencies.
- TSC error count must stay at the current 2321 baseline.
- Vitest premium-cards regression (the only egift-adjacent suite) must continue to pass 36/36.

---

## 3. Phase E scope — quiet floating buttons on /egift (Option 1, context-aware fade)

**Decision C approved Option 1: context-aware fade.** Implementation:

### 3.1 New hook

`client/src/hooks/useHeroInView.ts` — small hook that takes a ref and a threshold (default 0.6). Returns a boolean. Uses `IntersectionObserver` with `{ threshold: [0, 0.3, 0.6, 1] }`. Ten lines of code.

### 3.2 New context

`client/src/contexts/FloatingButtonsContext.tsx` — context that exposes `quieted: boolean` and `setQuieted: (q: boolean) => void`. Provided at the root of `<Layout>` (so all pages can use it, but only egift will trigger it). Ten lines.

### 3.3 Wire in EGift.tsx

Add a `ref` on the hero block. `useHeroInView(heroRef)` returns the boolean. `useEffect` calls `setQuieted(inView)` from the context. Five lines added to EGift.tsx, no markup change beyond adding the ref.

### 3.4 Wire in floating components

- `WhatsAppChat.tsx` — reads `quieted` from context. When `quieted`, applies `opacity-0 pointer-events-none scale-95` with `transition-all duration-300`. When not quieted, applies `opacity-100 pointer-events-auto scale-100`.
- `AccessibilityButton.tsx` — identical pattern.
- `floating-stack.css` — no changes required.

### 3.5 Behavior

- User lands on `/egift`. Hero is in view. Both buttons fade out over 300ms. Page is uncluttered for the gift-selection moment.
- User scrolls past hero. Hero leaves view. Buttons fade back in over 300ms.
- On any other route, buttons behave exactly as today (the context starts as `quieted: false`).
- If a user has `prefers-reduced-motion`, the transitions become instant.

### 3.6 Phase E file scope and risk

- Three modified files: `WhatsAppChat.tsx`, `AccessibilityButton.tsx`, `EGift.tsx`. Two new files: `useHeroInView.ts`, `FloatingButtonsContext.tsx`. One additional modified file: `Layout.tsx` (wrap children in `<FloatingButtonsProvider>`).
- Estimated diff: roughly 80 lines added, 5 lines modified.
- No new dependencies (`IntersectionObserver` is browser-native).
- TSC errors must stay at 2321.
- Reversible: removing the context provider returns the floating buttons to current behavior.

---

## 4. Out of scope (explicit)

- Card artwork.
- `LuxuryGiftCard` component.
- Gift options data (denominations, tiers, eligibility).
- Payment processing.
- Schema, env, dependencies, server routes.
- VAT logic (governed by the separate VAT proposal, PR #265 still open).
- Other pages (homepage, marketplace, K9000, gift-cards landing).
- Phase C (step indicator slim-down) — separate small PR after Phase B if approved.
- Phase D (atmosphere wiring + live message preview) — separate later phase.
- Migrating non-egift pages to the Phase A tokens — future workstream.

---

## 5. Acceptance criteria

For Phase B:

- iPhone portrait, iPhone landscape, iPad portrait, iPad landscape, and desktop all render the egift page consistently.
- iPad portrait no longer looks like "blown-up mobile" — it has its own `md:` rhythm with refined typography sizes and a 3-column gift card grid (not 2).
- The hero is true white with a barely-visible gold halo, not warm cream.
- Body text reads as deep ink, not warm gray.
- Section labels are consistent (same size, weight, color, tracking across the page).
- TSC error count: 2321 unchanged.
- Vitest premium-cards regression: 36/36 passing.

For Phase E:

- On the egift page, with the hero visible, the WhatsApp and Accessibility buttons are NOT visible.
- Scrolling past the hero brings them back smoothly.
- On every other page, the buttons behave exactly as today.
- No accessibility regression — buttons are reachable for assistive technology when revealed.
- `prefers-reduced-motion` users see instant transitions.

---

## 6. Proposed two-PR sequence

**PR 1 — Phase B atmosphere (small).** Single file: `EGift.tsx`. Token migration + `md:` variants + hero gradient kill. Diff ~100–150 lines. Visual change is significant but deterministic and reversible.

**PR 2 — Phase E floating-button fade (small).** Five files (3 modified, 2 new). One new hook, one new context. Behavior change is scoped to /egift via context activation. Reversible by removing the context provider.

**Order:** Phase B first, Phase E second. They are independent — Phase E does not depend on Phase B, but landing them in this order means the egift page reaches its desired atmosphere before the floating-button behavior change deploys.

---

## 7. Decision points awaiting CEO

A. **Approve Phase B token migration list in §2.2.** Specifically: is mapping `#7A7068` to `text-ink-400` (utility) versus `text-ink-800` (body) acceptable as a per-occurrence judgment by the implementer, or would the CEO prefer a single uniform target?

B. **Approve the gift options grid going from 2-up to 3-up on iPad portrait (`md:grid-cols-3`).** This is the most visible layout change in Phase B. Today iPad portrait shows 2 cards per row; after Phase B it shows 3.

C. **Approve Phase E context-aware fade** as scoped in §3. Decision C from the original proposal already approved Option 1; this confirms the implementation details (IntersectionObserver hook + context provider, 300ms fade, `prefers-reduced-motion` respected).

D. **Choose merge order.** Default: Phase B first, then Phase E. Alternative: ship together as a slightly bigger combined PR. Recommend default (split) for cleaner review and revert.

E. **Confirm scope is /egift only for now.** Token migration on other pages (homepage, marketplace, K9000) is NOT proposed here. If you want a follow-up sweep, it becomes its own workstream.

---

## 8. What this PR (the doc itself) does NOT do

- Does not modify `EGift.tsx`, `WhatsAppChat.tsx`, `AccessibilityButton.tsx`, `Layout.tsx`, or any other code file.
- Does not add the new hook or context files.
- Does not change `tailwind.config.ts`.
- Does not change any test.
- Does not commit Phase B or Phase E. Both are queued behind explicit CEO greenlight.

---

**End of QA proposal. Awaiting CEO decisions A through E.**
