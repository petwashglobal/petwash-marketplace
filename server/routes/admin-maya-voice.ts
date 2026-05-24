/**
 * Maya voice — admin review routes (Stage 3A).
 *
 * Mounted at /api/admin/maya/voice (BEFORE the Stage 2 adminMayaRouter mount
 * so the voice flag gate takes precedence over the Maya master gate — voice
 * review can be controlled independently).
 *
 * Inherits the full /api/admin/* security stack from server/routes.ts:
 *   adminLimiter + verifyAppCheckTokenOptional + optFirebase + ipRiskScoring
 *   + sessionAgeGuard(14400) + adminRouteHardening + requireRole(ADMIN_ROLES)
 *   + requireStaffApproved + requireMfaEnrolled
 *
 * Gates:
 *   ff.maya.voice.enabled (master voice kill switch)
 *
 * Provides READ-ONLY views of phone-channel conversations:
 *   GET /api/admin/maya/voice/calls           — list phone conversations
 *   GET /api/admin/maya/voice/calls/:id       — single call detail
 *
 * Stage 3D extends this with the admin UI to surface transcripts + extracted
 * drafts directly in /admin/maya. Stage 3A only exposes the JSON.
 */
import { Router, type Request, type Response, type NextFunction } from 'express';
import { logger } from '../lib/logger';
import { getFeatureFlag } from '../services/SystemConfig';
import * as Maya from '../services/MayaService';

const router = Router();

function isUuid(v: unknown): v is string {
  return (
    typeof v === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v)
  );
}

function parseLimit(q: unknown, fallback = 50): number {
  const n = Number(q);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.min(Math.floor(n), 200);
}

async function requireVoice(_req: Request, res: Response, next: NextFunction) {
  try {
    const enabled = await getFeatureFlag('ff.maya.voice.enabled');
    if (!enabled) return res.status(503).json({ ok: false, error: 'voice_disabled' });
    next();
  } catch (err) {
    logger.warn({ err }, 'ff.maya.voice.enabled read failed; treating as disabled');
    return res.status(503).json({ ok: false, error: 'voice_disabled' });
  }
}

router.use(requireVoice);

/** GET /api/admin/maya/voice/calls — list phone conversations (read-only). */
router.get('/calls', async (req: Request, res: Response) => {
  const limit = parseLimit(req.query.limit);
  const status = typeof req.query.status === 'string' ? (req.query.status as string) : undefined;
  try {
    const rows = await Maya.listConversations({ channel: 'phone', status, limit });
    res.json({ ok: true, calls: rows });
  } catch (err) {
    logger.error({ err }, 'maya voice listCalls failed');
    res.status(500).json({ ok: false, error: 'internal_error' });
  }
});

/** GET /api/admin/maya/voice/calls/:id — single call detail (read-only). */
router.get('/calls/:id', async (req: Request, res: Response) => {
  if (!isUuid(req.params.id)) {
    return res.status(400).json({ ok: false, error: 'invalid_id' });
  }
  const conv = await Maya.getConversation(req.params.id);
  if (!conv) return res.status(404).json({ ok: false, error: 'not_found' });
  // Enforce: this endpoint is for phone conversations only. A web conversation
  // ID returned here would be confusing — Stage 2's /conversations/:id exists
  // for that case.
  if (conv.channel !== 'phone') {
    return res.status(404).json({ ok: false, error: 'not_a_phone_call' });
  }
  res.json({ ok: true, call: conv });
});

export default router;
