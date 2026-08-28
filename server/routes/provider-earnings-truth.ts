/**
 * GET /api/provider/earnings-truth
 *
 * The canonical "what did I earn, what will I get, when?" projection
 * for a provider (CEO 2026-08-26 §17, §31). READ-ONLY.
 *
 * Coexists with the existing /api/provider-dashboard/v2/earnings
 * summary — that endpoint returns ILS floats + weekly bars for the
 * chart; this endpoint returns cents + the four canonical buckets
 * (expected / pending / available / paid) for the "your money" card.
 */

import { Router, type Request, type Response } from 'express';
import { composeProviderEarnings } from '../services/providerEarnings';
import { logger } from '../lib/logger';

const router = Router();

router.get('/earnings-truth', async (req: Request, res: Response) => {
  const uid = (req as any).firebaseUser?.uid || (req as any).user?.uid || null;
  if (!uid) return res.status(401).json({ ok: false, error: 'auth_required' });
  try {
    const truth = await composeProviderEarnings(uid);
    return res.json({ ok: true, earnings: truth });
  } catch (err: any) {
    logger.error('[ProviderEarningsTruth] compose error', { err: String(err?.message ?? err) });
    return res.status(500).json({ ok: false, error: 'earnings_error' });
  }
});

export default router;
