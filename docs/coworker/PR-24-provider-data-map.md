# PR-24 — Provider Onboarding Data Map (Coworker, read-only)

> Read-only audit. **Do not** mutate provider records, change application
> status, approve / reject / withdraw, send onboarding emails or SMS, issue
> certificates, revoke badges, or trigger payouts from this document or the
> stub service it accompanies. The provider coworker uses this map to
> *detect* stuck or anomalous onboarding states and surface them to a human
> approver. Any remediation must go through the existing reviewed admin path
> (`server/routes/admin-provider-review.ts`, `AdminProviderReviewService`,
> `provider-onboarding.ts`).

## 1. Source-of-truth boundary

PetWash carries provider onboarding state in **PostgreSQL only** (Drizzle,
`shared/schema.ts`). Firestore is not on the onboarding write path. The
canonical applicant record is `provider_applications`; the live admin
checklist lives in `provider_approval_queue`; KYC is split between the
provider-facing biometric/criminal columns on `provider_applications` and
the generic `kyc_cases` / `kyc_documents` / `kyc_checks` triple used across
the platform.

| Store                                           | Role                                                           | Authority                                                       |
| ----------------------------------------------- | -------------------------------------------------------------- | --------------------------------------------------------------- |
| PostgreSQL `provider_applications`              | Applicant intake + KYC state machine                           | Owns `status` (`draft → pending_review → under_review → approved | rejected | withdrawn`), KYC fields, approved provider id |
| PostgreSQL `provider_approval_queue`            | Admin 7-point checklist + assignment + final approve/reject    | Owns `assignedTo`, checklist booleans, `approvedAt / rejectedAt` |
| PostgreSQL `provider_police_checks`             | Israeli תעודת יושר uploads + biometric match                   | Owns `status` of police-clearance review independent of application |
| PostgreSQL `provider_certificates`              | Issued provider certificates (post-approval)                   | Owns `certificateId`, expiry, revocation                        |
| PostgreSQL `provider_invite_codes`              | Admin-generated invite codes that gate applications            | Owns `currentUses`, `maxUses`, `isActive`, `expiresAt`          |
| PostgreSQL `provider_intake_queue`              | Google-Forms-fed legacy intake (pre-application)               | Owns sheet sync state + conversion to a `provider_applications` row |
| PostgreSQL `kyc_cases` / `kyc_documents` / `kyc_checks` | Generic KYC machinery (zero-storage doc refs + per-check results) | Owns case-level `status` and per-document `status`        |
| PostgreSQL `signed_documents`                   | Provider-signed agreements (contracts, NDAs, T&Cs)             | Owns signature `status`, expiry, revocation                     |
| PostgreSQL `provider_review_audit`              | Append-only audit log written by `server/services/providerAudit.ts` | Owns who/why/when of every admin review action            |

Drift between `provider_applications.status`, `provider_approval_queue.status`,
and the boolean checklist columns for the same applicant is an observable
stuck state.

## 2. Tables involved

### Applicant intake (`provider_applications`, lines 5037–5143)

