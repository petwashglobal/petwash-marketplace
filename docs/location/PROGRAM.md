# Location Infrastructure Program

> **Status:** governance document. Defines the structured PR sequence,
> hard rules, data model boundaries, and address-matching specification
> for Pet Wash's location subsystem.
>
> This document does NOT itself ship runtime code. It is the contract
> every Location-related PR must follow. Treat it like infrastructure
> design — not a dropdown.

---

## 0. Why this program exists

The CEO's directive (2026-05-11):

> "Lock the city foundation. Then consume it everywhere cleanly. If we
> jam bookings + provider matching + loyalty + admin + postcodes into
> one PR, we create another evil spaghetti layer exactly like the auth
> mess we just audited."

Location is shared infrastructure across the entire company:

* bookings
* provider matching
* subcontractors
* loyalty / rewards
* nearby services
* city activation / deactivation
* geo marketing
* wash station finder
* delivery radius
* insurance areas
* franchise regions
* support routing
* municipality analytics

These are **different systems** that all need to consume the **same**
city/address infrastructure. They must NOT each invent their own
location logic.

---

## 1. Hard rules (every Location PR must obey)

1. **One PR = one purpose.** No "while-I'm-here" mixing of city, booking,
   provider, finance, payment, or auth concerns.
2. **`citySymbol` is the canonical city key.** String, primary key,
   sourced from the Israeli CBS table baked into
   `shared/data/israel-cities.ts`. Every other system stores the symbol,
   never a free-text city name.
3. **No duplicate location logic.** If a feature needs city search,
   normalization, or lookup, it imports from
   `shared/data/israel-cities.ts`. It does not reimplement.
4. **No free-text city chaos.** Free-text city fields are forbidden in
   any new schema. UI must pick from the dataset.
5. **No mixing of auth / payment / provider logic.** Location PRs MUST
   NOT touch wallet, finance, payouts, K9000, Nayax, Tranzila, RBAC,
   audit logging, or schema migrations on those tables.
6. **No mega PR.** Each PR in this program ships independently and is
   independently revertible.
7. **Every system consumes the same dataset.** No copies, no forks, no
   parallel city tables.
8. **No invented data.** No fake postcodes, no fake districts, no fake
   distances without lat/lng. Every empty field is empty for a reason
   and stays empty until a CEO-approved source lands.
9. **Privacy first.** No raw address persisted without an explicit
   privacy review (PR-LOCATION-PRIVACY-1) approving the storage,
   retention, and access rules.
10. **Manual fallback.** First versions of matching SUGGEST, never
    auto-assign. The user always sees who is coming and where.
11. **Audit trail.** Match decisions are logged for post-hoc review.
12. **No live third-party APIs (Google Places, Israel Post, etc.) in
    the runtime path until both the API contract and the privacy
    impact are CEO-approved.**

---

## 2. Program PR sequence

The program ships as a sequence of small, single-purpose PRs. Each row
below is a separate branch, separate PR, separate revert.

### 2.1 Recommended ordering (CEO directive)

| # | PR ID                                | Status   | Purpose                                                                    | Depends on   |
| - | ------------------------------------ | -------- | -------------------------------------------------------------------------- | ------------ |
| 1 | `PR-LOCATION-CITIES-1`               | DELIVERED | City dataset foundation (1,272 rows, helpers, tests, docs)                | —            |
| 2 | `PR-LOCATION-ADDRESS-MODEL-1`        | planned  | Address fields/spec only — pure types + interfaces, no schema migration   | 1            |
| 3 | `PR-LOCATION-PRIVACY-1`              | planned  | Address privacy + retention + access rules — governance doc + invariants  | 2            |
| 4 | `PR-LOCATION-CITY-PICKER-1`          | planned  | Mobile luxury city picker UI component (he/en); NOT yet wired into forms  | 1            |
| 5 | `PR-LOCATION-PROFILES-1`             | planned  | Add city selector to user profile (consumes picker); save citySymbol      | 4            |
| 6 | `PR-BOOKINGS-CITY-SEARCH-1`          | planned  | Booking search bar consumes city picker; bookings store citySymbol        | 4            |
| 7 | `PR-PROVIDER-SERVICE-AREAS-1`        | planned  | Providers/subcontractors choose supported cities (citySymbol coverage)    | 1, 4         |
| 8 | `PR-LOCATION-ADDRESS-MATCHING-1`     | planned  | Nearby-matching SPEC + scoring model (no auto-assign yet)                 | 2, 3         |
| 9 | `PR-BOOKINGS-NEARBY-MATCHING-1`      | planned  | Booking match UI/backend — suggests providers; manual confirm always     | 7, 8         |

