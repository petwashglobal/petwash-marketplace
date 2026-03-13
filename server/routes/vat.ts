import express from "express";
import VATCalculatorService from "../services/VATCalculatorService";
import { requireAuth } from "../customAuth";
import { requireAdmin } from "../adminAuth";
import { logger } from "../lib/logger";

const router = express.Router();

/**
 * POST /api/vat/calculate
 *
 * Two sale modes (Israeli VAT law):
 *
 * mode = "direct"      — K9000 wash, eGift purchase
 *   { mode: "direct", grossCollectedILS: 100 }
 *   → VAT on FULL amount: ₪100 × 18/118 = ₪15.25
 *
 * mode = "marketplace" — provider services (Wolt/Uber model, default)
 *   { mode: "marketplace", grossCollectedILS: 100, commissionRate: 0.15 }
 *   → VAT only on PetWash commission: ₪15 × 18/118 = ₪2.29
 *   → Provider must issue חשבונית מס for their ₪85
 *
 * Legacy: { baseAmount: 85, commissionRate: 0.15 }
 *   → treated as marketplace with baseAmount = provider's share (gross back-calculated)
 */
router.post("/calculate", requireAuth, async (req, res) => {
  try {
    const { mode, grossCollectedILS, baseAmount, commissionRate } = req.body;

    let calculation;

    if (mode === "direct") {
      const gross = parseFloat(grossCollectedILS ?? baseAmount);
      if (!gross || gross <= 0) {
        return res.status(400).json({ error: "grossCollectedILS must be a positive number" });
      }
      calculation = VATCalculatorService.calculateDirectSaleVAT(gross);
    } else {
      const rate = parseFloat(commissionRate ?? 0.15);
      if (grossCollectedILS) {
        const gross = parseFloat(grossCollectedILS);
        calculation = VATCalculatorService.calculateMarketplaceVAT(gross, rate);
      } else if (baseAmount) {
        const gross = VATCalculatorService.grossFromProviderShare(parseFloat(baseAmount), rate);
        calculation = VATCalculatorService.calculateMarketplaceVAT(gross, rate);
      } else {
        return res.status(400).json({ error: "Provide grossCollectedILS or baseAmount" });
      }
    }

    res.json({ calculation });
  } catch (error: any) {
    logger.error("[VAT] Error calculating", { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

router.post("/record-transaction", requireAuth, async (req, res) => {
  try {
    const { platform, transactionId, baseAmount, bookingId, metadata } = req.body;
    const entry = await VATCalculatorService.recordTransaction(
      platform,
      transactionId,
      parseFloat(baseAmount),
      bookingId,
      metadata
    );
    res.json({ entry });
  } catch (error: any) {
    logger.error("[VAT] Error recording transaction", { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

router.get("/platform-pl/:platform", requireAdmin, async (req, res) => {
  try {
    const { platform } = req.params;
    const { startDate, endDate } = req.query;
    const start = startDate ? new Date(startDate as string) : new Date(new Date().setDate(1));
    const end = endDate ? new Date(endDate as string) : new Date();
    const pl = await VATCalculatorService.getPlatformPL(platform as any, start, end);
    res.json({ pl });
  } catch (error: any) {
    logger.error("[VAT] Error fetching platform P&L", { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

router.get("/consolidated-pl", requireAdmin, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const start = startDate ? new Date(startDate as string) : new Date(new Date().setDate(1));
    const end = endDate ? new Date(endDate as string) : new Date();
    const consolidated = await VATCalculatorService.getConsolidatedPL(start, end);
    res.json({ consolidated });
  } catch (error: any) {
    logger.error("[VAT] Error fetching consolidated P&L", { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

router.get("/report/:month/:year", requireAdmin, async (req, res) => {
  try {
    const month = parseInt(req.params.month);
    const year = parseInt(req.params.year);
    const report = await VATCalculatorService.generateVATReport(month, year);
    res.json({ report });
  } catch (error: any) {
    logger.error("[VAT] Error generating report", { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

export default router;
