# CONFIRM / REFUND writers — Lane B audit (2026-08-17)

CEO fire-order Lane B. Every writer that can flip a booking / escrow /
wallet / session row into a `confirmed` / `refunded` / `cancelled` /
`completed` state was catalogued end-to-end across the PetWash server
(HTTP routes, webhooks, cron jobs, background jobs, admin panels,
event handlers). Where two paths could race on the same business row,
the risk was scored and — if closable without changing money math — a
SAFE atomic guard was added on this branch.

**Branch:** `claude/lane-b-confirm-refund-writers` (off `origin/main`,
2026-08-17). **Never touched:** any monetary amount, VAT rate,
commission %, refund %, payout timing, provider earnings, receipt
mapping, or eligibility rule.

Cross-references you should NOT re-open:
* Atomic slot-claim on `/pay` — landed in PR #1856; not touched here.
* `PR-BOOKING-CANCEL-IDEMPOTENT` — already deployed for booking cancel;
  observed in-place, not touched here.

---

## Risk legend

* **CONFIRMED DEFECT** — reproducible failure_scenario with a concrete
  two-request race; fix shipped on this branch (or marked
  NEEDS-CEO-APPROVAL when a fix would touch money math).
* **PLAUSIBLE-VERIFY** — race exists in the code shape; observable
  effect appears bounded (idempotent overwrite, or protected by a
  downstream money-layer guard); no fix shipped, worth a follow-up.
* **SAFE** — writer already correctly guarded (SELECT FOR UPDATE,
  advisory lock, conditional UPDATE, idempotency key, dedup middleware
  or Firestore transaction).

---

## 1. CONFIRM writers

