# PROVIDER FINANCE + SUMIT INTEGRATION — V2 DEEP ARCHITECTURE

**Document status:** DRAFT for CEO review. NOT committed to main. NOT a PR. No code yet.
**Author:** Claude Code (Opus 4.7)
**Date:** 2026-05-18
**Companion to:** PR #301 (SUMIT_CAPABILITIES_AUDIT.md), PR #312 (PROVIDER_FINANCE_SUMIT_INTEGRATION_AUDIT.md)

---

## §0 SCOPE & READING GUIDE

### What this document IS
A deep architectural extension of PR #312, written after:
1. CEO uploaded SUMIT admin-panel screenshots (pricing, invoice rendering, customer model, module store)
2. Full re-read of PR #301 and PR #312
3. Full audit of PetWash's current financial code (services, schema, env vars, module-load risks)
4. Discovery that PetWash's existing production financial infrastructure is FAR more developed than PR #312 implied

### What this document is NOT
- It does NOT re-litigate decisions F-A through F-G locked by CEO on PR #312
- It does NOT redesign Nayax (already production with K9000 + marketplace + webhooks)
- It does NOT redesign Wallets, Loyalty, Memberships, Bookings, Escrow (all production)
- It is NOT a PR. It is NOT code. It is decision material for the CEO.

### Reading order
- §1: What changed since PR #312 (executive summary)
- §2: Reconciliation between PR #312 architecture and what's actually in code (CRITICAL — there are mismatches)
- §3 through §22: The 20 CEO-requested deliverables, in order
- §23: New cost model (from screenshots)
- §24: CPA engagement scope (three pending policy switches)
- §25: Open questions index (B1–B8 + Q11–Q15 + new)
- §26: Roadmap adjustment (PR-PFP-1 through PR-PFP-11, refined scope)
- §27: P0 risk register
- §28: CEO approval checklist (single page, sign-off section)

---

## §1 WHAT CHANGED SINCE PR #312

PR #312 was written assuming PetWash had **minimal** financial infrastructure that needed to be built around SUMIT. Code audit reveals **the opposite**: PetWash already has unified payment tables, dual-invoice support, escrow state machines, idempotency keys, reconciliation reports, Apple/Google Wallet, loyalty tiers, memberships, and an Israeli tax document lifecycle. **SUMIT is not the foundation — it is one new financial backend joining an existing stack.**

This changes the architecture meaningfully:

1. **SUMIT is not the universal payment processor.** Nayax already handles K9000 (kiosks) AND online marketplace charging (NayaxSitterMarketplaceService, NayaxWalkMarketplaceService, NayaxJobDispatchPaymentService). SUMIT is being introduced primarily for **provider-named invoice issuance** (the marketplace tax/legal layer) and as a candidate for replacing Nayax as the online charge processor (Apple Pay/Google Pay/Bit support is a major draw). The "Nayax = kiosk only" framing in PR #312 is INCORRECT and must be corrected.

2. **The dual-invoice model is already in schema.** `pw_provider_payouts` has `providerTaxInvoiceId` AND `commissionInvoiceId` columns. Section 8 Model B (provider→PetWash service invoice + PetWash→provider commission invoice) is the codified pattern. SUMIT must produce BOTH documents per payout, and the column mapping is already determined.

3. **`provider_finance_profiles` is designed but NOT migrated.** PR #312 designed the schema in markdown. No migration exists. PR-PFP-1 is genuinely first work.

4. **`provider_tax_compliance` ALREADY EXISTS** (`schema.ts:9197`). It stores `taxIdType` (עוסק פטור/עוסק מורשה), `taxId`, `vatNumber`, `withholdingCertRate`, `withholdingCertExpiry`. This is **partial overlap** with the proposed `provider_finance_profiles`. The V2 architecture must decide: merge, replace, or coexist. **Recommendation: keep `provider_tax_compliance` as-is (tax registration data), add `provider_finance_profiles` for SUMIT-specific wiring + bank details + payout gating.** They serve different purposes.

5. **PetWash Ltd VAT number is hardcoded as `"516788400"`** in `pw_tax_documents` defaults. The CEO's Ltd ID per `israel-compliance-config.ts` is `"517145033"`. **One of these is wrong** and must be reconciled with the accountant before SUMIT integration.

6. **ID numbers (`users.idNumber`) are stored as plaintext varchar.** This is a serious compliance gap (Israeli Privacy Protection Law §17). Must be addressed regardless of SUMIT integration.

7. **Two module-load env-var throws exist** (WalletService line 18-19, AppleWalletService line 58-59). The first crashed production for 8 days this month. Both must be made lazy.

8. **SUMIT screenshots reveal pricing model:** ₪99/month base, 400 actions included, ₪0.25 per action overage, 1.1% card clearing baseline. For a marketplace with ~10k bookings/month, the per-action overage will dominate cost — must model this carefully (§23).

9. **Apple Pay / Google Pay / Bit are INCLUDED in SUMIT base plan.** Significant — eliminates need for separate Tranzila or Stripe wiring for those payment methods.

