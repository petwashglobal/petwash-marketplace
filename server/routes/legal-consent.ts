/**
 * Legal consent — the Terms page "I Accept" gate (CEO canon mockup #4).
 *
 *   GET  /api/legal/terms-acceptance  → { acceptedAt: string | null }
 *   POST /api/legal/accept-terms      → stamps users.accepted_terms_at (idempotent:
 *                                       a second accept keeps the ORIGINAL date —
 *                                       the legally meaningful moment is the first).
 *
 * Signup already records acceptance for new accounts; this covers existing
 * users confirming on the Terms page itself. Auth required — a guest has no
 * row to stamp (the page routes guests to /signup instead).
 */
import { Router, Request, Response } from 'express';
import { validateFirebaseToken } from '../middleware/firebase-auth';
import { db } from '../db';
import { users } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { logger } from '../lib/logger';

const router = Router();

router.get('/terms-acceptance', validateFirebaseToken, async (req: Request, res: Response) => {
  const uid = req.firebaseUser?.uid;
  if (!uid) return res.status(401).json({ error: 'Authentication required' });
  try {
    const [u] = await db.select({ acceptedTermsAt: users.acceptedTermsAt }).from(users).where(eq(users.id, uid)).limit(1);
    return res.json({ acceptedAt: u?.acceptedTermsAt ?? null });
  } catch (err: any) {
    logger.error('[LegalConsent] read failed', { uid, err: err?.message });
    return res.status(500).json({ error: 'read_failed' });
  }
});

router.post('/accept-terms', validateFirebaseToken, async (req: Request, res: Response) => {
  const uid = req.firebaseUser?.uid;
  if (!uid) return res.status(401).json({ error: 'Authentication required' });
  try {
    const [u] = await db.select({ acceptedTermsAt: users.acceptedTermsAt }).from(users).where(eq(users.id, uid)).limit(1);
    if (!u) return res.status(404).json({ error: 'user_not_found' });
    if (u.acceptedTermsAt) {
      // Idempotent — never overwrite the original acceptance moment.
      return res.json({ acceptedAt: u.acceptedTermsAt, alreadyAccepted: true });
    }
    const now = new Date();
    await db.update(users).set({ acceptedTermsAt: now }).where(eq(users.id, uid));
    logger.info('[LegalConsent] terms accepted', { uid });
    return res.json({ acceptedAt: now.toISOString(), alreadyAccepted: false });
  } catch (err: any) {
    logger.error('[LegalConsent] accept failed', { uid, err: err?.message });
    return res.status(500).json({ error: 'accept_failed' });
  }
});

export default router;
