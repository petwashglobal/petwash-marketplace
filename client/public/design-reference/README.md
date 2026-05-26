# Design Reference — Locked Approved Designs

This directory holds **operator-approved visual references** that are the
source of truth for specific user-facing surfaces in PetWash. Code that
implements these surfaces must visually match the reference image. Period.

---

## Binding rules (operator brief, 2026-05-25)

For every file in this directory:

> The approved kit must stay **exactly** as shown in the reference image.
>
> No creative changes, layout changes, button changes, text changes,
> spacing changes, color changes, font changes, image changes, logo changes,
> icon changes, form changes, or "improvements."
>
> Responsive means ONLY this: make the exact approved kit fit correctly on
> iPhone, iPad/tablet, and MacBook/desktop.
>
> Responsive does NOT mean redesigning the page.

### What IS allowed

- Wire real backend behaviour (auth, form submission, secrets)
- Responsive **scaling** so the exact approved kit fits every screen size
- Bug fixes that do not alter visual appearance (a11y, performance, type safety)
- Translation strings for new languages — but the visual layout stays put

### What is NOT allowed (without explicit operator approval)

- Hiding any section, image, or button at any breakpoint
- Cropping or fading any approved element
- Replacing the approved design with a "mobile-first" or "simplified" variant
- Recoloring, restyling, or rearranging buttons
- Removing or modifying the hero photo, premium card, trust card, security
  badge, social login buttons, wallet buttons, or the Download Our App banner
- Adding "creative improvements" the operator did not request
- "Polish" PRs that subtract elements to make mobile "cleaner"

### Violations on record

| PR | What it did wrong | Resolution |
|---|---|---|
| #458 | Hid the hero dog photo on iPhone ≤480px and in landscape mode "as a polish." Operator rejected — the approved kit must stay visible on every breakpoint. | Reverted in PR #459 + this README + locked-design header on `SignUpLuxury.tsx`. |

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
