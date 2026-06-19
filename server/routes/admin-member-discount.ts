/**
 * Admin Member Wash Discount Routes
 * Mounted at /api/admin/member-discount (under the /api/admin/ middleware stack).
 *
 *   POST /api/admin/member-discount        — set / approve / revoke a member's
 *                                            senior or disability wash discount.
 *   GET  /api/admin/member-discount        — list discount records (optional
 *                                            ?userId= / ?status= filter).
 *
 * The senior/disability review is done OFFLINE by post — the member mails
 * physical documents to the PetWash registered address, an admin reviews and
 * DESTROYS them, then records ONLY the decision here. This endpoint stores NO
 * document / ID / passport data — only the approved percent + who/when + reason.
 *
 * Prestige Basic (automatic 5%) is NOT managed here — it is derived live from
 * loyalty membership at price time and needs no admin tick.
 *
 * Every mutation is audit-logged. requireAdmin guards the whole router.
 */
import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { db } from '../db';
import { memberWashDiscounts, MEMBER_DISCOUNT_MAX_PERCENT } from '../../shared/schema';
import { and, eq, desc } from 'drizzle-orm';
import { isSuperAdmin } from '../middleware/rbac';
import { logAuditEvent } from '../middleware/auditLog';
import { clearLoyaltyCache } from '../services/loyalty';
import { logger } from '../lib/logger';

const router = Router();

function requireAdmin(req: any, res: any, next: any) {
  const email = (req.firebaseUser?.email || '').toLowerCase();
  if (!isSuperAdmin(email)) {
    return res.status(403).json({ error: 'Full admin access required' });
  }
  next();
}
router.use(requireAdmin);

// POST body: approve/set a senior or disability discount, or revoke one.
const upsertSchema = z.object({
  userId: z.string().min(1).max(255),
  // Prestige Basic is NOT admin-set (it is automatic) — only the postal-review
  // categories are managed here.
  discountType: z.enum(['senior', 'disability']),
  // The admin ticks one of these; hard-capped at 10 by the catalog of percents.
  discountPercent: z.union([z.literal(5), z.literal(7), z.literal(10)]),
  status: z.enum(['pending', 'approved', 'revoked']).default('approved'),
  reason: z.string().max(2000).optional(),
  reviewNote: z.string().max(2000).optional(),
  // ISO date string; null/omitted = no expiry.
  expiresAt: z.string().datetime().nullable().optional(),
});

// POST /api/admin/member-discount
router.post('/', async (req: Request, res: Response) => {
  const parsed = upsertSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() });
  }
  const { userId, discountType, discountPercent, status, reason, reviewNote, expiresAt } = parsed.data;

  // Defence in depth: never persist a percent above the cap (the schema also
  // CHECKs this, the price path also clamps).
  if (discountPercent > MEMBER_DISCOUNT_MAX_PERCENT) {
    return res.status(400).json({ error: 'percent_above_cap' });
  }

  const adminId = (req as any).firebaseUser?.uid || (req as any).firebaseUser?.email || 'unknown_admin';
  const adminEmail = (req as any).firebaseUser?.email;
  const now = new Date();

  try {
    // One active record per (user, type): supersede any existing row for this
    // category so a member never accumulates duplicate senior/disability rows.
    const existing = await db
      .select({ id: memberWashDiscounts.id })
      .from(memberWashDiscounts)
      .where(and(eq(memberWashDiscounts.userId, userId), eq(memberWashDiscounts.discountType, discountType)))
      .orderBy(desc(memberWashDiscounts.id))
      .limit(1);

    const values = {
      userId,
      discountType,
      discountPercent,
      status,
      verifiedByAdminId: adminId,
      verifiedAt: now,
      source: 'postal_review' as const,
      reason: reason ?? null,
      reviewNote: reviewNote ?? null,
      expiresAt: expiresAt ? new Date(expiresAt) : null,
      updatedAt: now,
    };

    let recordId: number;
    if (existing.length > 0) {
      const [row] = await db
        .update(memberWashDiscounts)
        .set(values)
        .where(eq(memberWashDiscounts.id, existing[0].id))
        .returning({ id: memberWashDiscounts.id });
      recordId = row.id;
    } else {
      const [row] = await db
        .insert(memberWashDiscounts)
        .values(values)
        .returning({ id: memberWashDiscounts.id });
      recordId = row.id;
    }

    // The wash-discount resolver is independent of the loyalty cache, but the
    // member's effective discount changed — clear their loyalty cache so any
    // loyalty-derived UI refreshes promptly.
    clearLoyaltyCache(userId);

    await logAuditEvent({
      actorUserId: adminId,
      actorRole: 'admin',
      actionType: status === 'revoked' ? 'MEMBER_DISCOUNT_REVOKE' : 'MEMBER_DISCOUNT_SET',
      targetType: 'member_wash_discount',
      targetId: String(recordId),
      ip: req.ip || (req.headers['x-forwarded-for'] as string)?.split(',')[0],
      userAgent: req.headers['user-agent'],
      metadata: {
        targetUserId: userId,
        discountType,
        discountPercent,
        status,
        source: 'postal_review',
        reason: reason ?? null,
        adminEmail,
      },
      severity: 'info',
    });

    return res.json({ ok: true, id: recordId, userId, discountType, discountPercent, status });
  } catch (err: any) {
    logger.error('[AdminMemberDiscount] upsert failed', { userId, discountType, err: err?.message });
    return res.status(500).json({ error: 'member_discount_write_failed' });
  }
});

// GET /api/admin/member-discount?userId=&status=
router.get('/', async (req: Request, res: Response) => {
  const userId = typeof req.query.userId === 'string' ? req.query.userId : undefined;
  const status = typeof req.query.status === 'string' ? req.query.status : undefined;

  try {
    const conds = [] as any[];
    if (userId) conds.push(eq(memberWashDiscounts.userId, userId));
    if (status && ['pending', 'approved', 'revoked'].includes(status)) {
      conds.push(eq(memberWashDiscounts.status, status));
    }

    const rows = await db
      .select()
      .from(memberWashDiscounts)
      .where(conds.length ? and(...conds) : undefined)
      .orderBy(desc(memberWashDiscounts.updatedAt))
      .limit(500);

    return res.json({ ok: true, discounts: rows });
  } catch (err: any) {
    logger.error('[AdminMemberDiscount] list failed', { err: err?.message });
    return res.status(500).json({ error: 'member_discount_list_failed' });
  }
});

export default router;
