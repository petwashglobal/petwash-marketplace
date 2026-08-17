# Refund-Writer Inventory — every path that moves money backwards

**Date:** 2026-08-17 · **Scope:** `server/` · **Status of this document:** VERIFIED-SOURCE
(every entry was read in the source at the cited line; nothing was executed against
production money).

This is the answer to one question: *if money moves backwards in PetWash — a refund,
a void, a reversal, a credit note, a chargeback, an escrow returned to the customer —
which code did it, and can it fire twice?*

It exists because the codebase has **no single refund rail**. `RefundService` is the
canonical one and it is excellent, but it has exactly **one caller** in the entire
server. Every other backwards-money path was built separately, and several credit a
wallet with raw SQL that the hash-chained ledger never sees.

Companion to `petwash-money-booking-invariants` §4 ("money-in is idempotent; money-out
is gated and audited").

---

## 1. The canonical rails — use these

| Rail | Location | Guard |
|---|---|---|
| `RefundService.requestRefund` | `server/services/RefundService.ts:66` | Throws `REFUND_REQUIRES_IDEMPOTENCY_KEY` without a key; `UNIQUE(idempotency_key)` on `refund_transactions` is the race arbiter; insert failure re-reads and returns the existing row |
| `WalletLedger.refundToWallet` | `server/services/WalletLedger.ts:1214` | Throws without a key; `SELECT … FOR UPDATE` on `wallet_accounts`; in-transaction key re-check; `ON CONFLICT DO NOTHING` |
| `WalletLedger.releaseWalletHold` | `server/services/WalletLedger.ts:1039` | Same shape, plus a `pending >= amount` floor |
| `EscrowService.refundEscrowPayment` | `server/services/EscrowService.ts:366` | Firestore `runTransaction` + `if (e.status !== "held") throw` |
| `EscrowStateMachine.transitionEscrowState` | `server/services/EscrowStateMachine.ts` | `FOR UPDATE` + compare-and-set on the from-status → `EscrowConcurrentTransitionError` (added by M1, 2026-08-17) |
| `ProviderPayoutService.cancelEscrowAndRefund` | `server/services/ProviderPayoutService.ts:616` | CAS `WHERE id = ? AND status = 'in_escrow'`, then `RefundService` with key `refund:escrow:${payoutId}` |

`refund_transactions` (`shared/schema.ts:14268`) carries
`idempotencyKey: varchar(255).unique().notNull()` — the unique index is the guarantee.

---

## 2. Writers that BYPASS the canonical rails

Ordered by severity. Each was read in source; the line numbers are current as of this
document's date.

### P0 — raw-SQL wallet credits with no idempotency and no ledger entry

These credit `wallet_accounts.cash_wallet_balance_cents` directly with `pool.query`.
They write **no** `wallet_ledger_entries` row, so the SHA-256 hash chain that
`WalletLedger.verifyChainIntegrity` audits will disagree with the balance after every
call, and nothing dedupes a repeat.

| # | Location | Trigger | Notes |
|---|---|---|---|
| B1 | `server/services/BookingPolicyEngine.ts:176` `processAutoRefund` | internal | No key, no transaction, no ledger, no audit. `transactionId` is generated locally and **never persisted**. The owner lookup is `SELECT owner_id FROM sitter_bookings WHERE id=$1 UNION ALL SELECT owner_id FROM walk_bookings WHERE id=$1 LIMIT 1` — the two tables share a numeric `id` space, so this **can credit the wrong user**. Reachable only via `SitterAdvancedBookingEngine.cancelBooking` / `BaseLuxuryBookingEngine.cancelBooking`, neither of which has a live HTTP route today: **dormant, one route-wire away from live.** |
| B2 | `server/routes/walk-my-pet.ts:2492` `POST /walker/reject/:walkId` | user (walker) | Live. The booking-status CAS immediately above it (`if (!updated) → 404`) is the only thing preventing a double credit. Wallet errors are swallowed into `logger.error`. |
| B3 | `server/routes/bookings.ts:916` `POST /api/bookings/:bookingId/cancel` | user / admin | Live. Single atomic `ON CONFLICT … DO UPDATE` upsert — but `ON CONFLICT` creates-or-adds, it is **not** a refund dedupe. |
| B4 | `server/routes/disputes.ts:282, 358` `PATCH /api/disputes/:id/resolve` | super-admin | Transactional, and the escrow CAS (`WHERE escrow_id = $2 AND status NOT IN ('refunded','released')` + rollback on 0 rows) genuinely prevents a double credit. The defect is only the missing ledger entry. |

### P1 — escrow writes that can overwrite a terminal holding

`escrow_holdings.status = 'refunded'` with no `AND status NOT IN (…)` predicate, so a
holding already **released to the provider** can be stamped `refunded` — recording one
booking as both paid out and refunded.

| # | Location | Trigger |
|---|---|---|
| B5 | `server/routes/nayax-webhooks.ts:692` (`payment.failed`) | webhook |
| B6 | `server/routes/nayax-webhooks.ts:793` (`payment.expired`) | webhook |
| B7 | `server/routes/nayax-webhooks.ts:853` (`payment.cancelled`) | webhook |
| B8 | `server/routes/nayax-webhooks.ts:1584` | webhook — writes Firestore `escrow_payments/{id}.status='refunded'` **directly through `adminDb`**, bypassing `EscrowService.refundEscrowPayment` and therefore its `runTransaction`, its `status === 'held'` check and its `ESCROW_REFUNDED` audit row |

`server/jobs/booking-expiry.ts` was the fifth member of this group and was **fixed** on
2026-08-17 (M3) — it now carries `notInArray(escrowHoldings.status, ['released','refunded'])`.
`server/routes/disputes.ts:302` already had the correct guard and is the reference shape.

### P1 — idempotency keys deliberately defeated with `Date.now()`

`WalletLedger.refundToWallet` is genuinely idempotent; these three callers append a
timestamp to the key so it never collides. Combined with a read of
`wallet_refunded_cents` that happens **outside** any row lock, two concurrent admin
refunds can each pass the `maxRefundable` check and both execute.

| # | Location | Key |
|---|---|---|
| B9 | `server/routes/prestige-pass.ts:3985` `POST /admin/wallet/refund` | `wallet:booking:refund:admin:${bookingId}:${Date.now()}` |
| B10 | `server/routes/prestige-pass.ts:4068` `POST /admin/wallet/adjust` | `wallet:admin:adjust:${type}:${userId}:${Date.now()}` |
| B11 | `server/routes/prestige-pass.ts:4768` academy force-cancel | `admin-cancel:${uid}:${Date.now()}` |

The comment at B9 says the timestamp exists to allow multiple partial refunds. That is a
real product need — but the safe shape is a key derived from the *amount and a client
request id*, not from the clock. **CEO/finance decision required** before changing it.

### P2 — declared-but-never-paid, and missing authorization

| # | Location | Issue |
|---|---|---|
| B12 | `server/routes/unified-booking.ts:516` → `UnifiedBookingEngine.refund` | Sets `bookings.status='refunded'`, `refundAmount`, `refundProcessedAt` with **no status guard, no idempotency, and no money rail at all**. Repeated POSTs re-stamp the booking and emit duplicate events while zero money moves. |
| B13 | `server/routes/financial-approvals.ts:751` | Marks `refund_approvals → 'approved'` but **never calls `executeApprovalRefund`** — a refund approved through this console is silently never paid, while the identical action via `prestige-pass.ts:6942` does pay. Two divergent approval rails over one table. |
| B14 | `server/routes/pricing.ts:240` `POST /api/pricing/restore/:id` | Checks `req.firebaseUser?.uid` but does **no ownership check on `redemptionId`** — any authenticated user can restore any other user's coupon redemption. `server/routes/coupons.ts:174` documents this exact hole as a "coupon-farming hole" and gates its own `/restore/:id` behind `requireAdmin`. |
| B15 | `IsraeliDigitalReceiptService.issueCreditNote` (`:1140`) | No dedupe on `originalReceiptId` — two refunds of one booking produce two negative `digital_receipts` rows. Only the outbound SUMIT call is keyed. |
| B16 | `WalletLedger.adminAdjustWallet` (`:667`) | Writes the `wallet_idempotency_keys` row but **never reads it**, unlike every sibling method. The key is decorative. |
| B17 | `WalletLedger.adminCreditWithLedger` (`:602`) | Takes no idempotency key at all; hashes with an empty key slot. **Currently unreferenced** — a loaded gun, not a live wound. |
| B18 | `server/routes/prestige-pass.ts` | Three different admin definitions guard money-out in one router: Firebase custom claims (`/admin/wallet/*`), `session.user.isAdmin` (`/admin/wallet/refund-requests`), and `requireFinanceRole` (dispute resolution) — all mounted behind `optionalFirebaseToken`. |

---

## 3. Dead backwards-money code (present, unreachable)

Do not delete blind — see the dead-code inventory memo — but know that none of these can
fire today.

| Code | Location | Evidence |
|---|---|---|
| Entire `LynxRefundService` | `server/services/LynxRefundService.ts` | Repo-wide grep finds only self-references. **There is no wired card-refund rail anywhere.** |
| `NayaxPaymentService.handlePaymentRefunded` | `server/nayaxService.ts:532` | Its only entry point `handleWebhook` (`:211`) has zero callers |
| `TransactionEngine.processReversal` | `server/services/TransactionEngine.ts:731` | Zero callers |
| `WalletLedger.reverseEntry` | `server/services/WalletLedger.ts:756` | Zero callers |
| `WalletLedger.adminCreditWithLedger` | `server/services/WalletLedger.ts:602` | Zero callers |
| `LedgerService.voidPending` / `escrowRefundLegs` / `reverse` | `server/services/LedgerService.ts:460, 650, 655` | Gated by `ensureEnabled()` / `LEDGER_V2_ENABLED`; `reverse()` throws unconditionally |
| `BookingPolicyEngine.processAutoRefund` | `server/services/BookingPolicyEngine.ts:176` | Dormant (see B1) |

---

## 4. Well-guarded writers — copy these shapes

| Writer | Why it is right |
|---|---|
| `K9000RedemptionService.autoCompensateSession` (`:1202`) | Pre-check **plus** an in-transaction atomic claim `.where(and(eq(id), ne(status,'timed_out'))).returning()` with an abort on 0 rows |
| `rewardFulfillment` redemption cancel (`:88`) | Whole thing in one transaction; the points refund runs only for the caller that wins the status CAS |
| `prestige-pass.ts:5436` `POST /admin/wallet/reverse-action` | Admin-origin check, type allowlist, 24 h window, pre-existing-reversal check, stable key `wallet:admin:reversal:${txnId}`, unique-violation → 409 |
| `octopus-engine.ts:1718` K9000 compensation | Fully deterministic key `k9000:compensation:${sessionId}` |
| `shop.ts:585` order cancel | Stable key `shop-cancel-refund:${orderId}` |
| `disputes.ts:302` escrow CAS | `WHERE escrow_id = $2 AND status NOT IN ('refunded','released')` + rollback on 0 rows — the reference guard for `escrow_holdings` |

---

## 5. What is pinned in CI

`server/tests/refundWriterInventory.regression.test.ts` pins:

1. the canonical rails keep their idempotency guards;
2. the **set of files** performing raw-SQL `cash_wallet_balance_cents` credits does not
   grow — a new bypass fails the build;
3. `booking-expiry.ts` and `disputes.ts` keep their `escrow_holdings` terminal-status
   guard;
4. `refund_transactions.idempotencyKey` stays `.unique().notNull()`.

The pins **freeze the known bypasses at their current count**. They do not fix them.
Fixing B1–B18 is follow-up work and, for B9–B11, needs a finance decision first.
