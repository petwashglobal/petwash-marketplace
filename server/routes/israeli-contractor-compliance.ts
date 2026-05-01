/**
 * ISRAELI CONTRACTOR COMPLIANCE API
 *
 * Handles marketplace broker model (marketplace platform/on-demand platform) for Israeli contractor compliance
 * Prevents employee misclassification per Israeli Labor Law 2025
 *
 * AUTH MODEL:
 * - Provider endpoints: Firebase token required; caller must own the providerId
 * - Admin endpoints: Firebase token required + role must be admin/management/staff
 * - calculate-commission: Firebase token required (server or admin calls only)
 * - run-monthly-audit: Admin only
 */

import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import {
  IsraeliContractorComplianceService
} from '../services/IsraeliContractorCompliance';
import {
  insertProviderTaxComplianceSchema,
  providerTaxCompliance,
  providerCommissions,
  providerIndependenceScore,
  complianceVerificationLogs,
  users,
} from '@shared/schema';
import { db } from '../db';
import { eq, desc, sql, and } from 'drizzle-orm';
import { logger } from '../lib/logger';
import { auth as fbAdminAuth } from '../lib/firebase-admin';

const router = Router();

// ============================================================================
// AUTH HELPERS
// ============================================================================

/** Extract and verify Firebase token from Bearer header. Returns uid or throws. */
async function verifyToken(req: Request): Promise<string> {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    throw Object.assign(new Error('Authentication required'), { status: 401 });
  }
  try {
    const decoded = await fbAdminAuth.verifyIdToken(authHeader.split('Bearer ')[1], true);
    return decoded.uid;
  } catch {
    throw Object.assign(new Error('Invalid or expired token'), { status: 401 });
  }
}

const ADMIN_ROLES = ['admin', 'super_admin', 'management', 'staff'];

/** Return true if the user's roles jsonb array contains at least one admin role. */
function hasAdminRole(roles: unknown): boolean {
  if (!Array.isArray(roles)) return false;
  return roles.some((r: string) => ADMIN_ROLES.includes(r));
}

/** Verify token AND check that the caller is admin/management/staff in the DB. */
async function verifyAdmin(req: Request): Promise<string> {
  const uid = await verifyToken(req);
  const [user] = await db.select({ roles: users.roles }).from(users).where(eq(users.id, uid)).limit(1);
  if (!user || !hasAdminRole(user.roles)) {
    throw Object.assign(new Error('Admin access required'), { status: 403 });
  }
  return uid;
}

/** Verify token AND check that the caller owns the given providerId. Admins bypass the check. */
async function verifyProviderOwnership(req: Request, providerId: string): Promise<string> {
  const uid = await verifyToken(req);
  if (uid === providerId) return uid; // Owner

  // Admins may act on any provider
  const [user] = await db.select({ roles: users.roles }).from(users).where(eq(users.id, uid)).limit(1);
  if (user && hasAdminRole(user.roles)) return uid;

  throw Object.assign(new Error('Forbidden — you can only access your own compliance data'), { status: 403 });
}

/** Shared error responder */
function handleAuthError(res: Response, err: any) {
  const status = err.status || 500;
  const message = status < 500 ? err.message : 'Internal server error';
  res.status(status).json({ success: false, error: message });
}

// ============================================================================
// PROVIDER ENDPOINTS
// ============================================================================

/**
 * POST /submit-tax-registration
 * Provider submits their own Israeli tax registration for verification.
 * Auth: Provider must own the providerId in the request body.
 */
router.post('/submit-tax-registration', async (req, res) => {
  try {
    const taxData = insertProviderTaxComplianceSchema.parse(req.body);
    await verifyProviderOwnership(req, taxData.providerId);

    logger.info('[Israeli Compliance API] Tax registration submission', {
      providerId: taxData.providerId,
      providerType: taxData.providerType,
    });

    const result = await IsraeliContractorComplianceService.verifyTaxRegistration(
      taxData.providerId,
      taxData.providerType,
      taxData
    );

    res.json({
      success: true,
      verificationResult: result,
      message: result.isValid
        ? 'Tax registration verified successfully'
        : 'Tax registration verification failed',
    });
  } catch (error: any) {
    if (error.status === 401 || error.status === 403) return handleAuthError(res, error);
    logger.error('[Israeli Compliance API] Tax registration failed', { error: error.message });
    if (error.name === 'ZodError') {
      return res.status(400).json({ success: false, error: 'Invalid tax registration data', details: error.errors });
    }
    res.status(500).json({ success: false, error: 'Failed to submit tax registration' });
  }
});

/**
 * GET /compliance-status/:providerId
 * Get comprehensive compliance summary for a provider.
 * Auth: Provider must own the providerId, or be admin.
 */
