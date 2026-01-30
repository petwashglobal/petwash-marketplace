import { Router } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { db } from "../db";
import { identityVerifications, identityDocumentFiles, complianceAuditLogs, contractorProfiles, } from "@shared/schema";
import { eq } from "drizzle-orm";
import jwt from "jsonwebtoken";
const router = Router();
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
    throw new Error("CRITICAL: JWT_SECRET must be configured - refusing to start with predictable tokens");
}
// Upload directory for identity documents
const UPLOAD_ROOT = process.env.UPLOAD_ROOT || path.join(process.cwd(), "uploads");
const ID_DOCS_DIR = path.join(UPLOAD_ROOT, "identity");
// Ensure directories exist
if (!fs.existsSync(UPLOAD_ROOT))
    fs.mkdirSync(UPLOAD_ROOT, { recursive: true });
if (!fs.existsSync(ID_DOCS_DIR))
    fs.mkdirSync(ID_DOCS_DIR, { recursive: true });
// Multer storage configuration
const storage = multer.diskStorage({
    destination: (_req, _file, cb) => {
        cb(null, ID_DOCS_DIR);
    },
    filename: (_req, file, cb) => {
        const ext = path.extname(file.originalname || "");
        const base = path.basename(file.originalname || "doc", ext).replace(/[^a-zA-Z0-9_-]/g, "_");
        const unique = `${base}_${Date.now()}${ext || ".jpg"}`;
        cb(null, unique);
    },
});
const uploadIdentityDocs = multer({
    storage,
    limits: {
        files: 10,
        fileSize: 15 * 1024 * 1024, // 15 MB per file
    },
    fileFilter: (_req, file, cb) => {
        // Accept images and PDFs only
        const allowedMimes = [
            "image/jpeg",
            "image/jpg",
            "image/png",
            "image/heic",
            "image/heif",
            "application/pdf",
        ];
        if (allowedMimes.includes(file.mimetype)) {
            cb(null, true);
        }
        else {
            cb(new Error("Only JPEG, PNG, HEIC, and PDF files are allowed"));
        }
    },
});
// Approved biometric passport countries
const APPROVED_PASSPORT_COUNTRIES = [
    "IL",
    "ISRAEL",
    "US",
    "USA",
    "UNITED_STATES",
    "AU",
    "AUSTRALIA",
    "UK",
    "GB",
    "UNITED_KINGDOM",
    "FR",
    "FRANCE",
    "RU",
    "RUSSIA",
    "UA",
    "UKRAINE",
    "ES",
    "SPAIN",
    "NL",
    "NETHERLANDS",
    "DE",
    "GERMANY",
    "IT",
    "ITALY",
    "GR",
    "GREECE",
    "CA",
    "CANADA",
    "IE",
    "IRELAND",
];
// Middleware: Verify JWT token
async function authMiddleware(req, res, next) {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            return res.status(401).json({ error: "UNAUTHORIZED", message: "Missing authorization header" });
        }
        const token = authHeader.substring(7);
        const decoded = jwt.verify(token, JWT_SECRET);
        req.authUserId = decoded.sub;
        req.authRoles = decoded.roles || [];
        next();
    }
    catch (err) {
        return res.status(401).json({ error: "INVALID_TOKEN", message: "Invalid or expired token" });
    }
}
// Helper: Store uploaded file and return relative path
async function storeUploadedIdentityFile(file) {
    // In production, upload to Google Cloud Storage and return URL
    const relPath = path.relative(process.cwd(), file.path);
    return relPath;
}
// POST /api/contractors/:id/identity-docs/upload
// Mobile app uploads identity documents (passport, drivers license, ID card)
router.post("/:id/identity-docs/upload", authMiddleware, uploadIdentityDocs.array("files", 10), async (req, res) => {
    try {
        const contractorId = req.params.id;
        const { documentType, country, provider, biometricHint } = req.body;
        const files = req.files;
        if (!documentType) {
            return res.status(400).json({ error: "INVALID_REQUEST", message: "documentType required" });
        }
        if (!files || files.length === 0) {
            return res.status(400).json({ error: "INVALID_REQUEST", message: "At least one file required" });
        }
        // Verify contractor exists
        const contractor = await db.query.contractorProfiles.findFirst({
            where: eq(contractorProfiles.id, contractorId),
        });
        if (!contractor) {
            return res.status(404).json({ error: "NOT_FOUND", message: "Contractor not found" });
        }
        // If user is a contractor, enforce ownership
        if (req.authRoles.includes("contractor")) {
            // Check userId field - contractor profile has userId that maps to auth user ID
            const contractorUserId = contractor.userId || contractor.id;
            if (contractorUserId !== req.authUserId) {
                return res.status(403).json({ error: "FORBIDDEN", message: "Cannot upload for another contractor" });
            }
        }
        // Check if country is approved for biometric passports
        const isApprovedCountry = country && APPROVED_PASSPORT_COUNTRIES.includes(country.toUpperCase());
        // Create identity verification record
        const [verification] = await db
            .insert(identityVerifications)
            .values({
            contractorId,
            documentType,
            status: "pending",
            provider: provider || "mobile_app",
            details: {
                country: country || contractor.countryOfOperation || "IL",
                source: "mobile_upload",
                biometricHint: biometricHint || null,
                biometricVerified: false,
                approvedCountry: isApprovedCountry,
                uploadedFileCount: files.length,
            },
        })
            .returning();
        // Store uploaded files
        const storedFiles = [];
        for (const file of files) {
            const relPath = await storeUploadedIdentityFile(file);
            const [fileRecord] = await db
                .insert(identityDocumentFiles)
                .values({
                identityVerificationId: verification.id,
                filePath: relPath,
                mimeType: file.mimetype || "application/octet-stream",
            })
                .returning();
            storedFiles.push(fileRecord);
        }
        // Create audit log
        await db.insert(complianceAuditLogs).values({
            contractorId,
            assignmentId: null,
            decisionId: null,
            action: "identity_upload",
            actorType: req.authRoles.includes("admin") ? "admin" : "system",
            actorId: req.authUserId,
            notes: `Uploaded ${storedFiles.length} identity files, documentType=${documentType}`,
        });
        res.json({
            verification,
            files: storedFiles,
        });
    }
    catch (error) {
        console.error("[Compliance Identity] Upload error:", error);
        res.status(500).json({
            error: "INTERNAL_ERROR",
            message: "Failed to upload identity documents",
        });
    }
});
// GET /api/contractors/:id/identity-docs
// Get all identity verifications for a contractor
router.get("/:id/identity-docs", authMiddleware, async (req, res) => {
    try {
        const contractorId = req.params.id;
        // Verify contractor exists
        const contractor = await db.query.contractorProfiles.findFirst({
            where: eq(contractorProfiles.id, contractorId),
        });
        if (!contractor) {
            return res.status(404).json({ error: "NOT_FOUND", message: "Contractor not found" });
        }
        // If user is a contractor, enforce ownership
        if (req.authRoles.includes("contractor")) {
            // Check userId field - contractor profile has userId that maps to auth user ID
            const contractorUserId = contractor.userId || contractor.id;
            if (contractorUserId !== req.authUserId) {
                return res.status(403).json({ error: "FORBIDDEN", message: "Cannot view documents of another contractor" });
            }
        }
        // Get all identity verifications with files
        const verifications = await db.query.identityVerifications.findMany({
            where: eq(identityVerifications.contractorId, contractorId),
            with: {
                files: true,
            },
            orderBy: (identityVerifications, { desc }) => [desc(identityVerifications.createdAt)],
        });
        res.json({
            contractorId,
            identityVerifications: verifications,
        });
    }
    catch (error) {
        console.error("[Compliance Identity] Get docs error:", error);
        res.status(500).json({
            error: "INTERNAL_ERROR",
            message: "Failed to fetch identity documents",
        });
    }
});
// POST /api/compliance/identity/:verificationId/approve-biometric
// Admin route to mark biometric passport as verified after external provider check
router.post("/identity/:verificationId/approve-biometric", authMiddleware, async (req, res) => {
    try {
        // Only admins can approve
        if (!req.authRoles.includes("admin")) {
            return res.status(403).json({ error: "FORBIDDEN", message: "Admin access required" });
        }
        const verificationId = req.params.verificationId;
        const { biometricVerified, country } = req.body;
        // Get verification
        const verification = await db.query.identityVerifications.findFirst({
            where: eq(identityVerifications.id, verificationId),
        });
        if (!verification) {
            return res.status(404).json({ error: "NOT_FOUND", message: "Verification not found" });
        }
        // Update verification with biometric approval
        const updatedDetails = {
            ...verification.details,
            biometricVerified: biometricVerified === true,
            country: country || verification.details?.country,
            approvedBy: req.authUserId,
            approvedAt: new Date().toISOString(),
        };
        await db
            .update(identityVerifications)
            .set({
            status: biometricVerified ? "approved" : "rejected",
            details: updatedDetails,
            updatedAt: new Date(),
        })
            .where(eq(identityVerifications.id, verificationId));
        // Create audit log
        await db.insert(complianceAuditLogs).values({
            contractorId: verification.contractorId,
            assignmentId: null,
            decisionId: null,
            action: "document_verified",
            actorType: "admin",
            actorId: req.authUserId,
            fromStatus: "pending",
            toStatus: biometricVerified ? "approved" : "rejected",
            notes: `Biometric verification ${biometricVerified ? "approved" : "rejected"} by admin`,
        });
        res.json({
            success: true,
            verification: {
                id: verificationId,
                status: biometricVerified ? "approved" : "rejected",
                details: updatedDetails,
            },
        });
    }
    catch (error) {
        console.error("[Compliance Identity] Approve biometric error:", error);
        res.status(500).json({
            error: "INTERNAL_ERROR",
            message: "Failed to approve biometric verification",
        });
    }
});
export default router;
