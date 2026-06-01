# SDD: Privacy Doctrine — חוק הגנת הפרטיות 1981 + GDPR Equivalence + Future Multi-Jurisdictional

| | |
|---|---|
| **Status** | Draft (privacy gate doctrine — no code) |
| **Date** | 2026-05-27 |
| **Author** | SDD Writer Agent (PetWash) |
| **Operator** | nir.h@petwash.co.il |
| **Feature flag** | `privacy.doctrine.v1` (default **OFF**; per-surface enforcement flag family below) |
| **Method** | `.github/skills/sdd-writer-iterative/SKILL.md` |
| **Branch** | `claude/sdd-privacy-doctrine` |
| **Doctrine class** | Cross-cutting platform policy (gates Tentacle 14 Vet / Pet Health and every PII-touching surface) |

---

## 0. Operator framing (preserve verbatim — see Appendix A)

Operator directive (2026-05-27): *"Save us, secure us and make us better, top global pet lifestyle hub, platforms, shop, free activity, fun, attractive, perks, most advanced globally if total offering of services and tech. Launch 🚀 both."*

This SDD is the **"secure us"** half of that directive. Privacy is the legal and reputational moat that keeps the operator personally indemnified, that lets the platform pass enterprise-security review (the franchise-expansion gate), and that gates Tentacle 14 (Vet / Pet Health) — because pet medical records are **special-category personal data** under every jurisdiction we plan to operate in. Without this doctrine landed first:

