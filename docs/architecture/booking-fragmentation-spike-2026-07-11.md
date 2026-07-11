# Booking Fragmentation — Design-Only Spike

**Issue:** Execution-queue #148, Priority 7 — "Booking fragmentation design-only spike"
**Date:** 2026-07-11
**Status:** DESIGN / DOCUMENTATION ONLY. No code, route, or schema change. Not a PR.
**Related specs:** [`docs/architecture/06-booking-consistency.md`](./06-booking-consistency.md) (Postgres-as-truth), memory `four-gates-and-host-stay-journey-2026-07-02`, `deal-gate-master-spec`, `v2-booking-money-integrity`.

---

## 1. Objective

The repo has **many parallel booking route implementations and booking-engine services**, each with its own status vocabulary, refund path, and calendar behaviour. This document *maps* that fragmentation (it does not fix it) and proposes a single `BookingEngine` adapter interface the existing engines could implement **incrementally, without a cutover**.

This is deliberately narrower than `06-booking-consistency.md` (which is the data-truth roadmap). This spike is about the **route/engine surface** — how many code paths can create/confirm/complete/cancel a booking, and how to give them one shared contract.

---

## 2. Booking route implementations

All routes are mounted in `server/routes.ts` (mount points cited). "Table" is the primary Postgres/Firestore record each writes.

