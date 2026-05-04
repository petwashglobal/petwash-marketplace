# PR-25 — Booking Data Map (Coworker, plan-only)

> Read-only audit. **Do not** mutate bookings, payments, escrow, refunds,
> disputes, or provider reassignments from this document. The booking
> coworker uses this map to *detect* stuck or anomalous booking states and
> surface them to a human approver. Any remediation must go through an
> existing reviewed admin path.

## 1. Source-of-truth boundary

PetWash carries booking state in **PostgreSQL only** (Drizzle, `shared/schema.ts`).
Firestore and Firebase Auth are not on the booking write path. The 12-status
unified marketplace lifecycle in `bookings` is the canonical record; per-platform
booking tables (`walk_bookings`, `sitter_bookings`, `trainer_bookings`) carry
older lifecycle vocab and predate the unified table.

| Store                   | Role                                                             | Authority                                                |
| ----------------------- | ---------------------------------------------------------------- | -------------------------------------------------------- |
| PostgreSQL `bookings`   | Unified marketplace booking + 12-status lifecycle                | Owns `status`, escrow trigger, dispute trigger           |
| PostgreSQL `booking_status_history` | Audit trail of every status transition               | Owns who/why/when of every transition                    |
| PostgreSQL `escrow_holdings`        | 72-hour escrow lifecycle, refund + dispute markers   | Owns money state independent of `bookings.status`        |
| PostgreSQL `super_app_payments`     | Gateway-side payment record (Tranzila / Nayax)       | Owns gateway txn id, refund amount on the gateway side   |
| PostgreSQL `super_app_payouts`      | Israeli bank-transfer payout to provider             | Owns payout status — separate from escrow status         |
| PostgreSQL `booking_disputes`       | Customer-opened dispute record                       | Owns dispute reason + admin resolution                   |
| PostgreSQL `walk_bookings` / `sitter_bookings` / `trainer_bookings` | Per-platform booking + reassignment counters | Pre-unification; still active for those platforms     |

Drift between `bookings.status`, `escrow_holdings.status`, and
`super_app_payments.status` for the same `bookingId` is an observable stuck
state.

## 2. Collections / tables involved

### Core unified booking (`bookings`, lines 8284–8341)

| Field                                                                     | Notes                                                                      |
| ------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| `id` (varchar, uuid), `bookingNumber` (unique)                            | Primary identifiers                                                        |
| `platformId`, `userId`, `providerId`                                      | Tenancy + parties                                                          |
| `pickupLocationId`, `dropoffLocationId`, `stationId`                      | Optional location refs                                                     |
| `startTime`, `endTime`, `duration`, `timezone`                            | When                                                                       |
| `status` (default `'draft'`)                                              | 12-status lifecycle (see §4)                                               |
| `paymentStatus`, `paymentIntentId`, `paymentMethod`                       | Gateway link                                                               |
| `payoutStatus`, `payoutDate`                                              | Provider payout side                                                       |
| `subtotal`, `platformFee`, `providerPayout`, `discount`, `total`, `currency`, `taxAmount` | Money fields                                                  |
| `cancellationReason`, `cancelledBy`, `cancelledAt`                        | Cancel side                                                                |
| `refundAmount`, `refundProcessedAt`, `refundRequestedAt`, `refundReason`, `refundStatus`, `refundAmountCents` | Refund side                                       |
| `disputeOpenedAt`, `disputeResolvedAt`                                    | Dispute markers (denormalized from `booking_disputes`)                     |
| `confirmedAt`, `startedAt`, `completedAt`                                 | Lifecycle timestamps                                                       |
| `customerRating`, `customerReviewId`, `providerReviewId`                  | Review linkage                                                             |
| `transactionStampedAt`, `confirmationEmailSentAt{Customer,Provider}`      | Audit / email send markers                                                 |

### Status history (`booking_status_history`, lines 11303–11325)

`bookingId, fromStatus, toStatus, changedByUserId, changedByRole`
(`customer | provider | system | admin`), `reason`, `metadata`, `changedAt`.

### Escrow (`escrow_holdings`, lines 11328–11373)

