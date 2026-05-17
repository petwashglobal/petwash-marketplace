# Provider → SUMIT Finance Profile Integration Audit

**Status:** Audit + integration architecture + MVP/production plan. **No code change in this PR.**
**Trigger:** CEO escalation 2026-05-17 — *"Provider שאושר אצלנו חייב לקבל כרטיס ספק פנימי אצלנו, ואז חיבור מסודר ל-SUMIT לפי סוג העסק שלו."* ("An approved provider must get an internal provider card, then a structured SUMIT connection per their business type.")
**Companion:** `docs/SUMIT_CAPABILITIES_AUDIT.md` (PR #301) — verified SUMIT capabilities. **Do not duplicate; build on it.**
**Doctrine:** `.claude/skills/petwash-platform/SKILL.md` §0, §2 (protected systems), §3 (AI advisory rule).

---

## §0 TL;DR

**The truth, in one diagram:**

```
┌───────────────────────────────────────────────────────────────┐
│ PetWash App                          ←  SOURCE OF TRUTH       │
│ ┌─────────┬────────────┬──────────┬──────────┐                │
│ │ users   │ providers  │ pets     │ bookings │                │
│ │ members │ finance    │ wallet   │ payouts  │                │
│ │         │ profile ★  │ ledger   │ reference│                │
│ └─────────┴────────────┴──────────┴──────────┘                │
│       │ webhooks + REST                                       │
│       ↓                                                       │
├───────────────────────────────────────────────────────────────┤
│ SUMIT  ←  FINANCIAL SYSTEM OF RECORD                          │
│  • Tax invoice / חשבונית מס  in supplier's legal name         │
│  • Recurring billing / הוראות קבע                              │
│  • Apple Pay / Google Pay / Bit                                │
│  • Tax authority connection (registered software 00215702)    │
│  • Payouts via Upay aggregator (T+1 daily or monthly)          │
│  • Webhooks → PetWash ledger reconciliation                    │
└───────────────────────────────────────────────────────────────┘
                              ↑↓
┌───────────────────────────────────────────────────────────────┐
│ Google  ←  BACKUP / EXPORT / ADMIN OPS ONLY                   │
│  • Sheets:   admin exports of bookings/KYC/finance summary    │
│  • Forms:    NEVER source of truth — MVP intake max           │
│  • Drive:    encrypted backup of audit log                    │
└───────────────────────────────────────────────────────────────┘
```

★ = the new piece this audit proposes.

**Major gap confirmed:** PetWash currently has **zero structured finance profile** on approved providers. The `providers` table at `shared/schema.ts:7896-7944` holds **legacy Stripe Connect fields** (`stripeConnectAccountId`, `payoutEnabled`) — wrong vendor, wrong jurisdiction, wrong tax model.

**Without a `provider_finance_profile` row:**
- Approved providers cannot legally receive payouts in Israel
- No way to know if a provider is עוסק פטור / עוסק מורשה / חברה בע״מ
- No bank account on file → no way to wire money via SUMIT/Upay
- No tax-authority connection → can't issue compliant חשבוניות מס
- PetWash falls into PCI-DSS SAQ-D + money-services regulation if it tries to hold/route the money itself

**Fix path:** new `provider_finance_profiles` table + locked provider onboarding screen + SUMIT marketplace API integration. **MVP in 1 week. Full production in 2–3 weeks.** No protected systems touched (wallet, K9000, Nayax kiosk, Tranzila math all preserved).

---

## §1 What exists today

### §1.1 Provider approval flow (correctly wired up to a point)
`server/routes/admin-provider-review.ts:359-399` — `POST /api/provider-review/admin/approve/:id`
- Sets `providerApplications.status='approved'`, `reviewedAt` timestamp
- Sets Firebase custom claims: `role='provider'`, `accountType='provider'`, `providerApprovedAt`
- Dispatches SMS / push / in-app notifications
- **Does NOT create any finance record.** Approval ends here.

### §1.2 `providers` table (legacy Stripe wiring)
`shared/schema.ts:7896-7944` has:
- `stripeConnectAccountId`, `stripeOnboardingComplete`, `payoutEnabled` — **WRONG VENDOR** (Stripe is not the Israeli flow)
- `totalEarnings`, `pendingPayouts` — fine
- `kycStatus`, `kycVerifiedAt` — identity, not finance
- **Zero business-type, business-number, VAT, IBAN, invoice-email fields**

### §1.3 `providerApplications` table (identity intake, NOT finance)
`shared/schema.ts:5058-5181`
- KYC + biometric + background-check fields
- **No business or finance fields by design** — this is the identity-verification layer, not the post-approval finance setup layer

### §1.4 `providerIntakeQueue` (Google Forms MVP staging)
`shared/schema.ts:5186-5271`
- `googleFormResponseId`, `syncedFromSheetId`, `syncedAt` — Google Forms → Postgres one-way sync
- **Direction is correct** (Postgres is downstream of Forms for MVP intake; not a "Sheets is source of truth" violation)
- CEO ruling: Forms intake OK for MVP; cut for production

### §1.5 `googleSheetsIntegration.ts` (logging only)
`server/services/googleSheetsIntegration.ts:1-250`
- Centralized writer to 30+ sheet tabs
- Used for **logging and admin export**, not as a read-back source of truth
- **Aligned with CEO's "Google = backup/export only" rule** — verified, no action needed unless an admin path reads from Sheets (none found)

### §1.6 SUMIT in code today: **ZERO**
Grep across all `.ts`/`.tsx`: no `sumit`, `SUMIT`, `multivendorcharge`, `app.sumit.co.il`, `Upay` references. Only `docs/SUMIT_CAPABILITIES_AUDIT.md` (PR #301) exists. **All implementation work is greenfield.**

---

## §2 Proposed schema — `provider_finance_profiles`

```sql
CREATE TABLE provider_finance_profiles (
  id                              SERIAL PRIMARY KEY,
  provider_user_id                VARCHAR NOT NULL UNIQUE,   -- FK to users.id (Firebase uid)

  -- Israeli business classification
  business_type                   VARCHAR NOT NULL,
    -- enum: 'exempt_dealer'    (עוסק פטור)
    --       'authorised_dealer' (עוסק מורשה)
    --       'limited_company'   (חברה בע״מ)
    --       'nonprofit'         (עמותה)

  -- Business identification
  business_number                 VARCHAR,                -- ע.מ. / ח.פ. / מס׳ עמותה
  legal_name_he                   VARCHAR NOT NULL,
  legal_name_en                   VARCHAR,

  -- Location + contact
  registered_address              TEXT,
  business_phone                  VARCHAR,
  invoice_email                   VARCHAR NOT NULL,       -- where SUMIT delivers documents

  -- Payout banking
  bank_account_iban_encrypted     BYTEA,                  -- AES-256 at rest (pgcrypto)
  payout_method                   VARCHAR DEFAULT 'bank_transfer',

  -- Tax authority connection
  vat_number                      VARCHAR,                -- required for authorised_dealer + limited_company
  tax_authority_registered        BOOLEAN DEFAULT FALSE,
  tax_authority_connected_at      TIMESTAMP,

  -- SUMIT wiring
  sumit_sub_business_id           VARCHAR,                -- returned by SUMIT marketplace API
  sumit_setup_status              VARCHAR NOT NULL DEFAULT 'pending',
    -- enum: 'pending'     — admin approved, profile exists, awaiting provider form fill
    --       'in_progress' — provider filled fields, awaiting SUMIT setup
    --       'ready'       — SUMIT sub-business active, payouts enabled
    --       'suspended'   — KYC failed / AML hold / manual suspension

  payout_status                   VARCHAR NOT NULL DEFAULT 'locked',
    -- enum: 'locked'    — approval pending or finance setup incomplete
    --       'enabled'   — can receive payouts
    --       'suspended' — temporary hold (KYC, dispute, etc)

  -- Lifecycle
  approved_by_petwash_at          TIMESTAMP,              -- when admin clicked approve
  created_at                      TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at                      TIMESTAMP NOT NULL DEFAULT NOW(),

  CONSTRAINT pfp_vat_required CHECK (
    business_type NOT IN ('authorised_dealer','limited_company')
    OR vat_number IS NOT NULL
  ),
  CONSTRAINT pfp_iban_required_when_enabled CHECK (
    payout_status <> 'enabled'
    OR bank_account_iban_encrypted IS NOT NULL
  )
);

CREATE INDEX pfp_provider_idx       ON provider_finance_profiles (provider_user_id);
CREATE INDEX pfp_sumit_status_idx   ON provider_finance_profiles (sumit_setup_status);
CREATE INDEX pfp_payout_status_idx  ON provider_finance_profiles (payout_status);
```

### §2.1 Per-business-type field matrix

| Field | עוסק פטור (`exempt_dealer`) | עוסק מורשה (`authorised_dealer`) | חברה בע״מ (`limited_company`) | עמותה (`nonprofit`) |
|---|:---:|:---:|:---:|:---:|
| `business_number` | required (ע.מ. 9-digit) | required (ע.מ. 9-digit) | required (ח.פ. 9-digit) | required |
| `vat_number` | — | **required** (= ע.מ.) | **required** (= ח.פ.) | sometimes |
| `legal_name_he` | required | required | required + " בע״מ" | required + " (ע״ר)" |
| `legal_name_en` | optional | optional | optional | optional |
| `registered_address` | optional | required | required | required |
| `business_phone` | required | required | required | required |
| `invoice_email` | required | required | required | required |
| `bank_account_iban` | required to enable payouts | required | required | required |
| `tax_authority_registered` | optional flag | **true required** | **true required** | varies |

---

## §3 API flow — end-to-end

### Step A — admin approves
Existing endpoint: `POST /api/provider-review/admin/approve/:id` (`admin-provider-review.ts:359-399`)

**Add inside `AdminProviderReviewService.approveApplication()`:**

```ts
await db.insert(providerFinanceProfiles).values({
  providerUserId:      application.userId,
  businessType:        'limited_company',  // sensible default; provider can change
  legalNameHe:         application.firstName + ' ' + application.lastName, // placeholder
  invoiceEmail:        application.email,
  sumitSetupStatus:    'pending',
  payoutStatus:        'locked',
  approvedByPetwashAt: new Date(),
});
await logAuditEvent({
  actorUserId: req.firebaseUser!.uid,
  actorRole:   'admin',
  action:      'PROVIDER_FINANCE_PROFILE_CREATED',
  targetType:  'provider_finance_profile',
  targetId:    application.userId,
});
await notify(provider, 'finance_onboarding_required');
```

### Step B — provider sees locked onboarding screen
New client route: `/provider/finance-onboarding`

**Gating:**
- User role === `provider`
- `provider_finance_profiles` row exists
- `sumit_setup_status !== 'ready'` → render screen
- Else → redirect to `/provider/dashboard`

**Layout:** mobile-first, iPhone Safari verified, RTL + LTR. Step 1: business type (4 radio buttons in Hebrew). Step 2: conditional fields per type. Step 3: review + submit. Locked banner everywhere: "Complete finance setup to unlock payouts."

### Step C — provider submits
New endpoint: `PUT /api/provider/finance-profile/me`

```
Authorization: Bearer <firebase-id-token>
Body: { businessType, businessNumber, legalNameHe, legalNameEn?,
        registeredAddress, businessPhone, invoiceEmail,
        bankAccountIban, vatNumber? }
```

Server:
1. Zod-validate per `businessType` matrix (§2.1)
2. Validate IBAN format `^IL[0-9]{2}[0-9]{19}$` + checksum
3. Validate business-number format (8 digits ע.מ. / 9 digits ח.פ.)
4. Encrypt IBAN with `pgcrypto` before INSERT
5. Send `invoice_email` verification link (provider must click)
6. Update row: `sumit_setup_status='in_progress'`
7. `logAuditEvent` — every field change

### Step D — trigger SUMIT sub-business creation
New endpoint: `POST /api/provider/finance-profile/me/sumit-setup` (provider or admin can trigger)

**Server flow:**
1. Read `provider_finance_profiles` row
2. Call `SumitMarketplaceClient.createSubBusiness({ businessType, businessNumber, legalNameHe, invoiceEmail })`
3. SUMIT returns `{ subBusinessId, status: 'pending_kyc' }`
4. Store: `sumit_sub_business_id = subBusinessId`, status stays `in_progress`
5. Email provider: "SUMIT is verifying your business. You'll be notified when payouts are enabled."

### Step E — SUMIT KYC webhook
New endpoint: `POST /webhooks/sumit/events` (HMAC-validated)

Expected events:
- `sub_business.kyc_completed` → `sumit_setup_status='ready'`, `payout_status='enabled'`, `tax_authority_connected_at=NOW()`, email provider "You're live."
- `sub_business.kyc_failed` → `sumit_setup_status='suspended'`, store reason in audit log, email provider with support link
- `payout.executed` → log to wallet ledger (existing infrastructure)
- `invoice.issued` → mirror invoice number into PetWash booking record for reference

### Step F — all future money flows reference the profile
Every existing payout / invoice / refund handler must:
1. Look up the provider's `provider_finance_profile`
2. If `payout_status !== 'enabled'` → **block the payout**, surface in admin dashboard
3. Call SUMIT API with `sumit_sub_business_id` for the actual money movement
4. Never charge a card directly through PetWash — always SUMIT's hosted page / token

---

## §4 Locked finance onboarding screen — mobile-first design

```
┌─────────────────────────────────────┐
│  PetWash™                           │
│                                     │
│  🔒 Finance setup needed            │
│                                     │
│  To start receiving payouts, please │
│  complete your business details for │
│  invoice processing.                │
│                                     │
│  ─────────────────────────────      │
│  Business type                      │
│                                     │
│  ○ עוסק פטור (Exempt)               │
│    No VAT, simpler reporting        │
│                                     │
│  ○ עוסק מורשה (Authorised)          │
│    Collects VAT, monthly reporting  │
│                                     │
│  ◉ חברה בע״מ (Limited Co.)          │
│    ח.פ. + VAT + annual financials   │
│                                     │
│  ○ עמותה (Non-profit)               │
│    ע״ר number required              │
│                                     │
│                            [Next →] │
└─────────────────────────────────────┘
```

Subsequent screens render conditional fields per the matrix in §2.1. RTL layout. `dir="ltr"` lock on bank-IBAN / business-number inputs so numeric strings render left-to-right in Hebrew context.

---

## §5 Security + privacy guardrails

| Concern | Rule | Implementation |
|---|---|---|
| Credit card data | PetWash NEVER stores PAN | Use SUMIT hosted payment page (iframe or redirect). PCI-DSS scope stays SAQ-A. |
| Bank IBAN | Encrypted at rest | `pgcrypto` AES-256, column type `BYTEA`, encrypt in application layer before INSERT |
| Business number | Plaintext required for SUMIT API | Stored plaintext, but every read/write audit-logged |
| ID number (תעודת זהות) | Per CEO rule: number only, NO photo | Hash with `KYC_SALT` env var (already exists in `cloudrun-service.yaml:131-135`). Used for dedup only. |
| Audit log entry | Every status transition logged | Use existing `logAuditEvent` from `server/middleware/auditLog.ts` |
| Webhook signature | HMAC-validated | SUMIT provides `SUMIT_WEBHOOK_SECRET`; reject unsigned events |
| Invoice email verification | Provider clicks confirmation link | Standard email-link flow (`sendgrid` already wired) |

---

## §6 MVP plan (week 1)

**Goal:** schema + approval wiring + onboarding screen. **No SUMIT API call yet.**

| PR | Scope | Risk |
|---|---|---|
| **PR-PFP-1** | Drizzle migration: create `provider_finance_profiles` table per §2 | LOW (additive) |
| **PR-PFP-2** | `AdminProviderReviewService.approveApplication()` — INSERT finance profile row on approval per §3 Step A | LOW |
| **PR-PFP-3** | `GET /api/provider/finance-profile/me` + `PUT /api/provider/finance-profile/me` per §3 Steps B–C. Zod validation per §2.1 matrix. No SUMIT API call yet. | MEDIUM |
| **PR-PFP-4** | Client `/provider/finance-onboarding` screen per §4. Locked banner. Mobile-first. iPhone Safari verified. | MEDIUM |
| **PR-PFP-5** | Admin manual override endpoint: `POST /admin/provider-finance-profile/:providerId/mark-ready` — for the MVP period, an admin manually sets `sumit_setup_status='ready'` after they verify the provider's SUMIT account exists. | LOW |

**MVP exit criteria:**
- Admin approves provider → finance profile row created automatically
- Provider can fill the form via `/provider/finance-onboarding`
- Admin manually toggles `ready` after off-band SUMIT setup
- No payouts blocked yet (the existing payout system stays as-is during MVP)

---

## §7 Production plan (weeks 2–3)

**Goal:** full SUMIT marketplace API integration, webhooks, auto-activation, backfill.

| PR | Scope | Risk |
|---|---|---|
| **PR-PFP-6** | `server/services/SumitMarketplaceClient.ts` — typed client. Implement `createSubBusiness()` against the API contract confirmed by SUMIT support (the 6 questions in `SUMIT_CAPABILITIES_AUDIT.md` §3 must be answered first). | MEDIUM |
| **PR-PFP-7** | `POST /api/provider/finance-profile/me/sumit-setup` per §3 Step D. Calls the client. | MEDIUM |
| **PR-PFP-8** | `POST /webhooks/sumit/events` HMAC-validated handler per §3 Step E. New env var `SUMIT_WEBHOOK_SECRET` in GCP Secret Manager. | MEDIUM |
| **PR-PFP-9** | Payout gating — every existing payout path checks `provider_finance_profile.payout_status === 'enabled'` before releasing money. Surface blocked payouts in admin dashboard. | HIGH (touches money path — needs CEO + CPA review) |
| **PR-PFP-10** | Backfill script — for every existing approved provider without a finance profile, create a `pending` row + email "Complete finance setup to keep receiving payouts." | MEDIUM |
| **PR-PFP-11** | Decommission Stripe legacy fields on `providers` table (`stripeConnectAccountId`, `stripeOnboardingComplete`, `payoutEnabled`). Replace reads with the finance profile. | MEDIUM |

**Production exit criteria:**
- Provider approval → fully automated SUMIT sub-business creation
- KYC completion via webhook → automatic payout enablement
- All payouts route through SUMIT sub-business with provider as legal invoice issuer
- Existing provider backfill complete
- Stripe legacy code removed

---

## §8 Risks if we DON'T do this

1. **Approved providers cannot legally receive payouts.** Support load explodes; provider churn ("I can't cash out, I quit").
2. **PetWash becomes a regulated money-services entity.** If we hold/route provider money ourselves, חוק שירותי תשלום kicks in: Bank of Israel licence, AML/KYC duties, PCI-DSS SAQ-D (the worst scope).
3. **Tax invoice liability.** If PetWash issues invoices on behalf of providers without using SUMIT's native marketplace mode, we're the **מוציא חשבונית** legally — that requires Tax Authority registration + 2023 court-precedent compliance.
4. **Tax reporting chaos.** No way to know who owes VAT, who's exempt, who needs annual financials. Audit by רשות המסים = unanswerable.
5. **Google Sheets becomes the de-facto finance record.** Audit trail not legally admissible. Data loss risk. Israeli DPA may consider Google US-jurisdictional.

**SUMIT's marketplace mode (§5 of PR #301 audit) eliminates risks 2, 3, 4.** Provider is the legal invoice issuer; SUMIT carries the tax-authority registration; payout routing happens inside SUMIT's regulated stack. PetWash stays a technology platform + marketplace facilitator (per `.claude/skills/petwash-platform/SKILL.md` §0).

---

## §9 Files to inspect / touch

### Already wired (read but don't change in PR-PFP-1)
- `server/routes/admin-provider-review.ts:359-399` — approval endpoint (PR-PFP-2 adds finance-profile INSERT)
- `server/services/AdminProviderReviewService.ts:398-647` — `approveApplication()` (PR-PFP-2 target)
- `shared/schema.ts:7896-7944` — legacy `providers` table (PR-PFP-11 retires Stripe fields)
- `shared/schema.ts:5058-5181` — `providerApplications` table (no change needed)
- `server/services/ProviderPayoutService.ts` — current payout logic (PR-PFP-9 adds gating)
- `server/middleware/auditLog.ts` — `logAuditEvent` (use as-is)
- `server/services/PetWashNotificationEngine.ts` — multi-channel dispatcher (PR-PFP-2/3 add new template keys)

### To be created (greenfield)
- `provider_finance_profiles` table — Drizzle definition + SQL migration (PR-PFP-1)
- `server/routes/provider-finance-profile.ts` — new router (PR-PFP-3)
- `server/services/SumitMarketplaceClient.ts` — typed client (PR-PFP-6)
- `server/routes/webhooks-sumit.ts` — HMAC-validated handler (PR-PFP-8)
- `client/src/pages/provider/FinanceOnboarding.tsx` — mobile-first screen (PR-PFP-4)
- `server/scripts/backfill-provider-finance-profiles.ts` — one-shot migration (PR-PFP-10)

### Out of scope (explicitly NOT touched)
- Wallet ledger (`prestige-pass.ts`, `BillingLedger.ts`) — money math sacred
- K9000 hardware integration — kiosk payments stay Nayax
- Nayax integration — already correctly scoped to kiosk-only
- Tranzila legacy — deprecated, separate migration track (PR-PFP-11 handles cleanup)
- Schema migrations beyond the new table
- Auth gates (`validateFirebaseToken`, `requireAdmin`)
- Audit log infrastructure

---

## §10 Decisions awaiting CEO

| ID | Question | Recommendation |
|---|---|---|
| **F-A** | Ship MVP (PR-PFP-1 through PR-PFP-5) before SUMIT support answers the 6 questions in `SUMIT_CAPABILITIES_AUDIT.md` §3? | **Yes.** MVP is schema + form; no SUMIT API call. Decouples the work from SUMIT response time. |
| **F-B** | Default `business_type` on auto-created row — `'limited_company'` (most common in IL) or `null` (force provider to choose)? | **`null`** — explicit choice. Locked screen forces them to pick. |
| **F-C** | After PR-PFP-9 lands, do we **block** existing approved-but-no-profile providers from receiving payouts, or grandfather them? | **Block.** Backfill script (PR-PFP-10) creates `pending` rows for everyone first; then enable gate. ~7-day grace period with daily reminder emails. |
| **F-D** | `bank_account_iban` encryption — `pgcrypto` AES-256 in DB layer, or application-layer with key from GCP Secret Manager? | **Application layer.** Lets us rotate the key without DB downtime. Use `KYC_SALT` companion env var `IBAN_ENCRYPTION_KEY` (new). |
| **F-E** | Should the locked screen also collect a **profile photo + business logo** for SUMIT invoice branding? | **Defer.** SUMIT issues plain invoices; logo customisation is Phase 2. |
| **F-F** | If a provider changes `business_type` after `sumit_setup_status='ready'`, what happens? | **Suspend + re-trigger SUMIT setup.** New business type = new SUMIT sub-business. Provider re-acknowledges. |
| **F-G** | Where does the SUMIT support email response get tracked? | **GitHub Issue** in `petwashglobal/petwash-marketplace` tagged `sumit-integration`. Cross-reference from PR-PFP-6 description. |

---

## §11 Five-filter check (§0.8)

| Filter | Verdict |
|---|---|
| Better? | ✓✓✓ Replaces ad-hoc Stripe-leftover fields with structured Israeli-tax-aware schema |
| Cheaper? | ✓✓✓ SUMIT carries tax-authority registration, PCI-DSS scope, AML/KYC duty — 12-18 months of work avoided |
| Faster? | ✓✓ MVP in 1 week; production in 2-3 weeks |
| Easier? | ✓✓✓ Provider sees one locked screen, fills business type, done. Today they see nothing — silent payout failure. |
| Luxurious? | ✓✓ Premium ≠ DIY. Premium = the right tool. SUMIT IS the right tool for Israeli marketplace finance. |

**Honest miss:** PR-PFP-9 (payout gating) is the riskiest PR — it touches the money path. Even with backfill + grace period, there's a tail risk that a provider expects payout on day X and gets blocked. **Mitigation: feature-flag the strict gate for a 14-day staging soak; flip with CEO sign-off only.**

---

## §12 What this PR does NOT do

- No code change (audit + plan only)
- No schema migration
- No new dependency
- No new env var or secret
- No CI workflow change
- No payment / wallet / Tranzila / Nayax / K9000 / Summit-integration / Stripe touch
- No outbound email to SUMIT (the email in `SUMIT_CAPABILITIES_AUDIT.md` §3 still needs CEO sign-off + send)
- No PR-PFP-1 through PR-PFP-11 opened (gated on CEO decisions F-A through F-G in §10)

---

## §13 References

- `docs/SUMIT_CAPABILITIES_AUDIT.md` — verified SUMIT capabilities (parent doc; do not duplicate)
- `docs/TRANZILA_DEPRECATION_AUDIT.md` — legacy payment system
- `server/routes/admin-provider-review.ts:359-399` — approval endpoint
- `server/services/AdminProviderReviewService.ts:398-647` — approveApplication
- `shared/schema.ts:5058-5181` — providerApplications table
- `shared/schema.ts:7896-7944` — providers table (Stripe legacy)
- `shared/schema.ts:5186-5271` — providerIntakeQueue (Google Forms MVP staging)
- `server/services/ProviderPayoutService.ts` — current payout logic
- `server/middleware/auditLog.ts` — `logAuditEvent`
- `server/services/PetWashNotificationEngine.ts` — multi-channel notifications
- `.claude/skills/petwash-platform/SKILL.md` §0, §2 (protected systems), §3 (AI advisory rule)

---

**End of audit.** Implementation gated on CEO decisions F-A through F-G in §10. MVP estimated 1 week; production 2–3 weeks. No protected systems touched in MVP.
