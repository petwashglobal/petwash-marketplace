/**
 * ISRAELI CONTRACTOR COMPLIANCE API
 *
 * Handles marketplace broker model (like Airbnb/Uber) for Israeli contractor compliance
 * Prevents employee misclassification per Israeli Labor Law 2025
 *
 * Endpoints:
 * - POST /submit-tax-registration - Provider submits tax registration
 * - GET /compliance-status/:providerId - Get provider compliance summary
 * - POST /calculate-commission - Calculate commission for booking
 * - POST /calculate-independence - Update provider independence score
 * - POST /run-monthly-audit - Run compliance audit
 * - GET /admin/providers - Admin: List all providers with compliance status
 * - GET /admin/high-risk-providers - Admin: Get high-risk providers
 * - POST /admin/verify-tax/:providerId - Admin: Verify provider tax registration
 */
import { Router } from 'express';
import { z } from 'zod';
import { IsraeliContractorComplianceService } from '../services/IsraeliContractorCompliance';
import { insertProviderTaxComplianceSchema, providerTaxCompliance, providerCommissions, providerIndependenceScore, complianceVerificationLogs, } from '@shared/schema';
import { db } from '../db';
import { eq, desc, sql, and } from 'drizzle-orm';
import { logger } from '../lib/logger';
const router = Router();
// ============================================================================
// PROVIDER ENDPOINTS
// ============================================================================
/**
 * POST /submit-tax-registration
 * Provider submits Israeli tax registration for verification
 */
router.post('/submit-tax-registration', async (req, res) => {
    try {
        const taxData = insertProviderTaxComplianceSchema.parse(req.body);
        logger.info('[Israeli Compliance API] Tax registration submission', {
            providerId: taxData.providerId,
            providerType: taxData.providerType,
        });
        const result = await IsraeliContractorComplianceService.verifyTaxRegistration(taxData.providerId, taxData.providerType, taxData);
        res.json({
            success: true,
            verificationResult: result,
            message: result.isValid
                ? 'Tax registration verified successfully'
                : 'Tax registration verification failed',
        });
    }
    catch (error) {
        logger.error('[Israeli Compliance API] Tax registration failed', {
            error: error.message
        });
        if (error.name === 'ZodError') {
            return res.status(400).json({
                success: false,
                error: 'Invalid tax registration data',
                details: error.errors
            });
        }
        res.status(500).json({
            success: false,
            error: 'Failed to submit tax registration'
        });
    }
});
/**
 * GET /compliance-status/:providerId
 * Get comprehensive compliance summary for provider
 */
router.get('/compliance-status/:providerId', async (req, res) => {
    try {
        const { providerId } = req.params;
        logger.info('[Israeli Compliance API] Fetching compliance status', { providerId });
        const summary = await IsraeliContractorComplianceService.getComplianceSummary(providerId);
        res.json({
            success: true,
            providerId,
            compliance: summary,
        });
    }
    catch (error) {
        logger.error('[Israeli Compliance API] Failed to fetch compliance status', {
            error: error.message
        });
        res.status(500).json({
            success: false,
            error: 'Failed to fetch compliance status'
        });
    }
});
/**
 * POST /calculate-commission
 * Calculate commission for a booking
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
        logger.info('[Israeli Compliance API] Calculating commission', {
            providerId: data.providerId,
            bookingId: data.bookingId,
            amount: data.customerPaidAmount,
        });
        const commission = await IsraeliContractorComplianceService.calculateCommission(data.providerId, data.providerType, data.bookingId, data.customerPaidAmount, data.commissionRate);
        res.json({
            success: true,
            commission,
        });
    }
    catch (error) {
        logger.error('[Israeli Compliance API] Commission calculation failed', {
            error: error.message
        });
        if (error.name === 'ZodError') {
            return res.status(400).json({
                success: false,
                error: 'Invalid commission data',
                details: error.errors
            });
        }
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to calculate commission'
        });
    }
});
/**
 * POST /calculate-independence
 * Update provider independence score (prevents employee misclassification)
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
        logger.info('[Israeli Compliance API] Calculating independence score', {
            providerId: data.providerId,
        });
        const independence = await IsraeliContractorComplianceService.calculateIndependenceScore(data.providerId, data.providerType, data.metrics);
        res.json({
            success: true,
            independence,
            warning: independence.riskLevel === 'high'
                ? 'High employee misclassification risk - action required'
                : null,
        });
    }
    catch (error) {
        logger.error('[Israeli Compliance API] Independence calculation failed', {
            error: error.message
        });
        if (error.name === 'ZodError') {
            return res.status(400).json({
                success: false,
                error: 'Invalid independence data',
                details: error.errors
            });
        }
        res.status(500).json({
            success: false,
            error: 'Failed to calculate independence score'
        });
    }
});
/**
 * POST /run-monthly-audit
 * Run monthly compliance audit for a provider
 */
