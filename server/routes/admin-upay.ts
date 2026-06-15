/**
 * Admin UPay — read-only activation/health surface.
 *
 *   GET /api/admin/upay/health
 *     Reports whether UPAY_API_KEY is present (boolean only — NEVER the value),
 *     the endpoint, a LIVE reachability probe of UPay's host, and whether charge
 *     is ready (it isn't until the API6 msg/encryption spec is implemented).
 *
 * Super-admin gated. This is the "is my UPay wired?" inspector — the page Nir
 * can hit after a deploy to confirm the key landed without exposing its value.
 */

import { Router, type Request, type Response, type NextFunction } from 'express';
import { validateFirebaseToken } from '../middleware/firebase-auth';
import { loadUserRole, checkAccessLevel, isSuperAdminVerified } from '../middleware/rbac';
import { upayProvider } from '../services/payment-providers/UpayProvider';
import { logger } from '../lib/logger';

const router = Router();

function requireSuperAdminGate(req: Request, res: Response, next: NextFunction) {
  if (!isSuperAdminVerified(req)) {
    return res.status(404).json({ error: 'Not found' });
  }
  next();
}

const requireSuperAdmin = [
  validateFirebaseToken,
  loadUserRole,
  checkAccessLevel(8),
  requireSuperAdminGate,
];

router.get('/health', ...requireSuperAdmin, async (_req: Request, res: Response) => {
  try {
    const health = upayProvider.health();
    const reach = await upayProvider.checkReachability();
    return res.json({
      provider: 'upay',
      // booleans + facts only — the key value is never read or returned
      ...health,
      reachable: reach.reachable,
      reachStatus: reach.status ?? null,
      reachError: reach.error ?? null,
      nextStep: health.chargeReady
        ? 'Charge-ready.'
        : health.configured
          ? 'Key is wired. To enable charging: obtain UPay API6 msg/encryption spec, implement buildEncryptedMsg(), flip isChargeReady().'
          : 'Set UPAY_API_KEY in the environment (GCP Secret Manager → Cloud Run).',
    });
  } catch (err: any) {
    logger.error('[AdminUpay] health failed', err);
    return res.status(500).json({ error: 'Health check failed' });
  }
});

export default router;
