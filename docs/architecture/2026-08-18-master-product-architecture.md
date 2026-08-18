# PetWash Master Product Architecture — 2026-08-18

Consolidates the CEO's 2026-08-18 fire orders:
- WhatIDog Competitive Response — Provider + Customer Super-App
- Rover / Mad Paws / WhatIDog Benchmark Directive

Companion files:
- `docs/competitive/README.md` + three competitor audits + scorecard
- `docs/nayax/2026-08-18-system-map.md`
- `shared/lib/canonicalDomainVocab.ts` (this PR)
- `shared/lib/bookingStateMachine.ts` (already on origin/main; canonical booking-transition authority)

## Core rule

Backend deep. Frontend easy.
One human = one canonical account. Capabilities are additive.
Different UI modes are VIEWS of the same backend state.

## Vocabulary registry

| Concept | Authority | Notes |
|---|---|---|
| Booking status transitions | `shared/lib/bookingStateMachine.ts` — `canTransition`, `applyTransition`, `BookingStatus` enum | Already exists; no PR should invent new states. Service surfaces must migrate to this. |
| User capabilities | `shared/lib/canonicalDomainVocab.ts` — `UserCapability` union + `CanonicalIdentity` | Additive. Provider approval ADDS. Provider rejection preserves customer. |
| Provider application state | `ProviderApplicationState` | Draft → Ready → Submitted → Under-review → More-info-required → Approved / Rejected / Suspended |
| Provider service capability state | `ProviderServiceCapabilityState` | Per-service ACTIVE / PAUSED so a walker can pause walking without pausing sitting |
| Pet profile | `PetProfile` (canonical) + `PetSnapshot` (immutable copy in a booking) | One pet profile; each booking snapshots only fields the service needs |
| Service session | `ServiceSession` + `ServiceLocationPoint` | Live-execution twin of a booking. Never the same object. |
| Service report | `ServiceReport` | Emitted at session completion. Photos are opaque storage refs, not signed URLs in the type. |
| Canonical domain event | `CanonicalDomainEvent` + `CanonicalDomainEventType` enum | Every meaningful state change fires ONE event. Notification engine fans out. No per-route independent send-four-messages. |
| Availability | `AvailabilityWindow` | ONE authority feeds marketplace search + provider dashboard + booking claim + reschedule. |

## Identity + capability rules

1. Firebase UID is the immutable primary key of a human.
2. Provider approval adds `provider_walker` (or the specific service capability) to `capabilities`. It never overwrites `customer` or removes `prestige_member`.
3. Provider rejection results in `provider_applicant` staying (or being cleared) but customer capability is unchanged. Pets, Prestige, wallet, bookings all remain.
4. Prestige is an entitlement, not a user type. A user can be `customer + prestige_member + provider_walker + provider_sitter` simultaneously.
5. Security = HUMAN identity, not role. ONE account/security/email/mobile/password/passkey/PIN screen — not per-role.
6. Role routing MUST be server-decided. `postLoginCoordinator` reads server state and picks the destination. Client-side `if (localStorage.role === 'provider')` is banned.

## Booking authority + service session

- The booking (`BookingStatus`) is the commercial agreement.
- The service session (`ServiceSession`) is the live execution.
- They are DIFFERENT records with different lifecycles. Do not conflate.
- Booking → service session transition is gated by `bookingStatusPermitsServiceStart(status)`.
- Live-session subscribers are derived from booking membership — see `canSubscribeToSession(session, uid)`. Client-supplied providerId / bookingId at the WS/SSE boundary is ignored for authority.

## Notification fan-out

Route handlers MUST NOT independently send push + email + SMS + in-app for the same event. They emit ONE `CanonicalDomainEvent` with a stable `idempotencyKey`; the notification engine decides which channels the user opted into and fans out. Webhook replay + double-click MUST NOT duplicate.

## Save/resume rule (provider onboarding)

- Every "Save & Continue" persists server-side to the provider_applications draft.
- Sections are independent unless a business rule requires otherwise.
- Per-section progress bar reads from the server draft.
- localStorage is NEVER the authority for onboarding progress.
- Refresh / close / different device — the server draft resumes exactly where the provider left off.

## Money invariance

- Refund %, VAT, commission, provider earnings, payout timing, Prestige/eGift economics, wallet math, SUMIT mapping — none of the WhatIDog-response work touches these.
- Nayax adapter design lives at `docs/nayax/2026-08-18-system-map.md`. Adapter is one-way translation on the wire; PetWash retains full control of funding composition and reservation.

## P0 gaps (from `docs/competitive/scorecard.md`)

In priority order, matching CEO §55:
1. One identity + additive capabilities across UI (backend supports it; UI mode-switch not built)
2. Provider onboarding save/resume UI (draft server-side; per-section UI uneven)
3. Customer ↔ provider mode switch
4. One canonical booking state machine (state machine exists; migration to consume it not complete)
5. One provider availability/calendar (multiple service surfaces disagree)
6. Meet & Greet as first-class booking state
7. Provider Today dashboard with state-aware primary CTA
8. Live service session + GPS
9. Service report / photos / notes at completion
10. Reviews after booking completion (surface exists; consistent post-completion prompt does not)
11. Pet snapshot into booking (pet profile exists; snapshot pattern inconsistent)
12. Push notifications (only email + SMS today)
13. Deep-link routing to specific booking / live map

## Sequencing

While agent quota is exhausted the coordinator ships small focused PRs in-thread:

**Now (this PR):**
- `shared/lib/canonicalDomainVocab.ts` — pure types, no side effects
- `docs/architecture/2026-08-18-master-product-architecture.md` — this doc

**When agents return:**
- P0.1: Capability registry migration — audit every place `role='provider'` is set and switch to additive `capabilities` array on users
- P0.2: Provider onboarding per-section progress UI reading from server draft
- P0.3: `<ModeSwitch>` component (customer/provider) reading capabilities from `/api/security/status` (extend the endpoint to return `capabilities`)
- P0.4: Migrate walk/sitter/marketplace/booking-requests status enums to consume `bookingStateMachine.canTransition`
- P0.5: Meet & Greet booking status + client flow
- P1.1: Provider Today dashboard scaffolding
- P1.2: `ServiceSession` DB model + start/finish endpoints
- P1.3: Live-location SSE (reusing prestige-pass session-cookie pattern for auth)
- P1.4: Provider service report screen + Firestore-transaction backend
- P1.5: Post-completion review prompt
- P1.6: Pet-snapshot copy at booking creation

## Do NOT

- Copy any competitor's brand, logo, copy, or visual composition
- Publish comparative marketing claims without CEO + `petwash-marketing-legal` sign-off
- Duplicate the booking state machine
- Duplicate the availability engine
- Fire notifications from route handlers directly
- Store onboarding progress in localStorage as authority
- Use `role='provider'` in a way that removes customer capability
- Split the backend to serve a customer app and a provider app separately — one canonical backend, mode-aware UI
