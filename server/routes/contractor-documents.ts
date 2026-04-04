import { Router, Request, Response, NextFunction } from "express";
import { Storage } from "@google-cloud/storage";
import multer from "multer";
import { nanoid } from "nanoid";
import { db } from "../db";
import {
  contractorDocuments,
  contractorProfiles,
  type InsertContractorDocument,
} from "@shared/schema";
import { eq, and, desc } from "drizzle-orm";
import { logger } from "../lib/logger";
import { requireAuth } from "../middleware/gates";

const router = Router();

// SECURITY FIX (items 9 & 27): requireAuth applied router-wide.
// Previously mounted with optionalFirebaseToken — zero enforcement.
// contractorProfiles.id IS the Firebase UID, so ownership check is a direct UID comparison.
router.use(requireAuth);

const storage = new Storage();
const bucketName = process.env.CONTRACTOR_DOCS_BUCKET || "petwash-contractor-documents";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedMimes = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Invalid file type. Only JPEG, PNG, WEBP, and PDF allowed."));
    }
  },
});

function getCallerId(req: any): string | null {
  return req.firebaseUser?.uid || req.user?.uid || (req as any).userId || null;
}

function isAdminCaller(req: any): boolean {
  return (
    req.firebaseUser?.claims?.admin === true ||
    req.firebaseUser?.customClaims?.admin === true ||
    req.user?.customClaims?.admin === true
  );
}

// SECURITY: Caller must own the contractor profile (callerId === contractorId) OR be admin.
// contractorProfiles.id is the Firebase UID, so direct comparison is correct — no DB join needed.
async function assertContractorAccess(
  req: any,
  res: Response,
  contractorId: string
): Promise<boolean> {
  const callerId = getCallerId(req);
  if (!callerId) {
    res.status(401).json({ error: "Authentication required" });
    return false;
  }
  if (isAdminCaller(req)) return true;
  if (callerId === contractorId) return true;
  logger.warn("[Contractor Documents] Ownership check failed", { callerId, contractorId });
  res.status(403).json({ error: "Access denied — not your documents" });
  return false;
}

/**
 * POST /api/contractor-documents/upload
 * Upload a contractor document. Caller must be the contractor (or admin).
 * BEFORE: No auth. Any HTTP client could upload documents to any contractor.
 * AFTER:  requireAuth + ownership check (callerId === contractorId || admin).
 */
router.post("/upload", upload.single("file"), async (req: any, res) => {
  try {
    const { contractorId, type, country } = req.body;
    const file = req.file;

    if (!file) return res.status(400).json({ error: "No file provided" });
    if (!contractorId || !type) {
      return res.status(400).json({ error: "Missing required fields: contractorId, type" });
    }

    const allowed = await assertContractorAccess(req, res, contractorId);
    if (!allowed) return;

    const contractor = await db
      .select()
      .from(contractorProfiles)
      .where(eq(contractorProfiles.id, contractorId))
      .limit(1);

    if (contractor.length === 0) return res.status(404).json({ error: "Contractor not found" });

    const timestamp = Date.now();
    const randomId = nanoid(8);
    const fileExtension = file.originalname.split(".").pop();
    const filename = `${contractorId}/${type}/${timestamp}-${randomId}.${fileExtension}`;

    const bucket = storage.bucket(bucketName);
    const blob = bucket.file(filename);

    await blob.save(file.buffer, {
      metadata: {
        contentType: file.mimetype,
        metadata: {
          contractorId,
          documentType: type,
          uploadedBy: getCallerId(req) || "unknown",
          uploadedAt: new Date().toISOString(),
        },
      },
    });

    const [url] = await blob.getSignedUrl({
      action: "read",
      expires: Date.now() + 365 * 24 * 60 * 60 * 1000,
    });

    const [document] = await db
      .insert(contractorDocuments)
      .values({ contractorId, type, country: country || "IL", url, uploadedAt: new Date() })
      .returning();

    logger.info("[Contractor Documents] Document uploaded", {
      documentId: document.id,
      contractorId,
      type,
      filename,
      uploadedBy: getCallerId(req),
    });

    res.status(201).json({ success: true, document, message: "Document uploaded successfully" });
  } catch (error) {
    logger.error("[Contractor Documents] Upload failed", error);
    res.status(500).json({ error: "Failed to upload document", details: error instanceof Error ? error.message : "Unknown error" });
  }
});

/**
 * GET /api/contractor-documents/:contractorId
 * List documents. Caller must be the contractor (or admin).
 * BEFORE: No auth. Any caller with a contractorId (sequential int) got full list including national IDs.
 * AFTER:  requireAuth + ownership check.
 */
