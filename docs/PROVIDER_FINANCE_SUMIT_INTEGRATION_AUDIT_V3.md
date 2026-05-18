# SUMIT INTEGRATION — V3 START PLAN

**Document status:** START PLAN for CEO review. Committed on `claude/sumit-support-email-Xv7Tn`. NOT a PR. No code yet.
**Companion to:** V2 (PROVIDER_FINANCE_SUMIT_INTEGRATION_AUDIT_V2.md)
**Date:** 2026-05-18
**Author:** Claude Code (Opus 4.7)
**Why V3:** CEO instruction — stop deliberating, finalize the 10 focus areas, produce an actionable start plan. Skip videos, work with what we have.

---

## §0 EXECUTIVE — THE 10-POINT START PLAN

Each numbered item below is **ready to execute** after the listed prerequisite clears. No further deliberation needed on the architecture; only CEO sign-offs + external answers.

```
LANE 1 — INDEPENDENT P0 (NO SUMIT DEPENDENCY, START NOW)
  ☐ 0.1  Restore production       — PR-STARTUP-FIX-2 (wallet lazy check)  | needs: "Go 2"
  ☐ 0.2  Encrypt users.idNumber   — PR-PRIVACY-1                          | needs: "Go privacy"
  ☐ 0.3  CI startup-hardening     — PR-STARTUP-HARDEN-1                   | needs: "Go startup-harden"
  ☐ 0.4  Reconcile VAT number     — accountant: 516788400 vs 517145033?   | needs: you ask accountant

LANE 2 — KICKOFF PARALLEL TRACKS (NO CODE, CLOCK IS TICKING)
  ☐ 0.5  Send 23-question SUMIT support email      | needs: "Paste email"
  ☐ 0.6  Engage CPA (3 policy switches + V2 items) | needs: "CPA brief"
  ☐ 0.7  Engage lawyer (invoice authorization text + agent model)  | needs: lawyer contact

LANE 3 — FOUNDATION (NO SUMIT API CALLS YET — SAFE TO START)
  ☐ 0.8  PR-PFP-1: provider_finance_profiles migration              | needs: V3 approval
  ☐ 0.9  PR-PFP-2: admin approval auto-creates pending row          | depends 0.8
  ☐ 0.10 PR-PFP-3+4: onboarding API + UI (incl. invoice auth step)  | depends 0.8, lawyer text from 0.7

LANE 4 — SUMIT INTEGRATION (BLOCKED ON 0.5 ANSWERS)
  ☐ 0.11 PR-PFP-6: SumitMarketplaceClient typed client              | depends 0.5 answers B1-B8
  ☐ 0.12 PR-PFP-7a/b: customer sync + document issuance             | depends 0.11
  ☐ 0.13 PR-PFP-9: webhook handler                                  | depends 0.5 answer B4
  ☐ 0.14 PR-PFP-10: payout gating (strict, behind feature flag)     | depends ALL above + CPA sign-off
```

**Earliest production-impacting code can ship:** Lane 1 items, immediately on your Go.
**Earliest SUMIT-touching code:** ~10-14 days, gated on SUMIT support answers + CPA sign-off.

---

## §1 FOCUS AREA — CLEAN MARKETPLACE ARCHITECTURE

### Decision: Three-tier, agent-disclosed model

**TIER 1 — PetWash (Source of Truth)**
Owns: users, providers, bookings, escrow, wallets, loyalty, memberships, marketplace state, payment orchestration (which gateway to call when), pricing, fee splits.

**TIER 2A — Nayax (existing, keep)**
Card clearing for K9000 (kiosks) AND online marketplace (via existing NayaxOnlinePaymentService, NayaxSitterMarketplaceService, NayaxWalkMarketplaceService, NayaxJobDispatchPaymentService). Webhooks already wired at `/api/nayax-webhook`.

**TIER 2B — SUMIT (NEW)**
Financial system of record: invoices, receipts, tax-invoice-receipts, credit notes, customer/sub-business management, recurring billing, accounting books, VAT calculation + allocation numbers (SHAAM).

Optional Phase B: SUMIT also takes over Apple Pay / Google Pay / Bit clearing (these are included in SUMIT base plan, may save cost vs Nayax for those payment methods).

**TIER 3 — Google Drive/Sheets (existing, keep)**
Backup ONLY. PDF archival of SUMIT-generated documents. Accountant read-only view. No business logic.

### Code-level architecture rule
ONE function gate on payouts: `ProviderPayoutService.releasePayout()` must check `provider_finance_profiles.payout_status === 'enabled'` AND `invoice_authorization_signed_at IS NOT NULL` before any side effect. ANY code path that bypasses this is a P0 bug.

### Multi-business support
SUMIT's `/website/companies/create/` confirmed via help center search. Each provider in PetWash gets one `sumit_sub_business_id` on initial setup. Edge cases:
- **Provider has 2 separate legal entities** (e.g. one עוסק פטור side-business + one חברה בע״מ): TWO `provider_finance_profiles` rows (one per legal entity), each linked to one SUMIT sub-business. PetWash UI must let provider choose which legal entity per booking.
- **Provider partnership (2 individuals jointly operating)**: one legal entity = one profile = one sub-business. Internal split is PetWash's problem (revenue-share rules outside this scope).
- **Nonprofit (עמותה) with multiple programs**: one entity = one sub-business. Programs differentiated by SUMIT product/service catalog, not sub-business.

---

## §2 FOCUS AREA — PROVIDER ONBOARDING FLOW

### End-to-end flow (refined from V2 §6, §9)