| # | file:line | trigger | writes | guard already present | risk |
|---|---|---|---|---|---|
| C-01 | `server/routes/sitter-suite.ts:1082` (was pre-fix) | `PATCH /api/sitter-suite/bookings/:id/provider-respond` | `sitterBookings.status='confirmed'`, Nayax capture, escrow doc, receipt | SELECT-then-Nayax-then-UPDATE; no lock | **CONFIRMED DEFECT — FIXED** (Lane B): wrapped in `withBookingMutationLock('sitter-provider-respond', ...)`. failure_scenario: provider double-taps Accept in the app; without lock, `nayaxSitterMarketplace.processBookingPayment` runs twice → customer's card charged twice for one booking. |
| C-02 | `server/routes/walk-my-pet.ts:785` (was pre-fix) | `PATCH /api/walk-my-pet/bookings/:id/provider-respond` | `walkBookings.status='confirmed'`, Firestore escrow doc, calendar event, owner SMS | SELECT-then-escrow-then-UPDATE; no lock | **CONFIRMED DEFECT — FIXED** (Lane B): atomic conditional UPDATE `WHERE status='pending_provider'` before escrow, 409 on losing request. failure_scenario: walker double-taps Accept → duplicate Firestore escrow doc + duplicate owner-notify SMS. |
| C-03 | `server/routes/walk-my-pet.ts:1248` (was pre-fix) | `POST /api/walk-my-pet/walks/:bookingId/confirm` (legacy) | `walkBookings.status='confirmed'`, walkAlerts insert, calendar event | check-then-act status | **CONFIRMED DEFECT — FIXED** (Lane B): conditional UPDATE `WHERE status='pending'` + 409 on race. failure_scenario: two concurrent confirms both insert `walkAlerts` rows + both create calendar events. |
| C-04 | `server/routes/booking-requests.ts:2414` (SUMIT return) → `:2492` | `GET /api/booking-requests/:id/sumit-return` | `bookingRequests.status='confirmed'`, escrow held-update, legacy bridge | Idempotent short-circuit (line 2432), Deal Gate check, status gate (`payment_pending` only) | **SAFE**: verified against server-side SUMIT re-verify; single-writer status_gate blocks stale returns. Two concurrent returns both idempotent-overwrite (same fields). |
| C-05 | `server/routes/nayax-webhooks.ts:1184` → `:1358` | `POST /api/webhooks/nayax/booking-request-payment` | `bookingRequests.status='confirmed'`, escrow held, legacy bridge, customer+provider notifications | Redis dedup on `br-webhook:${transactionId}`, IP allowlist, HMAC signature, idempotency check (`if status === 'confirmed'` short-circuit), status_gate (`payment_pending` only), Deal Gate | **SAFE**: multi-layer dedup. Two identical webhook deliveries dedup on Redis txn key; two different txns for same booking would fail Deal Gate. |
| C-06 | `server/routes/booking-requests.ts:3449` | `POST /api/booking-requests/:id/confirm` (handleConfirmCompletion) | `bookingRequests.status='completed'` + escrow release schedule | State-machine `applyTransition` guard | **PLAUSIBLE-VERIFY**: `applyTransition` rejects double-confirm from terminal state, but the SELECT+UPDATE around it is not atomic. Escrow release scheduling is guarded by `.where(status='held')` conditional UPDATE (SAFE). |
| C-07 | `server/routes/bookings.ts:500` | `POST /api/bookings/:bookingId/confirm` | Firestore `bookings/{id}.status='confirmed'` | Auth + status gate | **PLAUSIBLE-VERIFY**: Firestore update is not wrapped in `runTransaction`. Two concurrent confirms both pass status check + both write same value. Duplicate `booking_confirmed` audit + duplicate orchestrator hook. Recommend future PR wrap in Firestore transaction (same shape as `EscrowService.refundEscrowPayment`). |
| C-08 | `server/routes/unified-booking.ts:235` → `UnifiedBookingEngine.confirm` (line 222) | `POST /api/unified-booking/:id/confirm` | `bookings.status='confirmed'` + transaction stamp + wallet redemption confirm | Router is DARK (`UNIFIED_BOOKING_ENABLED=false` by default), transactionStampService is dedup'd | **SAFE while DARK**. Preventative note: no status_gate at engine level. When flag flips, wrap in `withBookingMutationLock`. |
| C-09 | `server/routes/marketplace-bookings.ts:790` | `POST /api/marketplace-bookings/:id/confirm` | `bookings.status='provider_confirmed'|'owner_confirmed'` via `BookingLifecycleService.transitionStatus` | `assertBookingParty`, `BOOKING_STATUS_TRANSITIONS` | **CONFIRMED DEFECT — FIXED** (Lane B, at service layer): `BookingLifecycleService.transitionStatus` now uses conditional UPDATE `WHERE status=currentStatus`. failure_scenario: two concurrent POSTs both flip `deposit_received → provider_confirmed` and both fire `createEscrowHolding` + `recordStatusChange`. Duplicate booking history rows suppressed. |
| C-10 | `server/routes/academy.ts:718` | `POST /api/academy/bookings/:id/confirm` | `trainerBookings.bookingStatus='confirmed'`, wallet debit | Only assigned trainer, status gate, `walletService.debitBookingFromHold` uses booking-scoped idempotency key `wallet:booking:debit:${bookingId}` | **SAFE**: money layer (`debitBookingFromHold`) is idempotency-keyed at the WalletLedger level; two concurrent confirms → same key → single debit. Status overwrite is idempotent. |
| C-11 | `server/routes/nayax-webhooks.ts:1085` | `POST /api/webhooks/nayax/checkout` — wash award | `wash_history.status='completed'` | `checkIdempotency` middleware | **SAFE**: dedup on eventId. |
| C-12 | `server/services/PaymentGatewayService.ts:544` (onPaymentSucceeded → bookings.status='confirmed') | fired from `nayax/terminal` webhook | `bookings.status='confirmed'`, escrow payout, customer SMS | outer `checkIdempotency` at terminal webhook | **SAFE**: outer dedup guarantees single delivery per `eventId`. |
| C-13 | `server/services/unified-booking/UnifiedBookingEngine.ts:295` (confirm) | called via C-08 | `bookings.status='confirmed'`, transaction stamp, wallet redemption | Guarded by DARK router | See C-08. |
| C-14 | `server/routes/pettrek.ts:629` | pet-trek complete | `bookings.status='completed'` | PetTrek is legally-blocked (pre-GA); route wired dark | **SAFE while pre-GA**. |
| C-15 | `server/routes/nayax-monyx-events.ts:*` | Monyx events | wash history / punch-card | `nayaxEventImport` dedup | **SAFE**. |

## 2. REFUND writers

