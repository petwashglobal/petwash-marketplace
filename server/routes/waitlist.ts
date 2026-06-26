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
import { waitlistEntries, createWaitlistEntrySchema } from '../../shared/schema-waitlist';
import { logger } from '../lib/logger';

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

export default router;