- Tentacle 14 cannot ship (vet records have no lawful basis for storage).
- The Israeli right-to-be-forgotten (חוק הגנת הפרטיות 1981, last amended 2017) cannot be honoured at platform scale.
- The 72-hour breach-notification rule (GDPR Art. 33) has no runbook.
- Israeli adequacy decision (EU 2011) — which is the platform's cheapest path to EU expansion — could be revoked if Israel's regulator finds PetWash non-compliant.
- "ONE IDENTITY" (operator's cross-platform identity unification principle) has no privacy basis: each platform identity is a separate processing operation unless consolidated under one lawful basis.

This SDD does NOT solve the operator's "make us better / fun / attractive / perks" vision — those belong in engagement SDDs. This is the brake, not the accelerator.

---

## 1. Summary

This doctrine is a **single, repository-grounded source of truth** for how PetWash handles personal data across jurisdictions. It (a) classifies every existing PII field into one of four classes — public / personal / sensitive / special-category — using a rule-plus-worked-examples approach over the 446-table `shared/schema.ts`; (b) defines the data-subject-rights surface (access, rectification, erasure, portability, object, no-automated-decision) and how each maps to existing services (`server/services/ConsentService.ts`, `DataRetentionService.ts`, `softDeleteService.ts`, `secretFieldCrypto.ts`, `PiiMinimizer.ts`); (c) formalises a consent-management model that **reuses** the already-present `user_consents`, `consent_snapshots`, `biometric_consents`, `oauth_consents`, `booking_consents`, and `user_notification_consents` tables; (d) defines retention windows per data class in a new queryable `data_retention_rules` table (proposal) so retention is configuration, not hardcoded SQL; (e) defines the breach-response runbook (detection → containment → assessment → 72h notification → post-mortem); (f) publishes a subprocessor registry seeded from `.env.example` + `server/services/*` audit; (g) handles cross-border transfer (IL→EU adequacy; IL→US Schrems II caveat); (h) isolates AI/ML training data so Gemini and other LLMs never receive special-category data without explicit per-purpose consent; (i) sets a children's-privacy floor at age 16 with guardian-consent flow for under-16 owners.

**Key finding from repository review:** much of the *primitive* infrastructure already exists — `user_consents` (`shared/schema.ts:12252`), `data_export_requests` (`shared/schema.ts:15480`), `account_deletion_requests` (`shared/schema.ts:15443`), `DataRetentionService.ts` (783 lines) including `exportUserData()` (line 638) and per-table erasure logic (lines 454–571), `PiiMinimizer.ts`, `secretFieldCrypto.ts` (encrypts at column level with key bootstrap), `softDeleteService.ts`. The work this doctrine commissions is therefore **convergence, gap-fill, and explicit policy** — not green-field rebuild. The two genuine new pieces are: a `data_retention_rules` table (so retention is queryable per data-class), and a subprocessor registry table + public page.

This SDD is one document. It gates a six-PR implementation roadmap (§20).

---

## 2. Goals / Non-goals

### Goals
- One taxonomy: public / personal / sensitive / special-category — applied to every PII field across `shared/schema.ts`.
- Data subject rights wired end-to-end: access (export), rectification, erasure (with cryptographic-erasure fallback for legal-hold data), portability (JSON+CSV), object (marketing), no-automated-decision (appeal path).
- Consent management is **opt-in only**; pre-ticked boxes BANNED platform-wide; consent versioned; immutable consent audit.
- Retention windows are configuration, not code: new `data_retention_rules` table.
- Breach response is a runbook with named owners, kill-switch references, 72h notification template registry.
- Subprocessor registry is public, auditable, and per-subprocessor lists data classes + DPA status + jurisdiction.
- Cross-border transfer per-subprocessor rule book.
- AI/ML data isolation: special-category data never flows to Gemini or any LLM without explicit per-purpose consent.
- Children's age-gate (16+) with guardian-consent flow for under-16.
- Pet medical / vet data hardened to special-category (matches Tentacle 14 prerequisite).

### Non-goals (explicit out-of-scope)
- **PCI DSS** (separate doctrine — payment-card data handling; this doctrine assumes payments are tokenised already).
- **AML** (separate doctrine — money-laundering reporting; intersects with retention via legal-hold).
- **Implementation code for each surface's erasure path** (every surface gets its own implementation PR after this doctrine lands — see §20).
- **Octopus diagram update** (Tentacle 11 already covers regulatory; this doctrine sits inside it as a sub-domain).
- Operator's "fun / attractive / perks" vision items (those belong to engagement SDDs).
- Specific re-platforming of any subprocessor (e.g., moving off SendGrid). That is a separate procurement question.
- Browser-cookie consent banner UX (this doctrine sets the rule; the cookie-banner implementation is a small surface PR, not a doctrine question).

---

## 3. Repository context — what exists today

The platform already has substantial privacy primitives. The doctrine reuses them rather than reinventing.

### 3.1 Consent infrastructure
- `shared/schema.ts:12252` — `user_consents` (the canonical consent table: `userId, consentType, consentVersion, consentTextHash, accepted, acceptedAt, method, ip, userAgent, deviceId, locale, source, traceId, evidenceHash`). Indices on `(userId)` and `(consentType, consentVersion)`. **This is the table this doctrine adopts as the single source of truth.**
- `shared/schema.ts:12412` — `consent_snapshots` (immutable snapshots of consent text by version + content hash; supports "what did the user actually agree to" reconstruction).
- `shared/schema.ts:5813` — `biometric_consents` (separate table for biometric-specific consent: document + biometric processing, document/biometric consent timestamps, consent version, IP, revocation fields). Special handling for biometric special-category.
- `shared/schema.ts:5860` — `oauth_consents` (third-party OAuth consent: terms version + privacy policy version captured per OAuth grant).
- `shared/schema.ts:4385` — `booking_consents` (per-booking owner/sitter consent for service-specific terms).
- `shared/schema.ts:15379` — `user_notification_consents` (per-channel marketing/transactional consent — extends the user-table booleans).
- `shared/schema.ts:35–160` — `users` table already has: `analyticsConsent`, `ipTrackingConsent`, `emailTrackingConsent`, `marketingConsent`, `privacyConsentUpdatedAt`, `privacyAcceptedAt`, `privacyVersion`, `termsAcceptedAt`, `termsVersion`, `communicationPreferences` jsonb (per-channel: email/sms/whatsapp/push × marketing/transactional/reminders), `suppressionList` jsonb, `unsubscribedAt`, `legalHold` boolean, `softDeleteAt`. **Doctrine note: this is good. The platform already opts-in by default = false for all marketing/analytics.**
- `server/services/ConsentService.ts` (292 lines) — service with `recordConsent()`, `getConsentStatus()`, audit-hash generation, "all consents for user" for GDPR export (line 237 comment).
- `server/services/consentEngine.ts` (148 lines) — lighter helper used by Maya / unified consent surfaces.
- `server/services/NotificationConsentManager.ts` (415 lines) — per-channel notification consent (sms/email/whatsapp/push).

### 3.2 Data subject rights infrastructure
- `shared/schema.ts:15480` — `data_export_requests` (status pending/processing/ready/downloaded/expired/failed; signed `download_url` + `download_url_expires_at`; `downloaded_at`; masked IP). **This is the GDPR Art. 15 + Art. 20 surface.**
- `shared/schema.ts:15443` — `account_deletion_requests` (status pending/processing/completed/rejected/cancelled; `scheduled_erasure_at` cooling-off; `erased_at`; reviewer fields; masked IP). **GDPR Art. 17 surface.**
- `server/services/DataRetentionService.ts` (783 lines):
  - `exportUserData()` at line 638 — collects profile, customer, pets, washHistory, biometricConsents, deletionRequests into a single export object.
  - Per-table erasure logic at lines 454–571 (customerPets, washHistory, biometricConsents, users; anonymises financial records at line 478 leaving amounts + replacing PII with `'ANONYMIZED'`/`anon-<id>@deleted.petwash.local`; also clears Firestore at line 505).
  - Legal-holds cache + Firestore-backed legal-holds collection.
  - Automated retention purge at line 204.
- `server/services/softDeleteService.ts` — `softDeleteUser`, `setLegalHold`, `anonymizeUser`, `getAnonymizationCandidates` (90-day default window after soft-delete).
- `server/services/PiiMinimizer.ts` — PII redaction for outbound Google export channels (`SHEETS | DRIVE_METADATA | FORMS_SUMMARY`); `redactEmail`, `redactPhone`, `redactName`, `minimizeExportPayload`; per-field PII/SAFE/SAFE_FINANCIAL classification.
- `server/services/secretFieldCrypto.ts` — column-level field encryption (`encryptField`, `decryptField`, `isEncrypted`, `maskIban`, `maskAccountNumber`, `maskSwift`) with key bootstrap; **the existing cryptographic-erasure primitive**.

### 3.3 Audit / immutability primitives
- `shared/schema.ts:3583` — `audit_ledger` (the doctrinal append-only audit; hash-chained).
- `shared/schema.ts:12344` — `audit_events` (lighter operational audit).
- `shared/schema.ts:12175` — `kyc_audit_log`.
- `shared/schema.ts:9778` — `compliance_audit_logs`.
- `shared/schema.ts:13218` — `activation_audit_log`.
- `server/services/AuditLedgerService.ts` (691 lines) — the canonical hash-chained ledger.

### 3.4 Pet medical / special-category infrastructure already half-baked
- `shared/schema.ts:7857–7874` — pets table has explicit fields: `skinSensitivity`, `allergies`, `medications`, `specialNeeds`, `vetName`, `vetPhone`, `vaccinationStatus`, `lastVaccinationDate`, `nextVaccinationDate`, `medicalDataPrivate` (default **true**), `medicalShareConsent` (default **false**), `medicalConsentUpdatedAt`. Schema comment: *"MEDICAL DATA — private by default, shared only with explicit consent"*. **The schema-level discipline is right; this doctrine formalises it and extends to vet integration (Tentacle 14).**
- `shared/schema.ts:7829–7838` — `petTemperamentEnum` is **already** privacy-safe with a schema comment: *"Do NOT use 'aggressive' or other stigmatising terms."* Sensitive labelling discipline already in repo.

### 3.5 Gemini / LLM surface — must be governed by this doctrine
- `server/gemini.ts` — main client.
- `server/services/GeminiSpamGuard.ts` (line 29: `GEMINI_API_KEY`) — outbound LLM call; this doctrine forbids passing special-category data to it.
- `server/services/GeminiEmailMonitor.ts`, `GeminiPlatformSecurityMonitor.ts`, `GeminiSecurityAdvisor.ts`, `GeminiUpdateAdvisor.ts`, `GeminiMatchingService.ts`, `GeminiWatchdogService.ts`, `geminiTranslation.ts` — every Gemini call site is subject to §H below.

### 3.6 Subprocessor footprint (from `.env.example` + `server/services/*`)
Initial inventory (full registry in §F):
- Payment / financial: SUMIT, UPay, Nayax, Tranzila (deprecated), SUMIT (electronic invoicing).
- Messaging: Twilio (SMS/voice), SendGrid (email), Meta WhatsApp Business (`WhatsAppMetaService.ts`), FCM (Firebase push).
- Auth / identity: Firebase Auth, Apple Sign-In, Google Sign-In, reCAPTCHA, App Check.
- Google Cloud surface: Maps/Places, Sheets, Drive, Forms, Calendar, Translate, Vision (biometric matching — line 80 of users table), Dialogflow, Cloud Run, Cloud Storage, Cloud KMS, Firestore, Secret Manager, Wallet (Google Wallet pass).
- Apple: Wallet pass certificate.
- AI: Gemini (Google).
- CRM: HubSpot.
- Observability: Sentry.
- Logistics future: AfterShip, Wolt, Israel Post.

### 3.7 Existing relevant services worth knowing
- `server/services/ComplianceControlTower.ts`, `CountryLegalComplianceService.ts`, `IsraelComplianceEngine.ts`, `ITAComplianceMonitoringService.ts`, `IsraeliContractorCompliance.ts`, `TaxComplianceService.ts` — Israeli legal/tax compliance surface, already present.
- `server/services/ThreatGuardService.ts`, `BiometricSecurityMonitor.ts`, `DeviceSecurityAlertsService.ts`, `OAuthCertificateMonitor.ts` — security event surface.
- `server/services/AuditLedgerService.ts` — the hash-chained ledger this doctrine relies on for breach evidence preservation.
- `server/services/systemKillSwitches` table at `shared/schema.ts:14545` and `kill_switch_trigger_rules` at `shared/schema.ts:14710` — already a kill-switch surface this doctrine reuses for breach containment (§E).

### 3.8 Gaps (what this doctrine adds)
1. **No queryable retention-rule table.** Retention is hardcoded in `DataRetentionService.ts` and `log-retention-2025.ts`. Doctrine adds `data_retention_rules`.
2. **No subprocessor registry table or public page.** Doctrine adds `subprocessors` + a public `/legal/subprocessors` route.
3. **No PII classification metadata on schema columns.** Doctrine adds `pii_classification` to retention-rule rows and references each table.
4. **No formal breach runbook in repo.** Doctrine adds it as a doctrine document (this file's §E) plus a runbook reference in `docs/governance/`.
5. **No cross-border transfer per-subprocessor rule.** Doctrine adds it as a column on the new `subprocessors` table.
6. **No AI/ML data-isolation policy enforced at the Gemini service call sites.** Doctrine adds the policy and a `geminiPayloadGuard()` wrapper requirement (implementation deferred to per-surface PRs).
7. **No children's age-gate.** Doctrine sets it at 16 with guardian-consent flow.
8. **`legal_hold` boolean on users exists** (`shared/schema.ts:138`) but no row-level legal hold on individual records. Doctrine notes this as a recommended schema evolution but does not require it in PR-1.

---

## 4. Users, roles, jurisdictions, accessibility

### 4.1 Actors
- **Customer (data subject)** — exercises rights (access, rectify, erase, port, object); grants/withdraws consent.
- **Provider (data subject AND data controller of their own customers' booking notes)** — separate from customer privacy. Provider rights mirror customer rights. Provider is contractually bound (in TOS) not to misuse customer data they see during a booking.
- **Vet / pet-health professional (Tentacle 14)** — special-category data processor; receives data only via explicit per-booking consent.
- **Admin (data controller acting for PetWash)** — must record purpose for every PII access via `audit_events`; bulk operations log to `audit_ledger`.
- **Staff (subset of admin, role-scoped)** — see only the data their role requires; PII minimisation applied for non-essential access via existing role-scoping in `rbac.ts`.
- **Machine / system (Nayax, K9000, Apple Wallet device, Google Wallet, FCM, etc.)** — receives the minimum data the operation requires; logs all events.
- **Subprocessor (SUMIT, Twilio, SendGrid, Firebase, Gemini, Sentry, HubSpot, etc.)** — third-party data processor; bound by DPA + per-subprocessor data classes (§F).
- **Data protection authority (הרשות להגנת הפרטיות, EU DPAs)** — receives breach notification within 72h.
- **Operator (nir.h@petwash.co.il)** — accountable executive for the privacy programme; named in the breach runbook (§E.7).
- **Parent / guardian (when data subject is under 16)** — provides consent on behalf of the minor.

### 4.2 Jurisdictions (in scope)
- **Israel** — חוק הגנת הפרטיות 1981, last amended 2017; הרשות להגנת הפרטיות regulations; tax-records retention rules (פקודת מס הכנסה — 7 years).
- **EU / EEA** — GDPR (Regulation 2016/679). Israel has an adequacy decision (2011) which means routine IL→EU data flow is permitted without additional safeguards. **However, EU→IL of EU data subjects is the same — the design assumes EU citizens may use PetWash, so GDPR strictness is the floor.**
- **United States — CCPA / CPRA** — only triggered if PetWash actively markets to California residents at scale; doctrine designs forward-compatible.
- **Brazil — LGPD** — only triggered if Brazilian expansion happens; doctrine designs forward-compatible.
- **Cross-border subprocessor jurisdictions** — US (Twilio, SendGrid, Sentry, HubSpot, Gemini API, Firebase, Google Cloud), EU (some Google regions if selected). See §G.

### 4.3 Accessibility / localisation
- All consent UI must be RTL Hebrew first; ar / en / ru / fr / es fallbacks per the existing i18n setup.
- Consent text must be in plain language (Israeli regulator guidance + GDPR Art. 12 "clear and plain language").
- Screen-reader compatible (consent must not rely on visual-only cues).
- No "dark patterns": opt-in checkboxes must be the same visual weight as opt-out; "accept all" buttons must be **the same weight or smaller** than "reject all" / "customise".
- Children's UX (under-16) requires age-appropriate language and a guardian-consent screen (§I).

---

## 5. Architecture

### 5.1 High-level data-flow

```
                                     ┌────────────────────────────────┐
                                     │  data_retention_rules (new)    │
                                     │  PII class × table × column ×  │
                                     │  retention_min × retention_max │
                                     │  × lawful_basis × jurisdiction │
                                     └────────────┬───────────────────┘
                                                  │ read by
                                                  ▼
┌─────────────┐     ┌──────────────────┐   ┌──────────────────────┐   ┌──────────────────┐
│   Customer  │────▶│  Consent UI      │──▶│  ConsentService      │──▶│  user_consents   │
│ (data subj) │     │ (RTL, plain HE)  │   │  recordConsent()     │   │ + consent_snapshots│
└─────────────┘     └──────────────────┘   └──────────────────────┘   └──────────────────┘
        │                                                                       │
        │  Right of access / portability / erasure / object                     │
        ▼                                                                       │
┌──────────────────────────┐         ┌────────────────────────────────┐         │
│ /api/me/privacy/*        │────────▶│ DataRetentionService           │─────────┤
│  - export                │         │  - exportUserData()            │         │
│  - delete                │         │  - per-table erasure           │         │
│  - rectify (proxy)       │         │  - cryptographic-erasure path  │         │
│  - object (marketing)    │         │    (delete key, keep blob)     │         │
└──────────────────────────┘         └────────────────────────────────┘         │
        │                                       │                               │
        │                                       │ writes                        │
        ▼                                       ▼                               │
┌──────────────────────────┐         ┌────────────────────────────────┐         │
│ data_export_requests     │         │   audit_ledger (hash-chained)  │◀────────┘
│ account_deletion_requests│         │   audit_events                 │  consent audit
└──────────────────────────┘         └────────────────────────────────┘
                                                  ▲
                                                  │ writes from every
                                                  │ PII access in admin
┌──────────────────────────┐                      │
│   subprocessors (new)    │                      │
│   - name, purpose,       │     ┌────────────────┴──────────────┐
│     data_classes_sent,   │     │  Breach Response (§E)         │
│     jurisdiction,        │────▶│  - detection → containment    │
│     dpa_status,          │     │  - 72h notification template  │
│     transfer_mechanism   │     │  - kill-switch refs           │
└──────────────────────────┘     └───────────────────────────────┘
        │ public page
        ▼
  /legal/subprocessors

┌─────────────────────────────────────────────────────────────────────┐
│  AI / LLM call boundary (Gemini, future LLMs)                       │
│  ──────────────────────────────────────────────────────────────────  │
│  EVERY outbound call MUST:                                          │
│    1) Pass through geminiPayloadGuard()  (new utility)              │
│    2) Strip special-category data unless ai_training_consent OR     │
│       inference-purpose-explicit-consent for the call's user        │
│    3) Log the field-set sent to audit_events (hash, not plaintext)  │
│  No payload may contain pet medical, ID number, biometric tokens,   │
│  or human medical text without an explicit consent record.          │
└─────────────────────────────────────────────────────────────────────┘
```

### 5.2 Happy-path sequence — customer requests "delete my account"

1. Customer taps "Delete my account" in profile (RTL Hebrew UI).
2. Client calls `POST /api/me/privacy/delete` with reason (optional).
3. Server records a row in `account_deletion_requests` (status `pending`, `scheduled_erasure_at = now() + 30 days`).
4. Server records `audit_events` row (action_type=`deletion_requested`).
5. System emails confirmation (idempotent, via `NotificationConsentManager`).
6. Customer has a 30-day window to cancel (cooling-off; matches Israeli regulator guidance).
7. On day 30 a scheduled job (`DataRetentionService.processScheduledErasures`) picks the row up:
   - Checks `users.legalHold` — if true, status moves to `pending_legal_hold_release`, does NOT erase.
   - Checks `data_retention_rules` for legal-hold overrides (tax records, AML, criminal background checks if provider).
   - For data NOT under legal hold: hard delete row-by-row.
   - For data under legal hold (financial records, tax invoices, AML evidence): **cryptographic erasure** — encrypt the PII columns with a per-user key, then delete the key. Blob stays for the legal-mandatory window; PII becomes unrecoverable. Uses `secretFieldCrypto.ts` primitive.
   - Anonymises financial records (current `DataRetentionService` line 478 logic) — name/email replaced with `ANONYMIZED`, email with `anon-<hash>@deleted.petwash.local`.
   - Writes one hash-chained `audit_ledger` entry capturing what was erased, what was cryptographically erased, what was anonymised.
8. Email final confirmation; status → `completed`; `erased_at` stamped.

### 5.3 Failure-path sequence — breach detected

See §E for the full runbook. Key control-flow:
- `ThreatGuardService` / `GeminiPlatformSecurityMonitor` / `BiometricSecurityMonitor` / `DeviceSecurityAlertsService` raise an alert.
- Severity ≥ HIGH triggers `kill_switch_trigger_rules` (`shared/schema.ts:14710`) which arms `system_kill_switches` (`shared/schema.ts:14545`).
- Operator + privacy lead notified (PagerDuty / SMS — see §E.7).
- Incident opened in `incidents` table (`shared/schema.ts:14735`).
- 72-hour clock starts (GDPR Art. 33).
- Notification templates from a new `breach_notification_templates` registry (proposal — not built in PR-1).
- הרשות להגנת הפרטיות notified; affected data subjects notified.
- Post-mortem (`incident_rca`, `shared/schema.ts:14784`) and self-healing rule (`self_healing_rules`, `shared/schema.ts:14798`) authored.

### 5.4 Failure-path sequence — subprocessor breach

Same as §5.3 but the kill-switch points to the **subprocessor integration** (e.g., disable SUMIT outbound, disable Gemini calls), not platform-wide. This already exists as a pattern: `NAYAX_ENABLED`, `SUMIT_ENABLED`, `TRANZILA_*` feature flags. Doctrine adds: every subprocessor MUST be kill-switchable at the integration layer (this is a v2 follow-up if any subprocessor today is hardwired — see §13 risks).

---

## 6. Data model

The doctrine is **additive-first**: it adopts the consent and rights tables that already exist, and adds three new ones.

### 6.1 New tables

#### 6.1.1 `data_retention_rules`
The queryable retention policy. Replaces hardcoded retention in services.

```ts
export const dataRetentionRules = pgTable("data_retention_rules", {
  id: serial("id").primaryKey(),
  // Identification of the data target
  tableName: varchar("table_name", { length: 100 }).notNull(),     // e.g. "pets"
  columnName: varchar("column_name", { length: 100 }),             // null = whole row
  // Classification
  piiClass: varchar("pii_class", { length: 30 }).notNull(),
  // 'public' | 'personal' | 'sensitive' | 'special_category'
  // Lawful basis (GDPR Art. 6 + Art. 9 for special-category)
  lawfulBasis: varchar("lawful_basis", { length: 40 }).notNull(),
  // 'contract' | 'consent' | 'legal_obligation' | 'vital_interest' |
  // 'public_task' | 'legitimate_interest' | 'special_explicit_consent' |
  // 'special_employment_law' | 'special_vital_interest' | 'special_health_care'
  // Retention window
  retentionMinDays: integer("retention_min_days").notNull(),    // legal minimum (e.g. 2555 = 7y tax)
  retentionMaxDays: integer("retention_max_days"),              // privacy maximum (null = until consent withdrawn)
  // Erasure strategy when window expires or subject requests deletion
  erasureStrategy: varchar("erasure_strategy", { length: 30 }).notNull(),
  // 'hard_delete' | 'anonymise' | 'cryptographic_erasure' | 'archive_offline'
  // Jurisdiction scope
  jurisdiction: varchar("jurisdiction", { length: 30 }).notNull().default("IL"),
  // 'IL' | 'EU' | 'US-CA' | 'BR' | 'global'
  // Notes
  rationale: text("rationale"),                                  // why this rule exists
  citation: text("citation"),                                    // statute / regulation reference
  // Lifecycle
  effectiveFrom: timestamp("effective_from").defaultNow().notNull(),
  effectiveTo: timestamp("effective_to"),
  createdBy: varchar("created_by", { length: 128 }),             // admin user id
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_drr_table").on(table.tableName),
  index("idx_drr_pii_class").on(table.piiClass),
  index("idx_drr_jurisdiction").on(table.jurisdiction),
  index("idx_drr_effective").on(table.effectiveFrom, table.effectiveTo),
]);
```

Worked seed rows (illustrative; PR-1 seeds these):

| table_name | column_name | pii_class | lawful_basis | retention_min_days | retention_max_days | erasure_strategy | jurisdiction | rationale |
|---|---|---|---|---|---|---|---|---|
| users | id_number | special_category | special_explicit_consent | 2555 | 2555+90 | cryptographic_erasure | IL | תעודת זהות — required for tax invoice; 7y tax retention then crypto-erased |
| users | latitude | sensitive | consent | 0 | 365 | hard_delete | global | Precise location — max 12 months |
| users | latitude | sensitive | legal_obligation | 0 | 2555 | anonymise | IL | City-level rounded for tax purposes |
| users | marketing_consent | personal | consent | 0 | 30 | hard_delete | global | 30-day buffer post-withdrawal |
| users | passwordHash | sensitive | contract | 0 | null | hard_delete | global | Until account closed |
| users | selfie_photo_url | special_category | special_explicit_consent | 0 | null | cryptographic_erasure | global | KYC biometric — until KYC purpose ends |
| pets | allergies | special_category | special_explicit_consent | 0 | null | hard_delete | global | Pet medical — until owner withdraws |
| pets | medications | special_category | special_explicit_consent | 0 | null | hard_delete | global | Pet medical — until owner withdraws |
| pets | vetName | special_category | special_explicit_consent | 0 | null | hard_delete | global | Pet medical — until owner withdraws |
| bookings | * | personal | contract+legal_obligation | 2555 | null | anonymise | IL | 7y tax retention; PII fields anonymised after 7y |
| tax_invoices | * | personal | legal_obligation | 2555 | null | archive_offline | IL | פקודת מס הכנסה — keep, move to offline archive |
| transaction_records | * | personal+sensitive | legal_obligation | 2555 | null | anonymise | IL | PII anonymised, amounts retained |
| nayax_transactions | * | personal | legal_obligation | 2555 | null | anonymise | IL | Nayax transaction; PII anonymised |
| auth_events | ip, user_agent | sensitive | legitimate_interest | 365 | 2555 | hard_delete | global | Security forensics — 1y default, 7y if incident-tagged |
| location data (GPS tracks) | * | sensitive | consent | 0 | 365 | hard_delete | global | Precise GPS — max 12 months |
| pettrek_gps_tracking | * | sensitive | consent+contract | 0 | 365 | hard_delete | global | Walk GPS; max 12 months from walk completion |
| criminal_background_checks | * | special_category | legal_obligation (provider law) | 365 | 2555 | cryptographic_erasure | IL | Insurance audit; crypto-erase after 7y |
| identity_verifications | * | special_category | legal_obligation | 365 | 2555 | cryptographic_erasure | IL | KYC retention |
| biometric_consents | * | special_category | special_explicit_consent | 0 | null | hard_delete | global | Until withdrawn |
| user_consents | * | personal | legal_obligation | 0 | 2555 | hard_delete | global | Consent audit; 7y |
| consent_snapshots | * | personal | legal_obligation | 0 | 2555 | hard_delete | global | Consent text version archive |
| audit_ledger | * | personal+sensitive | legal_obligation | 2555 | null | archive_offline | IL | Money / fraud audit |
| paw_finder_posts | * | personal | consent | 0 | 365 | hard_delete | global | Lost-pet posts; 12mo after match/withdrawn |
| customer_payment_tokens | last4, etc. | sensitive (PCI-deferred) | contract | 0 | null | hard_delete | global | Until card removed; PCI doctrine governs tokens |

Total seed rows for PR-1: target ~80 rules covering the 25 highest-risk tables. Full table-by-table catalogue lives in a follow-up admin tool.

#### 6.1.2 `subprocessors`
Public-facing registry of third-party data processors.

```ts
export const subprocessors = pgTable("subprocessors", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 100 }).notNull().unique(),
  purpose: text("purpose").notNull(),                       // human-readable
  // Data classes shared (multi-valued; csv or jsonb)
  dataClasses: jsonb("data_classes").notNull(),
  // e.g. ["personal.email","personal.phone","sensitive.payment_metadata"]
  // Subprocessor's primary jurisdiction(s)
  jurisdiction: varchar("jurisdiction", { length: 60 }).notNull(),
  // Transfer mechanism for IL/EU → other
  transferMechanism: varchar("transfer_mechanism", { length: 40 }),
  // 'adequacy' | 'sccs' | 'bcrs' | 'derogation' | 'none'
  // Lawful basis we rely on to share
  lawfulBasis: varchar("lawful_basis", { length: 40 }).notNull(),
  // DPA (Data Processing Agreement) state
  dpaStatus: varchar("dpa_status", { length: 30 }).notNull(),
  // 'in_place' | 'pending' | 'not_required' | 'missing'
  dpaUrl: varchar("dpa_url", { length: 512 }),              // link or storage ref
  dpaSignedAt: timestamp("dpa_signed_at"),
  // Kill-switch reference (must be present)
  killSwitchKey: varchar("kill_switch_key", { length: 100 }),  // FK to system_kill_switches.key
  // Public visibility
  publishedOnPublicRegistry: boolean("published_on_public_registry").default(true).notNull(),
  // Operator notes
  notes: text("notes"),
  // Lifecycle
  startedAt: timestamp("started_at"),
  endedAt: timestamp("ended_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_subproc_name").on(table.name),
  index("idx_subproc_dpa_status").on(table.dpaStatus),
  index("idx_subproc_jurisdiction").on(table.jurisdiction),
]);
```

Initial seed (full list in §F).

#### 6.1.3 `breach_notification_templates`
Registry of breach notification copy per channel × jurisdiction × severity. Pulled at incident time. Reuses existing `notification_templates` table pattern. **Optional for PR-1** (templates can live as static markdown until automation is added).

### 6.2 Reused tables (no change)
- `user_consents` (`shared/schema.ts:12252`) — adopted as canonical consent table.
- `consent_snapshots` (`shared/schema.ts:12412`).
- `biometric_consents` (`shared/schema.ts:5813`).
- `oauth_consents` (`shared/schema.ts:5860`).
- `booking_consents` (`shared/schema.ts:4385`).
- `user_notification_consents` (`shared/schema.ts:15379`).
- `account_deletion_requests` (`shared/schema.ts:15443`).
- `data_export_requests` (`shared/schema.ts:15480`).
- `audit_ledger` (`shared/schema.ts:3583`), `audit_events` (`shared/schema.ts:12344`).
- `incidents` (`shared/schema.ts:14735`), `incident_timeline_entries`, `incident_rca`, `self_healing_rules`.
- `system_kill_switches`, `kill_switch_trigger_rules`.

### 6.3 Additive column proposals (per-table)
Defer to follow-up PRs:
- `pets.medicalRetentionOverrideUntil` — owner override for how long medical data is retained (default = until consent withdrawn).
- `users.dateOfBirth` is currently `varchar` (`shared/schema.ts:45`); recommend tightening to `date` and using it for the age-gate (§I). Not blocking for PR-1.
- `users.under16GuardianConsentBy` and `users.under16GuardianConsentAt` (if §I is enforced).

---

## 7. Security, fraud, and threat model

The doctrine inherits the platform's invariants (money is sacred; backend source of truth; idempotency; immutable audit). It adds the privacy-specific threats below.

| # | Threat | Control |
|---|---|---|
| T1 | Customer exports another customer's data (IDOR on `/api/me/export`) | Authenticated session + force-equal `req.user.id == export.userId`; audit row on every export request |
| T2 | Admin exports a customer's data without legitimate purpose | Admin export endpoint requires `purpose` field, writes `audit_events` with `actorRole=admin`, `actionType=admin_data_export`, `metadata={purpose, ticketId}` |
| T3 | Admin reads pet medical data ad-hoc | RBAC scope check (`rbac.ts`); only `role=admin_medical` or vet integration with explicit `medicalShareConsent=true` on the pet may decrypt the medical columns |
| T4 | Cancelled deletion request reactivates the user but PII has already been crypto-erased | Cooling-off (30d) **before** erasure begins; cancel within window is a status flip; after erasure the row is unrecoverable by design |
| T5 | Backup tape contains pre-erasure PII | `finance_archive_policies` (`shared/schema.ts:13687`) + retention policy MUST honour the cryptographic-erasure key so backup PII is also unreadable when key is destroyed |
| T6 | Gemini API call leaks special-category data | `geminiPayloadGuard()` — every outbound LLM call must declare field set; payloads containing special-category fields are rejected unless an explicit `ai_inference_consent` row exists for that user+purpose |
| T7 | Subprocessor breach (SUMIT, Twilio, etc.) | Per-subprocessor kill-switch; subprocessor breach treated under §E with subprocessor-scoped notification |
| T8 | Cross-border transfer without lawful basis (IL→US) | `subprocessors.transferMechanism` enforced; any new subprocessor added without a DPA + SCC is blocked at onboarding |
| T9 | Consent forged (someone records consent on the user's behalf) | Existing `user_consents` captures `ip`, `userAgent`, `deviceId`, `traceId`, `evidenceHash`; consent UI requires re-auth for material consent (marketing → AI training escalation) |
| T10 | Marketing consent withdrawn but suppression not applied (still receive emails) | `users.suppressionList` jsonb + `unsubscribedAt`; existing `NotificationConsentManager.ts` honours this; doctrine REQUIRES every outbound send to pass through `NotificationConsentManager.shouldSend()` (no direct SendGrid / Twilio calls bypassing it) |
| T11 | Child (under 16) signs up without guardian consent | Age-gate at signup; if `dateOfBirth` indicates under-16, registration is paused until guardian email + consent received |
| T12 | Vet integration sends pet medical to wrong vet | Per-vet share-token + `medicalShareConsent=true` AND `medicalShareConsentScope` (vet-id) — must match recipient |
| T13 | Soft-deleted user is re-indexed by analytics | `softDeleteAt` filter must be applied at every CRM / analytics / segmentation query; new doctrinal lint or query helper to enforce |
| T14 | Right-to-be-forgotten conflicts with legal hold | `users.legalHold` overrides erasure; user is shown a clear "legal hold prevents full erasure of X records until <date>" message + partial erasure is performed for non-hold data |
| T15 | Right-to-be-forgotten across subprocessors | Erasure request must propagate to subprocessors that hold PII (HubSpot, SendGrid suppression list, Sentry user data, Firebase Auth user); doctrine REQUIRES the erasure pipeline to call each subprocessor's erasure API and record success/failure in `audit_ledger` |
| T16 | Provider sees customer PII beyond the booking purpose | Provider view filters PII to "what's needed to perform the booking"; doctrine adopts `PiiMinimizer` discipline for provider-facing payloads |
| T17 | Search / log lines contain PII at WARN/ERROR level | Logging pipeline must redact PII from log lines (existing `secretFieldCrypto`, `PiiMinimizer`); doctrine REQUIRES a `safeLogger` helper for new code |
| T18 | Biometric token (passkey credentialId) leaked | Stored as special-category; per-user crypto-erasure on deletion; never logged |
| T19 | Photo containing face/ID stored at unsigned URL | Use `secretFieldCrypto` envelope encryption for special-category file references; replace `selfie_photo_url` and `id_photo_url` with crypto-protected URLs (PR-4 follow-up) |
| T20 | DSAR (data-subject access request) volume DOS | Rate-limit per user: 1 export every 7 days; admin override; deletion request also rate-limited (1 per 30d) |

**Backend-source-of-truth statement.** The platform NEVER trusts the client for consent state, deletion state, or retention timing. Consent UI presents what the server says is current; if the server says "marketing_consent=false" the client renders that and the server enforces it on every outbound. Deletion is scheduled and processed by a server-side job, not by the client. Retention is enforced by the server-side reaper job reading `data_retention_rules`.

---

## 8. APIs / interfaces

All endpoints are session-authenticated unless noted; all admin endpoints additionally check RBAC + write `audit_events`.

### 8.1 Customer-facing (data subject rights)

| Method | Path | Purpose | Idempotency | Notes |
|---|---|---|---|---|
| GET | `/api/me/privacy/status` | Returns current consent state, suppression flags, open requests | — | Cheap read |
| POST | `/api/me/privacy/consent` | Update consent. Body: `{ purposeId, accepted }` | `(userId, purposeId, consentVersion)` | Writes `user_consents` row + audit |
| POST | `/api/me/privacy/export` | Request data export | `(userId, day)` rate-limited 1/7d | Creates `data_export_requests` row, status=`pending`; background job processes |
| GET | `/api/me/privacy/export/:id` | Status + signed URL when ready | — | URL expires per `download_url_expires_at` (24h) |
| POST | `/api/me/privacy/delete` | Request account deletion | `(userId)` rate-limited 1/30d | Creates `account_deletion_requests` row, status=`pending`; 30d cooling-off |
| DELETE | `/api/me/privacy/delete/:id` | Cancel a pending deletion request | — | Only while status=`pending` |
| POST | `/api/me/privacy/object` | Object to marketing/profiling. Body: `{ channel?, purpose? }` | — | Updates `users.suppressionList` + writes consent withdrawal |
| POST | `/api/me/privacy/rectify` | Self-edit fields user can self-edit (profile, pet) | — | Existing surfaces; doctrine just confirms they cover rectification |

### 8.2 Admin endpoints
| Method | Path | Purpose | Auth |
|---|---|---|---|
| GET | `/api/admin/privacy/dsar-queue` | List open DSARs (export + delete) | role=admin AND scope=privacy |
| POST | `/api/admin/privacy/legal-hold` | Set/release legal hold on a user | role=admin AND scope=legal |
| POST | `/api/admin/privacy/breach` | Open a breach incident (links into existing `incidents`) | role=admin AND scope=security |
| GET | `/api/admin/privacy/retention-rules` | List `data_retention_rules` | role=admin AND scope=privacy |
| POST | `/api/admin/privacy/retention-rules` | Create/update a rule | role=admin AND scope=privacy AND counsel-approved flag |
| GET | `/api/admin/privacy/subprocessors` | List subprocessors | role=admin |
| POST | `/api/admin/privacy/subprocessors/:id/kill` | Trigger a subprocessor kill-switch | role=admin AND scope=security |

### 8.3 Public endpoints
| Method | Path | Purpose |
|---|---|---|
| GET | `/legal/subprocessors` | Public subprocessor registry (filtered to `publishedOnPublicRegistry=true`) |
| GET | `/legal/privacy` | Current privacy policy + version |
| GET | `/legal/privacy/v/:version` | Historical privacy policy version (for re-consent decisions) |

### 8.4 Internal interfaces (no HTTP — service-to-service)
- `geminiPayloadGuard(payload, userId, purposeId): { allowed, redacted, auditHash }` — wraps every Gemini call site.
- `subprocessorGuard(name, payload, dataClasses): { allowed, redactedPayload }` — wraps outbound to any subprocessor; rejects if DPA missing or data class not declared.
- `retentionReaper(now): { processed, anonymised, hardDeleted, cryptographicallyErased }` — scheduled job.
- `consentVersionChecker(userId, requiredVersion): { current, required, needsReconsent }` — used at session start.

### 8.5 Error semantics
- `403 PRIVACY_LEGAL_HOLD` — request blocked by legal hold.
- `409 PRIVACY_PENDING_REQUEST` — there's an open conflicting request.
- `429 PRIVACY_RATE_LIMIT` — too many DSARs.
- `451 PRIVACY_JURISDICTION_BLOCKED` — request can't be fulfilled in this jurisdiction (rare; reserved for cross-border legal block).

### 8.6 Idempotency keys
- Export: `(userId, requested_at_day)` — re-requesting the same day returns the same row.
- Delete: `(userId)` — only one open deletion per user.
- Consent update: `(userId, purposeId, consentVersion)` — replays are no-ops.
- Subprocessor erasure propagation: `(userId, subprocessor, attempt)` — at-most-once per attempt; up to N retries.

---

## 9. Money & audit — privacy-specific ledger movements

This doctrine does not move money. It DOES require that **every privacy operation produces an audit entry**, because the audit ledger is the evidence we present to הרשות להגנת הפרטיות and EU DPAs.

| Operation | Audit table | Required fields |
|---|---|---|
| Consent given/withdrawn | `user_consents` (data row) + `audit_events` (action) | userId, purposeId, accepted, version, ip, userAgent, traceId |
| Export requested / completed | `data_export_requests` + `audit_events` | userId, requestId, status_transitions |
| Deletion requested / scheduled / completed | `account_deletion_requests` + `audit_ledger` (hash-chained on completion) | userId, scope (full vs partial), erasure_strategy applied per table |
| Cryptographic erasure key destroyed | `audit_ledger` (hash-chained) | userId, keyId, tables affected, destroyed_at |
| Legal hold set/released | `audit_events` | userId, scope, reason, ticketId |
| Admin reads sensitive/special data | `audit_events` (severity=`info` or `warn`) | actor, target, purpose, ticketId |
| Breach opened / notified / closed | `incidents` + `incident_timeline_entries` + `audit_ledger` | per existing schema |
| Subprocessor data flow change (new SP added, SP killed) | `audit_events` | actor, subprocessor, change |
| `data_retention_rules` change | `audit_events` (severity=`warn`) | actor, rule diff, counsel approval |

**Hash-chain rule.** Deletion completion and cryptographic-erasure key destruction MUST be written to the hash-chained `audit_ledger` (the same one that protects money). Anything else can go to `audit_events`. This means a regulator can be given a tamper-evident proof that erasure occurred at a specific point in time.

---

## 10. Retention windows (the policy table behind §6.1.1)

### 10.1 Israeli legal minimums
- Tax records (`tax_invoices`, `transaction_records`, supplier invoices, financial documents): **7 years** (פקודת מס הכנסה).
- VAT records: 7 years.
- Provider contractor records (`provider_*`, contractor docs, contractor insurance, contractor bank details): per פקודת מס הכנסה 7 years + per קופת חולים / ביטוח לאומי obligations.
- Criminal background checks (`criminal_background_checks`): per provider insurance policy — minimum 1 year, recommended 7 years for insurance audit defence.
- Authentication / fraud forensics: no statutory minimum but recommended 12 months default, 7 years if incident-tagged.

### 10.2 Privacy maximums (when min < max, when consent withdrawn)
- Marketing consent withdrawal → 30-day grace then hard-delete suppression history.
- Precise location data → 12 months max, then either delete or anonymise to city-level (city-level can ride the 7y bus for tax/audit).
- Pet medical data → until owner withdraws consent (default = lifetime of pet); medical-consent withdrawal triggers hard-delete of medical columns.
- Pet medical retention override → owner can request earlier deletion if no legal hold (e.g., pet adopted to a new family; old medical history erased).
- Biometric tokens (passkey credentials, KYC biometric match score) → until purpose ends (account closure or KYC superseded).
- Marketing analytics → 26 months max (matches GA4 default).

### 10.3 Worked retention examples
- **Customer cancels and asks for deletion.** Account in good standing, no open disputes, no legal hold.
  - Non-tax PII → hard-deleted after 30d cooling-off.
  - Tax records → kept 7y from booking date; PII columns anonymised; amounts retained.
  - Audit ledger entries → kept indefinitely (hash chain; cannot be deleted without breaking chain) but PII fields are anonymised.
  - Pet medical → hard-deleted.
- **Provider terminated, criminal-background check on file.**
  - Background check kept 1y minimum, 7y recommended (for insurance defence); after 7y cryptographically erased.
  - Other provider PII (bank details, ID) → cryptographically erased after 7y.
- **EU customer (GDPR data subject) requests erasure.**
  - Same as IL customer; Israel adequacy decision means the export + erasure pipeline is identical.

### 10.4 Anonymisation at year 7+
- For tax tables: name → `ANONYMIZED ANONYMIZED`, email → `anon-<sha>@deleted.petwash.local` (matches existing `DataRetentionService.ts` line 478 logic).
- For booking history: customer_name → `ANONYMIZED`, address → city only (lat/lng dropped), phone → `ANONYMIZED`, booking_notes → cleared if they contain PII keywords (regex pass + manual review for borderline).
- For ledger entries: actor names → `ANONYMIZED`; ledger amounts and dates stay (financial-truth requirement).

---

## 11. Consent management — operational rules

### 11.1 Purpose taxonomy (canonical list — seeded into `user_consents.consentType`)
1. `account_management` — REQUIRED (legal basis = contract); cannot opt out without closing account.
2. `marketing_email` — opt-in; default false.
3. `marketing_sms` — opt-in; default false; separate from email (Israeli law treats SMS marketing separately).
4. `marketing_whatsapp` — opt-in; default false; separate from email/SMS.
5. `marketing_push` — opt-in; default false.
6. `analytics_ga4` — opt-in; default false; matches existing `analyticsConsent` column.
7. `ip_geolocation` — opt-in; default false; matches existing `ipTrackingConsent`.
8. `email_open_tracking` — opt-in; default false; matches existing `emailTrackingConsent`.
9. `ai_inference` — opt-in; default false; lets PetWash send the user's interaction data to Gemini at inference time.
10. `ai_training` — opt-in; default false; **separate from `ai_inference`**; lets future LLMs train on the user's data. Currently we don't do this — flag exists so we never start without consent.
11. `third_party_share_hubspot` — opt-in; default false; CRM sync.
12. `third_party_share_marketing_partner` — opt-in; default false; per partner.
13. `pet_medical_share_provider` — opt-in per provider; default false; the existing `pets.medicalShareConsent` field is the source of truth.
14. `pet_medical_share_vet` — opt-in per vet (Tentacle 14); default false.
15. `location_precise` — opt-in; default false; precise lat/lng for delivery/service routing.
16. `biometric_processing` — opt-in; default false (KYC biometric matching).
17. `social_graph` — opt-in; default false; future feature.

### 11.2 Consent version + materiality
- Every privacy policy publication creates a new `consent_snapshots` row (already in repo: `shared/schema.ts:12412`).
- If a change is **material** (adds a new data flow, new subprocessor, new purpose), users must re-consent for the affected purposes; their old `user_consents` rows remain in the audit trail but `getConsentStatus()` returns `needsReconsent=true` for the affected purposes.
- Material vs non-material is declared at publication time and logged.

### 11.3 Pre-ticked boxes — BANNED
The UI must default to unchecked for every opt-in purpose. Doctrine requires a UI lint or visual review checklist before any change to a consent screen.

### 11.4 Granular withdrawal
- `POST /api/me/privacy/object` accepts `{ channel?, purpose? }`. Withdrawing all marketing also flips `users.unsubscribedAt`. Per-channel withdrawal flips one entry in `users.communicationPreferences`. All paths write `user_consents` withdrawal rows.
- Withdrawal is honoured **immediately** — outbound queues check consent at send time, not enqueue time.

### 11.5 Consent for under-16 users
- Age-gate at signup (§I).
- If age < 16, `users.activationStatus` stays at `draft` and `parental_consent_pending` flag is set; guardian email triggers a separate consent capture row with `consentType='guardian_consent'` and `userId=<the_minor>`, `actorEmail=<guardian>`.

---

## 12. Breach response runbook (full)

### 12.1 Detection
Signals that escalate to "potential breach":
- Anomalous data export volume (≥3x baseline daily exports) — alert from `BiometricSecurityMonitor` / `ThreatGuardService` / `GeminiPlatformSecurityMonitor`.
- Unauthorised admin access pattern (alert via existing `login_security_events`, `shared/schema.ts:15256`).
- Subprocessor breach disclosure (SUMIT, Twilio, SendGrid, etc.) — manual entry by operator.
- Public disclosure on PetWash data (operator gets notified by external party).
- WAF / Cloud Armor anomaly.
- Database admin query without ticket reference.
- Gemini API leakage detection (a Gemini response echoing PII back unexpectedly).

### 12.2 Containment
- **Within 15 minutes**: arm the relevant kill switch via `system_kill_switches` + `kill_switch_trigger_rules` (`shared/schema.ts:14545, 14710`). For data-export anomaly: kill `/api/me/privacy/export`. For admin abuse: revoke admin session. For subprocessor breach: kill the integration flag (`SUMIT_ENABLED`, etc.).
- Open `incidents` row (`shared/schema.ts:14735`), severity ≥ HIGH, type=`privacy_breach`.

### 12.3 Assessment matrix
| Dimension | LOW | MEDIUM | HIGH | CRITICAL |
|---|---|---|---|---|
| Data class | public only | personal | sensitive | special-category |
| Volume | 1–10 records | 11–1,000 | 1,001–100,000 | >100,000 |
| Duration | <1h | 1–24h | 1–7d | >7d |
| Confirmed vs suspected | suspected | suspected w/ corroboration | confirmed limited | confirmed broad |
| Subject impact | none | inconvenience | reputational/financial | health/safety/discrimination |

**Notification trigger**: HIGH or CRITICAL → 72h notification clock starts. MEDIUM → internal incident only, document but no regulator notification unless escalates.

### 12.4 Notification (72-hour rule)
- Israeli regulator: הרשות להגנת הפרטיות (Privacy Protection Authority) — notification form + supporting evidence. Within 72h of the controller becoming aware.
- EU data subjects affected: notify their DPA via the lead supervisory authority (likely Ireland or Israel as the establishment).
- Affected data subjects (Art. 34 GDPR): notify if high risk to rights and freedoms. Use a template in `breach_notification_templates` (proposal table).
- Channel: email + in-app banner + SMS for special-category cases.
- Language: matches the user's `locale`; Hebrew default for IL users.

### 12.5 Notification template (skeleton)
> "On <date> we became aware of an incident affecting <data class> of <count> users. Details: <plain language>. Steps you should take: <e.g., change password / monitor card statements>. What we are doing: <containment + remediation>. Contact: privacy@petwash.co.il. הרשות להגנת הפרטיות has been notified."

### 12.6 Post-mortem
- `incident_rca` row (`shared/schema.ts:14784`).
- `self_healing_rule` row (`shared/schema.ts:14798`) if a control could have prevented it.
- Audit ledger hash-chained entry at incident close.
- Public post-mortem if HIGH or CRITICAL severity (matches GDPR transparency expectations).

### 12.7 Responsibility matrix
| Role | Owner | Phone path |
|---|---|---|
| Operator (final decision) | nir.h@petwash.co.il | TBD — operator to register on PagerDuty equivalent |
| Privacy lead | TBD (could be operator if no DPO yet) | — |
| Security lead | TBD | — |
| Counsel | TBD external | — |
| Subprocessor contact | per `subprocessors` row | — |
| Insurance contact (if breach insurance exists — see §19 OQ7) | TBD | — |

---

## 13. Rollout, feature flags, migration safety

### 13.1 Feature flag family
- `privacy.doctrine.v1` (master flag, default OFF). When OFF, existing surfaces operate unchanged.
- `privacy.export.enabled` — turns on `/api/me/privacy/export`.
- `privacy.delete.enabled` — turns on `/api/me/privacy/delete`.
- `privacy.consent.ui.v1` — turns on the new consent UI.
- `privacy.retention.reaper.enabled` — turns on the scheduled retention job (read-only audit dry-run mode first, then enforce).
- `privacy.subprocessor.guard.enabled` — turns on `subprocessorGuard()` rejection (vs warning-only).
- `privacy.gemini.guard.enabled` — turns on `geminiPayloadGuard()` rejection.
- `privacy.children.gate.enabled` — turns on age-gate.

### 13.2 Migration safety
- All new tables are additive. No backfills in PR-1 beyond seed rows.
- `dataRetentionRules` seed is reviewed by counsel before insert.
- Retention reaper runs in audit-dry-run mode for 30 days; output is reviewed weekly before flipping to enforce.
- Gemini guard runs in audit-dry-run mode first; logs would-be rejections; reviewed before flipping to enforce (so we don't break Gemini features by mistake).

### 13.3 Phased rollout
1. **PR-1 (schema-only)** — new tables, no behaviour change.
2. **PR-2 (export)** — `/api/me/privacy/export` + admin queue.
3. **PR-3 (consent UI + ConsentService alignment)** — new purpose taxonomy + UI.
4. **PR-4 (erasure)** — `/api/me/privacy/delete` + cryptographic-erasure path.
5. **PR-5 (subprocessor registry)** — public page + admin.
6. **PR-6 (breach runbook + kill-switch wiring)** — operationalises §12.
7. **PR-7+ (per-surface adoption)** — every PII-touching surface adopts the doctrine.

---

## 14. Rollback plan

- Per-flag rollback: each flag can be flipped to OFF; behaviour returns to pre-doctrine.
- Schema rollback: all new tables can be dropped (no FK out of them into the rest of the system except an FK from `account_deletion_requests` to `users` that already exists).
- Crypto-erasure key destruction is **irreversible** by design; rollback to "un-erase" a user is not possible — this is the privacy-correctness property, but it means a faulty erasure cannot be undone. Mitigation: 30-day cooling-off is the safety window; cancellation during cooling-off has no destructive side effects.
- Retention reaper: audit-dry-run mode for 30d minimum before enforce; rollback = flip back to dry-run.
- Subprocessor guard rollback: flip to warning-only; record per-call would-be rejections for review.

---

## 15. Test plan

### 15.1 Unit
- `geminiPayloadGuard`: special-category fields are stripped or rejected per consent state.
- `subprocessorGuard`: payload classes match declared classes; mismatch rejects.
- Cryptographic-erasure: round-trip encrypt+decrypt; after key destruction, decrypt returns "irrecoverable".
- Consent versioning: material change flags `needsReconsent`.
- Retention reaper: tax records anonymise at +7y; pet medical hard-deletes immediately on consent withdrawal.

### 15.2 Integration
- `/api/me/privacy/export` returns a signed URL; URL expires at the stamped time; download counted.
- `/api/me/privacy/delete` → 30-day cooling-off → reaper processes → `audit_ledger` row written.
- Deletion + legal hold → partial erasure; user receives clear message.
- Cancel deletion during cooling-off → status flip; no data destroyed.

### 15.3 Fraud / abuse
- IDOR on export: customer A cannot export customer B; admin requires purpose.
- DSAR rate limit: 1 export per 7d; 1 deletion per 30d; abuse returns 429.
- Pre-ticked consent box: UI lint catches it; e2e visual diff catches it.

### 15.4 Edge / failure
- Reaper crashes mid-batch: idempotent per-user-per-table; resumable.
- Subprocessor down during erasure propagation: retry with backoff; record final status in `audit_ledger`.
- Gemini API includes PII in response by accident: response-side scrub before logging.
- User in two jurisdictions (IL resident + EU citizen): doctrine applies the stricter rule per dimension.

### 15.5 Compliance
- Synthetic DSAR run quarterly to verify the path still works end-to-end and meets the 30-day GDPR timeline.
- Synthetic breach drill (`incident_drills`, `shared/schema.ts:14641`) quarterly to verify the 72-hour notification path.

---

## 16. Subprocessor registry (initial seed for `subprocessors`)

(Doctrine-level inventory. PR-5 turns this into the table seed.)

| Name | Purpose | Data classes shared | Jurisdiction | Transfer mechanism (from IL) | DPA status | Kill switch key |
|---|---|---|---|---|---|---|
| **SUMIT** | Electronic invoice issuance + accounting | personal (name, address, ID), personal (booking summary), sensitive (financial metadata) | IL | n/a (domestic) | TBD (audit) | `sumit.enabled` |
| **UPay** | Online billing (planned, replaces Tranzila) | sensitive (payment metadata), personal (billing identity) | IL | n/a (domestic) | TBD (pending integration) | `upay.enabled` |
| **Nayax** | K9000 kiosk payment | sensitive (payment metadata), personal (membership) | IL/global | adequacy / SCC | TBD (audit) | `nayax.enabled` |
| **Tranzila** | Online payment (DEPRECATED 2026-05-09) | sensitive (payment metadata) | IL | n/a | being decommissioned | `tranzila.enabled` |
| **Twilio** | SMS, voice | personal (phone), personal (message body) | US | SCC + DPA | TBD (audit) | `twilio.enabled` |
| **SendGrid** | Transactional + marketing email | personal (email), personal (message body) | US | SCC + DPA | TBD (audit) | `sendgrid.enabled` |
| **Meta WhatsApp Business** | WhatsApp messaging | personal (phone), personal (message body) | US (Meta) | SCC + DPA | TBD (audit) | `whatsapp_meta.enabled` |
| **Firebase Auth** | Authentication | personal (email, phone, auth tokens) | US (Google) | SCC + DPA | DPA in place (`GOOGLE_CLOUD_DPA_ACCEPTED` env flag exists) | `firebase_auth.enabled` |
| **Firebase Cloud Messaging** | Push notifications | personal (device tokens) | US | SCC + DPA | DPA in place | `fcm.enabled` |
| **Firestore** | Document storage (legal holds, soft state) | personal + sensitive (depends on collection) | US/multi | SCC + DPA | DPA in place | `firestore.enabled` |
| **Google Maps / Places** | Geocoding, address autocomplete | sensitive (lat/lng), personal (address) | US/multi | SCC + DPA | DPA in place | `google_maps.enabled` |
| **Google Sheets** | Reporting export (PII-minimized via `PiiMinimizer`) | minimised personal | US | SCC + DPA | DPA in place | `google_sheets.enabled` |
| **Google Drive** | Backup / document storage | full PII (internal) | US | SCC + DPA | DPA in place | `google_drive.enabled` |
| **Google Forms** | Provider intake forms | personal | US | SCC + DPA | DPA in place | `google_forms.enabled` |
| **Google Calendar** | Booking calendar sync | personal (booking summary) | US | SCC + DPA | DPA in place | `google_calendar.enabled` |
| **Google Translate** | i18n at runtime | personal (free-text payload — caution) | US | SCC + DPA | DPA in place | `google_translate.enabled` |
| **Google Vision** | Biometric matching (KYC selfie vs ID) | **special-category** (biometric) | US | SCC + DPA + explicit consent | DPA in place; explicit consent required | `google_vision.enabled` |
| **Google Dialogflow** | Coworker / voice agent | personal (conversation) | US | SCC + DPA | DPA in place | `dialogflow.enabled` |
| **Google Cloud Storage** | Asset storage (selfies, ID photos) | **special-category** (when KYC) | US/multi | SCC + DPA | DPA in place | `gcs.enabled` |
| **Google Cloud KMS** | Key management (for cryptographic erasure) | n/a (holds keys) | US/multi | SCC + DPA | DPA in place | `gcp_kms.enabled` |
| **Google Cloud Secret Manager** | Secrets | n/a | US/multi | SCC + DPA | DPA in place | `gcp_secrets.enabled` |
| **Google Wallet** | Wallet pass | personal | US | SCC + DPA | DPA in place | `google_wallet.enabled` |
| **Gemini AI (Google)** | LLM inference | personal (depends on call site — must be governed by `geminiPayloadGuard`) | US | SCC + DPA | DPA in place; consent required for special-category | `gemini.enabled` |
| **Apple (Wallet pass cert)** | Wallet pass | personal | US | SCC + DPA | TBD (audit) | `apple_wallet.enabled` |
| **Apple Sign-In** | Authentication | personal (Apple ID) | US | SCC + DPA | TBD (audit) | `apple_signin.enabled` |
| **Sentry** | Error monitoring | personal (depends on payload — caution; logs must be PII-redacted by `safeLogger`) | US | SCC + DPA | TBD (audit) | `sentry.enabled` |
| **HubSpot** | CRM | personal (name, email, phone, lifecycle) | US | SCC + DPA | TBD (audit) | `hubspot.enabled` |
| **AfterShip** (when wired) | Shipping tracking | personal (delivery address, phone) | HK / global | SCC + DPA | NOT YET | `aftership.enabled` |
| **Wolt** (when wired) | Delivery logistics | personal (delivery address, phone), sensitive (lat/lng) | FI / EU | adequacy (FI→IL OK) | NOT YET | `wolt.enabled` |
| **Israel Post** (when wired) | Postal | personal (delivery address) | IL | n/a (domestic) | NOT YET | `israel_post.enabled` |
| **reCAPTCHA / App Check** | Anti-abuse | sensitive (IP, behavioural) | US (Google) | SCC + DPA | DPA in place | `recaptcha.enabled` |

**Doctrine rule**: any new subprocessor MUST get a row before traffic is enabled, including DPA URL and DPA signed date. Adding a subprocessor without a DPA is a HIGH-severity policy violation.

---

## 17. AI / ML training data isolation (§H elaboration)

### 17.1 Default state
- **No** production user data is used to train models PetWash owns or controls (we don't train models today).
- **All** AI features use third-party APIs at inference time (Gemini today; possibly others later).
- **No** Gemini call may receive special-category data without `ai_inference` consent for that user AND a per-purpose justification logged.

### 17.2 `geminiPayloadGuard()` contract
Every Gemini call site (`server/gemini.ts`, `server/services/Gemini*.ts`, `server/services/geminiTranslation.ts`) MUST:

1. Declare its **purpose** (an enum value from `gemini_call_purposes`: spam-screening, translation, advisory, matching, etc.).
2. Declare its **field set** (which user/pet/booking fields are in the payload).
3. Call `geminiPayloadGuard({ userId, purpose, fieldSet, payload })`.
4. The guard:
   - Looks up `data_retention_rules` for each field; if any field is special-category, requires `ai_inference` consent + matching purpose row.
   - Strips fields not in the declared set (anti-leak defence).
   - Hashes the field set and writes `audit_events` (action_type=`gemini_call`, severity=`info`).
   - Returns `{ allowed, redactedPayload, auditHash }`.

5. Caller MUST use `redactedPayload`, not the original.

### 17.3 Field set examples
- Spam screening: `{ message_body }` only — no userId, no pet info. ALLOWED without per-user consent (legitimate interest, anti-abuse).
- Translation: `{ source_text, source_locale, target_locale }`. ALLOWED if source_text is user-authored chat — flag for `ai_inference` consent; if it's a system string, no consent needed.
- Provider matching (`GeminiMatchingService.ts`): `{ booking_summary, anonymised_pet_class, location_city }`. Pet name + medical excluded.
- Coworker / advisory: needs per-user `ai_inference` consent before being available.

### 17.4 Inbound LLM response handling
- Responses MUST pass through `safeLogger` redaction before being logged.
- Responses MUST NOT be stored verbatim with PII unless they were the user's own data echoed back (then storage is governed by the consent the user gave).

### 17.5 Training (forward-compatible)
- If PetWash ever fine-tunes its own model, training data MUST come from users with `ai_training` consent — a separate purpose, not `ai_inference`.
- Default for `ai_training`: opt-in (per §19 OQ4 leaning).

---

## 18. Children's privacy (§I elaboration)

### 18.1 Age floor
- Minimum age to hold a PetWash account: **16**.
- Reason: GDPR default is 16 (member states can lower to 13). Israeli law expects parental consent for under-16 in many digital contexts. 16 is the safer floor.

### 18.2 Age-gate at signup
- Self-declared at signup. `users.dateOfBirth` becomes the gate.
- If under 16 → `activationStatus=draft` with `parental_consent_pending` flag; signup paused until guardian email confirms.

### 18.3 Guardian-consent flow
- Guardian receives an email with a one-time link.
- Guardian completes a consent form that captures: guardian name, guardian email, guardian phone, attestation of guardianship, the same consents the minor will be subject to.
- Captured as a `user_consents` row with `consentType='guardian_consent'`, `userId=<minor>`, `actorEmail=<guardian>`, plus IP/userAgent/etc.

### 18.4 Marketing to minors
- No marketing emails / SMS / push to confirmed under-16 users, regardless of guardian consent. (Strict floor.)
- Transactional / safety / legal only.

### 18.5 Pet medical data for minors
- Treated as special-category and requires guardian re-consent at age 16 transition (when the minor crosses the age boundary, their consent supersedes the guardian's).

### 18.6 Enforcement strength
- Self-declared age has known weaknesses. §19 OQ6 asks whether to add a stronger gate. Doctrine recommends starting with self-declared + clear penalty (account suspension if false) — the strictness is in §18.4 (no marketing) more than in age-verification.

---

## 19. Open questions (decisions needed before PR-1 lands)

1. **Anonymisation threshold at year 7+.** Which fields drop entirely vs which become coarse-grained? Doctrine proposes the booking-history rule above; counsel to confirm.
2. **Subprocessor DPA backfill.** Which subprocessors today are running without a DPA in place? Operator + counsel must audit the §16 list. Items marked "TBD (audit)" are the work queue.
3. **Pet medical record consent — implicit (entered during onboarding) or explicit (separate opt-in)?** Doctrine recommends **explicit** at first medical-data entry, with a one-line consent screen ("These fields are special-category; we use them only to provide service. Continue?"). The existing `medicalShareConsent` field is already there to back this.
4. **AI training default — opt-in vs opt-out?** Doctrine recommends **opt-in** for all jurisdictions (matches IL/GDPR strictness even if industry trend is opt-out elsewhere). Confirm with counsel.
5. **Cryptographic erasure key management.** Stack already uses GCP. Doctrine recommends **Google Cloud KMS** (already in the subprocessor list); rejects "roll-own". HashiCorp Vault is a stretch (adds a vendor without clear benefit over GCP KMS).
6. **Children's age gate — self-declared vs verified?** Doctrine recommends **self-declared** at signup + parental email confirmation, deferring stronger verification (e.g., ID upload) to a later policy decision because of the friction it introduces.
7. **Operator's personal exposure.** Does PetWash carry a cyber-liability / data-breach insurance policy today? If not, this SDD recommends acquiring it; in the meantime, the operator's personal exposure is a §13 risk. Confirm with insurance broker.
8. **Sub-doctrine for biometric data.** Doctrine treats biometric tokens (passkey credentials, KYC biometric match scores) as **special-category** and applies the same protections. A separate sub-doctrine is not currently required; revisit if biometric features expand materially.
9. **Provider background-check retention.** Keep indefinitely (insurance audit) or expire post-termination? Doctrine proposes **7y post-termination then cryptographic erasure** — confirm with counsel + insurance.
10. **Cross-platform identity unification.** Operator's "ONE IDENTITY" principle requires that PetWash and adjacent platforms (PawFinder, PetTrek, etc.) treat a user as one data subject. Doctrine requires that all platform-instances share one lawful basis (one privacy policy, one consent capture) — this means the "ONE IDENTITY" rollout is gated by privacy policy consolidation. Confirm with counsel that this is acceptable.

---

## 20. First implementation PR (the smallest safe slice)

**Recommended first PR: `PR-1 Privacy doctrine — schema + seed`**

Scope (single PR, schema-only, no behaviour change):
- Add table `data_retention_rules` (§6.1.1).
- Add table `subprocessors` (§6.1.2).
- Seed `data_retention_rules` with the ~25 high-risk tables (using the §6.1.1 worked rows as the starting point); counsel reviews the seed.
- Seed `subprocessors` with the §16 inventory (DPA status = best-known; "TBD (audit)" rows kept as such).
- No HTTP endpoints; no behaviour change; no runtime reads of the new tables yet.
- Migration is purely additive.
- Feature flag `privacy.doctrine.v1` lands as a stub (default OFF).

Why this first: zero risk, sets the substrate for every subsequent PR, lets counsel/operator review the policy data itself without code pressure. PR-2 (export endpoint) immediately after.

Subsequent PRs (in order):
- **PR-2** — `/api/me/privacy/export` + admin DSAR queue (uses existing `data_export_requests`).
- **PR-3** — Consent UI + new purpose taxonomy in `user_consents` + alignment with `ConsentService.ts`.
- **PR-4** — `/api/me/privacy/delete` + cryptographic-erasure key path via GCP KMS (reuses `account_deletion_requests`).
- **PR-5** — Public subprocessor registry page + admin (`/legal/subprocessors`).
- **PR-6** — Breach runbook operationalisation: kill-switch wiring per subprocessor + `incident_drills` quarterly automation.
- **PR-7+** — Per-surface adoption: every PII-touching surface uses the doctrine.

---

## 21. Risks

| # | Risk | Severity | Mitigation |
|---|---|---|---|
| R1 | Counsel reviews `data_retention_rules` seed and finds disagreement with operator's product timing (e.g., we want to keep marketing data longer for personalisation) | MEDIUM | Doctrine puts retention in a queryable table; rule disputes are config not code; resolve case-by-case |
| R2 | Subprocessor DPA audit reveals one or more SPs without a DPA (likely) | HIGH | §19 OQ2; until DPA in place, mark `dpaStatus='missing'` and either pause data flow or accept the legal risk in writing |
| R3 | Cryptographic erasure on backups not effective if backups predate the key-managed era | HIGH | Mitigated by GCP KMS adoption (PR-4); backups taken after PR-4 will be crypto-erasable; pre-PR-4 backups need a manual retention cutoff |
| R4 | Children's age-gate self-declaration is weak; under-16 users get through | MEDIUM | §18 + OQ6; mitigations are no marketing to minors and clear penalty |
| R5 | Gemini guard rejects legitimate calls during rollout, breaking AI features | MEDIUM | 30-day audit-dry-run mode before enforce; per-call-site declarations reviewed first |
| R6 | Retention reaper deletes data the operator wanted retained (e.g., a one-off VIP customer) | LOW–MEDIUM | `legalHold` flag + 30d cooling-off + reviewed dry-run period |
| R7 | DSAR volume DoS the system | LOW | rate limits + background job (already in `DataRetentionService`) |
| R8 | Operator's personal liability exposure | HIGH (without insurance) | §19 OQ7 — acquire cyber insurance |
| R9 | "ONE IDENTITY" principle conflicts with per-platform lawful basis | MEDIUM | §19 OQ10 — counsel review before identity unification ships |
| R10 | Logging pipeline still leaks PII at WARN/ERROR | MEDIUM | Per-PR adoption of `safeLogger`; lint to flag `console.error(user)` style code |
| R11 | Israel adequacy decision is revoked (politically possible) | LOW (now) / HIGH (impact) | Design to GDPR floor anyway so loss of adequacy is a config change, not a redesign |
| R12 | A subprocessor announces a breach we don't notice for >72h | MEDIUM | Subprocessor-monitoring duty in §12; quarterly review of SP breach disclosures |

---

## 22. Appendix A — original operator request (verbatim, unedited)

> "Save us, secure us and make us better, top global pet lifestyle hub, platforms, shop, free activity, fun, attractive, perks, most advanced globally if total offering of services and tech. Launch 🚀 both."
>
> — Operator (nir.h@petwash.co.il), 2026-05-27.

Subject framing requested by operator: "**Privacy Doctrine — חוק הגנת הפרטיות 1981 + GDPR equivalence + future multi-jurisdictional** (CCPA, Brazil LGPD when expansion warrants)."

---

## 23. Appendix B — referenced documents (do not restate)

- `docs/governance/octopus-brain-doctrine.md` — overall doctrine framework; this SDD sits inside Tentacle 11 (Regulatory) as a sub-domain.
- `docs/architecture/OCTOPUS_ARCHITECTURE_RESET_RFC.md` — architectural reset RFC; consulted for tentacle boundaries.
- Octopus vision v2 amendment (TBD path) — referenced; not restated.
- `.github/skills/sdd-writer-iterative/SKILL.md` — the method this document follows.
- Sibling SDDs:
  - `docs/design/2026-05-22-petwash-pass-k9000-redemption.md`
  - `docs/design/2026-05-22-supplier-invoice-sumit-fraud-control.md`
  - `docs/design/2026-05-25-commerce-promotions-pricing.md`
  - `docs/design/2026-05-25-smart-identity-routing.md`
  - `docs/design/2026-05-26-payment-provider-routing-and-lifecycle.md`
  - `docs/design/2026-05-26-shop-module-physical-goods.md`

---

## 24. Appendix C — PII classification cheat-sheet

### 24.1 The rule
Apply this rule to every new column. If the answer is ambiguous, escalate one class higher (default to stricter).

1. Is the field publicly listed by the user for marketing/discovery (e.g., provider business name, public reviews)? → **public**.
2. Otherwise, does the field identify a person directly or indirectly (name, email, phone, address, IP, pet's name, booking detail tied to a user)? → **personal**.
3. Does the field include payment metadata, precise location, biometric tokens, social-graph data, or authentication credentials? → **sensitive**.
4. Does the field include medical (human or animal), criminal background, government-issued ID number, or genetic data? → **special-category**.

### 24.2 Worked classifications for the highest-risk tables

#### `users` (`shared/schema.ts:35`)
- public: (none — the user is a person; nothing is published without action)
- personal: id, email, firstName, lastName, profileImageUrl, phone, address, street, streetNumber, apartment, city, postalCode, country, gender, language, locale, timezone, regionCode, dateOfBirth, emergencyContactName, emergencyContactPhone, referralCode, referredByCode, membershipNumber, accountActivatedAt, lastLoginAt
- sensitive: passwordHash, latitude, longitude, temporaryLat, temporaryLng, communicationPreferences, suppressionList, deviceId, twoFactorEnabled, mfaRequired, mfaEnrolled, biometricMatchScore (low-numeric but biometric-derived), riskLevel, journeyState, carPlate, carPlate2
- special-category: idNumber (תעודת זהות), idDocumentUrl, selfiePhotoUrl, idPhotoUrl, biometricMatchStatus, biometricVerifiedAt, biometricVerifiedBy, isSeniorVerified (medical-adjacent), isDisabilityVerified (medical)

#### `pets` (`shared/schema.ts:7841`)
- personal: name, species, breed, age, dateOfBirth, weight, gender, size, color, photoUrl, microchipId
- sensitive: temperament (privacy-safe enum already)
- special-category: skinSensitivity, allergies, medications, specialNeeds, vetName, vetPhone, vaccinationStatus, lastVaccinationDate, nextVaccinationDate, medicalConsentUpdatedAt (the consent timestamp is itself personal but the gated fields are special-category)

#### `bookings` (`shared/schema.ts:8317`) and `booking_*`
- personal: customer reference, provider reference, address, scheduled time, booking_notes (could contain anything — treat as personal by default, special-category if mentions of medical)
- sensitive: precise pickup/dropoff lat/lng if present

#### `providers` (`shared/schema.ts:7896`)
- public: business name, service categories, service areas, public reviews
- personal: contact phone, contact email, profile photo
- sensitive: payout account info
- special-category: criminal background check results, ID documents (`provider_police_checks`, `criminal_background_checks`, `identity_documents`)

#### `payments`, `tax_invoices`, `transaction_records`, `nayax_transactions`, `customer_payment_tokens`
- personal: customer name, billing address
- sensitive: payment metadata (last4, masked PAN, token); **NOT** full PAN (we don't store it — PCI doctrine governs)
- special-category: (none if PCI-scoped correctly)

#### `paw_finder_*` (lost/found posts)
- personal: posted contact info, photos, last-seen location
- sensitive: precise location coordinates (when included)

#### `passport_verifications`, `identity_verifications`, `identity_document_files`, `liveness_checks`, `kyc_*`
- special-category: ID numbers, scanned ID documents, liveness check biometric tokens

#### `pettrek_gps_tracking`, `walk_health_data`, `walk_blockchain_audit`
- sensitive: GPS coordinates, walking pace, route trace
- special-category: any health metrics tied to pet medical (`walk_health_data` if it contains vitals)

#### `user_devices`, `userDeviceEvents`, `login_security_events`, `auth_events`, `mfa_enrollments`, `refresh_tokens`, `verification_tokens`, `pin_auth_logs`
- sensitive: device fingerprints, IPs, user-agents, auth tokens

#### `crm_*` (HubSpot mirror — see §16)
- personal: contact info
- sensitive: communication history if it includes private content
- (subprocessor: HubSpot — see §16)

#### `chat_*`, `bookingMessages`, `user_messages`, `provider_message_log`
- personal: message body — assume PII; medical if explicitly mentioned

#### `audit_ledger`, `audit_events`, `complianceAuditLogs`, `kycAuditLog`, `activationAuditLog`
- personal (actor + target identifiers)
- DO NOT add raw PII to these tables; reference by ID only.

---

## 25. Closing summary (what the operator should know)

This doctrine sets the privacy floor for PetWash. It is opinionated — choosing GDPR strictness across the board so adequacy decisions matter less, opt-in defaults so user trust is the default, and queryable retention rules so the policy is reviewable by counsel rather than buried in code. It reuses the privacy primitives already present in the codebase and adds three new tables (`data_retention_rules`, `subprocessors`, optional `breach_notification_templates`) plus six implementation PRs.

It is also a brake: every new surface that touches PII is now gated by this doctrine. Tentacle 14 (Vet / Pet Health) cannot ship until at least PR-1, PR-3, and the medical-data classification rules from §6.1.1 are in place.

The next action is **PR-1 (schema-only seed)** plus counsel review of the §6.1.1 seed and the §16 subprocessor inventory.