| # | file:line | trigger | writes | guard already present | risk |
|---|---|---|---|---|---|
| R-01 | `server/routes/prestige-pass.ts:3938` (was pre-fix) | `POST /api/prestige-pass/admin/wallet/refund` | `refundToWallet(...)` (WalletLedger money-out) + `booking_requests|trainer_bookings.finance_state='refunded'` + audit | Admin claim required, `finance_state='debited'` gate, `refundCents ≤ maxRefundable` | **CONFIRMED DEFECT — FIXED** (Lane B): the idempotency key at WalletLedger embeds `Date.now()` so an admin can issue **multiple partial refunds** — but two concurrent admin clicks each mint a distinct key and each execute a full refund. failure_scenario: on a ₪100 debited booking, admin double-clicks Refund; without lock, customer wallet receives ₪200. Now wrapped in `withBookingMutationLock('admin-wallet-refund', bookingId)` — second click re-reads `finance_state='refunded'` and returns 422 "Nothing left to refund". |
| R-02 | `server/services/WalletService.ts:488` (refundRedemption; was pre-fix) | `POST /api/credit-wallet/redemptions/:sessionId/refund` (admin) | Atomic increments on `walletAccounts.egiftBalanceCents / washPackageCredits / loyaltyPointsBalance / promoBalanceCents` + `creditTransactions` insert + `redemption_sessions.status='refunded'` | Session status gate ('completed' only), atomic SQL increments | **CONFIRMED DEFECT — FIXED** (Lane B): the session-status flip was the LAST step of the function, so the "gate" at the top was a check-then-act race. Two concurrent refund calls both passed the gate, both ran the atomic increments, and restored credits **twice**. failure_scenario: on a ₪50 e-gift redemption, admin double-clicks Refund; without the atomic status claim, wallet's `egiftBalanceCents` gets +₪100 restored. Fix: atomic UPDATE `WHERE status='completed'` FIRST; loser returns idempotent-success. |
| R-03 | `server/services/BookingLifecycleService.ts:649` (settleEscrowTerminal; was pre-fix) | on cancel/refund transition via `transitionStatus` | `escrowHoldings.status='refunded'` + `auditMoney('BOOKING_ESCROW_REFUNDED')` | `planEscrowOnTerminal(escrow.status) === 'skip'` gate | **CONFIRMED DEFECT — FIXED** (Lane B): SELECT-then-UPDATE race — two concurrent cancel+refund transitions could both pass the plan gate and both emit `BOOKING_ESCROW_REFUNDED`. Fix: conditional UPDATE keyed on observed status. No money math change. |
| R-04 | `server/routes/unified-booking.ts:516` (was pre-fix) | `POST /api/unified-booking/:id/refund` (admin) | `unifiedBookingEngine.refund` → `transactionStampService.stampRefund` + `bookings.status='refunded'` | Admin auth only; NO status gate; NO idempotency key | **CONFIRMED DEFECT — FIXED** (Lane B): even though the router is DARK by default (`UNIFIED_BOOKING_ENABLED`), the fix is preventative. Wrapped in `withBookingMutationLock('unified-booking-refund')`; re-read inside lock returns 409 if `status='REFUNDED'` already. failure_scenario when flag flips on: admin double-clicks Refund; two `stampRefund` rows created; customer refunded twice. |
| R-05 | `server/services/EscrowService.ts:366` (refundEscrowPayment) | via `POST /api/escrow/:escrowId/refund`, `booking-requests /cancel`, emergency-cancel, various | Firestore `escrow_payments/{id}.status='refunded'` + audit | Firestore `runTransaction` with in-tx status check (`if e.status !== 'held' throw`) | **SAFE**: Firestore-atomic transaction. Two concurrent refunds — second throws inside tx. |
| R-06 | `server/services/RefundService.ts:66` (requestRefund) | called from `super-app-bookings /cancel`, ProviderPayoutService.cancelEscrowAndRefund, etc. | `refund_transactions` row keyed on unique `idempotencyKey`, then WalletLedger `refundToWallet` | UNIQUE(`idempotency_key`) constraint + WalletLedger hash-chained ledger with `SELECT FOR UPDATE` | **SAFE**: unique constraint on the DB row makes the second insert throw 23505; existing row is re-read and returned. Money-out via WalletLedger is single-shot. |
| R-07 | `server/services/WalletService.ts:1393` (refundBookingWallet) | `booking-requests /cancel`, academy `/cancel`, walk `/cancel` | WalletLedger `refundToWallet` + Israeli credit-note + refund SMS | Booking-scoped idempotency key `wallet:booking:refund:${bookingId}` (or `:${suffix}`) | **SAFE**: single key per booking → two concurrent refunds return `idempotent=true`; credit-note only emits on `!idempotent`. |
| R-08 | `server/routes/nayax-webhooks.ts:400` | `POST /api/webhooks/nayax/refund` | `paymentIntents.status='refunded'` | `validateNayaxSignature`, `checkIdempotency` | **SAFE**: outer dedup middleware. Update is idempotent overwrite. |
| R-09 | `server/routes/nayax-webhooks.ts:670,770,830` (payment.failed/expired/cancelled) | Nayax webhook | `escrowHoldings.status='refunded'` (void) | Signature + IP allowlist; status_gate on booking | **PLAUSIBLE-VERIFY**: escrow update is unconditional. Only fires for terminal payment events; escrow was never captured on these paths, so status='refunded' overwrite is a no-op for money. Low value fixing. |
| R-10 | `server/services/PaymentGatewayService.ts:757` (handleRefund) | fired from Nayax webhook | `paymentIntents.status='refunded'` | outer `checkIdempotency` at webhook route | **SAFE**: outer dedup. |
| R-11 | `server/services/unified-booking/UnifiedBookingEngine.ts:629` (refund method) | called from R-04 | `bookings.status='refunded'`, `refundAmount`, `refundProcessedAt` | none at engine level | Guarded now by R-04 lock. |
| R-12 | `server/routes/nayax-cortina.ts:346` | Nayax Cortina refund endpoint | LynxRefundService/RefundService | Signature + dedup via LynxRefundService idempotency | **SAFE**: money layer is idempotency-keyed. |
| R-13 | `server/routes/billing.ts:147` (`POST /api/billing/refund`) | admin billing refund | `BillingEngine.handleRefund` | Zod schema validation; adminId required | **PLAUSIBLE-VERIFY**: no explicit idempotency at the route; depends on `BillingEngine.handleRefund` inner guards (`billingLedger` has hash-chain). Recommend future PR: derive idempotency key from `recordId + bookingId + refundAgorot` and wrap in advisory lock, mirroring R-01 pattern. Not shipped this round to avoid touching billing math. |
| R-14 | `server/routes/booking-requests.ts:3768` (`/cancel`) | customer/provider cancel | `bookingRequests.status='cancelled'`, refundCents field, WalletService.refundBookingWallet | `applyTransition` state-machine + refundBookingWallet booking-scoped idempotency key | **SAFE**: money layer is idempotency-keyed (see R-07). Status overwrite is idempotent. |
| R-15 | `server/routes/booking-requests.ts:3555` (emergency cancel) | provider emergency cancel | `bookingRequests.status='cancelled'`, walletRefundedCents | Same key pattern as R-14 | **SAFE**. |
| R-16 | `server/routes/super-app-bookings.ts:1043` (`/cancel`) | booking cancel | `bookings.status='cancelled'`, `paymentStatus='refunded'|'refund_pending'`, `ProviderPayoutService.cancelEscrowAndRefund` → RefundService | RefundService has UNIQUE(idempotency_key) | **SAFE**: money layer via RefundService (R-06). Booking-row overwrite is idempotent. |
| R-17 | `server/jobs/booking-expiry.ts:243` | cron: expire unaccepted bookings | `bookingRequests.status='refunded'` | cron singleton, expiry criteria (SELECT for-update elsewhere) | **PLAUSIBLE-VERIFY**: not a customer double-effect target, but a follow-up could ensure the cron acquires a per-booking advisory lock before the wallet refund, mirroring R-01. |