router.get("/:contractorId", async (req: any, res) => {
  try {
    const { contractorId } = req.params;

    const allowed = await assertContractorAccess(req, res, contractorId);
    if (!allowed) return;

    const documents = await db
      .select()
      .from(contractorDocuments)
      .where(eq(contractorDocuments.contractorId, contractorId))
      .orderBy(desc(contractorDocuments.uploadedAt));

    res.json({ success: true, documents, count: documents.length });
  } catch (error) {
    logger.error("[Contractor Documents] Failed to fetch documents", error);
    res.status(500).json({ error: "Failed to fetch documents", details: error instanceof Error ? error.message : "Unknown error" });
  }
});

/**
 * POST /api/contractor-documents/:documentId/verify
 * Admin-only verification. Non-admin callers get 403 unconditionally.
 * BEFORE: Only checked if firebaseUser.uid was present (any authenticated user could verify docs).
 * AFTER:  Admin claim required.
 */
router.post("/:documentId/verify", async (req: any, res) => {
  try {
    if (!isAdminCaller(req)) {
      return res.status(403).json({ error: "Admin access required to verify documents" });
    }

    const { documentId } = req.params;
    const { expiresAt, notes } = req.body;
    const verifiedByUserId = getCallerId(req)!;

    const [document] = await db
      .update(contractorDocuments)
      .set({
        verifiedAt: new Date(),
        verifiedByUserId,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
        notesInternal: notes || null,
      })
      .where(eq(contractorDocuments.id, documentId))
      .returning();

    if (!document) return res.status(404).json({ error: "Document not found" });

    logger.info("[Contractor Documents] Document verified", {
      documentId,
      contractorId: document.contractorId,
      verifiedByUserId,
    });

    res.json({ success: true, document, message: "Document verified successfully" });
  } catch (error) {
    logger.error("[Contractor Documents] Verification failed", error);
    res.status(500).json({ error: "Failed to verify document", details: error instanceof Error ? error.message : "Unknown error" });
  }
});

/**
 * DELETE /api/contractor-documents/:documentId
 * Delete a document. Caller must own the parent contractor profile (or be admin).
 * BEFORE: No auth. Any caller could delete any document by ID.
 * AFTER:  requireAuth + ownership check derived from the document's contractorId.
 */
router.delete("/:documentId", async (req: any, res) => {
  try {
    const { documentId } = req.params;

    const [document] = await db
      .select()
      .from(contractorDocuments)
      .where(eq(contractorDocuments.id, documentId))
      .limit(1);

    if (!document) return res.status(404).json({ error: "Document not found" });

    const allowed = await assertContractorAccess(req, res, document.contractorId);
    if (!allowed) return;

    try {
      const urlObj = new URL(document.url);
      const pathParts = urlObj.pathname.split("/");
      const filename = pathParts.slice(2).join("/");
      const bucket = storage.bucket(bucketName);
      await bucket.file(filename).delete();
    } catch (storageError) {
      logger.warn("[Contractor Documents] Failed to delete from storage", { storageError, documentId });
    }

    await db.delete(contractorDocuments).where(eq(contractorDocuments.id, documentId));

    logger.info("[Contractor Documents] Document deleted", {
      documentId,
      contractorId: document.contractorId,
      deletedBy: getCallerId(req),
    });

    res.json({ success: true, message: "Document deleted successfully" });
  } catch (error) {
    logger.error("[Contractor Documents] Deletion failed", error);
    res.status(500).json({ error: "Failed to delete document", details: error instanceof Error ? error.message : "Unknown error" });
  }
});

/**
 * GET /api/contractor-documents/type/:contractorId/:type
 * Get documents by type. Caller must be the contractor (or admin).
 * BEFORE: No auth.
 * AFTER:  requireAuth + ownership check.
 */
router.get("/type/:contractorId/:type", async (req: any, res) => {
  try {
    const { contractorId, type } = req.params;

    const allowed = await assertContractorAccess(req, res, contractorId);
    if (!allowed) return;

    const documents = await db
      .select()
      .from(contractorDocuments)
      .where(
        and(
          eq(contractorDocuments.contractorId, contractorId),
          eq(contractorDocuments.type, type)
        )
      )
      .orderBy(desc(contractorDocuments.uploadedAt));

    res.json({ success: true, documents, count: documents.length });
  } catch (error) {
    logger.error("[Contractor Documents] Failed to fetch document by type", error);
    res.status(500).json({ error: "Failed to fetch documents", details: error instanceof Error ? error.message : "Unknown error" });
  }
});

export default router;
