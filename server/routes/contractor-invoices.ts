import { Router } from "express";
import { db } from "../db";
import { providerCommissions } from "@shared/schema";
import { eq } from "drizzle-orm";
import { IsraeliInvoiceGenerator } from "../services/IsraeliInvoiceGenerator";
import { logger } from "../lib/logger";
import { requireAuth } from "../customAuth";
import { isSuperAdmin } from "../middleware/rbac";

const router = Router();

// All contractor invoice routes require authentication.
// Users may only access invoices for commissions that belong to them.
router.use(requireAuth);

/**
 * GET /api/contractor-invoices/:commissionId/generate
 * Generate Israeli tax invoice (Hebrew or English)
 */
router.get("/:commissionId/generate", async (req, res) => {
  try {
    const { commissionId } = req.params;
    const language = (req.query.lang as "he" | "en") || "he";
    const callerUid = req.user!.uid;
    const callerEmail = ((req as any).firebaseUser?.email || req.user?.email || '').toLowerCase();
    const admin = isSuperAdmin(callerEmail);

    // Verify commission exists
    const [commission] = await db
      .select()
      .from(providerCommissions)
      .where(eq(providerCommissions.commissionId, commissionId))
      .limit(1);

    if (!commission) {
      return res.status(404).json({ error: "Commission not found" });
    }

    // Ownership check: caller must own this commission or be a super admin
    if (!admin && commission.providerId !== callerUid) {
      logger.warn("[Contractor Invoices] Ownership check failed", { callerUid, commissionId });
      return res.status(403).json({ error: "Forbidden: not your commission" });
    }

    // Generate PDF invoice
    const pdfBuffer = await IsraeliInvoiceGenerator.generateInvoice(
      commissionId,
      language
    );

    // Set response headers
    const filename = IsraeliInvoiceGenerator.generateFilename(
      commissionId,
      language
    );

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Content-Length", pdfBuffer.length);

    logger.info("[Contractor Invoices] Invoice generated", {
      commissionId,
      language,
      filesize: pdfBuffer.length,
    });

    res.send(pdfBuffer);
  } catch (error) {
    logger.error("[Contractor Invoices] Generation failed", error);
    res.status(500).json({
      error: "Failed to generate invoice",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

/**
 * GET /api/contractor-invoices/:commissionId/preview
 * Preview invoice in browser (inline)
 */
router.get("/:commissionId/preview", async (req, res) => {
  try {
    const { commissionId } = req.params;
    const language = (req.query.lang as "he" | "en") || "he";
    const callerUid = req.user!.uid;
    const callerEmail = ((req as any).firebaseUser?.email || req.user?.email || '').toLowerCase();
    const admin = isSuperAdmin(callerEmail);

    // Verify commission exists
    const [commission] = await db
      .select()
      .from(providerCommissions)
      .where(eq(providerCommissions.commissionId, commissionId))
      .limit(1);

    if (!commission) {
      return res.status(404).json({ error: "Commission not found" });
    }

    // Ownership check: caller must own this commission or be a super admin
    if (!admin && commission.providerId !== callerUid) {
      logger.warn("[Contractor Invoices] Ownership check failed on preview", { callerUid, commissionId });
      return res.status(403).json({ error: "Forbidden: not your commission" });
    }

    // Generate PDF invoice
    const pdfBuffer = await IsraeliInvoiceGenerator.generateInvoice(
      commissionId,
      language
    );

    // Set response headers for inline display
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", "inline");
    res.setHeader("Content-Length", pdfBuffer.length);

    logger.info("[Contractor Invoices] Invoice previewed", {
      commissionId,
      language,
    });

    res.send(pdfBuffer);
  } catch (error) {
    logger.error("[Contractor Invoices] Preview failed", error);
    res.status(500).json({
      error: "Failed to preview invoice",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

export default router;