## 3. Cross-writer race matrix

Pairs identified where the SAME business row could receive
duplicated business effects if both fired concurrently.

| A | B | shared row | duplicated effect | protection |
|---|---|---|---|---|
| C-01 sitter provider-respond | C-01 (same route, retry) | `sitterBookings` | Nayax **double-charge**, duplicate escrow doc, duplicate receipt | FIXED by advisory lock (this branch). |
| C-02 walk provider-respond | C-02 (same route, retry) | `walkBookings` | Duplicate Firestore escrow doc + duplicate owner SMS | FIXED by atomic conditional UPDATE (this branch). |
| C-03 walk legacy confirm | C-03 (same route, retry) | `walkBookings` | Duplicate calendar events + walkAlerts | FIXED (this branch). |
| C-04 SUMIT return | C-05 Nayax webhook | `bookingRequests` | Both flip payment_pending → confirmed; both notify | SAFE: idempotency short-circuit + status_gate on both; distinct txn ids would fail Deal Gate on the second. |
| R-01 admin wallet refund | R-01 (concurrent admin) | `booking_requests.finance_state` | **Double-refund** to customer wallet | FIXED by advisory lock (this branch). |
| R-02 redemption refund | R-02 (concurrent admin) | `walletAccounts` balances | Balance **double-restored** (e-gift + wash pack + loyalty + promo) | FIXED by atomic status claim (this branch). |
| R-03 escrow terminal settle (cancel) | R-03 (concurrent refund transition) | `escrowHoldings` | Duplicate `BOOKING_ESCROW_REFUNDED` audit | FIXED (this branch). |
| R-04 unified refund | R-04 (concurrent admin, when router hot) | `bookings` + transactionStampService | Two refund stamp rows → **double-refund** | FIXED preventatively (this branch). |
| C-09 marketplace confirm | C-09 (same route, retry) | `bookings` | Duplicate escrow holding attempt (guarded by `planEscrowOnCreate`), duplicate history rows | FIXED at BookingLifecycleService.transitionStatus (this branch). |
| C-07 firestore bookings confirm | admin panel confirm | Firestore `bookings/{id}` | Duplicate confirmation notifications + duplicate audit | **PLAUSIBLE-VERIFY** — not fixed this round (Firestore `runTransaction` wrap is the fix); low observable effect on money. Recommended follow-up. |
| R-13 billing refund route | R-13 (concurrent admin) | `billingLedger` | Depends on BillingEngine.handleRefund inner guards | **PLAUSIBLE-VERIFY** — not fixed this round; billing engine untouched to avoid math change. Recommended follow-up. |