### 2.2 Parallel / later tracks

| #  | PR ID                          | Status   | Purpose                                                                    | Depends on   |
| -- | ------------------------------ | -------- | -------------------------------------------------------------------------- | ------------ |
| 10 | `PR-LOCATION-LOYALTY-1`        | planned  | Loyalty/rewards location-aware foundation (preferred city, regional promos) | 5            |
| 11 | `PR-LOCATION-MATCHING-1`       | planned  | Smart matching engine foundation (city/region/availability rules)         | 7, 8         |
| 12 | `PR-LOCATION-ADMIN-1`          | planned  | Admin: city activation/deactivation, regional controls, sheet sync         | 1            |
| 13 | `PR-LOCATION-POSTCODE-1`       | planned  | Postcode strategy research + spec; runtime rollout deferred                | —            |
| 14 | `PR-LOCATION-STATIONS-1`       | planned  | K9000 wash-station finder consumes city/coords (read-only against K9000)  | 1            |

> **Naming nit:** the CEO has used both `PR-PROVIDER-SERVICE-AREA-1`
> (singular) and `PR-PROVIDER-SERVICE-AREAS-1` (plural). The program
> uses the plural form. Either name in chat refers to row 7.

---

## 3. PR-by-PR scope contracts

Each subsection is the binding scope/non-scope for the named PR.
Future PRs MUST cite the contract here when they open. If scope drifts,
fix the doc first, then write code.

### 3.1 PR-LOCATION-CITIES-1 — DELIVERED ✓

**Scope:** Pet Wash–owned Israel city seed dataset (1,272 rows) +
helpers + regression tests + dataset doc.

**Out of scope:** UI, backend route, schema, booking wiring, provider
matching, payment, auth, admin, postcodes, district/region.

**Status:** branch `claude/pr-location-cities-1`, commit `02ad0682b`,
33/33 regression tests pass. Awaiting merge.

---

### 3.2 PR-LOCATION-ADDRESS-MODEL-1 — planned

**Scope:** Pure TypeScript address model in `shared/data/`. Types and
interfaces only — no schema, no migration, no DB table, no UI.

```ts
interface CustomerAddress {
  citySymbol: string;
  streetAddress: string | null;
  buildingNumber: string | null;
  apartment: string | null;
  postcode: string | null;          // null until PR-LOCATION-POSTCODE-1
  lat: number | null;               // null unless explicitly captured
  lng: number | null;
  addressConfidence:
    | 'city-only'
    | 'street-known'
    | 'building-known'
    | 'verified-coords';
  formattedAddress: string;          // display-only canonical render
}

interface ProviderAddress {
  baseCitySymbol: string;
  serviceCitySymbols: readonly string[];
  serviceRadiusKm: number | null;
  preferredAreas: readonly string[]; // free-form labels, opt-in
  blockedAreas: readonly string[];
  lat: number | null;
  lng: number | null;
}

interface BookingAddress {
  serviceAddress: CustomerAddress;
  citySymbol: string;
  matchingRadiusKm: number | null;
  selectedProviderId: string | null;
  matchScore: number | null;        // null until PR-LOCATION-ADDRESS-MATCHING-1
}
```

