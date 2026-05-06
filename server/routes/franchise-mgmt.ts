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
import { logAuditEvent } from '../middleware/auditLog';

const router = Router();

router.get('/command-center', requireAdmin, (req: Request, res: Response) => {
  const data = getFranchiseCommandCenter();
  res.json(data);
});

router.post('/quality-audit', requireAdmin, (req: any, res: Response) => {
  const { stationId } = req.body;
  const audit = createQualityAudit(stationId);
  setImmediate(() => {
    logAuditEvent({
      actorUserId: req.firebaseUser?.uid,
      actorRole: 'admin',
      actionType: 'FRANCHISE_QUALITY_AUDIT_CREATE',
      targetType: 'franchise_audit',
      targetId: (audit as any)?.id ?? stationId,
      ip: req.ip,
      userAgent: req.headers['user-agent'] as string | undefined,
      metadata: { stationId },
    }).catch(() => {});
  });
  res.json(audit);
});

router.post('/deploy-update', requireAdmin, (req: any, res: Response) => {
  const update: MandatoryUpdate = req.body;
  const deployment = deployMandatoryUpdate(update);
  setImmediate(() => {
    logAuditEvent({
      actorUserId: req.firebaseUser?.uid,
      actorRole: 'admin',
      actionType: 'FRANCHISE_MANDATORY_UPDATE_DEPLOY',
      targetType: 'franchise_update',
      targetId: (deployment as any)?.id ?? (update as any)?.id ?? 'unknown',
      ip: req.ip,
      userAgent: req.headers['user-agent'] as string | undefined,
      metadata: { updateType: (update as any)?.type, version: (update as any)?.version },
    }).catch(() => {});
  });
  res.json(deployment);
});

router.get('/support', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.firebaseUser!.uid;
    const support = getFranchiseeSupport(userId);
    res.json(support);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get support info' });
  }
});

router.get('/suppliers', (req: Request, res: Response) => {
  res.json(APPROVED_SUPPLIERS);
});

export default router;
