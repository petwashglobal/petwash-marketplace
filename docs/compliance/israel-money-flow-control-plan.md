# PetWash™ — Israeli Compliance & Money-Flow Control Layer — Implementation Plan

**Date:** 2026-06-02 · **Version:** 1.2 (reconciled with external "v2" spec; Hybrid launch scope chosen by CEO)
**Status:** Engineering-ready. Grounded in the real codebase (see CONFIRMED markers).

> **Why v1.2:** an external "v2" spec proposed a fresh greenfield schema (migration `0003`, new `suppliers`/`transactions`/`supplier_invoices` tables, `NUMERIC` money). **VERIFIED FALSE for this repo:** the repo has **32 migrations (highest 0033 → next 0034)**, `supplier_invoices` already exists (migrations 0024/0025/0026), `shaam`/allocation already exist (0026 + `shared/schema.ts`), money is **INTEGER agorot**. Running v2 as-is would create duplicate parallel tables. This plan keeps the **grounded schema** and folds in v2's genuinely-better ideas (see §9).

> Status labels: **CONFIRMED** = grounded in files actually read in the repo. **UNVERIFIED** = inferred, not directly read. All Israeli tax numbers are encoded as concrete system rules; only ONE genuinely-judgment item is flagged for CPA sign-off.

> **What already exists (CONFIRMED — you are NOT starting from zero):**
> - `shared/israel-compliance-config.ts` already encodes the SHAAM/חשבוניות-ישראל phases — but **only the 10k (2026-01-01) and 5k (2026-06-01) bands; it omits the 2025 ₪20k band.**
> - `supplier_invoices` already has `shaam_required` + `shaam_allocation_number` + `file_hash` + index `idx_supplier_invoices_shaam_required_missing`.
> - `pw_payments.vat_rate` already exists **per-row** (VAT is not globally hardcoded at the payment layer).
> - `provider_tax_compliance` + `suppliers.osek_classification` already capture some tax status.
> - `contractor_bank_details.isVerified` exists (but has **no route to flip it** — gap).
> - Hash-chain audit pattern already used (`billingAuditLog` / `complianceAuditTrail` / `audit_events`) with `entry_hash`+`prev_hash`.
> - Encryption convention `enc:v1:` for sensitive fields; money stored as **INTEGER agorot/cents**; migrations `NNNN_snake_case.sql`, next number **0034**.
> - SUMIT send path defaults **OFF** (`ff...sumit_send` flag). Nayax/Masav payouts **not integrated** (no money actually moves today).

---

## 1. Architecture overview — 5 business lines

**A — STATION (direct wash) — PRINCIPAL / merchant-of-record.** PetWash sells the wash. One clean PetWash חשבונית מס to the customer, `vat_rate` stamped on the transaction (default `0.18` from 2025). No third party in the money path. **Only line fully live at launch.**

**B — SHOP (direct goods) — PRINCIPAL.** Same posture as Station. Gift-card / eGift sales defer VAT to **redemption** (`vat_treatment='deferred'`, already modeled) — do **not** touch outside a protected-finance PR. This is the structural answer to the earlier eGift question: face-value credit, VAT at redemption, no checkout surcharge.

**C — PLATFORM (3rd-party providers) — AGENT / facilitator — PHASE 2.** Provider is the seller; PetWash issues only a **commission** invoice on its fee. עוסק-פטור providers issue a קבלה only → PetWash cannot reclaim input VAT on their share. **Built-but-dark at launch:** no booking, no payout, no auto-approval.

**D — SUPPLIER / INVOICE CONTROL — pre-accounting approval gate.** Every inbound B2B invoice is screened before it reaches the accountant/SUMIT: amounts, duplicate-number + duplicate-hash, osek consistency, VAT-math, allocation-number requirement. **At launch: data-collection + flagging only.** Never auto-sends, never auto-pays.

**E — LOCATION PARTNER / FRANCHISE — separate workflow.** Kept out of the provider-payout and supplier-invoice pipelines so franchise settlements never reuse marketplace payout logic. **Honest scope:** in this plan Line E is a *line-of-business tag only* — no table, no admin surface yet. Concrete modeling is deferred to a later spec (flagged so it is not mistaken for "done").