```
[1] Provider applies via existing /provider-application form
        │
[2] Admin reviews in /admin/provider-review
        │
[3] APPROVE → SERVER:
      • INSERT into provider_finance_profiles (status='pending', payout_status='locked')
      • Generate one-time onboarding link with signed token (24h expiry, single-use)
      • Send email: subject "השלם הגדרות פיננסיות לקבלת הזמנות"
        │
[4] Provider clicks link → /provider/finance-onboarding/{token}
        │
[5] Multi-step Hebrew RTL flow (mobile-first, iPhone Safari verified):
      STEP 1: Choose business type
              ○ עוסק פטור   ○ עוסק מורשה   ○ חברה בע״מ   ○ עמותה
              (no default — explicit choice per F-B locked decision)
        │
      STEP 2: Business details (conditional by type)
              עוסק פטור:     business_number, legal_name_he, phone, invoice_email
              עוסק מורשה:    + vat_number, registered_address
              חברה בע״מ:     + vat_number, registered_address (auto-suffix " בע״מ" to name)
              עמותה:        + (varies, vat_number optional, auto-suffix " (ע״ר)")
              All include: optional business logo upload (deferred to Phase 2 per F-E)
        │
      STEP 3: Bank account
              IBAN format validation (Israeli IBAN regex)
              Encrypt client-side via Web Crypto API → transmit ciphertext
              Server stores in bank_account_iban_encrypted (BYTEA)
              Bank verification call to SUMIT /accounting/general/verifybankaccount/
        │
      STEP 4: Invoice authorization (CRITICAL — NEW)
              Full Hebrew legal text scrollable (forces scroll-to-bottom)
              Signature pad (HTML5 canvas) + checkbox "אני מאשר ומסכים"
              Server generates PDF of signed authorization, stores SHA-256
              Lawyer-reviewed text version stored as invoice_authorization_version
        │
      STEP 5: Review + submit
              Summary of all entered data
              Final "אשר ושלח" button
        │
[6] Server validates per-business-type field matrix → 200 OK
        │
[7] UPDATE provider_finance_profiles: status='in_progress'
        │
[8] ENQUEUE SUMIT sync job (BullMQ or DB-backed work queue)
        │
[9] Async worker:
      SumitMarketplaceClient.createSubBusiness(profile, external_reference)
        │
      ┌── 4xx validation error: status='failed', alert admin, email provider
      ├── 5xx/timeout: exponential backoff (1s, 4s, 16s), then DLQ
      └── 200 with sumit_sub_business_id:
            UPDATE profile: sumit_sub_business_id=..., sumit_setup_status='ready' OR 'awaiting_kyc'
        │
[10] If KYC async (SUMIT returns 'awaiting_kyc'):
      Status stays awaiting_kyc, payout_status stays locked
      Wait for webhook 'business.kyc_completed' → flip to 'ready' + 'enabled'
      OR webhook 'business.kyc_rejected' → flip to 'suspended', alert admin
        │
[11] If status='ready': UPDATE payout_status='enabled'
        │
[12] Welcome email: "המערכת מוכנה. מעכשיו תוכל לקבל הזמנות."
        │
[13] Provider's services become visible in marketplace search
```

### Failure UX
- If any step fails: profile stays in current state, error shown, "retry" + "contact support" buttons
- If SUMIT KYC rejects: admin reviews, can override or request additional documents from provider via `/admin/provider-finance/:id/request-documents`
- Provider can edit profile until status='ready'. After that, changes require admin re-approval (per F-F locked: business_type change triggers re-onboarding)

### Save-as-draft
Every step's data persisted to `provider_finance_profiles_draft` (NEW table, or JSONB column on main table). Provider can resume from any device. Drafts expire after 30 days.

---

## §3 FOCUS AREA — SUMIT SYNC LIFECYCLE

### Object sync rules (one-way: PetWash → SUMIT)

| PetWash entity | SUMIT entity | When created | Update trigger | Idempotency key |
|---|---|---|---|---|
| `users` (customer) | SUMIT customer | First payment OR first invoice for that user | User email/phone change | `pw-cust-{user_id}-v1` |
| `provider_finance_profiles` | SUMIT sub-business | After invoice authorization signed | business_type or legal_name change | `pw-subbiz-{profile_id}-v1` |
| `provider_finance_profiles` (the provider as customer of PetWash) | SUMIT customer (in master org) | Same time as sub-business | Same as above | `pw-prov-cust-{profile_id}-v1` |
| `bookings` | (no direct mirror) | — | — | — |
| `pw_payments` | (no direct mirror; charge is the event) | — | — | — |
| Payment success | SUMIT document (tax_invoice_receipt) | On escrow release | Cancellation or refund | `pw-doc-{payment_id}-{doc_type}-v1` |
| Provider payout | SUMIT document (commission_invoice) | Paired with provider's tax invoice | Same | `pw-doc-{payout_id}-comm-v1` |
| Refund | SUMIT document (credit_note) | On refund execution | — | `pw-doc-{payment_id}-refund-v1` |
| Chargeback | SUMIT document (credit_note + chargeback_notice) | On Nayax chargeback webhook | — | `pw-doc-{payment_id}-cb-{seq}` |

### Sync principle: write-once with idempotency
Every SUMIT write call carries an `external_reference` (idempotency key). If we crash mid-sync and retry, SUMIT returns the existing record instead of duplicating. SUMIT must support this (Q22-related; if not, we wrap in our own dedup table).

### Drift detection (one-way only — SUMIT is downstream)
Daily reconciliation job (already exists: `FinancialReconciliationService.ts`) compares PetWash records against SUMIT documents fetched via `/accounting/documents/list/`. Drift = missing doc or amount mismatch → row in `pwReconciliationReports.criticalIssues`.

### Update semantics
Some SUMIT objects are append-only (invoices, receipts — Israeli tax law). Updates handled via:
- Customer info change → SUMIT `/accounting/customers/update/`
- Sub-business info change → SUMIT `/website/companies/update/`
- Document content change → IMPOSSIBLE; issue credit note + new invoice instead

### Re-sync mechanism
Admin button `/admin/provider-finance/:id/resync-to-sumit` for manual recovery if drift detected. Calls SUMIT update endpoints, marks `sumit_last_sync_at = NOW()`. Audit-logged.

---

## §4 FOCUS AREA — WEBHOOK LIFECYCLE

