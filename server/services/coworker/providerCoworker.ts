/**
 * providerCoworker — read-only detection library for provider onboarding.
 *
 * PR-24 ADDS THE STUB. No callers wired yet — the family-specific UI in
 * later PRs (analogous to PR-25's booking coworker UI) will plug into
 * `runAllRules()` and surface findings to a human admin.
 *
 * Hard rules (mirrored from docs/coworker/PR-24-provider-data-map.md §8):
 *
 *   - Every query goes through `readonlyDb.execute` — SELECT-only guard.
 *   - This module is pure read. It NEVER:
 *       * mutates `provider_applications`, `provider_approval_queue`,
 *         `provider_police_checks`, `provider_certificates`,
 *         `provider_invite_codes`, `provider_intake_queue`,
 *         `kyc_cases`, `kyc_documents`, `kyc_checks`, `signed_documents`,
 *         or `provider_review_audit`;
 *       * sends emails or SMS (no `dispatchNotifications`, no
 *         `superAppNotifications` insert, no `PetWashNotificationEngine`);
 *       * triggers approve / reject / withdraw / on-hold flows;
 *       * issues, revokes, or extends `provider_certificates`;
 *       * touches payout, escrow, or auth state.
 *   - Findings are advisory. Remediation must go through the existing
 *     admin paths in `server/routes/admin-provider-review.ts` and
 *     `server/services/AdminProviderReviewService.ts`.
 *
 * No new dependencies. No schema migrations.
 */
import { readonlyDb, sql } from './readonly-db';

/**
 * Detection rule identifiers (P1–P14). Keep in sync with the data-map doc.
 */
export type ProviderCoworkerRule =
  | 'P1' // Application stuck in pending_review > 7d
  | 'P2' // under_review with no admin touch > 5d
  | 'P3' // Approval queue on_hold > 14d
  | 'P4' // Approval queue checklist drift (approved + a check is false)
  | 'P5' // Approval queue ready but still pending > 24h
  | 'P6' // Biometric verified but application not advanced > 3d
  | 'P7' // Criminal check requires_review without admin follow-up > 48h
  | 'P8' // Police clearance approaching / past expiry
  | 'P9' // Insurance expired on approved provider
  | 'P10' // KYC document received but never processed > 24h
  | 'P11' // Signed document active past expiryDate
  | 'P12' // Approval/rejection without audit-trail row
  | 'P13' // Google-Forms intake never converted > 14d
  | 'P14'; // Invite code over-use or expired-but-active drift

/**
 * One observed signal. Coworker UI surfaces these grouped by rule.
 *
 * - `providerApplicationId`: usually the `provider_applications.id` (serial).
 *   May be null for rules that key on a different table (P10 KYC docs,
 *   P11 signed docs, P13 intake queue, P14 invite codes).
 * - `signal`: short human-readable headline.
 * - `evidence`: structured payload with rule-specific fields. Free-shape
 *   so each detection function can include the columns relevant to its
 *   triage decision.
 */
export interface ProviderCoworkerFinding {
  rule: ProviderCoworkerRule;
  providerApplicationId: number | null;
  signal: string;
  evidence: Record<string, unknown>;
}

/** Standard limit applied to every detection query. */
const DEFAULT_LIMIT = 200;

// ─── P1. Application stuck in pending_review > 7d ───────────────────────────
export async function detectStuckPendingReview(): Promise<ProviderCoworkerFinding[]> {
  const { rows } = await readonlyDb.execute<{
    id: number;
    application_id: string;
    user_id: string;
    submitted_at: string | null;
    status: string;
  }>(sql`
    SELECT id, application_id, user_id, submitted_at, status
    FROM provider_applications
    WHERE status = 'pending_review'
      AND submitted_at < now() - INTERVAL '7 days'
    ORDER BY submitted_at ASC
    LIMIT ${DEFAULT_LIMIT}
  `);
  return rows.map((r) => ({
    rule: 'P1' as const,
    providerApplicationId: r.id,
    signal: `pending_review > 7d (applicationId=${r.application_id})`,
    evidence: {
      applicationId: r.application_id,
      userId: r.user_id,
      submittedAt: r.submitted_at,
      status: r.status,
    },
  }));
}