## 4. NEEDS-CEO-APPROVAL (money-touching, not shipped)

None this round. Every closable race was fixable with atomic
serialization / conditional UPDATE / advisory lock — pure ordering
changes, zero money math change. The `PLAUSIBLE-VERIFY` items above
are candidates for a follow-up PR that Lane B intentionally did not
open in order to stay strictly inside the "no money math change"
mandate.

## 5. Money-invariance ledger

For each fix on this branch, the following are verified UNCHANGED
against the pre-fix code:

* Refund amount computation (WalletService.refundRedemption): same
  atomic increments, same rounding.
* Admin wallet refund cents (`prestige-pass.ts /admin/wallet/refund`):
  same `Math.min(amountCents, maxRefundable)`, same partial-refund
  allowance, same Date.now-based idempotency key (now guarded, not
  redesigned).
* Booking status transitions (`BookingLifecycleService`): same allowed
  transitions, same downstream side effects, same timestamps.
* Escrow settle amount (`settleEscrowTerminal`): same
  `escrow.grossAmountCents`.
* Sitter payment capture (`sitter-provider-respond`): same call to
  `nayaxSitterMarketplace.processBookingPayment`, unchanged.
* Walk escrow (`walkEliteBookingEngine.confirmBooking`): unchanged.
* Unified refund engine (`unifiedBookingEngine.refund`): unchanged.

No SUMIT/receipt call was moved, added, or removed. No VAT rate was
touched. No commission %, payout timing, or provider earnings
formula was touched.

## 6. Files added / changed this branch

* `server/lib/bookingMutationLock.ts` (NEW) — advisory-lock helper.
* `server/services/WalletService.ts` — atomic status claim in
  `refundRedemption`.
* `server/services/BookingLifecycleService.ts` — conditional UPDATEs
  in `transitionStatus` and `settleEscrowTerminal`.
* `server/routes/prestige-pass.ts` — `withBookingMutationLock` wrap of
  `/admin/wallet/refund`.
* `server/routes/unified-booking.ts` — `withBookingMutationLock` wrap
  of `/:bookingId/refund`.
* `server/routes/sitter-suite.ts` — `withBookingMutationLock` wrap of
  `/bookings/:bookingId/provider-respond`.
* `server/routes/walk-my-pet.ts` — atomic conditional UPDATE in
  `/bookings/:bookingId/provider-respond` and
  `/walks/:bookingId/confirm`.
* `tests/concurrency/*.test.ts` — regression pins and pure-logic
  concurrency tests for each fix.