router.get('/compliance-status/:providerId', async (req, res) => {
  try {
    const { providerId } = req.params;
    await verifyProviderOwnership(req, providerId);

    logger.info('[Israeli Compliance API] Fetching compliance status', { providerId });

    const summary = await IsraeliContractorComplianceService.getComplianceSummary(providerId);

    res.json({ success: true, providerId, compliance: summary });
  } catch (error: any) {
    if (error.status === 401 || error.status === 403) return handleAuthError(res, error);
    logger.error('[Israeli Compliance API] Failed to fetch compliance status', { error: error.message });
    res.status(500).json({ success: false, error: 'Failed to fetch compliance status' });
  }
});

/**
 * POST /calculate-commission
 * Calculate commission for a booking.
 * Auth: Firebase token required; caller must own the providerId or be admin.
 */
router.post('/calculate-commission', async (req, res) => {
  try {
    const schema = z.object({
      providerId: z.string().min(1),
      providerType: z.enum(['walker', 'sitter', 'driver', 'groomer', 'trainer']),
      bookingId: z.number().min(1),
      customerPaidAmount: z.number().min(0),
      commissionRate: z.number().min(15).max(25).default(20),
    });

    const data = schema.parse(req.body);
    await verifyProviderOwnership(req, data.providerId);

    logger.info('[Israeli Compliance API] Calculating commission', {
      providerId: data.providerId,
      bookingId: data.bookingId,
      amount: data.customerPaidAmount,
    });

    const commission = await IsraeliContractorComplianceService.calculateCommission(
      data.providerId,
      data.providerType,
      data.bookingId,
      data.customerPaidAmount,
      data.commissionRate
    );

    res.json({ success: true, commission });
  } catch (error: any) {
    if (error.status === 401 || error.status === 403) return handleAuthError(res, error);
    logger.error('[Israeli Compliance API] Commission calculation failed', { error: error.message });
    if (error.name === 'ZodError') {
      return res.status(400).json({ success: false, error: 'Invalid commission data', details: error.errors });
    }
    res.status(500).json({ success: false, error: error.message || 'Failed to calculate commission' });
  }
});

/**
 * POST /calculate-independence
 * Update provider independence score (prevents employee misclassification).
 * Auth: Provider must own the providerId, or be admin.
 */
router.post('/calculate-independence', async (req, res) => {
  try {
    const schema = z.object({
      providerId: z.string().min(1),
      providerType: z.enum(['walker', 'sitter', 'driver', 'groomer', 'trainer']),
      metrics: z.object({
        totalClients: z.number().min(1).optional(),
        petwashRevenuePercent: z.number().min(0).max(100).optional(),
        hasOwnEquipment: z.boolean().optional(),
        canRefuseGigs: z.boolean().optional(),
        setOwnRates: z.boolean().optional(),
        hasSubstitutes: z.boolean().optional(),
      }),
    });

    const data = schema.parse(req.body);
    await verifyProviderOwnership(req, data.providerId);

    logger.info('[Israeli Compliance API] Calculating independence score', { providerId: data.providerId });

    const independence = await IsraeliContractorComplianceService.calculateIndependenceScore(
      data.providerId,
      data.providerType,
      data.metrics
    );

    res.json({
      success: true,
      independence,
      warning: independence.riskLevel === 'high'
        ? 'High employee misclassification risk - action required'
        : null,
    });
  } catch (error: any) {
    if (error.status === 401 || error.status === 403) return handleAuthError(res, error);
    logger.error('[Israeli Compliance API] Independence calculation failed', { error: error.message });
    if (error.name === 'ZodError') {
      return res.status(400).json({ success: false, error: 'Invalid independence data', details: error.errors });
    }
    res.status(500).json({ success: false, error: 'Failed to calculate independence score' });
  }
});

/**
 * POST /run-monthly-audit
 * Run monthly compliance audit for a provider.
 * Auth: Admin only — this is a privileged compliance operation.
 */
router.post('/run-monthly-audit', async (req, res) => {
  try {
    await verifyAdmin(req);

    const schema = z.object({
      providerId: z.string().min(1),
      providerType: z.enum(['walker', 'sitter', 'driver', 'groomer', 'trainer']),
    });

    const data = schema.parse(req.body);

    logger.info('[Israeli Compliance API] Running monthly audit', { providerId: data.providerId });

    const audit = await IsraeliContractorComplianceService.runMonthlyAudit(
      data.providerId,
      data.providerType
    );

    res.json({
      success: true,
      audit,
      status: audit.passed ? 'compliant' : 'non-compliant',
    });
  } catch (error: any) {
    if (error.status === 401 || error.status === 403) return handleAuthError(res, error);
    logger.error('[Israeli Compliance API] Monthly audit failed', { error: error.message });
    if (error.name === 'ZodError') {
      return res.status(400).json({ success: false, error: 'Invalid audit request', details: error.errors });
    }
    res.status(500).json({ success: false, error: 'Failed to run monthly audit' });
  }
});

