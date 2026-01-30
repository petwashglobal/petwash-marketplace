import { Router } from "express";
import { Storage } from "@google-cloud/storage";
import multer from "multer";
import { nanoid } from "nanoid";
import { db } from "../db";
import { contractorDocuments, contractorProfiles, } from "@shared/schema";
import { eq, and, desc } from "drizzle-orm";
import { logger } from "../lib/logger";
const router = Router();
// Initialize Google Cloud Storage
const storage = new Storage();
const bucketName = process.env.CONTRACTOR_DOCS_BUCKET || "petwash-contractor-documents";
// Configure multer for memory storage
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 10 * 1024 * 1024, // 10MB limit
    },
    fileFilter: (req, file, cb) => {
        // Allow images and PDFs only
        const allowedMimes = [
            "image/jpeg",
            "image/png",
            "image/webp",
            "application/pdf",
        ];
        if (allowedMimes.includes(file.mimetype)) {
            cb(null, true);
        }
        else {
            cb(new Error("Invalid file type. Only JPEG, PNG, WEBP, and PDF allowed."));
        }
    },
});
/**
 * POST /api/contractor-documents/upload
 * Upload a contractor document to Google Cloud Storage
 */
router.post("/upload", upload.single("file"), async (req, res) => {
    try {
        const { contractorId, type, country } = req.body;
        const file = req.file;
        if (!file) {
            return res.status(400).json({ error: "No file provided" });
        }
        if (!contractorId || !type) {
            return res.status(400).json({
                error: "Missing required fields: contractorId, type",
            });
        }
        // Verify contractor exists
        const contractor = await db
            .select()
            .from(contractorProfiles)
            .where(eq(contractorProfiles.id, contractorId))
            .limit(1);
        if (contractor.length === 0) {
            return res.status(404).json({ error: "Contractor not found" });
        }
        // Generate unique filename
        const timestamp = Date.now();
        const randomId = nanoid(8);
        const fileExtension = file.originalname.split(".").pop();
        const filename = `${contractorId}/${type}/${timestamp}-${randomId}.${fileExtension}`;
        // Upload to Google Cloud Storage
        const bucket = storage.bucket(bucketName);
        const blob = bucket.file(filename);
        await blob.save(file.buffer, {
            metadata: {
                contentType: file.mimetype,
                metadata: {
                    contractorId,
                    documentType: type,
                    uploadedBy: req.user?.uid || "unknown",
                    uploadedAt: new Date().toISOString(),
                },
            },
        });
        // Make the file publicly readable (or use signed URLs for private access)
        // For now, we'll use signed URLs for security
        const [url] = await blob.getSignedUrl({
            action: "read",
            expires: Date.now() + 365 * 24 * 60 * 60 * 1000, // 1 year
        });
        // Save document record to database
        const [document] = await db
            .insert(contractorDocuments)
            .values({
            contractorId,
            type,
            country: country || "IL",
            url,
            uploadedAt: new Date(),
        })
            .returning();
        logger.info("[Contractor Documents] Document uploaded", {
            documentId: document.id,
            contractorId,
            type,
            filename,
        });
        res.status(201).json({
            success: true,
            document,
            message: "Document uploaded successfully",
        });
    }
    catch (error) {
        logger.error("[Contractor Documents] Upload failed", { error });
        res.status(500).json({
            error: "Failed to upload document",
            details: error instanceof Error ? error.message : "Unknown error",
        });
    }
});
/**
 * GET /api/contractor-documents/:contractorId
 * Get all documents for a contractor
 */
router.get("/:contractorId", async (req, res) => {
    try {
        const { contractorId } = req.params;
        const documents = await db
            .select()
            .from(contractorDocuments)
            .where(eq(contractorDocuments.contractorId, contractorId))
            .orderBy(desc(contractorDocuments.uploadedAt));
        res.json({
            success: true,
            documents,
            count: documents.length,
        });
    }
    catch (error) {
        logger.error("[Contractor Documents] Failed to fetch documents", { error });
        res.status(500).json({
            error: "Failed to fetch documents",
            details: error instanceof Error ? error.message : "Unknown error",
        });
    }
});
/**
 * POST /api/contractor-documents/:documentId/verify
 * Admin: Verify a contractor document
 */
router.post("/:documentId/verify", async (req, res) => {
    try {
        const { documentId } = req.params;
        const { expiresAt, notes } = req.body;
        const verifiedByUserId = req.user?.uid;
        if (!verifiedByUserId) {
            return res.status(401).json({ error: "Authentication required" });
        }
        // Update document verification status
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
        if (!document) {
            return res.status(404).json({ error: "Document not found" });
        }
        logger.info("[Contractor Documents] Document verified", {
            documentId,
            contractorId: document.contractorId,
            verifiedByUserId,
        });
        res.json({
            success: true,
            document,
            message: "Document verified successfully",
        });
    }
    catch (error) {
        logger.error("[Contractor Documents] Verification failed", { error });
        res.status(500).json({
            error: "Failed to verify document",
            details: error instanceof Error ? error.message : "Unknown error",
        });
    }
});
/**
 * DELETE /api/contractor-documents/:documentId
 * Delete a contractor document
 */
router.delete("/:documentId", async (req, res) => {
    try {
        const { documentId } = req.params;
        // Get document to retrieve storage path
        const [document] = await db
            .select()
            .from(contractorDocuments)
            .where(eq(contractorDocuments.id, documentId))
            .limit(1);
        if (!document) {
            return res.status(404).json({ error: "Document not found" });
        }
        // Delete from Google Cloud Storage
        // Extract filename from signed URL
        const urlObj = new URL(document.url);
        const pathParts = urlObj.pathname.split("/");
        const filename = pathParts.slice(2).join("/"); // Remove bucket name
        try {
            const bucket = storage.bucket(bucketName);
            await bucket.file(filename).delete();
        }
        catch (storageError) {
            logger.warn("[Contractor Documents] Failed to delete from storage", {
                storageError,
                filename,
            });
            // Continue anyway - database cleanup is more important
        }
        // Delete from database
        await db
            .delete(contractorDocuments)
            .where(eq(contractorDocuments.id, documentId));
        logger.info("[Contractor Documents] Document deleted", {
            documentId,
            contractorId: document.contractorId,
        });
        res.json({
            success: true,
            message: "Document deleted successfully",
        });
    }
    catch (error) {
        logger.error("[Contractor Documents] Deletion failed", { error });
        res.status(500).json({
            error: "Failed to delete document",
            details: error instanceof Error ? error.message : "Unknown error",
        });
    }
});
/**
 * GET /api/contractor-documents/type/:contractorId/:type
 * Get specific document type for a contractor
 */
router.get("/type/:contractorId/:type", async (req, res) => {
    try {
        const { contractorId, type } = req.params;
        const documents = await db
            .select()
            .from(contractorDocuments)
            .where(and(eq(contractorDocuments.contractorId, contractorId), eq(contractorDocuments.type, type)))
            .orderBy(desc(contractorDocuments.uploadedAt));
        res.json({
            success: true,
            documents,
            count: documents.length,
        });
    }
    catch (error) {
        logger.error("[Contractor Documents] Failed to fetch document by type", {
            error,
        });
        res.status(500).json({
            error: "Failed to fetch documents",
            details: error instanceof Error ? error.message : "Unknown error",
        });
    }
});
export default router;
