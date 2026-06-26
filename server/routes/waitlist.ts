/**
 * Universal Waitlist / demand-capture API (CEO "no dead pages" spec).
 *
 * POST /api/waitlist — public capture. Works for logged-in users (records their
 * Firebase UID) AND anonymous visitors (guestId). Every "coming soon" / "notify
 * me" / "request this" / "service not in my city" surface posts here so demand
 * becomes a row instead of a dead page. Backed by waitlist_entries (mig 0080).
 *
 * Mounted with optionalFirebaseToken (auth optional) and MUST be CSRF-exempt in
 * server/index.ts (public anonymous POST — see csrf-public-post-regression class).
 */
import { Router, type Request, type Response } from 'express';
import { db } from '../db';
import { waitlistEntries, createWaitlistEntrySchema, WAITLIST_STATUSES } from '../../shared/schema-waitlist';
import { logger } from '../lib/logger';
import { requireAdmin } from '../adminAuth';
import { and, desc, eq } from 'drizzle-orm';

const router = Router();

// POST /api/waitlist — register interest (logged-in OR anonymous).
router.post('/', async (req: Request, res: Response) => {
  try {
    const data = createWaitlistEntrySchema.parse(req.body);

    if (!data.consentToContact) {
      return res.status(400).json({
        error: 'CONSENT_REQUIRED',
        message: 'Please agree to be contacted about this service.',
      });
    }

    const uid = (req as any).firebaseUser?.uid || (req as any).user?.uid || null;
    const guestId = uid
      ? null
      : (typeof req.body.guestId === 'string' && req.body.guestId)
        || `guest_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

    const [row] = await db.insert(waitlistEntries).values({
      ...data,
      userId: uid,
      guestId,
      sourcePage: data.sourcePage || (req.headers['referer'] as string | undefined) || null,
    }).returning({ id: waitlistEntries.id });

    logger.info('[Waitlist] entry created', {
      id: row?.id, platform: data.platformKey, interest: data.interestType, hasUser: !!uid,
    });

    return res.status(201).json({
      success: true,
      id: row?.id,
      message: "You're on the list — we'll be in touch.",
    });
  } catch (e: any) {
    if (e?.name === 'ZodError') {
      return res.status(400).json({ error: 'INVALID', details: e.errors });
    }
    logger.error('[Waitlist] create failed', { error: e?.message });
    return res.status(500).json({ error: 'WAITLIST_CREATE_FAILED' });
  }
});

// ── Admin ────────────────────────────────────────────────────────────────────
// requireAdmin verifies the token + admin role itself (self-contained).

// GET /api/waitlist/admin — list entries, optional ?platform= & ?status= filters.
router.get('/admin', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { platform, status } = req.query as { platform?: string; status?: string };
    const conds = [];
    if (platform) conds.push(eq(waitlistEntries.platformKey, platform));
    if (status) conds.push(eq(waitlistEntries.status, status));
    const rows = await db.select().from(waitlistEntries)
      .where(conds.length ? and(...conds) : undefined)
      .orderBy(desc(waitlistEntries.createdAt))
      .limit(500);
    return res.json({ entries: rows, count: rows.length });
  } catch (e: any) {
    logger.error('[Waitlist] admin list failed', { error: e?.message });
    return res.status(500).json({ error: 'WAITLIST_LIST_FAILED' });
  }
});

// PATCH /api/waitlist/admin/:id — update the lifecycle status of an entry.
router.patch('/admin/:id', requireAdmin, async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const { status } = req.body || {};
    if (!Number.isFinite(id)) return res.status(400).json({ error: 'INVALID_ID' });
    if (!(WAITLIST_STATUSES as readonly string[]).includes(status)) {
      return res.status(400).json({ error: 'INVALID_STATUS', allowed: WAITLIST_STATUSES });
    }
    await db.update(waitlistEntries).set({ status, updatedAt: new Date() }).where(eq(waitlistEntries.id, id));
    return res.json({ success: true });
  } catch (e: any) {
    logger.error('[Waitlist] admin status update failed', { error: e?.message });
    return res.status(500).json({ error: 'WAITLIST_UPDATE_FAILED' });
  }
});

export default router;
