# PetWash — "The Big Chain": Master Integration Plan (money · bookings · bookkeeping · records · backup · sync)

**2026-06-23. The unifying blueprint that integrates every captured design + audit into ONE coherent chain so every platform's money is correct and nothing drifts. Source of truth for sequencing the remaining build.**

> CEO ask: *"integrate them all into the big chain, all must move perfect sync, saved/backed up, records, money flaws, bookings, correct bookkeeping to each platform."* This doc is that chain.

## THE CHAIN (the one canonical flow every platform must follow)
```
1 BOOK      → booking row (tenant/platform-tagged, service-division coded)
2 QUOTE     → server-recomputed price (never client-trusted); commission 15% + VAT 18% correct
3 PAY       → instrument (card via Nayax / wallet / eGift / pass) → payment row, idempotent
4 ESCROW    → funds held (72h), provider earnings = PENDING
5 COMPLETE  → service delivered + confirmed
6 PAYOUT    → provider_earnings_wallet PENDING→AVAILABLE (gates) →PAID_OUT (bank confirm)
7 INVOICE   → SUMIT official doc per platform (Invoice/Receipt/CreditInvoice) + VAT + withholding
8 LEDGER    → wallet_ledger_entries (hash-chain) + billing_records (immutable) + audit_ledger
9 RECONCILE → nightly: owed vs moved, ledger==balance, succeeded vs vendor settlement
10 BACKUP   → nightly pg_dump of the WHOLE chain to GCS + tested restore
11 SYNC     → one system-of-record (Postgres); Firestore/Octopus are mirrors, reconciled
```
Every platform booking must produce: a payment record, a provider-earnings entry (if marketplace), an official SUMIT doc with correct VAT, a hash-chained audit row, and be recoverable from backup. **Where any link is missing = a money flaw.**

## PER-PLATFORM BOOKKEEPING TRUTH (from booking-fullcircle + money-map audits)
| Platform | Booking | Payment | Invoice/VAT/Receipt | Provider payout | Status |
|---|---|---|---|---|---|
| Unified booking | ✅ | ✅ | ✅ SUMIT | ✅ | COMPLETE |
| Shop | ✅ | ✅ | ✅ | n/a | COMPLETE (gated SHOP_ENABLED; tx + restock bug to fix) |
| Sitter | ✅ | ✅ | ✅ | ✅ | COMPLETE |
| **K9000 wash** | ✅ | ✅ | ❌ **no invoice/email** | n/a (owned) | **BROKEN bookkeeping** |
| **Trainer/Academy** | ✅ | ✅ | ❌ **no VAT/receipt** | ✅ | **BROKEN bookkeeping** |
| **Walk My Pet** | ✅ | ⚠️ nayaxTx undefined + customerEmail '' | ❌ **no txn/email** | ✅ | **BROKEN money trail** |
| eGift / Prestige | ✅ | ✅ stored-value | by design no invoice (stored value) | n/a | OK by design |
**→ The 3 bookkeeping fixes the chain needs:** K9000 wash → issue SUMIT receipt + email; Trainer → add VAT + receipt; Walk → fix nayaxTransactionId + customerEmail so the txn + receipt fire. (See [[booking-fullcircle-findings-2026-06-18]].)

## THE RAILS & INSTRUMENTS (don't mix — money-map)
- **Money rail (out):** `super_app_payouts` / `ProviderPayoutService` = canonical provider payout; bridges UID↔numeric-id via `providers.userId`. Earnings move to the NEW physically-separate `provider_earnings_wallets` (wallet-split design).
- **Audit/tax rail:** `billing_records` / BillingEngine (immutable) + SUMIT official issuer + `audit_ledger` hash-chain.
- **Instruments:** customer wallet (`wallet_accounts`, spendable) ≠ provider earnings (separate) ≠ eGift ≠ pass. **Discounts K9000-only.** Commission 15% everywhere; VAT 18% disclosed-agent.
- **Service divisions:** canonical `shared/serviceDivisions.ts` — every booking/credit/VAT row must carry the right division code (K9000 credits still carry none — fix).