**Core invariant:** A, B, gift cards → **principal** (PetWash owns the tax invoice + VAT). C → **agent** (provider owns the customer-facing tax document). Already partly encoded in `pw_provider_payouts.commercialModel` / `requiresTaxInvoice`.

---

## 2. Database changes

> Convention (CONFIRMED): `migrations/NNNN_snake_case.sql`; money = **INTEGER agorot**; VAT rate = VARCHAR string; soft-delete `deleted_at` on financial tables; audit via `entry_hash`+`prev_hash`. **All migrations use `IF NOT EXISTS` and are idempotent** — the repo already has duplicate numbers (0008, 0028) and gaps (0023, 0032), so strict sequential ordering is NOT a real invariant. Numbers below are suggested, not load-bearing.

### 2.1 `vat_rate_configs` — **NEW** (`0034_vat_rate_configs.sql`)
Makes the *default* VAT lookup-driven instead of the hardcoded `'0.18'`. App resolves the latest row with `effective_date <= tx_date` and **stamps the resolved rate onto `pw_payments.vat_rate`** — never reads config at display time. (Rule 1.)

| column | type | meaning |
|---|---|---|
| `id` | serial PK | |
| `country_code` | varchar(2) | `'IL'` |
| `effective_date` | date | rate active from |
| `rate` | varchar(8) | e.g. `'0.18'` |
| `tax_classification_type` | varchar(32) | `standard`/`zero`/`exempt` |
| `legal_basis` | text | "Israel VAT 18% from 2025-01-01; 2026 budget retained" |
| `created_at` | timestamptz default now() | |

Seed: `('IL','2025-01-01','0.18','standard',…)`.

### 2.2 `entity_tax_checks` — **NEW** (`0035_entity_tax_checks.sql`) — Rule 3
Unified check ledger over providers **and** suppliers. `provider_tax_compliance` / `suppliers.osek_classification` stay source-of-record for their own fields; this is the ledger the payout-gate + admin screens read (one-way sync, **no** schema merge).

| column | type | meaning |
|---|---|---|
| `id` | serial PK | |
| `entity_type` | varchar(16) | `provider`/`supplier` |
| `entity_id` | **integer** | FK-by-convention to `providers.id`/`suppliers.id` (**both are serial INTEGER — corrected from varchar**) |
| `legal_status` | varchar(24) | `osek_patur`/`osek_murshe`/`chevra`/`individual`/`foreign` |
| `tax_file_number` | varchar(40) **(enc:v1:)** | tax file / עוסק / company number |
| `identity_verified` | boolean default false | **(added)** resolves payout-gate cond.1 for BOTH providers and suppliers |
| `identity_verified_at` | timestamptz | |
| `identity_source` | varchar(24) | `document`/`manual_admin` |
| `bookkeeping_cert_status` | varchar(16) | אישור ניהול ספרים: `valid`/`expired`/`missing`/`unverified` |
| `bookkeeping_cert_expiry` | date | |
| `withholding_status` | varchar(16) | ניכוי מס במקור: `exempt`/`rate_on_file`/`default_applies` |
| `withholding_rate` | varchar(8) | if not exempt |
| `withholding_cert_expiry` | date | exemption אישור expiry |
| `check_date` | date | when verified |
| `expiry_date` | date | six-month renewal target |
| `source` | varchar(24) | `rashut_hamisim`/`maarechet_1000`/`uploaded_document` — **NOTE: manual human assertion; no ITA/SHAAM API exists. Must be labelled "manually asserted" on every admin screen.** |
| `verified_by` | varchar(64) | admin actor |
| `created_at`/`updated_at` | timestamptz | |

Index: `idx_entity_tax_checks_entity (entity_type, entity_id)` — required for payout-gate joins.

### 2.3 **ALTER `supplier_invoices`** (`0036_supplier_invoices_allocation_fields.sql`) — Rule 2
`shaam_required`/`shaam_allocation_number` already exist — keep them, add explicit Rule-2 fields as canonical write path and backfill `shaam_*` for the existing index.

