/**
 * COMPLIANCE MANAGEMENT ROUTES
 * ===========================
 * API endpoints for Compliance Control Tower
 * 
 * Features:
 * - Authority documents upload/management
 * - Provider license verification
 * - Compliance monitoring dashboard
 * - Trust badges display
 * - Booking policies
 * - Dispute resolution
 * 
 * Created: November 10, 2025
 */

import { Router, Request, Response } from "express";
import { db } from "../db";
import { eq, and, or, desc, sql } from "drizzle-orm";
import {
  authorityDocuments,
  providerLicenses,
  bookingPolicies,
  disputeResolutions,
  reviewModeration,
  reviewModerationRules,
  boardResolutions,
  corporateSeals,
  complianceTasks,
  complianceAuditTrail,
  insertAuthorityDocumentSchema,
  insertProviderLicenseSchema,
  insertBookingPolicySchema,
  insertDisputeResolutionSchema,
  insertReviewModerationSchema,
  insertBoardResolutionSchema,
  insertCorporateSealSchema,
  insertComplianceTaskSchema,
} from "@shared/schema-compliance";
import { complianceControlTower } from "../services/ComplianceControlTower";
import { nanoid } from "nanoid";
import { createHash } from "crypto";

const router = Router();

// =================== AUTHORITY DOCUMENTS ===================

/**
 * GET /api/compliance/authority-documents
 * Get all authority documents
 */
router.get("/authority-documents", async (req: Request, res: Response) => {
  try {
    const { status, documentType, displayPublicly } = req.query;

    let query = db.select().from(authorityDocuments);

    if (status) {
      query = query.where(eq(authorityDocuments.status, status as string)) as any;
    }
    if (documentType) {
      query = query.where(eq(authorityDocuments.documentType, documentType as string)) as any;
    }
    if (displayPublicly === "true") {
      query = query.where(eq(authorityDocuments.displayPublicly, true)) as any;
    }

    const docs = await query.orderBy(desc(authorityDocuments.displayPriority));

    res.json(docs);
  } catch (error: any) {
    console.error("Error fetching authority documents:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/compliance/authority-documents
 * Upload new authority document
 */
router.post("/authority-documents", async (req: Request, res: Response) => {
  try {
    const validated = insertAuthorityDocumentSchema.parse(req.body);

    const [doc] = await db
      .insert(authorityDocuments)
      .values({
        ...validated,
        documentNumber: validated.documentNumber || `DOC-${new Date().getFullYear()}-${nanoid(8)}`,
      })
      .returning();

    // Create audit trail
    await db.insert(complianceAuditTrail).values({
      eventId: `AUDIT-${new Date().getFullYear()}-${nanoid(12)}`,
      eventType: "document_uploaded",
      entityType: "authority_document",
      entityId: doc.id,
      action: "created",
      actionBy: validated.uploadedBy || 0,
      newState: doc,
      cryptographicHash: createHash("sha256").update(JSON.stringify(doc)).digest("hex"),
    });

    res.status(201).json(doc);
  } catch (error: any) {
    console.error("Error creating authority document:", error);
    res.status(400).json({ error: error.message });
  }
});

/**
 * PUT /api/compliance/authority-documents/:id
 * Update authority document
 */
router.put("/authority-documents/:id", async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const updates = req.body;

    const [updated] = await db
      .update(authorityDocuments)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(authorityDocuments.id, id))
      .returning();

    if (!updated) {
      return res.status(404).json({ error: "Document not found" });
    }

    res.json(updated);
  } catch (error: any) {
    console.error("Error updating authority document:", error);
    res.status(400).json({ error: error.message });
  }
});

/**
 * DELETE /api/compliance/authority-documents/:id
 * Delete authority document
 */
router.delete("/authority-documents/:id", async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);

    await db.delete(authorityDocuments).where(eq(authorityDocuments.id, id));

    res.json({ success: true });
  } catch (error: any) {
    console.error("Error deleting authority document:", error);
    res.status(500).json({ error: error.message });
  }
});

// =================== PROVIDER LICENSES ===================

/**
 * GET /api/compliance/provider-licenses
 * Get provider licenses (with optional filters)
 */
