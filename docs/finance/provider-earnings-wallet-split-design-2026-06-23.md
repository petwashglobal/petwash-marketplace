# Provider-Earnings Wallet Split — Build Design (evidence-backed)

**Agent investigation 2026-06-23. Build-ready. Additive (new tables) → safe.**

## Finding: NO live leak, but structurally fragile
- **Customer wallet** = `wallet_accounts` (`shared/schema.ts:11701`), one row per `userId` (`WalletService.getOrCreateWallet:70` keys on `users.id`). Buckets: cash/egift/washPackage/loyalty/promo/referral. `pendingBalanceCents` here = customer holds, NOT provider income.
- **Provider income** lives in FOUR divergent places, never in a wallet: (A) `contractor_earnings` keyed by Firebase **UID** (`schema.ts:5547`), (B) `super_app_payouts` keyed by numeric **providers.id** (`schema.ts:8658`), (C) `pw_provider_payouts` (`schema-payments.ts:129`), (D) DENORMALIZED `booking_requests.provider_payout_cents` summed on-the-fly by the dashboard (`provider-dashboard-v2.ts:299-354`). **No provider balance authority exists** — "pending/paid" is derived from booking status.
- **Mixing-risk surface:** `wallet_ledger_entries` (the customer ledger, `schema.ts:11883`) defines a `provider_payout` bucket + a `providerId` column (`:11897/:11915`). No writer funds a provider into a customer balance today, but one careless writer could — zero schema barrier.
- Self-booking blocked (`marketplace-bookings.ts:417`). Commission 15% + VAT 18/118 back-calc embedded in commission — correct in `payoutLedger.ts:98-107` + `bookingLedgerWriter.ts:80-87` (reuse, don't re-derive).

## Design — physically separate provider wallet (money can never mix)
**`provider_earnings_wallets`** — one row per provider, keyed on **`provider_uid` (Firebase UID)** + `provider_numeric_id` bridge (ends the UID-vs-id split). Cached buckets: `pending_cents` (accrued, in 72h escrow/gates not passed), `available_cents` (gates passed, payable), `paid_out_cents`, `blocked_cents` (open dispute) + lifetime gross/commission/vat. CHECK (>=0).

**`provider_earnings_ledger`** — append-only double-entry, the balance AUTHORITY (separate physical table; mirrors WalletLedger hash-chain). event_type: accrue|release|payout|dispute_hold|dispute_release|reversal|adjust; from_bucket/to_bucket; amount + gross/commission/vat; booking_id; source_payout_id; **UNIQUE(idempotency_key)**; previous_hash/entry_hash. Cached buckets = projections, re-derivable for recon.

**State machine:** completed →accrue→ PENDING; PENDING →release→ AVAILABLE (after 72h + checkPayoutGates + insurance); AVAILABLE →payout→ PAID_OUT (only on confirmed bank transfer — stub fail-closes today at `ProviderPayoutService.ts:465`, correct); PENDING|AVAILABLE →dispute_hold→ BLOCKED; BLOCKED →release/reversal. Every transition = a ledger event + same-txn bucket UPDATE.

## Guardrails
Customer wallet (wallet_accounts/userId) and provider wallet (provider_earnings_wallets/provider_uid) are **physically different tables — no shared row/column.** A provider-customer has both; never cross. **No code path** moves `available_cents` → `cashWalletBalanceCents` (if "pay me as wallet credit" ever wanted, it's a separate audited transfer event). Document `wallet_ledger_entries.provider_payout` bucket as forbidden + recon assertion that the customer ledger never nets a provider-credit.

## Scale/360°
Nightly recon: sum `provider_earnings_ledger` per wallet == cached buckets (extend `server/jobs/wallet-reconciliation.ts`, persist to `wallet_reconciliation_runs`). Hash-chain per wallet (reuse `computeEntryHash`). **UNIQUE(idempotency_key)** closes the app-only guard gap at `payoutLedger.ts:73` (keys: `accrue:{bookingId}:{providerUid}`, `payout:{payoutId}`). 1M: single-row indexed bucket UPDATEs, append-only ledger (no lock contention). `paid_out_cents` only advances on confirmed `bankTransferReference` → clean treasury tie-out.

## Migration + phasing (ASSIGN A FREE NUMBER — refund rail + schema-drift also want 0072; coordinate)
New `migrations/00NN_provider_earnings_wallet.sql` (2 tables + indexes + CHECK + UNIQUE) + `shared/schema-provider-earnings.ts` (mirrors schema-payments split). **Brand-new tables = zero disturbance to existing balances.** Backfill `scripts/backfill-provider-earnings-wallet.ts` (dry-run default, `--commit`): for each contractor_earnings/pw_provider_payouts/super_app_payouts row, create wallet (idempotent on provider_uid, resolve id↔UID via providers.userId) + post accrue/release/payout events with deterministic keys (re-run = no-op); assert buckets vs source before go-live.

- **Phase 1 (shadow, no behavior change, flag-off):** ship migration + `ProviderEarningsWalletService` (accrue/release/markPaidOut/disputeHold); wire `.accrue()` ALONGSIDE `createEarningRecord` (`booking-requests.ts:2088`) + rail B/C inserts; wire `.release()`/`.markPaidOut()` alongside existing release services; backfill; recon pass; read-only admin view comparing new wallet vs dashboard. Legacy tables stay source of truth.
- **Phase 2 (cut over):** make `available_cents` the payout authority the cron reads (instead of summing booking_requests/escrow); wire BLOCKED to incident engine; enforce DB UNIQUE(idempotency_key); retire denormalized `booking_requests.provider_payout_cents` dashboard math.

## Exact files to create
`migrations/00NN_provider_earnings_wallet.sql`, `shared/schema-provider-earnings.ts`, `server/services/ProviderEarningsWalletService.ts`, `scripts/backfill-provider-earnings-wallet.ts`, recon extension in `server/jobs/wallet-reconciliation.ts`.

See [[payout-rails-identity-2026-06]], [[money-map-audit-2026-06-15]], [[refund-rail-design-2026-06-23]].
