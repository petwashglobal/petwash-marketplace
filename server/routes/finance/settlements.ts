/**
 * Finance Settlements API Routes
 * Revenue sharing and settlement management for partners
 * 
 * Endpoints:
 * - POST   /api/finance/settlements/generate - Manual settlement generation
 * - GET    /api/finance/settlements - List all settlements (with filters)
 * - GET    /api/finance/settlements/:id - Get settlement details
 * - PATCH  /api/finance/settlements/:id/approve - Approve settlement
 * - PATCH  /api/finance/settlements/:id/pay - Mark settlement as paid
 * - GET    /api/finance/settlements/:id/export - Export settlement to CSV
 * - GET    /api/finance/partners/:id/dashboard - Partner revenue dashboard
 * 
 * Security:
 * - Requires admin authentication for all operations
 * - Audit trail for all settlement modifications
 * - Fraud detection for large settlements
 */

import { Router } from 'express';
import { z } from 'zod';
import { db } from '../../db';
import { settlements, partners, partnerAgreements } from '@shared/schema';
import { eq, desc, and, gte, lte, sql } from 'drizzle-orm';
import { requireAdmin } from '../../adminAuth';
import { logger } from '../../lib/logger';
import { FinanceSettlementService } from '../../services/FinanceSettlementService';
import { ImmutableStampService } from '../../services/ImmutableStampService';
import { assertOperatingControl } from '../../lib/petwashOperatingControlGateway';
import { requireUnifiedPayoutVerification } from '../../lib/unifiedPayoutVerification';

const router = Router();

// Apply admin authentication to all routes
router.use(requireAdmin);

// ==================== VALIDATION SCHEMAS ====================

const generateSettlementSchema = z.object({
  partnerId: z.number().int().positive(),
  periodStart: z.string().datetime(),
  periodEnd: z.string().datetime(),
  periodType: z.enum(['weekly', 'monthly', 'quarterly']).default('monthly'),
});

const approveSettlementSchema = z.object({
  notes: z.string().optional(),
});

const paySettlementSchema = z.object({
  paymentReference: z.string().min(1),
  notes: z.string().optional(),
});

const listSettlementsSchema = z.object({
  partnerId: z.number().int().positive().optional(),
  status: z.enum(['pending', 'approved', 'paid', 'disputed']).optional(),
  periodStart: z.string().datetime().optional(),
  periodEnd: z.string().datetime().optional(),
  limit: z.number().int().min(1).max(100).default(50).optional(),
  offset: z.number().int().min(0).default(0).optional(),
});

// ==================== SETTLEMENT ENDPOINTS ====================

/**
 * POST /api/finance/settlements/generate
 * Manually generate a settlement for a partner
 */
router.post('/generate', async (req, res) => {
  try {
    const validationResult = generateSettlementSchema.safeParse(req.body);
    
    if (!validationResult.success) {
      return res.status(400).json({
        error: 'Invalid request',
        details: validationResult.error.errors,
      });
    }

    const { partnerId, periodStart, periodEnd, periodType } = validationResult.data;

    logger.info('[FinanceAPI] Manual settlement generation requested', {
      partnerId,
      periodStart,
      periodEnd,
      periodType,
      requestedBy: req.user?.id,
    });

    // Convert string dates to Date objects
    const startDate = new Date(periodStart);
    const endDate = new Date(periodEnd);

    // Validate date range
    if (startDate >= endDate) {
      return res.status(400).json({
        error: 'Invalid date range',
        message: 'Period start must be before period end',
      });
    }

    // Generate settlement
    const settlement = await FinanceSettlementService.generateSettlement(
      partnerId,
      startDate,
      endDate,
      periodType
    );

    logger.info('[FinanceAPI] Settlement generated successfully', {
      settlementId: settlement.id,
      settlementNumber: settlement.settlementNumber,
      partnerShare: settlement.partnerShare,
    });

    res.json({
      success: true,
      settlement,
    });

  } catch (error: any) {
    logger.error('[FinanceAPI] Settlement generation failed', { 
      error: error.message,
      stack: error.stack,
    });

    res.status(500).json({
      error: 'Settlement generation failed',
      message: error.message,
    });
  }
});

/**
 * GET /api/finance/settlements
 * List settlements with optional filters
 */
