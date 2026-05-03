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
  type CoworkerFamily,
} from '../../shared/coworker-types';
import { coworkerAgentService } from '../services/CoworkerAgentService';

const router = Router();

// Every route here is sensitive — gate every request, even GETs, since
// the responses surface ops + fraud signals.
router.use(requireBrainAccess);

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
    const output = await coworkerAgentService.runFamily(family);
    return res.json(output);
  } catch (err: any) {
    logger.error(`[coworker] runFamily(${family}) failed: ${err?.message ?? err}`);
    return res.status(500).json({
      error: 'coworker_run_failed',
      message: 'Failed to run coworker family. See server logs.',
    });
  }
});

export default router;
