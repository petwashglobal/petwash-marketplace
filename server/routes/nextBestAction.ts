/**
 * GET /api/next-best-action/pet-parent
 * GET /api/next-best-action/provider
 *
 * NextBestAction — CEO MASTER DIRECTIVE 2026-08-28 §36 §65.
 *
 * Structured code decides WHAT ACTION exists.
 * READ-ONLY. Firebase-authed. Never mutates. Never invokes an LLM.
 */

import { Router, type Request, type Response } from 'express';
import { composeNextBestActionFeed } from '../services/nextBestAction';
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
    const feed = await composeNextBestActionFeed('pet_parent', uid, callerHebrew(req));
    return res.json({ ok: true, feed });
  } catch (err: any) {
    logger.error('[NextBestAction] pet-parent compose error', { err: String(err?.message ?? err) });
    return res.status(500).json({ ok: false, error: 'nba_error' });
  }
});

router.get('/provider', async (req: Request, res: Response) => {
  const uid = callerUid(req);
  if (!uid) return res.status(401).json({ ok: false, error: 'auth_required' });
  try {
    const feed = await composeNextBestActionFeed('provider', uid, callerHebrew(req));
    return res.json({ ok: true, feed });
  } catch (err: any) {
    logger.error('[NextBestAction] provider compose error', { err: String(err?.message ?? err) });
    return res.status(500).json({ ok: false, error: 'nba_error' });
  }
});

export default router;
