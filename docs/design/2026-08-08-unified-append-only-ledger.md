# SDD: One Append-Only, Double-Entry Ledger for PetWash Money

- **Date:** 2026-08-08
- **Author:** SDD Writer Agent (for Nir / CTO)
- **Status:** Draft
- **Feature flag:** `LEDGER_V2_ENABLED` (default **OFF**), with sub-flags
  `LEDGER_V2_DUAL_WRITE`, `LEDGER_V2_READ_DERIVED`, `LEDGER_V2_RETIRE_MUTABLE` (all default OFF)
- **Related memory:** escrow-dual-store-fragmentation (2026-08-04), j5-authorization-hold-as-real-escrow (2026-08-06), money-integrity-sweep (2026-07-08), four-gates-and-host-stay (2026-07-02)

---

## 1. Summary

PetWash's money is spread across **Firestore + Postgres over ~6 booking systems and at
least 7 balance/ledger stores**, several of which keep **mutable balance columns** that
drift and race. This SDD designs a single **append-only, double-entry `ledger_entries`
table in Postgres** as the one source of truth for every money movement — customer
wallet, eGift liability, loyalty, escrow holds, provider payable/commission, platform
revenue, VAT payable, and SUMIT/Nayax settlement clearing. Balances become **derived
sums over the entry stream**, never a stored column. Escrow holds and J5 card
authorizations become **first-class pending transfers** that can post, void, or expire
but **can only resolve once** — structurally killing the double-release and
phantom-"secured" bugs. Every write carries a **DB-enforced idempotency key** derived
from booking/payment IDs, which closes the self-mint / double-pay windows. It ships as a
**staged, additive migration** — stand up alongside existing stores, dual-write, cut
reads to derived balances, retire mutable columns last — gated by a CI invariant that
asserts `SUM(debits) == SUM(credits)` on every seeded scenario.

This is the #1 recommendation from two independent research passes and it directly cures
known production bugs already documented in the CEO's audit memory.

---

## 2. Goals / Non-goals

### Goals
1. **One ledger.** A single `ledger_entries` table is the authoritative record of every
   money movement across all divisions (K9000/station, sitter, walker, pettrek, academy,
   gift, admin) and all rails (SUMIT online card, Nayax kiosk, wallet, eGift).
2. **Double-entry, self-checking.** Every event writes ≥2 rows that net to zero
   (`SUM(debit) == SUM(credit)`). The books are their own audit.
3. **Balances are derived**, never stored. `available`, `pending`, and `posted` are all
   projections over the entry stream. No mutable `*_balance_cents` column is ever the
   truth again.
4. **Holds & J5 authorizations are first-class pending transfers** that resolve exactly
   once (post / void / expire). Double-release is structurally impossible.
5. **DB-enforced idempotency** on every write, keyed off booking/payment IDs. Self-mint
   and double-pay become unrepresentable.
6. **Reconciliation via clearing/suspense accounts** against SUMIT and Nayax settlement
   with a tolerance window; unmatched breaks land in `suspense` and **never mutate a
   balance**.
7. **Corrections are reversing entries**, never `UPDATE`/`DELETE`.
8. **Tamper-evidence** via a per-account hash chain (reusing the pattern already in
   `wallet_ledger_entries`). Explicitly **not** a blockchain.
9. **Safe staged rollout** with a CI invariant gate, dual-write shadow proofs, and a
   clean rollback at every phase.

### Non-goals (out of scope for this SDD / first delivery)
- **No new SHAAM/ITA integration.** SUMIT remains the single official issuer of fiscal
  documents. We add only a **CTC allocation-number guard** (see §10), not a direct tax
  authority rail.
- **No automated card-refund rail.** Refund default stays **wallet credit**; card refund
  is an honest opt-in. This SDD models the ledger movement, not a new disbursement rail.
- **No change to fee policy**: 15% platform commission, 18% VAT on our commission, eGift/
  wallet VAT recognized at **redemption**. The ledger records these; it does not redefine
  them.
- **No blockchain / distributed ledger / external chain.** Rejected as overkill for a
  single company (see §8).
- **No big-bang cutover.** No phase deletes a store before the next phase has proven the
  derived balance matches in shadow.
- **No UI redesign.** Wallet/receipt UIs keep their contracts; only their data source
  moves behind the flag.
- **No provider-facing accounting/GL export** (the `general_ledger` company books stay as
  is for now; §4 explains the boundary).

---

## 3. Repository context — what exists today

The fragmentation is real and cited. There is already a **good append-only double-entry
ledger pattern** in the repo; the problem is that it is **wallet-scoped only** and still
writes mutable balance columns, while four other money stores live beside it.

### 3a. Stores that will be consolidated / wrapped