| column (ADD) | type | meaning |
|---|---|---|
| `allocation_number_required` | boolean | computed by §3 |
| `allocation_number` | varchar(40) | מספר הקצאה (new writes here; sync to `shaam_allocation_number`) |
| `invoice_amount_before_vat` | **integer (agorot)** | **corrected from numeric(12,2)** to match repo money convention + integer threshold compare |
| `invoice_date` | date | |
| `supplier_tax_id` | varchar(40) | cross-validated vs `suppliers.tax_id` |
| `allocation_check_status` | varchar(24) | `not_required`/`required_missing`/`present_unvalidated`/`validated`/`rejected` |
| `allocation_threshold_used` | **integer (agorot)** | the threshold applied (2,000,000 / 1,000,000 / 500,000 agorot) — Rule 3 "store threshold used" |

### 2.4 `compliance_documents` — **NEW** (`0037_compliance_documents.sql`) — Rule 4 cond. 5/6, Rule 7

| column | type | meaning |
|---|---|---|
| `id` | serial PK | |
| `entity_type` | varchar(24) | `provider`/`supplier`/`invoice`/`bank` |
| `entity_id` | **integer** | (corrected) |
| `document_type` | varchar(40) | `osek_cert`/`bookkeeping_cert`/`withholding_cert`/`bank_proof`/`invoice_pdf` |
| `file_url` | text | `enc:v1:` storage ref |
| `sha256` | varchar(64) | duplicate detection |
| `uploaded_by` | varchar(64) | actor |
| `uploaded_at` | timestamptz | |
| `expiry_date` | date | drives Rule-7 expiry screen |
| `deleted_at` | timestamptz | soft-delete only |

Index: `uq_compliance_documents_sha256_scope (entity_type, sha256)`.

### 2.5 **ALTER `contractor_bank_details`** + `supplier_bank_verification` NEW (`0038_bank_verification_status.sql`) — Rule 4 cond. 7
`isVerified` exists but has no flip route. Add metadata (no money movement). For suppliers, mirror into a small `supplier_bank_verification` table keyed by `supplier_id` rather than mutating the `suppliers.bankAccountDetails` JSONB blob.

| column (ADD) | type | meaning |
|---|---|---|
| `verification_method` | varchar(24) | `micro_deposit`/`manual_admin`/`document` |
| `verification_status` | varchar(16) | `unverified`/`pending`/`verified`/`failed` |
| `verified_at` | timestamptz | |
| `verified_by` | varchar(64) | admin actor |
| `verification_note` | text | |

### 2.6 `compliance_money_audit` — **NEW** (`0039_compliance_money_audit.sql`) — Rule 8
Central append-only, hash-chained audit. Dual-write status changes to `audit_events` too (preserve existing dashboards).

| column | type | meaning |
|---|---|---|
| `id` | serial PK | |
| `event_type` | varchar(48) | `tax_status_change`/`document_upload`/`tax_check`/`bank_verification`/`payout_block`/`payout_approval`/`admin_note`/`allocation_check` — **`bank_verification` added as a first-class type** |
| `entity_type` | varchar(24) | |
| `entity_id` | integer | |
| `actor_user_id` | varchar(64) | who |
| `actor_role` | varchar(24) | |
| `old_value` | jsonb | previous state |
| `new_value` | jsonb | new state |
| `reason` | text **NOT NULL** | **required on EVERY event type, not just blocks/approvals** (Rule 8). Enforced NOT NULL + app-layer guard. |
| `entry_hash` | varchar(64) | sha256 of row + prev |
| `prev_hash` | varchar(64) | chain link |
| `created_at` | timestamptz | |

---

## 3. Allocation-number threshold logic (pure function) — Rule 2

Extends `israel-compliance-config.ts` (which today has only the 10k/5k phases) by **adding the 2025 ₪20k band** and returning + storing the threshold used. **All amounts in agorot** (₪20,000 = 2,000,000 agorot).

```text
const SHAAM_PHASE0_THRESHOLD_AGOROT = 2_000_000  // ₪20,000 (2025, digital-invoice law start)
const SHAAM_PHASE1_THRESHOLD_AGOROT = 1_000_000  // ₪10,000 (from 2026-01-01)
const SHAAM_PHASE2_THRESHOLD_AGOROT =   500_000  // ₪5,000  (from 2026-06-01)

function allocationNumberRequired(amount_before_vat_agorot, invoice_date)
    -> { required, threshold_used }
  amount := abs(amount_before_vat_agorot)        // abs handles credit notes
  if invoice_date >= 2026-06-01: threshold := SHAAM_PHASE2_THRESHOLD_AGOROT
  elif invoice_date >= 2026-01-01: threshold := SHAAM_PHASE1_THRESHOLD_AGOROT
  else: threshold := SHAAM_PHASE0_THRESHOLD_AGOROT
  required := amount > threshold                 // strictly greater-than
  return { required, threshold_used: threshold }
```