| Field                                                      | Notes                                                         |
| ---------------------------------------------------------- | ------------------------------------------------------------- |
| `escrowId`, `bookingId`, `customerId`, `providerId`        |                                                               |
| `grossAmountCents`, `platformFeeCents`, `vatCents`, `netProviderAmountCents` | Money in agorot                                |
| `status`                                                   | `pending | held | releasing | released | refunded | disputed` |
| `capturedAt`, `serviceCompletedAt`, `releaseEligibleAt`, `releasedAt` | 72-hour escrow lifecycle                            |
| `refundRequestedAt`, `refundProcessedAt`, `refundAmountCents`, `refundReason` | Refund side                                |
| `disputeOpenedAt`, `disputeResolvedAt`, `disputeResolution` | `customer_favor | provider_favor | split`                    |
| `paymentIntentId`, `payoutTransferId`                      | Cross-link to gateway / payout                                |

### Payments (`super_app_payments`, lines 8407–8431)

`bookingId, userId, gateway, gatewayTransactionId, paymentIntentId, amount,
currency, status, paymentMethod, cardBrand, cardLast4, refundAmount,
refundReason, refundedAt, metadata, paidAt`.

### Payouts (`super_app_payouts`, lines 8434–8472)

Israeli bank ACH only — `providerId, bookingId, bankTransferReference,
providerBankIban, amount, platformFee, netAmount, status` (`pending |
in_escrow | released | processing | completed | failed`),
`escrowReleaseDate`, `aiVerified`, `aiVerificationScore`, `aiRiskLevel`.

### Disputes (`booking_disputes`, lines 14916–14932)

`bookingId, bookingType (default 'marketplace'), customerId, reason
(service_not_received | poor_quality | wrong_service | no_show | damage |
safety_concern | other), description, status (default 'open'), adminNotes,
resolvedBy, resolvedAt, createdAt`.

### Booking conversation (`booking_conversations`, lines 8647–8667)

`conversationId, bookingId, platform, customerId, providerId, chatStatus
(active | read_only | archived), closedReason (completed | cancelled |
refunded | disputed | expired), customerUnread, providerUnread, lastMessageAt`.

### Per-platform booking tables (pre-unification, still live)

| Table              | Status enum                                                       | Reassignment                                            | Refund column                          |
| ------------------ | ----------------------------------------------------------------- | ------------------------------------------------------- | -------------------------------------- |
| `walk_bookings`    | `pending | confirmed | in_progress | completed | cancelled`       | `reassignmentCount, previousProviders[], lastReassignedAt` | `refundAmount`                       |
| `sitter_bookings`  | `pending | confirmed | in_progress | completed | cancelled`       | `reassignmentCount, previousProviders[], lastReassignedAt` | `paymentStatus = 'refunded'`         |
| `trainer_bookings` | `pending | confirmed | completed | cancelled`                     | none                                                    | `paymentStatus = 'refunded'`, `escrowStatus = 'refunded'`, `walletRefundedCents` |

### Booking children / supporting

| Table                  | Purpose                                                                |
| ---------------------- | ---------------------------------------------------------------------- |
| `booking_pets`         | Booking ↔ pet join                                                     |
| `booking_items`        | Line items / addons                                                    |
| `availability_slots`   | 5-minute payment lock; `lockedByUid, lockedAt, lockExpiresAt, lockToken` |
| `booking_photos`       | Before/during/after photos for AI verification                         |
| `super_app_reviews`    | Post-booking reviews                                                   |
| `super_app_messages`   | In-booking messages (separate from `booking_messages`)                 |
| `booking_messages`     | Per-conversation chat messages with system events                      |

## 3. Write paths (where booking state changes)

