/**
 * Blockchain-Style Audit Ledger API Routes
 * 
 * Customer-facing audit trail and admin fraud monitoring
 */

import { Router, type Request, type Response } from 'express';
import { AuditLedgerService } from '../services/AuditLedgerService';
import type { AuthenticatedRequest } from '../middleware/rbac';
import { requireAdmin } from '../middleware/rbac';
import { validateFirebaseToken } from '../middleware/firebase-auth';
import { logger } from '../lib/logger';
import { z } from 'zod';

const router = Router();

// 🔒 SECURITY: All audit routes require authentication
router.use(validateFirebaseToken);

/**
 * GET /api/audit/my-trail
 * Get authenticated user's complete audit trail
 * 🔒 Customer access - view their own blockchain history
 */
router.get('/my-trail', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.firebaseUser!.uid;
    
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 100;
    
    const trail = await AuditLedgerService.getUserAuditTrail(userId, limit);
    
    res.json({
      userId,
      recordCount: trail.length,
      records: trail,
    });
    
  } catch (error) {
    logger.error('[Audit API] Error fetching user trail:', error);
    res.status(500).json({ error: 'Failed to fetch audit trail' });
  }
});

/**
 * GET /api/audit/entity/:type/:id
 * Get audit trail for specific entity (voucher, loyalty card, etc.)
 * 🔒 Customer can view their own entities
 */
router.get('/entity/:type/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { type, id } = req.params;
    
    const trail = await AuditLedgerService.getEntityAuditTrail(type, id);
    
    // Filter to only show records for authenticated user (unless admin)
    const userId = req.firebaseUser!.uid;
    const isAdmin = req.firebaseUser!.role === 'admin';
    
    const filteredTrail = isAdmin 
      ? trail 
      : trail.filter(record => record.userId === userId);
    
    res.json({
      entityType: type,
      entityId: id,
      recordCount: filteredTrail.length,
      records: filteredTrail,
    });
    
  } catch (error) {
    logger.error('[Audit API] Error fetching entity trail:', error);
    res.status(500).json({ error: 'Failed to fetch entity audit trail' });
  }
});

/**
 * GET /api/audit/verify-chain
 * Verify integrity of the hash chain
 * 🔒 Admin only
 */
router.get('/verify-chain', requireAdmin, async (req: Request, res: Response) => {
  try {
    const startBlock = req.query.startBlock ? parseInt(req.query.startBlock as string) : undefined;
    const endBlock = req.query.endBlock ? parseInt(req.query.endBlock as string) : undefined;
    
    const verification = await AuditLedgerService.verifyChainIntegrity(startBlock, endBlock);
    
    if (!verification.isValid) {
      logger.error('[Audit API] SECURITY ALERT: Chain integrity compromised!', {
        brokenAt: verification.brokenAt,
        errors: verification.errors,
      });
    }
    
    res.json(verification);
    
  } catch (error) {
    logger.error('[Audit API] Chain verification failed:', error);
    res.status(500).json({ error: 'Chain verification failed' });
  }
});

/**
 * POST /api/audit/create-snapshot
 * Create daily Merkle snapshot
 * 🔒 Admin only (typically called by cron job)
 */
router.post('/create-snapshot', requireAdmin, async (req: Request, res: Response) => {
  try {
    const schema = z.object({
      date: z.string().optional(),
    });
    
    const validation = schema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        error: 'Validation failed',
        details: validation.error.errors
      });
    }
    
    const date = validation.data.date ? new Date(validation.data.date) : new Date();
    
    const snapshot = await AuditLedgerService.createDailySnapshot(date);
    
    if (!snapshot) {
      return res.status(404).json({ error: 'No records found for this date' });
    }
    
    res.json(snapshot);
    
  } catch (error) {
    logger.error('[Audit API] Snapshot creation failed:', error);
    res.status(500).json({ error: 'Snapshot creation failed' });
  }
});

/**
 * GET /api/audit/fraud-dashboard
 * Get fraud monitoring statistics
 * 🔒 Admin only
 */
router.get('/fraud-dashboard', requireAdmin, async (req: Request, res: Response) => {
  try {
    const timeframe = req.query.timeframe as 'today' | 'week' | 'month' || 'today';
    
    const stats = await AuditLedgerService.getFraudMonitoringStats(timeframe);
    
    if (!stats) {
      return res.status(500).json({ error: 'Failed to generate stats' });
    }
    
    res.json(stats);
    
  } catch (error) {
    logger.error('[Audit API] Fraud dashboard failed:', error);
    res.status(500).json({ error: 'Failed to generate fraud dashboard' });
  }
});

/**
 * POST /api/audit/record-voucher-redemption
 * Record voucher redemption with double-spend prevention
 * 🔒 Authenticated users only
 */