// ─── P2. under_review with no admin touch > 5d ──────────────────────────────
export async function detectStaleUnderReview(): Promise<ProviderCoworkerFinding[]> {
  const { rows } = await readonlyDb.execute<{
    id: number;
    application_id: string;
    assigned_to: string | null;
    assigned_at: string | null;
    reviewed_at: string | null;
    submitted_at: string | null;
  }>(sql`
    SELECT pa.id, pa.application_id, paq.assigned_to, paq.assigned_at,
           paq.reviewed_at, pa.submitted_at
    FROM provider_applications pa
    LEFT JOIN provider_approval_queue paq ON paq.provider_id = pa.user_id
    WHERE pa.status = 'under_review'
      AND COALESCE(paq.reviewed_at, paq.assigned_at, pa.submitted_at)
            < now() - INTERVAL '5 days'
    ORDER BY pa.submitted_at ASC
    LIMIT ${DEFAULT_LIMIT}
  `);
  return rows.map((r) => ({
    rule: 'P2' as const,
    providerApplicationId: r.id,
    signal: `under_review with no admin touch > 5d (applicationId=${r.application_id})`,
    evidence: {
      applicationId: r.application_id,
      assignedTo: r.assigned_to,
      assignedAt: r.assigned_at,
      reviewedAt: r.reviewed_at,
      submittedAt: r.submitted_at,
    },
  }));
}

// ─── P3. Approval queue on_hold > 14d ───────────────────────────────────────
export async function detectLongOnHold(): Promise<ProviderCoworkerFinding[]> {
  const { rows } = await readonlyDb.execute<{
    id: number;
    provider_id: string;
    status: string;
    review_notes: string | null;
    updated_at: string | null;
  }>(sql`
    SELECT id, provider_id, status, review_notes, updated_at
    FROM provider_approval_queue
    WHERE status = 'on_hold'
      AND updated_at < now() - INTERVAL '14 days'
    ORDER BY updated_at ASC
    LIMIT ${DEFAULT_LIMIT}
  `);
  return rows.map((r) => ({
    rule: 'P3' as const,
    providerApplicationId: null, // queue is keyed on providerId, not application id
    signal: `approval_queue on_hold > 14d (providerId=${r.provider_id})`,
    evidence: {
      approvalQueueId: r.id,
      providerId: r.provider_id,
      reviewNotes: r.review_notes,
      updatedAt: r.updated_at,
    },
  }));
}

// ─── P4. Checklist drift: approved but a check is still false ───────────────
export async function detectApprovedChecklistDrift(): Promise<ProviderCoworkerFinding[]> {
  const { rows } = await readonlyDb.execute<{
    id: number;
    provider_id: string;
    photo_approved: boolean;
    certificate_approved: boolean;
    id_verified: boolean;
    address_verified: boolean;
    police_check_approved: boolean;
    insurance_verified: boolean;
    pricing_approved: boolean;
  }>(sql`
    SELECT id, provider_id, photo_approved, certificate_approved,
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
        OR pricing_approved = false)
    LIMIT ${DEFAULT_LIMIT}
  `);
  return rows.map((r) => ({
    rule: 'P4' as const,
    providerApplicationId: null,
    signal: `approved with checklist gap (providerId=${r.provider_id})`,
    evidence: {
      approvalQueueId: r.id,
      providerId: r.provider_id,
      photoApproved: r.photo_approved,
      certificateApproved: r.certificate_approved,
      idVerified: r.id_verified,
      addressVerified: r.address_verified,
      policeCheckApproved: r.police_check_approved,
      insuranceVerified: r.insurance_verified,
      pricingApproved: r.pricing_approved,
    },
  }));
}

