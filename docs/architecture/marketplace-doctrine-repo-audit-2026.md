# Marketplace Doctrine — Repo Audit 2026-08-29

Audit companion to:
- `petwash-marketplace-business-doctrine-2026.md`
- `petwash-marketplace-integrity-and-communications-2026.md`

Method: targeted `git grep` sweeps against the business doctrine's §18.4 bug
shapes + §14.8 security invariants. Findings are grouped by doctrine section
and ranked by risk to the marketplace model.

Status legend: **CLEAN** (no findings), **CONFIRMED** (doctrine drift found),
**INVESTIGATE** (needs code walk before verdict).

## Executive summary

| # | Doctrine axis | Status |
| --- | --- | --- |
| 1 | Body-trust for authority (§14.8) | **CLEAN** |
| 2 | Client decides "provider vs customer" from `users.role` (§74) | **CLEAN** |
| 3 | Rate unit matches service (§6, §4.3) | **CONFIRMED — P0 doctrine drift** |
| 4 | Multi-pet booking (§7, §5.1) | **CONFIRMED — P0 doctrine drift** |
| 5 | Global provider availability boolean (§16) | **CLEAN** (dev seed only) |
| 6 | Self-booking guard (§14.4) | **CLEAN** (already present) |
| 7 | Chat text changes booking price/status (§10.5) | **INVESTIGATE** (Round 2) |
| 8 | Duplicate authority — join Prestige (§18.5) | **CLEAN** (resolved 2026-08-29) |

## 1. Body-trust for authority — CLEAN

Sweep:
```
req\.body\.(customerId|providerId|ownerId|firebaseUid|bookerUid|buyerUid|sellerUid)
```
→ zero matches in `server/`.

Assessment: Task #30 ("role/accountType/isAdmin/isStaff body-field escalation
sweep") cleared this axis. Doctrine §14.8 currently HOLDS. Keep the sweep in
CI so a regression trips the audit rerun.

## 2. Client "provider vs customer" from `users.role` — CLEAN

Sweep:
```
users\.role\s*===\s*['"](provider|customer|sitter|walker|trainer)['"]
```
→ zero matches in `client/src/`.

Assessment: The 2026-08 additive-capabilities lane (task #70,
`PR-AUTH-MULTIROLE-5`) shifted decisions to whoami-projected axes:
`providerStatus`, `prestigeStatus`, `activeFlow`. Doctrine §3.4 HOLDS. Keep
whoami as the single client-side capability axis.

## 3. Rate unit matches service — CONFIRMED — P0 doctrine drift

Doctrine §6:
> Never treat every provider price as `pricePerHour`.
> DOG_WALKING → PER_WALK, PER_DURATION
> HOME_VISIT → PER_VISIT
> DAYCARE → PER_DAY
> PET_SITTING → PER_NIGHT, PER_24H
> TRAINING → PER_SESSION
> PET_TRANSPORT → BASE_PLUS_DISTANCE

Findings:

| File | Line | Drift |
| --- | --- | --- |
| `server/routes/booking-search.ts` | 840, 899, 991, 1141 | `pricePerHour` surfaced for walkers and trainers (should be `PER_WALK`, `PER_SESSION`) |
| `server/routes/providers.ts` | 21, 167 | `hourlyRate` in default column projection + `<= maxPrice` filter |
| `server/routes/super-app-bookings.ts` | 544 | Hardcoded fallback `hourlyRate: w.baseHourlyRate ?? 60` |
| `server/routes/booking-requests.ts` | 316, 403, 410, 419, 631 | `subtotalCents = hourlyRateCents * data.petCount` — per-hour × pet count contradicts §5.5 |
| `server/routes/groomers.ts` | 47 | `hourly = t.hourlyRate * …` |
| `server/services/quoteEngine.ts` | 328 | Quotes stamped `"per_hour"` |
| `server/services/SitterAdvancedBookingEngine.ts` | 159–166 | Sitter billed PER HOUR with day↔hour fallback. Doctrine: sitting = `PER_NIGHT` \| `PER_24H` |

Risk: quote snapshots (§6, §12) that lock in the wrong unit produce
long-tail refund + trust incidents. A day-priced sitter is not an hourly
worker; a per-walk walker charged by the hour undersells the walk model.