10. **The Hebrew SUMIT support email is ALREADY IN THE REPO** (PR #301 §3). CEO can send it today. We can add Q11–Q15 from screenshots before sending.

---

## §2 RECONCILIATION — PR #312 ARCHITECTURE vs ACTUAL CODE

| Topic | PR #312 said | Code says | Resolution |
|---|---|---|---|
| Nayax scope | "Unattended kiosk terminals ONLY" | NayaxOnlinePaymentService, NayaxSitterMarketplaceService, NayaxWalkMarketplaceService — full marketplace charging | **PR #312 was WRONG.** Update Path E scope. |
| `provider_finance_profiles` table | Designed in §2 | Does not exist | PR-PFP-1 still needed |
| `provider_tax_compliance` table | Not mentioned | Exists, production, stores tax classification + withholding cert | **Pre-existing.** V2 must coexist, not replace |
| Stripe wiring | "Deprecated" | Schema still has `stripeSubscriptionId`, `stripeCustomerId` on `memberships`; deprecation warnings only on env vars | PR-PFP-11 must remove these schema fields |
| `pw_payments` unified ledger | Not discussed | Production. INTEGER CENTS, idempotency keys, state machine | SUMIT must integrate here, not parallel to it |
| `pw_provider_payouts` dual-invoice | Discussed abstractly | Production. `providerTaxInvoiceId` + `commissionInvoiceId` columns exist | SUMIT writes IDs back to these columns |
| `pw_tax_documents` | Not discussed | Production. Sequential numbering, Google Drive archival, 7-year retention | SUMIT integration must respect existing schema |
| Loyalty system | Not discussed | 7-tier production (bronze→royal), 10pt/₪1, badges/challenges/referrals | **Stays internal to PetWash.** SUMIT is not in the loyalty path. |
| Membership billing | "Use SUMIT recurring" | Stripe IDs in schema but Stripe deprecated. Recurring not actually live | Cutover plan needed: PR-PFP-12 (NEW) |
| Apple/Google Wallet | Not discussed | Production. PetWash Prestige passes. APPLE_* env validation at module load | Compatible. SUMIT does not replace. |
| Withholding tax | "Calculated at settlement" | `provider_tax_compliance.withholdingCertRate` stored. Default unclear. NOT visible in `pw_provider_payouts` table | **GAP.** Calculation site needs to be identified or built. CPA must confirm default rate. |
| ID number storage | Not discussed | Plaintext `users.idNumber` varchar | **NEW P0 RISK.** Address regardless of SUMIT. |
| VAT number | Not discussed | Hardcoded `"516788400"` in `pw_tax_documents` defaults; shared config says `"517145033"` | **Reconcile with accountant.** One is wrong. |
| Module-load throws | Not discussed | WalletService:19 (P0, crashed prod today), AppleWalletService:58 (lazy, safer) | Lazy-check both. Add CI gate. |
| `docs/finance/*` subdirectory | Not mentioned | 6 deeper finance docs exist (00-platform-role-model, 02-money-object-model, sumit-upay-operating-model, sumit-upay-vendor-discovery-and-rail-architecture, transaction-lifecycle-forensic-audit, finance-review-blind-spots-and-authority-questions) | **TODO:** cross-reference in V3. V2 does not subsume these. |

### Critical correction
Path E in PR #312 was scoped assuming Nayax was kiosk-only. That assumption is wrong. **Path E must include a decision: does SUMIT REPLACE Nayax for online marketplace charging, or do they COEXIST?**

Recommendation (subject to CEO + accountant approval):
- **Phase A (immediate):** Nayax continues to process online marketplace payments. SUMIT is added ONLY for invoice issuance (provider-named + commission). Money flows through Nayax → PetWash escrow → manual provider payout. SUMIT writes accounting documents from this flow.
- **Phase B (post-CPA sign-off):** Migrate Apple Pay / Google Pay / Bit volume to SUMIT (cost advantage + UX). Nayax remains for K9000 (kiosk) and card-present.
- **Phase C (long-term):** Evaluate whether to consolidate all online charging on SUMIT (depends on B1, B5, B6 answers + cost modeling at scale).

---

## §3 ARCHITECTURE REPORT (Deliverable 1)

### Three-tier role model (LOCKED, from §0 platform role)

```
┌──────────────────────────────────────────────────────────────────┐
│ TIER 1: PETWASH (Source of Truth)                                │
│   Owns: users, providers, bookings, escrow, wallets, loyalty,    │
│         memberships, disputes, reviews, marketplace state        │
│   Owns: payment orchestration (which gateway to call when)       │
│   Owns: business logic, pricing, fee splits                      │
└──────────────────────────────────────────────────────────────────┘
                  ▲                          ▲
                  │ orchestrates             │ writes documents
                  ▼                          ▼
┌──────────────────────────────┐   ┌──────────────────────────────┐
│ TIER 2A: NAYAX                │   │ TIER 2B: SUMIT               │
│   Card clearing (K9000 + on-  │   │   Financial system of record │
│   line marketplace charging)  │   │   Invoices, receipts, books  │
│   Webhook on charge events    │   │   VAT calc + allocation #    │
│                                │   │   Customer/sub-business mgmt │
│                                │   │   Recurring billing          │
│                                │   │   Apple Pay/Google Pay/Bit   │
└──────────────────────────────┘   └──────────────────────────────┘
                                              ▲
                                              │ backup export
                                              ▼
                              ┌──────────────────────────────┐
                              │ TIER 3: GOOGLE DRIVE/SHEETS  │
                              │   Backup ONLY. No logic.     │
                              │   PDF archival.              │
                              │   Accountant read-only view. │
                              └──────────────────────────────┘
```

### Marketplace legal model (NEW — from CEO instruction)

**Decision required: agent disclosure model**

The CEO wants the Wolt/Uber Israel pattern: **PetWash issues invoices in the provider's legal name, with provider consent.** This is the "disclosed agent" model (סוכן גלוי). The provider is the legal seller; PetWash is the platform/agent operating on the provider's behalf.

Current code config (`AGENT_MODEL_POLICY` in `israel-compliance-config.ts`): `model='undisclosed'`, `pendingCpaSignoff=true`. **This must flip to `disclosed` before launch.** CPA must confirm.

Mechanism in code:
1. Customer pays PetWash via Nayax/SUMIT.
2. PetWash holds in escrow.
3. On job completion + escrow release:
   - PetWash calls SUMIT `/accounting/documents/create/` with **customer_id = end customer**, **sub_business_id = provider's sub-business**. SUMIT issues invoice in provider's name.
   - PetWash calls SUMIT a second time with **customer_id = provider**, **issuer = PetWash Ltd**. SUMIT issues commission invoice from PetWash to provider.
4. PetWash records both `summitDocumentId`s in `pw_provider_payouts.providerTaxInvoiceId` and `pw_provider_payouts.commissionInvoiceId`.
5. Net amount transferred to provider's bank.

**Consent mechanism (NEW — must be built):**
- Provider, during onboarding, signs digital authorization (כתב הרשאה): "אני מאשר לפלטפורמת פטוואש להפיק חשבוניות בשמי על עסקאות שמבוצעות דרך הפלטפורמה" (I authorize PetWash to issue invoices in my name for transactions executed through the platform).
- Stored in `provider_finance_profiles.invoice_authorization_signed_at` (NEW column needed) + `invoice_authorization_pdf_hash` (audit trail).
- Without this signed authorization, provider's bookings cannot be paid out — payout_status remains `locked`.

---

## §4 EXACT FILE TREE (Deliverable 2)

### NEW files to create (when work starts, NOT NOW)
```
server/services/sumit/
  ├── SumitMarketplaceClient.ts          # Typed API client (PR-PFP-6)
  ├── SumitCustomerSync.ts                # End-customer sync to SUMIT (PR-PFP-7)
  ├── SumitDocumentIssuer.ts              # Invoice/receipt issuance (PR-PFP-7)
  ├── SumitRecurringManager.ts            # Memberships migration (PR-PFP-12)
  ├── SumitMultivendorCharger.ts          # Marketplace charging (PR-PFP-8, gated on B1 answer)
  └── SumitWebhookHandler.ts              # Trigger event consumption (PR-PFP-9)

server/routes/sumit-webhooks.ts           # POST /webhooks/sumit/events (PR-PFP-9)

server/services/InvoiceAuthorizationService.ts  # Provider consent capture (PR-PFP-4)

server/lib/sumit/
  ├── sumitAuth.ts                        # API key handling, HMAC validation
  ├── sumitTypes.ts                       # Generated TS types from SUMIT OpenAPI (if available)
  ├── sumitErrors.ts                      # SUMIT error code → app error mapping
  └── sumitIdempotency.ts                 # External reference key generation

shared/sumit/
  ├── sumit-config.ts                     # ENV-driven config (lazy-init, not module-load)
  └── sumit-feature-flags.ts              # gradual rollout flags

migrations/
  ├── NNNN_create_provider_finance_profiles.sql      (PR-PFP-1)
  ├── NNNN_add_invoice_authorization_columns.sql     (PR-PFP-4)
  ├── NNNN_create_sumit_document_links.sql           (PR-PFP-7)
  ├── NNNN_create_sumit_webhook_events.sql           (PR-PFP-9)
  └── NNNN_drop_stripe_legacy_columns.sql            (PR-PFP-11)

client/src/pages/provider/
  └── finance-onboarding/
      ├── BusinessTypeStep.tsx
      ├── BusinessDetailsStep.tsx
      ├── BankAccountStep.tsx
      ├── InvoiceAuthorizationStep.tsx   # Hebrew consent flow with signature
      └── ReviewAndSubmitStep.tsx

client/src/pages/admin/finance/
  ├── ProviderFinanceReview.tsx          # Admin sees pending finance profiles
  └── SumitSyncStatus.tsx                # Manual override + retry button

tests/integration/sumit/
  ├── sumit-customer-sync.test.ts
  ├── sumit-document-issuance.test.ts
  ├── sumit-webhook-events.test.ts
  └── sumit-multivendor-charge.test.ts   # Gated on B1 answer

docs/
  ├── PROVIDER_FINANCE_SUMIT_INTEGRATION_AUDIT_V2.md   # this doc
  ├── SUMIT_COST_MODEL.md                # action quota math (NEW)
  ├── SUMIT_CPA_ENGAGEMENT_BRIEF.md      # for accountant (NEW)
  ├── INVOICE_AUTHORIZATION_CONSENT_HE.md # Hebrew legal text (NEW, lawyer-reviewed)
  └── SUMIT_RUNBOOK.md                   # ops runbook for sync failures (NEW)
```

### Files to MODIFY (when work starts)
```
shared/israel-compliance-config.ts       # CPA sign-offs on three policy switches
shared/schema.ts                         # Add provider_finance_profiles + relationships
server/services/WalletService.ts         # Lazy env check (P0 — happens regardless of SUMIT)
server/services/AppleWalletService.ts    # Lazy env check (P0 — same class)
server/routes.ts                         # Wire up new SUMIT routes
shared/finance/finance-flow-types.ts     # Add SUMIT_* enum members
```

### Files to DELETE (when work starts — last)
```
server/services/TranzilaChargebackService.ts        # Already STUB, drop entirely
server/services/TranzilaPaymentRequestService.ts    # Already STUB, drop entirely
server/services/TranzilaWebhookService.ts           # Already STUB, drop entirely
server/routes/tranzila-webhooks.ts                  # Unwired, drop
server/routes/tranzila-event-webhooks.ts            # Unwired, drop
```

(Stripe-related code is already deprecated-warning-only; PR-PFP-11 drops schema fields.)

---

## §5 DB SCHEMA PLAN (Deliverable 3)

### Table 1: `provider_finance_profiles` (PR-PFP-1)

Base schema from PR #312 §2 — locked. Adding 3 new columns from V2 analysis:

```sql
CREATE TABLE provider_finance_profiles (
  id                              SERIAL PRIMARY KEY,
  provider_user_id                VARCHAR NOT NULL UNIQUE REFERENCES users(id) ON DELETE RESTRICT,

  -- Israeli business classification
  business_type                   VARCHAR NOT NULL CHECK (business_type IN
    ('exempt_dealer','authorised_dealer','limited_company','nonprofit')),

  -- Business identification
  business_number                 VARCHAR,
  legal_name_he                   VARCHAR NOT NULL,
  legal_name_en                   VARCHAR,

  -- Location + contact
  registered_address              TEXT,
  business_phone                  VARCHAR,
  invoice_email                   VARCHAR NOT NULL,

  -- Payout banking (encrypted)
  bank_account_iban_encrypted     BYTEA,
  bank_account_iban_key_version   INTEGER,           -- supports key rotation
  payout_method                   VARCHAR DEFAULT 'bank_transfer',

  -- Tax authority connection
  vat_number                      VARCHAR,
  tax_authority_registered        BOOLEAN DEFAULT FALSE,
  tax_authority_connected_at      TIMESTAMP,

  -- SUMIT wiring
  sumit_sub_business_id           VARCHAR,
  sumit_customer_id               VARCHAR,           -- when provider receives commission invoice from PetWash
  sumit_setup_status              VARCHAR NOT NULL DEFAULT 'pending' CHECK (sumit_setup_status IN
    ('pending','in_progress','ready','suspended','failed')),
  sumit_last_sync_at              TIMESTAMP,
  sumit_last_sync_error           TEXT,
  sumit_retry_count               INTEGER DEFAULT 0,

  -- Payout gating
  payout_status                   VARCHAR NOT NULL DEFAULT 'locked' CHECK (payout_status IN
    ('locked','enabled','suspended')),

  -- NEW (V2): Invoice authorization (consent for PetWash to issue invoices in provider's name)
  invoice_authorization_signed_at TIMESTAMP,
  invoice_authorization_pdf_sha256 VARCHAR(64),
  invoice_authorization_version   VARCHAR DEFAULT 'v1',  -- track which legal text version was signed

  -- Lifecycle
  approved_by_petwash_at          TIMESTAMP,
  created_at                      TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at                      TIMESTAMP NOT NULL DEFAULT NOW(),

  -- Constraints (from PR #312)
  CONSTRAINT pfp_vat_required CHECK (
    business_type NOT IN ('authorised_dealer','limited_company')
    OR vat_number IS NOT NULL
  ),
  CONSTRAINT pfp_iban_required_when_enabled CHECK (
    payout_status <> 'enabled'
    OR bank_account_iban_encrypted IS NOT NULL
  ),
  -- NEW (V2): payout requires signed authorization
  CONSTRAINT pfp_auth_required_when_enabled CHECK (
    payout_status <> 'enabled'
    OR invoice_authorization_signed_at IS NOT NULL
  )
);

CREATE INDEX pfp_provider_idx       ON provider_finance_profiles (provider_user_id);
CREATE INDEX pfp_sumit_status_idx   ON provider_finance_profiles (sumit_setup_status);
CREATE INDEX pfp_payout_status_idx  ON provider_finance_profiles (payout_status);
CREATE INDEX pfp_sumit_sub_idx      ON provider_finance_profiles (sumit_sub_business_id) WHERE sumit_sub_business_id IS NOT NULL;
```

### Table 2: `sumit_document_links` (PR-PFP-7)

Maps PetWash booking/payment events to SUMIT-issued documents. One booking can produce multiple documents (invoice, commission invoice, receipt, refund credit note).

```sql
CREATE TABLE sumit_document_links (
  id                       SERIAL PRIMARY KEY,
  link_id                  VARCHAR NOT NULL UNIQUE,    -- SDL-{year}-{nanoid8}

  -- PetWash side references
  booking_id               VARCHAR,                     -- nullable: some docs are not booking-tied
  payment_id               VARCHAR REFERENCES pw_payments(payment_id),
  payout_id                VARCHAR REFERENCES pw_provider_payouts(payout_id),
  provider_user_id         VARCHAR REFERENCES users(id),
  customer_user_id         VARCHAR REFERENCES users(id),

  -- SUMIT side references
  sumit_customer_id        VARCHAR NOT NULL,
  sumit_document_id        VARCHAR NOT NULL UNIQUE,
  sumit_document_number    VARCHAR NOT NULL,           -- human-readable
  sumit_allocation_number  VARCHAR,                    -- מספר הקצאה from rashut hamisim
  sumit_sub_business_id    VARCHAR,                    -- for marketplace mode

  -- Document classification
  document_type            VARCHAR NOT NULL CHECK (document_type IN
    ('tax_invoice','receipt','tax_invoice_receipt','commission_invoice','credit_note','refund_receipt')),
  issuer_type              VARCHAR NOT NULL CHECK (issuer_type IN
    ('petwash_principal','provider_via_petwash_agent')),

  -- Money (mirror, not source of truth — source is SUMIT)
  gross_cents              BIGINT NOT NULL,
  vat_cents                BIGINT NOT NULL,
  net_cents                BIGINT NOT NULL,
  currency                 VARCHAR DEFAULT 'ILS',

  -- PDF retrieval
  pdf_url                  VARCHAR,
  pdf_fetched_at           TIMESTAMP,
  pdf_drive_backup_id      VARCHAR,                    -- after backup to Google Drive

  -- Idempotency key sent to SUMIT
  external_reference       VARCHAR NOT NULL UNIQUE,    -- pw-doc-{booking_id}-{doc_type}-{v}

  -- Status
  status                   VARCHAR NOT NULL DEFAULT 'issued' CHECK (status IN
    ('pending','issued','sent','cancelled','superseded')),

  -- Lifecycle
  issued_at                TIMESTAMP NOT NULL DEFAULT NOW(),
  sent_to_customer_at      TIMESTAMP,
  cancelled_at             TIMESTAMP,
  created_at               TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX sdl_booking_idx     ON sumit_document_links (booking_id);
CREATE INDEX sdl_payment_idx     ON sumit_document_links (payment_id);
CREATE INDEX sdl_payout_idx      ON sumit_document_links (payout_id);
CREATE INDEX sdl_provider_idx    ON sumit_document_links (provider_user_id);
CREATE INDEX sdl_customer_idx    ON sumit_document_links (customer_user_id);
CREATE INDEX sdl_type_status_idx ON sumit_document_links (document_type, status);
CREATE INDEX sdl_issued_at_idx   ON sumit_document_links (issued_at);
```

### Table 3: `sumit_webhook_events` (PR-PFP-9)

Audit-grade log of every webhook SUMIT delivers. Append-only.

```sql
CREATE TABLE sumit_webhook_events (
  id                  BIGSERIAL PRIMARY KEY,
  event_id            VARCHAR NOT NULL UNIQUE,        -- SUMIT's event ID (idempotency key from their side)
  trigger_name        VARCHAR NOT NULL,               -- e.g. 'document.created', 'payment.charged'
  raw_payload         JSONB NOT NULL,
  signature_header    VARCHAR,
  signature_valid     BOOLEAN NOT NULL,
  received_at         TIMESTAMP NOT NULL DEFAULT NOW(),
  processed_at        TIMESTAMP,
  processing_error    TEXT,
  retry_count         INTEGER NOT NULL DEFAULT 0,
  next_retry_at       TIMESTAMP,
  dead_lettered_at    TIMESTAMP,                      -- moved to DLQ after max retries
  related_link_id     VARCHAR REFERENCES sumit_document_links(link_id),
  related_payment_id  VARCHAR REFERENCES pw_payments(payment_id),
  source_ip           VARCHAR,
  user_agent          VARCHAR
);

CREATE INDEX swe_trigger_received_idx ON sumit_webhook_events (trigger_name, received_at);
CREATE INDEX swe_unprocessed_idx      ON sumit_webhook_events (processed_at) WHERE processed_at IS NULL;
CREATE INDEX swe_dlq_idx              ON sumit_webhook_events (dead_lettered_at) WHERE dead_lettered_at IS NOT NULL;
CREATE UNIQUE INDEX swe_event_id_idx  ON sumit_webhook_events (event_id);
```

### Table 4 (NEW): `sumit_sync_quota_log`

For tracking action quota consumption — we need to know in real-time how close we are to overage so we don't get surprised by a ₪12k SUMIT bill.

```sql
CREATE TABLE sumit_sync_quota_log (
  id                  BIGSERIAL PRIMARY KEY,
  date                DATE NOT NULL,                  -- daily bucket
  action_type         VARCHAR NOT NULL,               -- 'document_create','customer_create','recurring_charge','email_send','sms_send','webhook'
  count               INTEGER NOT NULL DEFAULT 0,
  sub_business_id     VARCHAR,                        -- for per-provider tracking if quotas are per-sub-business
  UNIQUE (date, action_type, sub_business_id)
);

CREATE INDEX ssql_date_idx ON sumit_sync_quota_log (date);
```

### Modifications to existing tables

```sql
-- Drop Stripe legacy fields (PR-PFP-11, last in sequence)
ALTER TABLE memberships
  DROP COLUMN stripe_subscription_id,
  DROP COLUMN stripe_customer_id;

-- Encrypt ID number at rest (NEW P0 — independent of SUMIT)
-- Migration: read plaintext, encrypt, store in new column, null out old, drop old after verification
ALTER TABLE users
  ADD COLUMN id_number_encrypted BYTEA,
  ADD COLUMN id_number_key_version INTEGER,
  ADD COLUMN id_number_hash VARCHAR(64);  -- for search without decryption

-- Reconcile VAT number (NEW)
-- Either:
--   ALTER TABLE pw_tax_documents ALTER COLUMN vat_number SET DEFAULT '517145033';  (if shared config is right)
-- Or:
--   UPDATE israel-compliance-config.ts to use '516788400'                            (if hardcoded is right)
-- Accountant must confirm which.
```

---

## §6 SYNC FLOW DIAGRAM (Deliverable 4 — provider sync)

```
[Provider applies via PetWash form]
              │
              ▼
[provider_applications row created]
              │
              ▼
[Admin reviews in admin/provider-review]
              │
        ┌─────┴─────┐
        ▼           ▼
    [REJECT]    [APPROVE]
                    │
                    ▼
        [provider_finance_profiles row INSERT
         with status='pending', payout_status='locked']
                    │
                    ▼
        [Onboarding email sent to provider: "Complete your finance setup"]
                    │
                    ▼ (provider clicks link)
        [Client: /provider/finance-onboarding]
              │
              ├── Step 1: Choose business_type (עוסק פטור / עוסק מורשה / חברה / עמותה)
              ├── Step 2: Business details (legal_name, business_number, vat_number if required)
              ├── Step 3: Bank account (IBAN — encrypted client-side then transmitted)
              ├── Step 4: Invoice authorization (Hebrew consent — sign + checkbox)
              └── Step 5: Review + submit
                    │
                    ▼
        [PUT /api/provider/finance-profile/me]
                    │
                    ▼
        [Server validates per-business-type field matrix]
                    │
                    ├── Validation fail → return 400 + field errors
                    │
                    └── Validation pass
                            │
                            ▼
                  [UPDATE provider_finance_profiles
                   status='in_progress', authorization fields set]
                            │
                            ▼
                  [ENQUEUE SUMIT sync job (BullMQ or similar)]
                            │
                            ▼
                  [SumitMarketplaceClient.createSubBusiness(profile)
                   with external_reference=pw-pfp-{provider_id}-v1]
                            │
                            ├── 4xx error → status='failed', sumit_last_sync_error set, admin alerted
                            │
                            ├── Network error → exponential backoff, retry up to N times, then DLQ
                            │
                            └── 200 OK with sumit_sub_business_id
                                       │
                                       ▼
                            [UPDATE provider_finance_profiles
                             sumit_sub_business_id=...,
                             sumit_setup_status='ready' (or 'awaiting_kyc' if KYC async)]
                                       │
                                       ▼
                            [If status='ready':
                              UPDATE payout_status='enabled']
                                       │
                                       ▼
                            [Welcome email: "You can now receive bookings"]
                                       │
                                       ▼
                            [Provider's services become visible in marketplace search]
```

KYC async branch (if SUMIT returns 'pending_kyc'):
- Status stays `awaiting_kyc`. Payout stays `locked`.
- Wait for SUMIT webhook `business.kyc_completed` → flip to `ready` + `enabled`.
- Or `business.kyc_rejected` → flip to `suspended`, admin notified.

---

## §7 PAYMENT FLOW DIAGRAM (Deliverable 5)

### Phase A flow (Nayax remains charge processor, SUMIT issues documents)

```
[Customer books service in PetWash]
              │
              ▼
[BookingLifecycleService.create(bookingDraft)]
              │
              ▼
[Pricing calculated via sitterFeeCalculator
 base + 15% platform fee + 18% VAT on platform fee]
              │
              ▼
[NayaxOnlinePaymentService.charge(amountCents, idempotencyKey)]
              │
              ▼
[pw_payments row INSERT
 status='CREATED', vertical='sitter-suite', commercialModel='MARKETPLACE_COMMISSION']
              │
              ▼ (customer enters card on Nayax hosted page)
              ▼
[Nayax webhook → /api/nayax-webhook → status='AUTHORISED' then 'CAPTURED']
              │
              ▼
[Money sitting in PetWash escrow account]
              │
              ▼
[escrowHoldings row INSERT — status='held']
              │
              ▼
[Booking status: pending → confirmed]
              │
              ▼ (service performed)
              ▼
[Provider marks complete, customer confirms]
              │
              ▼
[Booking status: completed]
              │
              ▼
[72-hour escrow window starts (configurable per release policy)]
              │
              ▼ (after 72h, no disputes)
              │
              ▼
[EscrowStateMachine: held → ready_for_release]
              │
              ▼
[ProviderPayoutService.releaseEscrow(escrowId)]
              │
              ├──── 1. Issue provider's tax invoice (via SUMIT, as agent)
              │       SumitDocumentIssuer.createTaxInvoice({
              │         sub_business_id: provider.sumit_sub_business_id,
              │         customer: end_customer_petwash_user,
              │         amount: provider_share_cents,
              │         external_reference: pw-doc-{booking_id}-prov-inv-v1
              │       })
              │       → returns sumit_document_id
              │       → write to pw_provider_payouts.providerTaxInvoiceId
              │       → write sumit_document_links row
              │
              ├──── 2. Issue PetWash's commission invoice (PetWash → provider)
              │       SumitDocumentIssuer.createTaxInvoice({
              │         sub_business_id: NULL (PetWash master),
              │         customer: provider_as_sumit_customer,
              │         amount: commission_share_cents + vat_on_commission,
              │         external_reference: pw-doc-{booking_id}-comm-inv-v1
              │       })
              │       → returns sumit_document_id
              │       → write to pw_provider_payouts.commissionInvoiceId
              │
              ├──── 3. Calculate withholding tax (ניכוי מס במקור)
              │       Resolve from provider_tax_compliance:
              │         IF withholding_cert valid → use withholding_cert_rate
              │         ELSE use WITHHOLDING_RATE_POLICY.defaultRate (currently 0.20)
              │       payout_net_cents = provider_share_cents - withholding_amount_cents
              │
              ├──── 4. Bank transfer
              │       Phase A: manual (admin clicks "execute payout" → bank reads CSV)
              │       Phase B: automated via SUMIT UPay or bank API
              │
              └──── 5. Issue receipt (קבלה) to customer + email
                      SumitDocumentIssuer.createReceipt({...})
                      → write sumit_document_links row
```

### Edge cases
- **Refund**: Customer requests within 72h → issue credit note (זיכוי) via SUMIT, reverse `pw_payments` row, return funds via Nayax.
- **Chargeback**: Nayax webhook → mark `pw_payments` as REVERSED, issue credit note, deduct from provider's next payout, alert admin.
- **Dispute**: Booking marked `disputed` before escrow release → escrow held, admin reviews. Resolution: release to provider OR refund to customer, with appropriate documents.

---

## §8 WEBHOOK FLOW (Deliverable 6)

### Inbound (SUMIT → PetWash)

```
[SUMIT triggers event (document.created, payment.charged, business.kyc_completed, etc.)]
              │
              ▼
[POST /webhooks/sumit/events
 Headers: X-Sumit-Signature, X-Sumit-Event-Id]
              │
              ▼
[Express middleware: rate limit 100/min/IP]
              │
              ▼
[SumitWebhookHandler.handle(req)]
              │
              ├── Validate HMAC signature (constant-time compare via crypto.timingSafeEqual)
              │       Invalid → return 401, increment metric
              │
              ├── Check sumit_webhook_events for event_id (idempotency)
              │       Already processed → return 200 immediately
              │
              ├── INSERT sumit_webhook_events row (status=received)
              │
              ├── Return 202 Accepted immediately (SUMIT timeout protection)
              │
              ▼
[Background worker picks up event]
              │
              ├── Trigger router (switch on trigger_name):
              │     'document.created'      → DocumentEventHandler
              │     'payment.charged'       → PaymentEventHandler
              │     'payment.refunded'      → RefundEventHandler
              │     'business.kyc_completed' → KycCompletedHandler
              │     'business.kyc_rejected'  → KycRejectedHandler
              │     'recurring.charged'     → RecurringChargeHandler
              │     'recurring.failed'      → RecurringFailureHandler
              │     unknown                 → log + DLQ for review
              │
              ├── Handler runs in DB transaction
              │
              ├── On success: UPDATE sumit_webhook_events SET processed_at=NOW()
              │
              └── On failure:
                    INCREMENT retry_count
                    SET next_retry_at = NOW() + exponential_backoff
                    IF retry_count > MAX: SET dead_lettered_at = NOW(), alert admin
```

### Outbound (PetWash → SUMIT) — every API call follows this pattern

```
[Business code calls SumitMarketplaceClient.someMethod(args)]
              │
              ▼
[Generate idempotency external_reference]
              │
              ▼
[Wrap call with retry policy: 3 attempts, exponential backoff, jitter]
              │
              ├── 200 OK → return response
              │
              ├── 4xx (validation, auth) → no retry, return typed error
              │
              ├── 5xx → retry up to N times
              │
              ├── Timeout → retry
              │
              └── All retries exhausted → enqueue to retry queue, return failure to caller
```

---

## §9 PROVIDER ONBOARDING FLOW (Deliverable 7)

Already detailed in §6 sync flow. Adding mobile UX considerations here:

- **All steps mobile-first**, RTL, Hebrew default, English toggle
- **Step 4 (invoice authorization)** must show full legal text in Hebrew, scroll-to-bottom requirement before "I agree" enabled, signature pad (canvas) + checkbox, PDF generated server-side and stored with SHA-256 hash
- **iPhone Safari testing required** (per CEO standing rule — already in PetWash conventions)
- **No external redirect** for IBAN entry — capture in-app, encrypt client-side via Web Crypto API before transmission (defense in depth even with HTTPS)
- **Save-as-draft** at every step (provider may be interrupted, must be able to resume)
- **Locked banner** at top: "השלמת הרשמה פיננסית נדרשת לקבלת הזמנות" (Complete financial registration to receive bookings)

---

## §10 ERROR / RETRY ARCHITECTURE (Deliverable 8)

### Failure modes and responses

| Failure | Detection | Response |
|---|---|---|
| SUMIT API 5xx | HTTP status | Retry 3x with exponential backoff (1s, 4s, 16s) + jitter |
| SUMIT API 429 (rate limit) | HTTP status | Respect Retry-After header; if absent, back off 60s |
| SUMIT API 4xx (validation) | HTTP status | NO retry. Surface to user/admin. Log with redacted payload. |
| SUMIT API timeout | Custom timeout (5s default) | Retry as 5xx |
| Network error (DNS, connect refused) | Exception | Retry as 5xx |
| Webhook signature invalid | HMAC compare | 401, increment metric, alert if >10 in 5 min |
| Webhook handler throws | try/catch | Mark event for retry, exponential backoff up to N |
| Webhook handler retries exhausted | retry_count > MAX | Dead-letter, alert admin via Slack/email |
| Database commit failure during webhook | tx rollback | Re-enqueue webhook (it has not been marked processed) |
| Idempotency key collision | UNIQUE constraint | Return existing record (don't double-issue) |
| Provider's sumit_sub_business_id missing when payout requested | DB lookup | Block payout, alert admin, return "provider finance setup incomplete" |

### Backoff strategy
```typescript
// Generic exponential backoff with jitter
backoffMs(attempt: number) = min(MAX_BACKOFF, BASE * 2^attempt) + random(0, JITTER)
where BASE=1000ms, MAX_BACKOFF=300000ms (5 min), JITTER=500ms
```

### Dead letter queue
- A row in `sumit_webhook_events` with `dead_lettered_at IS NOT NULL` is in the DLQ
- Admin UI surface: `/admin/sumit/dead-letter-queue`
- Manual replay button (with confirm dialog)
- Daily Slack digest of new DLQ entries

---

## §11 SECURITY REVIEW (Deliverable 9)

### Secrets handling
| Secret | Storage | Access path |
|---|---|---|
| `SUMIT_API_KEY` | GCP Secret Manager | Injected to Cloud Run as env var. Lazy-read at first SUMIT call (NOT module-load). |
| `SUMIT_WEBHOOK_SECRET` | GCP Secret Manager | Same. Used only inside webhook handler. |
| `IBAN_ENCRYPTION_KEY` | GCP Secret Manager (versioned) | Lazy-read. Key version stored per encrypted row to support rotation. |
| `ID_NUMBER_ENCRYPTION_KEY` | GCP Secret Manager (versioned, NEW) | Same pattern. |
| `WALLET_LINK_SECRET` | GCP Secret Manager | **CURRENTLY READ AT MODULE LOAD — MUST BE FIXED (P0).** |

### Module-load env-var enforcement gate (CI, NEW)
Add to `petwash-ci.yml`:
```yaml
- name: Enforce lazy env-var checks
  run: |
    # Fail if any file in server/ has top-level "throw new Error" that depends on process.env
    npx ts-node scripts/check-no-module-load-env-throws.ts
```
Script greps for the pattern and excludes whitelisted files.

### Webhook signature
- HMAC-SHA256 over raw body + timestamp
- Constant-time compare (`crypto.timingSafeEqual`)
- Reject if timestamp drift > 5 minutes (replay protection)

### PCI-DSS scope
- PetWash MUST remain SAQ-A (no PAN handling)
- SUMIT hosted page or iframe for card entry → confirms with B8 answer
- No PAN in logs, ever (already enforced via `redactPAN` in `lib/redaction.ts`)

### Privacy
- ID numbers must be encrypted at rest (new requirement, P0)
- ID number hash for search (SHA-256 with per-installation salt)
- Bank IBAN already planned as encrypted
- Logs scrubbed via `redactPaymentPayload`

### Audit
- Every SUMIT API call: log with redacted args, timing, status, external_reference, trace_id
- Every webhook: full audit row in `sumit_webhook_events` (raw_payload retained for SUMIT support debugging)
- Every payout decision: row in payout_release_approvals + payout_audit_log

---

## §12 ROLLOUT PHASES (Deliverable 10)

### Phase 0 — Pre-flight (NOW, before any SUMIT code)
- [ ] Production restored (PR-STARTUP-FIX-2 or WALLET_LINK_SECRET set in GCP)
- [ ] CEO sends Hebrew SUMIT support email (B1–B8 + Q11–Q15)
- [ ] CPA engagement initiated for three pending policy switches
- [ ] Lawyer reviews Hebrew invoice authorization (כתב הרשאה) text
- [ ] VAT number `516788400` vs `517145033` reconciled with accountant
- [ ] Decision on which SUMIT plan tier we buy (driven by Q11–Q12 answers)

### Phase 1 — Foundation (PR-PFP-1 through PR-PFP-5, no SUMIT API yet)
- PR-PFP-1: provider_finance_profiles migration (schema only) — LOW risk, ADDITIVE
- PR-PFP-2: admin approval auto-creates pending row
- PR-PFP-3: provider GET/PUT endpoints with per-business-type validation
- PR-PFP-4: provider onboarding UI (5 steps, mobile-first, Hebrew RTL) including invoice authorization step
- PR-PFP-5: admin manual override (mark-ready) for pre-SUMIT-integration period

### Phase 2 — SUMIT integration (gated on B1–B8 answers)
- PR-PFP-6: SumitMarketplaceClient typed client + lazy env config
- PR-PFP-7: end-customer sync + document issuance (read-only first, then write)
- PR-PFP-8: multivendor charge integration (Phase B optional — only if SUMIT < Nayax cost AND CEO approves migration)
- PR-PFP-9: webhook handler (POST /webhooks/sumit/events) + sumit_webhook_events table

### Phase 3 — Gating & cleanup
- PR-PFP-10: backfill script (create pending rows for all existing approved providers, send onboarding emails)
- 14-day soak period with feature flag (provider payouts gate behind feature flag, monitor)
- PR-PFP-9 strict gate: ProviderPayoutService refuses payout if `payout_status != 'enabled'`
- PR-PFP-11: drop Stripe legacy columns

### Phase 4 — Migration & expansion (post-MVP)
- PR-PFP-12 (NEW): memberships cutover to SUMIT recurring (replace deprecated Stripe wiring)
- PR-PFP-13 (NEW): evaluate Apple Pay/Google Pay/Bit migration from Nayax → SUMIT (cost-driven)
- PR-PFP-14 (NEW): municipal/corporate B2B invoicing
- PR-PFP-15 (NEW): bulk prepaid wash package issuance via SUMIT recurring

### Independent P0 (parallel track)
- PR-STARTUP-HARDEN-1: WalletService lazy env check + CI gate against module-load env throws
- PR-PRIVACY-1: encrypt `users.idNumber` at rest (separate from SUMIT, but P0 compliance)

---

## §13 LEGAL / ACCOUNTING RISKS (Deliverable 11)

### Risk register

| # | Risk | Severity | Mitigation |
|---|---|---|---|
| L-1 | Issuing invoices in provider's name without signed consent → invalid legal document, potential criminal liability under Income Tax Ordinance §145 | CRITICAL | PR-PFP-4 invoice authorization step blocks payout until signed; legal text reviewed by lawyer |
| L-2 | Wrong AGENT_MODEL_POLICY (disclosed vs undisclosed) → VAT misreporting, potential ITA audit | HIGH | CPA must sign off before launch |
| L-3 | Wrong default withholding rate → underpayment to ITA, provider deducted too much | HIGH | CPA must sign off; certificate-driven override already implemented |
| L-4 | Osek Patur input-VAT reclaim error → over-remittance to ITA | MEDIUM | Conservative default (no reclaim) currently; CPA confirms |
| L-5 | VAT number mismatch (`516788400` vs `517145033`) → invoices issued under wrong tax ID, void | HIGH | Reconcile with accountant immediately |
| L-6 | SUMIT issues invoice in PetWash's name when it should be in provider's name (or vice versa) → tax authority audit, provider tax position broken | CRITICAL | Strict separation in code: `sub_business_id` parameter MUST be provider for provider-named invoices, MUST be NULL/master for PetWash commission invoices. Integration tests must verify. |
| L-7 | Plaintext ID number in `users.idNumber` → Privacy Protection Law §17 violation, ~₪320k fine + lawsuit exposure | HIGH | PR-PRIVACY-1 encrypt at rest |
| L-8 | Withholding cert expires (annual reset 31 Dec) without grace logic → over-withholding from provider | MEDIUM | Already handled in `resolveWithholdingRate(certExpiryDate)` helper. Verify in CPA review. |
| L-9 | SHAAM allocation number missing on invoice > threshold → ITA rejection of invoice, customer cannot deduct VAT | HIGH | SUMIT handles allocation # natively (confirmed by screenshot 3). Validate via integration test. |
| L-10 | Chargeback after invoice issued → invoice still exists in books, double accounting | MEDIUM | Credit note (זיכוי) issued via SUMIT on chargeback, reconciliation enforced |
| L-11 | Provider deletes account → outstanding invoices in provider's name need archival | MEDIUM | Soft-delete only for finance-active providers; full retention 7 years per ITA |
| L-12 | Clearing fee VAT (עמלת סליקה × 18%) treated as pass-through to provider → PetWash absorbs VAT loss | MEDIUM | Explicitly model in fee calculation; pass clearing+VAT as provider deduction OR absorb in commission |
| L-13 | Provider classified wrong business type (e.g. authorized when actually exempt) → wrong invoice format, wrong VAT | MEDIUM | F-B locked: business_type cannot default, must be explicit choice. Document upload optional but recommended. |
| L-14 | Cross-border transactions (tourist customer pays from foreign card) → currency conversion VAT complications | LOW | Out of MVP scope. ILS only for Phase 1-3. |

### Anti-pattern to avoid
**DO NOT** allow ANY code path to bypass `payout_status` check. ProviderPayoutService.releasePayout() must be the ONE function that releases money, and it must check `payout_status='enabled'` and `invoice_authorization_signed_at IS NOT NULL` before any side effect.

---

## §14 OPEN QUESTIONS FOR SUMIT SUPPORT (Deliverable 12)

### Confirmed open from PR #301
- B1. multivendorcharge split-payment in one API call?
- B2. KYC flow for sub-business creation (docs, timing, AML)?
- B3. Hosted/embedded onboarding UI (Stripe Connect-style)?
- B4. Webhook event catalog (especially finance events)?
- B5. Apple Pay/Google Pay/Bit in marketplace mode?
- B6. Operator-level settlement reporting?
- B7. Plan limits + pricing for ~200 providers / 5k txn/mo?
- B8. PCI-DSS SAQ-A confirmation when using SUMIT iframe?

### NEW from V2 screenshot analysis
- Q11. What counts as ONE "action" against the 400/month quota? (Each: invoice create, customer create, recurring charge, email, SMS, webhook?)
- Q12. In marketplace mode, does each sub-business have its OWN 400-action allowance, or shared across master?
- Q13. 3DS upcharge — per transaction or flat monthly?
- Q14. 1.1% baseline clearing rate — applies to all card types, or only debit/local? International/Amex/Premium rate?
- Q15. Merchant of record status — does SUMIT pass MoR to us, or remain MoR? (Chargeback liability + AML implications)

### NEW from accounting/legal analysis
- Q16. For invoices issued in provider's name via PetWash as agent — does SUMIT have a "issued by agent" mode that legally distinguishes from provider-issued? Or do we declare PetWash as "מוציא בשם" (issuer on behalf)?
- Q17. Withholding tax (ניכוי מס במקור) — does SUMIT auto-calculate from provider profile, or do we pre-calculate and pass the net amount?
- Q18. Form 856 (annual withholding report to ITA) — does SUMIT produce this for the operator, or do we need to consolidate?
- Q19. For עוסק פטור provider, can SUMIT issue a "receipt only" document (קבלה, not חשבונית מס)? עוסק פטור legally cannot issue tax invoices.
- Q20. Can a single SUMIT plan host multiple sub-businesses, OR does each sub-business need its own plan/billing? (Cost driver)
- Q21. For commission invoices (PetWash → provider), is the provider classified as "ספק" (supplier) or "לקוח" (customer) in SUMIT's terminology?
- Q22. Sandbox environment — URL, credentials process, are sandbox invoices issued to a real ITA test endpoint, or fully isolated?
- Q23. SUMIT API uptime SLA + scheduled maintenance windows?

### Updated Hebrew email (replaces PR #301 §3, NEW DRAFT — to be sent by CEO)
[Provided in §28 as ready-to-paste text]

---

## §15 WHAT STAYS IN PETWASH (Deliverable 13)

Source of truth, owned exclusively by PetWash:
- **Users** (`users` table, Firebase auth)
- **Providers** (`providers`, `provider_applications`, `provider_intake_queue`)
- **Provider tax classification** (`provider_tax_compliance` — pre-existing)
- **Bookings** (`bookings`, `sitterBookings`, `walkBookings`, `trainerBookings`)
- **Booking lifecycle state machine** (BookingLifecycleService)
- **Escrow holds** (`escrowHoldings`, EscrowStateMachine — 72h default)
- **Wallets** (`walletAccounts`, `creditTransactions`, `walletLedgerEntries`, `walletHolds`)
- **Loyalty** (`loyaltyProfiles`, `pointsTransactions`, `badges`, `userBadges`, `dailyChallenges`, `referrals`)
- **Memberships** (`memberships` — though billing will migrate to SUMIT recurring in Phase 4)
- **Disputes, reviews, ratings**
- **Marketplace search, matching, pricing rules** (sitterFeeCalculator, etc.)
- **Promotions, gift codes** (issuance side — SUMIT does the financial document)
- **Apple/Google Wallet pass issuance** (Prestige cards)
- **All UI/UX**

---

## §16 WHAT MOVES TO SUMIT (Deliverable 14)

SUMIT owns:
- **Official invoice numbering** (per Israeli ITA monotonic per type per year)
- **SHAAM allocation number** for invoices > threshold
- **VAT calculation** (18% Israeli rate, per-line, per-customer)
- **Official PDF rendering** (with all required ITA fields including company info, allocation #, signature line)
- **Tax document books** (יומן הנהלת חשבונות) — SUMIT carries certified accounting software status 00215702 per PR #301
- **Recurring billing engine** (for memberships, Phase 4)
- **Apple Pay / Google Pay / Bit clearing** (Phase B if cost-justified)
- **Customer payment method storage** (cards on file, tokenized, never seen by PetWash)
- **Bank account verification** for providers (uses SUMIT's bank verification module)
- **End-of-month accountant export** (accountant accesses SUMIT directly with provider firm linkage per Q4 in original email)

PetWash CALLS SUMIT for:
- Customer creation/update (mirror PetWash users → SUMIT customers)
- Sub-business creation (provider → SUMIT sub-business)
- Document creation (invoices, receipts, credit notes)
- Payment charging (Phase B, marketplace mode)
- Recurring setup (Phase 4)

PetWash CONSUMES from SUMIT:
- Document IDs (write back to `sumit_document_links` + `pw_provider_payouts.providerTaxInvoiceId/commissionInvoiceId`)
- PDF URLs (mirror to Google Drive for backup)
- Webhook events (everything goes through `sumit_webhook_events`)
- Bank verification status

---

## §17 PRODUCTION DEPLOYMENT PLAN (Deliverable 15)

### Pre-deployment checklist (per PR)
- [ ] Lazy env-var checks (no module-load throws — enforced by CI gate)
- [ ] Idempotency keys on all SUMIT writes
- [ ] Integration tests against SUMIT sandbox (after B22 answers)
- [ ] Feature flag for new code paths (default OFF)
- [ ] Migration is additive (no destructive DDL on existing tables)
- [ ] Rollback plan documented in PR description

### Cloud Run deployment
- Existing pipeline: GitHub Actions builds image → pushes to Artifact Registry → Cloud Run deploys new revision → traffic shift to latest
- After today's lesson: traffic-shift step needs concurrency group to prevent version conflicts
- Health endpoint already has serverReady/routesReady/startupPhase from PR #314+#315

### Migration ordering
1. Schema-only migrations first (additive, reversible)
2. Backend code (with new endpoints behind feature flag)
3. Frontend code (calls new endpoints when flag enabled per user)
4. Backfill scripts (low-traffic window)
5. Feature flag flip to ON (per-segment rollout: internal first, then beta providers, then all)
6. Cleanup migrations (drop deprecated columns) — only after weeks of stability

---

## §18 CLOUD RUN SECRET SETUP (Deliverable 16)

### Secrets to add to GCP Secret Manager
| Secret name | Value source | Versioned | Notes |
|---|---|---|---|
| `SUMIT_API_KEY` | SUMIT admin panel | yes | Rotate quarterly |
| `SUMIT_WEBHOOK_SECRET` | SUMIT admin panel | yes | Used only in webhook handler |
| `SUMIT_COMPANY_ID` | SUMIT account | no | PetWash master company ID |
| `SUMIT_TERMINAL_ID` | SUMIT account | no | For UPay if used |
| `SUMIT_API_BASE_URL` | Constant `https://api.sumit.co.il` (or sandbox URL) | no | Env-driven for sandbox swap |
| `SUMIT_APP_NAME` | Constant `PetWash` | no | For audit trails |
| `IBAN_ENCRYPTION_KEY` | Generate via `openssl rand -base64 32` | yes | For provider bank IBAN |
| `ID_NUMBER_ENCRYPTION_KEY` | Generate via `openssl rand -base64 32` | yes | For users.idNumber |
| `INVOICE_AUTHORIZATION_VERSION` | Constant string `v1` | no | Track which consent version was signed |

### Cloud Run service env var bindings
- All secrets injected as env vars at container start
- NO secrets fetched at runtime from Secret Manager (avoids latency + cost)
- Secret versions pinned (use `:latest` only for ops convenience, prefer pinned for prod)
- IAM: Cloud Run service account has `Secret Manager Secret Accessor` role on specific secrets only (least privilege)

### Secret rotation flow
- `SUMIT_API_KEY` rotation: create new version in SUMIT → add to Secret Manager → cut traffic via env var swap (Cloud Run revision) → revoke old in SUMIT after 24h
- `IBAN_ENCRYPTION_KEY` rotation: create new version → mark old as "decrypt-only" → background job re-encrypts rows from old → new (writing `key_version` column) → old key revoked after all rows migrated

---

## §19 CI/CD CONSIDERATIONS (Deliverable 17)

### New CI gates to add
- [ ] **Module-load env throw gate** — fails build if any server/ file does top-level `process.env.X || throw`
- [ ] **TSC error count gate** — fails if tsc error count > base branch (would have caught PR #197 in May)
- [ ] **Routes smoke test** — `node -e "require('./server/routes')"` runs in CI, fails in <100ms if module-load throw exists
- [ ] **Migration linter** — fails if migration is destructive (DROP COLUMN, DROP TABLE) without `-- INTENT: destructive` comment
- [ ] **SUMIT integration tests gate** — runs against SUMIT sandbox on every PR touching `server/services/sumit/**`
- [ ] **PII/PAN log scan** — fails if any new log statement contains regex matching credit card or ID number patterns
- [ ] **Hebrew text encoding check** — ensures all Hebrew strings use proper UTF-8 with BiDi marks where required

### Existing pipeline (do not change)
- Build → test → deploy candidate → traffic shift to latest

### NEW: deploy workflow concurrency group
Add to deploy workflow:
```yaml
concurrency:
  group: production-deploy
  cancel-in-progress: false
```
Prevents the version-conflict race that hit today.

---

## §20 MONITORING / LOGGING STRATEGY (Deliverable 18)

### Metrics (Cloud Monitoring / Datadog / equivalent)
- `sumit.api.requests` (counter, tagged by endpoint, status_code)
- `sumit.api.latency` (histogram, tagged by endpoint)
- `sumit.api.errors` (counter, tagged by endpoint, error_type)
- `sumit.webhook.received` (counter, tagged by trigger_name, signature_valid)
- `sumit.webhook.processing_latency` (histogram)
- `sumit.webhook.dead_lettered` (counter, alert on >0 in 1h)
- `sumit.quota.actions_consumed_daily` (gauge, alert at 80% of 400/day for monthly tracking)
- `sumit.quota.cost_projected_monthly` (gauge, alert if >₪500/mo)
- `sumit.sync.provider_setup_failures` (counter, alert on >5 in 1h)
- `sumit.document.issuance_failures` (counter, alert on any)

### Logs (structured JSON, all SUMIT-related lines prefixed `[sumit]`)
- Every SUMIT API call: `{endpoint, method, status, latency_ms, external_reference, trace_id}` (NO request body — could contain customer PII)
- Every webhook: row in `sumit_webhook_events` IS the log (no separate log line needed)
- Every document issuance: `{document_type, sumit_document_id, booking_id, payout_id, amount_cents}` (no PII)

### Alerts
| Alert | Threshold | Channel |
|---|---|---|
| Webhook signature invalid > 10/5min | 10 | PagerDuty (potential attack) |
| Dead letter queue depth > 0 | 1 | Slack #ops |
| SUMIT API error rate > 5% in 5min | 5% | Slack #ops |
| Provider sync failure | any | Slack #ops |
| Document issuance failure on payout path | any | PagerDuty (money at risk) |
| Daily action count > 80% of plan | 80% | Slack #finance |
| Monthly cost projection > ₪500 | ₪500 | Slack #finance |

---

## §21 RECONCILIATION STRATEGY (Deliverable 19)

### Three-way reconciliation
Every day, automated job compares:
1. **PetWash internal ledger** (`pw_payments` + `pw_provider_payouts`)
2. **SUMIT documents** (`sumit_document_links` mirrored from SUMIT)
3. **Nayax transaction reports** (`nayax_transactions`)

### Discrepancy types
- **Type A**: PetWash payment without SUMIT document → SUMIT issuance failed silently or webhook missed
- **Type B**: SUMIT document without PetWash payment → orphan invoice (data corruption?)
- **Type C**: Nayax charge without PetWash payment → webhook delivery failure
- **Type D**: Amount mismatch (PetWash vs SUMIT) → calculation bug

Each discrepancy creates row in `pwReconciliationReports.discrepancyCount` + `criticalIssues` JSON field.

### Daily reconciliation report
- Runs at 02:00 IST (low traffic)
- Compares previous 24h activity
- Outputs to `pwReconciliationReports` table
- Email to admin + finance team if `criticalIssues > 0`
- Backup snapshot to Google Drive (already supported in current code)

### Manual reconciliation (admin)
- Admin UI: `/admin/finance/reconciliation`
- Filters: date range, vertical, provider
- Side-by-side view: PetWash record | SUMIT document | Nayax txn
- Action buttons: "Replay webhook", "Manual document issuance", "Mark resolved with note"

---

## §22 DISASTER RECOVERY (Deliverable 20)

### Data backups
- **Postgres**: GCP Cloud SQL automated daily backups, 30-day retention, 7-day PITR
- **SUMIT documents**: PDF + metadata mirrored to Google Drive (`pw_tax_documents.driveFileId` already in schema)
- **Webhook events**: append-only table, retained 7 years per ITA
- **Reconciliation reports**: integrity hash chain (`integrityHash`, `prevReportHash`)

### SUMIT outage
- **Read failures (fetch PDF, customer lookup)**: degrade gracefully — show "document available shortly" in UI, retry in background
- **Write failures (document issuance)**: queue in BullMQ (or DB-backed work queue), retry until success or 7-day TTL, alert admin if TTL exceeded
- **Webhook failures from SUMIT side**: poll `sumit_webhook_events` for stale records, reconcile via `/billing/payments/list` API

### Catastrophic failure (SUMIT entirely down >24h)
- Switch payout pipeline to "manual mode": admin downloads CSV of pending payouts, issues invoices via SUMIT admin panel manually after recovery
- Customer-facing: continue to accept bookings, queue document issuance for SUMIT recovery
- No customer should ever see "system unavailable" — degradation is internal

### Data integrity
- All SUMIT API responses cached in `sumit_document_links.raw_response` (JSONB) for forensic replay
- Webhook payloads retained in `sumit_webhook_events.raw_payload`
- 7-year retention enforced by `retentionUntil` columns (already in schema)
- Annual integrity audit: random sample of 100 documents, compare PetWash → SUMIT → Google Drive backup → confirm SHA256 match

---

## §23 COST MODEL (NEW)

### Cost components

```
COST_MONTHLY = SUMIT_PLAN_BASE
             + ACTION_OVERAGE × 0.25
             + CARD_VOLUME × CLEARING_RATE
             + 3DS_FEE × TRANSACTION_COUNT (if applicable)
             + SMS_FEE × SMS_COUNT (we use Twilio, exclude)
             + EMAIL_FEE × EMAIL_COUNT (we use SendGrid, exclude)
```

### Action quota math (CRITICAL — depends on Q11, Q12 answers)

Assuming WORST CASE (Q11 = "every API call counts", Q12 = "shared across all sub-businesses"):
- 1 booking = 1 customer create (if new) + 1 invoice create + 1 receipt create + 1 commission invoice create + 1 webhook out = ~5 actions
- 10,000 bookings/month = 50,000 actions
- Free actions: 400
- Overage: 49,600 × ₪0.25 = **₪12,400/month**

Assuming BEST CASE (Q11 = "only invoice counts", Q12 = "per sub-business"):
- 1 booking = 2 invoices = 2 actions
- 10,000 bookings/month / 200 providers = 50 actions/provider/month (well within 400 each)
- **₪0 overage**

**Reality probably in between. Must clarify with SUMIT before signing plan.**

### Card clearing math
- 1.1% baseline (debit/local) per screenshot
- Realistic blended rate ~2.0–2.5% (mix of card types, international, Amex premium)
- 10,000 bookings × avg ₪200 = ₪2M monthly volume
- 2.0% blended clearing = **₪40,000/month in fees**
- Currently absorbed by Nayax (presumably similar rate); SUMIT competitive only if Apple Pay/Google Pay rates are significantly better

### 3DS clearing
- Required for chargeback liability shift
- Per-transaction upcharge (Q13 to confirm)
- Estimate: +0.2% per transaction = **₪4,000/month additional**

### Total projected monthly SUMIT cost (mid-case)
- Base plan: ₪99
- Action overage (50% worst case): ₪6,200
- Clearing (Phase B, if migrated): ₪40,000
- 3DS: ₪4,000
- **TOTAL: ~₪50,000/month**

### Cost-saving levers
1. **Memberships in SUMIT recurring** — saves Stripe replacement cost
2. **Loyalty stays in PetWash** — every loyalty action would be an extra SUMIT action; keeping internal saves ₪X/year
3. **Email/SMS NOT in SUMIT** — we use SendGrid/Twilio at lower rates
4. **Selective marketplace migration** — only move payment methods where SUMIT is cheaper than Nayax (need real numbers)

---

## §24 CPA ENGAGEMENT SCOPE (NEW)

### Three policy switches requiring CPA sign-off
1. **AGENT_MODEL_POLICY**: disclosed vs undisclosed
   - Recommendation: `disclosed` (Wolt/Uber model, per CEO direction)
   - CPA must confirm Israeli tax law alignment for marketplace agent model
   - Impact: changes who issues invoices, how VAT is reported

2. **OSEK_PATUR_VAT_POLICY**: input-VAT reclaim from Osek Patur providers
   - Current default: cannot reclaim (conservative, may over-remit)
   - CPA must confirm correct treatment per ITA position
   - Impact: VAT remittance amount

3. **WITHHOLDING_RATE_POLICY**: default rate when provider has no Form 2542 cert
   - Current default: 20% (per Income Tax Ordinance §164)
   - Could be 25% or 30% depending on provider classification (subcontractor vs other)
   - CPA must confirm category for "marketplace service provider"
   - Impact: withholding amount per payout

### Additional CPA review items (NEW from V2)
- Reconcile VAT number `516788400` (in `pw_tax_documents` default) vs `517145033` (in `israel-compliance-config.ts`). Which is the live ח.פ?
- Confirm agent disclosure consent text (Hebrew invoice authorization) meets ITA legal requirements
- Review provider tax classification matrix (per-business-type field requirements)
- Confirm 7-year retention is sufficient for all document types (some categories require 10 years)
- Annual Form 856 (withholding report) — produced by SUMIT or compiled by us?

### CPA brief document (to produce)
`docs/SUMIT_CPA_ENGAGEMENT_BRIEF.md` — single document for the CPA covering:
- Architecture summary (one page)
- Three policy switch options + recommendation + impact
- VAT number reconciliation request
- Withholding flow diagram
- Sample invoice (PetWash agent issuing in provider's name)
- Reference to relevant ITA circulars

---

## §25 OPEN QUESTIONS INDEX

See §14 for the full ordered list. Grouped by responsible party:

**SUMIT support email (B1–B8 + Q11–Q23):** 23 questions total. Send today.

**CPA (3 policy switches + 5 V2 items):** 8 items. Engage this week.

**Lawyer (1 item):** Review Hebrew invoice authorization text + Israeli platform agent model legality. Engage in parallel with CPA.

**Accountant (1 item):** VAT number reconciliation. Single-question email.

**SUMIT account team (2 items):** Q20 (multi-sub-business plan), Q23 (SLA). Sales rep, not support.

---

## §26 ROADMAP ADJUSTMENT

### Original PR #312 roadmap (status updated)
| PR | Description | Risk | Status | V2 changes |
|---|---|---|---|---|
| PR-PFP-1 | provider_finance_profiles migration | LOW | Not started | +3 columns (invoice_authorization_*) |
| PR-PFP-2 | Admin approval creates pending row | LOW | Not started | No changes |
| PR-PFP-3 | Provider form GET/PUT endpoints | MEDIUM | Not started | No changes |
| PR-PFP-4 | Provider onboarding UI | MEDIUM | Not started | +1 step: invoice authorization |
| PR-PFP-5 | Admin manual override | LOW | Not started | No changes |
| PR-PFP-6 | SumitMarketplaceClient | MEDIUM | Blocked on B1–B8 | Add lazy env config pattern |
| PR-PFP-7 | Sub-business create + document issuance | MEDIUM | Blocked on B1–B8 | Split into PR-PFP-7a (customer sync) + PR-PFP-7b (document issuance) |
| PR-PFP-8 | Webhook handler | MEDIUM | Blocked on B4 | Renumber: this is now PR-PFP-9 |
| PR-PFP-9 | Payout gating (strict) | HIGH | Blocked on PFP-3,4,7 | Renumber: now PR-PFP-10 |
| PR-PFP-10 | Backfill script | MEDIUM | Blocked on PFP-1 | Renumber: now PR-PFP-11 |
| PR-PFP-11 | Drop Stripe legacy | MEDIUM | Last in sequence | Renumber: now PR-PFP-12 |

### NEW additions
| PR | Description | Risk | When |
|---|---|---|---|
| PR-STARTUP-HARDEN-1 | WalletService lazy + CI module-load gate | LOW | NOW (independent of SUMIT) |
| PR-PRIVACY-1 | Encrypt users.idNumber at rest | MEDIUM | NOW (independent of SUMIT) |
| PR-PFP-8 (renumbered) | Multivendor charge integration | HIGH | Phase B, after cost analysis |
| PR-PFP-13 | Memberships cutover to SUMIT recurring | HIGH | Phase 4, after Stripe schema cleanup |
| PR-PFP-14 | Apple Pay/Google Pay/Bit migration evaluation | MEDIUM | Phase 4 |
| PR-PFP-15 | Municipal/corporate B2B invoicing | MEDIUM | Phase 4+ |
| PR-PFP-16 | Bulk prepaid wash package recurring | MEDIUM | Phase 4+ |

### Critical sequencing rules (DO NOT VIOLATE)
- PR-PFP-1 must merge before PR-PFP-2
- PR-PFP-4 (invoice authorization UI) must merge before PR-PFP-10 (payout gating) goes strict
- PR-PFP-7b (document issuance) must merge before any PetWash code is allowed to invoke `ProviderPayoutService.releaseEscrow` in production
- PR-PFP-12 (Stripe cleanup) must be last; only after all other code has been migrated off Stripe schema fields
- CPA sign-off MUST land before PR-PFP-7b goes live (policy switches affect document content)

---

## §27 P0 RISK REGISTER (NEW)

| Risk | Source | Impact | Mitigation | Owner |
|---|---|---|---|---|
| WalletService env throw at module load | Code audit | Production crash (already happened, 8 days) | PR-STARTUP-FIX-2 lazy check + CI gate | Claude / CEO approval |
| AppleWalletService same pattern (lazy throw — safer) | Code audit | Apple Wallet provisioning fails (not full outage) | Same lazy pattern | Claude |
| Plaintext ID numbers in users.idNumber | Code audit | Privacy Protection Law §17 violation, ₪320k fine + lawsuit exposure | PR-PRIVACY-1 encrypt at rest + hash for search | Claude / CEO approval |
| VAT number mismatch (516788400 vs 517145033) | Code audit | Invoices issued under wrong tax ID, ITA audit risk | Reconcile with accountant immediately | CEO + accountant |
| Three policy switches pending CPA | israel-compliance-config.ts | Possible over-remittance of VAT, wrong withholding | CPA engagement | CEO |
| Deploy workflow race condition | Today's incident | Failed deploys, version conflict errors | Add concurrency group | Claude |
| No CI gate on tsc errors | PR #197 history | Future regressions ship to prod | Add tsc error count gate | Claude |
| No CI gate on module-load env throws | Today's incident | Future PRs can re-introduce class of bug | Add CI script | Claude |
| Path E scope unclear (Nayax vs SUMIT for online charging) | V2 analysis | Architecture indecision blocks PR-PFP-8 | Phase plan in §17 | CEO + cost data |

---

## §28 CEO APPROVAL CHECKLIST

Please confirm (sign or initial each):

### Architecture decisions
- [ ] Phase A: Nayax remains online charge processor; SUMIT issues documents only. Phase B (SUMIT clearing) deferred to cost analysis.
- [ ] AGENT_MODEL_POLICY flips to `disclosed` (Wolt/Uber model). PetWash issues invoices in provider's name with consent. (Subject to CPA confirmation.)
- [ ] Provider must sign Hebrew invoice authorization (כתב הרשאה) before payout_status can = enabled
- [ ] `provider_tax_compliance` and `provider_finance_profiles` coexist (do not merge)
- [ ] Loyalty stays internal to PetWash (not in SUMIT)
- [ ] Memberships migrate Stripe → SUMIT recurring in Phase 4

### Open questions
- [ ] CEO sends Hebrew SUMIT support email today (B1–B8 + Q11–Q23, 23 questions)
- [ ] CEO engages CPA this week for three policy switches + V2 items
- [ ] CEO engages lawyer this week for invoice authorization text + agent model legality
- [ ] CEO confirms with accountant: VAT number `516788400` or `517145033`?

### NEW P0 items (independent of SUMIT)
- [ ] Approve PR-STARTUP-HARDEN-1 (lazy env checks + CI gate)
- [ ] Approve PR-PRIVACY-1 (encrypt users.idNumber)

### V2 doc approval
- [ ] Approve this V2 document, commit to repo via PR (no code, doc-only)
- [ ] OR request specific changes (list them)

---

## §29 APPENDIX — REFERENCES

### Documents in this repo
- `docs/SUMIT_CAPABILITIES_AUDIT.md` (PR #301)
- `docs/PROVIDER_FINANCE_SUMIT_INTEGRATION_AUDIT.md` (PR #312)
- `docs/INFRASTRUCTURE_AUDIT_2026_05_17.md` (PR #313, F-1 through F-5)
- `docs/PAYMENT_ARCHITECTURE.md` (2025-11-02, NEEDS REFRESH — superseded by V2)
- `docs/JOB_DISPATCH_PAYMENT_FIXES_2025-11-11.md`
- `docs/finance/00-platform-role-model.md`
- `docs/finance/02-money-object-model.md`
- `docs/finance/sumit-upay-operating-model.md`
- `docs/finance/sumit-upay-vendor-discovery-and-rail-architecture.md`
- `docs/finance/transaction-lifecycle-forensic-audit.md`
- `docs/finance/finance-review-blind-spots-and-authority-questions.md`
- `shared/israel-compliance-config.ts`

### Code files referenced
- `server/services/WalletService.ts:18-19` (P0 module-load throw)
- `server/services/AppleWalletService.ts:58-59` (lazy throw)
- `server/services/sitterFeeCalculator.ts` (15% commission, 18% VAT)
- `server/lib/redaction.ts` (PAN/email/phone redaction, VAT export formatting)
- `server/services/NayaxOnlinePaymentService.ts`
- `server/services/NayaxSitterMarketplaceService.ts`
- `server/services/NayaxWalkMarketplaceService.ts`
- `server/services/ProviderPayoutService.ts`
- `server/services/EscrowService.ts` + `EscrowStateMachine.ts`
- `server/services/TaxDocumentService.ts`
- `server/services/IsraeliInvoiceGenerator.ts`
- `server/lib/payment-provider-mode.ts` (env validation pattern — good reference for lazy checks)

### Schema files referenced
- `shared/schema.ts` (main schema)
- `shared/schema-payments.ts` (pw_payments, pw_provider_payouts, pw_tax_documents)
- `shared/schema-billing.ts` (billingRecords)
- `shared/schema-loyalty.ts` (loyaltyProfiles, points, badges, challenges, referrals)

### External
- SUMIT API documentation (URL TBD from CEO)
- Israeli Income Tax Ordinance §164 (withholding tax rates)
- Israeli VAT Law (חוק מע״מ תשל״ו-1975)
- Privacy Protection Law (חוק הגנת הפרטיות תשמ״א-1981) §17
- ITA Electronic Invoice Law (חוק חשבונית דיגיטלית) thresholds

---

**END OF V2 ARCHITECTURE DOCUMENT.**

Total length: ~10,000 words. Density over prose. Ready for CEO review.

Next steps after CEO approval:
1. CEO sends 23-question SUMIT email
2. CEO engages CPA + lawyer + accountant
3. Production restored (PR-STARTUP-FIX-2 or env var fix)
4. PR-STARTUP-HARDEN-1 + PR-PRIVACY-1 ship in parallel (independent of SUMIT)
5. When SUMIT answers return: PR-PFP-1 through PR-PFP-5 ship (foundation)
6. When CPA signs off: PR-PFP-6 through PR-PFP-12 ship (real integration)