### Full lifecycle (extends V2 §8)

```
[SUMIT trigger fires (e.g. document.created)]
        │
[HTTP POST → https://petwash.co.il/webhooks/sumit/events]
  Headers: X-Sumit-Signature: <hmac-sha256>
           X-Sumit-Event-Id: <uuid>
           X-Sumit-Event-Type: <trigger_name>
           X-Sumit-Timestamp: <unix>
        │
[Express middleware: rate limit 100/min/IP]
        │
[Body parser: raw bytes (needed for HMAC), then JSON parse]
        │
[SumitWebhookHandler.handle(req)]
        │
  ┌─ Step 1: Timestamp drift check (reject if >5 min skew — replay protection)
  │   Invalid → 401, increment metric "sumit.webhook.replay_attempt"
  │
  ├─ Step 2: HMAC validation
  │   computed = HMAC_SHA256(SUMIT_WEBHOOK_SECRET, raw_body + timestamp)
  │   Use crypto.timingSafeEqual vs X-Sumit-Signature header
  │   Invalid → 401, alert if >10 in 5 min (potential attack)
  │
  ├─ Step 3: Idempotency check
  │   SELECT FROM sumit_webhook_events WHERE event_id = X-Sumit-Event-Id
  │   If exists AND processed_at IS NOT NULL → return 200 immediately (already processed)
  │   If exists AND processed_at IS NULL → row exists from prior delivery, will be picked up by worker
  │
  ├─ Step 4: INSERT sumit_webhook_events row (status received, raw_payload preserved)
  │
  └─ Step 5: Return 202 Accepted within 1 second
        │
        ▼ (background worker, NOT inline — SUMIT timeout protection)
        │
[Worker picks up unprocessed sumit_webhook_events rows]
        │
[Trigger router (switch on trigger_name):]
  'document.created'         → DocumentCreatedHandler
  'document.cancelled'       → DocumentCancelledHandler
  'document.sent'            → DocumentSentHandler
  'payment.charged'          → PaymentChargedHandler        (Phase B if SUMIT clears)
  'payment.refunded'         → PaymentRefundedHandler
  'payment.failed'           → PaymentFailedHandler
  'business.kyc_completed'   → KycCompletedHandler
  'business.kyc_rejected'    → KycRejectedHandler
  'business.suspended'       → BusinessSuspendedHandler
  'recurring.charged'        → RecurringChargedHandler      (Phase 4 memberships)
  'recurring.failed'         → RecurringFailedHandler
  'customer.created'         → (informational, log only)
  unknown                    → log + DLQ for human review
        │
[Handler runs in DB transaction]
        │
  ┌─ Success: UPDATE sumit_webhook_events SET processed_at = NOW(), related_link_id = ...
  │
  ├─ Validation failure (data integrity issue): mark dead-lettered immediately + alert admin
  │
  └─ Transient failure (DB timeout, downstream service down):
       INCREMENT retry_count, SET next_retry_at = NOW() + exponential_backoff
       IF retry_count > MAX (default 7): SET dead_lettered_at = NOW(), alert admin
        │
[Per-trigger handler logic examples:]

DocumentCreatedHandler:
  - Lookup sumit_document_links by external_reference (we created this when calling SUMIT)
  - If found: UPDATE status='issued', sumit_document_id=..., sumit_document_number=...
  - If NOT found: SUMIT issued doc outside our flow (admin panel?) — log warning, INSERT orphan row, alert admin

KycCompletedHandler:
  - Lookup provider_finance_profiles by sumit_sub_business_id
  - UPDATE sumit_setup_status='ready', payout_status='enabled' (if not already suspended)
  - Send provider welcome email "המערכת מוכנה לקבלת הזמנות"
  - Make services visible in marketplace search

PaymentRefundedHandler:
  - Lookup pw_payments by external_reference (mapped from SUMIT payment ID via sumit_document_links)
  - Validate amount matches
  - UPDATE pw_payments status='REVERSED'
  - Reverse wallet/loyalty effects via WalletService.reverseRedemption()
  - If escrow already released: deduct from provider's next payout via payout_release_approvals
```

### Reliability guarantees
- **At-least-once delivery from SUMIT**: idempotency check (Step 3) makes us tolerant
- **At-most-once processing on our side**: row update under transaction
- **Net effect**: exactly-once semantics

### Replay tool
Admin UI `/admin/sumit/webhook-events`:
- Filters: trigger_name, processed status, date range, related_link_id
- "Replay" button: resets `processed_at` to NULL, sets `retry_count=0`, enqueues for worker
- Useful when handler bug fixed and old events need re-processing

---

## §5 FOCUS AREA — INVOICE OWNERSHIP MODEL

### Three invoice flows in our marketplace

**Flow 1 — Customer pays for service (CRITICAL — Wolt/Uber model)**
- **Legal issuer:** PROVIDER (the sitter, walker, trainer, etc.) — issued via PetWash as disclosed agent
- **Buyer:** End customer
- **SUMIT call:** `/accounting/documents/create/` with `sub_business_id = provider.sumit_sub_business_id`, `customer_id = end_customer.sumit_customer_id`
- **Document type:** `tax_invoice_receipt` (חשבונית מס/קבלה) — combined doc, dual legal meaning
- **Net amount on invoice:** PROVIDER'S SHARE (e.g. 85% of customer payment)
- **Why provider's share, not full amount:** the legal seller is the provider, and they sold their service at their net price. The platform commission is a SEPARATE transaction (Flow 2).
- **External ref:** `pw-doc-{payment_id}-prov-inv-v1`