router.get("/provider-licenses", async (req: Request, res: Response) => {
  try {
    const { providerId, providerType, status, isMandatory } = req.query;

    let query = db.select().from(providerLicenses);

    const conditions = [];
    if (providerId) {
      conditions.push(eq(providerLicenses.providerId, parseInt(providerId as string)));
    }
    if (providerType) {
      conditions.push(eq(providerLicenses.providerType, providerType as string));
    }
    if (status) {
      conditions.push(eq(providerLicenses.status, status as string));
    }
    if (isMandatory === "true") {
      conditions.push(eq(providerLicenses.isMandatory, true));
    }

    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as any;
    }

    const licenses = await query.orderBy(desc(providerLicenses.createdAt));

    res.json(licenses);
  } catch (error: any) {
    console.error("Error fetching provider licenses:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/compliance/provider-licenses
 * Upload provider license
 */
router.post("/provider-licenses", async (req: Request, res: Response) => {
  try {
    const validated = insertProviderLicenseSchema.parse(req.body);

    const [license] = await db
      .insert(providerLicenses)
      .values(validated)
      .returning();

    // Create audit trail
    await db.insert(complianceAuditTrail).values({
      eventId: `AUDIT-${new Date().getFullYear()}-${nanoid(12)}`,
      eventType: "license_uploaded",
      entityType: "provider_license",
      entityId: license.id,
      action: "created",
      actionBy: 0,
      newState: license,
      cryptographicHash: createHash("sha256").update(JSON.stringify(license)).digest("hex"),
    });

    res.status(201).json(license);
  } catch (error: any) {
    console.error("Error creating provider license:", error);
    res.status(400).json({ error: error.message });
  }
});

/**
 * PUT /api/compliance/provider-licenses/:id/verify
 * Verify provider license (admin action)
 */
router.put("/provider-licenses/:id/verify", async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const { verifiedBy } = req.body;

    const [updated] = await db
      .update(providerLicenses)
      .set({
        isVerified: true,
        verifiedBy,
        verifiedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(providerLicenses.id, id))
      .returning();

    if (!updated) {
      return res.status(404).json({ error: "License not found" });
    }

    res.json(updated);
  } catch (error: any) {
    console.error("Error verifying provider license:", error);
    res.status(400).json({ error: error.message });
  }
});

/**
 * GET /api/compliance/provider-compliance/:providerId/:providerType
 * Check provider compliance status
 */
router.get("/provider-compliance/:providerId/:providerType", async (req: Request, res: Response) => {
  try {
    const providerId = parseInt(req.params.providerId);
    const providerType = req.params.providerType;

    const status = await complianceControlTower.checkProviderCompliance(providerId, providerType);

    res.json(status);
  } catch (error: any) {
    console.error("Error checking provider compliance:", error);
    res.status(500).json({ error: error.message });
  }
});

// =================== COMPLIANCE MONITORING ===================

/**
 * GET /api/compliance/status
 * Get overall compliance status (dashboard)
 */
router.get("/status", async (req: Request, res: Response) => {
  try {
    const status = await complianceControlTower.runComplianceMonitoring();

    res.json(status);
  } catch (error: any) {
    console.error("Error running compliance monitoring:", error);
    res.status(500).json({ error: error.message });
  }
});

// =================== COMPLIANCE TASKS ===================

/**
 * GET /api/compliance/tasks
 * Get compliance tasks
 */
router.get("/tasks", async (req: Request, res: Response) => {
  try {
    const { status, priority, assignedTo } = req.query;

    let query = db.select().from(complianceTasks);

    const conditions = [];
    if (status) {
      conditions.push(eq(complianceTasks.status, status as string));
    }
    if (priority) {
      conditions.push(eq(complianceTasks.priority, priority as string));
    }
    if (assignedTo) {
      conditions.push(eq(complianceTasks.assignedTo, parseInt(assignedTo as string)));
    }

    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as any;
    }

    const tasks = await query.orderBy(desc(complianceTasks.dueDate));

    res.json(tasks);
  } catch (error: any) {
    console.error("Error fetching compliance tasks:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/compliance/tasks
 * Create compliance task
 */
router.post("/tasks", async (req: Request, res: Response) => {
  try {
    const task = await complianceControlTower.createComplianceTask(req.body);

    res.status(201).json(task);
  } catch (error: any) {
    console.error("Error creating compliance task:", error);
    res.status(400).json({ error: error.message });
  }
});

/**
 * PUT /api/compliance/tasks/:id
 * Update compliance task
 */
router.put("/tasks/:id", async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const updates = req.body;

    const [updated] = await db
      .update(complianceTasks)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(complianceTasks.id, id))
      .returning();

    if (!updated) {
      return res.status(404).json({ error: "Task not found" });
    }

    res.json(updated);
  } catch (error: any) {
    console.error("Error updating compliance task:", error);
    res.status(400).json({ error: error.message });
  }
});

// =================== BOOKING POLICIES ===================

/**
 * GET /api/compliance/booking-policies
 * Get booking policies
 */
router.get("/booking-policies", async (req: Request, res: Response) => {
  try {
    const { serviceType, isActive } = req.query;

    let query = db.select().from(bookingPolicies);

    const conditions = [];
    if (serviceType) {
      conditions.push(eq(bookingPolicies.serviceType, serviceType as string));
    }
    if (isActive === "true") {
      conditions.push(eq(bookingPolicies.isActive, true));
    }

    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as any;
    }

    const policies = await query;

    res.json(policies);
  } catch (error: any) {
    console.error("Error fetching booking policies:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/compliance/booking-policies
 * Create booking policy
 */
router.post("/booking-policies", async (req: Request, res: Response) => {
  try {
    const validated = insertBookingPolicySchema.parse(req.body);

    const [policy] = await db
      .insert(bookingPolicies)
      .values({
        ...validated,
        policyId: validated.policyId || `POLICY-${new Date().getFullYear()}-${nanoid(8)}`,
      })
      .returning();

    res.status(201).json(policy);
  } catch (error: any) {
    console.error("Error creating booking policy:", error);
    res.status(400).json({ error: error.message });
  }
});

// =================== DISPUTE RESOLUTION ===================

/**
 * GET /api/compliance/disputes
 * Get disputes
 */
router.get("/disputes", async (req: Request, res: Response) => {
  try {
    const { status, isEscalated } = req.query;

    let query = db.select().from(disputeResolutions);

    const conditions = [];
    if (status) {
      conditions.push(eq(disputeResolutions.status, status as string));
    }
    if (isEscalated === "true") {
      conditions.push(eq(disputeResolutions.isEscalated, true));
    }

    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as any;
    }

    const disputes = await query.orderBy(desc(disputeResolutions.createdAt));

    res.json(disputes);
  } catch (error: any) {
    console.error("Error fetching disputes:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/compliance/disputes
 * Create dispute
 */
router.post("/disputes", async (req: Request, res: Response) => {
  try {
    const validated = insertDisputeResolutionSchema.parse(req.body);

    // Calculate target resolution date (48 hours from now)
    const targetResolutionDate = new Date();
    targetResolutionDate.setHours(targetResolutionDate.getHours() + 48);

    const [dispute] = await db
      .insert(disputeResolutions)
      .values({
        ...validated,
        disputeId: `DISP-${new Date().getFullYear()}-${nanoid(8)}`,
        targetResolutionDate,
      })
      .returning();

    res.status(201).json(dispute);
  } catch (error: any) {
    console.error("Error creating dispute:", error);
    res.status(400).json({ error: error.message });
  }
});

/**
 * PUT /api/compliance/disputes/:id/resolve
 * Resolve dispute
 */
router.put("/disputes/:id/resolve", async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const { resolution, resolutionHe, status, resolvedBy, refundAmount } = req.body;

    const [updated] = await db
      .update(disputeResolutions)
      .set({
        resolution,
        resolutionHe,
        status,
        resolvedBy,
        refundAmount,
        resolvedAt: new Date(),
        actualResolutionDate: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(disputeResolutions.id, id))
      .returning();

    if (!updated) {
      return res.status(404).json({ error: "Dispute not found" });
    }

    res.json(updated);
  } catch (error: any) {
    console.error("Error resolving dispute:", error);
    res.status(400).json({ error: error.message });
  }
});

// =================== CORPORATE GOVERNANCE ===================

/**
 * GET /api/compliance/corporate-seals
 * Get corporate seals (public trust badges)
 */
router.get("/corporate-seals", async (req: Request, res: Response) => {
  try {
    const { isActive } = req.query;

    let query = db.select().from(corporateSeals);

    if (isActive === "true") {
      query = query.where(eq(corporateSeals.isActive, true)) as any;
    }

    const seals = await query.orderBy(desc(corporateSeals.displayPriority));

    res.json(seals);
  } catch (error: any) {
    console.error("Error fetching corporate seals:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/compliance/corporate-seals
 * Create corporate seal
 */
router.post("/corporate-seals", async (req: Request, res: Response) => {
  try {
    const validated = insertCorporateSealSchema.parse(req.body);

    const [seal] = await db
      .insert(corporateSeals)
      .values({
        ...validated,
        sealId: validated.sealId || `SEAL-${new Date().getFullYear()}-${nanoid(8)}`,
      })
      .returning();

    res.status(201).json(seal);
  } catch (error: any) {
    console.error("Error creating corporate seal:", error);
    res.status(400).json({ error: error.message });
  }
});

/**
 * GET /api/compliance/board-resolutions
 * Get board resolutions
 */
router.get("/board-resolutions", async (req: Request, res: Response) => {
  try {
    const { approvalStatus, isPublic } = req.query;

    let query = db.select().from(boardResolutions);

    const conditions = [];
    if (approvalStatus) {
      conditions.push(eq(boardResolutions.approvalStatus, approvalStatus as string));
    }
    if (isPublic === "true") {
      conditions.push(eq(boardResolutions.isPublic, true));
    }

    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as any;
    }

    const resolutions = await query.orderBy(desc(boardResolutions.effectiveDate));

    res.json(resolutions);
  } catch (error: any) {
    console.error("Error fetching board resolutions:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/compliance/board-resolutions
 * Create board resolution
 */
router.post("/board-resolutions", async (req: Request, res: Response) => {
  try {
    const validated = insertBoardResolutionSchema.parse(req.body);

    const [resolution] = await db
      .insert(boardResolutions)
      .values({
        ...validated,
        resolutionId: validated.resolutionId || `RES-${new Date().getFullYear()}-${nanoid(8)}`,
      })
      .returning();

    res.status(201).json(resolution);
  } catch (error: any) {
    console.error("Error creating board resolution:", error);
    res.status(400).json({ error: error.message });
  }
});

// =================== REVIEW MODERATION ===================

/**
 * GET /api/compliance/review-moderation-rules
 * Get review moderation rules
 */
router.get("/review-moderation-rules", async (req: Request, res: Response) => {
  try {
    const { ruleType, isActive } = req.query;

    let query = db.select().from(reviewModerationRules);

    const conditions = [];
    if (ruleType) {
      conditions.push(eq(reviewModerationRules.ruleType, ruleType as string));
    }
    if (isActive === "true") {
      conditions.push(eq(reviewModerationRules.isActive, true));
    }

    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as any;
    }

    const rules = await query;

    res.json(rules);
  } catch (error: any) {
    console.error("Error fetching review moderation rules:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/compliance/review-moderation
 * Get moderated reviews
 */
router.get("/review-moderation", async (req: Request, res: Response) => {
  try {
    const { status, legalReviewRequired } = req.query;

    let query = db.select().from(reviewModeration);

    const conditions = [];
    if (status) {
      conditions.push(eq(reviewModeration.status, status as string));
    }
    if (legalReviewRequired === "true") {
      conditions.push(eq(reviewModeration.legalReviewRequired, true));
    }

    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as any;
    }

    const moderated = await query.orderBy(desc(reviewModeration.createdAt));

    res.json(moderated);
  } catch (error: any) {
    console.error("Error fetching review moderation:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/compliance/review-moderation
 * Submit review for moderation
 */
router.post("/review-moderation", async (req: Request, res: Response) => {
  try {
    const validated = insertReviewModerationSchema.parse(req.body);

    // TODO: Integrate with Gemini AI for automatic pre-screening
    const [moderated] = await db
      .insert(reviewModeration)
      .values({
        ...validated,
        auditHash: createHash("sha256").update(JSON.stringify(validated)).digest("hex"),
      })
      .returning();

    res.status(201).json(moderated);
  } catch (error: any) {
    console.error("Error creating review moderation:", error);
    res.status(400).json({ error: error.message });
  }
});

/**
 * PUT /api/compliance/review-moderation/:id/approve
 * Approve moderated review
 */
router.put("/review-moderation/:id/approve", async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const { reviewedBy, moderatorNotes } = req.body;

    const [updated] = await db
      .update(reviewModeration)
      .set({
        status: "approved",
        reviewedBy,
        reviewedAt: new Date(),
        moderatorNotes,
        updatedAt: new Date(),
      })
      .where(eq(reviewModeration.id, id))
      .returning();

    if (!updated) {
      return res.status(404).json({ error: "Review moderation not found" });
    }

    res.json(updated);
  } catch (error: any) {
    console.error("Error approving review:", error);
    res.status(400).json({ error: error.message });
  }
});

export default router;