| Field                                                                          | Notes                                                                  |
| ------------------------------------------------------------------------------ | ---------------------------------------------------------------------- |
| `id` (serial), `applicationId` (`APP-YYYY-NNNNNN`)                             | Primary identifiers                                                    |
| `userId` (Firebase UID), `email`, `firstName`, `lastName`, `phoneNumber`       | Applicant identity                                                     |
| `providerType` (`walker | sitter | station_operator`), `inviteCode`            | Type + attribution                                                     |
| `city`, `country` (default `IL`)                                               | Location                                                               |
| `selfiePhotoUrl`, `governmentIdUrl`, `biometricMatchScore`, `biometricStatus` (`pending | verified | failed`), `biometricVerifiedAt`, `biometricFailureReason` | Biometric KYC                  |
| `backgroundCheckStatus` (`pending | passed | failed | waived`), `backgroundCheckDate`, `backgroundCheckNotes` | Background check                                              |
| `criminalCheckStatus` (`pending | passed | failed | requires_review`), `criminalCheckProvider`, `criminalCheckReportId`, `criminalCheckCompletedAt`, `residentialHistory`, `criminalCheckConsent`, `criminalCheckConsentDate` | 10-year residential history (2026 spec)  |
| `selfDeclarationNoRelevantConvictions`, `selfDeclarationAt`, `selfDeclarationIp`, `requiresEnhancedVerification`, `enhancedVerificationReasons[]` | Israel-safe self-declaration (migration 0019) |
| `petFirstAidCertUrl` + `petFirstAidExpiresAt` + `petFirstAidProvider`          | Required for sitters/walkers                                           |
| `drivingRecordUrl` + `drivingRecordCheckedAt` + `drivingRecordStatus` (`clean | minor_violations | major_violations | suspended`) + `drivingRecordNotes` | Required for PetTrek drivers      |
| `insuranceCertUrl`, `insurancePolicyNumber`, `insuranceProvider`, `insuranceExpiresAt`, `insuranceCoverageAmount`, `insuranceLastVerified` | Required for walkers/sitters         |
| `businessLicenseUrl`, `businessLicenseExpiresAt`                               | Required for station operators                                         |
| `certificationUrls[]`, `certificationExpiryDates[]`                            | Parallel arrays                                                        |
| `trustScorePublic`, `trustScoreInternal`, `trustScoreLastUpdated`              | Calculated post-approval                                               |
| `status` (default `'draft'`)                                                   | `draft | pending_review | under_review | approved | rejected | withdrawn` |
| `onboardingStep`, `onboardingComplete`                                         | Wizard progress                                                        |
| `submittedAt`, `reviewedBy`, `reviewedAt`, `rejectionReason`                   | Lifecycle timestamps                                                   |
| `kycDocumentType` (`passport | national_id | drivers_license | disability_certificate | retirement_certificate`), `kycIdLastFour`, `kycOcrConfidence`, `kycLivenessScore`, `kycDecisionFlags`, `kycFraudRiskLevel` | KYC2026 queryable fields  |
| `internalNotes`, `approvedAsProviderId`                                        | Admin notes + post-approval provider id                                |

### Admin checklist (`provider_approval_queue`, lines 10262–10299)

`providerId, platform, status (pending | under_review | approved | rejected | on_hold),
priority (low | normal | high | urgent),
photoApproved, certificateApproved, idVerified, addressVerified,
policeCheckApproved, insuranceVerified, pricingApproved,
assignedTo, assignedAt, reviewedBy, reviewedAt, reviewNotes, rejectionReason,
approvedAt, rejectedAt, createdAt, updatedAt`.

The seven boolean columns are the canonical *Pet Wash™ 7-point verification*
checklist. `status='approved'` should imply all seven are `true`.

### Police check (`provider_police_checks`, lines 10221–10259)

`providerId, documentType (police_clearance | criminal_background),
documentUrl, documentFileName, status (pending | under_review | approved |
rejected | expired), issuedAt, expiresAt, reviewedBy, reviewedAt,
reviewNotes, rejectionReason, badgeIssued, badgeIssuedAt,
biometricVerified, biometricMatchScore, idDocumentUrl, selfieUrl,
biometricVerifiedAt`.

### Certificates (`provider_certificates`, lines 10186–10218)

`certificateId (CERT-...), providerId, platform, providerName, issuedAt,
expiresAt (2 years from issue), status (active | expired | revoked |
suspended), verificationHash, verificationUrl, pdfUrl, qrCodeUrl,
revokedAt, revokedBy, revocationReason`.

### Invite codes (`provider_invite_codes`, lines 5009–5034)

`inviteCode, providerType, createdByAdminId, maxUses, currentUses,
expiresAt, isActive, campaignName, referralBonus, notes`.

### Legacy Google-Forms intake (`provider_intake_queue`, lines 5165+)

