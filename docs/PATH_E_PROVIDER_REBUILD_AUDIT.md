# Path E Forensic Audit — Provider Onboarding + Contractor / Legal / Payout / Compliance Infrastructure

**Status:** Audit + architecture proposal. No code change. No lawyer/CPA engagement triggered by this PR.
**Parent docs:**
- `docs/SIGNUP_ONBOARDING_FORENSIC_AUDIT.md` — Path A (signup determinism)
- `docs/MOBILE_FIRST_2026_REBUILD_AUDIT.md` — strategic rebuild plan
- `docs/PATH_D_CUSTOMER_ENRICHMENT_AUDIT.md` — customer-side companion
**Mission:** **Provider onboarding is not a normal startup signup.** It is legal infrastructure + contractor infrastructure + payout infrastructure + compliance infrastructure + risk containment infrastructure. Per CEO architectural directive #3 (2026-05-16): "PetWash is not an employer. PetWash is not an insurance company. PetWash is not a transport carrier. PetWash is a technology platform + marketplace facilitator."
**Date stamped:** 2026-05-16.

---

## §0 TL;DR

**~80% of the infrastructure exists in the codebase already. It is not WIRED.**
This is the single most important finding. Path E is **not a build-from-scratch
project** — it is a wiring + counsel-review + CPA-review project.

What exists:
- 1,517-line provider onboarding wizard (3 steps), client + server side
- Israeli contractor tax-entity type system (`shared/petwashIsraeliContractors.ts`)
- 916-line Provider & Host Services Agreement (23 sections, English verified, Hebrew draft)
- Digital signature framework (4 methods: typed, drawn, OTP, external) with audit trail
- PDF invoice generator (Hebrew + English) with tax compliance
- Banking schema columns on payout tables
- KYC document handling (with explicit "no-photo" path possible)

What is NOT wired:
- Tax-entity capture in onboarding form
- Bank account capture in onboarding form
- Contract signature step in onboarding flow
- Invoice arrangement selection (self-invoice vs PetWash-on-behalf)
- Separate "not insurance" acceptance checkbox
- Hebrew agreement counsel verification
- Booking-gate enforcement (no booking until contract signed)

**Total: 10 PRs over ~7-10 weeks** with counsel review running in parallel.
**Counsel review of the agreement is the longest pole** — engineering can
parallelize, but the contract must be lawyer-approved before enforcement
flips on.

