# Rover — Public Flow Audit

**Reviewed on:** 2026-08-18
**Sources (public):**
- rover.com (public homepage + service pages)
- Rover public help-center articles on becoming a sitter and booking a walker
- Rover public App Store / Play Store listings (owner + sitter apps are separately listed)

PUBLIC OBSERVATIONS ONLY. Every technical claim below is marked. We do not know their private backend.

## OBSERVED — customer journey (owner app)

- **Service picker before profile browsing.** Home surfaces service categories (Boarding, House Sitting, Drop-in Visits, Doggy Day Care, Dog Walking) as the first choice — customer selects the service first, not a sitter.
- **Location + date/time before results.** After picking a service, the customer supplies location + dates (or "now" for on-demand walks). Results list is filtered by that scope.
- **Pet profile is a first-class object.** Customers create one pet profile (name, breed, age, size, medical, feeding, behavior notes, vet contact) and reuse it across bookings.
- **Sitter/walker profile card** shows photo, name, star rating, review count, rate/night, response time, badges (Rover-vet-consult access, KPCS-certified etc.), a distance/service-area indicator, and a "Contact sitter" CTA.
- **Meet & Greet flow** is an explicit step for overnight services — the sitter proposes / customer accepts a free pre-booking meeting.
- **Booking-linked chat** — a single conversation attached to each booking; owner and sitter cannot arbitrarily enumerate other people's chats.
- **Repeat booking** — once a sitter is a "past sitter", the customer can rebook directly from the sitter's profile.

## OBSERVED — provider journey (sitter app)

- **Same account** — one Rover login. Customers who become sitters keep the same login/identity. This is one of the strongest signals in the market.
- **Two mobile apps** — Rover ships two separate App Store listings: the owner app and the sitter app. Same identity across both.
- **Modular sitter onboarding** — the sitter application dashboard shows a checklist (About you, Services & rates, Availability, Preferences, Photos, Environment, Safety, Payment, Testimonials, Background check). Progress bar. Save & resume across sessions.
- **Multi-service provider** — one sitter application supports offering multiple services (walking + boarding + sitting + drop-in + daycare) — each service is a toggle on the same provider profile with its own rate and its own availability slice.
- **Availability calendar** — one calendar that powers both the sitter's own view and marketplace availability search.
- **Sitter home** — surfaces "requests" and "upcoming stays" as top-line items; deeper admin lives under menus.

## PUBLICLY DOCUMENTED

- Rover's help center explicitly documents: same account for owner & sitter (add services later), Meet & Greet flow, cancellation policies, background check status types, sitter approval process, and their payout schedule.

## INFERRED (label everything)

- **INFERRED**: Rover likely has a canonical `user` entity with additive capability records (owner + sitter application + per-service capabilities). Not confirmed from source; matches observable behavior.
- **INFERRED**: their availability system is a single authoritative store that both feeds marketplace-search filters and sitter-side "block dates" UI. Not confirmed.
- **INFERRED**: they preserve owner functionality after sitter approval. Not confirmed but strongly implied by the "list all my pets" surface being visible on sitter accounts too.

## UNKNOWN

- Their auth backend, session model, KYC vendor, background-check vendor, payment processor stack, escrow rules, refund policy internals, their data model for pet snapshot vs. pet reference on a booking. Do not assume.

## Product principles for PetWash

Take principles, not screens:

1. **One identity, additive capabilities.** PetWash's `users` table + Firebase custom claims must never do `role = 'provider'` in a way that DROPS the customer capability. Provider approval ADDS a claim; it never replaces one.
2. **Service picker first.** The public search entry point must ask (service, location, dates, pet) BEFORE showing any provider list. Faster to intent, less browsing waste.
3. **Modular provider onboarding.** Sections are independent (Services, Profile, Rates, Availability, Photos, Documents, Declarations). Backend draft is authority. Save & resume across devices — no localStorage-authoritative state.
4. **Multi-service on one profile.** A provider offering walking + sitting is ONE profile with per-service pricing & availability. Not two independent provider accounts.
5. **Single availability system.** Provider calendar view + marketplace availability filter must read from the same authoritative source. No divergence.
6. **Meet & Greet as a first-class booking state** — not a text note in chat. Requested / Scheduled / Completed / Declined / Cancelled.
7. **Booking-linked chat.** One conversation per booking. Server-derived participant list; can't enumerate arbitrary chats by ID.
8. **Repeat booking from provider profile.** Past bookings surface a direct rebook CTA on the provider card. Reduces friction on the second sale.

## What Rover appears to do that PetWash should NOT copy directly

- **Two separately-published mobile apps.** PetWash should first build one canonical backend, one API contract, one identity — and one web/PWA shell with role-aware UI. Native mobile split is a distribution decision to defer until real commercial need. Do NOT split the backend.
- **Rover's exact information architecture** — the labels, section titles, and rate presentation are their trade dress. Use different naming and different visual grouping.

## Do NOT

- Copy Rover's specific onboarding-checklist wording
- Reproduce their sitter-profile page composition
- Use "sitter" in customer text where PetWash's canonical term is "provider" (or the specific per-service name)
- Publish any comparative marketing claim without CEO + `petwash-marketing-legal` sign-off
