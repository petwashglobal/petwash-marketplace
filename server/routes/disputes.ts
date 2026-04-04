/**
 * Phase 8 — Booking Disputes
 * POST /api/disputes              — customer submits a dispute / report problem
 * GET  /api/disputes/admin        — admin list (all disputes)
 * GET  /api/disputes/my           — customer's own disputes
 * PATCH /api/disputes/:id/resolve — admin resolves a dispute
 */

import { Router, Request, Response } from 'express';
import { db } from '../db';
import { bookingDisputes } from '@shared/schema';
import { eq, desc, and } from 'drizzle-orm';
import { auth } from '../lib/firebase-admin';
import { logger } from '../lib/logger';

const router = Router();

// SUPER_ADMIN_UID is loaded from environment to avoid hardcoding credentials in source code.
// If not set, admin operations fail closed (return 403) rather than open.
const SUPER_ADMIN_UID = process.env.SUPER_ADMIN_UID || '';

async function requireAuth(req: Request, res: Response): Promise<string | null> {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Authentication required' });
    return null;
  }
  try {
    const token = authHeader.split('Bearer ')[1];
    const decoded = await auth.verifyIdToken(token, true);
    return decoded.uid;
  } catch {
    res.status(401).json({ error: 'Invalid token' });
    return null;
  }
}

const DISPUTE_REASONS = [
  'service_not_received',
  'poor_quality',
  'wrong_service',
  'no_show',
  'damage',
  'safety_concern',
  'other',
] as const;

// POST /api/disputes
router.post('/', async (req: Request, res: Response) => {
  try {
    const uid = await requireAuth(req, res);
    if (!uid) return;

    const { bookingId, bookingType = 'marketplace', reason, description } = req.body;

    if (!bookingId || !reason) {
      return res.status(400).json({ error: 'bookingId and reason are required' });
    }
    if (!DISPUTE_REASONS.includes(reason)) {
      return res.status(400).json({
        error: `reason must be one of: ${DISPUTE_REASONS.join(', ')}`,
      });
    }

    const [dispute] = await db.insert(bookingDisputes).values({
      bookingId,
      bookingType,
      customerId: uid,
      reason,
      description: description || null,
      status: 'open',
    }).returning();

    logger.info('[Disputes] Dispute created', {
      disputeId: dispute.id,
      bookingId,
      reason,
      uid,
    });

    res.status(201).json({ success: true, dispute: { id: dispute.id, status: dispute.status } });
  } catch (error: any) {
    logger.error('[Disputes] Submit error', error);
    res.status(500).json({ error: error.message || 'Failed to submit dispute' });
  }
});

// GET /api/disputes/my
router.get('/my', async (req: Request, res: Response) => {
  try {
    const uid = await requireAuth(req, res);
    if (!uid) return;

    const disputes = await db.select()
      .from(bookingDisputes)
      .where(eq(bookingDisputes.customerId, uid))
      .orderBy(desc(bookingDisputes.createdAt))
      .limit(20);

    res.json({ success: true, disputes });
  } catch (error: any) {
    logger.error('[Disputes] My disputes error', error);
    res.status(500).json({ error: 'Failed to fetch disputes' });
  }
});

// GET /api/disputes/admin
router.get('/admin', async (req: Request, res: Response) => {
  try {
    const uid = await requireAuth(req, res);
    if (!uid) return;
    if (uid !== SUPER_ADMIN_UID) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { status } = req.query;
    const conditions = status
      ? [eq(bookingDisputes.status, status as string)]
      : [];

    const disputes = await db.select()
      .from(bookingDisputes)
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(bookingDisputes.createdAt))
      .limit(100);

    res.json({ success: true, disputes, total: disputes.length });
  } catch (error: any) {
    logger.error('[Disputes] Admin list error', error);
    res.status(500).json({ error: 'Failed to fetch disputes' });
  }
});

// PATCH /api/disputes/:id/resolve
router.patch('/:id/resolve', async (req: Request, res: Response) => {
  try {
    const uid = await requireAuth(req, res);
    if (!uid) return;
    if (uid !== SUPER_ADMIN_UID) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { id } = req.params;
    const { status, adminNotes } = req.body;

    const validStatuses = ['open', 'under_review', 'resolved', 'dismissed'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: `status must be one of: ${validStatuses.join(', ')}` });
    }

    const [updated] = await db.update(bookingDisputes)
      .set({
        status,
        adminNotes: adminNotes || null,
        resolvedBy: uid,
        resolvedAt: ['resolved', 'dismissed'].includes(status) ? new Date() : null,
      })
      .where(eq(bookingDisputes.id, id))
      .returning();

    if (!updated) {
      return res.status(404).json({ error: 'Dispute not found' });
    }

    logger.info('[Disputes] Dispute resolved', { disputeId: id, status, resolvedBy: uid });
    res.json({ success: true, dispute: updated });
  } catch (error: any) {
    logger.error('[Disputes] Resolve error', error);
    res.status(500).json({ error: 'Failed to resolve dispute' });
  }
});

export default router;