/**
 * GET /provider-earnings/:providerId
 * Get provider earnings breakdown.
 * Auth: Provider must own the providerId, or be admin.
 */
router.get('/provider-earnings/:providerId', async (req, res) => {
  try {
    const { providerId } = req.params;
    await verifyProviderOwnership(req, providerId);

    const { startDate, endDate } = req.query;

    logger.info('[Israeli Compliance API] Fetching provider earnings', { providerId });

    let query = db.select().from(providerCommissions)
      .where(eq(providerCommissions.providerId, providerId))
      .orderBy(desc(providerCommissions.transactionDate));

    if (startDate) {
      query = query.where(
        sql`${providerCommissions.transactionDate} >= ${new Date(startDate as string)}`
      );
    }
    if (endDate) {
      query = query.where(
        sql`${providerCommissions.transactionDate} <= ${new Date(endDate as string)}`
      );
    }

    const commissions = await query;

    const totals = commissions.reduce((acc, comm) => ({
      totalEarnings: acc.totalEarnings + parseFloat(comm.providerEarnings || '0'),
      totalCommissions: acc.totalCommissions + parseFloat(comm.commissionAmount || '0'),
      totalCustomerPayments: acc.totalCustomerPayments + parseFloat(comm.customerPaidAmount || '0'),
      count: acc.count + 1,
    }), { totalEarnings: 0, totalCommissions: 0, totalCustomerPayments: 0, count: 0 });

    res.json({
      success: true,
      providerId,
      earnings: { transactions: commissions, summary: totals },
    });
  } catch (error: any) {
    if (error.status === 401 || error.status === 403) return handleAuthError(res, error);
    logger.error('[Israeli Compliance API] Failed to fetch provider earnings', { error: error.message });
    res.status(500).json({ success: false, error: 'Failed to fetch provider earnings' });
  }
});

// ============================================================================
// ADMIN ENDPOINTS — all require admin/management/staff role
// ============================================================================

/**
 * GET /admin/providers
 * Admin: List all providers with compliance status.
 */
router.get('/admin/providers', async (req, res) => {
  try {
    await verifyAdmin(req);

    const { verificationStatus, riskLevel, providerType } = req.query;

    logger.info('[Israeli Compliance API] Admin fetching providers', { verificationStatus, riskLevel });

    const conditions = [];
    if (verificationStatus) {
      conditions.push(eq(providerTaxCompliance.verificationStatus, verificationStatus as string));
    }
    if (riskLevel) {
      conditions.push(eq(providerTaxCompliance.riskLevel, riskLevel as string));
    }
    if (providerType) {
      conditions.push(eq(providerTaxCompliance.providerType, providerType as string));
    }

    const providers = await db.select()
      .from(providerTaxCompliance)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(providerTaxCompliance.createdAt))
      .limit(100);

    res.json({ success: true, providers, count: providers.length });
  } catch (error: any) {
    if (error.status === 401 || error.status === 403) return handleAuthError(res, error);
    logger.error('[Israeli Compliance API] Admin provider fetch failed', { error: error.message });
    res.status(500).json({ success: false, error: 'Failed to fetch providers' });
  }
});

/**
 * GET /admin/high-risk-providers
 * Admin: Get providers with high employee misclassification risk.
 */
router.get('/admin/high-risk-providers', async (req, res) => {
  try {
    await verifyAdmin(req);

    logger.info('[Israeli Compliance API] Fetching high-risk providers');

    const highRiskProviders = await db.select()
      .from(providerIndependenceScore)
      .where(eq(providerIndependenceScore.riskLevel, 'high'))
      .orderBy(desc(providerIndependenceScore.employeeRiskScore))
      .limit(50);

    res.json({
      success: true,
      highRiskProviders,
      count: highRiskProviders.length,
      warning: 'These providers have high employee misclassification risk',
    });
  } catch (error: any) {
    if (error.status === 401 || error.status === 403) return handleAuthError(res, error);
    logger.error('[Israeli Compliance API] Failed to fetch high-risk providers', { error: error.message });
    res.status(500).json({ success: false, error: 'Failed to fetch high-risk providers' });
  }
});

/**
 * POST /admin/verify-tax/:providerId
 * Admin: Manually approve or reject a provider's tax registration.
 */
