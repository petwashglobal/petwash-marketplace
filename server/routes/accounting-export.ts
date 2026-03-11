/**
 * Accounting Export & Compliance API Routes
 * 
 * Export booking transactions to Google Sheets
 * AI bookkeeping with Gemini
 * Israeli Tax Compliance Reports 2025/2026
 */

import { Router, Request, Response } from 'express';
import { BookingExportService } from '../services/BookingExportService';
import { logger } from '../lib/logger';
import { z } from 'zod';

const router = Router();

// ============================================================================
// EXPORT ENDPOINTS
// ============================================================================

/**
 * POST /api/accounting/export/transactions
 * Export all booking transactions to Google Sheets
 */
router.post('/export/transactions', async (req: Request, res: Response) => {
  try {
    const { fromDate, includeAI } = req.body;
    
    const result = await BookingExportService.exportBookingsToSheets(
      fromDate ? new Date(fromDate) : undefined,
      includeAI !== false
    );

    if (result.success) {
      logger.info('[Accounting] Transactions exported', { count: result.exportedCount });
      res.json({
        success: true,
        message: 'Transactions exported successfully',
        exportedCount: result.exportedCount,
        spreadsheetUrl: result.spreadsheetUrl,
      });
    } else {
      res.status(400).json({
        success: false,
        errors: result.errors,
      });
    }
  } catch (error: any) {
    logger.error('[Accounting] Export failed:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/accounting/export/compliance
 * Generate and export Israeli compliance report
 */
router.post('/export/compliance', async (req: Request, res: Response) => {
  try {
    const schema = z.object({
      year: z.number().int().min(2024).max(2030),
      month: z.number().int().min(1).max(12),
    });

    const validation = schema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ success: false, errors: validation.error.errors });
    }

    const { year, month } = validation.data;
    const result = await BookingExportService.exportComplianceReport(year, month);

    if (result.success) {
      logger.info('[Accounting] Compliance report exported', { year, month });
      res.json({
        success: true,
        message: `Compliance report for ${year}-${String(month).padStart(2, '0')} exported`,
        spreadsheetUrl: result.spreadsheetUrl,
      });
    } else {
      res.status(400).json({ success: false, errors: result.errors });
    }
  } catch (error: any) {
    logger.error('[Accounting] Compliance export failed:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/accounting/export/escrow
 * Export current escrow status
 */
router.post('/export/escrow', async (req: Request, res: Response) => {
  try {
    const result = await BookingExportService.exportEscrowStatus();

    if (result.success) {
      res.json({
        success: true,
        message: 'Escrow status exported',
        exportedCount: result.exportedCount,
        spreadsheetUrl: result.spreadsheetUrl,
      });
    } else {
      res.status(400).json({ success: false, errors: result.errors });
    }
  } catch (error: any) {
    logger.error('[Accounting] Escrow export failed:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================================================
// COMPLIANCE REPORT ENDPOINTS
// ============================================================================

/**
 * GET /api/accounting/compliance/report
 * Get compliance report for a specific period
 */
router.get('/compliance/report', async (req: Request, res: Response) => {
  try {
    const year = parseInt(req.query.year as string) || new Date().getFullYear();
    const month = parseInt(req.query.month as string) || new Date().getMonth() + 1;

    const report = await BookingExportService.generateComplianceReport(year, month);

    res.json({
      success: true,
      data: {
        ...report,
        legalNotes: {
          vatNote: 'מע"מ 18% על עמלות שירות בלבד',
          withholdingNote: 'ניכוי מס במקור 20% - בכפוף לאישור רשות המסים',
          nationalInsuranceNote: 'ביטוח לאומי לעצמאים - שיעור מופחת עד 60% מהשכר הממוצע',
        },
        regulatoryReferences: {
          vatLaw: 'חוק מס ערך מוסף, התשל"ו-1975',
          taxOrdinance: 'פקודת מס הכנסה [נוסח חדש]',
          nationalInsurance: 'חוק הביטוח הלאומי [נוסח משולב], התשנ"ה-1995',
        },
      },
    });
  } catch (error: any) {
    logger.error('[Accounting] Compliance report generation failed:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/accounting/summary
 * Get financial summary dashboard data
 */
router.get('/summary', async (req: Request, res: Response) => {
  try {
    const year = parseInt(req.query.year as string) || new Date().getFullYear();
    const month = parseInt(req.query.month as string) || new Date().getMonth() + 1;

    const report = await BookingExportService.generateComplianceReport(year, month);

    res.json({
      success: true,
      data: {
        period: report.period,
        metrics: {
          totalRevenue: { amount: report.totalRevenue, currency: 'ILS', label: 'סה"כ הכנסות' },
          platformFees: { amount: report.platformFees, currency: 'ILS', label: 'עמלות פלטפורמה' },
          providerPayouts: { amount: report.providerPayouts, currency: 'ILS', label: 'תשלומים לספקים' },
          escrowHeld: { amount: report.escrowHeld, currency: 'ILS', label: 'כספים בנאמנות' },
        },
        taxes: {
          vatCollected: { amount: report.vatCollected, currency: 'ILS', label: 'מע"מ לתשלום' },
          withholdingTax: { amount: report.withholdingTax, currency: 'ILS', label: 'ניכוי מס במקור' },
          nationalInsurance: { amount: report.nationalInsurance, currency: 'ILS', label: 'ביטוח לאומי' },
        },
        complianceStatus: {
          vatReportDue: new Date(year, month, 23).toISOString(),
          withholdingReportDue: new Date(year, month, 23).toISOString(),
          nationalInsuranceDue: new Date(year, month, 15).toISOString(),
        },
      },
    });
  } catch (error: any) {
    logger.error('[Accounting] Summary generation failed:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
