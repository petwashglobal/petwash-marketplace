# 06 — Booking Consistency Architecture

**Status:** Spec only. No runtime change.

**Owning Financial Core Part:** Part 8 (Escrow / Booking Money Flow) for the money side; this section is the broader booking-truth architecture.

---

## 1. Objective

Eliminate the dual-truth ambiguity between PostgreSQL and Firestore for booking state, calendar availability, and lifecycle transitions. Establish a single source of truth (Postgres) with explicit derivative caches, deterministic cancellation propagation, timeout handling, and bullet-proof double-book prevention.

---

## 2. Current state

| Surface | Today |
|---|---|
| Booking primary record | `bookings` (Postgres) — schema in `shared/schema.ts:8284` |
| Per-vertical booking tables | `walkBookings`, `sitterBookings`, etc. — historical fragmentation |
| Availability table | `availability_slots` (Postgres) — supports lock tokens (PR-W4 pattern) |
| Provider availability | `provider_availability` (date-based) — separate table |
| Firestore booking mirror | Exists for some flows (mobile app real-time updates) — drift risk |
| Calendar sync | `calendarIntegrationService` writes to Google Calendar; one-way export |
| Cancellation propagation | Partial — cancel updates booking row, sometimes updates Firestore mirror, sometimes notifies via FCM |
| Timeout handling | `booking-expiry.ts` job sweeps stale bookings; idempotency partial |
| Double-book prevention | Lock-service exists (`BookingLockService.ts` — 5-minute lock with token) but not all routes use it |
| Availability search | PR-E #200 (the availability-flag-truth fix) — `availableForRequestedDates` now derives from real `bookings`-table overlap, no longer hardcoded `true` |
| Self-exclusion | PR-H #210 — provider doesn't see themselves in marketplace search |

---

## 3. Target architecture

### 3.1 Single source of truth: Postgres

- `bookings` is the canonical record. All booking state transitions are Postgres writes inside transactions.
- Firestore is a **derivative cache** (read-optimised; for mobile real-time fan-out only). Writes flow Postgres → Firestore via change-data-capture-style listener, NEVER the other way around.
- `availability_slots` is the canonical calendar (with lock-token semantics).
- `provider_availability` (date-based) is a derivative summary table refreshed nightly.

### 3.2 Cancellation propagation (deterministic fan-out)

When a booking is cancelled (any actor: customer / provider / system / admin):

```
1. Postgres: UPDATE bookings SET status='cancelled', cancelledAt=NOW(), cancelledBy=<actor> WHERE id=?
   (inside a transaction; idempotent on (id, status='cancelled'))
2. Postgres: UPDATE availability_slots SET status='available', bookingId=NULL WHERE bookingId=?
3. Postgres: write paired ledger entry per Part 8.3 (release escrow, queue refund per policy)
4. Postgres: insert audit_event (PR #198 pattern)
5. Postgres COMMIT
6. Async fan-out (post-commit; failures retried, never block the cancel):
   • FCM push to customer
   • FCM push to provider
   • Email via SendGrid
   • Firestore mirror update (read-cache)
   • Google Calendar event removal
   • Webhook to provider's external calendar (if integrated)
```

Each fan-out step is independently idempotent and retried via `AsyncJobWorker`. Failure of any one fan-out does not flip the booking back to confirmed — Postgres is truth.

### 3.3 Timeout handling (booking expiry)

Three timeout classes:

| Class | Trigger | Action |
|---|---|---|
| `pending_payment` > 15 min | Customer started checkout, never paid | Auto-cancel; release availability_slot lock; release escrow if any |
| `pending_provider` > N hours | Provider hasn't accepted or declined | Auto-cancel; refund customer fully; possibly auto-rematch (Section 5 marketplace logic) |
| `confirmed` past `endTime` | Service window ended without `completed` mark | Auto-flag for review; do NOT auto-complete (auto-completing without confirmation = fake success) |

`booking-expiry.ts` cron is the single owner of these transitions. Per-class timeout is configurable via env (Section 08 governance).

### 3.4 Double-book prevention (one truth per slot)

- `availability_slots` has `UNIQUE (providerId, startTime)` (or partial unique index excluding cancelled rows)
- Lock-token (5-min hold) acquired before payment intent created
- On payment success, lock-token converts to bookingId; slot status = `booked`
- On payment failure / timeout, lock auto-released by `booking-expiry.ts` sweep
- Concurrent attempts: `INSERT ... ON CONFLICT DO NOTHING` returning lets the loser instantly reject

The lock-token mechanism is already in `BookingLockService.ts`; the gap is that not all booking-creation routes use it. Coverage audit + per-route enforcement is the work.

### 3.5 Calendar sync authority

- Postgres → Google Calendar: one-way (export). Postgres is truth.
- Customer's external calendar import (e.g. iCal feed) is opt-in and read-only on our side.
- Provider's external calendar (sitters with personal Google Calendar): import is opt-in, treated as advisory (not a hard block on bookings); explicit availability_slot blocks remain authoritative.

### 3.6 Per-vertical fragmentation cleanup (long-term)

The historical per-vertical `walkBookings`, `sitterBookings` tables exist in parallel to canonical `bookings`. The plan (multi-PR, separate from this roadmap layer):

1. New code only writes to canonical `bookings`.
2. Per-vertical tables become read-only views or get backfilled and deprecated.
3. Eventually dropped (own migration class).

This is NOT in v1 of the consistency work — it is a long-running consolidation. v1 just ensures current dual writes don't drift.

---

## 4. Gaps from current to target

