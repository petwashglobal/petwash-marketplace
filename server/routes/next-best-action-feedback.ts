/**
 * POST /api/next-best-action/feedback — Journey Brain Phase 6
 * (post-release 2026-09-04, step 2/2 of the telemetry surface).
 *
 * Records ONE user verdict per tap on a NextBestActionCard action.
 * The composer follow-up will read this table to suppress an
 * action_key that got a "not_interested" verdict inside a cooldown
 * window — CEO §24 §60 (adaptive, no dark patterns).
 *
 * Auth: validateFirebaseToken — uid ALWAYS from the verified
 * session, NEVER from the body/query/header.
 *
 * Body:
 *   { actionKey: string, verdict: 'act' | 'dismiss' |
 *                                 'not_interested' | 'fewer_like_this' }
 *
 * Responses:
 *   200 { ok: true, id }              — recorded
 *   400 { error: '<TYPED>' }          — invalid input
 *   401 { error: 'AUTH_REQUIRED' }    — no verified session
 *   500 { error: 'INTERNAL' }         — unexpected pool error;
 *                                       the pg detail NEVER leaks
 */
import { Router, type Request, type Response } from 'express';
import { validateFirebaseToken } from '../middleware/firebase-auth';
import { pool } from '../db';
import {
  recordFeedback,
  isValidVerdict,
  type FeedbackVerdict,
} from '../services/nextBestActionFeedback';
import { logger } from '../lib/logger';

const router = Router();

const MAX_ACTION_KEY_LEN = 200;

router.post('/', validateFirebaseToken, async (req: Request, res: Response) => {
  const uid = (req as any).firebaseUser?.uid;
  if (!uid) return res.status(401).json({ error: 'AUTH_REQUIRED' });

  const body = (req.body ?? {}) as { actionKey?: unknown; verdict?: unknown };
  const actionKey = typeof body.actionKey === 'string' ? body.actionKey : '';
  const verdict = body.verdict;

  if (!actionKey) return res.status(400).json({ error: 'MISSING_ACTION_KEY' });
  if (actionKey.length > MAX_ACTION_KEY_LEN) {
    return res.status(400).json({ error: 'ACTION_KEY_TOO_LONG' });
  }
  if (!isValidVerdict(verdict)) {
    return res.status(400).json({ error: 'INVALID_VERDICT' });
  }

  try {
    const out = await recordFeedback(pool, {
      userUid: uid,
      actionKey,
      verdict: verdict as FeedbackVerdict,
    });
    return res.status(200).json({ ok: true, id: out.id });
  } catch (err) {
    const msg = (err as Error)?.message ?? '';
    // Typed errors from the service surface as 400 with the same
    // code the client can act on.
    if (
      msg === 'MISSING_USER_UID' ||
      msg === 'MISSING_ACTION_KEY' ||
      msg === 'ACTION_KEY_TOO_LONG' ||
      msg === 'INVALID_VERDICT'
    ) {
      return res.status(400).json({ error: msg });
    }
    logger.warn('[NextBestActionFeedback] route handler failed', {
      uid,
      err: msg,
    });
    return res.status(500).json({ error: 'INTERNAL' });
  }
});

export default router;