| Store | Location | What it is today | Fate |
|---|---|---|---|
| `wallet_ledger_entries` | `shared/schema.ts:12028` | Append-only, double-entry, hash-chained, idempotency + JTI, WALLET-scoped. **The seed of the design.** | **Promoted** to the universal `ledger_entries` (superset schema); becomes canonical |
| `wallet_accounts` (mutable balances) | `shared/schema.ts:11755` | 7 mutable balance columns (`cash_wallet_balance_cents`, `egift_balance_cents`, `promo_balance_cents`, `wash_package_credits`, `referral_balance_cents`, `pending_balance_cents`, …). Comment even admits "cached for performance, recalculated from transactions" — but code treats them as truth (`WalletLedger.ts` does `UPDATE wallet_accounts SET cash_wallet_balance_cents = …`). | **Demoted to read-cache, then retired** (Phase 5) |
| Firestore `escrow_payments` | `server/services/EscrowService.ts:91` | Dual-store escrow in **Firestore**, mutable `status` (held/released/refunded/disputed), 72h `holdUntil`. Source of double-release + phantom-"secured" bugs. | **Replaced** by pending-transfer entries in Postgres |
| `octopus_ledger` | `shared/schema.ts:12414` | **Single-entry** (`amount` only, no `direction`), no hash chain, no idempotency at ledger level. | **Migrated** into `ledger_entries` (double-entry) |
| `octopus_wallets` | `shared/schema.ts:12383` | Mutable `balance` + per-platform credit columns. | **Demoted then retired** |
| `wallet_transactions` + `wallet_balances` | `shared/schema-unified-platform.ts:16` and `:41` | Mutable `balance_after` / `balance` (decimal), single-entry history. | **Retired** (superseded) |
| `general_ledger` | `shared/schema-finance.ts:86` | Company accounting GL: account codes, `debit`/`credit` columns, `transactionType`, `vatMode` (`deferred_liability` vs `taxable_sale`). | **Kept, but fed FROM the ledger** as a downstream projection (§4 boundary) |
| `pw_payments`, `pw_provider_payouts`, `pw_reconciliation_reports` | `shared/schema-payments.ts:36`, `:129`, `:287` | Processor payment + payout + recon report rows. | **Kept as reference documents**; the ledger references them, they stop being independent balance truth |

### 3b. Primitives to reuse (do NOT reinvent)

- **Double-entry + hash chain engine:** `server/services/WalletLedger.ts` already implements
  append-only entries, SHA-256 hash chain (`computeEntryHash`, `verifyChainIntegrity`
  at `WalletLedger.ts:803`), reversal-only corrections (`reverseEntry` at `:756`), holds
  (`createHold`/`holdWallet` at `:846`/`:921`), FOR-UPDATE locking, and velocity limits.
  The universal ledger **extends this engine**, it does not replace it.
- **Idempotency table:** `wallet_idempotency_keys` (`shared/schema.ts:12113`) with a UNIQUE
  key and stored response JSON.
- **Webhook idempotency pattern (proven):** `PurchaseActivationService.ts` inserts a
  `purchase_events` row on `(providerName='sumit', providerReference)` with a UNIQUE
  index so a duplicate SUMIT webhook throws and short-circuits — the exact
  derive-idempotency-key-from-payment-id pattern this SDD generalizes.
- **Replay protection:** `wallet_jti_registry` (`shared/schema.ts:12130`) — first-writer-wins
  JTI consumption.
- **Reconciliation run log:** `wallet_reconciliation_runs` (`shared/schema.ts:12088`) —
  persistent PASS/WARN/FAIL proof-pass rows; extend for settlement recon.
- **Payout gate (fail-closed):** `server/services/payoutGate.ts` — completion + refund-window +
  dispute + provider-verified + per-service approval. Escrow release already calls it
  (`EscrowService.ts:206`); the ledger keeps calling it before any `post` of an escrow
  hold to provider payable.
- **Fee/tax truth:** `shared/finance-flow-types.ts` (`TRANSACTION_TYPES`, Flow A vs Flow B),
  `shared/israel-compliance-config.ts` (`ISRAEL_VAT_RATE`), `payoutLedger.ts` (15%/18%/72h).
- **CI money gate:** `.github/workflows/money-safety-gate.yml` runs `npm run test:money` +
  wallet-ledger tests on every PR into `main`. We add the invariant test here.

### 3c. Platform invariants that bind this design
- Money is sacred; every money mutation is audited (`logAuditEvent`, `wallet_fraud_log`).
- Backend is the sole source of truth for balances; the client never decides a balance.
- Idempotency on all financial paths.
- The **Four Gates** must never be mixed (`four-gates-and-host-stay` memory): Deal /
  MachineSession / Commerce / Ledger are distinct. This SDD only touches the **Ledger**
  gate — it reads Deal/Commerce outcomes, it does not re-implement them.
- Migrations with numeric prefix **> 88 auto-apply on push**; latest is `0114`
  (`migrations/0114_staff_applications_careers.sql`). New migrations here start at `0115`.

---

## 4. The boundary: operational ledger vs. company GL

Two ledgers are legitimately different and must **not** be merged:

- **`ledger_entries` (this SDD) = the operational sub-ledger.** Per-user, per-account
  stored-value and settlement truth: what each customer/provider/platform account holds,
  down to the cent, in real time. This is the money brain.
- **`general_ledger` (`schema-finance.ts:86`) = the company accounting book.** Chart-of-
  accounts, fiscal periods, VAT mode, CPA/approval workflow.

**Direction of truth:** `ledger_entries` is upstream; `general_ledger` becomes a
**downstream projection** fed by a periodic posting job (out of scope to build here, but
the design must not block it). This keeps SUMIT as the single fiscal issuer and the CPA's
books authoritative for tax, while giving operations one real-time money brain.

---

## 5. Users & roles / accessibility scoping

| Actor | May | May NOT |
|---|---|---|
| **Customer** | See derived `available` / `pending` balances and their own entry history (read-only projection); top up; redeem; request refund (→ wallet credit default) | Never write entries; never see other users' entries; never decide a balance client-side |
| **Provider** | See their **payable** (approved-and-queued) and settled earnings, derived from entries | Trigger their own payout `post`; bypass the payout gate; see customer PII beyond booking scope |
| **Admin (super_admin only — Nir)** | Issue **reversing** entries with reason; view suspense/breaks; run reconciliation; override a held escrow via audited `bypassGate` | `UPDATE`/`DELETE` any entry; mutate a balance directly; resolve a pending transfer twice |
| **Machine / Nayax (K9000)** | Cause a redemption `post` via a verified, JTI-guarded token; cause anonymous `machine_direct_sale` clearing entries via settlement import | Move money without a settlement/clearing counterpart; release an escrow |
| **System (webhooks, crons)** | Post entries idempotently from verified SUMIT/Nayax events; expire pending holds; run recon | Post on an unverified redirect (SUMIT webhook is the only activation trigger — `PurchaseActivationService`) |

**Accessibility / localization:** Balance and history views are **Hebrew-first / RTL**
(brand palette per memory). Amounts render in ₪ with agorot precision. All money is stored
in **integer cents (agorot)** — never floats — matching `wallet_ledger_entries.amountCents`.
Currency defaults to `ILS`. Screen-reader labels announce direction (זיכוי/חיוב = credit/
debit) and status (זמין/ממתין = available/pending). No emoji in fiscal artifacts
(emoji ban is a separate open item, but the ledger stores none).

---

## 6. Architecture

### 6a. Components

```
                       ┌─────────────────────────────────────────┐
   SUMIT webhook  ───► │  LedgerService  (extends WalletLedger)   │
   Nayax import   ───► │  - postMovement()  (double-entry, idem)  │
   Wallet ops     ───► │  - openPending()/postPending()/void()    │ ──► ledger_entries
   Escrow flows   ───► │  - reverse()   (never update/delete)     │      (append-only,
   eGift/loyalty  ───► │  - deriveBalance()  (SUM over entries)   │       hash-chained)
                       └─────────────────────────────────────────┘
                                    │            │
                          ledger_accounts   ledger_pending_transfers
                          (chart of accts)  (holds / J5 / escrow — resolve once)
                                    │
                          ledger_balance_cache  (DERIVED, rebuildable, non-authoritative)
                                    │
                       ┌───────────┴───────────┐
              reconciliation                  general_ledger (downstream projection)
        (SUMIT/Nayax settlement ↔ clearing;
         breaks → suspense account)
```

`LedgerService` is the single write path. Every existing money service
(`EscrowService`, `WalletService`/`WalletLedger`, `payoutLedger`, octopus engine,
`PurchaseActivationService`) calls it instead of mutating its own store.

### 6b. Happy path — marketplace booking (Flow A), wallet-funded

1. Deal/Commerce gate produces a confirmed booking (unchanged).
2. `LedgerService.openPending()` creates a **pending transfer** moving funds from the
   customer's `available` to an **escrow_holding** account (double-entry: debit customer
   wallet, credit escrow_holding), idempotency key `booking:{bookingId}:hold`.
3. On service completion + payout gate PASS, `postPending()` resolves the hold: debit
   escrow_holding, credit provider_payable (net) + platform_commission_revenue +
   vat_payable. One resolution only; the pending row flips `open → posted` under a UNIQUE/
   state guard.
4. Settlement import matches the SUMIT/Nayax payment against the `payment_clearing`
   account; matched → cleared, unmatched within tolerance → `suspense`.

### 6c. Key failure paths

- **Duplicate webhook / double-tap:** second write hits the UNIQUE idempotency key →
  returns the cached result, no second movement (the `PurchaseActivationService` pattern,
  generalized).
- **Concurrent release of the same escrow:** both attempts target the same
  `pending_transfers` row; the state transition `open → posted` is guarded by a
  conditional `UPDATE … WHERE status='open'` returning 0 rows for the loser → it aborts.
  **Double-release impossible.**