router.get('/', async (req, res) => {
  try {
    const validationResult = listSettlementsSchema.safeParse(req.query);
    
    if (!validationResult.success) {
      return res.status(400).json({
        error: 'Invalid query parameters',
        details: validationResult.error.errors,
      });
    }

    const { partnerId, status, periodStart, periodEnd, limit, offset } = validationResult.data;

    // Build query conditions
    const conditions = [];
    
    if (partnerId) {
      conditions.push(eq(settlements.partnerId, partnerId));
    }
    
    if (status) {
      conditions.push(eq(settlements.status, status));
    }
    
    if (periodStart) {
      conditions.push(gte(settlements.periodStart, new Date(periodStart)));
    }
    
    if (periodEnd) {
      conditions.push(lte(settlements.periodEnd, new Date(periodEnd)));
    }

    // Fetch settlements with partner details
    const settlementsList = await db.query.settlements.findMany({
      where: conditions.length > 0 ? and(...conditions) : undefined,
      orderBy: desc(settlements.createdAt),
      limit: limit || 50,
      offset: offset || 0,
      with: {
        partner: true,
      },
    });

    // Get total count for pagination
    const [countResult] = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(settlements)
      .where(conditions.length > 0 ? and(...conditions) : undefined);

    res.json({
      settlements: settlementsList,
      pagination: {
        total: countResult?.count || 0,
        limit: limit || 50,
        offset: offset || 0,
      },
    });

  } catch (error: any) {
    logger.error('[FinanceAPI] Failed to list settlements', { error: error.message });

    res.status(500).json({
      error: 'Failed to retrieve settlements',
      message: error.message,
    });
  }
});

/**
 * GET /api/finance/settlements/:id
 * Get detailed settlement information
 */
router.get('/:id', async (req, res) => {
  try {
    const settlementId = parseInt(req.params.id);

    if (isNaN(settlementId)) {
      return res.status(400).json({
        error: 'Invalid settlement ID',
      });
    }

    const settlement = await db.query.settlements.findFirst({
      where: eq(settlements.id, settlementId),
      with: {
        partner: {
          with: {
            agreements: {
              where: eq(partnerAgreements.isActive, true),
            },
          },
        },
      },
    });

    if (!settlement) {
      return res.status(404).json({
        error: 'Settlement not found',
      });
    }

    // Verify settlement integrity
    const isValid = FinanceSettlementService.verifySettlementIntegrity(settlement);

    res.json({
      settlement,
      integrity: {
        isValid,
        auditHash: settlement.auditHash,
      },
    });

  } catch (error: any) {
    logger.error('[FinanceAPI] Failed to retrieve settlement', { error: error.message });

    res.status(500).json({
      error: 'Failed to retrieve settlement',
      message: error.message,
    });
  }
});

/**
 * PATCH /api/finance/settlements/:id/approve
 * Approve a settlement for payment
 */
router.patch('/:id/approve', async (req, res) => {
  try {
    const settlementId = parseInt(req.params.id);

    if (isNaN(settlementId)) {
      return res.status(400).json({
        error: 'Invalid settlement ID',
      });
    }

    const validationResult = approveSettlementSchema.safeParse(req.body);
    
    if (!validationResult.success) {
      return res.status(400).json({
        error: 'Invalid request',
        details: validationResult.error.errors,
      });
    }

    const userId = String(req.user?.id ?? 'unknown');

    if (!assertOperatingControl(req, res, {
      actionType: 'SUPPLIER_PAYMENT',
      route: 'PATCH /api/finance/settlements/:id/approve',
      targetId: `settlement:${settlementId}`,
      bankMatchStatus: 'pending_match',
      facts: {
        paymentApproved: true,
      },
    })) {
      return;
    }

    logger.info('[FinanceAPI] Settlement approval requested', {
      settlementId,
      approvedBy: userId,
    });

    const updatedSettlement = await FinanceSettlementService.approveSettlement(
      settlementId,
      userId
    );

    // Update notes if provided
    if (validationResult.data.notes) {
      await db
        .update(settlements)
        .set({ notes: validationResult.data.notes })
        .where(eq(settlements.id, settlementId));
    }

    logger.info('[FinanceAPI] Settlement approved successfully', {
      settlementId,
      settlementNumber: updatedSettlement.settlementNumber,
    });

    res.json({
      success: true,
      settlement: updatedSettlement,
    });

  } catch (error: any) {
    logger.error('[FinanceAPI] Settlement approval failed', { error: error.message });

    res.status(500).json({
      error: 'Settlement approval failed',
      message: error.message,
    });
  }
});

/**
 * PATCH /api/finance/settlements/:id/pay
 * Mark settlement as paid with payment reference
 */