`intakeId (INT-...), googleFormResponseId, googleSheetRowNumber,
syncedFromSheetId, syncedAt, email, firstName, lastName, phoneNumber,
providerType, selectedPlatforms[], intendedPricing(jsonb), city, country,
latitude, longitude, yearsExperience, hasOwnTransport, hasPetFirstAid,
hasInsurance, availabilityNotes, preferredWorkingDays[], preferredHours, …,
generatedInviteCode (FK), convertedToApplicationId (FK)`.

A row in `provider_intake_queue` with no
`convertedToApplicationId` after N days is observable backlog.

### KYC (generic, lines 12323–12367)

| Table           | Owns                                                                                                  |
| --------------- | ----------------------------------------------------------------------------------------------------- |
| `kyc_cases`     | `userId, roleContext, status (pending | …), riskScore, decidedBy, decidedAt, decisionReason`         |
| `kyc_documents` | `kycCaseId, docType, country, storageMode (zero_storage | …), storageRef, processingRef, uploadedAt, deletedAt, fingerprintHash, status` |
| `kyc_checks`    | `kycCaseId, checkType, result, score, metadata`                                                       |

### Signed documents (`signed_documents`, lines 5903–5953)

`signatureId (FK digital_signatures), documentType (contract | agreement |
invoice | authorization | legal_notice), documentTitle, originalDocumentUrl,
signedDocumentUrl, documentHash, signedBy, signedByTitle, recipientName,
recipientEmail, signedDate, effectiveDate, expiryDate, metadata,
emailSentTo, emailSentAt, emailDeliveryStatus, auditHash,
previousDocumentHash, status (active | revoked | expired), revokedAt,
revokedReason`.

### Audit trail (`provider_review_audit`)

Append-only log written by `server/services/providerAudit.ts ::
writeProviderAudit({ applicationId, eventType, actorUserId, actorRole,
payload })`. Used by every admin write path.

## 3. Write paths (where provider state changes — coworker MUST NOT touch)

| Step                                       | File / function                                                             | Mutates                                                                        |
| ------------------------------------------ | --------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| Application create / wizard step           | `server/routes/provider-applications.ts`, `server/routes/provider-onboarding.ts` | `provider_applications` insert/update, `onboardingStep`, `onboardingComplete` |
| Submit for review                          | same                                                                        | `provider_applications.status = 'pending_review'`, `submittedAt`               |
| Admin assign / start review                | `server/routes/admin-provider-review.ts`, `AdminProviderReviewService`      | `provider_approval_queue.assignedTo, assignedAt, status = 'under_review'`      |
| Admin checklist toggle                     | `AdminProviderReviewService`                                                | `provider_approval_queue.{photoApproved, …, pricingApproved}`                  |
| Admin approve                              | `AdminProviderReviewService.approveApplication`                             | `provider_applications.status = 'approved'`, `approvedAsProviderId`, `provider_approval_queue.approvedAt`, inserts `walker_profiles | sitter_profiles | trainers`, dispatches notifications, may issue `provider_certificates` row |
| Admin reject                               | `AdminProviderReviewService.rejectApplication`                              | `provider_applications.status = 'rejected'`, `rejectionReason`, `provider_approval_queue.rejectedAt`, dispatches notification |
| Police check upload + review               | provider-onboarding routes, `AdminProviderReviewService`                    | `provider_police_checks` insert/update, `policeCheckApproved` flip on queue    |
| Insurance verify                           | `server/services/insuranceMonitoring.ts`                                    | `provider_applications.insurance*`, `provider_approval_queue.insuranceVerified` |
| Trust score recompute                      | `server/services/trustScoring.ts`                                           | `provider_applications.trustScore*`                                            |
| Badge issuance                             | `server/services/badgeIssuance.ts`                                          | `provider_police_checks.badgeIssued, badgeIssuedAt`                            |
| Google-Forms intake sync                   | `server/services/ProviderIntakeService.ts`, `server/routes/provider-intake.ts` | `provider_intake_queue` insert/update, `convertedToApplicationId`           |
| KYC case lifecycle                         | `server/services/KYC2026/*`                                                 | `kyc_cases.status`, `kyc_documents.status`, `kyc_checks` insert                |
| Provider audit                             | `server/services/providerAudit.ts → writeProviderAudit`                     | `provider_review_audit` insert                                                 |

