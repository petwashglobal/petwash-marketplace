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
 */
router.get('/support', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.firebaseUser!.uid;
    const support = getFranchiseeSupport(userId);
    res.json(support);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get support info' });
  }
});

/**
 * GET /api/franchise/suppliers - Get approved suppliers list
 */
router.get('/suppliers', (req: Request, res: Response) => {
  res.json(APPROVED_SUPPLIERS);
});

export default router;