**Architectural rule (CEO directive #3):** every artifact in Path E must
reinforce that **PetWash is a technology platform + marketplace facilitator**.
Not an employer. Not an insurer. Not a transport carrier. Liability flows to
the provider as an independent contractor. The platform provides matching,
payments rails, support coordination — nothing more.

---

## §1 Current `/provider-onboarding` state

| Aspect | File:Line |
|---|---|
| Wizard component | `client/src/pages/ProviderOnboarding.tsx` (1,517 LOC, 3 steps) |
| Server endpoint | `server/routes/provider-applications.ts` (POST `/api/providers/apply`) |
| Schema | `shared/schema-enterprise.ts:1677-1763` (`provider_applicants` table) |
| KYC docs flag | `KYC_DOCUMENTS_REQUIRED_AT_ONBOARDING = false` (line 85) — Phase 2 deferred |

### §1.1 Wizard structure (current)

**Step 1 (lines 707-970):** Platform selection + personal info — name, phone, provider types, address, ID number, enhanced verification triggers (home_access, overnight_sitting, key_holding, pet_transport).

**Step 2 (lines 983-1191):** Biometric KYC — selfie, government ID, insurance cert, business license (file uploads).

**Step 3 (lines 1204+):** Declarations + background consent — no criminal convictions, animal experience, insurance, T&Cs acceptance.

### §1.2 What's wired

- Phone OTP verification (Firebase pre-verified number fallback)
- Firebase displayName pre-fill
- Enhanced verification triggers correctly map to risk tiers
- Role-based bounce (non-provider roles redirect to post-login decider)
- Declaration text bilingual (EN verified, HE awaiting counsel)
- File upload (selfie, ID, insurance, business license)
- Multi-select service types

### §1.3 What's stubbed / missing

| Gap | Required for Wolt model |
|---|---|
| Tax-entity capture (עוסק מורשה / פטור / חברה) | ✓ Mandatory |
| VAT number / registration status | ✓ Mandatory |
| Bank account details (account, branch, code, IBAN) | ✓ Mandatory before first payout |
| Bank account verification | ✓ Best practice |
| Digital signature on contractor agreement | ✓ Mandatory legal infrastructure |
| Invoice arrangement (self vs PetWash-on-behalf) | ✓ Mandatory |
| Separate "not insurance" acceptance checkbox | ✓ Liability defense |
| Contract signed-at timestamp + version hash | ✓ Audit trail |

---

## §2 Tax-entity capture — framework exists, NOT WIRED

`shared/petwashIsraeliContractors.ts:25-31` defines the canonical Israeli
contractor types:

```typescript
export type IsraeliContractorEntityType =
  | "PRIVATE_INDIVIDUAL"   // יחיד
  | "OSEK_PATUR"           // עוסק פטור (revenue < ₪105k/yr, no VAT reg)
  | "OSEK_MURSH"           // עוסק מורשה (registered + 17% VAT)
  | "COMPANY_LTD"          // חברה בע״מ
  | "NON_PROFIT" | "OTHER";
```

`shared/petwashIsraeliContractors.ts:91-101` defines the tax profile interface:

```typescript
interface IsraeliTaxProfile {
  entityType: IsraeliContractorEntityType;
  idNumber: string;
  vatRegistered: boolean;
  vatNumber?: string | null;
  hasValidHeshbonitMasSystem: boolean;
  confirmsReportsToMasHachnasa: boolean;
  confirmsReportsToBituachLeumi: boolean;
}
```

**Agreement §9 mandates this declaration** (`shared/legal/providerHostAgreement.ts:308-315`):

> "The Provider warrants that they hold the correct Israeli tax status for that activity (עוסק פטור, עוסק מורשה, חברה בע״מ or another lawful classification) and will notify Pet Wash of any change."

**But the ProviderOnboarding.tsx wizard does not ask for any of this.** This is the single largest structural gap.

---

## §3 Bank details — schema partially exists

| Schema | File:Line | Status |
|---|---|---|
| `bank_accounts` table | `shared/schema.ts:3157-3201` | Full structure exists |
| Provider payout columns | `shared/schema.ts:~5518` | `providerBankIban`, `providerBankName`, `bankTransferReference` |
| Onboarding capture | NONE | Wizard does not ask |
| Validation | NONE | No Israeli IBAN/branch/bank-code lookup |
| Encryption | Partial | `schema-treasury.ts` uses `ibanEncrypted: text('iban_encrypted')` (AES-256-GCM) |

**Israeli banking format:**
- Account: 9 digits
- Branch (סניף): 2-3 digits
- Bank code: 2-3 digits (Hapoalim 12, Leumi 10, Discount 11, Mizrahi 20, Massad 46, etc.)
- IBAN: `IL` + 2 check digits + 3-digit bank + 3-digit branch + 13-digit account

**Required:** AES-256-GCM encryption at application layer before storage. GCS encryption-at-rest alone is insufficient under Israeli Privacy Protection Law.

---

## §4 Digital signature — framework exists, NOT WIRED to onboarding

| Component | File:Line | Status |
|---|---|---|
| Service | `src/petwash_subcontractor_legal_esign_2025.ts` | 4 signing methods supported |
| Methods | typed_name \| drawn_signature \| otp_code \| external_provider | All wired |
| Audit data | signedAt, ipAddress, userAgent, deviceInfo, signaturePayload, agreementSnapshotJson | All captured |
| Hash | SHA-256 of (payload + agreement version) | Tamper-evident |
| Route | `server/routes/subcontractor-agreements.ts` | GET + POST endpoints exist |
| Onboarding integration | NONE | Step 3 has no signature capture |

**Decision needed:** which signature method ships first?

- **Option A: Native canvas (drawn signature)** — most "feel like signing"; mobile-friendly; framework already supports it.
- **Option B: Typed name** — fastest, lowest friction, accepted under Israeli e-signature law.
- **Option C: OTP code** — extra security, slower UX.
- **Option D: DocuSign / HelloSign integration** — gold standard, costs ~$10/month/user, requires new dependency approval.

*Recommendation: Native canvas (drawn) as primary + typed-name fallback for accessibility. DocuSign deferred until enterprise B2B partnerships demand it.*

---

## §5 Provider & Host Services Agreement — exists, awaiting counsel

| Aspect | Value |
|---|---|
| File | `shared/legal/providerHostAgreement.ts` (916 LOC) |
| Version | `2026-05-13` |
| Sections | 23 |
| English | Verified (line 105) |
| Hebrew | DRAFT, awaiting counsel (line 114) |
| Counsel approval flag | `PROVIDER_HOST_AGREEMENT_COUNSEL_APPROVED = false` (line 102) |

### Key sections (excerpted)

- **§2** — Independent contractor status. No employment. Sets own hours. Can reject bookings.
- **§3** — Provider responsibility. Safe premises. Animal welfare. Incident reporting.
- **§6** — **INSURANCE DISCLAIMER** (lines 272-281):
  > "Pet Wash Ltd is not an insurance company, insurance broker, insurance agent or insurance adviser. Any references to safety, trust, protection, support, claims assistance or provider requirements do not mean that Pet Wash provides insurance or guarantees that any claim, loss, damage, injury, veterinary cost, property damage or third-party claim will be covered."
- **§9** — Tax & legal compliance (lines 308-315): tax status warranty per §2 above.
- **§22** — Digital acceptance (lines 427-435): agreement version, language hash, ISO-8601 timestamp (Asia/Jerusalem), IP, device metadata, user-agent hash.

### Hebrew status

- `PROVIDER_HOST_AGREEMENT_HE_DRAFT` (lines 482-733): clean prose mirror of 23 EN sections.
- `PROVIDER_HOST_AGREEMENT_HE_RAW` (lines 758-864): CEO's mobile-RTL chat paste, preserved for provenance, NOT for display.

**Counsel must verify draft before promotion to verified body.**

---

## §6 Invoice arrangement — generation exists, ARRANGEMENT not captured

| Component | File:Line | Status |
|---|---|---|
| PDF generator | `server/services/IsraeliInvoiceGenerator.ts` | Hebrew + English |
| Route | `server/routes/contractor-invoices.ts` | GET generate + GET preview |
| Schema | `taxInvoices` (`shared/schema.ts:1392`), `electronicInvoices` (`shared/schema.ts:3004`) | exist |
| Arrangement capture | NONE | No field for self-invoice vs PetWash-on-behalf |

### The Wolt model — חשבונית עצמית (self-invoice on behalf)

Wolt Israel does the following for their independent couriers:
1. Courier registers as עוסק פטור (or עוסק מורשה).
2. At onboarding, courier authorizes Wolt to issue tax invoices on their behalf (חשבונית עצמית).
3. Wolt aggregates earnings + automatically generates monthly invoices in courier's name.
4. Tax Authority registered Wolt as authorized invoice issuer for these contractors.

**For PetWash:**
- Requires written power-of-attorney text in the contractor agreement.
- Requires CPA-reviewed wording on the invoice itself ("issued by Pet Wash Ltd on behalf of [provider name]").
- Requires Tax Authority registration of PetWash as authorized issuer.

**Decision needed (§13 below):** offer Wolt-model or require self-invoicing only?

---

## §7 Liability separation — "PetWash is not an insurance company"

Per CEO directive #3, PetWash is:
- **NOT an employer** — providers are independent contractors (§2 of agreement).
- **NOT an insurance company** — providers carry their own liability (§5, §6).
- **NOT a transport carrier** — for pet-transport flows, providers transport at their own risk.
- **IS a technology platform + marketplace facilitator** — matching, payments, support coordination.

### Current state

Agreement §6 contains a strong insurance disclaimer (lines 272-281). **But:**
- It's buried inside the larger agreement.
- No separate acceptance checkbox.
- No counsel sign-off yet.
- Israeli courts may still apply platform liability in specific cases (case-by-case).

### Recommended addition

A SEPARATE acceptance checkbox at Step 3 of onboarding:

> ☐ I understand that PetWash is a technology platform + marketplace facilitator, not an insurance company, employer, or transport carrier. I provide pet care services as an independent contractor. I am responsible for my own liability insurance.

Bilingual. Required. Stored in `insuranceDisclaimerAcceptedAt` column (new).

---

## §8 Competitor analysis (per CEO directive #4)

How the comparable platforms structure their contractor onboarding.

### §8.1 Wolt Israel (food + grocery couriers)

**Structure:**
1. Tax-entity declaration upfront (עוסק מורשה / פטור / חברה).
2. Bank account capture before any earnings activity.
3. Digital contract signature (canvas-based).
4. Wolt issues חשבונית עצמית on behalf of couriers (Tax Authority pre-registered).
5. Monthly payout cycle. Weekly available for premium tiers.
6. Couriers explicitly NOT Wolt employees (court tested 2023, Wolt won).

**Lessons for PetWash:**
- Tax entity is captured at onboarding, not deferred.
- Bank account is captured before any payout-eligible activity.
- "Not employer" language is explicit + tested in Israeli court.
- Self-invoicing on behalf is the default — provider can opt out to self-issue.

### §8.2 Uber (Israel — UberEats + ride share)

**Structure:**
1. Government ID + driver's license upload.
2. Background check (third-party API).
3. Vehicle registration (rideshare) or food handling certification (Eats).
4. Bank account.
5. Digital signature on "Driver Services Agreement."
6. Uber issues invoices on driver's behalf (similar to Wolt).
7. Drivers explicitly NOT Uber employees (multiple court cases globally, mixed outcomes).

**Lessons for PetWash:**
- Background check is a TIER mechanism — higher tiers unlock higher-paying jobs.
- Vehicle / cert details are role-conditional, not universal.
- Driver agreement is short + accessible (not 23 sections).

### §8.3 Rover (US — pet sitters / dog walkers)

**Structure:**
1. Basic profile (name, email, phone, photo) — fast.
2. Background check (Checkr API).
3. Services offered + service-area radius.
4. Pet care experience narrative (free text).
5. Photo of self with pet (verification + trust).
6. Bank/Venmo/PayPal payout setup.
7. Trust & Safety policies acceptance (insurance, dispute resolution).
8. Rover Guarantee — Rover-paid insurance coverage up to $25k. **Note: PetWash explicitly opts OUT of this model per CEO directive.**

**Lessons for PetWash:**
- Onboarding is FAST. Rover prioritizes getting providers in the door.
- KYC is staggered: basic identity at signup, deeper checks gated on first booking.
- **Rover Guarantee is the opposite of PetWash's "not an insurance company" position** — important contrast.

### §8.4 MadPaws (Australia — pet sitters)

**Structure:**
1. Profile + photo + bio.
2. Police check + first-aid cert (paid by MadPaws, ~AUD 60).
3. Insurance through MadPaws (yes, they include it — also opposite of PetWash).
4. Services + rates + service-area.
5. Verification badges (police checked, first-aid, etc.) become trust signals.

**Lessons for PetWash:**
- Badges are powerful trust signals — adopt for PetWash without the insurance liability.
- First-aid cert can be a paid-by-provider OR paid-by-platform upgrade.

### §8.5 Israeli contractor classification risk

The big legal risk: **misclassification** (Israeli labor court rules the
"contractor" is actually an employee, owed back-pay + benefits + severance).

Key factors Israeli courts examine:
- Does the platform set the rates? (PetWash partial — pricing tools but provider can adjust)
- Does the platform schedule the work? (No — provider accepts/declines)
- Does the platform provide tools/uniform? (No)
- Is the work exclusive to one platform? (No — providers can multi-home)
- Is the provider economically dependent? (Variable)

**Wolt's 2023 court win** established that gig couriers in Israel CAN be
classified as independent contractors IF the platform avoids exclusivity +
allows free rejection of jobs. PetWash should explicitly mirror this pattern
in the agreement and the operational facts.

---

## §9 Verification levels (provider tiers)

Per CEO directive #4 (analyze risk tiers + verification levels):

| Tier | Verification level | Unlocks |
|---|---|---|
| **Basic** | Identity verified (ID number + Luhn check) + phone + email | Profile listed (read-only) |
| **Verified** | + Government ID document number (no photo) + bank account verified | Accept bookings, low-risk services |
| **Background-checked** | + Police certificate (optional, future) | Higher-risk services (overnight, home access) |
| **Premium** | + First-aid certification (optional, future) | Premium booking tier, highest rates |
| **Enterprise** | + Insurance certificate validated (provider-supplied) | Enterprise contracts, municipal partnerships |

### Risk tiers by service type (already in code)

`client/src/pages/ProviderOnboarding.tsx` already detects enhanced verification
triggers:
- `home_access` — provider enters customer's home
- `overnight_sitting` — provider stays overnight
- `key_holding` — provider receives customer's keys
- `pet_transport` — provider transports pet (PetTrek platform)

These should map directly to required tier levels.

---

## §10 Dispute handling boundaries (platform liability separation)

Per CEO directive #3, PetWash is a marketplace facilitator. **PetWash facilitates
disputes, but does not adjudicate liability.** Concrete rules:

| Scenario | PetWash role | NOT PetWash role |
|---|---|---|
| Customer claims provider was late | Surface complaint to provider, mediate refund per policy | Pay damages from PetWash account |
| Customer claims pet was injured | Direct customer to provider's insurance OR police, offer support coordination | Provide insurance coverage |
| Provider claims customer was abusive | Suspend customer pending review, offer provider support | Punitive payment to provider |
| Provider's vehicle damaged transporting pet | Facilitate provider's insurance claim | Replace vehicle |
| Pet wash equipment damages pet | Customer claim against equipment manufacturer (provider's responsibility under §3) | PetWash pays |
| Chargeback / payment dispute | Adjudicate per Tranzila/Summit dispute process | Refund unilaterally |

**Provider agreement §6 covers most of this.** Implementation gap: customer
support flows must NOT promise outcomes that violate this boundary.

---

## §11 10-PR sequence (Path E delivery plan)

Each PR is independently revertible. Schema changes are additive. Order is by
dependency.

### PR-E1 — Schema extensions (contractor model)

**Files:**
- `shared/schema-enterprise.ts` (extend `provider_applicants` table)
- New columns: `taxEntityType`, `taxEntityNumber`, `vatNumber`, `bankAccountNumber`, `bankBranchCode`, `bankCode`, `bankIban`, `bankAccountVerified`, `invoiceArrangementType`, `contractorAgreementSignedAt`, `contractorAgreementVersion`, `contractorSignatureId`, `insuranceDisclaimerAcceptedAt`
- Migration with NULL defaults (no data loss)

**Risk:** MEDIUM (schema migration on production table). Backfill on staging first.
**Rollback:** drop new columns, revert migration.
**Mobile Safari verify:** N/A (server-only).

### PR-E2 — Tax-entity + bank capture UI (onboarding Step 1.5)

**Files:**
- `client/src/pages/ProviderOnboarding.tsx`
- New form section between Step 1 and Step 2
- Radio/dropdown for tax entity type (with Hebrew + English labels)
- Conditional VAT number field (if עוסק מורשה)
- Conditional company registration number (if חברה בע״מ)
- Bank fields: account, branch, code, IBAN
- IBAN format validation (ISO 13616 checksum)
- Bilingual labels throughout

**Risk:** LOW (UI only).
**Rollback:** remove section, schema columns nullable.
**Mobile Safari verify:** mandatory. Bank fields are scroll-heavy on iPhone SE.

### PR-E3 — Bank verification service

**Files:**
- `server/services/IsraeliBankVerification.ts` (new)
- IBAN parser + checksum
- Bank code lookup table (Hapoalim 12, Leumi 10, etc.)
- Branch range validation
- Optional: external bank API integration (deferred)

**Risk:** LOW (internal service).
**Rollback:** disable bank-API call, keep format check.

### PR-E4 — Tax-entity validator

**Files:**
- `server/services/IsraeliTaxEntityValidator.ts` (new)
- Validate enum
- Conditional VAT number required for עוסק מורשה
- Conditional company number for חברה בע״מ
- Mock Tax Authority lookup (deferred to PR-E10)

**Risk:** LOW.
**Rollback:** simple revert.

### PR-E5 — Digital signature integration

**Files:**
- `client/src/pages/ProviderOnboarding.tsx` — new Step 3.5 (signature)
- `shared/petwash_subcontractor_legal_esign_2025.ts` — already exists; wire to onboarding
- `server/routes/subcontractor-agreements.ts` — already exists; ensure auth + ownership
- Canvas-based drawn signature primary, typed-name fallback
- Store: `contractorAgreementSignedAt`, `contractorAgreementVersion`, `contractorSignatureId`

**Risk:** MEDIUM (canvas browser compatibility).
**HARD GATE:** counsel must sign off on signature wording + stored evidence format before this PR ships.
**Mobile Safari verify:** mandatory. Drawn signature on iPad with Apple Pencil should work natively.

### PR-E6 — Invoice arrangement capture

**Files:**
- `client/src/pages/ProviderOnboarding.tsx` (Step 3)
- Two radio buttons:
  - "I will issue my own tax invoices (חשבונית עצמית by provider)"
  - "PetWash may issue invoices on my behalf (Wolt model)"
- Conditional text if "PetWash behalf" selected — power-of-attorney language
- If "self-invoice": confirm provider has `hasValidHeshbonitMasSystem`
- Store in `invoiceArrangementType`

**HARD GATE:** CPA review of "PetWash behalf" wording.
**Risk:** LOW (capture only).
**Rollback:** ignore field, assume self-invoice.

### PR-E7 — "Not insurance" explicit acceptance checkbox

**Files:**
- `client/src/pages/ProviderOnboarding.tsx` (Step 3)
- Standalone checkbox: "I understand PetWash is not an insurance company..."
- Bilingual label
- Store `insuranceDisclaimerAcceptedAt` timestamp

**Risk:** LOW (additive checkbox).
**Rollback:** remove checkbox; keep agreement §6 text.

### PR-E8 — Hebrew agreement counsel-approval flip

**Files:**
- `shared/legal/providerHostAgreement.ts`
- After counsel verifies Hebrew prose:
  - Move `PROVIDER_HOST_AGREEMENT_HE_DRAFT` → `PROVIDER_HOST_AGREEMENT_HE`
  - Flip `PROVIDER_HOST_AGREEMENT_HE_VERIFIED = true`
  - Flip `PROVIDER_HOST_AGREEMENT_COUNSEL_APPROVED = true`

**HARD GATE:** Israeli lawyer must approve.
**Risk:** LEGAL — must be 100% counsel-approved before flip.
**Rollback:** revert to draft state.

### PR-E9 — Booking-gate enforcement middleware

**Files:**
- `server/middleware/providerGate.ts` (new or extend existing)
- Before allowing first booking acceptance:
  - Check `PROVIDER_HOST_AGREEMENT_COUNSEL_APPROVED === true`
  - Check `contractorAgreementSignedAt !== null`
  - Check `contractorAgreementVersion === current`
  - Check `bankAccountVerified === true` OR specific deferral allowed
- Return 403 with helpful message + onboarding link

**Risk:** MEDIUM (may block existing partial-onboarding providers; needs migration / re-acceptance flow).
**Rollback:** disable middleware, allow bookings regardless.

### PR-E10 — CPA-reviewed invoice issuance wording

**Files:**
- `server/services/IsraeliInvoiceGenerator.ts`
- New constants file: `shared/legal/invoicePowerOfAttorney.ts`
- If `invoiceArrangementType === 'PETWASH_BEHALF'`:
  - Invoice template includes Hebrew line: "חשבונית זו מונפקת ממרשם הספקים של פט וואש בע״מ בהוראת ובתיווך [ספק שם]"
  - Store CPA-approved text in constant
- Only invoke if provider is עוסק מורשה (verified)

**HARD GATE:** CPA sign-off required before deployment.
**Risk:** TAX COMPLIANCE — wrong wording = Tax Authority rejection.
**Rollback:** revert to self-invoicing only.

---

## §12 What requires lawyer + CPA BEFORE coding

These are blocking dependencies. Engineering can parallelize but cannot ship
without these in hand.

### Lawyer review

1. **Contract draft EN + HE** — `shared/legal/providerHostAgreement.ts`
   - §0 (Definitions) — done
   - §2 (Independent Contractor) — done; tested in Israeli court via Wolt precedent
   - §6 (Insurance Disclaimer) — done in EN; HE awaiting verification
   - §9 (Tax & Compliance) — done
   - §22 (Digital Acceptance) — done; needs counsel confirmation on storage format + retention
   - **Counsel approval flag must flip after sign-off**

2. **"Not insurance" wording** — current §6 is strong, but lawyer should:
   - Confirm wording against Israeli Insurance Law 1981
   - Cross-reference recent case law (2024-2026)
   - Suggest any additional defensive language

3. **Hebrew prose verification** — `PROVIDER_HOST_AGREEMENT_HE_DRAFT` (lines 482-733) needs native-speaker legal review.

4. **Privacy disclosures** — for ID + bank collection, must satisfy Israeli Privacy Protection Law Section 17 (sensitive data).

### CPA review

1. **Tax declaration wording**
   - Provider self-declaration: tax status, VAT registration, Mas Hachnasa filing obligation, Bituach Leumi obligation.
   - Language must align with Israeli Tax Authority expectations.

2. **Invoice arrangement legal language**
   - Power-of-attorney text for "PetWash on behalf" model.
   - Provider indemnification clause for tax compliance errors.
   - Invoice wording on issuer identity.

3. **Tax Authority registration**
   - PetWash must register with Israeli Tax Authority as authorized self-invoice issuer (if offering Wolt model).
   - This is a one-time application — but takes weeks.

### Privacy specialist

1. **Bank data encryption** — AES-256-GCM at application layer (not DB-only).
2. **ID hashing** — already implemented per `kyc.ts hashIdNumber` per audit.
3. **Retention windows** — 24 months for KYC docs, 7 years for tax invoices.
4. **Section 7 disclosures** — privacy notice in agreement.

---

## §13 Decisions awaiting CEO

- **E-A.** Invoice arrangement model — offer Wolt-style "PetWash on behalf" OR require providers to self-invoice only?
  *Recommendation: offer both. Default self-invoice. Provider can opt into "PetWash on behalf" if עוסק מורשה — Tax Authority registration required first.*
- **E-B.** Signature method — native canvas (drawn) primary OR DocuSign integration?
  *Recommendation: native canvas (drawn) primary + typed-name accessibility fallback. DocuSign deferred until enterprise B2B demands it.*
- **E-C.** Verification tier model — basic / verified / background-checked / premium / enterprise (5 tiers) OR simpler model?
  *Recommendation: 3 tiers at MVP (basic / verified / background-checked). Premium + enterprise added later when demand exists.*
- **E-D.** Police background check — paid by provider, paid by PetWash, or optional?
  *Recommendation: optional for MVP. Paid-by-provider as unlock. Paid-by-PetWash for top-tier providers later.*
- **E-E.** First-aid certification — required, optional unlock, or out of scope?
  *Recommendation: optional unlock. Adds verification badge. Provider pays for course externally.*
- **E-F.** Wolt's 2023 court precedent — explicitly mirror its operational facts (no exclusivity, free rejection, set own hours)?
  *Recommendation: YES. Make these facts explicit in agreement + operational reality. This is the cleanest path to defensible contractor classification in Israeli court.*

---

## §14 Schema additions required (Phase 1)

```sql
-- provider_applicants table extensions
taxEntityType            varchar(50)   -- PRIVATE_INDIVIDUAL | OSEK_PATUR | OSEK_MURSH | COMPANY_LTD | NON_PROFIT | OTHER
taxEntityNumber          varchar(50)   -- ID (11 digits) or company number (9 digits)
vatNumber                varchar(50)   -- VAT registration (often same as ID for OSEK_MURSH)
bankAccountNumber        varchar(50)   -- 9-digit Israeli account number (encrypted at app layer)
bankBranchCode           varchar(10)   -- 2-3 digit branch (סניף)
bankCode                 varchar(10)   -- 2-3 digit bank identifier
bankIban                 varchar(50)   -- Full IBAN (encrypted at app layer)
bankAccountVerified      boolean       DEFAULT false
invoiceArrangementType   varchar(50)   -- SELF_INVOICE | PETWASH_BEHALF
contractorAgreementSignedAt timestamp
contractorAgreementVersion  varchar(50)
contractorSignatureId       varchar(100)
insuranceDisclaimerAcceptedAt timestamp
```

All NULLABLE initially. Required-on-first-booking enforced by PR-E9 middleware.

**Encryption keys:** add `bankDetailsEncryptionKeyVersion` column for AES-256-GCM key rotation.

---

## §15 Risk assessment

| Risk | Severity | Mitigation |
|---|---|---|
| **Tax Authority audit** — wrong invoice wording on "PetWash behalf" | HIGH | CPA review of all wording before deploy + Tax Authority pre-registration |
| **Provider lawsuit** — claims relied on insurance promises despite §6 | MEDIUM | Separate "not insurance" checkbox (PR-E7) + counsel-approved wording + digital signature with timestamp |
| **Privacy Authority inquiry** — ID + bank data mishandled | MEDIUM | AES-256-GCM at app layer + ID hashing + 24-month KYC retention + Section 7 privacy disclosures |
| **Customer lawsuit re: insurance gap** | MEDIUM | Strong §6 + separate checkbox + counsel may recommend PetWash buys E&O insurance despite disclaimer |
| **Misclassification suit** — labor court rules contractors are employees | HIGH | Mirror Wolt 2023 precedent operationally (no exclusivity, free rejection, own hours) — see §13 E-F |
| **Bank API rate limits** | LOW | Optional integration; format validation alone is sufficient at MVP |
| **Counsel review takes longer than expected** | HIGH (timeline) | Engineering parallelizes; signature enforcement gated behind counsel flag |

---

## §16 PR template requirements (per CEO directive #6)

Every Path E PR must include:

- ✅ iPhone Safari verification (mandatory for any UI touching onboarding)
- ✅ iPad Safari verification (mandatory; signature drawn on iPad with Apple Pencil)
- ✅ Interruption recovery behavior described (mid-signature browser close, mid-bank-form network drop, etc.)
- ✅ Exact route/state diagram
- ✅ Fallback analysis (what happens if signature canvas fails? bank API errors? Tax Authority registration not in place?)
- ✅ **Legal-risk notes** (mandatory for Path E — every PR touches contractor classification, tax, or liability)
- ✅ Counsel / CPA sign-off attached where applicable (PRs E5, E6, E8, E10)

---

## §17 Five-filter analysis (per SKILL.md §0.8)

| Filter | Verdict |
|---|---|
| Better? | ✓✓✓ Wolt-grade infrastructure beats current half-built wizard |
| Cheaper? | ✓ Reuse 80% existing code; counsel + CPA fees are real but bounded |
| Faster? | ✓ ~7-10 weeks with counsel running in parallel |
| Easier? | ✓✓ Wiring beats greenfield |
| Luxurious? | ✓✓✓ A defensible contractor model IS the luxury in this space |

**Honest miss:** counsel review timing is unpredictable. Plan for 4-6 weeks of
counsel/CPA work running in parallel with engineering. If counsel comes back
faster, engineering catches up; if slower, engineering ships behind a feature
flag.

---

## §18 Strategic equation check (§0.7)

```
PetWash™ =
  premium pet-care infrastructure       ← provider-side hardware + service ✓
  + safer everyday washing               ← provider liability discipline ✓
  + cleaner urban living                 ← N/A here
  + eco-conscious operations             ← N/A here
  + scalable deployment system           ← contractor model = scalability ✓
  + luxury brand discipline              ← clean legal infrastructure ✓
```

Path E strengthens 4 of 6 terms. No degradation.

---

## §19 Architectural pillars (CEO directives #1-#6)

This audit and all Path E PRs honor:

1. **Path A stays narrow** — provider onboarding is NOT signup. Path A ended at identity capture. Path E is its own infrastructure.
2. **Path D ≠ Path E** — customer enrichment is luxury ecosystem; provider rebuild is legal infrastructure. Different audiences, different aesthetic, different risk profile.
3. **PetWash is not employer / insurance / transport carrier** — every artifact reinforces marketplace facilitator role.
4. **Wolt / Uber / Rover / MadPaws analyzed** — §8. Wolt model adopted, Rover's insurance model explicitly rejected.
5. **Deterministic onboarding state machine** — see §11 PR-E9 enforcement. No silent role inference.
6. **PR template requirements** — every Path E PR ships with iPhone Safari, iPad Safari, interruption recovery, route/state diagram, fallback analysis, legal-risk notes.

---

## §20 What this PR does NOT do

- No code changes
- No schema migration
- No counsel/CPA engagement triggered
- No new dependencies
- No CI workflow change
- No protected systems touched (wallet, K9000, Nayax, Tranzila — all unchanged)
- No PR-E1 through PR-E10 opened (gated on CEO decisions E-A through E-F + counsel/CPA readiness)

---

## §21 References

- `docs/SIGNUP_ONBOARDING_FORENSIC_AUDIT.md` — Path A (signup)
- `docs/MOBILE_FIRST_2026_REBUILD_AUDIT.md` — strategic rebuild
- `docs/PATH_D_CUSTOMER_ENRICHMENT_AUDIT.md` — customer-side companion
- `client/src/pages/ProviderOnboarding.tsx` — current 3-step wizard
- `server/routes/provider-applications.ts` — current server-side
- `shared/schema-enterprise.ts:1677-1763` — provider_applicants table
- `shared/petwashIsraeliContractors.ts` — tax entity types
- `shared/legal/providerHostAgreement.ts` — 916-line agreement (EN verified, HE draft)
- `src/petwash_subcontractor_legal_esign_2025.ts` — digital signature service
- `server/services/IsraeliInvoiceGenerator.ts` — PDF invoice generator
- `.claude/skills/petwash-platform/SKILL.md` §0 (luxury discipline) + §2 (protected systems) + §3 (governance)

---

**End of Path E audit.** No code ships. Implementation gated on:
- CEO decisions E-A through E-F in §13
- Israeli lawyer approval of agreement (Hebrew + English)
- Israeli CPA approval of tax + invoice wording
- Israeli Tax Authority registration (if Wolt model selected)