The coworker reads all of the above tables — it writes none of them.

## 4. State machines

### Application `provider_applications.status`

```
draft
  → pending_review              (applicant submits)
  → pending_review → under_review  (admin picks up)
  → under_review  → approved       (terminal — provider profile created)
                  → rejected       (terminal — applicant notified)
  → withdrawn                      (terminal — applicant abandons)
```

### Approval queue `provider_approval_queue.status`

```
pending → under_review → approved   (terminal)
                       → rejected   (terminal)
                       → on_hold    (re-enterable)
```

`on_hold` is a parking state; it is *not* terminal but should not stay
indefinite (rule P3).

### Police check `provider_police_checks.status`

```
pending → under_review → approved | rejected
approved → expired       (after expiresAt — 3-6 months typical)
```

### KYC case `kyc_cases.status`

`pending → in_review → cleared | failed | escalated` (per KYC2026 service).

### Certificate `provider_certificates.status`

`active → expired (timer) | revoked (admin) | suspended (admin)`.

### Signed document `signed_documents.status`

`active → revoked | expired`.

## 5. Read paths (what the coworker queries)

All reads must go through `server/services/coworker/readonly-db.ts`
(SELECT-only guard, see PR-21). The provider coworker consumes:

1. **Stuck application detection** — `provider_applications` filtered by
   `status` + age, joined to `provider_approval_queue` to see if a human has
   touched it.
2. **Checklist drift** — `provider_approval_queue` rows where `status =
   'approved'` but one of the seven booleans is still `false` (or the
   converse: all seven `true` but `status` still `pending`).
3. **Document expiry sweep** — insurance, police-clearance, pet-first-aid,
   driver-record, business-license expiry timestamps approaching `now()`.
4. **KYC queue health** — `kyc_cases.status='pending'` ordered by
   `createdAt`; `kyc_documents.status='received'` older than SLA.
5. **Signed-document chain integrity** — `signed_documents` where
   `previousDocumentHash` references an unknown `documentHash`, or where
   `status='active'` past `expiryDate`.
6. **Intake conversion lag** — `provider_intake_queue` with
   `convertedToApplicationId IS NULL` older than N days.
7. **Audit gap** — `provider_review_audit` joined back to
   `provider_applications` to find approvals/rejections with no audit row.

## 6. Observable stuck states (detection rules — read-only)

Each rule below is a SELECT a coworker can run. Money and notification rules
deliberately **flag, never fix**. The stub service in
`server/services/coworker/providerCoworker.ts` exposes one async function
per rule. Functions return arrays of finding objects of shape
`{ rule, providerApplicationId, signal, evidence }`.

### P1. Application stuck in `pending_review` past 7 days

```sql
SELECT id, application_id, user_id, submitted_at, status
FROM provider_applications
WHERE status = 'pending_review'
  AND submitted_at < now() - INTERVAL '7 days';
```

A `pending_review` row that no admin has converted to `under_review` after a
week is a triage miss.

### P2. Application `under_review` with no admin touch in 5 days

```sql
SELECT pa.id, pa.application_id, paq.assigned_to, paq.assigned_at, paq.reviewed_at
FROM provider_applications pa
LEFT JOIN provider_approval_queue paq ON paq.provider_id = pa.user_id
WHERE pa.status = 'under_review'
  AND COALESCE(paq.reviewed_at, paq.assigned_at, pa.submitted_at) < now() - INTERVAL '5 days';
```

### P3. Approval queue `on_hold` longer than 14 days

```sql
SELECT id, provider_id, status, review_notes, updated_at
FROM provider_approval_queue
WHERE status = 'on_hold'
  AND updated_at < now() - INTERVAL '14 days';
```