Buyer-side: PetWash captures the supplier's allocation number from the document (no auto-fetch — no SHAAM/ITA API exists). If `required && allocation_number IS NULL` → `allocation_check_status='required_missing'` → invoice **blocked** from accountant/SUMIT.

---

## 4. Payout-gate (deterministic, OFF at launch) — Rule 4

Pure function, returns allow/block + failed conditions. **Hard-disabled at launch** behind `ff.payout_gate.enabled=OFF`; wired only into an admin *dry-run* read ("would this be blocked?"), never a money-moving path (Nayax/Masav not integrated anyway).

```text
function payoutGate(payout) -> { decision, failed[] }
  failed := []
  1. if not taxCheck.identity_verified:                         failed += 'identity_unverified'   // now resolves for providers AND suppliers (§2.2)
  2. if taxCheck.legal_status is null:                          failed += 'tax_status_undeclared'
  3. if taxCheck.bookkeeping_cert_status not in {valid}         // or withholding unset
        or taxCheck.withholding_status is null:                 failed += 'bookkeeping_or_withholding_unchecked'
  4. if payout.matched_invoice_id is null:                      failed += 'invoice_not_matched'
  5. if invoice.duplicate_number_check != 'pass':               failed += 'duplicate_invoice_number'
  6. if invoice.duplicate_hash_check  != 'pass':                failed += 'duplicate_document_hash'
  7. if bank.verification_status != 'verified':                 failed += 'bank_unverified'
  8. if invoice.allocation_number_required
        and invoice.allocation_number is null:                  failed += 'allocation_number_missing'
  decision := empty(failed) ? 'allow' : 'block'
```

Every ALLOW/BLOCK writes `payout_approval`/`payout_block` to `compliance_money_audit` with `reason` + `failed[]`. Even when ON later, it gates a *queue status*, not a transfer — settlement is a separate protected-finance PR.

---

## 5. API endpoints

> `/api/admin/...` behind `requireAdmin`/`requireRole`; finance-sensitive behind `FINANCE_AUTHORIZED_EMAILS`; SUMIT under `/api/admin/sumit`. Every write emits `compliance_money_audit` **with a mandatory `reason`**.

**Tax-status (Rule 3)** — `GET /compliance/tax-checks/:entityType/:entityId` · `POST /compliance/tax-checks` (finance) · `POST /compliance/tax-checks/:id/renew` (six-month).
**Invoice + allocation (Rule 2)** — `POST /supplier-invoices/:id/allocation-check` (runs §3) · `PATCH /supplier-invoices/:id/allocation-number` (finance, manual entry).
**Payout gate (dark)** — `GET /payout-gate/:payoutId/evaluate?dryRun=true` (finance, read-only; `503 {disabled:true}` while flag OFF).
**Documents (Rule 4 cond.5/6, Rule 7)** — `POST /compliance/documents` (sha256, reject dup-hash, encrypted) · `GET /compliance/documents/:entityType/:entityId`.
**Bank (Rule 4 cond.7)** — `POST /compliance/bank/:entityType/:entityId/verify` (FINANCE_AUTHORIZED_EMAILS; writes `bank_verification` audit).
**Admin actions** — `POST /supplier-invoices/:id/approve|reject` (super-admin; requires allocation+osek+dup green).
**Audit read (Rule 8)** — `GET /compliance/audit?entityType=&entityId=` · `GET /compliance/audit/verify-chain` (super-admin).

---

## 6. Admin panel screens (Rule 7)

New pages under `client/src/pages/admin/`. Each lists → detail → action → writes the named audit event. **Every screen that shows `source` must label `rashut_hamisim`/`maarechet_1000` as "manually asserted — no automated ITA check."**