| Step                                  | File / function                                                                                  | Mutates                                                                       |
| ------------------------------------- | ------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------- |
| Quote → booking creation              | `server/routes/marketplace-bookings.ts` `POST /quote`, `POST /create`, `POST /:quoteId/checkout` | `bookings` insert (`status='draft'` then advance), `quote_requests`           |
| Status transition (state machine)     | `server/services/BookingLifecycleService.ts → transitionStatus()`                                | `bookings.status`, `bookings.confirmedAt | startedAt | completedAt`, `booking_status_history` insert |
| Cancel                                | `server/routes/marketplace-bookings.ts` `POST /:bookingId/cancel` → `transitionStatus('cancelled', …)` | `bookings.cancelledAt`, `cancelledBy`, `cancellationReason`, history row    |
| Confirm / start / complete            | `POST /:bookingId/{confirm,start,complete}`                                                      | Status transition + timestamps                                                |
| Tranzila pay                          | `POST /:bookingId/pay-with-tranzila`, `server/services/TranzilaPaymentRequestService.ts`         | `super_app_payments` insert/update, `bookings.paymentStatus, paymentIntentId` |
| Nayax pay (in-vehicle / station)      | `server/services/NayaxOnlinePaymentService.ts`, `server/routes/nayax-payments.ts`                | `super_app_payments`, walk/sitter `paymentSessionId`                          |
| Escrow create (deposit_received)      | `BookingLifecycleService.createEscrowHolding` (auto on transition)                               | `escrow_holdings` insert (`status='pending'`)                                 |
| Escrow release (72h after completion) | `POST /process-escrow-releases`, `EscrowService` / `EscrowStateMachine`                          | `escrow_holdings.releasedAt, status`, `super_app_payouts` insert              |
| Refund (admin / dispute resolution)   | `PATCH /api/disputes/:id/resolve` (resolution = customer_favor or split)                         | `escrow_holdings.refund*`, `bookings.refund*`, `super_app_payments.refund*`   |
| Dispute open                          | `POST /api/disputes` (`server/routes/disputes.ts`)                                               | `booking_disputes` insert, `bookings.disputeOpenedAt`                         |
| Dispute resolve                       | `PATCH /api/disputes/:id/resolve` (admin)                                                        | `booking_disputes.status, resolvedBy, resolvedAt`, `escrow_holdings.disputeResolvedAt` + money movement |
| Provider reassignment (expiry poller) | `server/jobs/booking-expiry.ts`                                                                  | `walk_bookings | sitter_bookings . reassignmentCount, previousProviders[], lastReassignedAt`, `walkerId/sitterId` swap |
| Slot lock (pre-pay)                   | `server/services/BookingLockService.ts`                                                          | `availability_slots.lockedByUid, lockedAt, lockExpiresAt, lockToken`          |
| Conversation lifecycle                | `server/routes/booking-chat.ts`                                                                  | `booking_conversations.chatStatus, closedReason, closedAt`                    |
| System messages on transition         | `bookingEventLogger.ts`                                                                          | `booking_messages` insert (`messageType='system_event'`, `systemEventType`)   |

## 4. State machines

### Unified marketplace `bookings.status` (`shared/schema.ts → BOOKING_STATUS_TRANSITIONS`, lines 11409–11424)

```
inquiry
  → quote_sent → quote_expired (re-quote allowed)
  → quote_sent → deposit_pending → deposit_received
                                    → owner_confirmed
                                    → provider_confirmed
                                    → in_progress
                                    → owner_completion_review | provider_completion_review
                                    → completed             (terminal — escrow releases)
  → cancelled → refunded             (terminal)
  → disputed  → completed | refunded (admin resolution)
```

Service-layer guard (`BookingLifecycleService.transitionStatus` lines 442–447):
direct transition to `completed` is rejected unless `actorRole='system'` or
`'admin'`. Customer/provider must take the `*_completion_review` path so both
sides confirm independently.

### Escrow `escrow_holdings.status`

```
pending → held → releasing → released   (happy path, 72h after serviceCompletedAt)
                          ↘ refunded     (refund flow)
                          ↘ disputed     (dispute opened)
disputed → released | refunded           (admin resolution)
```

### Payment `super_app_payments.status`

`pending → captured → settled` (or `failed`, `voided`, `refunded`).
Per-station / Nayax flows additionally use `initiated | authorized |
vend_pending | vend_success | declined` (line 1234).

### Payout `super_app_payouts.status`

`pending → in_escrow → released → processing → completed | failed`

### Per-platform booking statuses (parallel — not the unified machine)

- `walk_bookings.status`: `pending | confirmed | in_progress | completed | cancelled`
- `sitter_bookings.status`: same set
- `trainer_bookings.bookingStatus`: `pending | confirmed | completed | cancelled`
- `trainer_bookings.escrowStatus`: `pending | held | released | refunded`

### Conversation `booking_conversations.chatStatus`

`active → read_only → archived`, with `closedReason ∈ {completed,
cancelled, refunded, disputed, expired}`.

## 5. Read paths (what the coworker would query)

All reads must go through `server/services/coworker/readonly-db.ts`
(SELECT-only guard, see PR-20). The coworker would consume:

1. **Lifecycle health** — `bookings JOIN booking_status_history` to find
   transitions older than the SLA for that status.
2. **Money reconciliation** — `bookings ⋈ escrow_holdings ⋈ super_app_payments`
   on `bookingId` to detect three-way drift.
