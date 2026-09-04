/**
 * GET /api/next-best-action — Journey Brain Phase 4 (Lane C.4).
 *
 * Server projection over composeAttentionFeed + listActiveCheckpoints.
 * Returns ONE canonical `{ primaryAction, secondaryActions }` object
 * the client renders on Pet-Parent or Provider home.
 *
 * Auth: validateFirebaseToken — the uid is server-verified from the
 * session; the body / query never supplies it.
 *
 * The `actor` query param picks pet_parent vs provider; default is
 * pet_parent. `lang=he|en` (default he) selects title/reason locale.
 *
 * Fails-CLOSED to an empty projection on any error — a partial
 * outage never breaks the home surface.
 */
import { Router, type Request, type Response } from 'express';
import { validateFirebaseToken } from '../middleware/firebase-auth';
import { pool } from '../db';
import { composeNextBestAction } from '../services/nextBestAction';
import { logger } from '../lib/logger';
import type { AttentionActor } from '@shared/lib/attentionFeed';

const router = Router();

const VALID_ACTORS: readonly AttentionActor[] = ['pet_parent', 'provider'];

router.get('/', validateFirebaseToken, async (req: Request, res: Response) => {
  const uid = (req as any).firebaseUser?.uid;
  if (!uid) return res.status(401).json({ error: 'AUTH_REQUIRED' });

  const rawActor = String(req.query.actor ?? 'pet_parent');
  const actor: AttentionActor = (VALID_ACTORS as readonly string[]).includes(rawActor)
    ? (rawActor as AttentionActor)
    : 'pet_parent';
  const he = String(req.query.lang ?? 'he') !== 'en';

  try {
    const result = await composeNextBestAction(pool, {
      userUid: uid,
      actor,
      he,
    });
    return res.status(200).json(result);
  } catch (err) {
    logger.warn('[NextBestAction] route handler failed', {
      uid,
      err: (err as Error)?.message,
    });
    return res.status(200).json({
      primaryAction: null,
      secondaryActions: [],
      composedAt: new Date().toISOString(),
    });
  }
});

export default router;