## INTEGRATION SEQUENCE (build order so the chain locks together without breaking money)
**Phase 0 — protect the chain (ops + done):** ✅ schema-drift 0070/0071/0072 (no silent 42703 drops). 🔴 **nightly Postgres backup** (the chain isn't recoverable until this exists — do FIRST).
**Phase 1 — stop the leaks (money flaws, each its own tested PR):** wallet H1 (unique on credit_transactions), H2 (K9000 compensation idempotency interlock), H4 (loyalty per-booking idempotency — needs migration, NOT the agent's reroute, see corrected note), H5 (grants through hash-chain), H6 (redeem_voucher_atomic + egift idempotency index); swallowed-write fixes (prestige /join tx, K9000 Flow A 5xx, K9000 Flow B ledger-in-tx).
**Phase 2 — complete per-platform bookkeeping:** K9000 wash invoice+email; Trainer VAT+receipt; Walk nayaxTx+email; tag every credit row with its service division. → every platform now emits a correct SUMIT doc.
**Phase 3 — the money rail:** provider-earnings wallet split (shadow→authority); automated refund rail (phase-1 wallet/eGift in-control, phase-2 Nayax/SUMIT credit-invoice).
**Phase 4 — K9000 activation:** wire NayaxSparkService remote-vend + ack + bay-release + Flow-A void (needs Nayax creds/ops).
**Phase 5 — perfect sync + reconciliation:** make Postgres the single system-of-record; reconcile Firestore/Octopus mirrors; extend nightly recon to assert cash-bucket==ledger + provider-wallet==ledger + every owed-refund matched + per-platform invoice issued. Alert on any drift.
**Phase 6 — scale (10k–1M):** queue card refunds/payouts via AsyncJobWorker; durable timeout workers; retention/partitioning on ledger/command tables; tenant_id everywhere (global multi-tenant epic).

## "PERFECT SYNC / BACKED UP / RECORDS" — concrete definition of done
- **Synced:** one system-of-record (Postgres); every write awaits the DB and fails loud (no swallow-and-continue); mirrors (Firestore/Octopus) reconciled nightly with drift alerts.
- **Backed up:** nightly `pg_dump` of the full schema → GCS me-west1 + verified Neon PITR + a tested restore drill. (TODAY: only Firestore is dumped — Postgres has NO backup. Hard blocker.)
- **Records:** every money event in `billing_records` (immutable) + `audit_ledger` (hash-chain); every official doc in SUMIT; reconciliation runs persisted.
- **Money correct:** every platform emits the right SUMIT doc with 15% commission + 18% VAT + withholding; no double-credit/double-refund (Phase 1); refunds actually move (refund rail).

## CAPTURED PIECES THIS PLAN INTEGRATES (all in docs/ + memory — miss zero)
refund-rail-design · provider-earnings-wallet-split-design · nayax-wash-activation-design · go-live-audit-findings · schema-drift-deploy-gap · booking-fullcircle-findings · money-map-audit · service-division-salad · master legal framework + legal pack · global multi-tenant master · provider onboarding journey.

**Corrected note on wallet H4:** `loyalty_points` (spend-based) and `loyaltyBalanceCents` (rule-based credit) are TWO systems — don't reroute spend-points through `awardLoyaltyCredit` (corrupts units); reward_claims can't be reused (rule_key FK + booking_id is integer vs string). The fix = a dedicated migration-backed per-booking idempotency guard on the points path. Build it fresh with a test.

See [[money-map-audit-2026-06-15]], [[booking-fullcircle-findings-2026-06-18]], [[refund-rail-gap-2026-06-22]], [[payout-rails-identity-2026-06]], [[service-division-salad-2026-06-21]].