1. **Provider Tax Status** → `tax_status_change`
2. **Supplier Tax Status** (flags `osek_classification='unknown'`) → `tax_status_change`
3. **Invoice Approval** (OCR amounts, VAT-math, osek, allocation) → `payout_approval` + `allocation_check`
4. **Duplicate Invoice Warnings** (dup-number + dup-hash) → `admin_note`
5. **Allocation-Number Requirement** (`required=true AND number IS NULL`) → `allocation_check`
6. **Bank Verification** (last-4 only) → `bank_verification`
7. **Document Expiry** (certs/docs expiring ≤N days) → `document_upload`/`admin_note`
8. **Six-Month Declaration Renewal** (`expiry_date` due) → `tax_status_change`

---

## 7. Launch scoping (Rule 6)

**SHIPS NOW (live):** Station (Line A) direct-wash with per-tx `vat_rate`; Member/Loyalty (no change, deferred-VAT untouched); Provider Waitlist (collect application + tax-status declaration; **no approval, no payout**); Supplier/Invoice Control **data-collection + flagging only**.

**BUILT-BUT-DARK (flag OFF):** payout-gate (dry-run only); invoice automation / SUMIT send (`sumit_send=OFF`); marketplace booking (Line C); auto provider approval; Nayax/Masav payouts (not integrated).

---

## 8. First PR list (sequenced, one purpose each)

> Launch-safe data-model + admin-read first; money/automation last and dark. **PROTECTED** = touches SUMIT/wallet/Tranzila/payments → **explicit CEO approval before merge.**

1. **PR-1 — VAT rate config table + default lookup.** `0034` + read helper. Additive; `pw_payments.vat_rate` already exists. PROTECTED? No (CEO FYI — underpins VAT).
2. **PR-2 — Allocation-threshold function + 2025 ₪20k band.** Extend `israel-compliance-config.ts` + unit tests (agorot). Pure function. PROTECTED? No.
3. **PR-3 — Unified compliance audit log** (`0039`, hash-chain, `reason` NOT NULL). Append-only; nothing reads it yet. PROTECTED? No.
4. **PR-4 — Entity tax-check ledger** (`0035`, integer entity_id, identity_verified). New table, one-way sync. PROTECTED? No.
5. **PR-5 — Compliance document store + hash dedup** (`0037`, encrypted, sha256). Additive. PROTECTED? No.
6. **PR-6 — supplier_invoices allocation fields + allocation-check endpoint** (`0036`). Additive columns + computation, no SUMIT send. PROTECTED? **Borderline (SUMIT reads this table) → CEO approval; assert no send-path change.**
7. **PR-7 — Bank verification fields + verify endpoint** (`0038`). Status flag only, no transfers. PROTECTED? **Yes (bank records, FINANCE_AUTHORIZED_EMAILS) → CEO approval.**
8. **PR-8 — Admin read screens** (screens 1–2, 4–5, 7–8) + audit-read API. Read/flag only. PROTECTED? No.
9. **PR-9 — Payout-gate function + dry-run endpoint (DARK)** (`ff.payout_gate.enabled=OFF`). Read-only eval. PROTECTED? **Yes → CEO approval; ships disabled.**
10. **PR-10 — Invoice-approval action wiring (screen 3, DARK)** (`sumit_send` stays OFF). PROTECTED? **Yes → CEO approval; no auto-send.**

---

## Single CPA sign-off note
**VAT treatment of the cancellation fee** (cap = lower of 5% or ₪100, CONFIRMED gov) is a genuine tax-authority judgment: whether the retained fee is a VAT-able supply or a non-supply penalty decides if `vat_rate` applies. Encode the cap as a hard rule now; mark the *VAT-on-cancellation-fee* flag `needs_cpa_signoff` on the transaction until confirmed. Everything else is encoded as concrete rules.

---