// ─── P5. Inverse drift: queue ready but still pending > 24h ─────────────────
export async function detectReadyButPending(): Promise<ProviderCoworkerFinding[]> {
  const { rows } = await readonlyDb.execute<{
    id: number;
    provider_id: string;
    created_at: string | null;
  }>(sql`
    SELECT id, provider_id, created_at
    FROM provider_approval_queue
    WHERE status = 'pending'
      AND photo_approved AND certificate_approved AND id_verified
      AND address_verified AND police_check_approved AND insurance_verified
      AND pricing_approved
      AND created_at < now() - INTERVAL '24 hours'
    ORDER BY created_at ASC
    LIMIT ${DEFAULT_LIMIT}
  `);
  return rows.map((r) => ({
    rule: 'P5' as const,
    providerApplicationId: null,
    signal: `all checks ticked but status=pending > 24h (providerId=${r.provider_id})`,
    evidence: {
      approvalQueueId: r.id,
      providerId: r.provider_id,
      createdAt: r.created_at,
    },
  }));
}

// ─── P6. Biometric verified but application not advanced > 3d ───────────────
export async function detectBiometricStallout(): Promise<ProviderCoworkerFinding[]> {
  const { rows } = await readonlyDb.execute<{
    id: number;
    application_id: string;
    biometric_status: string | null;
    biometric_verified_at: string | null;
    status: string | null;
  }>(sql`
    SELECT id, application_id, biometric_status, biometric_verified_at, status
    FROM provider_applications
    WHERE biometric_status = 'verified'
      AND biometric_verified_at < now() - INTERVAL '3 days'
      AND status IN ('draft', 'pending_review')
    ORDER BY biometric_verified_at ASC
    LIMIT ${DEFAULT_LIMIT}
  `);
  return rows.map((r) => ({
    rule: 'P6' as const,
    providerApplicationId: r.id,
    signal: `biometric verified > 3d but status=${r.status} (applicationId=${r.application_id})`,
    evidence: {
      applicationId: r.application_id,
      biometricStatus: r.biometric_status,
      biometricVerifiedAt: r.biometric_verified_at,
      status: r.status,
    },
  }));
}

// ─── P7. Criminal check requires_review without follow-up > 48h ─────────────
export async function detectCriminalCheckUntouched(): Promise<ProviderCoworkerFinding[]> {
  const { rows } = await readonlyDb.execute<{
    id: number;
    application_id: string;
    criminal_check_status: string | null;
    criminal_check_completed_at: string | null;
    reviewed_at: string | null;
  }>(sql`
    SELECT id, application_id, criminal_check_status,
           criminal_check_completed_at, reviewed_at
    FROM provider_applications
    WHERE criminal_check_status = 'requires_review'
      AND criminal_check_completed_at < now() - INTERVAL '48 hours'
      AND reviewed_at IS NULL
    ORDER BY criminal_check_completed_at ASC
    LIMIT ${DEFAULT_LIMIT}
  `);
  return rows.map((r) => ({
    rule: 'P7' as const,
    providerApplicationId: r.id,
    signal: `criminal_check=requires_review > 48h, no admin follow-up (applicationId=${r.application_id})`,
    evidence: {
      applicationId: r.application_id,
      criminalCheckStatus: r.criminal_check_status,
      criminalCheckCompletedAt: r.criminal_check_completed_at,
      reviewedAt: r.reviewed_at,
    },
  }));
}

// ─── P8. Police clearance approaching / past expiry ─────────────────────────
export async function detectPoliceCheckExpiring(): Promise<ProviderCoworkerFinding[]> {
  const { rows } = await readonlyDb.execute<{
    id: number;
    provider_id: string;
    status: string | null;
    issued_at: string | null;
    expires_at: string | null;
  }>(sql`
    SELECT id, provider_id, status, issued_at, expires_at
    FROM provider_police_checks
    WHERE status = 'approved'
      AND expires_at IS NOT NULL
      AND expires_at < now() + INTERVAL '30 days'
    ORDER BY expires_at ASC
    LIMIT ${DEFAULT_LIMIT}
  `);
  return rows.map((r) => ({
    rule: 'P8' as const,
    providerApplicationId: null,
    signal: `police clearance expiring within 30d (providerId=${r.provider_id})`,
    evidence: {
      policeCheckId: r.id,
      providerId: r.provider_id,
      status: r.status,
      issuedAt: r.issued_at,
      expiresAt: r.expires_at,
    },
  }));
}

