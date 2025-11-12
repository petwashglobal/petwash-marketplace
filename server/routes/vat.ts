import express from "express";
import VATCalculatorService from "../services/VATCalculatorService";
import { requireAuth } from "../customAuth";
import { requireAdmin } from "../adminAuth";

const router = express.Router();

router.post("/calculate", requireAuth, async (req, res) => {
  try {
    const { baseAmount, commissionRate } = req.body;
    const calculation = VATCalculatorService.calculateVAT(baseAmount, commissionRate);
    res.json({ calculation });
  } catch (error: any) {
    console.error("[VAT] Error calculating:", error);
    res.status(500).json({ error: error.message });
  }
});

router.post("/record-transaction", requireAuth, async (req, res) => {
  try {
    const { platform, transactionId, baseAmount, bookingId, metadata } = req.body;
    const entry = await VATCalculatorService.recordTransaction(
      platform,
      transactionId,
      baseAmount,
      bookingId,
      metadata
    );
    res.json({ entry });
  } catch (error: any) {
    console.error("[VAT] Error recording transaction:", error);
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
    console.error("[VAT] Error fetching platform P&L:", error);
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
    console.error("[VAT] Error fetching consolidated P&L:", error);
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
    console.error("[VAT] Error generating report:", error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