| # | Route file | Mount (`server/routes.ts`) | Primary table | Status vocabulary | Refund / cancel path | Calendar side-effect |
|---|---|---|---|---|---|---|
| 1 | `server/routes/booking-requests.ts` (4096 ln) | `/api/booking-requests` (12518) | `bookingRequests` (PG) | `bookingRequestStatusEnum` via `shared/lib/bookingStateMachine` `BookingStatus` (`booking-requests.ts:71`); `applyTransition()` guards (`:1391`,`:3352`) | `POST /:id/cancel` (`:3318`) — time-tiered refund (`:3369-3408`) → `EscrowService.refundEscrowPayment()` (`:3502`) + wallet release/refund (`:3540-3570`) | `calendarIntegrationService.deleteBookingEvent()` on cancel (`:3478`); `releaseSlotLock()` on decline/cancel (`:1516`,`:3468`) |
| 2 | `server/routes/bookings.ts` (1011 ln) | (helper routes) | **Firestore** `bookings` collection + PG `wallet_accounts` | ad-hoc strings: `pending`/`awaiting_confirmation`/`payment_held` → `confirmed`/`completed`/`cancelled` (`:546`,`:552`,`:649`,`:805`) | `POST /:id/cancel` (`:698`) → `bookingPolicyEngine.calculateCancellation()` (`:735`) → `EscrowService.refundEscrowPayment()` (`:787`) + wallet UPSERT (`:853`) | `calendarIntegrationService.deleteBookingEvent()` on cancel (`:838`). `POST /create` is **deprecated (410 GONE)** (`:44`) |
| 3 | `server/routes/marketplace-bookings.ts` (1768 ln) | `/api/marketplace-bookings` (12526) | `bookings`, `escrowHoldings` (PG) | `bookingLifecycleStatusEnum` / `BookingLifecycleStatus` (14 values, `schema.ts:11578`) | `POST /:id/cancel` (`:899`) → `bookingLifecycleService.transitionStatus(..,'cancelled')` (`:914`). No direct escrow release in the route | `calendarIntegrationService.deleteBookingEvent()` on cancel (`:926`) |
| 4 | `server/routes/unified-booking.ts` (658 ln) | `/api/unified-booking` (12477) | `bookings` (PG) | `UnifiedBookingStatus` (7 values: `DRAFT/QUOTED/CONFIRMED/IN_PROGRESS/COMPLETED/CANCELLED/REFUNDED`) | `POST /:id/cancel` (`:451`) → `unifiedBookingEngine.cancel()`; `POST /:id/refund` admin-only (`:500`). **DARK: disabled unless `UNIFIED_BOOKING_ENABLED=true`** (`:34-50`); trusts client price | none in route |
| 5 | `server/routes/super-app-bookings.ts` (1319 ln) | `/api/super-app...` (12xxx) | `bookings`, `superAppPayouts` (PG) | ad-hoc strings; provider-allowed set `['confirmed','declined','in_progress','completed']` (`:339`), `refund_pending` (`:1121`) | `POST /:pid/bookings/:id/cancel` (`:1031`) → `ProviderPayoutService.cancelEscrowAndRefund()` (`:1107`); emits financial docs + admin alert | none in route |
| 6 | `server/routes/walk-my-pet.ts` (2436 ln) | `/api/walk-my-pet` (12357) | `walkBookings` + `octopusBookings`/`octopusLedger` | ad-hoc: `pending_provider`→`confirmed`→`in_progress`→`cancelled` (`:573`,`:749`,`:1240`,`:861`) | decline path (`:857`) → status `cancelled` + CANCELLATION ledger entry (`:879`) + void receipts (`:897`). **No escrow release** (paid on accept, `:724`) | `walkSlotHolds` atomic locks (`:503`,`:1034`); `calendarIntegrationService.createBookingEvent()` on accept (`:817`,`:1177`) |
| 7 | `server/routes/academy.ts` (857 ln) | `/api/academy` (12341) | `trainerBookings` (PG, `bookingStatus` varchar) | ad-hoc: `pending`→`confirmed`→`cancelled` (`:268`,`:535`,`:447`) | `POST /:id/cancel` (`:415`) → `walletService.releaseBookingHold()` or `refundBookingWallet()` by `financeState` (`:458-478`) | none explicit |
| 8 | `server/routes/sitter-suite.ts` (1906 ln) | `/api/sitter-suite` (12334) | `sitterBookings` + `octopusBookings`/`octopusLedger` | ad-hoc: `pending_provider`→`confirmed`→`completed`; `declined`/`payment_failed` (`:883`,`:1071`,`:1534`,`:1204`,`:1037`) | decline path (`:1199`) → `declined` + CANCELLATION ledger + void receipts. **No refund** (Nayax captures on accept, `:1020`) | `calendarIntegrationService.createBookingEvent()` on accept (`:1105`) |
| 9 | `server/routes/ai-booking.ts` (935 ln) | `/api/ai/booking` (via `aiBookingRouter`) | **none** (parse-only) | **none** — creates no bookings; parses free-text → prefill (`:9`,`:23`). Reads `availabilitySlots` (`:746`) read-only | N/A | reads `availabilitySlots`, does not write |
| 10 | `server/routes/octopus-engine.ts` | `/api/octopus` (12162) | `octopusBookings` (PG) | `octopusBookingStatusEnum` (`DRAFT/CONFIRMED/IN_PROGRESS/COMPLETED/CANCELLED`, `schema.ts:12241`); creates with `status:"CONFIRMED"` (`:207`) | write endpoints `/v1/bookings*`, `/v1/wallet*`, `/v1/ledger*` are **410 GONE** (`:15-58`); only read GETs live | none |
| 11 | `server/routes/deal-gate.ts` (33 ln) | `/api/deal-gate` | — (read surface only) | exposes `DealGateService.canConfirmBooking()` decision to UI/admin | none (read-only) | none |

**Count: 8 route paths can still create or mutate a real booking** (rows 1,3,4,5,6,7,8, + octopus row 10 which is now write-disabled). Rows 2 (`/create` deprecated), 9 (parse-only), 11 (read-only) do not.

---

## 3. Booking-engine / service layer

Behind the routes sit **overlapping service layers** (`server/services/`):

