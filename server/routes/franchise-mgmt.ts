import { Router, type Request, type Response } from 'express';
import { 
  getFranchiseCommandCenter,
  createQualityAudit,
  deployMandatoryUpdate,
  getFranchiseeSupport,
  APPROVED_SUPPLIERS,
  type MandatoryUpdate 
} from '../utils/franchiseControls';
import type { AuthenticatedRequest } from '../middleware/rbac';
import { requireAdmin } from '../middleware/rbac';

const router = Router();

/**
 * GET /api/franchise/command-center - Get real-time franchise dashboard
 */
router.get('/command-center', requireAdmin, (req: Request, res: Response) => {
  const data = getFranchiseCommandCenter();
  res.json(data);
});

/**
 * POST /api/franchise/quality-audit - Create quality audit
 */
router.post('/quality-audit', requireAdmin, (req: Request, res: Response) => {
  const { stationId } = req.body;
  const audit = createQualityAudit(stationId);
  res.json(audit);
});

/**
 * POST /api/franchise/deploy-update - Deploy mandatory update
 */
router.post('/deploy-update', requireAdmin, (req: Request, res: Response) => {
  const update: MandatoryUpdate = req.body;
  const deployment = deployMandatoryUpdate(update);
  res.json(deployment);
});

/**
 * GET /api/franchise/support - Get franchisee support info
 *
 * FRANCHISE-SUPPORT-AUTH-FIX (2026-08-23 auth-audit HIGH #6):
 * Pre-fix this route had NO auth middleware but dereferenced
 * `req.firebaseUser!.uid` — the non-null assertion on an undefined
 * object → TypeError → 500 for every call. Any franchisee opening
 * the support pane saw a broken screen that read as "session lost".
 * Now gated by requireAdmin (same as every sibling franchise-mgmt
 * route above) so the assertion is provably safe. Also switched the
 * inner uid-read to optional chaining so a future middleware swap
 * cannot re-crash it silently.
 */
router.get('/support', requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.firebaseUser?.uid;
    if (!userId) {
      // Belt-and-braces: requireAdmin above should always set this,
      // but if a future auth refactor breaks that invariant we return
      // 401 instead of TypeError-crashing the request.
      return res.status(401).json({ error: 'Authentication required' });
    }
    const support = getFranchiseeSupport(userId);
    res.json(support);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get support info' });
  }
});

/**
 * GET /api/franchise/suppliers - Get approved suppliers list
 */
router.get('/suppliers', requireAdmin, (req: Request, res: Response) => {
  // Also gated: approved-supplier list carries commercial-relationship
  // info (SLAs, discount tiers, minimum-order quantities) that isn't for
  // the public. Every sibling route in this file is admin-gated; this
  // one was inconsistent.
  res.json(APPROVED_SUPPLIERS);
});

export default router;