router.post('/admin/verify-tax/:providerId', async (req, res) => {
  try {
    const adminUid = await verifyAdmin(req);
    const { providerId } = req.params;

    const schema = z.object({
      approved: z.boolean(),
      notes: z.string().optional(),
    });

    const data = schema.parse(req.body);

    logger.info('[Israeli Compliance API] Admin verifying tax registration', {
      providerId,
      approved: data.approved,
      adminUid,
    });

    await db.update(providerTaxCompliance)
      .set({
        verificationStatus: data.approved ? 'verified' : 'rejected',
        verifiedAt: data.approved ? new Date() : null,
        verifiedByUserId: adminUid,
        rejectionReason: data.approved ? null : data.notes,
        isCompliant: data.approved,
        updatedAt: new Date(),
      })
      .where(eq(providerTaxCompliance.providerId, providerId));

    await db.insert(complianceVerificationLogs).values({
      providerId,
      providerType: 'walker',
      verificationType: 'tax_registration',
      checkStatus: data.approved ? 'passed' : 'failed',
      performedByUserId: adminUid,
      performedBySystem: false,
      actionTaken: `Admin ${data.approved ? 'approved' : 'rejected'} tax registration`,
      findings: JSON.stringify({ notes: data.notes }),
    });

    res.json({
      success: true,
      message: `Tax registration ${data.approved ? 'approved' : 'rejected'} successfully`,
    });
  } catch (error: any) {
    if (error.status === 401 || error.status === 403) return handleAuthError(res, error);
    logger.error('[Israeli Compliance API] Admin verification failed', { error: error.message });
    if (error.name === 'ZodError') {
      return res.status(400).json({ success: false, error: 'Invalid verification data', details: error.errors });
    }
    res.status(500).json({ success: false, error: 'Failed to verify tax registration' });
  }
});

/**
 * GET /admin/compliance-logs
 * Admin: Get compliance verification audit logs.
 */
router.get('/admin/compliance-logs', async (req, res) => {
  try {
    await verifyAdmin(req);

    const { providerId, verificationType, checkStatus } = req.query;

    logger.info('[Israeli Compliance API] Fetching compliance logs', { providerId, verificationType, checkStatus });

    const conditions = [];
    if (providerId) {
      conditions.push(eq(complianceVerificationLogs.providerId, providerId as string));
    }
    if (verificationType) {
      conditions.push(eq(complianceVerificationLogs.verificationType, verificationType as string));
    }
    if (checkStatus) {
      conditions.push(eq(complianceVerificationLogs.checkStatus, checkStatus as string));
    }

    const logs = await db.select()
      .from(complianceVerificationLogs)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(complianceVerificationLogs.createdAt))
      .limit(200);

    res.json({ success: true, logs, count: logs.length });
  } catch (error: any) {
    if (error.status === 401 || error.status === 403) return handleAuthError(res, error);
    logger.error('[Israeli Compliance API] Failed to fetch compliance logs', { error: error.message });
    res.status(500).json({ success: false, error: 'Failed to fetch compliance logs' });
  }
});

/**
 * GET /admin/compliance-stats
 * Admin: Get overall compliance statistics.
 */
router.get('/admin/compliance-stats', async (req, res) => {
  try {
    await verifyAdmin(req);

    logger.info('[Israeli Compliance API] Fetching compliance stats');

    const [taxStats, independenceStats, commissionStats] = await Promise.all([
      db.select({
        verificationStatus: providerTaxCompliance.verificationStatus,
        count: sql<number>`COUNT(*)`,
      })
        .from(providerTaxCompliance)
        .groupBy(providerTaxCompliance.verificationStatus),

      db.select({
        riskLevel: providerIndependenceScore.riskLevel,
        count: sql<number>`COUNT(*)`,
        avgRiskScore: sql<number>`AVG(CAST(${providerIndependenceScore.employeeRiskScore} AS NUMERIC))`,
      })
        .from(providerIndependenceScore)
        .groupBy(providerIndependenceScore.riskLevel),

      db.select({
        totalCommissions: sql<number>`SUM(CAST(${providerCommissions.commissionAmount} AS NUMERIC))`,
        totalProviderEarnings: sql<number>`SUM(CAST(${providerCommissions.providerEarnings} AS NUMERIC))`,
        totalTransactions: sql<number>`COUNT(*)`,
      })
        .from(providerCommissions),
    ]);

    res.json({
      success: true,
      stats: {
        taxCompliance: taxStats,
        independenceRisk: independenceStats,
        commissions: commissionStats[0] || {
          totalCommissions: 0,
          totalProviderEarnings: 0,
          totalTransactions: 0,
        },
      },
    });
  } catch (error: any) {
    if (error.status === 401 || error.status === 403) return handleAuthError(res, error);
    logger.error('[Israeli Compliance API] Failed to fetch compliance stats', { error: error.message });
    res.status(500).json({ success: false, error: 'Failed to fetch compliance statistics' });
  }
});

export default router;