3. **Dispute queue** — `booking_disputes WHERE status = 'open'` ordered by
   `createdAt`.
4. **Reassignment storms** — `walk_bookings | sitter_bookings WHERE
   reassignmentCount >= N`.
5. **Lock leaks** — `availability_slots WHERE lockExpiresAt < now() AND
   status = 'held'`.
6. **Conversation hygiene** — `booking_conversations WHERE chatStatus =
   'active' AND lastMessageAt < now() - SLA AND bookings.status IN (terminal)`.

## 6. Observable stuck states (detection rules — read-only)

Each rule below is a SELECT a coworker can run. Money rules deliberately
**flag, never fix**.

### B1. Escrow held but booking not completed past SLA

```sql
SELECT b.id, b.status, b.completed_at, e.status AS escrow_status, e.release_eligible_at
FROM bookings b
JOIN escrow_holdings e ON e.booking_id = b.id
WHERE e.status = 'held'
  AND e.release_eligible_at < now() - INTERVAL '24 hours'
  AND e.released_at IS NULL
  AND b.status NOT IN ('disputed', 'cancelled', 'refunded');
```

### B2. Booking marked completed but no escrow release

```sql
SELECT b.id, b.completed_at, e.status, e.released_at
FROM bookings b
JOIN escrow_holdings e ON e.booking_id = b.id
WHERE b.status = 'completed'
  AND b.completed_at < now() - INTERVAL '96 hours'
  AND (e.released_at IS NULL AND e.status NOT IN ('refunded', 'disputed'));
```

### B3. Three-way money drift (booking ⊕ escrow ⊕ payment)

```sql
SELECT b.id, b.status, b.payment_status, e.status AS escrow_status, p.status AS gateway_status
FROM bookings b
LEFT JOIN escrow_holdings e ON e.booking_id = b.id
LEFT JOIN super_app_payments p ON p.booking_id = b.id
WHERE (
   (b.status IN ('deposit_received','owner_confirmed','provider_confirmed','in_progress','completed') AND e.id IS NULL)
OR (b.payment_status = 'refunded' AND e.status NOT IN ('refunded','disputed'))
OR (e.status = 'refunded' AND b.refund_processed_at IS NULL)
);
```

### B4. Dispute open longer than SLA

```sql
SELECT id, booking_id, customer_id, reason, created_at
FROM booking_disputes
WHERE status = 'open'
  AND created_at < now() - INTERVAL '5 days';
```

### B5. Cancelled booking with no refund decision

```sql
SELECT id, cancelled_at, cancellation_reason, refund_status, refund_amount
FROM bookings
WHERE status = 'cancelled'
  AND cancelled_at < now() - INTERVAL '72 hours'
  AND refund_status IS NULL
  AND total::numeric > 0;
```

### B6. Quote sent never converted

```sql
SELECT id, created_at
FROM bookings
WHERE status = 'quote_sent'
  AND created_at < now() - INTERVAL '7 days';
```

### B7. Deposit pending but never paid

```sql
SELECT id, created_at, total
FROM bookings
WHERE status = 'deposit_pending'
  AND created_at < now() - INTERVAL '24 hours';
```

### B8. Status transition with no `changedByUserId` (audit gap)

```sql
SELECT id, booking_id, from_status, to_status, changed_at
FROM booking_status_history
WHERE changed_by_user_id IS NULL OR changed_by_user_id = '';
```

### B9. Reassignment storm on a single booking

```sql
SELECT booking_id, reassignment_count, last_reassigned_at
FROM walk_bookings
WHERE reassignment_count >= 3
UNION ALL
SELECT booking_id, reassignment_count, last_reassigned_at
FROM sitter_bookings
WHERE reassignment_count >= 3;
```

### B10. Availability slot lock leaked

```sql
SELECT id, provider_id, locked_by_uid, lock_expires_at, status
FROM availability_slots
WHERE status = 'held'
  AND lock_expires_at < now() - INTERVAL '15 minutes';
```

### B11. Payout stuck in `processing`

```sql
SELECT id, provider_id, booking_id, status, processed_at
FROM super_app_payouts
WHERE status = 'processing'
  AND processed_at < now() - INTERVAL '48 hours';
```

### B12. Conversation still active on a terminal booking