// ─── P9. Insurance expired on approved provider application ─────────────────
export async function detectInsuranceExpired(): Promise<ProviderCoworkerFinding[]> {
  const { rows } = await readonlyDb.execute<{
    id: number;
    application_id: string;
    insurance_provider: string | null;
    insurance_expires_at: string | null;
    status: string | null;
  }>(sql`
    SELECT id, application_id, insurance_provider, insurance_expires_at, status
    FROM provider_applications
    WHERE status = 'approved'
      AND insurance_expires_at IS NOT NULL
      AND insurance_expires_at < now()
    ORDER BY insurance_expires_at ASC
    LIMIT ${DEFAULT_LIMIT}
  `);
  return rows.map((r) => ({
    rule: 'P9' as const,
    providerApplicationId: r.id,
    signal: `insurance expired on approved provider (applicationId=${r.application_id})`,
    evidence: {
      applicationId: r.application_id,
      insuranceProvider: r.insurance_provider,
      insuranceExpiresAt: r.insurance_expires_at,
      status: r.status,
    },
  }));
}

// ─── P10. KYC document received but never processed > 24h ───────────────────
export async function detectKycDocumentBacklog(): Promise<ProviderCoworkerFinding[]> {
  const { rows } = await readonlyDb.execute<{
    id: number;
    kyc_case_id: number;
    doc_type: string;
    uploaded_at: string;
    status: string;
  }>(sql`
    SELECT id, kyc_case_id, doc_type, uploaded_at, status
    FROM kyc_documents
    WHERE status = 'received'
      AND deleted_at IS NULL
      AND uploaded_at < now() - INTERVAL '24 hours'
    ORDER BY uploaded_at ASC
    LIMIT ${DEFAULT_LIMIT}
  `);
  return rows.map((r) => ({
    rule: 'P10' as const,
    providerApplicationId: null,
    signal: `kyc_documents.status=received > 24h (kycCaseId=${r.kyc_case_id})`,
    evidence: {
      kycDocumentId: r.id,
      kycCaseId: r.kyc_case_id,
      docType: r.doc_type,
      uploadedAt: r.uploaded_at,
      status: r.status,
    },
  }));
}

// ─── P11. Signed document active past expiryDate ────────────────────────────
export async function detectExpiredSignedDocuments(): Promise<ProviderCoworkerFinding[]> {
  const { rows } = await readonlyDb.execute<{
    id: number;
    document_type: string;
    document_title: string;
    signed_by: string;
    signed_date: string | null;
    expiry_date: string | null;
    status: string | null;
  }>(sql`
    SELECT id, document_type, document_title, signed_by,
           signed_date, expiry_date, status
    FROM signed_documents
    WHERE status = 'active'
      AND expiry_date IS NOT NULL
      AND expiry_date < now()
    ORDER BY expiry_date ASC
    LIMIT ${DEFAULT_LIMIT}
  `);
  return rows.map((r) => ({
    rule: 'P11' as const,
    providerApplicationId: null,
    signal: `signed document active past expiry (docId=${r.id}, type=${r.document_type})`,
    evidence: {
      signedDocumentId: r.id,
      documentType: r.document_type,
      documentTitle: r.document_title,
      signedBy: r.signed_by,
      signedDate: r.signed_date,
      expiryDate: r.expiry_date,
      status: r.status,
    },
  }));
}

// ─── P12. Approval/rejection without audit-trail row ────────────────────────
export async function detectMissingAuditTrail(): Promise<ProviderCoworkerFinding[]> {
  const { rows } = await readonlyDb.execute<{
    id: number;
    application_id: string;
    status: string;
    reviewed_at: string | null;
    reviewed_by: string | null;
  }>(sql`
    SELECT pa.id, pa.application_id, pa.status, pa.reviewed_at, pa.reviewed_by
    FROM provider_applications pa
    LEFT JOIN provider_review_audit pra
           ON pra.application_id = pa.id
          AND pra.event_type IN ('approve', 'reject', 'approved', 'rejected')
    WHERE pa.status IN ('approved', 'rejected')
      AND pa.reviewed_at IS NOT NULL
      AND pra.id IS NULL
    LIMIT ${DEFAULT_LIMIT}
  `);
  return rows.map((r) => ({
    rule: 'P12' as const,
    providerApplicationId: r.id,
    signal: `${r.status} application has no provider_review_audit row (applicationId=${r.application_id})`,
    evidence: {
      applicationId: r.application_id,
      status: r.status,
      reviewedAt: r.reviewed_at,
      reviewedBy: r.reviewed_by,
    },
  }));
}

