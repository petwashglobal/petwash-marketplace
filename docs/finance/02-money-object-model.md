# Financial Core Architecture — Part 2: Money Object Model

**Status:** DRAFT v1 — depends on Part 0 (Platform Role Model). Do not finalise until Part 0 is approved.

**Owner:** Engineering, with sign-off from CPA on numbering and append-only stance.

**Hard rule:** No "temporary" finance logic. The schema declared here is **the** schema for v1. Any drift becomes permanent technical and legal debt.

---

## Why Part 2 exists

Once Part 0 fixes who the legal seller and buyer are for each revenue line, Part 2 fixes **how every money fact is recorded** so that the system can prove what happened, in what order, by whom, in a way that an auditor (internal, external, or regulator) can verify by replay.

Three decisions in this part shape every other section:

1. **Money as a typed object, not a number.** A bare `decimal` field is the root cause of most accounting bugs in payment systems. Money must be a typed value with currency and integer minor units.
2. **Append-only ledger as the spine.** Every balance, every wallet, every invoice, every refund is computed by replaying ledger entries — never by mutating an authoritative balance field. The ledger is the source of truth.
3. **Mandatory fields on every financial object.** A free-form `metadata` blob is forbidden as a way to smuggle in fields. Every financial object carries the same locked field set.

Part 2 does not specify production database migrations. It specifies the **conceptual schema**. Migrations will follow once Part 0 is signed off and Parts 3 / 4 / 5 / 6 / 7 / 8 / 9 / 10 conform.

---

## 2.1 Canonical money type

A single `Money` value type used everywhere a monetary amount appears in code, in the database, and in API contracts.

### 2.1.1 Definition

```ts
type Currency = 'ILS';   // v1 only. New currency requires CFO + CPA + counsel.

interface Money {
  amount_minor: bigint;   // integer in minor units (agorot for ILS); never floating-point
  currency: Currency;
}
```

### 2.1.2 Rules

- **Minor units only.** `1 ILS` = `100 agorot` = `Money { amount_minor: 100n, currency: 'ILS' }`. The system never stores `1.00` in a float, never trusts `parseFloat` on inbound data, and never compares floats for equality.
- **`bigint`, not `number`.** JavaScript `number` loses precision above 2^53 minor units. `bigint` is mandatory. Storage layer (Postgres) uses `numeric(20,0)` or `bigint` per pragmatic choice; field layer is always integer.
- **Currency carried with every amount.** No "naked" amounts. An amount without a currency is rejected at every boundary.
- **No mid-flight currency conversion at v1.** All amounts are ILS. Any non-ILS input from acquirers (Tranzila / Nayax) is rejected at the boundary — the platform contract is ILS-only.
- **Negative amounts allowed in ledger only.** A user-facing total (invoice amount, payout amount) is non-negative. A ledger entry can be negative (credit). The Money type itself does not constrain sign — the constraint is positional.

### 2.1.3 Forbidden patterns

- `decimal(12, 2)` columns for money — banned for new fields.
- `parseFloat()` / `Number()` on money strings from external systems — banned.
- `subtotal: '99.50'` in API payloads — outbound API uses minor units `subtotal: 9950`.
- Any expression that mixes Money with a bare number arithmetic-side without going through a money helper.

### 2.1.4 Money helpers (single library, single place)

A single helper module exposes:

- `money.add(a, b)` — same currency required, throws otherwise.
- `money.subtract(a, b)` — same currency required.
- `money.multiplyByRatio(m, ratio)` — used for percentage splits (platform fee, VAT). Rounds **half-to-even** (banker's rounding); always documents which side absorbs the rounding penny.
- `money.divideEvenly(m, n)` — splits with explicit remainder return so it is always reconciled.
- `money.compare(a, b)` — same currency required.
- `money.fromMinorUnits(n, currency)` / `money.toMinorUnits(m)` — boundary helpers.

No other code performs money arithmetic. ESLint or equivalent rule rejects raw numeric arithmetic on Money fields.

### 2.1.5 Migration stance

Existing `decimal(12, 2)` columns in the schema (e.g. `bookings.subtotal`, `bookings.platformFee`, `bookings.providerPayout`, `bookings.total`) are **legacy** for v1 read-compat purposes. New financial tables (ledger, txn, wallet sub-balances, invoice line items) use the canonical Money type backed by `bigint` / `numeric(20,0)` minor units. A future migration converts the legacy columns; not in scope for v1 launch.

---

## 2.2 Immutable transaction record schema

Every customer-facing or provider-facing **transaction** (charge, refund, payout, top-up, redemption, fee, adjustment) is a single row in a top-level `financial_transactions` table. The row is **never mutated** after insert.

### 2.2.1 Conceptual schema (one row per transaction)

```text
financial_transactions
─────────────────────────────────────────────────────────────────────
  -- identity
  id                       UUID v7 (sortable by time)
  txn_kind                 enum: charge | refund | payout | top_up
                                | redemption | fee | adjustment
                                | credit_note | settlement
  channel                  enum: marketplace | k9000

  -- legal parties (per Part 0)
  seller_party             enum: pet_wash_ltd | provider
  buyer_party              enum: customer | provider | pet_wash_ltd
  seller_id                varchar (NULL if seller_party=pet_wash_ltd)
  buyer_id                 varchar
  provider_id              varchar (FK — present when channel=marketplace)
  customer_id              varchar (present for customer-facing txns)

  -- money
  gross_minor              bigint   (always positive — direction is in txn_kind)
  vat_minor                bigint   (0 if no VAT applies)
  net_minor                bigint   (gross_minor - vat_minor)
  currency                 varchar  ('ILS' at v1)

  -- references (Part 2.5)
  idempotency_key          varchar  UNIQUE
  external_ref_acquirer    varchar  (Tranzila / Nayax txn id if applicable)
  external_ref_invoice     varchar  (issued tax-invoice number, if any)
  parent_txn_id            UUID     (refund → original charge; credit_note → invoice)
  related_booking_id       varchar  (FK bookings, if applicable)
  related_session_id       varchar  (FK k9000 session, if applicable)
  related_wallet_id        varchar  (FK wallet, if applicable)

  -- audit + governance
  created_at               timestamptz NOT NULL  (UTC)
  actor_kind               enum: customer | provider | admin | system
  actor_id                 varchar
  origin_subsystem         varchar  ('booking-service' | 'k9000-runtime'
                                    | 'wallet-service' | 'admin-tools'
                                    | 'reconciliation-job' | ...)
  request_id               varchar  (HTTP request id / job run id)
  reason_code              varchar  (machine-readable reason for refunds /
                                    adjustments / credit notes)
  human_ref                varchar  (e.g. "REF-2026-00012345" — invoice or
                                    payout user-visible reference)
  ledger_hash_pointer      varchar  (hash of the ledger entry-pair this
                                    transaction produced; see Part 2.3)

  -- legal-stance snapshot
  vat_decision_id          UUID FK vat_decisions  (Part 5.5)
  provider_tax_profile_id  UUID FK provider_tax_profiles  (Part 1.5)

  -- final
  PRIMARY KEY (id)
  UNIQUE (idempotency_key)
─────────────────────────────────────────────────────────────────────
```

### 2.2.2 Rules

- **Append-only.** No `UPDATE` is permitted on this table at the application level. The only DML is `INSERT`. Database-level enforcement: a trigger that raises on `UPDATE` / `DELETE`. Column changes use schema migration only.
- **No row deletion.** A misposted transaction is corrected by a corresponding offsetting transaction (a `credit_note` referring to the original via `parent_txn_id`).
- **Idempotency is mandatory.** Every write site supplies an `idempotency_key`. Re-presenting the same key with the same content is a no-op (returns the existing row); same key with different content is a hard error.
- **No `metadata` blob.** Every field that exists on a transaction is named in the schema. If a flow needs additional context, the field is added to the schema (with a migration) — not stuffed into `jsonb metadata`. The single exception is `platform_data jsonb` on the `bookings` table, which is **not** a financial-transaction field; financial transactions stay strictly typed.
- **`net_minor + vat_minor == gross_minor`** is a check constraint at the database level.
- **`origin_subsystem` is a closed enum** — system operators add to it via migration; no free-form strings.

### 2.2.3 Direction convention

`txn_kind` encodes direction. `gross_minor` is **always positive**. The pair (`buyer_party`, `seller_party`) plus `txn_kind` determines whether the transaction increases or decreases each party's position.

| txn_kind | seller / debited | buyer / credited | Notes |
|---|---|---|---|
| `charge` | customer | seller (pet_wash or provider) | Authorisation+capture or capture |
| `refund` | seller | customer | Reverses a charge; `parent_txn_id` required |
| `payout` | pet_wash_ltd (trust) | provider | Periodic settlement |
| `top_up` | customer | wallet (held by pet_wash_ltd) | Wallet credit |
| `redemption` | wallet | seller | Wallet debit; offsets a booking charge |
| `fee` | one party | another party | Platform fee split, surcharges |
| `adjustment` | system | one party | Corrections, goodwill, error fixes — always logged with `reason_code` |
| `credit_note` | seller | customer | Negates an issued invoice; `parent_txn_id` required |
| `settlement` | acquirer-in-transit | pet_wash_ltd | Acquirer pays out to platform bank |

### 2.2.4 What this table does NOT replace

This table is the **transaction record** — one row per real-world money event. It is not the **ledger** (which has one or more debit/credit entries per transaction; see 2.3). It is not the **invoice** (which is a tax document with line items; see 2.4 numbering and a separate `invoices` table). It is the spine that ties everything together via `id` and `parent_txn_id`.

---

## 2.3 Append-only ledger entries (debit/credit pairs, hash-chained)

Every financial transaction produces one or more **ledger entry pairs** in a `ledger_entries` table. The ledger is the authoritative source of truth for all balances. Balance fields elsewhere are caches, computed from the ledger.

### 2.3.1 Double-entry rule

For every `financial_transactions` row, the sum of resulting `ledger_entries.amount_minor` is exactly zero. Each entry is either a debit or a credit. Debits and credits balance per transaction, per period, per account, by construction.

### 2.3.2 Conceptual schema

```text
ledger_entries
─────────────────────────────────────────────────────────────────────
  id                  UUID v7  PRIMARY KEY
  txn_id              UUID FK financial_transactions
  account_code        varchar  (chart-of-accounts code; closed enum)
  account_party_id    varchar  (subject — provider id, customer id, etc.)
  side                enum: debit | credit
  amount_minor        bigint   (positive integer)
  currency            varchar  ('ILS')
  created_at          timestamptz NOT NULL (UTC)
  hash_prev           varchar (NULL only for the genesis entry)
  hash_self           varchar (= hash(prev_hash || normalised_payload))
─────────────────────────────────────────────────────────────────────
```

### 2.3.3 Hash chain

- `hash_self` is computed as `sha256(hash_prev || canonical_json(this_row_minus_hash_self))`.
- The chain extends the audit-event hash chain that is already partially in place (Part 9 connects this to existing chain verifiers).
- Daily verification job (Part 9.6) walks the chain end-to-end and writes a `chain_verification_run` row with the result.

### 2.3.4 Account codes (closed chart of accounts)

A locked, namespaced set. Examples (final list TBD with CPA):

- `1100.cash.operating`
- `1110.cash.trust.wallet`
- `1120.cash.trust.booking_in_flight`
- `1130.cash.in_transit.tranzila`
- `1131.cash.in_transit.nayax`
- `2010.liability.wallet_balance` (per customer)
- `2020.liability.booking_pre_completion` (per booking)
- `2030.liability.refund_pending`
- `2100.liability.vat_collected.platform`
- `2110.liability.vat_collected_on_behalf.provider`
- `4010.revenue.platform_fee`
- `4020.revenue.k9000_session`
- `4090.revenue.breakage_loyalty` (with caveat, per Part 0.2.4)
- `5010.expense.promo_credits_funded`
- `5020.expense.payment_processing`
- `8010.contra_revenue.refund`
- `8020.contra_revenue.chargeback`

Account codes are **never re-used or re-mapped**. New revenue streams = new codes.

### 2.3.5 Append-only enforcement

- `ledger_entries` table allows `INSERT` only. `UPDATE` / `DELETE` are blocked at the database (trigger). A correction is a new transaction (a `credit_note` plus a fresh `charge`), each producing fresh ledger entries.
- Integrity verifiers run hourly and on-demand. A break in `hash_prev` linkage is a P0 alert (Part 10.1).

---

## 2.4 Numbering authority (SHAAM-compliant, gap-free, year-scoped)

Israeli tax law requires sequential, gap-free numbering of tax invoices and credit notes. The numbering authority is centralised; no caller chooses its own number.

### 2.4.1 Numbering domains

Distinct number sequences for distinct legal-document classes. A non-exhaustive list:

| Domain | Issued by | Sequence scope |
|---|---|---|
| `INVOICE.PETWASH.K9000` | Pet Wash Ltd | per calendar year |
| `INVOICE.PETWASH.PLATFORM_FEE` | Pet Wash Ltd | per calendar year |
| `INVOICE.PROVIDER.<provider_id>` | Pet Wash on behalf of Provider (Part 0.6.2.a) | per provider, per calendar year |
| `RECEIPT.PROVIDER.<provider_id>` | Pet Wash on behalf of exempt Provider (Part 0.6.3) | per provider, per calendar year |
| `CREDIT_NOTE.PETWASH.K9000` | Pet Wash Ltd | per calendar year |
| `CREDIT_NOTE.PROVIDER.<provider_id>` | Pet Wash on behalf of Provider | per provider, per calendar year |
| `PAYOUT_REPORT.<provider_id>` | Pet Wash Ltd | per provider, per calendar year |

### 2.4.2 Allocation protocol

- Numbers are allocated by a single `numbering_authority` service via an `INSERT … RETURNING` against a `numbering_sequences` table inside the same database transaction that writes the consuming row.
- **No advance allocation** (no number reserved without a matching record). Avoids gaps from abandoned inserts.
- **No external allocator** (cannot be done from a job-runner without the database transaction context).
- Format: `<DOMAIN>-<YYYY>-<00000001>` zero-padded. Configurable padding per domain.

### 2.4.3 Gap-free guarantee

- A unique constraint per `(domain, year, sequence_no)` prevents duplicates.
- On any rollback, the consuming row is rolled back too — the number is never released to a different transaction, and the sequence does not skip.
- A daily job (Part 9.6) verifies no gaps exist in any active domain × year. Detected gap = critical alert.

### 2.4.4 SHAAM digital-signature readiness

- Each issued tax invoice is rendered to a fixed canonical PDF representation and digitally signed per SHAAM specifications (or signature simulation if SHAAM enrolment is deferred — but the canonicalisation is locked from v1).
- The signed bytes are hashed; the hash is stored in `financial_transactions.ledger_hash_pointer` and on the corresponding `ledger_entries`. Replay verifies the signature is intact.

---

## 2.5 Mandatory fields on every financial object

Every financial object (transaction, ledger entry, invoice, credit note, payout, refund record, wallet movement) carries the same locked field set, regardless of its specific schema. No "small object can skip this field" exceptions.

### 2.5.1 The locked nine

| Field | Why it must exist on every object |
|---|---|
| **Immutable UUID (`id`)** | Globally unique, sortable by time (UUID v7). Never re-used, never re-sequenced. Used as the universal correlation key across logs, exports, and disputes. |
| **`created_at` (UTC)** | UTC instant of object creation. Timezone displayed at presentation layer only. Asia/Jerusalem in UI, UTC on disk. Eliminates DST ambiguity in audit. |
| **`actor_kind` + `actor_id`** | Who caused this object to exist. Customer / provider / admin / system. Empty string is not allowed; system jobs identify as `actor_kind=system`, `actor_id=<job-name>`. |
| **`origin_subsystem`** | Which code path produced the object. Closed enum (e.g. `booking-service`, `k9000-runtime`, `wallet-service`, `reconciliation-job`, `admin-tools`). New subsystems are added via migration only. |
| **`idempotency_key`** | Caller-supplied or system-derived. Same key + same payload = no-op. Same key + different payload = hard error. Indexes uniqueness. |
| **Linked transaction refs** | At least one of: `parent_txn_id`, `related_booking_id`, `related_session_id`, `related_wallet_id`. A financial object that links to nothing is a bug. |
| **`ledger_hash_pointer`** | The hash of the ledger entry-pair this object produced (or, for ledger entries themselves, the chain hash). Lets an auditor verify integrity by replay. |
| **`human_ref`** | A user-visible reference (`REF-2026-00012345`, `INV-PETWASH-2026-00045`, `PAYOUT-2026-Q2-00007`). Same-shape across the platform; supports support tickets and customer queries. |
| **`canonical_type`** | Machine-readable type tag (`charge`, `refund`, `payout`, `wallet.top_up`, `wallet.redemption`, `invoice`, `credit_note`, …). Closed enum per object class. |

### 2.5.2 Forbidden patterns

- A `metadata jsonb` blob used as an escape hatch to add fields without a migration. **Banned** for financial objects. Free-form context goes in non-financial tables (e.g. logs).
- Optional `actor_id` (must be present, even if `system`).
- Local-time timestamps (always UTC at the storage layer).
- Reusing a UUID across objects (each object has its own).
- Generating `human_ref` from a non-numbering-authority source.

### 2.5.3 Why this is enforceable

A linter / typed wrapper rejects insertion of a financial object missing any of the locked nine. A nightly audit job samples 1% of records per day and asserts the field set is present and well-formed; a missed field is a P0 alert (because it indicates new code shipped without conformance).

---

## v1 launch scope

- `Money` type implemented as a TypeScript value with bigint backing; helper module live; ESLint rule rejects raw money arithmetic in new code.
- New tables introduced (in this Part's specified shapes): `financial_transactions`, `ledger_entries`, `numbering_sequences`. Legacy `bookings.*` decimal columns continue to exist but are read-only mirrors of ledger-derived values.
- Append-only triggers in place at DB level for `financial_transactions` and `ledger_entries`.
- Hash chain extended from existing audit-event chain to the ledger.
- Numbering authority service deployed for at least the K9000 invoice domain and platform-fee invoice domain.
- The locked-nine field set enforced by typed wrappers.
- Daily integrity job (chain verification + numbering gap detection) running and alerting.

## Deferred scope

- Multi-currency Money. ILS-only at v1.
- Migration of all legacy `decimal(12,2)` money columns to canonical Money type. v1 keeps legacy columns; v1.1+ migrates.
- Cross-region archival (single-region storage at v1 with offsite snapshots).
- Real-time customer-facing audit-trail viewer (admin-only at v1).
- Per-currency rounding policy (only ILS half-to-even at v1).
- Multi-tenant chart of accounts (single legal entity = single CoA at v1).

## Legal assumptions

- Israeli tax law requires per-domain sequential, gap-free numbering of tax invoices. Confirmed via Part 0.6 / Part 1 dependency.
- A digitally-signed canonical PDF representation per SHAAM is the v1 archival format for tax invoices.
- The platform legitimately holds `cash.trust.*` accounts on behalf of users (Part 0.4). Without this, trust account codes do not apply.
- Append-only is permissible (and preferred) under Israeli accounting standards. Confirmed by CPA.

## Unresolved questions

1. Final chart of accounts (2.3.4) — CPA must approve the closed list before any code uses an account code in production.
2. PDF canonicalisation algorithm (2.4.4) — exact spec (font embedding, image rendering policy, byte determinism). Engineering owns; CPA reviews.
3. Numbering reset cadence (2.4.1) — calendar year vs fiscal year vs continuous. v1 default proposed: calendar year. Pending CPA confirmation.
4. Banker's rounding penny absorption rule (2.1.4) — which side of a split absorbs the rounding penny. Proposed default: platform absorbs, but CPA must sign off.
5. Hash algorithm version pinning (2.3.3) — sha256 v1; future migration plan to a stronger hash without breaking historical chain.
6. Idempotency-key derivation rule (2.5.1) for system-generated transactions where no caller supplies a key.

## Dependency owners

| Item | Owner |
|---|---|
| Final chart of accounts | CPA + Engineering |
| Provider Master Agreement clauses for self-billing | Counsel (Part 0.5 dependency) |
| SHAAM enrolment / digital signature procurement | CFO + Counsel |
| ESLint / typed-wrapper enforcement of canonical Money | Engineering |
| Append-only DB triggers + integrity verifiers | Engineering (extends Part 9 work) |
| Numbering-authority service | Engineering |
| Customer-facing PDF render (SHAAM-canonical) | Engineering + CPA review |

## Failure modes

| Failure | Effect | Mitigation |
|---|---|---|
| `decimal(12,2)` re-used for new money field | Float-rounding errors compound; reconciliation drift | ESLint rule rejects new `decimal(*,2)` for new financial tables; review checklist. |
| `UPDATE` issued on `financial_transactions` or `ledger_entries` | Audit chain breaks; legal exposure | DB-level trigger raises; admin-tools are stripped of the necessary GRANT. |
| Idempotency key collision with different payload | Silent overwrite or duplicate posting | Hard error on collision; alert (Part 10.1). |
| Numbering sequence gap | SHAAM audit finding; possible invalidation | Daily gap detection (Part 9.6); P0 alert. |
| `metadata` blob reintroduced via patch / hotfix | Spec drift; auditability degrades | PR review checklist; spec-conformance test asserts no `jsonb metadata` column on the financial-tx / ledger tables. |
| Hash chain break between two adjacent rows | Proof of integrity lost | Daily verifier alerts; P0 incident; ledger frozen until re-hash + investigation. |
| Money helper not used (raw arithmetic on minor units) | Currency mix, rounding inconsistency | ESLint rule + types: helper functions are the only public surface that returns `Money`. |

## Reconciliation strategy

- **Per-transaction:** sum(`ledger_entries.amount_minor`) for each `txn_id` == 0 (double-entry invariant). Constraint: trigger or check.
- **Per-account, per-day:** opening balance + sum(debits) - sum(credits) == closing balance. Cross-checked against bank statement extracts where applicable (operating account, trust account).
- **Per-channel, per-day:** count of issued invoices in the numbering authority == count of `txn_kind ∈ {charge, credit_note}` with that channel. Variance alerts.
- **Per-provider, per-period:** payout report sum == sum of marketplace `charge.net_minor` minus `fee` minus any held amounts (refund pending / dispute). Variance alerts.
- **Hash chain:** continuous tail-validation (every new entry verifies its `hash_prev`); daily full-chain verification.

## Rollback / offset strategy

- Wrong charge → issue `refund` (with `parent_txn_id` = original charge) + issue `credit_note` against the original invoice. Original charge and original invoice remain on file forever.
- Wrong invoice number assignment → not possible (numbering authority is single-source, intra-transaction).
- Wrong account code on a ledger entry → cannot `UPDATE`; instead post an offsetting entry pair plus a corrective entry pair, both with `reason_code='cor_account_code_misposting'` and the original `txn_id` referenced.
- "Lost" external acquirer reference → re-attach via an `adjustment` transaction that links the original txn to the late-arriving external ref, never by mutating the original row.
- Database recovery: point-in-time restore is the ONLY recovery. Manual SQL on financial tables (other than INSERT) is forbidden. If an emergency requires it, it is an incident, not a routine.

---

**Hard rule restated:** No "temporary" finance logic. The Money type, the append-only ledger, the locked nine fields, and the numbering authority are not staged in. They are present from the first row that touches `financial_transactions` or `ledger_entries`. If a launch deadline pressures any of these to be deferred, it is the deadline that moves, not the spec.
