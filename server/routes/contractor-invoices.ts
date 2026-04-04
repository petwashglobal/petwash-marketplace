import { Router } from "express";
import { db } from "../db";
import { providerCommissions } from "@shared/schema";
import { eq } from "drizzle-orm";
import { IsraeliInvoiceGenerator } from "../services/IsraeliInvoiceGenerator";
import { logger } from "../lib/logger";
import { requireAuth } from "../customAuth";

const router = Router();

// ---------------------------------------------------------------------------
// P0-FIX: Both endpoints now require authentication + ownership check.
// BEFORE: Any unauthenticated request could download any provider's invoice PDF.
// AFTER:  Caller must be authenticated. Only the provider (commission.providerId
//         matches caller's Firebase UID) or an admin may access these documents.
// ---------------------------------------------------------------------------
async function assertCommissionAccess(
  commissionId: string,
  userId: string,
  userRole: string | undefined,
  res: any
): Promise<typeof providerCommissions.$inferSelect | null> {
  const [commission] = await db
    .select()
    .from(providerCommissions)
    .where(eq(providerCommissions.commissionId, commissionId))
    .limit(1);

  if (!commission) {
    res.status(404).json({ error: "Commission not found" });
    return null;
  }

  if (userRole === "admin") return commission;

  if (commission.providerId !== userId) {
    res.status(403).json({ error: "Access denied — this commission record does not belong to you" });
    return null;
  }

  return commission;
}

/**
 * GET /api/contractor-invoices/:commissionId/generate
 * Generate Israeli tax invoice (Hebrew or English)
 */
router.get("/:commissionId/generate", requireAuth, async (req: any, res) => {
  try {
    const { commissionId } = req.params;
    const language = (req.query.lang as "he" | "en") || "he";
    const userId = req.user?.uid || req.firebaseUser?.uid;
    const userRole = req.user?.role || req.firebaseUser?.claims?.role;

    if (!userId) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const commission = await assertCommissionAccess(commissionId, userId, userRole, res);
    if (!commission) return;

    const pdfBuffer = await IsraeliInvoiceGenerator.generateInvoice(
      commissionId,
      language
    );

    const filename = IsraeliInvoiceGenerator.generateFilename(
      commissionId,
      language
    );

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Content-Length", pdfBuffer.length);

    logger.info("[Contractor Invoices] Invoice generated", {
      commissionId,
      userId,
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
router.get("/:commissionId/preview", requireAuth, async (req: any, res) => {
  try {
    const { commissionId } = req.params;
    const language = (req.query.lang as "he" | "en") || "he";
    const userId = req.user?.uid || req.firebaseUser?.uid;
    const userRole = req.user?.role || req.firebaseUser?.claims?.role;

    if (!userId) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const commission = await assertCommissionAccess(commissionId, userId, userRole, res);
    if (!commission) return;

    const pdfBuffer = await IsraeliInvoiceGenerator.generateInvoice(
      commissionId,
      language
    );

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", "inline");
    res.setHeader("Content-Length", pdfBuffer.length);

    logger.info("[Contractor Invoices] Invoice previewed", {
      commissionId,
      userId,
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
