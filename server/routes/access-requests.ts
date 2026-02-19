import { Router } from 'express';
import { storage } from '../storage';
import { logger } from '../lib/logger';
import { requireAuth } from '../customAuth';

const router = Router();

const SUPER_ADMINS = [
  'nirhadad1@gmail.com',
  'nir.h@petwash.co.il',
  'ido.s@petwash.co.il',
  'idoshaka@gmail.com',
  'idoshakarzi110@gmail.com',
];

function isSuperAdmin(email: string | undefined): boolean {
  if (!email) return false;
  return SUPER_ADMINS.includes(email.toLowerCase());
}

router.get('/mine', requireAuth, async (req, res) => {
  try {
    const userId = req.firebaseUser?.uid;
    if (!userId) return res.status(401).json({ error: 'Not authenticated' });

    const request = await storage.getStaffAccessRequestByUser(userId);
    res.json({ request: request || null });
  } catch (error) {
    logger.error('[Access Requests] Error fetching user request', { error });
    res.status(500).json({ error: 'Failed to fetch access request' });
  }
});

router.post('/', requireAuth, async (req, res) => {
  try {
    const userId = req.firebaseUser?.uid;
    if (!userId) return res.status(401).json({ error: 'Not authenticated' });

    const { requestedRole } = req.body;

    if (requestedRole === 'admin') {
      return res.status(403).json({ error: 'Cannot request admin role from public interface' });
    }

    if (requestedRole !== 'staff') {
      return res.status(400).json({ error: 'Only staff role can be requested' });
    }

    const existing = await storage.getStaffAccessRequestByUser(userId);
    if (existing && existing.status === 'pending') {
      return res.status(409).json({ error: 'You already have a pending access request', request: existing });
    }

    const request = await storage.createStaffAccessRequest({
      userId,
      requestedRole,
      status: 'pending',
    });

    logger.info('[Access Requests] New staff access request created', { userId, requestedRole });
    res.status(201).json({ request });
  } catch (error) {
    logger.error('[Access Requests] Error creating request', { error });
    res.status(500).json({ error: 'Failed to create access request' });
  }
});

router.get('/', requireAuth, async (req, res) => {
  try {
    const email = req.firebaseUser?.email;
    if (!isSuperAdmin(email)) {
      return res.status(403).json({ error: 'Super admin access required' });
    }

    const requests = await storage.getAllStaffAccessRequests();
    res.json({ requests });
  } catch (error) {
    logger.error('[Access Requests] Error listing requests', { error });
    res.status(500).json({ error: 'Failed to list access requests' });
  }
});

router.post('/:id/approve', requireAuth, async (req, res) => {
  try {
    const email = req.firebaseUser?.email;
    if (!isSuperAdmin(email)) {
      return res.status(403).json({ error: 'Super admin access required' });
    }

    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid request ID' });

    const updated = await storage.updateStaffAccessRequest(id, {
      status: 'approved',
      decidedAt: new Date(),
      decidedBy: email!,
    });

    try {
      await storage.updateUser(updated.userId, {
        role: 'staff',
        accessLevel: 4,
        approvedBy: email!,
        approvedAt: new Date(),
      });
    } catch (userErr) {
      logger.error('[Access Requests] Failed to update user role after approval', { userErr, userId: updated.userId });
    }

    logger.info('[Access Requests] Request approved', { id, decidedBy: email });
    res.json({ request: updated });
  } catch (error) {
    logger.error('[Access Requests] Error approving request', { error });
    res.status(500).json({ error: 'Failed to approve request' });
  }
});

router.post('/:id/deny', requireAuth, async (req, res) => {
  try {
    const email = req.firebaseUser?.email;
    if (!isSuperAdmin(email)) {
      return res.status(403).json({ error: 'Super admin access required' });
    }

    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid request ID' });

    const { reason } = req.body || {};

    const updated = await storage.updateStaffAccessRequest(id, {
      status: 'rejected',
      decidedAt: new Date(),
      decidedBy: email!,
      reason: reason || null,
    });

    logger.info('[Access Requests] Request denied', { id, decidedBy: email, reason });
    res.json({ request: updated });
  } catch (error) {
    logger.error('[Access Requests] Error denying request', { error });
    res.status(500).json({ error: 'Failed to deny request' });
  }
});

export default router;