router.patch('/:id/pay', async (req, res) => {
  try {
    const settlementId = parseInt(req.params.id);

    if (isNaN(settlementId)) {
      return res.status(400).json({
        error: 'Invalid settlement ID',
      });
    }

    const validationResult = paySettlementSchema.safeParse(req.body);
    
    if (!validationResult.success) {
      return res.status(400).json({
        error: 'Invalid request',
        details: validationResult.error.errors,
      });
    }

    const { paymentReference, notes } = validationResult.data;

    if (!assertOperatingControl(req, res, {
      actionType: 'SUPPLIER_PAYMENT',
      route: 'PATCH /api/finance/settlements/:id/pay',
      targetId: `settlement:${settlementId}`,
      bankMatchStatus: 'pending_match',
      facts: {
        paymentApproved: true,
        bankTransferReferenceCreated: Boolean(paymentReference),
      },
    })) {
      return;
    }

    logger.info('[FinanceAPI] Settlement payment recording requested', {
      settlementId,
      paymentReference,
      recordedBy: req.user?.id,
    });

    if (!await requireUnifiedPayoutVerification(req, res, {
      actorUserId: req.user?.uid || req.user?.id,
      actorEmail: req.user?.email,
      operation: 'settlement_mark_paid',
      targetId: `settlement:${settlementId}`,
      payload: {
        paymentReference,
      },
    })) {
      return;
    }

    const updatedSettlement = await FinanceSettlementService.markSettlementPaid(
      settlementId,
      paymentReference
    );

    // Update notes if provided
    if (notes) {
      await db
        .update(settlements)
        .set({ notes })
        .where(eq(settlements.id, settlementId));
    }

    logger.info('[FinanceAPI] Settlement marked as paid successfully', {
      settlementId,
      settlementNumber: updatedSettlement.settlementNumber,
      paymentReference,
    });

    // Immutable legal stamp — payout sent event
    void ImmutableStampService.createStamp({
      entityType: 'payout',
      entityId: String(settlementId),
      eventType: 'payout_sent',
      actorRole: 'admin',
      amountCents: updatedSettlement.partnerShare
        ? Math.round(Number(updatedSettlement.partnerShare) * 100)
        : undefined,
      currency: 'ILS',
      metadata: {
        settlementNumber: updatedSettlement.settlementNumber,
        paymentReference,
        partnerId: updatedSettlement.partnerId,
      },
    }).catch(() => {});

    res.json({
      success: true,
      settlement: updatedSettlement,
    });

  } catch (error: any) {
    logger.error('[FinanceAPI] Settlement payment recording failed', { error: error.message });

    res.status(500).json({
      error: 'Failed to record payment',
      message: error.message,
    });
  }
});

/**
 * GET /api/finance/settlements/:id/export
 * Export settlement to CSV format
 */
router.get('/:id/export', async (req, res) => {
  try {
    const settlementId = parseInt(req.params.id);

    if (isNaN(settlementId)) {
      return res.status(400).json({
        error: 'Invalid settlement ID',
      });
    }

    logger.info('[FinanceAPI] CSV export requested', {
      settlementId,
      requestedBy: req.user?.id,
    });

    const csv = await FinanceSettlementService.exportSettlementToCSV(settlementId);

    // Get settlement number for filename
    const settlement = await db.query.settlements.findFirst({
      where: eq(settlements.id, settlementId),
    });

    const filename = settlement 
      ? `settlement-${settlement.settlementNumber}.csv`
      : `settlement-${settlementId}.csv`;

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csv);

    logger.info('[FinanceAPI] CSV export successful', {
      settlementId,
      filename,
    });

  } catch (error: any) {
    logger.error('[FinanceAPI] CSV export failed', { error: error.message });

    res.status(500).json({
      error: 'CSV export failed',
      message: error.message,
    });
  }
});

// ==================== PARTNER DASHBOARD ENDPOINTS ====================

/**
 * GET /api/finance/partners/:id/dashboard
 * Get partner revenue dashboard with metrics
 */
router.get('/partners/:id/dashboard', async (req, res) => {
  try {
    const partnerId = parseInt(req.params.id);

    if (isNaN(partnerId)) {
      return res.status(400).json({
        error: 'Invalid partner ID',
      });
    }

    logger.info('[FinanceAPI] Partner dashboard requested', {
      partnerId,
      requestedBy: req.user?.id,
    });

    const dashboard = await FinanceSettlementService.getPartnerDashboard(partnerId);

    res.json(dashboard);

  } catch (error: any) {
    logger.error('[FinanceAPI] Partner dashboard retrieval failed', { error: error.message });

    res.status(500).json({
      error: 'Failed to retrieve partner dashboard',
      message: error.message,
    });
  }
});

export default router;
