/**
 * Member Wash Discount — self-read.
 * Mounted at /api/member/wash-discount.
 *
 *   GET /api/member/wash-discount  → the CALLER's own resolved K9000 wash
 *                                    discount (server-authoritative). Lets the
 *                                    customer UI show "Prestige 5% applied" /
 *                                    "Approved discount X% applied".
 *
 * Read-only. Returns only the percent + source — never any document/ID data.
 */
import { Router, type Request, type Response } from 'express';
import { validateFirebaseToken } from '../middleware/firebase-auth';
import { resolveWashDiscount } from '../services/memberDiscount';

const router = Router();

// GET /api/member/wash-discount
router.get('/wash-discount', validateFirebaseToken, async (req: Request, res: Response) => {
  const uid = req.firebaseUser?.uid;
  if (!uid) return res.status(401).json({ error: 'Authentication required' });

  const d = await resolveWashDiscount(uid);
  return res.json({
    ok: true,
    percent: d.percent,
    source: d.source,
    prestigeBasic: d.prestigeBasic,
    approved: d.approved,
  });
});

export default router;
