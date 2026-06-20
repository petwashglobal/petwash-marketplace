/**
 * Provider full-verification service.
 *
 * Computes the admin verification CHECKLIST for a provider application by
 * combining what already exists (#902: encrypted typed ID, selfie + Google-Vision
 * face match, hash-sealed declaration) with the NEW manual-matching record and
 * official-document lifecycle (schema-provider-verification.ts).
 *
 * The gate: isProviderFullyVerified() is TRUE only when an admin has recorded a
 * review with reviewStatus='approved'. Everything is fail-closed — any error, any
 * missing artefact → not verified. Recording functions are audit-logged.
 *
 * This service does NOT auto-mutate the live approval flow. A caller (behind the
 * PROVIDER_VERIFY_GATE flag) may consult isProviderFullyVerified() before seeding
 * waitlist / enabling payout, so enabling the gate is a deliberate ops decision.
 */

import { sql, eq, desc } from "drizzle-orm";
import { db } from "../db";
import { logger } from "../lib/logger";
import { logAuditEvent } from "../middleware/auditLog";
import {
  providerVerificationReviews,
  providerOfficialDocuments,
  type ProviderVerificationReview,
} from "@shared/schema-provider-verification";

function rows(res: any): any[] { return res?.rows ?? res ?? []; }

/** Best-effort read of the provider application row (resilient to absent columns). */
async function loadApplication(applicationId: string): Promise<any | null> {
  try {
    const res = await db.execute(sql`
      SELECT application_id, user_id, status, email, phone_number, first_name, last_name,
             date_of_birth, age_confirmed_18_plus, kyc_id_last_four, kyc_document_type,
             israeli_id_encrypted, selfie_photo_url, government_id_url,
             biometric_status, biometric_match_score, declaration_signature_sha256,
             reviewed_by, reviewed_at
      FROM provider_applications
      WHERE application_id = ${applicationId}
      LIMIT 1
    `);
    return rows(res)[0] ?? null;
  } catch (e) {
    logger.error("[ProviderVerify] loadApplication failed", { applicationId, error: e instanceof Error ? e.message : String(e) });
    return null;
  }
}

/** Best-effort email/mobile verified flags from the users table. */
async function loadUserVerification(userId: string | null): Promise<{ emailVerified: boolean; mobileVerified: boolean }> {
  if (!userId) return { emailVerified: false, mobileVerified: false };
  try {
    const res = await db.execute(sql`
      SELECT email_verified_at, mobile_verified_at, phone_verified_at
      FROM users WHERE id = ${userId} LIMIT 1
    `);
    const r = rows(res)[0] ?? {};
    return {
      emailVerified: !!r.email_verified_at,
      mobileVerified: !!(r.mobile_verified_at ?? r.phone_verified_at),
    };
  } catch {
    return { emailVerified: false, mobileVerified: false };
  }
}

export async function getOrCreateReview(applicationId: string, providerId?: string | null): Promise<ProviderVerificationReview> {
  const [existing] = await db.select().from(providerVerificationReviews)
    .where(eq(providerVerificationReviews.applicationId, applicationId))
    .orderBy(desc(providerVerificationReviews.createdAt)).limit(1);
  if (existing && existing.reviewStatus !== "approved" && existing.reviewStatus !== "rejected") return existing;
  if (existing && (existing.reviewStatus === "approved" || existing.reviewStatus === "rejected")) return existing;
  const [created] = await db.insert(providerVerificationReviews)
    .values({ applicationId, providerId: providerId ?? null })
    .returning();
  return created;
}