- **J5 hold expires** (card-level escrow expiry — `j5-authorization-hold` memory): a cron
  transitions the pending transfer `open → expired` (a reversing pending resolution, not a
  balance edit). For long-lead bookings the policy remains **charge-at-booking** rather
  than relying on an expiring hold; the ledger records whichever the Deal gate chose.
- **Settlement mismatch:** never mutates a balance; posts a `suspense` entry and raises a
  reconciliation break for admin.
- **Partial failure mid-transaction:** the whole `postMovement` runs in one DB
  transaction with FOR UPDATE on the affected accounts; any error rolls back — no
  half-written double-entry (the invariant can never be violated on disk).

---

## 7. Data model

All amounts are **integer agorot** (`amount_cents`). New tables (Drizzle in
`shared/schema.ts`, migration `0115+`). Additive — nothing dropped in the first phases.

### 7a. `ledger_accounts` — the chart of accounts (see §7f)

```
ledger_accounts
  id              serial pk
  account_id      varchar unique   -- stable slug, e.g. 'cust:{uid}:cash', 'escrow_holding', 'vat_payable'
  account_type    varchar          -- asset | liability | equity | revenue | expense | contra
  owner_type      varchar          -- customer | provider | platform | system
  owner_id        varchar null     -- uid for per-user accounts; null for singleton platform accounts
  bucket          varchar          -- cash_wallet | egift | promo | wash_package | loyalty | referral | ...
  currency        varchar(3)       -- ILS
  normal_side     varchar          -- debit | credit  (sign convention for derived balance)
  is_active       boolean
  created_at      timestamptz
  UNIQUE(owner_type, owner_id, bucket, currency)
```

### 7b. `ledger_entries` — append-only, double-entry (superset of `wallet_ledger_entries`)

Extends the existing `wallet_ledger_entries` shape (`shared/schema.ts:12028`). Same
double-entry, same hash chain, but **account-addressed** so it spans all divisions:

```
ledger_entries
  id              bigserial pk
  entry_id        varchar unique              -- LE-...
  transaction_id  varchar                     -- groups the ≥2 rows of ONE movement (all rows share it)
  account_id      varchar  -> ledger_accounts.account_id
  direction       varchar                     -- debit | credit
  amount_cents    integer  CHECK (amount_cents > 0)
  currency        varchar(3) default 'ILS'
  event_type      varchar                     -- from finance-flow-types TRANSACTION_TYPES
  division_code   varchar                     -- station_k9000 | petsitter | walkers | academy | gift_card | admin
  source_type     varchar
  -- reference / dedup
  idempotency_key varchar                     -- see §9 (UNIQUE constraint enforced via ledger_transactions)
  booking_id      varchar
  payment_ref     varchar                     -- SUMIT/Nayax payment id
  pending_id      varchar null -> ledger_pending_transfers.pending_id
  reversal_of     varchar null -> ledger_entries.entry_id
  vat_mode        varchar null                -- deferred_liability | taxable_sale (eGift/wallet)
  -- actor / context
  created_by      varchar
  ip_address      varchar
  metadata        jsonb
  -- tamper evidence (per account hash chain, reused from WalletLedger)
  previous_hash   varchar(64)
  entry_hash      varchar(64)
  created_at      timestamptz default now()
  -- HARD RULE: no updated_at, no soft-delete. Append only.
indexes: (transaction_id), (account_id, id), (booking_id), (idempotency_key),
         (payment_ref), (event_type), (created_at), (division_code)
```

### 7c. `ledger_transactions` — the balance-enforcing envelope + idempotency anchor

One row per money movement; this is where the **`SUM(debit)==SUM(credit)`** invariant and
the **DB-enforced idempotency** live:

```
ledger_transactions
  transaction_id  varchar pk
  idempotency_key varchar UNIQUE NOT NULL      -- derived from booking/payment id (§9) — the anti-double-mint lock
  event_type      varchar
  total_debits    integer NOT NULL
  total_credits   integer NOT NULL
  CHECK (total_debits = total_credits)          -- balanced at the row level
  response_json   jsonb                          -- cached result for idempotent replays
  created_at      timestamptz
```

The `UNIQUE(idempotency_key)` is the structural kill for self-mint/double-pay: a retried
booking/payment cannot create a second balanced transaction — the insert throws, the
service returns the cached `response_json` (the `purchase_events` pattern generalized).

### 7d. `ledger_pending_transfers` — holds, J5 authorizations, escrow (resolve ONCE)

```
ledger_pending_transfers
  id                  serial pk
  pending_id          varchar unique
  kind                varchar            -- wallet_hold | j5_authorization | escrow_hold
  from_account_id     varchar -> ledger_accounts
  to_account_id       varchar -> ledger_accounts   -- the reserve/holding account
  amount_cents        integer CHECK (> 0)
  status              varchar            -- open | posted | voided | expired
  booking_id          varchar
  payment_ref         varchar
  idempotency_key     varchar UNIQUE
  open_entry_txn      varchar -> ledger_transactions   -- the entries that opened the hold
  resolve_entry_txn   varchar null                      -- the entries that resolved it (post/void/expire)
  expires_at          timestamptz null
  created_at          timestamptz
  resolved_at         timestamptz null
  -- RESOLVE-ONCE GUARD:
  -- all state changes are UPDATE ... WHERE status='open'; 0 rows affected => already resolved => abort.
```

