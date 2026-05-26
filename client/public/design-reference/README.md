# Design Reference — Operator-Approved Designs

This directory holds **operator-approved visual references** that are the
source of truth for specific user-facing surfaces in PetWash. Code that
implements these surfaces must visually match the reference image. Period.

---

## Binding rules (operator brief, 2026-05-26 — SUPERSEDES 2026-05-25)

The earlier 2026-05-25 brief froze the layout at the pixel level. The
2026-05-26 brief replaces it with a **size-hierarchy + tap-target +
reachability** rule set, in response to a real device review:

> 1. **Logo dominates.** The PetWash logo must be visually larger and
>    stronger than the "The Future of Pet Lifestyle" headline. Brand
>    first, marketing copy second.
> 2. **Dog supports.** The hero dog photo is a supporting element, not
>    the centerpiece. It must never push the primary CTA below the fold
>    on any device. On very small phones (≤420 px) it may be hidden so
>    the form fits without scroll for the primary action.
> 3. **CTA reachable.** "Create Secure Account" / OTP send must always be
>    reachable — sticky bottom CTA on phones is mandatory whenever the
>    in-form CTA is below the fold.
> 4. **Tap targets ≥44 px** (Apple HIG) for every interactive element.
> 5. **Safe areas.** `100dvh` + `env(safe-area-inset-*)` so the page
>    survives iOS Safari toolbar + home indicator without dead bands.
> 6. **Premium black/gold/white** styling — Rolex/Cartier/LV restraint,
>    Apple cleanliness. Main CTA in luxury gold, not white.
> 7. **RTL parity** — every layout primitive switches sides on `he`.
> 8. **Provider routing.** Each social tile must invoke the *correct*
>    provider: Google → Google OAuth, Apple → Apple OAuth, Facebook →
>    Facebook OAuth, Instagram → server-mediated OAuth. No silent dead
>    buttons; show a clear "coming soon" toast if a provider is gated.

### What IS allowed

- Wire real backend behaviour (auth, form submission, secrets)
- Responsive sizing so the layout uses 100% of the screen at every breakpoint
- Hiding the hero dog photo on ≤420 px to keep CTA reachable
- Bug fixes that do not alter brand hierarchy (a11y, performance, type safety)
- Translation strings for new languages

### What is NOT allowed (without explicit operator approval)

- Removing or downsizing the PetWash logo so the headline rivals or exceeds it
- Removing the premium card, trust card, security badge, social login buttons,
  wallet buttons, or the Download Our App banner
- Recoloring the main CTA away from the luxury gold gradient
- Replacing the design with a generic "auth boilerplate" page
- Adding fake/demo elements not explicitly marked as coming soon

### Decisions on record

| Date | Decision |
|---|---|
| 2026-05-25 | Original "locked-pixel" brief. Hero dog must stay visible on every breakpoint. |
| 2026-05-26 | **Replaced** by the size-hierarchy + reachability + provider-routing brief above. Hero dog may now scale down on phones (and hide on ≤420 px) so CTA stays reachable; CTA recolored to luxury gold; Facebook/Instagram tiles wired to real OAuth flows. |

---

## Files in this directory

| File | Surface | Implemented by | Status |
|---|---|---|---|
| `signup-approved.png` | `/signup` | `client/src/pages/SignUpLuxury.tsx` | **Awaiting operator upload** — agent could not extract from chat-pasted image; operator to commit the PNG directly via GitHub web UI or `git add` from local Mac |

---

## How to use this reference (for engineers / future agents)

Before opening any PR that touches a file in the **Implemented by** column above:

1. Open the reference PNG in this directory.
2. Open the live page in the browser at the breakpoint you're changing.
3. Compare them side-by-side.
4. If your change makes them diverge visually, **stop**. Either:
   - Revert the visual change and ship only the non-visual part of your PR, or
   - Get explicit operator approval for the visual change FIRST, then update
     the reference PNG in the same PR.
5. Cite the reference in the PR description: "Verified against
   `client/public/design-reference/signup-approved.png`."

---

## How to update a reference (operator only)

When the design intentionally changes:

1. Save the new approved screenshot as the same filename (overwrite).
2. Commit with message: `design(reference): update <surface> to <date>`.
3. In the SAME commit, update the implementation to match.
4. Reference the previous version in the commit body for history.

The reference and the code are coupled — drift between them is a bug.

---

## Why a PNG and not a Figma link?

- A PNG in the repo is **versioned with the code**. `git log` shows when it changed.
- Figma links rot (link breaks, file moves, access revoked).
- A PNG can be compared programmatically (visual regression) in CI later.
- Engineers without Figma access can still see what's expected.

Future enhancement: wire a visual regression test (Percy / Chromatic) that
compares the rendered `/signup` against the reference PNG at multiple
breakpoints. Currently not wired — would catch regressions like PR #458
automatically.
