# Marketplace Payout Rail — Design & Wiring Plan (2026-06-22)

**Status:** DESIGN — awaiting CEO sign-off. No code or money-math has changed.
**Scope:** the marketplace platforms only (The Sitter Suite, Walk My Pet, PetTrek, PetWash Academy / training). K9000 self-service wash is 100%-owned, commission-free, and out of scope here.
**Related:** `docs/finance/02-money-object-model.md`, `docs/finance/transaction-lifecycle-forensic-audit.md`, memory `refund-rail-gap-2026-06-22`. This doc is the forward design; those are the model/audit.

---

## 1. The problem in one sentence

For marketplace bookings, the system records money as "held / paid / completed" and tells the customer "escrow released after 72h," **but no money is ever captured at confirm, no escrow row is reliably created, completion releases nothing, and the bank-transfer payout is a deliberate stub** — so a provider is never actually paid and a customer is never actually charged through this path. The 15% commission math is correct but runs on money that never moved.

## 2. Why this is a single-owner decision (not a quick fix)

There are **four parallel escrow/payout systems**, each with its own storage. This is the core issue — and the reason the platform rule says finance is single-owner and "don't build a competing copy." We must **pick the rails**, not add a fifth.

| System | Storage | Status | Verdict |
|---|---|---|---|
| **EscrowService** | Firestore `escrow_payments` | LIVE (sitter routes create it) | Overlaps — reconcile or retire |
| **ProviderPayoutService** (`super_app_payouts`) | Postgres | LIVE rail + full gate chain (AI verify, insurance, payout gates, treasury) — bank transfer is a stub | **→ canonical MONEY rail** |
| **BillingEngine / EscrowStateMachine / BillingLedger** (`billing_records`) | Postgres | Best-built (hash-chained audit, agorot ints, idempotency) but **orphaned** — only mounted at `/api/admin` `/api/billing`, no booking flow calls it; moves no money | **→ canonical AUDIT / tax-doc source of truth** |
| **escrow_holdings** (`lib/escrowSettlement` + BookingLifecycleService) | Postgres | A fourth lane | Reconcile or retire |
| Station/partner: SettlementEngine, FinanceSettlementService | Postgres | Station-only / partner-only | Out of scope (not per-booking marketplace payout) |

**Recommended canonical pair (for sign-off):**
- **Money rail = `super_app_payouts` / ProviderPayoutService** — it already has the AI-verify + insurance + payout-gate + treasury chain and the bank-transfer seam.
- **Audit + tax-doc rail = `billing_records` / BillingEngine** — route completion through `BillingEngine.handleServiceCompleted` to get hash-chained audit + ITA document resolution "for free."
- **Retire/reconcile** the Firestore `escrow_payments` and `escrow_holdings` lanes so a booking never lives in two escrow systems at once.

## 3. Where it breaks (verified, file:line)

A sitter booking, confirm → completion → payout:

1. **No capture at confirm.** `super-app-bookings.ts:912` pay endpoint → `PaymentGatewayService.createPaymentIntent` (`:839`) **fabricates** `NAYAX_AUTH_…` and inserts a `created` row — no Nayax call. The four processors `processSitterPayment` / `processWalkPayment` / `processEGiftPayment` / `processK9000WebPayment` (`:655/664/700/708`) `return { success: true }` with a fake id. (Only `processPetTrekPayment` calls a real authorize.) → **"Payment Secured 🔒" fires against funds never captured.**
2. **Escrow row often never exists.** The `in_escrow` `super_app_payouts` row is created by `createEscrowPayout` (`:625`), reached only from `onPaymentSucceeded` (`:558`) — which runs on a **real Nayax `payment.succeeded` webhook**. The mock pay path never authorizes, so the webhook never fires, so no payout row.
3. **Completion releases nothing.** Provider completion `super-app-bookings.ts:1065` does a **raw `db.update` status flip** — does NOT call `bookingService.updateBookingStatus` (which would `createPayout`), NOT `scheduleEscrowRelease`, NOT release Firestore escrow. **"released after 72 hours" is a UI promise with no mechanism** + writes no audit row.
4. **Bank transfer is a stub.** Even with an `in_escrow` row, `ProviderPayoutService.processIsraeliBankTransfer` (`:465`) returns `blocked` unless `BANK_PAYOUT_LIVE==='true'`, else throws "not yet implemented." Payout maxes at `pending_transfer`. *(This is honest — it refuses to fake a completed payout.)*

## 4. Minimal wiring (smallest change, through the existing rails — NOT a rewrite)