| Gap | Severity |
|---|---|
| Some routes still write to Firestore as authoritative | high — drift risk |
| Cancellation fan-out is partial / inconsistent across verticals | high |
| Lock-token usage is inconsistent across booking-creation routes | high (double-book risk) |
| `provider_availability` refresh job not running | medium |
| Timeout handling auto-completes some flows (audit needed) | high (fake-success risk) |
| No source-pin tests pinning Postgres-as-truth invariant | medium |

---

## 5. v1 launch scope vs deferred scope

**v1 launch scope:**
- Audit every booking-creation route for lock-token usage; close gaps
- Cancellation fan-out unified into a single helper invoked from every cancel path
- `booking-expiry.ts` sweeps for all 3 timeout classes
- Postgres → Firestore one-way sync helper
- `provider_availability` refresh job nightly
- Source-pin tests on Postgres-as-truth invariant + lock-token usage at every creation route

**Deferred scope:**
- Per-vertical table consolidation (multi-PR)
- Bidirectional calendar sync with provider's external Google Calendar
- Multi-region failover

---

## 6. Legal / regulatory / financial assumptions

- Cancellation rights per Israeli consumer-protection law (Part 0.3.4) drive the refund policy fired by the cancellation fan-out.
- Auto-completing a booking without explicit completion is fake success — Rule H violation; not allowed.
- Calendar entries that contain customer PII (pet name, address) are subject to data retention rules; export to Google Calendar carries the customer's consent given at booking time.

---

## 7. Open questions for human decision

1. **`pending_provider` timeout** — sitters typically respond in hours; walkers in minutes. Per-vertical defaults?
2. **Auto-rematch on provider timeout** — automatic, or always present customer with options?
3. **Customer's external calendar import** — opt-in feature scope?
4. **Per-vertical table deprecation timeline** — set a date for the consolidation?
5. **Late-cancel penalty model** — Mad Paws / Wolt / Gett patterns differ; CEO chooses (Section 9 fraud has the abuse model)
6. **Calendar PII consent** — explicit checkbox at booking, or implied by booking acceptance?

---

## 8. Dependency graph

**This section blocks:**
- Section 05 (marketplace payouts) — payouts depend on a clean `confirmed → completed` truth path
- Section 04 (Israeli compliance) — invoice issuance fires on `completed` event; requires that event to be reliable
- Section 09 (fraud) — late-cancel + no-show abuse detection
- Section 07 (admin observability) — booking dashboards consume canonical `bookings`

**This section is blocked by:**
- Nothing material; can begin in parallel with Section 02 (wallet)

---

## 9. Failure modes

| Failure | Effect | Mitigation |
|---|---|---|
| Postgres-Firestore drift (Firestore newer) | Mobile shows different state than reality | Postgres → Firestore sync is authoritative; Firestore-only writes flagged + disabled |
| Race on availability slot (two customers, one slot) | Double booking | Lock-token + UNIQUE constraint; loser receives `SLOT_TAKEN` 409 |
| Cancel fan-out partial failure (FCM down, Postgres committed) | Customer doesn't get push, but booking really is cancelled | Async retry queue; admin can re-fire; truth in Postgres; customer's next app open shows cancelled |
| Timeout cron auto-completes a stuck booking | Provider may not have actually delivered service | Timeout cron flags for review only; never auto-completes |
| Lock-token leak (token issued, never released) | Slot stuck `held` forever | `lockExpiresAt` + sweeper releases stale locks |
| Customer cancels twice (idempotency) | Second cancel attempts to re-debit / re-refund | `UPDATE ... WHERE status != 'cancelled'` with affected-rows check; second cancel is no-op |
| Booking flips state out of order (e.g. completed → confirmed) | Lifecycle violation | Per-state-transition `CHECK` constraint; allowed transitions enumerated |

---

## 10. Reconciliation strategy

- Per-day: count(bookings created) per vertical reconciled to count(payment authorisations).
- Per-day: count(bookings completed) reconciled to count(invoices issued for completed) — Section 04.
- Per-day: drift-detector — for each Firestore booking entry, find the Postgres canonical and assert state matches.
- Per-week: per-provider booking history reconciled to provider statement (Section 05).

---

## 11. Rollback / offset strategy

- A wrongly-cancelled booking → admin "uncancel" flow that creates a new booking referencing the original (lineage preserved). Original cancelled row stays.
- A wrongly-completed booking → cannot un-complete (revenue recognised); refund + credit-note flow per Section 04.
- Postgres → Firestore sync rollback: feature flag disables sync; Firestore returns to "stale but no false data" mode.

---

## 12. Execution PR sequence

| PR | Purpose | Class |
|---|---|---|
| `PR-BOOKING-SPEC` | This document | spec |
| `PR-BOOKING-1` | Lock-token usage audit + per-route enforcement | runtime |
| `PR-BOOKING-2` | Unified cancellation fan-out helper (one entry point) | runtime |
| `PR-BOOKING-3` | `booking-expiry.ts` sweeps for all 3 timeout classes (idempotent) | runtime |
| `PR-BOOKING-4` | Postgres → Firestore one-way sync helper | runtime |
| `PR-BOOKING-5` | `provider_availability` nightly refresh job | runtime |
| `PR-BOOKING-6` | Per-state CHECK constraints on `bookings.status` transitions | schema-migration |
| `PR-BOOKING-7` | Drift-detector job (Firestore vs Postgres) + alert | runtime |
| `PR-BOOKING-8..N` | Per-vertical table consolidation (multi-PR; sequenced separately) | schema-migration + runtime |

Each carries full 12-field metadata.