router.post('/run-monthly-audit', async (req, res) => {
    try {
        const schema = z.object({
            providerId: z.string().min(1),
            providerType: z.enum(['walker', 'sitter', 'driver', 'groomer', 'trainer']),
        });
        const data = schema.parse(req.body);
        logger.info('[Israeli Compliance API] Running monthly audit', {
            providerId: data.providerId,
        });
        const audit = await IsraeliContractorComplianceService.runMonthlyAudit(data.providerId, data.providerType);
        res.json({
            success: true,
            audit,
            status: audit.passed ? 'compliant' : 'non-compliant',
        });
    }
    catch (error) {
        logger.error('[Israeli Compliance API] Monthly audit failed', {
            error: error.message
        });
        if (error.name === 'ZodError') {
            return res.status(400).json({
                success: false,
                error: 'Invalid audit request',
                details: error.errors
            });
        }
        res.status(500).json({
            success: false,
            error: 'Failed to run monthly audit'
        });
    }
});
/**
 * GET /provider-earnings/:providerId
 * Get provider earnings breakdown
 */
router.get('/provider-earnings/:providerId', async (req, res) => {
    try {
        const { providerId } = req.params;
        const { startDate, endDate } = req.query;
        logger.info('[Israeli Compliance API] Fetching provider earnings', { providerId });
        let query = db.select().from(providerCommissions)
            .where(eq(providerCommissions.providerId, providerId))
            .orderBy(desc(providerCommissions.transactionDate));
        // Add date filters if provided
        if (startDate) {
            query = query.where(sql `${providerCommissions.transactionDate} >= ${new Date(startDate)}`);
        }
        if (endDate) {
            query = query.where(sql `${providerCommissions.transactionDate} <= ${new Date(endDate)}`);
        }
        const commissions = await query;
        // Calculate totals
        const totals = commissions.reduce((acc, comm) => ({
            totalEarnings: acc.totalEarnings + parseFloat(comm.providerEarnings || '0'),
            totalCommissions: acc.totalCommissions + parseFloat(comm.commissionAmount || '0'),
            totalCustomerPayments: acc.totalCustomerPayments + parseFloat(comm.customerPaidAmount || '0'),
            count: acc.count + 1,
        }), { totalEarnings: 0, totalCommissions: 0, totalCustomerPayments: 0, count: 0 });
        res.json({
            success: true,
            providerId,
            earnings: {
                transactions: commissions,
                summary: totals,
            },
        });
    }
    catch (error) {
        logger.error('[Israeli Compliance API] Failed to fetch provider earnings', {
            error: error.message
        });
        res.status(500).json({
            success: false,
            error: 'Failed to fetch provider earnings'
        });
    }
});
// ============================================================================
// ADMIN ENDPOINTS
// ============================================================================
/**
 * GET /admin/providers
 * Admin: List all providers with compliance status
 */
router.get('/admin/providers', async (req, res) => {
    try {
        const { verificationStatus, riskLevel, providerType } = req.query;
        logger.info('[Israeli Compliance API] Admin fetching providers', {
            verificationStatus,
            riskLevel,
        });
        // Build query conditions
        const conditions = [];
        if (verificationStatus) {
            conditions.push(eq(providerTaxCompliance.verificationStatus, verificationStatus));
        }
        if (riskLevel) {
            conditions.push(eq(providerTaxCompliance.riskLevel, riskLevel));
        }
        if (providerType) {
            conditions.push(eq(providerTaxCompliance.providerType, providerType));
        }
        const providers = await db.select()
            .from(providerTaxCompliance)
            .where(conditions.length > 0 ? and(...conditions) : undefined)
            .orderBy(desc(providerTaxCompliance.createdAt))
            .limit(100);
        res.json({
            success: true,
            providers,
            count: providers.length,
        });
    }
    catch (error) {
        logger.error('[Israeli Compliance API] Admin provider fetch failed', {
            error: error.message
        });
        res.status(500).json({
            success: false,
            error: 'Failed to fetch providers'
        });
    }
});
/**
 * GET /admin/high-risk-providers
 * Admin: Get providers with high employee misclassification risk
 */
router.get('/admin/high-risk-providers', async (req, res) => {
    try {
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
    }
    catch (error) {
        logger.error('[Israeli Compliance API] Failed to fetch high-risk providers', {
            error: error.message
        });
        res.status(500).json({
            success: false,
            error: 'Failed to fetch high-risk providers'
        });
    }
});
/**
 * POST /admin/verify-tax/:providerId
 * Admin: Manually verify provider tax registration
 */