**Out of scope:** schema migration, persistence, UI, validation rules
that depend on a privacy review (those land in PR-LOCATION-PRIVACY-1).

---

### 3.3 PR-LOCATION-PRIVACY-1 — planned

**Scope:** Governance doc + non-runtime invariants for storing customer
address data:

* What can be stored (citySymbol always; full street only with explicit
  customer consent at booking time).
* Retention windows per address-confidence tier.
* Who can read (customer always; matched provider only after manual
  acceptance; admin only with audit-logged justification).
* Redaction rules in logs and dashboards.
* Right-to-deletion path.

**Out of scope:** runtime enforcement code (that lands in the PRs that
actually persist or display addresses). This PR is the contract.

---

### 3.4 PR-LOCATION-CITY-PICKER-1 — planned

**Scope:** A reusable mobile-luxury city picker component that consumes
`searchIsraelCities` and `getPopularIsraelCities` from the dataset.

* Hebrew + English search.
* Popular cities first.
* No auto-fill from IP / browser geolocation (locale-first per CEO
  doctrine).
* `<datalist>`-style suggestions on mobile keyboards.
* Returns `{ citySymbol, hebrewName, englishName }` to the caller.

**Out of scope:** wiring into the user profile form, the booking form,
or the provider onboarding form. Each consumer is its own PR (3.5–3.7).

---

### 3.5 PR-LOCATION-PROFILES-1 — planned

**Scope:** Add city selector to user profile using the picker from 3.4.
Profile saves `{ citySymbol, hebrewName, englishName }`. Optional:
`streetAddress`, `buildingNumber`, `apartment`, `postcode`, `lat`,
`lng` — but only if PR-LOCATION-PRIVACY-1 has approved the storage
contract.

**Out of scope:** provider matching, booking changes, payment, geo
pricing, schema migration that has not been schema-reviewed.

---

### 3.6 PR-BOOKINGS-CITY-SEARCH-1 — planned

**Scope:** Booking search bar consumes the city picker. Bookings persist
`{ citySymbol, hebrewName }`. Search/filter bookings by city.

**Out of scope:** provider radius matching, dispatch automation,
payment, payout. Pure city-level search.

---

### 3.7 PR-PROVIDER-SERVICE-AREAS-1 — planned

**Scope:** Providers (and subcontractors) choose the cities they serve
from the dataset. Provider record stores `serviceCitySymbols: string[]`.

**Out of scope:** automated matching, radius logic, postcode logic, map
overlays, dispatch automation.

---

### 3.8 PR-LOCATION-ADDRESS-MATCHING-1 — planned

**Scope:** Specification + scoring model for nearby matching. Pure
spec + tests against the spec; no auto-assign.

**Matching tiers (highest signal first):**

1. exact `citySymbol` match
2. same street match (exact streetAddress equality after normalization)
3. nearby street / building match (string-similar address within same
   citySymbol)
4. radius match by lat/lng (Haversine; only when both sides have coords)
5. provider availability window overlap
6. provider service-type match
7. provider rating / trust filters
8. customer preference signals (preferred provider, language, etc.)
9. fallback: wider city area within the same district (once district
   data lands)

**Hard rules for the match engine:**

* No fake distance math without real lat/lng on BOTH sides.
* No live Google Places / Israel Post / map provider call until the
  API contract AND privacy impact are CEO-approved.
* The engine SUGGESTS — it does not auto-assign.
* User must understand who is coming and where.
* Provider controls service areas; engine never overrides.
* Every match decision (input signals + chosen provider) is audit-logged
  for post-hoc review.

**Out of scope:** the booking UI that consumes the matches (that is
PR-BOOKINGS-NEARBY-MATCHING-1).

---

### 3.9 PR-BOOKINGS-NEARBY-MATCHING-1 — planned