`on_hold` is a parking state; if it never converts, the applicant is
stranded.

### P4. Approval queue checklist drift (status approved but a check is false)

```sql
SELECT id, provider_id, status, photo_approved, certificate_approved,
       id_verified, address_verified, police_check_approved,
       insurance_verified, pricing_approved
FROM provider_approval_queue
WHERE status = 'approved'
  AND (photo_approved = false
    OR certificate_approved = false
    OR id_verified = false
    OR address_verified = false
    OR police_check_approved = false
    OR insurance_verified = false
    OR pricing_approved = false);
```

A regression in the approval write path.

### P5. Approval queue ready but still `pending` (inverse drift)

```sql
SELECT id, provider_id, created_at
FROM provider_approval_queue
WHERE status = 'pending'
  AND photo_approved AND certificate_approved AND id_verified
  AND address_verified AND police_check_approved AND insurance_verified
  AND pricing_approved
  AND created_at < now() - INTERVAL '24 hours';
```

All seven boxes ticked, no decision recorded. Surface to admin.

### P6. Biometric KYC verified but application not advanced

```sql
SELECT id, application_id, biometric_status, biometric_verified_at, status
FROM provider_applications
WHERE biometric_status = 'verified'
  AND biometric_verified_at < now() - INTERVAL '3 days'
  AND status IN ('draft', 'pending_review');
```

### P7. Criminal check `requires_review` with no admin follow-up

```sql
SELECT id, application_id, criminal_check_status, criminal_check_completed_at, reviewed_at
FROM provider_applications
WHERE criminal_check_status = 'requires_review'
  AND criminal_check_completed_at < now() - INTERVAL '48 hours'
  AND reviewed_at IS NULL;
```

### P8. Police clearance approaching / past expiry on an active provider

```sql
SELECT id, provider_id, status, issued_at, expires_at
FROM provider_police_checks
WHERE status = 'approved'
  AND expires_at IS NOT NULL
  AND expires_at < now() + INTERVAL '30 days';
```

Israeli תעודת יושר is typically valid 3–6 months. Surface upcoming expiries
so admin can request a renewal — *do not* auto-suspend.

### P9. Insurance expired on approved provider application

```sql
SELECT id, application_id, insurance_provider, insurance_expires_at, status
FROM provider_applications
WHERE status = 'approved'
  AND insurance_expires_at IS NOT NULL
  AND insurance_expires_at < now();
```

### P10. KYC document received but never processed

```sql
SELECT d.id, d.kyc_case_id, d.doc_type, d.uploaded_at, d.status
FROM kyc_documents d
WHERE d.status = 'received'
  AND d.deleted_at IS NULL
  AND d.uploaded_at < now() - INTERVAL '24 hours';
```

### P11. Signed document active past `expiryDate`

```sql
SELECT id, document_type, document_title, signed_by, signed_date, expiry_date, status
FROM signed_documents
WHERE status = 'active'
  AND expiry_date IS NOT NULL
  AND expiry_date < now();
```

### P12. Approval / rejection without a corresponding audit-trail row

```sql
SELECT pa.id, pa.application_id, pa.status, pa.reviewed_at, pa.reviewed_by
FROM provider_applications pa
LEFT JOIN provider_review_audit pra
       ON pra.application_id = pa.id
      AND pra.event_type IN ('approve', 'reject', 'approved', 'rejected')
WHERE pa.status IN ('approved', 'rejected')
  AND pa.reviewed_at IS NOT NULL
  AND pra.id IS NULL;
```

If this returns rows, the admin write path bypassed
`server/services/providerAudit.ts → writeProviderAudit`. Critical signal.

### P13. Google-Forms intake never converted to application

```sql
SELECT id, intake_id, email, synced_at
FROM provider_intake_queue
WHERE converted_to_application_id IS NULL
  AND synced_at < now() - INTERVAL '14 days';
```

### P14. Invite code over-use or expired-but-active drift

