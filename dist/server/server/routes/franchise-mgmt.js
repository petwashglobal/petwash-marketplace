import { Router } from 'express';
import { getFranchiseCommandCenter, createQualityAudit, deployMandatoryUpdate, getFranchiseeSupport, APPROVED_SUPPLIERS } from '../utils/franchiseControls';
import { requireAdmin } from '../middleware/rbac';
const router = Router();
/**
 * GET /api/franchise/command-center - Get real-time franchise dashboard
 */
router.get('/command-center', requireAdmin, (req, res) => {
    const data = getFranchiseCommandCenter();
    res.json(data);
});
/**
 * POST /api/franchise/quality-audit - Create quality audit
 */
router.post('/quality-audit', requireAdmin, (req, res) => {
    const { stationId } = req.body;
    const audit = createQualityAudit(stationId);
    res.json(audit);
});
/**
 * POST /api/franchise/deploy-update - Deploy mandatory update
 */
router.post('/deploy-update', requireAdmin, (req, res) => {
    const update = req.body;
    const deployment = deployMandatoryUpdate(update);
    res.json(deployment);
});
/**
 * GET /api/franchise/support - Get franchisee support info
 */
router.get('/support', async (req, res) => {
    try {
        const userId = req.firebaseUser.uid;
        const support = getFranchiseeSupport(userId);
        res.json(support);
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to get support info' });
    }
});
/**
 * GET /api/franchise/suppliers - Get approved suppliers list
 */
router.get('/suppliers', (req, res) => {
    res.json(APPROVED_SUPPLIERS);
});
export default router;