export interface VerificationChecklist {
  applicationId: string;
  fullyVerified: boolean;
  reviewStatus: string;
  items: {
    emailVerified: boolean;
    mobileVerified: boolean;
    age18Confirmed: boolean;
    idDetailsTyped: boolean;
    selfieReceived: boolean;
    selfieAutoMatched: boolean;     // Google-Vision auto verdict
    officialDocumentReceived: boolean;
    contractSigned: boolean;        // declaration hash present (dedicated contract is a separate gap)
    nameMatch: string;
    dobMatch: string;
    documentNumberMatch: string;
    selfiePhotoMatch: string;
    contractNameMatch: string;
  };
  document: { status: string; submissionMethod: string | null; physicalReceived: boolean } | null;
  /** Honest note surfaced to the admin UI. */
  notes: string[];
}

export async function computeChecklist(applicationId: string): Promise<VerificationChecklist | null> {
  const app = await loadApplication(applicationId);
  if (!app) return null;

  const review = await getOrCreateReview(applicationId, app.user_id);
  const userV = await loadUserVerification(app.user_id);

  // Latest official document row (if any).
  const [doc] = await db.select().from(providerOfficialDocuments)
    .where(eq(providerOfficialDocuments.applicationId, applicationId))
    .orderBy(desc(providerOfficialDocuments.createdAt)).limit(1);

  const officialDocumentReceived = !!doc && (
    doc.physicalReceived || ["received", "under_review", "matched"].includes(doc.documentStatus)
  ) || !!app.government_id_url;

  const notes: string[] = [];
  if (!app.declaration_signature_sha256) notes.push("No signed declaration on file.");
  notes.push("‘Contract signed’ reflects the hash-sealed provider declaration. A dedicated provider CONTRACT e-signature is a separate gap (flag provider_digital_signature is off pending legal).");

  return {
    applicationId,
    fullyVerified: review.reviewStatus === "approved",
    reviewStatus: review.reviewStatus,
    items: {
      emailVerified: userV.emailVerified,
      mobileVerified: userV.mobileVerified,
      age18Confirmed: !!app.age_confirmed_18_plus,
      idDetailsTyped: !!(app.kyc_id_last_four || app.israeli_id_encrypted),
      selfieReceived: !!app.selfie_photo_url,
      selfieAutoMatched: String(app.biometric_status || "").toLowerCase() === "verified",
      officialDocumentReceived,
      contractSigned: !!app.declaration_signature_sha256,
      nameMatch: review.nameMatch,
      dobMatch: review.dobMatch,
      documentNumberMatch: review.documentNumberMatch,
      selfiePhotoMatch: review.selfiePhotoMatch,
      contractNameMatch: review.contractNameMatch,
    },
    document: doc ? { status: doc.documentStatus, submissionMethod: doc.submissionMethod, physicalReceived: doc.physicalReceived } : null,
    notes,
  };
}

/** Gate — fail-closed. TRUE only when an admin recorded reviewStatus='approved'. */
export async function isProviderFullyVerified(applicationId: string): Promise<boolean> {
  try {
    const [review] = await db.select().from(providerVerificationReviews)
      .where(eq(providerVerificationReviews.applicationId, applicationId))
      .orderBy(desc(providerVerificationReviews.createdAt)).limit(1);
    return review?.reviewStatus === "approved";
  } catch {
    return false;
  }
}

type ReviewPatch = Partial<Pick<ProviderVerificationReview,
  "typedDetailsChecked" | "selfieChecked" | "officialDocumentChecked" | "contractChecked" |
  "nameMatch" | "dobMatch" | "documentNumberMatch" | "selfiePhotoMatch" | "contractNameMatch" | "notes">>;

export async function patchReview(applicationId: string, adminId: string, patch: ReviewPatch, ip?: string, ua?: string): Promise<void> {
  const review = await getOrCreateReview(applicationId);
  await db.update(providerVerificationReviews)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(providerVerificationReviews.id, review.id));
  await logAuditEvent({
    actorUserId: adminId, actorRole: "admin", actionType: "PROVIDER_VERIFY_PATCH",
    targetType: "provider_application", targetId: applicationId, ip, userAgent: ua,
    metadata: { patch }, severity: "info",
  });
}

