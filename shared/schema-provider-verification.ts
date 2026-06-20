/**
 * Provider FULL verification — manual matching record + official-document
 * received/destroy lifecycle. PetWash Ltd, 2026-06-20.
 *
 * WHY (spec): typing an ID number only creates a SUBMITTED identity record; it
 * does NOT make a provider verified. Full verification requires a PetWash admin
 * to manually match: typed details vs official ID/passport/licence vs selfie vs
 * signed contract — and to record that decision with an audit trail. Until that
 * decision is recorded, the provider stays "PENDING PETWASH REVIEW" and never
 * reaches waitlist/booking/payout (fail-closed).
 *
 * ADDITIVE — does NOT replace what already exists (#902): the encrypted typed ID
 * (provider_applications.israeli_id_encrypted + kyc_id_last_four), the selfie +
 * Google-Vision face match (biometric_status/score), the hash-sealed declaration
 * (declaration_signature_sha256). This layer is the MANUAL admin gate on top.
 *
 * PRIVACY: this table stores DECISIONS + metadata, not document scans. The actual
 * ID copy lives in private storage (or is posted physically and destroyed). We
 * record only: which method, received y/n, the match verdicts, who/when, and the
 * destroy/delete/legal-hold lifecycle. Never insert a raw ID number or scan here.
 */

import { pgTable, serial, varchar, text, boolean, timestamp, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

/** Per-field match verdict used across the matching record. */
export const MATCH_VERDICTS = ["pending", "match", "mismatch", "unclear"] as const;
export type MatchVerdict = (typeof MATCH_VERDICTS)[number];

/** Overall manual-review outcome. */
export const VERIFICATION_REVIEW_STATUSES = ["pending_review", "approved", "needs_more_info", "rejected"] as const;
export type VerificationReviewStatus = (typeof VERIFICATION_REVIEW_STATUSES)[number];

/** Official-document lifecycle. */
export const OFFICIAL_DOC_STATUSES = [
  "pending", "received", "under_review", "matched", "rejected", "destroyed", "deleted", "legal_hold",
] as const;
export type OfficialDocStatus = (typeof OFFICIAL_DOC_STATUSES)[number];

export const DOC_SUBMISSION_METHODS = ["upload", "post", "delivered", "third_party"] as const;
export const OFFICIAL_DOC_TYPES = ["israeli_id", "passport", "driving_licence", "other"] as const;

/**
 * The manual matching record — one open review per provider application. The
 * admin ticks each comparison; reviewStatus='approved' is the identity-verified
 * gate that (when enabled) unlocks waitlist seeding.
 */
export const providerVerificationReviews = pgTable("provider_verification_reviews", {
  id: serial("id").primaryKey(),
  applicationId: varchar("application_id", { length: 64 }).notNull(),
  providerId: varchar("provider_id", { length: 128 }),   // Firebase UID, convenience

  // Which artefacts the admin confirmed they have + checked.
  typedDetailsChecked: boolean("typed_details_checked").notNull().default(false),
  selfieChecked: boolean("selfie_checked").notNull().default(false),
  officialDocumentChecked: boolean("official_document_checked").notNull().default(false),
  contractChecked: boolean("contract_checked").notNull().default(false),

  // Per-field match verdicts (MATCH_VERDICTS).
  nameMatch: varchar("name_match", { length: 16 }).notNull().default("pending"),
  dobMatch: varchar("dob_match", { length: 16 }).notNull().default("pending"),
  documentNumberMatch: varchar("document_number_match", { length: 16 }).notNull().default("pending"),
  selfiePhotoMatch: varchar("selfie_photo_match", { length: 16 }).notNull().default("pending"),
  contractNameMatch: varchar("contract_name_match", { length: 16 }).notNull().default("pending"),

  reviewStatus: varchar("review_status", { length: 24 }).notNull().default("pending_review"),
  reviewedByAdminId: varchar("reviewed_by_admin_id", { length: 128 }),
  reviewedAt: timestamp("reviewed_at"),
  notes: text("notes"),

  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => ({
  appIdx:    index("idx_pvr_application").on(t.applicationId),
  statusIdx: index("idx_pvr_status").on(t.reviewStatus),
}));

/**
 * Official identity document received/destroy lifecycle. Tracks HOW the copy
 * reached PetWash (secure upload / posted / delivered / third-party) and its
 * secure-destruction trail. Stores no scan — only the lifecycle + metadata.
 */
export const providerOfficialDocuments = pgTable("provider_official_documents", {
  id: serial("id").primaryKey(),
  applicationId: varchar("application_id", { length: 64 }).notNull(),
  providerId: varchar("provider_id", { length: 128 }),

  documentType: varchar("document_type", { length: 24 }).notNull(),         // OFFICIAL_DOC_TYPES
  submissionMethod: varchar("submission_method", { length: 16 }).notNull(),  // DOC_SUBMISSION_METHODS
  fileId: varchar("file_id", { length: 256 }),  // private-storage ref for uploads; null for posted copies

  physicalReceived: boolean("physical_received").notNull().default(false),
  receivedAt: timestamp("received_at"),
  receivedByAdminId: varchar("received_by_admin_id", { length: 128 }),

  documentStatus: varchar("document_status", { length: 16 }).notNull().default("pending"), // OFFICIAL_DOC_STATUSES

  destroyedAt: timestamp("destroyed_at"),
  destroyedByAdminId: varchar("destroyed_by_admin_id", { length: 128 }),
  deletionAt: timestamp("deletion_at"),
  deletionByAdminId: varchar("deletion_by_admin_id", { length: 128 }),

  legalHold: boolean("legal_hold").notNull().default(false),
  legalHoldReason: text("legal_hold_reason"),

  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => ({
  appIdx:    index("idx_pod_application").on(t.applicationId),
  statusIdx: index("idx_pod_status").on(t.documentStatus),
}));

export const insertProviderVerificationReviewSchema = createInsertSchema(providerVerificationReviews).omit({ id: true, createdAt: true, updatedAt: true });
export const insertProviderOfficialDocumentSchema = createInsertSchema(providerOfficialDocuments).omit({ id: true, createdAt: true, updatedAt: true });
export type ProviderVerificationReview = typeof providerVerificationReviews.$inferSelect;
export type ProviderOfficialDocument = typeof providerOfficialDocuments.$inferSelect;