**Scope:** Booking flow surfaces top-N suggested providers from the
match engine. Customer manually confirms. Provider manually accepts.

**Out of scope:** automatic assignment, surge pricing, dispatch
optimization, payment changes.

---

### 3.10 PR-LOCATION-LOYALTY-1 — planned

**Scope:** Loyalty/rewards become location-aware:

* preferred city per customer
* nearest-station hint (future, once stations expose coords)
* local promotions hook (future)
* municipality campaigns hook (future)
* regional notifications hook (future)

**Out of scope:** payment, payout, finance, K9000 hardware, Nayax,
Tranzila — Loyalty PRs do NOT touch any wallet/finance system.

---

### 3.11 PR-LOCATION-MATCHING-1 — planned

**Scope:** Smart matching engine framework:

* nearby providers query API (consumes 3.8)
* city-based matching helpers
* nearest-station routing (consumes 3.14)
* municipality campaign routing (future)
* region availability query
* service restrictions enforcement

**Out of scope:** AI / ML matching, payment logic, payout logic.

---

### 3.12 PR-LOCATION-ADMIN-1 — planned

**Scope:** Admin/operations console for the location subsystem:

* city activation / deactivation toggle (`isActive` per row)
* regional controls
* municipality grouping
* analytics dashboards (read-only)
* CSV / Sheet export
* Google Sheet sync (future)

**Out of scope:** customer-facing UI, payment, provider payout,
auth/admin roles changes.

---

### 3.13 PR-LOCATION-POSTCODE-1 — planned

**Scope:** Research + specification PR ONLY. No runtime rollout.

* Israel postcode realities (5-digit Israeli postcode adoption gaps).
* Comparison: Israel Post API, Google APIs, GovMap, OpenStreetMap.
* Radius vs postcode strategy trade-off.
* Street-level support.
* Canonical address strategy.

Output: a doc + a recommendation. The runtime PR follows separately
once the CEO confirms the source.

**Out of scope:** runtime calls, persistence, UI.

---

### 3.14 PR-LOCATION-STATIONS-1 — planned

**Scope:** Wash-station finder consumes citySymbol + (when available)
station coords. Read-only against existing K9000 station records.

**Out of scope:** any write to K9000 station records, any change to
station provisioning, hardware, or Nayax. Read-only.

---

## 4. Data-flow contract

```
            ┌────────────────────────────────────┐
            │  shared/data/israel-cities.ts      │  (PR-LOCATION-CITIES-1)
            │  citySymbol = primary key           │
            └────────────────────────────────────┘
                          │
        ┌─────────────────┼──────────────────────────────────────┐
        ▼                 ▼                                      ▼
  ┌───────────┐   ┌────────────────┐                   ┌─────────────────┐
  │ city      │   │ user profile   │                   │ provider        │
  │ picker UI │   │ stores         │                   │ stores          │
  │ (3.4)     │   │ citySymbol     │                   │ serviceCity     │
  └───────────┘   │ (3.5)          │                   │ Symbols (3.7)   │
                  └────────┬───────┘                   └────────┬────────┘
                           │                                    │
                           ▼                                    │
                 ┌──────────────────┐                           │
                 │ booking stores   │                           │
                 │ citySymbol       │                           │
                 │ (3.6)            │                           │
                 └────────┬─────────┘                           │
                          │                                     │
                          └────────────┬────────────────────────┘
                                       ▼
                          ┌──────────────────────┐
                          │ match engine (3.8)   │
                          │ scoring model        │
                          └──────────┬───────────┘
                                     ▼
                          ┌──────────────────────┐
                          │ booking nearby UI    │
                          │ suggests, never auto │
                          │ (3.9)                │
                          └──────────────────────┘
```

The arrows are **read-only** at every join. No system writes back into
the city dataset at runtime. Dataset edits go through a docs-reviewed
PR (PR-LOCATION-ADMIN-1 once it ships, or hand-edited PRs before then).

---

## 5. Failure modes this program prevents