This is the replacement for both Firestore `escrow_payments` and Postgres `wallet_holds`,
unifying the two duplicate hold concepts into one first-class object.

### 7e. `ledger_balance_cache` — DERIVED, non-authoritative

```
ledger_balance_cache
  account_id      varchar pk -> ledger_accounts
  available_cents integer     -- SUM over posted entries
  pending_cents   integer     -- SUM over open pending transfers
  posted_cents    integer
  last_entry_id   bigint      -- high-water mark for incremental refresh
  rebuilt_at      timestamptz
```

**Truth is the entry stream.** This table is a materialized projection that can be dropped
and rebuilt from `ledger_entries` at any time. Reads MAY use it for speed, but the CI
invariant and the reconciliation job always recompute from entries and assert the cache
matches. It is explicitly allowed to be stale; it is never allowed to disagree.

### 7f. Chart of accounts (initial)

| account_id (pattern) | type | normal side | Meaning |
|---|---|---|---|
| `cust:{uid}:cash` | liability | credit | Customer paid-in cash wallet (we owe them) |
| `cust:{uid}:egift` | liability | credit | eGift stored value — **VAT deferred to redemption** |
| `cust:{uid}:promo` | liability | credit | Promo credit |
| `cust:{uid}:wash_package` | liability | credit | Prepaid wash units |
| `cust:{uid}:loyalty` | liability | credit | Loyalty points value |
| `escrow_holding` | liability | credit | Funds held pending service completion (was Firestore) |
| `j5_authorization` | contra | credit | Card-level authorization holds (expire) |
| `prov:{uid}:payable` | liability | credit | Approved-and-queued provider earnings |
| `platform_commission_revenue` | revenue | credit | Our 15% |
| `vat_payable` | liability | credit | 18% VAT on our commission; eGift/wallet VAT recognized at redemption |
| `service_revenue` | revenue | credit | Direct platform sale revenue (Flow B) |
| `payment_clearing:sumit` | asset | debit | SUMIT online card in transit until settlement |
| `payment_clearing:nayax` | asset | debit | Nayax kiosk in transit until settlement |
| `suspense` | asset/contra | debit | Reconciliation breaks — **never a user balance** |
| `expiry_breakage_revenue` | revenue | credit | Expired stored value recognized as revenue |

---

## 8. Security & fraud model

| Threat | Control |
|---|---|
| **Self-mint** (credit with no offsetting debit) | Double-entry + `CHECK(total_debits=total_credits)` on `ledger_transactions`; a mint literally cannot be written balanced without a funding source |
| **Double-pay / duplicate webhook** | `UNIQUE(idempotency_key)` on `ledger_transactions`, key derived from `{payment_ref}` / `{bookingId}` (§9); replay returns cached `response_json` |
| **Double-release of escrow** | `ledger_pending_transfers` resolve-once guard (`UPDATE … WHERE status='open'`); the loser gets 0 rows and aborts |
| **Client-side balance tampering** | Balances are derived server-side from entries; the client value is display-only and re-checked at redeem inside a FOR UPDATE transaction |
| **Screenshot / token replay at kiosk** | Reuse `wallet_jti_registry` first-writer-wins JTI consumption inside the posting transaction |
| **Ledger tampering / silent edit** | Per-account SHA-256 hash chain (`computeEntryHash` / `verifyChainIntegrity`, `WalletLedger.ts:803`); daily verify job; append-only (no `UPDATE`/`DELETE` grant) |
| **Negative balance / overdraft race** | FOR UPDATE lock on affected accounts + conditional debit `WHERE available >= amount` (the pattern already in `WalletLedger.deductFromWallet`) |
| **Insider correction fraud** | Corrections are reversing entries with actor + reason logged to `wallet_fraud_log`; no path mutates history |
| **Unverified activation** | Only verified SUMIT webhooks post real-money entries (`PurchaseActivationService` remains the sole activator); redirect stays display-only |

**Backend is the source of truth.** No entry originates on the client. Every posting runs
inside a single DB transaction; the double-entry invariant is enforced by a table
constraint, not by application code alone.

**Why NOT blockchain / distributed ledger:** a hash-chained append-only table in Postgres
already gives tamper-evidence, auditability, and single-writer integrity for a single
company. A blockchain adds consensus, distribution, and immutability guarantees we do not
need (there is one writer — us), at the cost of latency, ops burden, and irreversibility
that actively conflicts with the required **reversing-entry** correction model and Israeli
fiscal amendment rules. **Rejected as overkill.**

---

## 9. Idempotency & reconciliation design

