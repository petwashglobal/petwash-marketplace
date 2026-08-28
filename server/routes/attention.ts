/**
 * GET /api/attention/pet-parent
 * GET /api/attention/provider
 *
 * The "what needs my attention" projection for each workspace home.
 * READ-ONLY. Firebase-authed. Never mutates.
 */

import { Router, type Request, type Response } from 'express';
import { composeAttentionFeed } from '../services/attentionFeed';
import { logger } from '../lib/logger';

const router = Router();

function callerUid(req: Request): string | null {
  return (req as any).firebaseUser?.uid || (req as any).user?.uid || null;
}

function callerHebrew(req: Request): boolean {
  const langHeader = String(req.headers['accept-language'] || '').toLowerCase();
  const bodyLang = String((req as any).query?.lang || '').toLowerCase();
  return bodyLang === 'he' || langHeader.startsWith('he');
}

router.get('/pet-parent', async (req: Request, res: Response) => {
  const uid = callerUid(req);
  if (!uid) return res.status(401).json({ ok: false, error: 'auth_required' });
  try {
    const feed = await composeAttentionFeed('pet_parent', uid, callerHebrew(req));
    return res.json({ ok: true, feed });
  } catch (err: any) {
    logger.error('[Attention] pet-parent compose error', { err: String(err?.message ?? err) });
    return res.status(500).json({ ok: false, error: 'attention_error' });
  }
});

router.get('/provider', async (req: Request, res: Response) => {
  const uid = callerUid(req);
  if (!uid) return res.status(401).json({ ok: false, error: 'auth_required' });
  try {
    const feed = await composeAttentionFeed('provider', uid, callerHebrew(req));
    return res.json({ ok: true, feed });
  } catch (err: any) {
    logger.error('[Attention] provider compose error', { err: String(err?.message ?? err) });
    return res.status(500).json({ ok: false, error: 'attention_error' });
  }
});

export default router;
