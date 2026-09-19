/**
 * Israel Compliance Engine — admin read route
 *
 * GET /api/admin/finance/israel-compliance/policy
 *   Returns the current policy configuration snapshot (VAT rate, agent model,
 *   Osek Patur policy, withholding rate policy, SHAAM thresholds).
 *   Useful for finance dashboards and audit trails.
 *   All fields pending CPA sign-off are clearly flagged.
 *
 * GET /api/admin/finance/israel-compliance/reconcile/:bookingId
 *   Runs a per-booking compliance check and returns any discrepancies.
 */

import { Router } from 'express';
import { callerRole } from '../../lib/callerRole';
import { IsraelComplianceEngine } from '../../services/IsraelComplianceEngine';
import { timingSafeAdminSecretMatch } from '../../middleware/adminAuth';
import { logger } from '../../lib/logger';
import { sendSanitizedError } from '../../lib/sanitizeErrorResponse';

const router = Router();

function isAdmin(req: any): boolean {
  if (timingSafeAdminSecretMatch(req)) return true;
  // 2026-09-19: was read off the request user object — a field nothing ever assigns, so this
  // denied every authenticated caller including the super admin. See lib/callerRole.ts.
  const role = callerRole(req);
  return ['super_admin', 'finance'].includes(role);
}

/**
 * GET /api/admin/finance/israel-compliance/policy
 * Returns the live compliance policy snapshot with all CPA-pending flags.
 */
router.get('/policy', (req, res) => {
  if (!isAdmin(req)) return res.status(403).json({ error: 'Admin only' });

  const snapshot = IsraelComplianceEngine.getPolicySnapshot();
  logger.info('[IsraelCompliance] Policy snapshot requested', { requester: (req as any).user?.uid });
  return res.status(200).json({ success: true, policy: snapshot });
});

/**
 * GET /api/admin/finance/israel-compliance/reconcile/:bookingId
 * Runs a single-booking compliance reconciliation check.
 */
router.get('/reconcile/:bookingId', async (req, res) => {
  if (!isAdmin(req)) return res.status(403).json({ error: 'Admin only' });

  const { bookingId } = req.params;
  if (!bookingId) return res.status(400).json({ error: 'bookingId required' });

  try {
    const result = await IsraelComplianceEngine.reconcileBooking(bookingId);
    logger.info('[IsraelCompliance] Per-booking reconciliation run', {
      bookingId,
      status: result.status,
      discrepancyCount: result.discrepancies.length,
    });
    return res.status(200).json({ success: true, ...result });
  } catch (err: any) {
    logger.error('[IsraelCompliance] reconcile error', { bookingId, error: err.message });
    return sendSanitizedError(res, err, 'ISRAEL_COMPLIANCE_RECONCILE_FAILED', { logContext: { op: 'reconcile', bookingId } });
  }
});

export default router;