| Service | Role | Owns cancel/refund? | Is it "the Deal Gate"? |
|---|---|---|---|
| `DealGateService.ts` | **THE Deal Gate** — validates legal confirmability; additive audit tables only, never touches wallet/escrow ledgers directly (`:2`,`:12-13`) | `recordRefund()` (`:285`), shadow fee calcs `calcCancellationFee`/`calcNoShowFee` (`:238-278`) | **YES** (CEO master spec 2026-06-27) |
| `BookingLifecycleService.ts` | Status-transition validator + escrow settlement planner; drives `marketplace-bookings.ts` | validates via `BOOKING_STATUS_TRANSITIONS` (`schema.ts:11702`); plans escrow, no direct refund | no |
| `booking-facade.ts` | Façade routing to per-vertical engines (walk/pettrek/k9000/sitter); high-level `cancelBooking()` (`:219`) | delegates only | no |
| `booking-engines/base/BaseLuxuryBookingEngine.ts` | **Abstract base** for vertical engines; template methods `checkAvailability`/`quotePrice`/`reserveSlot`/`confirmBooking`/`cancelBooking` (`:101`,`:139`,`:226`,`:265`,`:354`) | template `cancelBooking()` | no |
| `booking-engines/walk/WalkEliteBookingEngine.ts` | GPS walker engine (extends base) | via base | no |
| `booking-engines/k9000/K9000StationBookingEngine.ts` | IoT station engine — **safety-fenced: NO booking rows / escrow / payout** (`:22-28`); Nayax rail only | forbidden | no (Machine Session gate) |
| `booking-engines/pettrek/PetTrekChauffeurBookingEngine.ts` | On-demand transport dispatch | via base | no |
| `SitterAdvancedBookingEngine.ts` | Sitter engine (extends `BaseLuxuryBookingEngine`); `cancelBooking()` (`:439`) uses `bookingPolicyEngine`+`escrowService` | yes | no |
| `unified-booking/UnifiedBookingEngine.ts` | Separate "PetWash spine" (Draft→Quote→Confirm); drives `unified-booking.ts` (DARK) | own workflow | no |
| `EnhancedBookingService.ts` | Legacy status/payment enums + `STATUS_TRANSITIONS` (local, divergent); drives `platform-api.ts` | — | no |
| `booking-service.ts` | Legacy monolith `createBooking/reserveSlot/cancelBooking` (`:996`) | state-guarded cancel, delegates refund | no |
| `BookingLockService.ts` | 5-min slot locks on `availability_slots` | lock/unlock only | no |
| `BookingPolicyEngine.ts` | Cancellation-policy tiers + refund math | refund calc only | no |

There is **no existing `BookingEngine` / `IBookingEngine` / `BookingAdapter` interface** in the repo. `BaseLuxuryBookingEngine` is the closest thing to a common contract, but only the walk/pettrek/k9000/sitter verticals extend it — `booking-requests.ts`, `marketplace-bookings.ts`, `super-app-bookings.ts`, `academy.ts` and `unified-booking` all sit outside it.

---

## 4. The Four Gates model (present, canonical)

From CEO ruling 2026-07-02 (memory `four-gates-and-host-stay-journey`) — PetWash is *one Octopus, four gates, never mixed*:

1. **Provider Booking Deal Gate** — Sitter / Walk / Academy / PetTrek. `booking-requests.ts` is the **CANONICAL** path; `DealGateService` is the brain. UnifiedBookingEngine is explicitly *not trusted* for confirmation unless migrated to Deal-Gate evidence.
2. **Machine Session Gate** — K9000 / Nayax / wallet-QR. One QR = one bay = one wash. `K9000StationBookingEngine` is fenced OUT of booking/escrow (row above).
3. **Commerce Order Gate** — Shop / eGift / packages (server-locked price → pay → issue → receipt).
4. **Ledger Gate** — append-only, idempotency-keyed, no direct balance edits.

Any unification MUST respect this: an adapter for gate-1 provider bookings must not become a backdoor into the machine or commerce gates.

---

## 5. Overlaps and divergences (findings)

- **Four different status vocabularies** for what is conceptually one lifecycle:
  - Canonical `BookingStatus` (14 values, `shared/lib/bookingStateMachine.ts:32`) — used by `booking-requests.ts`.
  - `bookingLifecycleStatusEnum` (14 values, `schema.ts:11578`, `inquiry`/`quote_sent`/…) — used by `marketplace-bookings.ts`.
  - `UnifiedBookingStatus` (7 UPPERCASE values) and `octopusBookingStatusEnum` (5 UPPERCASE) — divergent casing and granularity.
  - Free-string sets in `walk-my-pet.ts`, `sitter-suite.ts`, `academy.ts` (`pending_provider`, `payment_failed`, etc.) with no shared enum.
