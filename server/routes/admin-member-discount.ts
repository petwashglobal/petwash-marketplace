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
import { memberWashDiscounts, memberDiscountApplications, MEMBER_DISCOUNT_MAX_PERCENT } from '../../shared/schema';
import { and, eq, desc } from 'drizzle-orm';
import { isSuperAdmin } from '../middleware/rbac';
import { logAuditEvent } from '../middleware/auditLog';
import { clearLoyaltyCache } from '../services/loyalty';
import { decryptField } from '../services/secretFieldCrypto';
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

// ──────────────────────────────────────────────────────────────────────────
// SENIOR / DISABILITY APPLICATION review (self-service apply flow, spec §3/§9).
// ──────────────────────────────────────────────────────────────────────────

/** Mask an ID/passport for list views — only the last 4 chars survive. */
function maskId(value: string | null): string | null {
  if (!value) return null;
  const v = String(value).trim();
  if (v.length <= 4) return '••••';
  return '•'.repeat(Math.max(4, v.length - 4)) + v.slice(-4);
}

// GET /api/admin/member-discount/applications?status=&userId=
// Lists applications. ID numbers are MASKED here — full value only via /reveal.
router.get('/applications', async (req: Request, res: Response) => {
  const status = typeof req.query.status === 'string' ? req.query.status : undefined;
  const userId = typeof req.query.userId === 'string' ? req.query.userId : undefined;

  try {
    const conds = [] as any[];
    if (userId) conds.push(eq(memberDiscountApplications.userId, userId));
    // Whitelist status: an arbitrary value hits an enum/CHECK column and 500s
    // the endpoint. Match the pattern already used at line 155 for the sibling
    // GET /. Unknown status silently ignored (same behavior as sibling).
    if (status && ['pending', 'approved', 'rejected', 'revoked', 'more_info'].includes(status)) {
      conds.push(eq(memberDiscountApplications.status, status));
    }

    const rows = await db
      .select()
      .from(memberDiscountApplications)
      .where(conds.length ? and(...conds) : undefined)
      .orderBy(desc(memberDiscountApplications.updatedAt))
      .limit(500);

    const applications = rows.map((r) => {
      // Decrypt only to re-mask — the full number is never returned by this route.
      let idMasked: string | null = null;
      let disabilityMasked: string | null = null;
      try { idMasked = r.idNumberEnc ? maskId(decryptField(r.idNumberEnc)) : null; } catch { idMasked = '••••'; }
      try { disabilityMasked = r.disabilityRefEnc ? maskId(decryptField(r.disabilityRefEnc)) : null; } catch { disabilityMasked = '••••'; }
      return {
        id: r.id,
        userId: r.userId,
        discountType: r.discountType,
        status: r.status,
        idType: r.idType,
        idMasked,
        idCountry: r.idCountry,
        dateOfBirth: r.dateOfBirth,
        idIssueDate: r.idIssueDate,
        disabilityMasked,
        disabilityIssueDate: r.disabilityIssueDate,
        disabilityExpiryDate: r.disabilityExpiryDate,
        issuingAuthority: r.issuingAuthority,
        declarationSignedAt: r.declarationSignedAt,
        submittedAt: r.submittedAt,
        reviewedByAdminId: r.reviewedByAdminId,
        reviewedAt: r.reviewedAt,
        reviewNote: r.reviewNote,
        approvedPercent: r.approvedPercent,
      };
    });

    return res.json({ ok: true, applications });
  } catch (err: any) {
    logger.error('[AdminMemberDiscount] application list failed', { err: err?.message });
    return res.status(500).json({ error: 'application_list_failed' });
  }
});

// GET /api/admin/member-discount/applications/:id/reveal
// Returns the FULL decrypted ID/passport — super-admin only, every call audited.
router.get('/applications/:id/reveal', async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'invalid_id' });

  const adminId = (req as any).firebaseUser?.uid || (req as any).firebaseUser?.email || 'unknown_admin';
  const adminEmail = (req as any).firebaseUser?.email;

  try {
    const [row] = await db
      .select()
      .from(memberDiscountApplications)
      .where(eq(memberDiscountApplications.id, id))
      .limit(1);
    if (!row) return res.status(404).json({ error: 'not_found' });

    let idNumber: string | null = null;
    let disabilityRef: string | null = null;
    try { idNumber = row.idNumberEnc ? decryptField(row.idNumberEnc) : null; } catch { idNumber = null; }
    try { disabilityRef = row.disabilityRefEnc ? decryptField(row.disabilityRefEnc) : null; } catch { disabilityRef = null; }

    // Sensitive-data access is ALWAYS audited (Amendment 13).
    await logAuditEvent({
      actorUserId: adminId,
      actorRole: 'admin',
      actionType: 'MEMBER_DISCOUNT_ID_REVEAL',
      targetType: 'member_discount_application',
      targetId: String(id),
      ip: req.ip || (req.headers['x-forwarded-for'] as string)?.split(',')[0],
      userAgent: req.headers['user-agent'],
      metadata: { targetUserId: row.userId, discountType: row.discountType, adminEmail },
      severity: 'warn',
    });

    return res.json({ ok: true, id, idType: row.idType, idNumber, disabilityRef });
  } catch (err: any) {
    logger.error('[AdminMemberDiscount] reveal failed', { id, err: err?.message });
    return res.status(500).json({ error: 'reveal_failed' });
  }
});

