/**
 * /api/admin/coworker — AI Coworker family read endpoints (PR-20 scaffold).
 *
 * Hard rules:
 *   - READ-ONLY. No POST / PATCH / DELETE on this router.
 *   - Every endpoint returns the CoworkerOutput shape from
 *     shared/coworker-types.ts. PR-20 returns wired:false for all 6 families
 *     so the UI can be built against the real contract.
 *   - Gate: requireBrainAccess (super-admin email allowlist OR
 *     ceo|cfo|ops_lead role) — same gate as /api/admin/brain. Mount also
 *     applies validateFirebaseToken at the app level.
 *   - DOES NOT touch K9000 runtime, Nayax flow, wallet logic, or Tranzila.
 *   - DOES NOT call Gemini in PR-20. That arrives in PR-21+ per family.
 *
 * Endpoints:
 *   GET /api/admin/coworker/families
 *     → { families: CoworkerFamily[] }
 *   GET /api/admin/coworker/:family/summary
 *     → CoworkerOutput  (wired:false for all families in PR-20)
 */
import { Router, type Request, type Response } from 'express';
import { requireBrainAccess } from '../middleware/requireBrainAccess';
import { logger } from '../lib/logger';
import {
  COWORKER_FAMILIES,
  CoworkerFamilySchema,
  type CoworkerActor,
  type CoworkerFamily,
} from '../../shared/coworker-types';
import {
  coworkerAgentService,
  CoworkerActorFamilyRateLimitError,
  CoworkerDailyBudgetExceededError,
  CoworkerRateLimitError,
} from '../services/CoworkerAgentService';

const router = Router();

// Every route here is sensitive — gate every request, even GETs, since
// the responses surface ops + fraud signals.
router.use(requireBrainAccess);

/**
 * Build a CoworkerActor from the request. Used to thread actor identity into
 * the service layer for rate limiting and audit logging. Tolerant of missing
 * fields — requireBrainAccess guarantees the caller is authenticated, so
 * actorUserId should always be present in practice.
 */
function actorFromRequest(req: Request): CoworkerActor {
  const fbUid = req.firebaseUser?.uid;
  const reqUserId = req.userId;
  const claimRoles = req.firebaseUser?.claims?.roles as string[] | undefined;
  const claimRole = req.firebaseUser?.claims?.role as string | undefined;
  const userRole = (req.user as any)?.role as string | undefined;
  const actorRole = claimRole ?? (Array.isArray(claimRoles) ? claimRoles[0] : undefined) ?? userRole;
  return {
    actorUserId: fbUid ?? reqUserId,
    actorRole,
    ip: req.ip,
    userAgent: req.headers['user-agent']?.slice(0, 500),
    traceId: req.traceId,
  };
}

router.get('/families', (_req: Request, res: Response) => {
  res.json({ families: COWORKER_FAMILIES });
});

router.get('/:family/summary', async (req: Request, res: Response) => {
  const parsed = CoworkerFamilySchema.safeParse(req.params.family);
  if (!parsed.success) {
    return res.status(400).json({
      error: 'unknown_family',
      message: `Unknown coworker family "${req.params.family}". Valid: ${COWORKER_FAMILIES.join(', ')}`,
    });
  }
  const family: CoworkerFamily = parsed.data;
  try {
    const output = await coworkerAgentService.runFamily(family, {
      actor: actorFromRequest(req),
    });
    return res.json(output);
  } catch (err: any) {
    // PR-22: fixed-window per-admin / global rate limit.
    if (err instanceof CoworkerRateLimitError) {
      const retryAfterSec = Math.max(1, Math.ceil(err.retryAfterMs / 1000));
      res.setHeader('Retry-After', String(retryAfterSec));
      return res.status(429).json({
        error: 'rate_limited',
        scope: err.scope,
        message: `Coworker rate limit exceeded (${err.scope}). Retry after ${retryAfterSec}s.`,
        retryAfterSec,
      });
    }
    // PR-21: per-(actor, family) sliding-window rate limit.
    if (err instanceof CoworkerActorFamilyRateLimitError) {
      const retryAfterSec = Math.max(1, Math.ceil(err.retryAfterMs / 1000));
      res.setHeader('Retry-After', String(retryAfterSec));
      return res.status(429).json({
        error: 'rate_limited',
        scope: 'actor_family',
        message: `Coworker rate limit exceeded for family ${family}. Retry after ${retryAfterSec}s.`,
        retryAfterSec,
      });
    }
    // PR-22: daily token budget exhausted.
    if (err instanceof CoworkerDailyBudgetExceededError) {
      return res.status(429).json({
        error: 'daily_budget_exhausted',
        message: `Coworker daily token budget exhausted (used=${err.used}, budget=${err.budget}).`,
        used: err.used,
        budget: err.budget,
        resetAt: err.resetAt,
      });
    }
    logger.error(`[coworker] runFamily(${family}) failed: ${err?.message ?? err}`);
    return res.status(500).json({
      error: 'coworker_run_failed',
      message: 'Failed to run coworker family. See server logs.',
    });
  }
});

export default router;