router.post('/admin/verify-tax/:providerId', async (req, res) => {
    try {
        const { providerId } = req.params;
        const schema = z.object({
            approved: z.boolean(),
            adminUserId: z.string().min(1),
            notes: z.string().optional(),
        });
        const data = schema.parse(req.body);
        logger.info('[Israeli Compliance API] Admin verifying tax registration', {
            providerId,
            approved: data.approved,
            adminUserId: data.adminUserId,
        });
        // Update verification status
        await db.update(providerTaxCompliance)
            .set({
            verificationStatus: data.approved ? 'verified' : 'rejected',
            verifiedAt: data.approved ? new Date() : null,
            verifiedByUserId: data.adminUserId,
            rejectionReason: data.approved ? null : data.notes,
            isCompliant: data.approved,
            updatedAt: new Date(),
        })
            .where(eq(providerTaxCompliance.providerId, providerId));
        // Log admin action
        await db.insert(complianceVerificationLogs).values({
            providerId,
            providerType: 'walker', // Would be dynamic in production
            verificationType: 'tax_registration',
            checkStatus: data.approved ? 'passed' : 'failed',
            performedByUserId: data.adminUserId,
            performedBySystem: false,
            actionTaken: `Admin ${data.approved ? 'approved' : 'rejected'} tax registration`,
            findings: JSON.stringify({ notes: data.notes }),
        });
        res.json({
            success: true,
            message: `Tax registration ${data.approved ? 'approved' : 'rejected'} successfully`,
        });
    }
    catch (error) {
        logger.error('[Israeli Compliance API] Admin verification failed', {
            error: error.message
        });
        if (error.name === 'ZodError') {
            return res.status(400).json({
                success: false,
                error: 'Invalid verification data',
                details: error.errors
            });
        }
        res.status(500).json({
            success: false,
            error: 'Failed to verify tax registration'
        });
    }
});
/**
 * GET /admin/compliance-logs
 * Admin: Get compliance verification logs
 */
router.get('/admin/compliance-logs', async (req, res) => {
    try {
        const { providerId, verificationType, checkStatus } = req.query;
        logger.info('[Israeli Compliance API] Fetching compliance logs', {
            providerId,
            verificationType,
            checkStatus,
        });
        const conditions = [];
        if (providerId) {
            conditions.push(eq(complianceVerificationLogs.providerId, providerId));
        }
        if (verificationType) {
            conditions.push(eq(complianceVerificationLogs.verificationType, verificationType));
        }
        if (checkStatus) {
            conditions.push(eq(complianceVerificationLogs.checkStatus, checkStatus));
        }
        const logs = await db.select()
            .from(complianceVerificationLogs)
            .where(conditions.length > 0 ? and(...conditions) : undefined)
            .orderBy(desc(complianceVerificationLogs.createdAt))
            .limit(200);
        res.json({
            success: true,
            logs,
            count: logs.length,
        });
    }
    catch (error) {
        logger.error('[Israeli Compliance API] Failed to fetch compliance logs', {
            error: error.message
        });
        res.status(500).json({
            success: false,
            error: 'Failed to fetch compliance logs'
        });
    }
});
/**
 * GET /admin/compliance-stats
 * Admin: Get overall compliance statistics
 */
router.get('/admin/compliance-stats', async (req, res) => {
    try {
        logger.info('[Israeli Compliance API] Fetching compliance stats');
        const [taxStats, independenceStats, commissionStats] = await Promise.all([
            // Tax compliance stats
            db.select({
                verificationStatus: providerTaxCompliance.verificationStatus,
                count: sql `COUNT(*)`,
            })
                .from(providerTaxCompliance)
                .groupBy(providerTaxCompliance.verificationStatus),
            // Independence risk stats
            db.select({
                riskLevel: providerIndependenceScore.riskLevel,
                count: sql `COUNT(*)`,
                avgRiskScore: sql `AVG(CAST(${providerIndependenceScore.employeeRiskScore} AS NUMERIC))`,
            })
                .from(providerIndependenceScore)
                .groupBy(providerIndependenceScore.riskLevel),
            // Commission stats
            db.select({
                totalCommissions: sql `SUM(CAST(${providerCommissions.commissionAmount} AS NUMERIC))`,
                totalProviderEarnings: sql `SUM(CAST(${providerCommissions.providerEarnings} AS NUMERIC))`,
                totalTransactions: sql `COUNT(*)`,
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
                    totalTransactions: 0
                },
            },
        });
    }
    catch (error) {
        logger.error('[Israeli Compliance API] Failed to fetch compliance stats', {
            error: error.message
        });
        res.status(500).json({
            success: false,
            error: 'Failed to fetch compliance statistics'
        });
    }
});
export default router;
