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

/**
 * Best-effort read of the provider application row. Resolves by application_id
 * OR user_id — the gate keys on the Firebase UID, so the checklist must open the
 * same record whether addressed by APP-… id or by UID.
 */
async function loadApplication(idOrUser: string): Promise<any | null> {
  try {
    const res = await db.execute(sql`
      SELECT application_id, user_id, status, email, phone_number, first_name, last_name,
             date_of_birth, age_confirmed_18_plus, kyc_id_last_four, kyc_document_type,
             israeli_id_encrypted, selfie_photo_url, government_id_url,
             biometric_status, biometric_match_score, declaration_signature_sha256,
             reviewed_by, reviewed_at
      FROM provider_applications
      WHERE application_id = ${idOrUser} OR user_id = ${idOrUser}
      ORDER BY (application_id = ${idOrUser}) DESC
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

/** Normalize an APP-id-or-UID to the canonical { applicationId, providerId }. */
export async function resolveCanonical(idOrUser: string, providerIdHint?: string | null): Promise<{ applicationId: string; providerId: string | null }> {
  const app = await loadApplication(idOrUser);
  if (app) return { applicationId: app.application_id, providerId: app.user_id ?? null };
  return { applicationId: idOrUser, providerId: providerIdHint ?? null };
}

export async function getOrCreateReview(idOrUser: string, providerIdHint?: string | null): Promise<ProviderVerificationReview> {
  const { applicationId, providerId } = await resolveCanonical(idOrUser, providerIdHint);
  const [existing] = await db.select().from(providerVerificationReviews)
    .where(eq(providerVerificationReviews.applicationId, applicationId))
    .orderBy(desc(providerVerificationReviews.createdAt)).limit(1);
  if (existing) return existing;
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

export async function computeChecklist(idOrUser: string): Promise<VerificationChecklist | null> {
  const app = await loadApplication(idOrUser);
  if (!app) return null;

  // Canonical key — always the real APP-… id, regardless of how the page was
  // opened (by APP-id or by UID), so reviews/documents never fork.
  const applicationId: string = app.application_id;

  // READ-ONLY: do NOT create a review row just for viewing the checklist —
  // otherwise merely opening a provider's verification page would arm the soft
  // approval/payout gate and surprise-block their inbox "Approve". A review is
  // created only when an admin actively patches/decides (patchReview/setReviewDecision).
  const [existingReview] = await db.select().from(providerVerificationReviews)
    .where(eq(providerVerificationReviews.applicationId, applicationId))
    .orderBy(desc(providerVerificationReviews.createdAt)).limit(1);
  const review = existingReview ?? ({
    reviewStatus: "pending_review",
    nameMatch: "pending", dobMatch: "pending", documentNumberMatch: "pending",
    selfiePhotoMatch: "pending", contractNameMatch: "pending",
  } as ProviderVerificationReview);
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

/**
 * Same gate keyed by the provider's Firebase UID — the only id shared by both
 * provider-application subsystems (provider_applicants ↔ provider_applications).
 * Used by the /admin/:id/approve endpoint so a provider card cannot be created
 * until an admin has recorded identity acceptance. Fail-closed.
 */
export async function isProviderFullyVerifiedByUser(userId: string): Promise<boolean> {
  if (!userId) return false;
  try {
    const [review] = await db.select().from(providerVerificationReviews)
      .where(eq(providerVerificationReviews.providerId, userId))
      .orderBy(desc(providerVerificationReviews.createdAt)).limit(1);
    return review?.reviewStatus === "approved";
  } catch {
    return false;
  }
}

/**
 * Has the admin reviewed this provider AT ALL (any non-terminal/terminal review row)?
 * Lets the approve endpoint distinguish "rejected/pending verification" (block)
 * from "no verification record yet" (legacy flow) when the gate runs in soft mode.
 */
export async function hasVerificationRecordByUser(userId: string): Promise<boolean> {
  if (!userId) return false;
  try {
    const [review] = await db.select().from(providerVerificationReviews)
      .where(eq(providerVerificationReviews.providerId, userId)).limit(1);
    return !!review;
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
  idOrUser: string, adminId: string,
  input: { documentType: string; submissionMethod: string; providerId?: string | null; fileId?: string | null; physicalReceived?: boolean },
  ip?: string, ua?: string,
): Promise<number> {
  const { applicationId, providerId } = await resolveCanonical(idOrUser, input.providerId);
  const [created] = await db.insert(providerOfficialDocuments).values({
    applicationId, providerId: providerId ?? null,
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