/** Record the final manual decision. 'approved' = identity-verified gate passes. */
export async function setReviewDecision(
  applicationId: string, adminId: string,
  decision: "approved" | "needs_more_info" | "rejected", notes: string, ip?: string, ua?: string,
): Promise<void> {
  if (decision === "rejected" && (!notes || notes.trim().length < 3)) throw new Error("reason required to reject");
  const review = await getOrCreateReview(applicationId);
  await db.update(providerVerificationReviews)
    .set({ reviewStatus: decision, reviewedByAdminId: adminId, reviewedAt: new Date(), notes, updatedAt: new Date() })
    .where(eq(providerVerificationReviews.id, review.id));
  await logAuditEvent({
    actorUserId: adminId, actorRole: "admin", actionType: "PROVIDER_VERIFY_DECISION",
    targetType: "provider_application", targetId: applicationId, ip, userAgent: ua,
    metadata: { decision, notes }, severity: "warning",
  });
}

// ── Official-document lifecycle ────────────────────────────────────────────────

export async function recordDocument(
  applicationId: string, adminId: string,
  input: { documentType: string; submissionMethod: string; providerId?: string | null; fileId?: string | null; physicalReceived?: boolean },
  ip?: string, ua?: string,
): Promise<number> {
  const [created] = await db.insert(providerOfficialDocuments).values({
    applicationId, providerId: input.providerId ?? null,
    documentType: input.documentType, submissionMethod: input.submissionMethod,
    fileId: input.fileId ?? null,
    physicalReceived: input.physicalReceived ?? false,
    documentStatus: input.physicalReceived ? "received" : "pending",
    receivedAt: input.physicalReceived ? new Date() : null,
    receivedByAdminId: input.physicalReceived ? adminId : null,
  }).returning({ id: providerOfficialDocuments.id });
  await logAuditEvent({ actorUserId: adminId, actorRole: "admin", actionType: "PROVIDER_DOC_RECORDED", targetType: "provider_application", targetId: applicationId, ip, userAgent: ua, metadata: { ...input, fileId: undefined } });
  return created.id;
}

async function updateDoc(docId: number, set: Record<string, any>, adminId: string, action: string, applicationId: string, ip?: string, ua?: string, severity: "info" | "warning" = "info") {
  await db.update(providerOfficialDocuments).set({ ...set, updatedAt: new Date() }).where(eq(providerOfficialDocuments.id, docId));
  await logAuditEvent({ actorUserId: adminId, actorRole: "admin", actionType: action, targetType: "provider_document", targetId: String(docId), ip, userAgent: ua, metadata: { applicationId, ...set }, severity });
}

export const markDocumentReceived = (docId: number, adminId: string, applicationId: string, ip?: string, ua?: string) =>
  updateDoc(docId, { physicalReceived: true, documentStatus: "received", receivedAt: new Date(), receivedByAdminId: adminId }, adminId, "PROVIDER_DOC_RECEIVED", applicationId, ip, ua);

export const markDocumentDestroyed = (docId: number, adminId: string, applicationId: string, ip?: string, ua?: string) =>
  updateDoc(docId, { documentStatus: "destroyed", destroyedAt: new Date(), destroyedByAdminId: adminId }, adminId, "PROVIDER_DOC_DESTROYED", applicationId, ip, ua, "warning");

export const markDocumentDeleted = (docId: number, adminId: string, applicationId: string, ip?: string, ua?: string) =>
  updateDoc(docId, { documentStatus: "deleted", deletionAt: new Date(), deletionByAdminId: adminId }, adminId, "PROVIDER_DOC_DELETED", applicationId, ip, ua, "warning");

export const setDocumentLegalHold = (docId: number, adminId: string, applicationId: string, reason: string, ip?: string, ua?: string) =>
  updateDoc(docId, { legalHold: true, legalHoldReason: reason, documentStatus: "legal_hold" }, adminId, "PROVIDER_DOC_LEGAL_HOLD", applicationId, ip, ua, "warning");
