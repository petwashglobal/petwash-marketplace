# Automated Customer Refund Rail — Build Design (evidence-backed)

**Agent investigation 2026-06-23. Build-ready. Phase 1 = fully in our control; Phase 2 = vendor-dependent.**

## Key finding: the primitives EXIST and are solid — we need an orchestrator, not a rebuild
- `WalletLedger.refundToWallet` (`server/services/WalletLedger.ts:1214`) — idempotent (throws `REFUND_REQUIRES_IDEMPOTENCY_KEY`), double-entry `wallet_ledger_entries`, SHA-256 hash chain, `FOR UPDATE` lock. **Canonical wallet credit rail.**
- `K9000RedemptionService.autoCompensateSession` (`:1086-1239`) — restores the EXACT source bucket (wash-pack/cash/eGift/loyalty/promo), writes `credit_transactions` + `audit_ledger`. Real, idempotent. Only covers wallet-funded (Flow B); `terminal_card` skipped (`:1108`).
- `refund_approvals` (`shared/schema.ts:14028`) + `executeApprovalRefund` (`prestige-pass.ts:6456`) — 2-approver gate, auto-approve under `REFUND_AUTO_APPROVE_LIMIT_CENTS` (₪50), partial-safe, caps at `charged − refunded`. Wallet-only, marketplace/academy-only today.
- `IsraeliCancellationPolicy.customerCancellationRefundCents` — statutory 5%/₪100 floor, full on fault, 14-day cooling-off.
- `SumitClient` (`:212,224`) — KNOWS `Type:'CreditInvoice'` but every caller hardcodes `Type:'Invoice'`. No credit-invoice path wired.

## Where refunds are OWED but money does NOT move (the gaps to wire)
| Source | File:line | Sets | Moves money? |
|---|---|---|---|
| Marketplace cancel | `super-app-bookings.ts:1170-1182` | `paymentStatus='refund_pending'` + alert + SMS | NO |
| Escrow cancel TODO | `ProviderPayoutService.ts:642` | `super_app_payouts.status='failed'` | NO (`// TODO: Trigger Nayax refund`) |
| K9000 card wash fail | `MachineCommandService.ts:470-485` | `bay_events:'compensation_required'` | NO (card) |

## Design — one `server/services/RefundService.ts` orchestrator
`requestRefund({ sourceType, sourceId, userId, reason, requestedAmountCents?, idempotencyKey (REQUIRED), initiatedBy })`:
1. Compute owed via `IsraeliCancellationPolicy` (fault→full; else minus min(5%,₪100)).
2. **Instrument by how they ORIGINALLY paid** (keeps VAT/discounts honest): wallet/eGift/loyalty/promo/wash-pack → restore SAME bucket (reuse K9000 bucket-restore switch `:1136-1186`), no VAT event — **Phase 1**. Card via Nayax → Nayax void/refund + SUMIT CreditInvoice (VAT credit note) — **Phase 2**.
3. K9000-discount rule: refund `min(requested, charged − alreadyRefunded)` ONLY; never originate discount.
4. Execute → write ALL ledgers (`wallet_ledger_entries` → `credit_transactions` type `refund` → `billing_records` via `BillingLedger` → `audit_ledger` hash) → truthful SMS (`customer_refund_processed`, new) → flip status ONLY inside the same txn that confirmed the rail. **Fail-closed:** never mark `refunded` on optimism; on rail failure stay `failed`/`pending` + AlertEngine `payment` alert.

## Schema — `migrations/00NN_refund_rail.sql` (assign next free number at build time; coordinate w/ schema-drift migration) + add to schema.ts
New table **`refund_transactions`**: refund_id (unique), idempotency_key (UNIQUE NOT NULL), source_type, source_id, user_id, instrument, charged_cents, fee_cents, refund_cents, currency, status (pending|approved|executing|succeeded|failed|rejected), rail_ref, sumit_credit_doc_ref, billing_record_id, audit_hash, approval_id (FK refund_approvals), reason, initiated_by, timestamps. UNIQUE(idempotency_key); idx(status),(source_type,source_id),(user_id). Plus `bookings.refund_transaction_id`, `bay_sessions.refund_transaction_id`.

## Admin surface — EXTEND, don't rebuild
Generalize the existing refund queue (`prestige-pass.ts:6644` pending + `:6665/:6719` approve/reject) to read `refund_transactions` across all sources; surface in Alerts Center (`AlertEngine` `payment`); add an "Execute refund" action + a reconciliation view (owed vs succeeded = live liability).

## Scale/360° (10k–1M)
Nightly reconciliation (`DailyReconciliationJob.ts`) of succeeded vs Nayax settlement + SUMIT docs → aging liability alerts. Card refunds async → queue via `AsyncJobWorker`, never inline. Wallet refunds O(1). **VAT:** card refunds MUST emit SUMIT CreditInvoice (זיכוי) referencing original invoice (ITA); wallet/eGift restores = stored-value reversals, no credit note (matches eGift-no-invoice-by-design). Everything in `audit_ledger` + immutable `billing_records`.

## PHASED BUILD
**Phase 1 (ship first, fully ours):** create `RefundService.ts` + migration + `refundTransactions` table; wire `ProviderPayoutService.ts:642` TODO, `super-app-bookings.ts:1159-1182` (wallet-funded → execute + flip to refunded; card stays refund_pending+alert), delegate `executeApprovalRefund` to RefundService; add SMS `customer_refund_processed`.
**Phase 2 (vendor-blocked):** `SumitClient.createCreditInvoice()` (Type:CreditInvoice); verify+wire real Nayax void/refund (`NayaxJobDispatchPaymentService.voidPayment:290`, dev-simulated today); inbound `payment.refunded` webhook (`nayaxService.ts:532`) flips executing→succeeded idempotently; nightly reconciliation.

See [[refund-rail-gap-2026-06-22]], [[money-map-audit-2026-06-15]].