router.post('/record-voucher-redemption', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const schema = z.object({
      voucherId: z.string().min(1, { message: "Voucher ID is required" }),
      amount: z.number().positive({ message: "Amount must be positive" }),
      stationId: z.string().optional(),
      franchiseId: z.string().optional(),
      metadata: z.any().optional(),
    });
    
    const validation = schema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        error: 'Validation failed',
        details: validation.error.errors
      });
    }
    
    const userId = req.firebaseUser!.uid;
    
    const result = await AuditLedgerService.recordVoucherRedemption({
      ...validation.data,
      userId,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });
    
    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }
    
    res.json({
      success: true,
      redemptionCode: result.redemptionCode,
      message: 'Voucher redeemed successfully',
    });
    
  } catch (error) {
    logger.error('[Audit API] Voucher redemption failed:', error);
    res.status(500).json({ error: 'Voucher redemption failed' });
  }
});

/**
 * POST /api/audit/record-discount-usage
 * Record discount usage with one-time enforcement
 * 🔒 Authenticated users only
 */
router.post('/record-discount-usage', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const schema = z.object({
      discountCode: z.string().min(1, { message: "Discount code is required" }),
      discountAmount: z.number().positive({ message: "Discount amount must be positive" }),
      originalPrice: z.number().positive({ message: "Original price must be positive" }),
      finalPrice: z.number().min(0, { message: "Final price must be non-negative" }),
      stationId: z.string().optional(),
      metadata: z.any().optional(),
    });
    
    const validation = schema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        error: 'Validation failed',
        details: validation.error.errors
      });
    }
    
    const userId = req.firebaseUser!.uid;
    
    const result = await AuditLedgerService.recordDiscountUsage({
      ...validation.data,
      userId,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });
    
    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }
    
    res.json({
      success: true,
      usageToken: result.usageToken,
      message: 'Discount applied successfully',
    });
    
  } catch (error) {
    logger.error('[Audit API] Discount usage failed:', error);
    res.status(500).json({ error: 'Discount usage failed' });
  }
});

/**
 * POST /api/audit/record-biometric-failure
 * Record biometric authentication failure for Protocol 3 compliance
 * 🔒 Authenticated users only (or unauthenticated with email)
 * 
 * CRITICAL for diagnosing WebAuthn/Passkey issues and fraud detection
 */
router.post('/record-biometric-failure', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const schema = z.object({
      errorType: z.string().min(1, { message: "Error type is required" }),
      errorMessage: z.string().optional(),
      deviceId: z.string().optional(),
      isCanceled: z.boolean().default(false),
      authMethod: z.enum(['passkey', 'face_id', 'touch_id', 'windows_hello', 'biometric']).default('passkey'),
      metadata: z.any().optional(),
    });
    
    const validation = schema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        error: 'Validation failed',
        details: validation.error.errors
      });
    }
    
    // User may not be authenticated if biometric login failed before session creation
    const userId = req.firebaseUser?.uid || 'unauthenticated';
    
    // Calculate fraud score based on failure patterns
    let fraudScore = 0;
    const fraudSignals: string[] = [];
    
    // Higher score for non-cancellation errors (potential attack)
    if (!validation.data.isCanceled) {
      fraudScore += 10;
      if (validation.data.errorType === 'SecurityError') {
        fraudScore += 20;
        fraudSignals.push('security_error');
      }
      if (validation.data.errorType === 'NotSupportedError') {
        fraudScore += 5;
        fraudSignals.push('unsupported_device');
      }
    }
    
    // Record in immutable audit ledger
    await AuditLedgerService.recordEvent({
      eventType: 'auth_biometric_failure',
      userId,
      entityType: 'biometric_auth',
      entityId: `biometric_failure_${Date.now()}`,
      action: 'failed',
      newState: {
        errorType: validation.data.errorType,
        errorMessage: validation.data.errorMessage || 'N/A',
        authMethod: validation.data.authMethod,
        isCanceled: validation.data.isCanceled,
        timestamp: new Date().toISOString(),
      },
      metadata: validation.data.metadata,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      deviceId: validation.data.deviceId,
      fraudScore,
      fraudSignals,
    });
    
    logger.info('[Audit API] Biometric failure recorded', {
      userId,
      errorType: validation.data.errorType,
      isCanceled: validation.data.isCanceled,
      fraudScore,
    });
    
    res.json({
      success: true,
      message: 'Biometric failure logged successfully',
      fraudScore,
    });
    
  } catch (error) {
    logger.error('[Audit API] Biometric failure logging failed:', error);
    res.status(500).json({ error: 'Failed to log biometric failure' });
  }
});

export default router;
