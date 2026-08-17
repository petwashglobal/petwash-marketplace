# Competitive Scorecard — PetWash vs Rover / Mad Paws / WhatIDog

Per CEO benchmark directive §53. Focus first on **ease, reliability, connected journey** — not raw feature count.

Reviewed: 2026-08-18. Update on ship / on observed public change.

Legend: ✅ shipped & E2E-verified · 🟡 partial or shipped-not-E2E · ❌ missing · N/A not applicable · ? public source unclear

| Capability | PetWash | Rover | Mad Paws | WhatIDog |
|---|---|---|---|---|
| Signup friction (guest → account) | 🟡 SignUpLuxury still asks DOB/consent up-front; Google OAuth wired | ✅ | ✅ | ? |
| One identity, multi-role (customer + provider) | 🟡 additive capabilities exist in schema; role-switch UI not yet built | ✅ | ? | ? |
| Provider conversion from existing customer | 🟡 Become-Provider CTA wired; identity-preservation E2E not shipped | ✅ | ✅ | ? |
| Save/resume provider onboarding | ✅ (draft in `provider_applications`) | ✅ | ✅ | N/A |
| Multi-service provider (walker + sitter on one profile) | 🟡 schema supports; UI groups service configs but doesn't visibly toggle per-service ACTIVE/PAUSED yet | ✅ | ✅ | N/A |
| Provider search: service + location + dates first | 🟡 search page exists; not a single-filter entry point | ✅ | ✅ | 🟡 |
| Provider profile: photo + rating + reviews + availability + CTA | ✅ | ✅ | ✅ | ✅ |
| Provider availability = single authoritative calendar | 🟡 calendar exists; not yet the single source across marketplace search + provider dashboard | ✅ | ✅ | ? |
| Booking state machine (canonical) | 🟡 exists but multiple concurrent writers (LANE B fixed 7; billing/refund fixed now) | ✅ | ✅ | ? |
| Meet & Greet as first-class state | ❌ | ✅ | ✅ | N/A |
| Payments (customer view) | ✅ Nayax/SUMIT wired | ✅ | ✅ | ? |
| Calendar (provider) | 🟡 | ✅ | ✅ | 🟡 |
| Messaging (booking-linked, participant-scoped) | 🟡 exists (booking-chat) | ✅ | ✅ | 🟡 |
| Live service tracking (start walk → live map → finish) | ❌ (not built) | 🟡 (start/stop, no live map in owner app) | 🟡 | ✅ |
| Service report (photos + notes at end) | ❌ | ✅ (Rovergrams / update messages) | 🟡 | ✅ |
| Reviews (booking-linked, verified) | 🟡 model exists; not surfaced consistently | ✅ | ✅ | ? |
| Pet profile (canonical, reused across services) | 🟡 `petProfiles` table; per-service snapshots not consistent | ✅ | ✅ | 🟡 |
| Loyalty / membership tier | ✅ Prestige | ❌ | ❌ | ❌ |
| Station integration | ✅ K9000 | N/A | N/A | N/A |
| Wallet / eGift | ✅ | ❌ | ❌ | ❌ |
| Accounting integration (Israel-compliant) | ✅ SUMIT | N/A | N/A | ? |
| Fraud / reconciliation control (admin) | 🟡 LANE B started | ? | ? | ? |
| Security: session-cookie only, no token in URL | ✅ (SSE + WS shipped this sprint) | ✅ | ✅ | ? |
| Admin: verified-email + allowlist super-admin | ✅ (this sprint) | N/A | N/A | ? |
| Native mobile app | ❌ (web-first) | ✅ | ✅ | ✅ |
| Background GPS (provider mobile) | ❌ | ✅ | ✅ | ✅ |
| Passkey / Face ID | ✅ | ? | ? | ? |
| Push notifications | ❌ (email + SMS only) | ✅ | ✅ | ✅ |
| Deep-link into specific booking / live map | ❌ | ✅ | ✅ | ✅ |

## Where PetWash is uniquely ahead (do not lose)

- Prestige tier progression + wallet + eGift + K9000 stations + SUMIT-compliant Israeli invoicing.
- Same-account multi-service + admin verified-email + verified super-admin gate + WS session-cookie auth.

## Where PetWash is BEHIND (P0 gaps)

Per CEO §55 priority list — these are the ones to close before anything decorative:

1. **One identity + additive capabilities across UI** — schema exists, mode-switch UI does not.
2. **Provider onboarding save/resume** — draft exists, per-section progress UI is uneven.
3. **Customer ↔ provider mode switch** — not built.
4. **One booking state machine** — multiple writers still exist (LANE B closed the atomic races; canonical vocabulary + one-writer contract is unfinished).
5. **One provider availability/calendar** — service surfaces do not agree yet.
6. **Meet & Greet** — missing entirely.
7. **Provider Today** dashboard with the huge state-aware "START WALK" CTA — not built.
8. **Live service session / GPS** — not built. This is WhatIDog's differentiator.
9. **Service report / photos / notes** — not built.
10. **Reviews after completion** — model exists; consistent post-completion prompt does not.
11. **Pet snapshot into booking** — not consistent.
12. **Push notifications** — not built.
13. **Deep-link routing to booking / live map** — not built.

## Update cadence

Update this doc when a canonical PR lands that changes a row, or when a competitor observably ships a new public thing (with source URL).