### 9a. Idempotency (derive keys from IDs — never random)

Every movement's key is deterministic so retries converge:

- Wallet topup from SUMIT: `topup:sumit:{sumitPaymentId}`
- Booking hold: `hold:booking:{bookingId}`
- Escrow release: `release:booking:{bookingId}`
- Kiosk redemption: `redeem:{jti}` (also consumes the JTI)
- Refund to wallet: `refund:booking:{bookingId}`
- Nayax settlement line: `settle:nayax:{transactionId}`

The key is UNIQUE on `ledger_transactions`. A duplicate insert throws a unique violation
which the service catches and answers with the cached `response_json` — the exact,
already-proven behavior in `PurchaseActivationService` (`purchase_events_provider_ref_uq`).

### 9b. Reconciliation (clearing/suspense, tolerance window)

1. Import SUMIT settlement + Nayax settlement reports (existing importers:
   `nayaxEventImport.ts`, `SumitSyncService.ts`).
2. Match each settlement line to its `payment_clearing:{provider}` entries by
   `payment_ref`.
3. Matched within a **tolerance window** (processor fee rounding, ≤ a configurable
   `RECON_TOLERANCE_CENTS`): post a clearing→cash/settled entry.
4. Unmatched or out-of-tolerance: post to `suspense` and open a reconciliation break in
   `wallet_reconciliation_runs` (extended) — **never touch a user balance**.
5. A proof-pass job recomputes every account balance from entries and asserts it equals
   `ledger_balance_cache`; drift raises FAIL (this is the online sibling of the CI
   invariant).

---

## 10. Money & audit (fiscal correctness)

- **VAT:** 18% on **our commission** (Flow A) recorded as `vat_payable` at posting.
  eGift/wallet VAT is **deferred to redemption** — the `vat_mode='deferred_liability'`
  tag on stored-value entries means no VAT entry at purchase; the VAT entry is created at
  the redemption posting. This matches `general_ledger.vatMode` and the CEO's settled
  finance verdict.
- **SUMIT is the single fiscal issuer.** The ledger never issues a fiscal document; it
  references the SUMIT doc/allocation number (as `octopus_invoices` and `pw_tax_documents`
  do today).
- **CTC allocation-number guard (not an integration):** for invoices ≥ **₪5,000 ex-VAT**
  (CTC floor, Jun 2026), the posting path asserts a SUMIT allocation number is present /
  requested before the revenue entry is treated as fiscally complete; if absent it flags,
  it does **not** call SHAAM. SUMIT owns the SHAAM rail.
- **Refunds:** default posts a **wallet credit** entry (`cust:{uid}:cash` credit);
  card-refund is an explicit opt-in that records intent only (no automated card-refund
  rail exists — honest wording preserved from `EscrowService.refundEscrowPayment`).
- **Audit:** every posting writes `logAuditEvent` (already fail-soft) and, for
  suspicious/admin actions, `wallet_fraud_log`. Reversals carry `reversal_of` + reason.

---

## 11. Rollout — staged, additive, flag-gated

**Never a big-bang cutover.** Each phase is independently reversible and proven in shadow
before the next. Feature flags default OFF.

- **Phase 0 — Schema up (additive).** Migration `0115` adds `ledger_accounts`,
  `ledger_entries`, `ledger_transactions`, `ledger_pending_transfers`,
  `ledger_balance_cache`. No writes yet. `LEDGER_V2_ENABLED=OFF`.
- **Phase 1 — Backfill (read-only).** One-off job replays existing stores
  (`wallet_ledger_entries`, `octopus_ledger`, Firestore `escrow_payments`,
  `contractorEarnings`, `pw_provider_payouts`) into `ledger_entries` as historical,
  reconstructing balanced transactions. Assert derived balance == each legacy store's
  current balance per account; log mismatches, fix mappers, re-run. **Idempotent** (keyed
  by legacy row id) so it can run repeatedly.
- **Phase 2 — Dual-write (shadow).** `LEDGER_V2_DUAL_WRITE=ON`. Every money service writes
  BOTH its legacy store AND `LedgerService`. Legacy stores remain authoritative for reads.
  A continuous shadow-diff job compares derived vs legacy balances and alerts on any drift.
  Run for a defined bake period with zero drift.
- **Phase 3 — Cut reads to derived.** `LEDGER_V2_READ_DERIVED=ON` per surface (wallet
  balance API first, then escrow status, then provider payable). Legacy writes continue as
  a safety net. Roll surface-by-surface; each is independently revertible.
- **Phase 4 — Escrow to Postgres pending transfers.** Flip escrow create/release/refund to
  `ledger_pending_transfers`; Firestore `escrow_payments` becomes write-through mirror
  only, then read-retired. This is where the double-release and phantom-"secured" bugs die.