**Already built — just needs CALLING:** `onPaymentSucceeded`/`createEscrowPayout`, `bookingService.createPayout`, `EnhancedBookingService.scheduleEscrowRelease`, `ProviderPayoutService.releaseEscrowAndPayout` + the full gate chain, the hourly auto-release cron, `BillingEngine.handlePaymentCaptured/handleServiceCompleted`.

**Genuinely new (the only two real builds):**
1. **Real Nayax authorize+capture** in `PaymentGatewayService` (replace the mock in `createPaymentIntent` + the 4 stub processors). Once capture succeeds → the existing webhook → `createEscrowPayout` auto-creates the escrow row.
2. **Real Israeli bank-transfer** in `processIsraeliBankTransfer` (the commented `IsraeliBankAPI.initiateTransfer` block) + flip `BANK_PAYOUT_LIVE=true`.

**Wiring (existing code, ~small diffs):**
3. Completion (`super-app-bookings.ts:1065`) → call `bookingService.updateBookingStatus(...,'completed')` (auto-creates payout) **or** route through `EnhancedBookingService.transitionStatus` (already calls `scheduleEscrowRelease` on COMPLETED) **and** `BillingEngine.handleServiceCompleted` (audit + tax doc). Add the missing audit row here.
4. Pick ONE escrow ledger (see §2) so sitter bookings stop living in two systems.

## 5. Schema (small; needs CEO approval per platform rules)

No new tables. Two integrity guards **before** enabling payouts:
- **`super_app_payouts`: `UNIQUE(bookingId)`** (or partial `UNIQUE(bookingId, status)`). Three code paths insert payout rows (`PaymentGatewayService.ts:625`, `EnhancedBookingService.ts:391`, `booking-service.ts:812`) with no uniqueness guard → **double-payout risk** once live. (`station_settlements` already has this; the payout table should too.)
- **`escrow_holdings`: `UNIQUE(booking_id)`** — `lib/escrowSettlement.ts:11` flags this constraint as missing. (Only if we keep this lane.)

## 6. Risks

- **Double-pay:** `super_app_payouts` is the weak link (3 insert sites, no UNIQUE) — add the constraint before `BANK_PAYOUT_LIVE=true`. Firestore EscrowService + `billing_records` are already idempotent.
- **Audit gap:** the rail we'd wire money through (`super_app_payouts`) is the *least* audited; the raw completion flip writes no audit row. Routing completion through `BillingEngine.handleServiceCompleted` fixes this (hash-chained audit for free) and satisfies the "every money mutation is audit-logged" rule.
- **K9000 compensation double-refund:** dormant today (no auto-refund rail exists). **Re-arms** the moment a refund rail is built — guard it with an idempotency key (`refund_pending:${bookingId}` is already used at `super-app-bookings.ts:1304`).

## 7. Phased plan (each = one approved PR)

- **P0 (schema, approval needed):** add `UNIQUE(bookingId)` to `super_app_payouts` (+ `escrow_holdings` if kept). Pure guard, no behavior change. Unblocks everything else safely.
- **P1 (wiring, no new money):** route provider completion through `updateBookingStatus`/`BillingEngine.handleServiceCompleted` so escrow-release is *scheduled* and audited. Still no real capture, but the state machine becomes honest + audited.
- **P2 (real capture — vendor-gated):** real Nayax authorize+capture in `PaymentGatewayService`. Requires Nayax marketplace card-capture to be contracted (Open Q2).
- **P3 (real payout — vendor-gated):** implement `processIsraeliBankTransfer` + `BANK_PAYOUT_LIVE=true` (Open Q3). The gate chain is already fail-closed.
- **P4:** retire/reconcile the duplicate escrow lanes (Open Q1).

Note: P2/P3 are blocked on external vendor availability, not code. Marketplace bookings/payouts are OFF for launch, so this is pre-launch correctness, not a live fire.

## 8. Open questions for the CEO

1. **One escrow ledger** — Firestore `escrow_payments` vs Postgres `super_app_payouts` as holding-of-record? (Recommend `super_app_payouts`.)
2. **Real capture vendor** — is Nayax marketplace card-capture (sitter/walk/academy) contracted and available? Without it there is nothing to escrow or pay out.
3. **Bank-transfer integration** — which Israeli bank API for `processIsraeliBankTransfer`? This is the gate to any provider being paid.
4. **BillingEngine adoption** — make `billing_records`/BillingEngine the marketplace tax-doc + audit source of truth (recommended), or keep admin-only?
5. **Pre-launch invariant** — OK to block enabling payouts until `UNIQUE(bookingId)` lands?
