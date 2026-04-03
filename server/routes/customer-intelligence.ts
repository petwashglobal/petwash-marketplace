/**
 * CUSTOMER INTELLIGENCE API ROUTES
 * PETWASH SYSTEM INTELLIGENCE SPEC — Customer Trust, Behavior & Journey State
 *
 * GET  /api/user/intelligence          — own trust/behavior profile
 * POST /api/user/journey-state         — advance journey state
 * GET  /api/user/journey-state         — get current state
 * GET  /api/admin/users/:uid/intelligence — admin view of any user's profile
 */

import { Router } from 'express';
import { db } from '../db';
import { users, userIntelligenceProfiles } from '../../shared/schema';
import { eq } from 'drizzle-orm';
import { logger } from '../lib/logger';
import {
  getOrCreateIntelligenceProfile,
  recomputeCustomerProfile,
  advanceJourneyState,
  type CustomerJourneyState,
} from '../services/CustomerIntelligenceService';

const router = Router();

const VALID_JOURNEY_STATES: CustomerJourneyState[] = [
  'visitor', 'browsing', 'authenticated', 'ready_to_book', 'booked',
];

// ── GET /api/user/intelligence ───────────────────────────────────────────────
router.get('/intelligence', async (req, res) => {
  try {
    const uid = req.user?.uid ?? (req as any).firebaseUser?.uid;
    if (!uid) return res.status(401).json({ error: 'Unauthorized' });

    const [user] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.id, uid))
      .limit(1);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const profile = await getOrCreateIntelligenceProfile(uid, 'customer');
    return res.json({ profile });
  } catch (err: any) {
    logger.error('[CustomerIntelligence] GET /intelligence error', { err: err.message });
    return res.status(500).json({ error: 'Failed to load intelligence profile' });
  }
});

// ── GET /api/user/journey-state ──────────────────────────────────────────────
router.get('/journey-state', async (req, res) => {
  try {
    const uid = req.user?.uid ?? (req as any).firebaseUser?.uid;
    if (!uid) return res.status(401).json({ error: 'Unauthorized' });

    const [user] = await db
      .select({ journeyState: users.journeyState })
      .from(users)
      .where(eq(users.id, uid))
      .limit(1);

    if (!user) return res.status(404).json({ error: 'User not found' });

    return res.json({ journeyState: user.journeyState ?? 'visitor' });
  } catch (err: any) {
    logger.error('[CustomerIntelligence] GET /journey-state error', { err: err.message });
    return res.status(500).json({ error: 'Failed to get journey state' });
  }
});

// ── POST /api/user/journey-state ─────────────────────────────────────────────
router.post('/journey-state', async (req, res) => {
  try {
    const uid = req.user?.uid ?? (req as any).firebaseUser?.uid;
    if (!uid) return res.status(401).json({ error: 'Unauthorized' });

    const { state } = req.body;
    if (!state || !VALID_JOURNEY_STATES.includes(state)) {
      return res.status(400).json({
        error: `Invalid state. Valid states: ${VALID_JOURNEY_STATES.join(', ')}`,
      });
    }

    await advanceJourneyState(uid, state as CustomerJourneyState);

    const [updated] = await db
      .select({ journeyState: users.journeyState })
      .from(users)
      .where(eq(users.id, uid))
      .limit(1);

    return res.json({ journeyState: updated?.journeyState ?? state });
  } catch (err: any) {
    logger.error('[CustomerIntelligence] POST /journey-state error', { err: err.message });
    return res.status(500).json({ error: 'Failed to update journey state' });
  }
});

// ── POST /api/user/intelligence/recompute ────────────────────────────────────
router.post('/intelligence/recompute', async (req, res) => {
  try {
    const uid = req.user?.uid ?? (req as any).firebaseUser?.uid;
    if (!uid) return res.status(401).json({ error: 'Unauthorized' });

    await recomputeCustomerProfile(uid);
    const profile = await getOrCreateIntelligenceProfile(uid);
    return res.json({ profile });
  } catch (err: any) {
    logger.error('[CustomerIntelligence] POST /intelligence/recompute error', { err: err.message });
    return res.status(500).json({ error: 'Failed to recompute intelligence profile' });
  }
});

// ── Admin: GET /api/admin/users/:uid/intelligence ────────────────────────────
export const adminIntelligenceRouter = Router();

adminIntelligenceRouter.get('/:uid/intelligence', async (req, res) => {
  try {
    const callerUid = req.user?.uid ?? (req as any).firebaseUser?.uid;
    if (!callerUid) return res.status(401).json({ error: 'Unauthorized' });

    const { uid } = req.params;

    const [userRow] = await db
      .select({ id: users.id, journeyState: users.journeyState })
      .from(users)
      .where(eq(users.id, uid))
      .limit(1);

    if (!userRow) return res.status(404).json({ error: 'User not found' });

    const profile = await getOrCreateIntelligenceProfile(uid);
    return res.json({
      userId: uid,
      journeyState: userRow.journeyState ?? 'visitor',
      profile,
    });
  } catch (err: any) {
    logger.error('[CustomerIntelligence] Admin GET /:uid/intelligence error', { err: err.message });
    return res.status(500).json({ error: 'Failed to load user intelligence' });
  }
});

export default router;