A retrospective on the auth mess (forensic audit, 2026-05-10) showed
how a "core capability" can become a spaghetti layer:

* 4 parallel implementations of phone-OTP backends.
* 3 concurrent Face ID prompts racing on sign-in.
* Field-name mismatch (`phoneNumber` vs `phone`) breaking mobile sign-up.
* Dead components still routed.
* No single source of truth for "is this user signed in".
* No invariants pinned in tests, so each new PR could re-introduce the
  same bug.

This program prevents the same outcome for location by:

| Failure pattern (auth)              | Prevented here by                                              |
| ----------------------------------- | -------------------------------------------------------------- |
| 4 parallel backends                 | Hard rule §1.3 — single dataset, single source of truth        |
| Field-name drift                    | Hard rule §1.2 — `citySymbol` is the canonical key, everywhere |
| Concurrent racy flows               | Hard rule §1.10 — match engine SUGGESTS, never auto-assigns    |
| Dead components still routed        | Hard rule §1.6 — single-purpose PRs, every PR is revertible    |
| No invariants pinned                | Every PR ships a regression suite (per 3.1 precedent)          |
| Mixed auth / payment / business     | Hard rule §1.5 — Location PRs forbid touching those systems    |
| Free-text fields creating chaos     | Hard rule §1.4 — no free-text city anywhere                    |
| Privacy left until "later"          | PR-LOCATION-PRIVACY-1 lands BEFORE any persisted address       |

---

## 6. Definition of done — Location program

The Location subsystem is "done" (v1) when:

1. PR-LOCATION-CITIES-1 merged ✓ (delivered)
2. PR-LOCATION-ADDRESS-MODEL-1 merged
3. PR-LOCATION-PRIVACY-1 merged
4. PR-LOCATION-CITY-PICKER-1 merged
5. PR-LOCATION-PROFILES-1 merged
6. PR-BOOKINGS-CITY-SEARCH-1 merged
7. PR-PROVIDER-SERVICE-AREAS-1 merged
8. PR-LOCATION-ADDRESS-MATCHING-1 merged (spec + tests)
9. PR-BOOKINGS-NEARBY-MATCHING-1 merged (suggests; manual confirm)

Loyalty (3.10), Admin (3.12), Postcode (3.13), and Stations (3.14)
follow as v1.1.

---

## 7. Process

* Every Location PR cites this document and the §3.x contract that
  governs it.
* Every Location PR ships its own regression suite under
  `server/tests/` matching the PR id (e.g.
  `server/tests/locationProfiles.regression.test.ts`).
* Every Location PR runs Gate 1 / Gate 2 / Gate 3 per the
  `petwash-pr-guardian` skill.
* The CEO merges. The agent does not self-merge.
* Branch naming: `claude/<pr-id-lowercased>` (e.g.
  `claude/pr-location-city-picker-1`).

---

## 8. Open questions for the CEO (decide before the relevant PR opens)

| Question                                                      | Blocks PR                          |
| ------------------------------------------------------------- | ---------------------------------- |
| Approved postcode source (Israel Post vs Google vs GovMap)?   | PR-LOCATION-POSTCODE-1             |
| Approved district/region source?                              | PR-LOCATION-ADDRESS-MODEL-1 (extension) |
| Address-storage retention window (90d / 1y / forever)?        | PR-LOCATION-PRIVACY-1              |
| Match-engine tie-breaker preference (nearest vs highest-rated)? | PR-LOCATION-ADDRESS-MATCHING-1   |
| Auto-assign threshold (if ever) or always manual confirm?     | PR-BOOKINGS-NEARBY-MATCHING-1      |
| Google Sheet sync write-direction (read-only vs round-trip)?  | PR-LOCATION-ADMIN-1                |

These are decisions, not implementation details. Each one is a single
question; CEO answers in chat; the answer goes back into this doc as
an addendum before the relevant PR opens.