## Corrections applied in v1.1 (from adversarial review)
1. `reason` is **NOT NULL on every** audit event type (was: only blocks/approvals).
2. `entity_id` is **INTEGER** (providers.id/suppliers.id are serial INTEGER) with a composite `(entity_type, entity_id)` index — was varchar, would have broken joins.
3. `invoice_amount_before_vat` + `allocation_threshold_used` are **INTEGER agorot** (was numeric) — prevents an off-by-100 threshold bug; thresholds restated in agorot.
4. Added **`identity_verified`** to the tax-check ledger so payout-gate cond.1 resolves for **suppliers**, not just providers.
5. Added dedicated **`bank_verification`** audit event type (was reusing generic `tax_check`).
6. Dropped the false "migrations must merge in strict number order" claim — repo has dup numbers/gaps; all migrations are **idempotent `IF NOT EXISTS`**.
7. Admin screens must **label `source` as manually asserted** — no SHAAM/ITA API exists, so `rashut_hamisim`/`maarechet_1000` are human assertions, not system-verified.
8. Line E (Franchise) honestly scoped as a **tag only** — not modeled as tables/screens in this phase.

---

## 9. Reconciliation with the external "v2" spec + Hybrid launch phasing

### 9.1 Items ADOPTED from v2 (grafted onto the grounded schema — no new duplicate base tables)
- **Sanctions screening** — add `sanctions_check_status` (`pending`/`clean`/`hit`/`exempt`) to `entity_tax_checks`; OFAC + EU + Israeli MoF list check on entity creation + nightly re-check. New blocker in the payout-gate (`sanctions_list_hit`). → **PR-12 (dark)**.
- **System 1000 / רשות המסים API** — real integration to validate osek status + allocation numbers live, replacing manual assertion. **Caveat:** requires Pet Wash Ltd. one-time registration as an authorised API consumer via the Tax Authority portal. → **PR-11 (dark until onboarded)**.
- **Feature-flag table** — adopt v2's `feature_flags(flag_key, live, last_changed_by, last_changed_at, reason)` instead of ad-hoc `ff.*` constants. Flipping a flag is an audit-logged event. Seed defaults per §7 launch scoping.
- **Role permission matrix** — `owner` (all) / `admin` (all except prod-impacting flag flips) / `reviewer` (approve-reject within queue, no block override) / `accountant` (read-only: invoices, transactions, audit, tax IDs — no extra PII) / `support` (customer items only) / `developer` (read-only schema/transactions, no PII).
- **Per-event audit list** — v2 §10's event list becomes the canonical `compliance_money_audit.event_type` set (supplier created, tax check run, status changed, doc uploaded, bank set/verified, invoice uploaded/duplicate/allocation/approve/reject, payment blocked/resolved/paid, flag flipped, declaration sent/received, refund issued, sanctions hit, config changed, role assigned). 7-year retention (Israeli tax record-keeping), daily off-site backup.
- **Six-month declaration → auto-suspend** — overdue `expiry_date` blocks new bookings/payouts; existing honoured; restored on confirmation.

### 9.2 Item CORRECTED from v2
- **Refunds are NOT supplier payouts.** v2's `can_pay()` ran the supplier bookkeeping/withholding gate on customer refunds > ₪500 — wrong. Customer refunds run a **separate** refund path (credit invoice / חשבונית זיכוי, VAT reversed); the payout-gate (§4) applies only to supplier-invoice payments and provider payouts.

### 9.3 Hybrid launch phasing (CEO-selected) — maps PRs to dates

| Phase | When | Ships | PRs |
|---|---|---|---|
| **1 — Member-facing** | by **July 2026** (launch) | Station (per-tx VAT), Member/Loyalty, Apple Wallet, **Provider Waitlist** (collect tax-status declaration only — no approval, no payout) | existing in-flight + PR-4 |
| **2 — Compliance backbone (silent/backstage)** | by **August 2026** | VAT config, allocation ₪20k fix, **audit log**, tax-check ledger, document store, **admin READ screens** (flag-only, no money) | PR-1, PR-2, PR-3, PR-4, PR-5, PR-8 |
| **3 — Money gate (before any payout/Line-B-online/Line-C)** | **Month ~4** | supplier-invoice allocation fields, bank verification, **payout gate (still flag-OFF until tested)**, System 1000 API, sanctions, invoice-approval wiring | PR-6, PR-7, PR-9, PR-10, PR-11, PR-12 |

**Gate:** Line C (platform booking/payout) flag does **not** flip until PR-6, PR-7, PR-9, PR-10, PR-11, PR-12 are all merged **and** counsel-approved provider terms are in production. No money moves through any line until Phase 3 is complete and tested with a real blocked-then-approved payout.