Fix path (per §18.2 — build an adapter, don't mass-rewrite):

1. Ship `ProviderServiceOfferService.pricingFor(providerUid, serviceType)` as
   the canonical read model, projecting the legacy field into the correct
   `{ baseRate, rateUnit }` shape per service.
2. New booking + search + quote code reads through the adapter.
3. Legacy read paths remain until Round 2 sweeps confirm zero callers.
4. Snapshot (§6) records the projected `rateUnit`; the legacy `hourlyRate`
   number field is only used when `rateUnit === 'PER_DURATION'` and the
   provider offer explicitly declared it.

No schema migration this round.

## 4. Multi-pet booking — CONFIRMED — P0 doctrine drift

Doctrine §7:
> A booking does NOT have only `petId`. It has `bookingPets[]`.

Findings:

| File | Line | Drift |
| --- | --- | --- |
| `server/routes/booking-requests.ts` | 777, 4884 | `petId: pd.petId ? Number(pd.petId) : null` — single `petId` scalar on the booking record |
| `server/routes/booking-requests.ts` | 419 | `subtotalCents = hourlyRateCents * data.petCount` — pricing per pet without per-pet care/eligibility (§5.3) |

Deeper walk is required in Round 2 to enumerate every write path. The scalar
`petId` alone doesn't confirm all bookings are single-pet — some routes
already pass a `petIds` array — but it does confirm the storage / DTO layer
is not consistently multi-pet.

Fix path (adapter-first, no schema migration):

1. `shared/marketplace/bookingParty.ts` — canonical `BookingParty` and
   `BookingPet` types.
2. `server/services/marketplace/BookingPartyAdapter.ts` — read model that
   returns `BookingParty[]` for any bookingId, projecting from whichever
   legacy shape the row uses (`petId` scalar, `petIds` array, or a linking
   table if one is added later).
3. Compatibility surface asserts §5.4 BEFORE booking confirmation.
4. Multi-pet pricing (§5.5) becomes a policy on `ProviderServiceOffer`.

## 5. Global provider availability boolean — CLEAN (dev seed only)

Sweep:
```
availability:\s*(true|false|boolean|available)
```
→ 10 hits, all in `server/scripts/seedProviders.ts` (dev fixtures).

Assessment: production availability is per-service (`AvailabilityRuleSet`).
Doctrine §4.2 / §16 HOLDS. No change required. Seed script may be updated
alongside the read-model work to seed per-service availability directly.

## 6. Self-booking guard — CLEAN (already present)

Location: `server/services/BookingLifecycleService.ts:304`. Regression pin:
`server/tests/checkoutProviderId.regression.test.ts:27`.

Doctrine §14.4 HOLDS.

## 7. Chat text changes booking price / status — INVESTIGATE (Round 2)

Doctrine §10.5:
> Chat text like "I'll do it for ₪220" or "Sure, see you tomorrow" does NOT
> change the booking. Only structured actions do.

Not audited this round. Round 2 sweep will focus on:
- routes accepting a plain chat message that also carries booking-state
  transitions in the same body
- any handler that upserts `quoteSnapshot` from a chat entrypoint
- any `POST /api/messages/*` variant that returns booking status
- structured-actions inventory in `chat_threads` + booking chat

## 8. Duplicate "join Prestige" authority — CLEAN

Resolved by PR #2175 (merged 2026-08-29, commit `1be77637`). `/loyalty/join`,
`/privilege`, `/vito` now route through `LoyaltyJoinRouter`; the retired
`PrivilegeSignup.tsx` remains untouched in the tree as archive only.

Doctrine §18.5 HOLDS for this axis.

## Priority — next lanes

**Lane α — `ProviderServiceOfferService` adapter (P0):**
1. Types + adapter + rate-unit contract test.
2. Wire `booking-search.ts`, `booking-requests.ts`, `providers.ts`,
   `super-app-bookings.ts`, `groomers.ts` through the adapter for READS.
3. Snapshot (§6) starts recording `{ baseRate, rateUnit }` on every new
   booking. Legacy `hourlyRateCents` on the booking row remains for
   compatibility until Round 2 clears callers.

**Lane β — `BookingPartyAdapter` (P0):**
1. Types + adapter.
2. Compatibility check + eligibility rendering per §5.3.
3. Pricing helper per §5.5 (first-pet base + extra, flat per pet, or care
   add-on — driven by offer, not one global formula).

**Lane γ — `MarketplaceRelationshipService` + `MeetAndGreetService` scaffolds
(P1):**
1. Types (see integrity doctrine §7.1, §7.3, §4).
2. Read models over existing booking pairs.
3. Meet & Greet CRUD + acknowledgement recording.

**Lane δ — `structured chat actions` (P1):**
Component library shared by booking chat + `chat_threads` surface. Rendered
inside chat, dispatches to the domain endpoint. Round 2 audit of chat-vs-
state coupling drives which endpoints get wired first.

**Lane ε — E2E matrix (P1):**
Wire integrity doctrine §16 (I1..I16) as Playwright specs. The pure engine
tests already lock the categorisation contract — E2E locks the wiring into
chat surfaces + the moderation audit write path.

## Non-goals this round

- No schema migration.
- No production activation of non-circumvention penalties (counsel gate).
- No LLM-decided enforcement.
- No merge without CEO.