**Flow 2 — PetWash commission invoice (PetWash bills provider)**
- **Legal issuer:** PETWASH LTD (517145033 — pending VAT reconciliation)
- **Buyer:** PROVIDER (as a customer of PetWash for platform services)
- **SUMIT call:** `/accounting/documents/create/` with NO sub_business_id (issued from PetWash master), `customer_id = provider.sumit_customer_id`
- **Document type:** `tax_invoice` (חשבונית מס) — full Israeli tax invoice
- **Amount:** PLATFORM COMMISSION + VAT on commission (e.g. 15% × ₪200 = ₪30 commission + ₪5.40 VAT = ₪35.40)
- **External ref:** `pw-doc-{payment_id}-comm-inv-v1`
- **Settlement:** Net out of provider's payout; provider sees deduction line in their statement

**Flow 3 — Customer receipt (when payment is just topup or non-marketplace)**
- **Legal issuer:** PETWASH LTD (no provider involved)
- **Buyer:** End customer
- **SUMIT call:** `/accounting/documents/create/` from PetWash master, customer_id = end customer
- **Document type:** `receipt` (קבלה) or `tax_invoice_receipt`
- **Use cases:** wallet topup, gift card purchase, membership fee
- **External ref:** `pw-doc-{payment_id}-receipt-v1`

### Critical rule (enforced in code)
```typescript
function determineDocumentIssuer(payment: PwPayment): DocumentIssuer {
  if (payment.commercialModel === 'MARKETPLACE_COMMISSION') {
    return { type: 'provider_via_agent', subBusinessId: required };
  }
  if (payment.commercialModel === 'PRINCIPAL') {
    return { type: 'petwash_principal', subBusinessId: null };
  }
  throw new Error(`Unknown commercial model: ${payment.commercialModel}`);
}
```

### עוסק פטור special case
עוסק פטור (exempt dealer) CANNOT issue tax invoices (חשבונית מס). They can only issue receipts (קבלה).
- Flow 1 for an עוסק פטור provider: document type = `receipt`, NOT `tax_invoice_receipt`
- VAT on Flow 1 = 0 (provider does not collect VAT)
- BUT: PetWash's commission invoice (Flow 2) still has 18% VAT on the commission, because PetWash is עוסק מורשה
- This is Q19 in the SUMIT email — confirm SUMIT handles עוסק פטור receipt-only mode in marketplace flow

### Authorization tracking
Every Flow 1 invoice MUST be linked to a valid `invoice_authorization_signed_at` on the provider's profile. ProviderPayoutService refuses to call SUMIT for Flow 1 if authorization is missing. Audit log records the authorization version at the time of issuance (so future legal changes don't retroactively invalidate old invoices).

---

## §6 FOCUS AREA — ACTION-COST MINIMIZATION

### Cost driver analysis (from screenshot §1: ₪99/month base + ₪0.25/action overage)