```sql
SELECT bc.conversation_id, bc.booking_id, bc.chat_status, b.status, b.completed_at
FROM booking_conversations bc
JOIN bookings b ON b.id = bc.booking_id
WHERE bc.chat_status = 'active'
  AND b.status IN ('completed','cancelled','refunded')
  AND COALESCE(b.completed_at, b.cancelled_at) < now() - INTERVAL '14 days';
```

### B13. Payment captured but no booking row

```sql
SELECT p.id, p.booking_id, p.status, p.amount, p.paid_at
FROM super_app_payments p
LEFT JOIN bookings b ON b.id = p.booking_id
WHERE p.status IN ('captured','settled','succeeded')
  AND b.id IS NULL;
```

### B14. Booking flipped to `completed` by non-system actor (guard regression check)

```sql
SELECT booking_id, from_status, to_status, changed_by_user_id, changed_by_role, changed_at
FROM booking_status_history
WHERE to_status = 'completed'
  AND changed_by_role NOT IN ('system','admin');
```

If this returns rows, the service-layer guard in `BookingLifecycleService`
lines 442–447 is being bypassed somewhere.

## 7. What the coworker is allowed to do

- **READ** any of the tables above through `server/services/coworker/readonly-db.ts`.
- **REPORT** rule hits in a triage view (one row per booking, plus rule id
  B1–B14).
- **PROPOSE** a remediation that maps to an existing reviewed flow
  (admin dispute resolution, manual escrow release, support refund script
  in `docs/SUPPORT_REFUND_SCRIPT.md`) — without executing it.

## 8. What the coworker must NOT do

- Write to `bookings`, `booking_status_history`, `escrow_holdings`,
  `super_app_payments`, `super_app_payouts`, `booking_disputes`,
  `walk_bookings`, `sitter_bookings`, `trainer_bookings`,
  `availability_slots`, `booking_conversations`, `booking_messages`.
- Trigger refunds, escrow releases, payout retries, Tranzila / Nayax
  webhook replays, or provider reassignment.
- Change `bookings.status`, `escrow_holdings.status`, or any
  `*_at` lifecycle timestamp.
- Send confirmation / cancellation / refund emails.
- Add schema migrations or new dependencies.

The governance layer in `server/services/coworker/governance.ts` already
enforces the read-only invariant; this document is the *what* and *why* the
coworker is querying.

## 9. Open questions / observations for follow-up PRs

1. **Two booking models coexist.** The unified `bookings` table is the
   canonical 12-status lifecycle, but `walk_bookings`, `sitter_bookings`,
   and `trainer_bookings` each carry their own simpler status enum and
   their own refund/escrow columns. Detection rules must currently union
   across all four. A future PR should decide whether per-platform tables
   become projections of `bookings` or stay independent.
2. **Refund state denormalization.** `bookings.refundStatus`,
   `bookings.refundAmountCents`, `escrow_holdings.refundProcessedAt`, and
   `super_app_payments.refundedAt` all describe the same event. Today they
   are written by different code paths and can drift (rule B3).
3. **Dispute marker on `bookings`.** `bookings.disputeOpenedAt` and
   `disputeResolvedAt` are denormalized from `booking_disputes` but no
   trigger keeps them in sync — depends on caller. Worth verifying every
   dispute write path stamps both.
4. **No first-class `cancellations` or `refunds` table.** Cancellations
   live as columns on `bookings` + a `booking_status_history` row.
   Refunds are spread across `bookings`, `escrow_holdings`, and
   `super_app_payments`. A flat `booking_refunds` audit table would
   simplify reconciliation but is out of scope here.
5. **Reassignment is per-platform-only.** `walk_bookings` and
   `sitter_bookings` track `reassignmentCount` / `previousProviders[]`,
   but the unified `bookings` table has no reassignment columns.
   Cross-platform reassignment policy is implicit in `booking-expiry.ts`.
6. **Booking lifecycle vs. activation timestamps.** `bookings.confirmedAt`,
   `startedAt`, `completedAt`, `cancelledAt` are independent columns; the
   state machine doesn't enforce that they be set together with status —
   relies on `transitionStatus()` discipline (lines 449–462). Bypass paths
   (e.g. direct `db.update(bookings).set({ status })`) would skip them.
7. **Conversation closure.** `booking_conversations.closedReason` includes
   `expired`, but no cron is documented to set it. Rule B12 is the
   detection path.

---

*Plan-only document. No code changes. No data changes.*
