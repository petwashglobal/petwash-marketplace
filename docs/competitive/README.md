# Competitive Product Audits — Ground Rules

CEO fire order 2026-08-18 (Rover / Mad Paws / WhatIDog benchmark directive).

## Rules

- PUBLIC OBSERVATIONS ONLY. Never claim to know a competitor's private backend, private code, or internal data. Every statement in every audit doc MUST be marked as one of:
  - **OBSERVED** — I personally saw this on the public website, App Store listing, or the CEO's own screenshots
  - **PUBLICLY DOCUMENTED** — appears in a public help-center article, blog post, press release, or product page copy
  - **INFERRED** — a plausible technical guess based on OBSERVED / PUBLICLY DOCUMENTED behavior; MUST be labeled
  - **UNKNOWN** — we don't know; do not guess
- **Never copy** brand, logo, trade dress, screen artwork, exact Hebrew wording, marketing copy, icons, or any proprietary code. What we learn is journey shape, state transitions, information hierarchy, provider/customer separation, and GPS workflow — not their words or pixels.
- No competitor names in PetWash user-facing text, ever.
- No comparative marketing claim ("we are like X but better") without CEO + marketing sign-off — that's the `petwash-marketing-legal` skill's territory.

## What we take from each

| Reference | We study |
|---|---|
| Rover | one account / multi-role, easy customer signup, provider conversion, multi-service provider, save/resume onboarding, booking marketplace, provider profile/availability |
| Mad Paws | simple provider joining, guided onboarding, services + pricing + schedule setup, accept/decline booking flow, pet care profile, simple marketplace UX |
| WhatIDog | focused mobile booking UX, provider TODAY view, start-service action, live walk tracking, customer live map, service completion report |

## Where the docs live

- `docs/competitive/rover-public-flow-audit.md`
- `docs/competitive/madpaws-public-flow-audit.md`
- `docs/competitive/whatidog-public-flow-audit.md`

Each doc has a `Reviewed on` date and a `Sources` section listing exactly the URLs / CEO screenshots the OBSERVED / PUBLICLY DOCUMENTED entries came from.

## Feature score matrix

`docs/competitive/scorecard.md` maintains our current-vs-them matrix per CEO §53. Update when we ship or when a public change is observed. **Focus first on ease, reliability, connected journey — not raw feature count.**
