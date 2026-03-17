/**
 * POST /api/admin/finance/adjustment
 *
 * Manual financial adjustment — admin only.
 * Every adjustment is permanently recorded in pw_payments + pw_tax_documents.
 * No record is ever deleted: use negative adjustment to correct a positive one.
 *
 * Required headers: x-admin-secret OR valid Firebase session with super_admin role.
 */

import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../../customAuth';
import { processManualAdjustment } from '../../services/TransactionEngine';
import { ImmutableStampService } from '../../services/ImmutableStampService';
import { logger } from '../../lib/logger';
import { timingSafeAdminSecretMatch } from '../../middleware/adminAuth';

const router = Router();

const adjustmentSchema = z.object({
  adjustmentCents: z.number().int().refine(n => n !== 0, 'adjustmentCents must be non-zero'),
  reason: z.string().min(5, 'reason must be at least 5 characters'),
  customerId: z.string().optional(),
  providerId: z.string().optional(),
  relatedPaymentId: z.string().optional(),
  notes: z.string().optional(),
});

router.post('/', requireAuth, async (req, res) => {
  try {
    // Role check — super_admin or finance role only
    const role = (req.user as any)?.role ?? (req.user as any)?.customClaims?.role;
    const isAdminSecret = timingSafeAdminSecretMatch(req);
    const isAuthorizedRole = ['super_admin', 'finance'].includes(role);

    if (!isAdminSecret && !isAuthorizedRole) {
      logger.warn('[ManualAdjustment] Unauthorised attempt', {
        uid: (req.user as any)?.uid,
        role,
        ip: req.ip,
      });
      return res.status(403).json({ error: 'Insufficient permissions for manual adjustments' });
    }

    const parsed = adjustmentSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
    }

    const adjustedBy = (req.user as any)?.uid ?? 'admin-secret';

    const result = await processManualAdjustment({
      ...parsed.data,
      adjustedBy,
    });

    // Immutable audit stamp — cannot be altered or deleted
    await ImmutableStampService.stamp({
      entityType: 'manual_adjustment',
      entityId: result.adjustmentPaymentId,
      action: 'MANUAL_ADJUSTMENT_ISSUED',
      actorId: adjustedBy,
      data: {
        ...parsed.data,
        adjustmentPaymentId: result.adjustmentPaymentId,
        taxDocId: result.taxDocId,
      },
    });

    logger.info('[ManualAdjustment] Adjustment recorded', {
      adjustmentPaymentId: result.adjustmentPaymentId,
      taxDocId: result.taxDocId,
      adjustedBy,
      reason: parsed.data.reason,
    });

    return res.status(201).json({
      success: true,
      adjustmentPaymentId: result.adjustmentPaymentId,
      taxDocId: result.taxDocId,
      message: 'Adjustment recorded and audited',
    });
  } catch (err: any) {
    logger.error('[ManualAdjustment] Error', { err: err.message, ip: req.ip });
    return res.status(500).json({ error: 'Adjustment failed', detail: err.message });
  }
});

export default router;
