---
name: petwash-ui-ux
description: PetWash UI/UX design system, component library, mobile-first + RTL discipline, accessibility, animation, and anti-patterns. Read this before designing or building ANY user-facing surface — signup, auth, dashboard, booking, wallet, admin. Pairs with petwash-platform (§6) and petwash-pr-guardian.
---

# PetWash UI/UX Pro Max Skill

You are designing or building a user-facing surface in PetWash. This skill is the deep companion to `petwash-platform §6 Design rules` and the operator's "Smart System Octopus" vision (`docs/architecture/2026-petwash-octopus-vision.md`). Read it end-to-end before touching any UI.

The platform skill says **what** (luxury, clean, premium). This skill says **how** — with concrete tokens, components, patterns, and anti-patterns from real PetWash code.

---

## 0. Five non-negotiable design laws

These rank above all other guidance. When in doubt, escalate — do not violate.

1. **One signup screen per audience.** Customer + provider + admin = three entry points total. Not seven. Not nine. The "Smart System Octopus" §1 (Tentacle 1) makes this an architectural constraint, not a preference.
2. **Mobile-first means iPhone Safari first.** Not "responsive in dev tools." Real device, real Safari, before claiming UX done.
3. **No security theater.** A control that looks active but does nothing (e.g. fake "I'm not a robot" CSS checkbox at `client/src/pages/SignUpLuxury.tsx:126` before PR #453) is worse than no control. Either wire it real, or remove it.
4. **No fake links / fake metadata.** No App Store URLs ending in `id1234567890`. No placeholder "Lorem ipsum." No fictional brand partnerships. If it's not real, don't ship it.
5. **RTL is not "added later."** Hebrew is the primary market. Every new component renders in RTL on day one or it doesn't ship.

---

## 1. Brand attribute hierarchy (inherited from petwash-platform §0.2)

When two design choices conflict, pick the one that better serves the higher-ranked attribute:

1. **Easy** — fewest taps, clearest path, progressive disclosure
2. **Safe** — calm, controlled, no surprise modals, no destructive actions without confirm
3. **Clean** — generous whitespace, no clutter, no ornamental garbage
4. **Premium** — Apple/Hermès/Tesla restraint, NOT cheap startup energy
5. **Modern** — current visual vocabulary (subtle glass, soft shadows, fluid type)
6. **Trusted** — honest indicators (e.g. "Protected by Cloudflare" only if it actually is)
7. **Eco-conscious** — supporting proof, never the headline

Eco-conscious is the LOWEST priority for visual emphasis. Easy + Safe + Clean dominate. Eco enters as supporting evidence, not as the lead.

---

## 2. Canonical design tokens

These are the production tokens — extracted from `client/src/pages/SignUpLuxury.tsx:811` and the existing luxury surfaces. When designing a new component, reuse these. Don't introduce parallel tokens.

### 2.1 Color palette (dark luxury)

```css
/* Backgrounds */
--ink:       #0a0a0a;   /* near-black canvas */
--shell-bg:  #000;      /* shell background */

/* Surfaces (translucent over dark canvas) */
--surface-1: rgba(255,255,255,.04);   /* cards, inputs */
--surface-2: rgba(255,255,255,.08);   /* hover, focus */
--line:      rgba(255,255,255,.10);   /* default borders */
--line2:     rgba(244,212,138,.22);   /* gold-tinted borders, active */

/* Brand gold (the accent) */
--gold:      #d8ad55;   /* primary gold */
--gold2:     #f4d48a;   /* lighter gold for highlights/gradients */

/* Type */
--white:     #fffaf0;   /* warm off-white, NOT pure #fff */
--muted:     rgba(255,250,240,.6);  /* secondary text */

/* State (only use when actively needed) */
--success:   #22c55e;   /* CSS accent-color for checkboxes */
--danger:    #ef4444;   /* destructive */
```

**Rules of use:**

- The shell is dark (`#000` / `--ink`). Surfaces are translucent white-on-dark.
- Gold is the SINGLE accent. Do not introduce blue / red / purple as competing accents. If you need a state color, use `--success` for confirmation and `--danger` for destruction. Never as primary brand.
- `--white` is **warm** (`#fffaf0`), not pure white. Pure `#fff` looks cold in this palette.
- The light counterpart of this palette (when needed for documents, invoices, admin) uses pure white backgrounds per platform skill §6: "Pure white backgrounds where the design intends — no grey-tint defaults."

### 2.2 Type system

```css
font-family: Inter, system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif;
```

Sizes use `clamp()` for fluid scaling (mobile → desktop in one rule):

| Role | Rule | Example |
|---|---|---|
| Display / hero | `clamp(28px, 4.5vw, 56px)` | Hero headline |
| Title | `clamp(22px, 2.5vw, 32px)` | Page title |
| Subtitle | `clamp(15px, 1.5vw, 18px)` | Hero sub |
| Body | `15px` (fixed) | Form labels, paragraphs |
| Caption | `12px` (fixed) | Helper text, badges |

Line-height: `1.55` for body, `1.05–1.15` for display.

**Don't ship pixel-fixed type for headlines.** Always `clamp()` for hero/title to avoid the "320px iPhone SE looks broken" trap.

### 2.3 Spacing & layout

```css
--frame-max:  1440px;        /* cap layout width on big screens */
--pad-x:      clamp(16px, 3vw, 40px);
--pad-y:      clamp(20px, 4vw, 40px);
--gap-md:     clamp(20px, 3vw, 32px);
```

- 1440px max-width frame. **27-inch iMacs do not get stretched layouts.**
- All horizontal padding uses `clamp()` to scale gracefully on mobile (16px) → desktop (40px).
- Vertical rhythm is `clamp()`-based too. No fixed `padding: 20px` for shells.

### 2.4 Radii & shadows

```css
--r-input:   12px;       /* form fields */
--r-card:    14px;       /* cards */
--r-pill:    9999px;     /* badge / chip */
--r-modal:   18px;       /* sheets, modals */

/* Soft shadow for elevation (use sparingly on dark) */
--shadow-1:  0 8px 24px rgba(0,0,0,.4);
--shadow-glow: 0 0 0 1px rgba(216,173,85,.45), 0 8px 24px rgba(216,173,85,.18);
```

Gold glow (`--shadow-glow`) is the hover state for the primary CTA. Don't apply it to secondary elements.

### 2.5 Motion

```css
--ease-out-quart: cubic-bezier(.25, 1, .5, 1);
--ease-in-out:    cubic-bezier(.4, 0, .2, 1);
--dur-fast:       150ms;
--dur-mid:        260ms;
--dur-slow:       420ms;
```

**Motion rules:**

- Use `--ease-out-quart` for entrances (things appearing).
- Use `--ease-in-out` for state transitions (focus, hover).
- Never animate `width` or `height`. Animate `transform` and `opacity`.
- Respect `prefers-reduced-motion`: collapse all transitions to `0ms` when present.

---

## 3. Component library — what to reuse, what to build

Before building a new component, check this table. If it exists, **use it. Do not rebuild.**

| Need | Existing component | Path | Notes |
|---|---|---|---|
| Phone number input | `PhoneInput` | `client/src/components/PhoneInput.tsx` | 25-country list, E.164 normalization, search by name/dial code. Harden for RTL per SDD §5; don't replace. |
| 6-digit OTP code | `OtpCodeInput` | `client/src/components/OtpCodeInput.tsx` | Auto-focus, auto-advance, paste-from-SMS support |
| Address autocomplete | `GooglePlacesAutocomplete` | `client/src/components/ui/google-places-autocomplete.tsx` | IL-only by default; 28 call sites. **Wrap, don't duplicate.** Inspector found 420 LOC of duplicate wrapper props across 28 pages — a `<AddressField>` wrapper is a planned consolidation |
| Bot challenge | `TurnstileWidget` + `executeTurnstileInvisible()` | `client/src/components/TurnstileWidget.tsx` | Invisible-by-default; returns `null` when `VITE_TURNSTILE_SITE_KEY` unset (graceful degrade) |
| Toast / notification | `useToast` | `@/hooks/use-toast` | Hebrew/English aware via current language |
| Button (primary CTA) | `.sl-cta` class | inline-styled in `SignUpLuxury.tsx` | TODO: extract to `<PrimaryButton>` — see §9.2 |
| Input (text/email/password) | `Input` from shadcn | `@/components/ui/input` | shadcn baseline — wrap when you need luxury skin |
| Label | `Label` from shadcn | `@/components/ui/label` | |
| Sheet / modal | `Sheet` (shadcn) | `@/components/ui/sheet` | Mobile bottom-sheet pattern |
| Dialog | `Dialog` (shadcn) | `@/components/ui/dialog` | Desktop modal |

**Anti-pattern:** importing a shadcn primitive and re-skinning it inline in every page. Skin it once in a `client/src/components/luxury/*` wrapper and reuse.

---

## 4. Mobile-first checklist

PetWash's primary user is on an iPhone in Israel. Every UI surface ships through this checklist before merge:

- [ ] Real iPhone Safari test (not just Chrome dev-tools simulation)
- [ ] Uses `100dvh` for full-height layouts (NOT `100vh` — Safari toolbar handling)
- [ ] Tap targets are ≥ 44×44 pt (Apple HIG minimum)
- [ ] No hover-only interactions (touch has no hover state)
- [ ] No fixed pixel widths on form fields — use `min-width:0` to prevent flex blow-out
- [ ] Inputs use `inputmode` attribute (`tel` for phone, `numeric` for OTP, `email` for email)
- [ ] Inputs use `autocomplete` attribute (`username`, `current-password`, `one-time-code` for OTP)
- [ ] Keyboard does not occlude the focused field (use `scroll-padding-bottom`)
- [ ] iOS safe-area handled: `env(safe-area-inset-bottom)` on bottom-pinned CTAs
- [ ] Loading state visible within 200ms (skeleton or spinner, never blank)
- [ ] Progressive disclosure on mobile: one question per screen, not a 9-field form
- [ ] PWA-ready: viewport meta `<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">`

If ANY of these is no, the UX is not ready.

---

## 5. RTL discipline (Hebrew is the primary market)

Hebrew + Arabic both need correct RTL. Do not treat RTL as a translation problem — it's a layout problem.

### 5.1 RTL rules

- **`dir="rtl"`** on the document root when `language === 'he'` or `'ar'`. Set this from the language provider, never per-component.
- **Numbers stay LTR even inside RTL.** Phone numbers, OTP codes, prices, dates — wrap them in `<bdi>` or apply `direction: ltr` on the specific text node.
- **Country flag + dial code in PhoneInput**: in LTR the flag is on the LEFT of the field; in RTL the flag is on the RIGHT of the field. The number itself is always LTR.
- **Icons that have meaning (arrow, chevron):** flip horizontally in RTL via `transform: scaleX(-1)` or use RTL-aware icon variants. Decorative icons (heart, star) do NOT flip.
- **Padding/margin shorthand:** use `padding-inline-start` / `padding-inline-end` instead of `padding-left` / `padding-right`. The "inline" variants auto-mirror with `dir`.
- **`text-align: start` / `end`** instead of `left` / `right`.
- **Flex `gap` is RTL-safe.** Use it freely.

### 5.2 RTL test cases (every new component)

- [ ] Set `<html dir="rtl">` and the component renders without manual override
- [ ] Phone number inside the RTL layout still reads `054-123-4567` left-to-right
- [ ] Country selector appears on the visually-correct side (right in RTL)
- [ ] Long Hebrew strings don't overflow (test with the longest provider name in production)
- [ ] Animations directional cues match RTL (slide-in from the trailing edge, not always from the right)

### 5.3 i18n strings

- Translation keys in `client/src/lib/i18n.ts`. **Never** hardcode Hebrew or English strings in JSX. If a string is missing a key, **add a key, don't ship literal text**.
- Pluralization: use `Intl.PluralRules` (Hebrew has different plurals than English).
- Dates: use `Intl.DateTimeFormat('he-IL', ...)`. Never `toLocaleDateString()` without an explicit locale.

---

## 6. Accessibility (WCAG 2.1 AA — minimum)

PetWash serves older customers and customers with limitations (platform skill §0.1.1). Accessibility is product, not compliance.

### 6.1 Hard requirements

- [ ] Color contrast: body text ≥ 4.5:1, large text ≥ 3:1. Check gold-on-dark (`--gold #d8ad55` on `#000` = 7.2:1 ✓). Check `--muted` on `--ink` (`rgba(255,250,240,.6)` on `#0a0a0a` ≈ 5.4:1 ✓).
- [ ] Every interactive element has a visible focus ring. Tab through the UI before merge.
- [ ] Form fields have an associated `<Label>` (or `aria-label`).
- [ ] Error messages reference the field (`aria-describedby`) and are announced to screen readers.
- [ ] Skip-to-content link on every page (for keyboard users skipping the nav).
- [ ] `lang` attribute on `<html>` matches the current language.
- [ ] Decorative images: `alt=""` (empty). Meaningful images: descriptive alt.
- [ ] Buttons that show icons only: `aria-label` describes the action.

### 6.2 Patterns that fail accessibility

- "Click here" links — say what you're linking to.
- Modal that traps focus inside but doesn't release it on close.
- Toasts that auto-dismiss in < 5 seconds (people with motor or cognitive limitations can't read that fast).
- Color-only state (red text without an icon = invisible to colorblind users).
- Tap targets smaller than 44pt.

---

## 7. Animation principles

Motion communicates hierarchy and intent. It is not decoration.

### 7.1 What to animate

- **State transitions:** focus, hover, selection, open/close
- **Entry of new content:** new toast, modal open, list item insert
- **Loading:** skeleton shimmer, button spinner
- **Confirmation:** check mark on save, gold pulse on CTA

### 7.2 What NOT to animate

- Page-load entrance for every element (the cumulative delay feels slow)
- Decorative bouncing/pulsing of static logos
- Anything controlled by `width` or `height` (use `transform: scale()`)
- Multiple things at once on entry (stagger if needed, but one focal motion at a time)

### 7.3 Reduced motion

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

Ship this rule on every page that has motion. Users with vestibular disorders should not get nausea from PetWash.

---

## 8. Anti-patterns observed in this repo

Each of these has been found in PetWash code. Do not ship more of them.

| Anti-pattern | Where it lived | Why it's wrong | Fix |
|---|---|---|---|
| Fake "I'm not a robot" CSS checkbox | `SignUpLuxury.tsx:126` (pre-PR #453) | Looked like a CAPTCHA, actually a `<input type="checkbox">` that did nothing. Security theater. | Use `executeTurnstileInvisible()` or remove the badge |
| Fake App Store URL | `SignUpLuxury.tsx:658` | Links to `apps.apple.com/.../id1234567890` — a placeholder ID, no app exists | Remove the button OR link to a real listing |
| Identical signup pages copy-pasted per audience | 7 entry points found by Inspector A | Diverges over time; impossible to maintain | One screen per audience (Tentacle 1 in octopus vision) |
| `<input type="checkbox">` styled to look like a Google Material/iOS toggle | various | Confuses muscle memory; users don't know if tap = toggle or = open menu | Use a proper `Switch` component from shadcn |
| Hardcoded `padding-left: 16px` | scattered | Breaks in RTL | Use `padding-inline-start` |
| `bg-gray-100 rounded-md p-4 shadow` placeholder | from platform skill §6 | Cheap-startup energy in a luxury brand | Use luxury surface tokens (`--surface-1`, `--r-card`) |
| Generic "Welcome!" toast | various | Doesn't acknowledge user identity or context | Personalize: "Welcome, [name]" or skip the toast |
| Loading state that says nothing | various | User doesn't know if their request is in flight or failed | Skeleton with shape preview, or labeled spinner |
| Animation on every list item on mount | various | Mobile feels slow; CPU thrash | Animate the first 5 items only; rest snap in |

---

## 9. Patterns to apply (PetWash-specific)

### 9.1 The "One signup screen" pattern (PetWash 2026 target)

A SINGLE component (`SignupShell.tsx`) renders the four authentication primitives stacked vertically, in this exact order, on every audience entry:

```
┌─────────────────────────┐
│   [Apple logo]  Apple   │  ← 56pt tall button, white text on black
│   [Google logo] Google  │  ← 56pt tall button, gold border on dark
│   [✉]  Email            │  ← collapses into email field on tap
│   [📱] Mobile           │  ← collapses into PhoneInput on tap
│                          │
│   ─── or ──────────────  │  ← divider
│   Returning? Face ID    │  ← passkey autofill prompt
└─────────────────────────┘
```

- The audience (customer / provider / admin) is selected by URL path, not by a tab on this screen.
- The screen is identical for `/signup` and `/become-provider`. Only the post-auth route differs.
- The screen never appears at `/admin/login` — admin login is a separate, hidden surface (invite token only).

### 9.2 The "Primary CTA" component

A reusable button that:
- Default state: white background, black text (high contrast on dark canvas)
- Hover/active state: gold glow (`--shadow-glow`)
- Disabled state: opacity 0.45, no glow, no pointer
- Loading state: spinner replaces text; button width fixed (no jump)
- Width: full-width on mobile, content-width on desktop
- Height: 56pt
- Radius: `--r-input` (12px)
- Includes an optional leading icon (28pt, aligned with the text optical center)

Implement as `<PrimaryButton>` in `client/src/components/luxury/PrimaryButton.tsx` once. Don't inline-style the CTA in every page.

### 9.3 The "OTP entry" pattern

When the user taps Mobile and enters their phone:

1. Phone field expands beneath the button row
2. Country selector defaults to IL (Hebrew users) or the locale-detected country
3. "Send code" CTA replaces the four primitives
4. On submit: invisible Turnstile token + phone go to `/api/auth/sms/start`
5. OTP screen replaces the form (full-screen on mobile, modal on desktop)
6. 6-digit code with auto-advance focus, paste-from-SMS support
7. Resend timer visible (30s lockout)
8. On success: redirect to dashboard, prompt "Make next login faster with Face ID / passkey?"

The whole flow lives in ONE component (`PhoneOtpFlow.tsx`) with internal state, not three pages.

### 9.4 The "Returning user" pattern (passkey autofill)

On a device that has previously registered:

1. The "Continue with Email" field shows the system passkey prompt automatically (browser-driven, no extra UI)
2. If user dismisses, the password fallback path appears
3. Face ID / Touch ID happens via the system, NOT inside our app — that's how passkeys work

Do not build a custom Face ID UI. The system handles it.

---

## 10. Design references

The references below are inspiration sources, not direct templates. Apply principles, not pixels.

### 10.1 Hard inspiration (these brands set the bar)

- **Apple** — type, spacing, restraint. Their iOS Health and Wallet apps are the gold standard for "luxury" on mobile.
- **Tesla** — minimalism, dark mode, white space.
- **Linear** — keyboard-first interactions, command palette, fluid type.
- **Stripe** — form design, error states, documentation aesthetic.
- **Hermès / LV** — luxury restraint, gold-on-dark, generous margins.
- **Airbnb** — host vs guest dashboard separation (relevant for provider vs customer).
- **Rover / MadPaws** — pet-service marketplace flows specifically.

### 10.2 Component / design system references

| Source | What to learn from it |
|---|---|
| **shadcn/ui** | Component primitives, accessible by default. We already use this baseline — extend, don't replace. |
| **21st.dev** | Curated React/Tailwind component marketplace. Useful for premium card patterns, hero sections, complex layouts. (Note: bot-protected, can't be crawled programmatically — operator drops in screenshots of specific patterns to evaluate.) |
| **Dribbble** | Visual inspiration for mobile-first signup / onboarding patterns 2024–2026. Search terms: "luxury auth", "premium signup mobile", "biometric login UX". (Note: bot-protected, can't be crawled. Operator pins favorites into `docs/design/inspiration/` as JPG screenshots with attribution.) |
| **Apple Human Interface Guidelines** | The single source of truth for iOS UX. Read the Authentication and Onboarding sections specifically. |
| **Material Design 3** | For Android-specific patterns (PWA users on Android also see these conventions). |
| **WAI-ARIA Authoring Practices** | Pattern library for every common widget — every "how should this combobox work" question is answered here. |

### 10.3 How to incorporate references

1. Pin specific examples into `docs/design/inspiration/<feature-name>/`. JPG screenshots with one-line caption + source URL + date.
2. Reference them in the relevant SDD section (e.g. the signup SDD at `docs/design/2026-05-25-smart-identity-routing.md` should have a "visual inspiration" footnote per surface).
3. NEVER copy code or assets directly from these sources — they're inspiration, not source.

---

## 11. Component creation checklist

Before merging a new UI component, work through this list:

- [ ] Uses canonical tokens from §2 (no hardcoded colors / sizes / radii)
- [ ] Mobile-first checklist §4 passes
- [ ] RTL checklist §5 passes
- [ ] Accessibility checklist §6 passes
- [ ] Animation respects `prefers-reduced-motion` (§7.3)
- [ ] No anti-patterns from §8
- [ ] If it duplicates an existing component pattern, refactor the existing one instead of forking
- [ ] Storybook / preview entry added (if Storybook is wired — currently it's not; consider adding)
- [ ] Visual regression test (Percy / Chromatic) — currently not wired; flag as a follow-up if visuals are critical
- [ ] Test on real iPhone Safari (not just Chrome desktop)
- [ ] Hebrew + English snapshot of the rendered component

---

## 12. The "no, this is design debt" speech

When asked to add a small UI element that you can already see is fighting the design system, push back.

Common examples:

| Request | Why to push back | Alternative |
|---|---|---|
| "Add a blue 'Save' button here" | Introduces a non-brand color | Use the gold primary CTA, or the neutral secondary (white-on-dark border) |
| "Make this section bouncy with springs" | Violates premium restraint | Subtle fade-in or no animation at all |
| "Show all the user's data on one screen" | Violates progressive disclosure | Page or tab the surfaces |
| "Add a red badge with a number" | Introduces a non-brand color and creates anxiety | Use a gold dot, or text "3 new" in the navigation |
| "Add another signup page for this campaign" | Violates Tentacle 1 (one signup per audience) | Route through `/signup?source=campaign` and personalize after auth |
| "Make the loading spinner spin faster" | Doesn't make the wait shorter, just noisier | Replace with a skeleton that matches the eventual content shape |
| "Add a 'don't show again' checkbox to the welcome modal" | Modal shouldn't be needed if the welcome is graceful inline | Replace the modal with an inline welcome card on the dashboard |

A "no" with a better alternative is a design contribution. A silent "yes" that ships the bad pattern is debt.

---

## 13. When to consult this skill

Invoke this skill (read it again) when:

- Designing or building any new user-facing surface
- Reviewing a UI PR — use §11 as the checklist
- Making a "small visual tweak" — it's often not small
- Adding a new translation string — check §5.3 patterns
- Adding any auth / signup surface — see §0 Law #1 and §9.1
- Adjusting any animation — see §7
- Touching anything with `dir="rtl"` — see §5

If the change is non-UI (backend route, schema migration, CI), this skill does not apply. Use `petwash-platform` and `petwash-pr-guardian` instead.

---

## 14. Update protocol

This skill is a living document. Update it when:

- A new component is added to the library (add to §3 table)
- A new anti-pattern is observed in production (add to §8)
- A design token changes in the codebase (update §2)
- A new design reference becomes canonical (add to §10)
- An accessibility audit finds a recurring failure (add to §6.2)

Every update gets a date stamp at the bottom of this file and a one-line note in the commit message.

---

**Last updated:** 2026-05-25 (initial creation, paired with PR #452 Smart Identity SDD and `docs/architecture/2026-petwash-octopus-vision.md`)

**Maintainer:** the agent merging the change updates the file.

**Inspiration drops:** if you find a Dribbble shot or 21st.dev component worth referencing, save the screenshot to `docs/design/inspiration/<feature>/<short-name>.jpg` with a `.md` caption file (source URL, date, what to learn from it). I (Claude) will read these when designing in that area.