- **`bookings.ts` writes booking state to Firestore**, not Postgres — directly contradicts `06-booking-consistency.md §3.1` (Postgres-as-truth). This is the **single biggest divergence / drift risk.**
- **Refund/cancel is implemented five different ways:** time-tiered inline (`booking-requests`), `bookingPolicyEngine` (`bookings`), `bookingLifecycleService.transitionStatus` (`marketplace`), `ProviderPayoutService.cancelEscrowAndRefund` (`super-app`), and wallet hold/debit release (`academy`). Walk/sitter decline paths do **no** refund (capture-on-accept), which is correct for their model but means "cancel" has no uniform meaning.
- **Calendar side-effects are inconsistent:** create-event fires on *accept* in walk/sitter, but delete-event fires on *cancel* in booking-requests/bookings/marketplace, and super-app/academy touch no calendar at all. No single fan-out helper (the `06` spec's §4.2 gap, still open).
- **Two "unified" attempts already exist** and neither is the winner: `UnifiedBookingEngine` (DARK, price-untrusted) and `booking-facade.ts` + `BaseLuxuryBookingEngine` (real, but only 4 verticals). `octopus-engine` was a third attempt, now 410-GONE for writes.

---

## 6. Proposed `BookingEngine` adapter interface (no cutover)

**Design goal:** a *thin, additive* contract each existing engine can implement **one method at a time**, behind a registry keyed by service source. It does **not** replace any engine, own money, or bypass the Deal Gate — it standardises the *shape* of calls and normalises status to the canonical `BookingStatus`. Money/escrow stays where it is; the adapter only *delegates* to existing services (`DealGateService`, `EscrowService`, `BookingPolicyEngine`).

Incremental adoption path: (a) wrap the already-uniform `BaseLuxuryBookingEngine` verticals first (they nearly match); (b) add `booking-requests.ts` as the reference gate-1 adapter; (c) map each free-string vertical's status onto `BookingStatus` via `normalizeStatus`; (d) leave `bookings.ts`/Firestore and DARK `unified-booking` unmigrated until separately resolved. Nothing is deleted.

```ts
import type { BookingStatus, BookingActor } from '@shared/lib/bookingStateMachine';

/** Which of the FOUR GATES this engine belongs to. Adapters MUST NOT cross gates. */
export type BookingGate = 'provider_deal' | 'machine_session' | 'commerce_order';

/** Canonical service source (matches serviceSource column, e.g. trainer_bookings). */
export type ServiceSource =
  | 'pet_sitting' | 'dog_walking' | 'pet_training' | 'pettrek'
  | 'marketplace' | 'super_app' | 'unified' | 'k9000';

export interface Money { amountCents: number; currency: 'ILS'; }

export interface BookingRef {
  /** Public/opaque id used by the engine (requestId, bookingId, etc.). */
  id: string;
  source: ServiceSource;
  gate: BookingGate;
}

export interface QuoteResult {
  subtotal: Money; serviceFee: Money; vat: Money; total: Money;
  /** Server-locked — clients may never override (see unified-booking price-trust bug). */
  priceLockToken?: string;
}

export interface AvailabilityResult { available: boolean; reason?: string; slotHoldToken?: string; }

export interface TransitionResult {
  ok: boolean;
  status: BookingStatus;      // ALWAYS normalised to the canonical enum
  error?: string;             // set when ok=false (e.g. ILLEGAL_TRANSITION, DEAL_GATE_BLOCKED)
}

export interface CancelResult extends TransitionResult {
  refund?: Money;             // 0 when capture-on-accept model applies
  refundVia?: 'escrow' | 'wallet' | 'payout_reversal' | 'none';
}

/**
 * Common contract every booking engine can OPT INTO, method by method.
 * Default implementations may throw NOT_IMPLEMENTED so partial adoption compiles.
 * The adapter delegates money to existing services — it never edits a ledger itself.
 */
export interface BookingEngine {
  readonly source: ServiceSource;
  readonly gate: BookingGate;

  /** Read-only availability + optional 5-min slot hold (BookingLockService / walkSlotHolds). */
  checkAvailability(params: {
    providerId: string; startsAt: Date; endsAt: Date; petIds?: string[];
  }): Promise<AvailabilityResult>;

  /** Server-authoritative price. NO client-supplied totals. */
  quote(params: {
    providerId: string; startsAt: Date; endsAt: Date; petCount: number;
  }): Promise<QuoteResult>;

  /** Create the underlying record (bookingRequests / walkBookings / sitterBookings / …). */
  create(params: {
    ownerId: string; providerId: string; quote: QuoteResult;
    startsAt: Date; endsAt: Date; petIds: string[]; slotHoldToken?: string;
  }): Promise<BookingRef>;

  /** Normalise this engine's native status string to the canonical enum. */
  normalizeStatus(nativeStatus: string): BookingStatus;

  /** Fetch current canonical status (adapter reads native row, maps it). */
  getStatus(ref: BookingRef): Promise<BookingStatus>;

  /**
   * Apply a lifecycle transition. For gate='provider_deal' the adapter MUST call
   * DealGateService.canConfirmBooking() before allowing ->'confirmed'. Illegal
   * transitions return ok=false rather than throwing (see shared applyTransition).
   */
  transition(ref: BookingRef, to: BookingStatus, actor: BookingActor, reason?: string): Promise<TransitionResult>;

  /**
   * Cancel + resolve money via the engine's EXISTING refund path (escrow / wallet /
   * payout reversal). The adapter must NOT invent a new refund rail — it delegates.
   */
  cancel(ref: BookingRef, actor: BookingActor, reason?: string): Promise<CancelResult>;

  /** Optional post-lifecycle calendar fan-out. No-op for engines with no calendar. */
  syncCalendar?(ref: BookingRef, event: 'created' | 'confirmed' | 'cancelled'): Promise<void>;
}

/** Registry — routes resolve an engine by source instead of hard-coding one path. */
export interface BookingEngineRegistry {
  register(engine: BookingEngine): void;
  for(source: ServiceSource): BookingEngine; // throws UNKNOWN_SOURCE if not registered
}
```

**Why this is cutover-free:**
- Every method is optional-by-adoption; an engine can implement `normalizeStatus` + `getStatus` first (pure read mapping, zero risk) and wire the mutating methods later.
- Money and Deal-Gate logic are **delegated, not moved** — `cancel()` calls the engine's current refund code; `transition()` calls the existing `DealGateService`. No ledger logic is duplicated.
- Status is normalised at the boundary, so a caller can treat all engines uniformly while each engine keeps its native column untouched.
- Firestore-backed `bookings.ts` and DARK `unified-booking` simply stay unregistered until separately migrated — nothing forces them in.

---

## 7. Recommended follow-up (out of scope for this spike)

1. **Adopt canonical `BookingStatus`** (`shared/lib/bookingStateMachine.ts`) as the one normalisation target; retire ad-hoc strings via `normalizeStatus` mappers (read-only, safe first PR).
2. **Wrap `BaseLuxuryBookingEngine` verticals** in the adapter first — they already share a template, lowest-risk pilot.
3. **Make `booking-requests.ts` the reference gate-1 adapter** (it is already the CANONICAL provider path + Deal-Gate wired).
4. **Escalate `bookings.ts` Firestore-as-truth** to the `06-booking-consistency` workstream — it is the biggest divergence and blocks true unification.
5. **Single cancellation fan-out helper** (calendar + notification) — matches `06 §4.2` open gap; the adapter's `cancel()`/`syncCalendar?()` gives it a home.

*No code, schema, or route was changed by this spike.*