const decisionSchema = z.object({
  decision: z.enum(['approved', 'rejected', 'needs_more_info', 'suspended']),
  // Required when approving — the granted percent (5/7/10).
  discountPercent: z.union([z.literal(5), z.literal(7), z.literal(10)]).optional(),
  note: z.string().max(2000).optional(),
  expiresAt: z.string().datetime().nullable().optional(),
});

// POST /api/admin/member-discount/applications/:id/decision
// Approve → also writes the active discount into member_wash_discounts (the
// price engine reads that). Reject / needs-more-info / suspend just update the
// application lifecycle.
router.post('/applications/:id/decision', async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'invalid_id' });

  const parsed = decisionSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'invalid_input', details: parsed.error.flatten() });
  }
  const { decision, discountPercent, note, expiresAt } = parsed.data;

  if (decision === 'approved' && !discountPercent) {
    return res.status(400).json({ error: 'percent_required_for_approval' });
  }
  if (discountPercent && discountPercent > MEMBER_DISCOUNT_MAX_PERCENT) {
    return res.status(400).json({ error: 'percent_above_cap' });
  }

  const adminId = (req as any).firebaseUser?.uid || (req as any).firebaseUser?.email || 'unknown_admin';
  const adminEmail = (req as any).firebaseUser?.email;
  const now = new Date();

  try {
    const [app] = await db
      .select()
      .from(memberDiscountApplications)
      .where(eq(memberDiscountApplications.id, id))
      .limit(1);
    if (!app) return res.status(404).json({ error: 'not_found' });
    if (app.discountType !== 'senior' && app.discountType !== 'disability') {
      return res.status(400).json({ error: 'unsupported_type' });
    }

    // Update the application lifecycle.
    await db
      .update(memberDiscountApplications)
      .set({
        status: decision,
        reviewedByAdminId: adminId,
        reviewedAt: now,
        reviewNote: note ?? null,
        approvedPercent: decision === 'approved' ? (discountPercent as number) : null,
        updatedAt: now,
      })
      .where(eq(memberDiscountApplications.id, id));

    // On approval, write/refresh the authoritative discount decision row.
    if (decision === 'approved') {
      const existing = await db
        .select({ id: memberWashDiscounts.id })
        .from(memberWashDiscounts)
        .where(and(eq(memberWashDiscounts.userId, app.userId), eq(memberWashDiscounts.discountType, app.discountType)))
        .orderBy(desc(memberWashDiscounts.id))
        .limit(1);

      const values = {
        userId: app.userId,
        discountType: app.discountType,
        discountPercent: discountPercent as number,
        status: 'approved' as const,
        verifiedByAdminId: adminId,
        verifiedAt: now,
        source: 'postal_review' as const,
        reason: note ?? `Approved via in-app application #${id}`,
        reviewNote: note ?? null,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
        updatedAt: now,
      };
      if (existing.length) {
        await db.update(memberWashDiscounts).set(values).where(eq(memberWashDiscounts.id, existing[0].id));
      } else {
        await db.insert(memberWashDiscounts).values(values);
      }
      clearLoyaltyCache(app.userId);
    } else if (decision === 'suspended' || decision === 'rejected') {
      // Revoke any active discount for this category so it stops applying.
      await db
        .update(memberWashDiscounts)
        .set({ status: 'revoked', verifiedByAdminId: adminId, verifiedAt: now, updatedAt: now })
        .where(and(eq(memberWashDiscounts.userId, app.userId), eq(memberWashDiscounts.discountType, app.discountType)));
      clearLoyaltyCache(app.userId);
    }

    await logAuditEvent({
      actorUserId: adminId,
      actorRole: 'admin',
      actionType: 'MEMBER_DISCOUNT_APPLICATION_DECISION',
      targetType: 'member_discount_application',
      targetId: String(id),
      ip: req.ip || (req.headers['x-forwarded-for'] as string)?.split(',')[0],
      userAgent: req.headers['user-agent'],
      metadata: { targetUserId: app.userId, discountType: app.discountType, decision, discountPercent: discountPercent ?? null, adminEmail },
      severity: 'info',
    });

    return res.json({ ok: true, id, status: decision, discountPercent: discountPercent ?? null });
  } catch (err: any) {
    logger.error('[AdminMemberDiscount] decision failed', { id, err: err?.message });
    return res.status(500).json({ error: 'decision_failed' });
  }
});

export default router;