- **Phase 5 — Retire mutable columns (last).** `LEDGER_V2_RETIRE_MUTABLE=ON`. Stop writing
  `wallet_accounts.*_balance_cents`, `octopus_wallets.balance`, `wallet_balances`. Keep the
  columns physically for one release as a tripwire (assert they'd match), then a later
  migration drops them. **No column is dropped until a full release has passed on derived
  reads.**

**Migration safety:** all migrations prefix `0115+` (auto-apply on push per repo rule);
each is additive/non-destructive until Phase 5; the destructive drop is its own final
migration gated on sign-off.

---

## 12. Test plan

- **CI invariant (new, blocking):** `server/tests/ledgerDoubleEntryInvariant.test.ts` added
  to `npm run test:money` in `.github/workflows/money-safety-gate.yml`. For **every**
  seeded scenario (topup, redeem, marketplace booking, escrow hold→release, escrow
  hold→refund, J5 expire, eGift issue→claim→redeem, reversal, Nayax settlement, suspense
  break) it asserts:
  1. `SUM(debits) == SUM(credits)` globally and per `transaction_id`;
  2. every derived account balance == recomputed-from-entries balance == `ledger_balance_cache`;
  3. no `ledger_entries` row was ever `UPDATE`d/`DELETE`d (corrections appear only as
     `reversal_of`);
  4. each `ledger_pending_transfers` resolves at most once.
- **Unit:** account resolver, deterministic idempotency-key builders, derived-balance SQL,
  hash-chain continuity (`verifyChainIntegrity`).
- **Integration:** dual-write shadow-diff produces zero drift across the seeded flows;
  backfill mapper reproduces each legacy balance.
- **Fraud/abuse:** duplicate SUMIT webhook (one movement), concurrent escrow release (one
  post), same idempotency key with different payload (409, `wallet_fraud_log` row),
  overdraft race (0-row conditional debit), JTI replay at kiosk.
- **Edge/failure:** offline kiosk (settlement-import path posts later via clearing),
  expired J5 hold (→ expired, not released), partial failure rollback (no half double-
  entry on disk), settlement out-of-tolerance (→ suspense, balances untouched).

---

## 13. Rollback plan

- **Any phase ≤ 4** rolls back by flipping its flag OFF; legacy stores were still being
  written, so they remain fully authoritative — reads instantly return to legacy with no
  data reversal needed.
- **Phase 5** (mutable columns retired but not yet dropped): re-enabling legacy writes is a
  flag flip; a one-off "reproject" job rewrites the cache/columns from `ledger_entries`
  (truth is preserved because the ledger has every movement).
- **The append-only ledger itself is never rolled back destructively** — any bad posting is
  corrected by a reversing entry, never by delete. Worst case, we stop reading from it and
  fall back to legacy while investigating.
- **Kill switch:** `LEDGER_V2_ENABLED=OFF` disables all new write paths at once.

---

## 14. Open questions (need a human decision)

1. **eGift/wallet VAT timing at scale:** confirm with CPA that `vat_mode='deferred_liability'`
   at redemption is the final posture for ALL stored value (matches memory; needs a written
   CPA sign-off before Phase 3 touches revenue recognition).
2. **`general_ledger` posting cadence:** real-time projection vs. nightly batch, and who
   owns approval — decide before wiring the downstream projector (out of scope to build,
   in scope to not block).
3. **Loyalty points valuation:** are points a monetary liability (cents) in the ledger, or
   a separate non-money counter? Current `wallet_accounts.loyalty_points_balance` is a
   count. Recommend keeping loyalty as a **non-money** account excluded from the cents
   invariant until priced.
4. **Suspense SLA:** how long may a break sit in `suspense` before it escalates, and who
   clears it (Nir vs. future finance ops)?
5. **Firestore escrow historical data:** backfill all historical `escrow_payments` or only
   open/held ones? (Recommend: open/held fully; closed as historical reference.)
6. **RECON_TOLERANCE_CENTS** value for SUMIT/Nayax fee rounding — needs one real settlement
   sample to calibrate.

---

## 15. Recommended first implementation PR (smallest safe slice)

**PR-1: "Ledger v2 schema + CI double-entry invariant (dark)."**

- Add the five tables (`0115_ledger_v2.sql` + Drizzle definitions in `shared/schema.ts`)
  with the `CHECK(total_debits=total_credits)` and UNIQUE idempotency constraints.
- Add `LedgerService` skeleton (`postMovement`, `openPending`, `postPending`, `void`,
  `reverse`, `deriveBalance`) reusing `WalletLedger`'s hash-chain + FOR-UPDATE helpers.
  **No caller wired yet** — pure additive, flag OFF.
- Add `server/tests/ledgerDoubleEntryInvariant.test.ts` seeding the scenario matrix and
  asserting the invariant; register it in `money-safety-gate.yml`.

This lands the source of truth and its self-checking test with **zero production behavior
change** (no service writes to it yet), so it is safe to merge behind branch protection and
gives every subsequent phase a green invariant to build against.

---

## 16. Finish summary

- **First PR:** Ledger v2 schema + balanced-transaction constraints + CI double-entry
  invariant test, all dark (flag OFF, no callers).
- **Out of scope:** new SHAAM/ITA integration (SUMIT stays sole issuer), automated
  card-refund rail, fee/VAT policy changes, blockchain, provider GL export, big-bang
  cutover, UI redesign.
- **Open questions:** CPA sign-off on deferred VAT; GL posting cadence/ownership; loyalty
  points as money vs. counter; suspense SLA/owner; escrow backfill scope; recon tolerance
  value.
- **Key fraud/safety risks:** self-mint (killed by double-entry + balanced CHECK),
  double-pay (killed by UNIQUE idempotency key), double-release of escrow (killed by
  resolve-once pending transfers), balance drift/race (killed by derived balances + FOR
  UPDATE), ledger tampering (hash chain + append-only). Residual risk lives in the
  **backfill mappers** (wrong opening balances) and the **dual-write bake** — both are why
  the rollout is staged with shadow proofs before any read cutover.
- **Tests needed:** the CI double-entry invariant (blocking), fraud/abuse suite,
  dual-write shadow-diff, backfill reproduction, failure/edge suite (§12).
- **Feature flags:** `LEDGER_V2_ENABLED`, `LEDGER_V2_DUAL_WRITE`, `LEDGER_V2_READ_DERIVED`,
  `LEDGER_V2_RETIRE_MUTABLE` — all default OFF.
- **Rollback:** flag-flip at every phase ≤4 (legacy stays authoritative); reproject-from-
  entries for Phase 5; never a destructive ledger rollback (reverse, don't delete).

---

## Appendix A — Original request (verbatim)

> Write a Software Design Document (SDD) for consolidating PetWash's fragmented money into ONE append-only, double-entry ledger in Postgres. This is the #1 recommendation from two independent research passes and directly cures known production bugs.
>
> ## The problem (grounded in this repo + the CEO's own audit memory)
> Money is fragmented across Firestore + Postgres over ~6 booking systems, with ~24 money tables in raw SQL and mutable `wallet_balance`-style columns. This causes: double-release of escrow, phantom "secured" walk bookings, self-mint/double-pay windows, and station revenue that misses the SQL side. Escrow specifically is split dual-store (see the escrow-dual-store-fragmentation memory). The J5 authorization holds EXPIRE (card-level escrow, not a licensed escrow account).
>
> ## What to design (the target)
> ONE append-only `ledger_entries` table in Postgres as the single source of truth for: customer wallet, eGift liability, loyalty, escrow holdings, provider payable/commission, platform revenue, VAT payable, and SUMIT/Nayax settlement clearing.
> - Double-entry: every movement balances (debits == credits) — the self-checking invariant.
> - Balance DERIVED from entries — NEVER a mutable balance column (that is the #1 anti-pattern that drifts/races).
> - pending vs posted vs available balances from the one entry stream.
> - Escrow holds and J5 authorizations modeled as FIRST-CLASS pending transfers that post / void / expire and can only resolve once (structurally cannot double-release).
> - DB-enforced idempotency keys on every write (kills self-mint / double-pay); derive them from booking/payment IDs.
> - Reconciliation via clearing/suspense accounts against SUMIT/Nayax settlement, with a tolerance window; breaks go to `suspense`, never mutate balances.
> - Corrections are new reversing entries, never UPDATE/DELETE.
> - Optional: a hash-chain over entries for tamper-evidence (do NOT propose blockchain — explicitly reject it as overkill for a single company).
>
> ## Hard constraints (respect these; they are settled)
> - Israeli fiscal: SUMIT is the single official issuer; VAT 18% on OUR commission; eGift/wallet VAT recognized at REDEMPTION (not purchase). CTC allocation-number floor is ₪5,000 ex-VAT as of Jun 2026 — do NOT build a direct SHAAM integration (SUMIT owns that); add only a guard.
> - No automated card-refund rail exists — refund default is wallet credit, card refund is an honest opt-in.
> - Stack: Node/Express (tsx) + Drizzle + raw SQL on Neon Postgres. Migrations with prefix > 88 auto-apply on push.
> - This must be a SAFE, staged migration: stand the ledger up ALONGSIDE existing stores → dual-write → cut reads to derived balances → retire mutable columns last. Never a big-bang cutover. Include a CI invariant test (every seeded scenario asserts SUM(debits)==SUM(credits)).
>
> ## Deliverable
> Explore the real repo first (EscrowService.ts, WalletLedger/WalletService, octopus-engine ledger tables octopusLedger, PurchaseActivationService, the sitter/walk/booking-requests money paths, existing migrations) so the design is grounded in what actually exists — name the real files/tables it replaces or wraps. Produce ONE markdown SDD in docs/design/ with: problem, goals/non-goals, the chart of accounts, the schema, the pending-transfer/hold model, idempotency + reconciliation design, the phased migration plan with rollback, the CI invariant, risks, and an appendix preserving this request. Do not write production code.