// ─── P13. Intake never converted > 14d ──────────────────────────────────────
export async function detectIntakeConversionLag(): Promise<ProviderCoworkerFinding[]> {
  const { rows } = await readonlyDb.execute<{
    id: number;
    intake_id: string;
    email: string;
    synced_at: string | null;
  }>(sql`
    SELECT id, intake_id, email, synced_at
    FROM provider_intake_queue
    WHERE converted_to_application_id IS NULL
      AND synced_at < now() - INTERVAL '14 days'
    ORDER BY synced_at ASC
    LIMIT ${DEFAULT_LIMIT}
  `);
  return rows.map((r) => ({
    rule: 'P13' as const,
    providerApplicationId: null,
    signal: `intake never converted > 14d (intakeId=${r.intake_id})`,
    evidence: {
      intakeQueueId: r.id,
      intakeId: r.intake_id,
      email: r.email,
      syncedAt: r.synced_at,
    },
  }));
}

// ─── P14. Invite code over-use or expired-but-active drift ──────────────────
export async function detectInviteCodeDrift(): Promise<ProviderCoworkerFinding[]> {
  const { rows } = await readonlyDb.execute<{
    invite_code: string;
    provider_type: string;
    max_uses: number | null;
    current_uses: number | null;
    expires_at: string | null;
    is_active: boolean | null;
  }>(sql`
    SELECT invite_code, provider_type, max_uses, current_uses,
           expires_at, is_active
    FROM provider_invite_codes
    WHERE (current_uses > max_uses)
       OR (is_active = true AND expires_at IS NOT NULL AND expires_at < now())
    LIMIT ${DEFAULT_LIMIT}
  `);
  return rows.map((r) => ({
    rule: 'P14' as const,
    providerApplicationId: null,
    signal: `invite code drift (code=${r.invite_code})`,
    evidence: {
      inviteCode: r.invite_code,
      providerType: r.provider_type,
      maxUses: r.max_uses,
      currentUses: r.current_uses,
      expiresAt: r.expires_at,
      isActive: r.is_active,
    },
  }));
}

/** Map of every detection function, keyed by rule id. */
export const PROVIDER_DETECTION_RULES: Record<
  ProviderCoworkerRule,
  () => Promise<ProviderCoworkerFinding[]>
> = {
  P1: detectStuckPendingReview,
  P2: detectStaleUnderReview,
  P3: detectLongOnHold,
  P4: detectApprovedChecklistDrift,
  P5: detectReadyButPending,
  P6: detectBiometricStallout,
  P7: detectCriminalCheckUntouched,
  P8: detectPoliceCheckExpiring,
  P9: detectInsuranceExpired,
  P10: detectKycDocumentBacklog,
  P11: detectExpiredSignedDocuments,
  P12: detectMissingAuditTrail,
  P13: detectIntakeConversionLag,
  P14: detectInviteCodeDrift,
};

/**
 * Run every detection rule and return a flat list of findings. Errors from
 * one rule do not block the others — a failing rule contributes no
 * findings and is logged (intended caller is the coworker UI which renders
 * findings + a banner of failed rules; we keep this stub framework-agnostic
 * by returning a structured result rather than throwing).
 */
export interface RunAllRulesResult {
  findings: ProviderCoworkerFinding[];
  failedRules: { rule: ProviderCoworkerRule; error: string }[];
}

export async function runAllRules(): Promise<RunAllRulesResult> {
  const findings: ProviderCoworkerFinding[] = [];
  const failedRules: { rule: ProviderCoworkerRule; error: string }[] = [];
  const entries = Object.entries(PROVIDER_DETECTION_RULES) as [
    ProviderCoworkerRule,
    () => Promise<ProviderCoworkerFinding[]>,
  ][];
  await Promise.all(
    entries.map(async ([rule, fn]) => {
      try {
        const rows = await fn();
        findings.push(...rows);
      } catch (err) {
        failedRules.push({
          rule,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }),
  );
  return { findings, failedRules };
}