**Per-booking action count breakdown (worst case — every API call counts):**
1. Create end customer in SUMIT (if first-time customer) — 1 action
2. Issue Flow 1 invoice (provider's tax invoice/receipt) — 1 action
3. Issue Flow 2 invoice (PetWash commission) — 1 action
4. Send Flow 1 doc to customer (email) — 1 action (Q11 to confirm)
5. Webhook for document.created — 1 action (if outbound webhooks count)
**Total: 5 actions per booking (worst case)**

10,000 bookings/month × 5 = 50,000 actions
Free: 400
Overage: 49,600 × ₪0.25 = **₪12,400/month worst case**

### Minimization strategies (ranked by impact)

**Strategy 1 — Skip end-customer SUMIT creation for repeat customers**
Cache `sumit_customer_id` in our `users` table after first creation. Repeat customers don't trigger new SUMIT customer create.
- Saves ~30-50% of customer-create actions (depending on repeat rate)
- Storage cost: 1 VARCHAR column on `users` table

**Strategy 2 — Batch document send via email (use SendGrid, not SUMIT email)**
SUMIT can send documents to customers (action #4 above), but that's a chargeable action AND chargeable email module.
Instead: SUMIT issues doc → PetWash fetches PDF → PetWash emails via SendGrid (already paid for).
- Saves 1 action per booking
- Customer experience identical
- Requires Q11 confirmation (is `document.send` itself an action?)

**Strategy 3 — Bundle invoice + receipt into single tax_invoice_receipt document**
SUMIT supports combined `חשבונית מס/קבלה` doc (screenshot 3 confirms). One document = one action, instead of two.
- Saves 1 action per booking (for full-VAT bookings)
- Already in our document_type enum; just need to use it

**Strategy 4 — Defer commission invoice to monthly batch (NOT per booking)**
Instead of issuing PetWash's commission invoice per booking, batch them: one commission invoice per provider per month covering all that month's commissions.
- Saves up to ~83% of Flow 2 actions (if each provider has 6+ bookings/month)
- Trade-off: less granular accounting, provider sees one big monthly deduction
- Legal: must verify with CPA that monthly aggregation is acceptable under Israeli VAT rules
- Recommendation: ASK CPA in §24 brief

**Strategy 5 — Use SUMIT recurring (standing orders) for memberships**
Memberships shouldn't be charged manually each month. SUMIT recurring = 1 setup action + automatic charges (probably not counted as actions, but Q11).
- Eliminates 11 actions/year per membership
- Already in SUMIT base plan (no extra cost)
- Migration from current Stripe stub: PR-PFP-13

**Strategy 6 — Loyalty stays internal (NOT SUMIT)**
Loyalty point earn/redeem doesn't touch SUMIT. Only the underlying wash/sit transaction does.
- Saves potentially thousands of actions/month (every redemption would otherwise be a doc)
- Already the architecture in V2; reinforcing here

**Strategy 7 — Single SUMIT plan with all providers as sub-businesses**
If Q12 answer is "sub-businesses share master quota": all 200 providers + master = 1 plan. 400 actions/month is tiny per provider — overage dominates.
If Q12 answer is "per-sub-business quota": 200 × 400 = 80,000 free actions/month. Plenty of headroom.
- Subscribing each provider to their OWN paid plan is option but adds ₪99 × 200 = ₪19,800/month base. Probably worse than overage.
- Decision: wait for Q12, then optimize

### Projected costs (with all strategies applied)
Best case (strategies 1+3+4+5+6 applied, Q12 = per-sub-business):
- Customer creates: ~5,000/mo (assuming 50% repeat)
- Combined tax_invoice_receipt: 10,000/mo
- Commission invoices (monthly batch): 200/mo
- Recurring memberships: 0 actions
- Loyalty: 0 SUMIT actions
- Total: ~15,200 actions across all sub-businesses + master
- Per sub-business avg: 76 actions/mo — well within 400 free
- **Overage: ₪0/month**
- **Plan cost: ₪99/month**
- **Plus 1.1-2% clearing × volume**

This is a >100× improvement vs worst case. Justifies the engineering effort to implement strategies 1-6.

### Implementation
- Strategies 1, 2, 3, 6 can be implemented in PR-PFP-7 (document issuance) — no extra PR
- Strategy 4 (monthly batch) needs PR-PFP-7c (separate, after CPA approval)
- Strategy 5 (recurring) is PR-PFP-13 (Phase 4)

### Monitoring
`sumit_sync_quota_log` table (V2 §5 Table 4) tracks every action per day per type per sub-business. Daily cron computes projected monthly cost. Alert at 80% of plan limit.

---

## §7 FOCUS AREA — SUB-BUSINESS / PROVIDER MODEL

### Mapping: PetWash provider ↔ SUMIT sub-business

```
PetWash:                              SUMIT:
──────                                ─────
users (user_id, role=provider)        (no direct mirror)
provider_applications                 (no direct mirror)
provider_finance_profiles  ──────►   sub-business (via /website/companies/create)
   .sumit_sub_business_id              .company_id
   .legal_name_he                      .company_name
   .business_number                    .vat_id (or .company_id field)
   .business_type                      .business_category
   .vat_number                         .vat_id
   .registered_address                 .address
   .bank_account_iban_encrypted        .bank_account (encrypted in transit)
   .invoice_email                      .email
   .business_phone                     .phone

provider_finance_profiles  ──────►   customer (in PetWash master org)
   .sumit_customer_id                  .customer_id
   .legal_name_he                      .name
   .business_number                    .id_number (ת״ז/ח״פ)
```

The provider exists TWICE in SUMIT:
1. As a **sub-business** — they're an independent legal seller, SUMIT issues invoices in their name
2. As a **customer of PetWash** — PetWash bills them commission, so they're our customer for that purpose

### Lifecycle states

```
provider_finance_profiles.sumit_setup_status:
  pending       → admin approved, profile row exists, provider hasn't filled form
  in_progress   → provider filled form, sync to SUMIT in flight
  awaiting_kyc  → SUMIT created sub-business, KYC pending
  ready         → SUMIT sub-business active, can issue invoices
  suspended     → KYC rejected OR business marked suspended (chargeback, AML)
  failed        → sync attempted but unrecoverable error (admin must investigate)

provider_finance_profiles.payout_status:
  locked     → setup incomplete OR authorization not signed
  enabled    → can receive payouts (requires sumit_setup_status='ready' + auth signed)
  suspended  → temporary hold (KYC issue, dispute, manual admin action)
```

### State transitions (allowed)
- pending → in_progress: provider submits form
- in_progress → ready: SUMIT createSubBusiness 200 with no KYC pending
- in_progress → awaiting_kyc: SUMIT createSubBusiness 200 with KYC pending
- in_progress → failed: SUMIT 4xx unrecoverable
- awaiting_kyc → ready: webhook business.kyc_completed
- awaiting_kyc → suspended: webhook business.kyc_rejected
- ready → suspended: webhook business.suspended OR admin action
- suspended → ready: webhook business.unsuspended OR admin override
- failed → in_progress: admin clicks "retry sync"

### Disallowed transitions
- Anything → pending (irreversible — once provider has filled form, can't go back)
- ready → in_progress (must go through suspended first, or admin override)

### Multi-entity provider edge case
Provider with TWO legal entities (e.g. עוסק פטור side gig + חברה בע״מ main business):
- TWO `provider_finance_profiles` rows linked to same `provider_user_id`
- (Requires removing UNIQUE constraint on `provider_user_id`, or adding entity_seq column)
- PetWash booking UI prompts provider "Which legal entity for this booking?" if 2+ profiles exist
- Each profile has its own SUMIT sub-business + KYC + invoice authorization

**Decision required (CEO):** support multi-entity providers at launch, or defer to Phase 4?
**Recommendation:** Defer. Most providers are single-entity. Multi-entity is a Phase 4+ enhancement.

---

## §8 FOCUS AREA — UPay INTEGRATION STRATEGY

### What UPay is
SUMIT's payment terminal product (physical card readers + WhatsApp-based payment links + bank verification). Endpoints in V2 reference list:
- `/billing/generalbilling/openupayterminal/`
- `/billing/generalbilling/setupaycredentials/`
- `/billing/payments/multivendorcharge/` (uses UPay infrastructure for marketplace clearing)

### When PetWash would use UPay (decision matrix)

| Use case | Channel | UPay used? | Why |
|---|---|---|---|
| Online booking payment | Web/app card form | NO (Phase A, Nayax) — YES (Phase B if Apple Pay/Bit cheaper via UPay) | Existing Nayax flow works |
| K9000 kiosk payment | Physical kiosk | NO | K9000 uses Nayax hardware |
| Provider mobile collection (offline situation, e.g. on-site cash backup) | Physical card reader | YES (provider buys UPay terminal) | Only way for provider to legally accept card payment with PetWash invoicing |
| WhatsApp payment request to delinquent customer | WhatsApp link | YES | UPay native feature |
| Recurring memberships | Web flow | NO (Phase 4 will use SUMIT recurring, which uses UPay under the hood but transparently) | We don't touch UPay directly |

### Phase A integration scope (MVP)
NO direct UPay integration. We use multivendorcharge ONLY if Phase B happens, and even then it's an abstraction we don't manage directly.

### Phase B (if Apple Pay/Google Pay migration justified by cost)
- Use `/billing/payments/multivendorcharge/` to charge card via SUMIT/UPay
- Card data NEVER touches PetWash servers (SAQ-A scope preserved)
- Apple Pay/Google Pay tokens passed through SUMIT iframe → SUMIT → UPay clearing
- Confirmed in search: multivendorcharge "automatically generates an invoice/receipt in the vendor's name and allows sending the generated document to the end customer" — so it's both clearing AND document issuance in one call

### Phase C (long term — physical reader provisioning)
Some power-providers may want UPay physical terminals (e.g. trainer doing in-home classes wants to accept card on the spot, with proper invoice).
- PetWash provider portal could surface "Order UPay terminal" link → deep link to SUMIT account
- Provider gets terminal directly from UPay, PetWash isn't in the supply chain
- Out of MVP scope

### Decision
**Don't touch UPay APIs directly in MVP.** All UPay functionality reached indirectly via `multivendorcharge` and SUMIT recurring (when those are implemented in Phase B/4).

---

## §9 FOCUS AREA — EXACT EVENT FLOW MAPPING

### Event 1: Customer creates a booking

```
[Client: POST /api/bookings/sitter]
        │
[BookingLifecycleService.createBooking(input)]
        │
[Validate: provider has services available, dates, pets, etc.]
        │
[sitterFeeCalculator.calculate(provider, dates, addOns)]
   → { basePrice, platformFee=15%, vat=18% on platform fee, total }
        │
[NayaxOnlinePaymentService.createCharge({
   amount: total,
   metadata: { booking_id, provider_id, customer_id }
})]
   → returns Nayax payment_link_id + redirect URL
        │
[INSERT pw_payments (status='CREATED', commercialModel='MARKETPLACE_COMMISSION')]
        │
[INSERT booking (status='pending_payment')]
        │
[Return redirect URL to client]
        │
[Customer redirected to Nayax hosted page, enters card]
        │
[Nayax webhook → /api/nayax-webhook]
   → match Nayax payment_link_id back to pw_payments
   → UPDATE pw_payments status='AUTHORISED', then 'CAPTURED'
   → INSERT escrowHoldings (status='held', releaseScheduledAt = NOW() + 72h)
   → UPDATE booking status='confirmed'
   → Send customer confirmation email (existing flow)
   → Send provider notification email (existing flow)
```

**NO SUMIT involvement yet** — invoice not issued until service performed.

### Event 2: Service performed, escrow ready to release

```
[Cron: every 5 min, scan escrowHoldings WHERE status='held' AND releaseScheduledAt < NOW()]
        │
[For each: BookingLifecycleService.releaseEscrow(escrowId)]
        │
[Lookup booking, payment, provider, provider_finance_profile]
        │
[GUARDRAIL: assert provider_finance_profile.payout_status === 'enabled'
            AND invoice_authorization_signed_at IS NOT NULL
            ELSE skip + alert admin]
        │
[Issue Flow 1 invoice — provider's tax invoice/receipt]
   SumitDocumentIssuer.createTaxInvoiceReceipt({
     sub_business_id: profile.sumit_sub_business_id,
     customer_id: customer.sumit_customer_id (create if needed),
     line_items: [{ description: booking.service_name, amount: provider_share, vat_rate: profile.business_type == 'exempt' ? 0 : 0.18 }],
     external_reference: `pw-doc-${payment.payment_id}-prov-inv-v1`
   })
   → returns sumit_document_id
   → INSERT sumit_document_links
   → UPDATE pw_provider_payouts.providerTaxInvoiceId
        │
[Issue Flow 2 invoice — PetWash commission]
   SumitDocumentIssuer.createTaxInvoice({
     sub_business_id: null (PetWash master),
     customer_id: profile.sumit_customer_id,
     line_items: [{ description: "עמלת פלטפורמה", amount: commission, vat_rate: 0.18 }],
     external_reference: `pw-doc-${payment.payment_id}-comm-inv-v1`
   })
   → returns sumit_document_id
   → INSERT sumit_document_links
   → UPDATE pw_provider_payouts.commissionInvoiceId
        │
[Calculate withholding tax]
   resolveWithholdingRate(profile.cert_expiry, profile.cert_rate, NOW())
   → rate (e.g. 0.20)
   → withholding_amount = provider_share * rate
   → net_payout = provider_share - withholding_amount
        │
[Record payout intent]
   INSERT/UPDATE pw_provider_payouts (status='ready_for_payout', net_cents, ...)
        │
[UPDATE escrowHoldings status='released']
        │
[Bank transfer]
   Phase A: queued for admin batch (manual CSV → bank)
   Phase B: automated via SUMIT UPay or bank API
        │
[Email customer their tax_invoice_receipt PDF]
   SendGrid send (NOT SUMIT email, per cost minimization strategy 2)
   Template: petwash-receipt with provider's branded SUMIT PDF attached
```

### Event 3: Customer requests refund

```
[Customer requests refund in app → /api/bookings/:id/refund-request]
        │
[Admin reviews in /admin/refund-requests]
        │
[Admin approves]
        │
[If escrow still held (within 72h):]
   [Reverse Nayax charge via NayaxOnlinePaymentService.refund()]
   [UPDATE pw_payments status='REVERSED']
   [UPDATE escrowHoldings status='refunded']
   [Issue credit note via SUMIT (if document already issued, which it shouldn't be for held escrow)]
        │
[If escrow already released (>72h, post-payout):]
   [SumitDocumentIssuer.createCreditNote({...})]
   [Refund money to customer via Nayax]
   [Deduct from provider's NEXT payout via payout_release_approvals adjustment]
   [Email customer credit note PDF]
   [Email provider "refund deducted from your next payout" notification]
```

### Event 4: Provider updates business info

```
[Provider edits in /provider/finance-onboarding]
        │
[PUT /api/provider/finance-profile/me]
        │
[If business_type changed: per F-F locked decision, this is structural change]
   [Suspend current setup, re-trigger SUMIT onboarding]
   [Admin notified for review (KYC must re-run)]
        │
[If only minor fields changed (phone, email, address):]
   [Call SUMIT /website/companies/update/ with new fields]
   [UPDATE provider_finance_profiles]
   [No payout interruption]
```

### Event 5: SUMIT webhook fires (any event)

See §4 for full handler lifecycle.

---

## §10 FOCUS AREA — AVOIDING DUPLICATE INVOICES / PAYMENTS

### The threat
Without idempotency, retrying a SUMIT call after a network failure could issue TWO invoices for the same booking. Two invoices = two tax events = legal mess + customer confusion.

### Defense layer 1: external_reference (sent to SUMIT)

Every SUMIT write call carries an `external_reference` string we generate:
- Pattern: `pw-{entity-prefix}-{primary-id}-{purpose}-v{version}`
- Examples:
  - `pw-doc-PW-PAY-2026-abc12345-prov-inv-v1` (provider tax invoice for payment abc12345)
  - `pw-doc-PW-PAY-2026-abc12345-comm-inv-v1` (commission invoice)
  - `pw-cust-firebase-uid-xyz-v1` (customer create)
  - `pw-subbiz-pfp-42-v1` (sub-business create for profile 42)
- v1 suffix allows future schema changes (v2 = different field mapping)

SUMIT MUST treat external_reference as idempotency key:
- If we POST with external_reference that already exists → SUMIT returns existing record (200, not 201)
- If not supported by SUMIT → we use Defense layer 2 as primary

### Defense layer 2: dedup table (our side)

`sumit_idempotency_keys` table (NEW, to add to V3 schema):

```sql
CREATE TABLE sumit_idempotency_keys (
  external_reference  VARCHAR PRIMARY KEY,
  sumit_endpoint      VARCHAR NOT NULL,
  request_payload     JSONB NOT NULL,
  sumit_response      JSONB,
  sumit_resource_id   VARCHAR,           -- e.g. sumit_document_id, sumit_customer_id
  status              VARCHAR NOT NULL CHECK (status IN ('in_flight','succeeded','failed')),
  attempt_count       INTEGER NOT NULL DEFAULT 1,
  first_attempt_at    TIMESTAMP NOT NULL DEFAULT NOW(),
  last_attempt_at     TIMESTAMP NOT NULL DEFAULT NOW(),
  succeeded_at        TIMESTAMP
);

CREATE INDEX sik_status_idx ON sumit_idempotency_keys (status, last_attempt_at);
```

Wrapper logic in `SumitMarketplaceClient.call(...)`:

```typescript
async function safeSumitCall(endpoint, externalRef, payload) {
  // Step 1: lookup or insert idempotency row
  const existing = await db.select().from(sumit_idempotency_keys)
    .where(eq(sumit_idempotency_keys.external_reference, externalRef))
    .limit(1);
  
  if (existing.length && existing[0].status === 'succeeded') {
    return existing[0].sumit_response;  // return cached response, no SUMIT call
  }
  
  if (existing.length && existing[0].status === 'in_flight') {
    // Another worker is processing this RIGHT NOW — wait or fail
    throw new SumitConcurrencyError(externalRef);
  }
  
  // Step 2: INSERT in_flight row (or UPDATE if failed retry)
  await db.insert(sumit_idempotency_keys).values({
    external_reference: externalRef,
    sumit_endpoint: endpoint,
    request_payload: payload,
    status: 'in_flight',
  }).onConflictDoUpdate({
    target: sumit_idempotency_keys.external_reference,
    set: { 
      attempt_count: sql`attempt_count + 1`,
      last_attempt_at: new Date(),
      status: 'in_flight',
    }
  });
  
  // Step 3: make SUMIT call
  try {
    const response = await sumitHttp.post(endpoint, payload);
    
    await db.update(sumit_idempotency_keys)
      .set({ status: 'succeeded', sumit_response: response.data, sumit_resource_id: extractResourceId(response), succeeded_at: new Date() })
      .where(eq(sumit_idempotency_keys.external_reference, externalRef));
    
    return response.data;
  } catch (error) {
    if (is4xxError(error)) {
      // Permanent failure — mark and don't retry
      await db.update(sumit_idempotency_keys)
        .set({ status: 'failed', sumit_response: error.response?.data })
        .where(eq(sumit_idempotency_keys.external_reference, externalRef));
    }
    // For 5xx: leave in_flight row, will be retried by retry worker
    throw error;
  }
}
```

### Defense layer 3: payment-side idempotency (pre-existing)

`pw_payments.idempotencyKey` already exists. Booking creation flow already prevents double-charging if customer double-taps. SUMIT integration sits downstream — never called more times than there are unique payments.

### Defense layer 4: webhook idempotency (covered in §4)

SUMIT delivers same event twice → we check `sumit_webhook_events.event_id` and skip.

### Defense layer 5: cron-based drift correction

Daily reconciliation (FinancialReconciliationService.ts) compares:
- `pw_payments` count vs sum of `sumit_document_links` for that period
- Identifies missing docs (→ retry issuance) and orphan docs (→ admin review)
- Catches anything that slipped through layers 1-4

### Combined guarantees
| Failure mode | Defended by |
|---|---|
| Network retry during create | Layer 1 (external_reference) + Layer 2 (dedup table) |
| Two workers process same job simultaneously | Layer 2 (in_flight status) |
| SUMIT doesn't honor idempotency | Layer 2 (we cache succeeded response) |
| Customer double-taps "pay" | Layer 3 (pw_payments.idempotencyKey) |
| SUMIT delivers webhook twice | Layer 4 (sumit_webhook_events.event_id) |
| Anything else (bug, race) | Layer 5 (daily reconciliation catches drift) |

**Net guarantee: at-most-one invoice per (payment_id, document_type) pair, even under arbitrary failure modes.**

---

## §11 SUMIT SUPPORT EMAIL — UPDATED 25-QUESTION VERSION (Hebrew)

(Replaces PR #301 §3 — adds Q11–Q25 from V2/V3 analysis)

**Status: ready to send. Awaiting CEO "Paste email" command to output the full Hebrew text in a single box for forwarding.**

Brief table of contents (so CEO knows what they'll receive):
- B1–B8: original 8 questions from PR #301 §3 (marketplace clearing, KYC, hosted UI, webhooks, Apple/Google Pay, reporting, plan limits, PCI-DSS)
- Q11–Q12: action quota mechanics (what counts? per-sub-business or shared?)
- Q13–Q15: 3DS pricing, clearing rate tiers, merchant-of-record status
- Q16–Q23: agent model docs, withholding, Form 856, עוסק פטור receipt-only mode, multi-sub-business plan, idempotency, sandbox, SLA
- Q24 (NEW): does external_reference act as idempotency key for /accounting/documents/create/?
- Q25 (NEW): does /accounting/documents/cancel/ support partial cancellation (just one line item) or full-doc only?

---

## §12 CPA ENGAGEMENT BRIEF — OUTLINE

(Full document to be written as `docs/SUMIT_CPA_ENGAGEMENT_BRIEF.md` if CEO approves)

Will cover:
1. PetWash marketplace architecture (1-page summary for non-engineers)
2. Three policy switches needing sign-off:
   - AGENT_MODEL_POLICY: disclosed vs undisclosed (recommendation: disclosed)
   - OSEK_PATUR_VAT_POLICY: input-VAT reclaim treatment
   - WITHHOLDING_RATE_POLICY: default rate when no Form 2542 cert (20% / 25% / 30%?)
3. VAT number reconciliation: which is correct, 516788400 or 517145033?
4. Monthly commission batching question (V3 §6 strategy 4): legal?
5. עוסק פטור provider treatment: receipt-only confirmed?
6. 7-year vs 10-year retention per document type?
7. Form 856 (annual withholding report): SUMIT produces or we compile?
8. Sample invoice (Hebrew) showing PetWash issuing in provider's name as agent — review for compliance
9. Reference: relevant ITA circulars and law sections

---

## §13 START PLAN — IMMEDIATE ACTIONS

### Today (your iPad, this evening)
- [ ] Read this V3 doc (you're doing it now)
- [ ] Answer Go/Hold on each of:
  - Lane 1: production fix + privacy + CI hardening (3 small PRs)
  - V3 doc fate: PR for iPad GitHub UI, or keep on branch
  - Email + CPA brief: paste here for forwarding
- [ ] Set WALLET_LINK_SECRET in GCP if you haven't already (or approve PR-STARTUP-FIX-2)

### This week (your end)
- [ ] Forward 25-question SUMIT email to support@sumit.co.il + accountant
- [ ] Engage CPA with the brief
- [ ] Engage lawyer for invoice authorization Hebrew text + agent model legality review
- [ ] Ask accountant: VAT number 516788400 vs 517145033?

### My end (parallel, once you Go)
- [ ] Lane 1 PRs (3 small, low-risk, production-safe)
- [ ] PR-PFP-1 schema migration (additive, blocks nothing)
- [ ] PR-PFP-2 admin approval creates pending row (additive)
- [ ] Hold on PR-PFP-3+4 until lawyer text returns
- [ ] Hold on PR-PFP-6+ until SUMIT support answers

### When SUMIT support answers return (5-10 business days?)
- [ ] Update V3 with answers, mark questions closed
- [ ] PR-PFP-6 SumitMarketplaceClient
- [ ] PR-PFP-7a/b customer sync + document issuance
- [ ] PR-PFP-9 webhook handler

### When CPA + lawyer sign off (parallel timeline)
- [ ] Flip AGENT_MODEL_POLICY to disclosed (committed change)
- [ ] PR-PFP-3+4 onboarding API + UI with lawyer-approved Hebrew text
- [ ] PR-PFP-10 strict payout gating (behind feature flag, 14-day soak)

### Phase 4 (months out)
- [ ] PR-PFP-12 Stripe schema cleanup
- [ ] PR-PFP-13 memberships → SUMIT recurring
- [ ] PR-PFP-14 Apple Pay/Google Pay migration evaluation
- [ ] PR-PFP-15+ B2B/municipal expansion

---

## §14 EXIT CRITERIA — WHAT "DONE" LOOKS LIKE

We declare SUMIT integration MVP complete when:
- All approved providers have completed finance onboarding (status='ready')
- All marketplace bookings produce both Flow 1 (provider) and Flow 2 (commission) invoices automatically
- Webhook handler processes 100% of SUMIT events with <1% DLQ rate over 14 consecutive days
- Daily reconciliation report shows 0 discrepancies for 14 consecutive days
- CPA has signed off on all three policy switches
- Lawyer has signed off on invoice authorization text
- Action quota stays under 80% of plan limit for 30 consecutive days
- No production incident attributable to SUMIT integration for 14 consecutive days

After all 8 criteria met → MVP graduates, Phase 4 work can begin.

---

## §15 RISK ITEMS — UNCHANGED FROM V2

See V2 §27 P0 risk register. Top items still open:
- WALLET_LINK_SECRET production block (Lane 1 fix pending)
- ID number plaintext storage (Lane 1 fix pending)
- VAT number mismatch (accountant question pending)
- Three CPA policy switches pending sign-off

---

**END OF V3 START PLAN.**

Length: ~7,500 words. Density over prose.

REPLY TO ME:
  "Go lane 1"          = I open 3 PRs (startup-fix-2, privacy-1, startup-harden-1) sequentially or parallel
  "Paste email"        = I output the 25-question Hebrew email in one box
  "CPA brief"          = I write docs/SUMIT_CPA_ENGAGEMENT_BRIEF.md and commit (no PR)
  "PR V3 doc"          = I open PR for V2 + V3 docs for iPad review
  "Hold all"           = stop, wait for your next instruction