```sql
SELECT invite_code, provider_type, max_uses, current_uses, expires_at, is_active
FROM provider_invite_codes
WHERE (current_uses > max_uses)
   OR (is_active = true AND expires_at IS NOT NULL AND expires_at < now());
```

## 7. What the coworker is allowed to do

- **READ** any of the tables above through `server/services/coworker/readonly-db.ts`.
- **REPORT** rule hits in a triage view (one finding per rule + applicant id).
- **PROPOSE** a remediation that maps to an existing reviewed admin path
  (`AdminProviderReviewService.{approveApplication, rejectApplication,
  setOnHold}`, `provider-onboarding` re-request flows) — without executing
  it.

## 8. What the coworker must NOT do (hard stops)

- Write to `provider_applications`, `provider_approval_queue`,
  `provider_police_checks`, `provider_certificates`, `provider_invite_codes`,
  `provider_intake_queue`, `kyc_cases`, `kyc_documents`, `kyc_checks`,
  `signed_documents`, `provider_review_audit`, `walker_profiles`,
  `sitter_profiles`, `trainers`, or `users.role`.
- Trigger approve / reject / withdraw / on-hold transitions.
- Issue, revoke, suspend, or extend `provider_certificates` rows.
- Send onboarding, approval, rejection, or expiry-warning emails or SMS
  (no `superAppNotifications` insert, no `dispatchNotifications` call, no
  `PetWashNotificationEngine` invocation).
- Touch any payout flow (`ProviderPayoutService`,
  `super_app_payouts`).
- Modify auth state — no Firebase custom claims, no `auth/disable` calls.
- Add schema migrations or new dependencies.

The governance layer in `server/services/coworker/governance.ts` already
enforces the read-only invariant for AI text output; the SELECT-only guard
in `readonly-db.ts` enforces the data-layer invariant. This document is the
*what* and *why* the coworker is querying, and the stub at
`server/services/coworker/providerCoworker.ts` is the *how*.

## 9. Open questions / observations for follow-up PRs

1. **Two intake paths coexist.** `provider_intake_queue` (Google Forms,
   pre-application) and `provider_applications` (in-app wizard) both seed
   the funnel. Conversion is one-directional via
   `convertedToApplicationId`, but no cron is documented to garbage-collect
   stranded intake rows. Rule P13 is the detection path.
2. **Approval queue keyed on `providerId`.** `provider_approval_queue` uses
   the eventual provider id, but at submission time the application has no
   provider id yet — the join in rule P2 falls back to `userId` because
   `provider_applications.userId === providerApprovalQueue.providerId`
   only after `approvedAsProviderId` is set. Worth verifying the queue is
   seeded with the *applicant* user id from the start.
3. **Police-clearance expiry has no admin nudge.** Rule P8 surfaces
   upcoming expiries, but there is no in-platform notification cron — once
   `expires_at` passes, the provider is implicitly trusted until someone
   notices.
4. **`provider_review_audit` is best-effort.** `writeProviderAudit` swallows
   errors (`console.error` only). Rule P12 detects audit-row absence after
   the fact; a follow-up PR should fail-closed on audit-write errors in the
   admin paths.
5. **KYC2026 vs. legacy biometric columns.** `provider_applications.biometric*`
   and `kyc_cases` / `kyc_documents` describe overlapping state. A future
   PR should either fold the application columns into a single FK to
   `kyc_cases` or document the read precedence.
6. **No `withdrawn` cleanup.** Applications that go to `withdrawn` retain
   all uploaded URLs (`selfiePhotoUrl`, `governmentIdUrl`,
   `criminalCheckReportId`, `kyc_documents.storageRef`). Out of scope for
   the coworker; flagged for the privacy backlog.
7. **`requires_enhanced_verification` reasons array.** Stored as
   `text[]` on `provider_applications.enhancedVerificationReasons`. The
   coworker can read it for triage commentary but no detection rule
   currently asserts the reasons match the provider type — e.g. a
   non-driver flagged for driving-record review is a misroute.

---

*Read-only document. No data changes. No notifications. No write code paths.*
