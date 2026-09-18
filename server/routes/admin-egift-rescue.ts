/**
 * RESCUE THE GIFT CARDS THAT WERE BORN DEAD.
 *
 * #2633 fixed the cause: storage.createVoucher wrote `status: 'PENDING'`, a
 * state that exists nowhere in the eVoucher lifecycle — nothing accepted it and
 * nothing ever transitioned out of it. Every gift card sold down the live SUMIT
 * rail to a signed-in buyer landed in it. The buyer was charged; the recipient
 * was told "Gift card is expired or invalid", permanently.
 *
 * That fix only protects gift cards sold FROM NOW ON. Every one already sold is
 * still sitting in PENDING, still dead, and that money has already been taken.
 * This is how they are brought back.
 *
 * SAFETY, because this is live customer money:
 *
 *   - ADMIN ONLY, behind the same validateFirebaseToken + adminLimiter as the
 *     rest of /api/admin.
 *   - DRY RUN BY DEFAULT. GET reports what WOULD change and moves nothing. The
 *     repair only runs on an explicit POST carrying { confirm: 'REPAIR' }.
 *   - IT ONLY EVER TOUCHES 'PENDING'. The UPDATE is scoped to that status, so
 *     a voucher that is CLAIMED, REDEEMED, EXPIRED or CANCELLED is untouchable
 *     — running it twice cannot revive a cancelled gift or re-open a spent one.
 *   - IT NEVER CHANGES AN AMOUNT. initialAmount and remainingAmount are not in
 *     the SET clause at all.
 *   - Every run is audited, dry or not.
 *
 * Deliberately NOT here: sending the claim email. Re-mailing recipients about a
 * gift they may have been told was invalid is a customer-communications
 * decision for the CEO, not a side effect of a repair endpoint. The report
 * gives the recipient addresses so that can be done deliberately.
 */
import { Router, type Request, type Response } from 'express';
import { and, eq, sql } from 'drizzle-orm';
import { db } from '../db';
import { eVouchers } from '@shared/schema';
import { logAuditEvent } from '../middleware/auditLog';
import { logger } from '../lib/logger';
import { sendSanitizedError } from '../lib/sanitizeErrorResponse';

const router = Router();

/** The one dead state, and the state a usable voucher is born in. */
const DEAD = 'PENDING';
const ALIVE = 'ISSUED';

async function survey() {
  const rows = await db
    .select({
      id: eVouchers.id,
      codeLast4: eVouchers.codeLast4,
      initialAmount: eVouchers.initialAmount,
      remainingAmount: eVouchers.remainingAmount,
      currency: eVouchers.currency,
      purchaserEmail: eVouchers.purchaserEmail,
      recipientEmail: eVouchers.recipientEmail,
      createdAt: eVouchers.createdAt,
      expiresAt: eVouchers.expiresAt,
    })
    .from(eVouchers)
    .where(eq(eVouchers.status, DEAD));

  const totalMinor = rows.reduce((sum, r) => sum + Math.round(Number(r.initialAmount ?? 0) * 100), 0);
  return { rows, totalMinor };
}

/**
 * GET /api/admin/egift-rescue
 * Read-only. How many gift cards are dead, what they are worth, and who is
 * waiting for them.
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const { rows, totalMinor } = await survey();
    setImmediate(() => {
      logAuditEvent({
        actorUserId: (req as any).firebaseUser?.uid,
        actorRole: 'admin',
        actionType: 'EGIFT_RESCUE_SURVEY',
        targetType: 'e_voucher',
        targetId: 'all_pending',
        ip: req.ip,
        userAgent: req.headers['user-agent'] as string | undefined,
        metadata: { deadCount: rows.length, totalMinor },
      }).catch(() => {});
    });
    return res.json({
      dryRun: true,
      deadCount: rows.length,
      totalValueMinor: totalMinor,
      currency: rows[0]?.currency ?? 'ILS',
      note: rows.length === 0
        ? 'No gift cards are stuck. Nothing to repair.'
        : `${rows.length} paid gift card(s) are unusable. POST with { "confirm": "REPAIR" } to make them claimable.`,
      vouchers: rows,
    });
  } catch (error: any) {
    return sendSanitizedError(res, error, 'EGIFT_RESCUE_SURVEY_FAILED', { logContext: { op: 'egift-rescue-survey' } });
  }
});

/**
 * POST /api/admin/egift-rescue   body: { confirm: 'REPAIR' }
 * Moves every PENDING voucher to ISSUED so the recipient can finally claim it.
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    if (req.body?.confirm !== 'REPAIR') {
      return res.status(400).json({
        error: 'CONFIRMATION_REQUIRED',
        message: 'This changes live customer money records. Send { "confirm": "REPAIR" } to proceed. GET this endpoint first to see exactly what would change.',
      });
    }

    const before = await survey();
    if (before.rows.length === 0) {
      return res.json({ repaired: 0, note: 'Nothing was stuck. No rows changed.' });
    }

    // Scoped to DEAD on purpose: running this twice cannot revive a CANCELLED
    // gift or re-open a REDEEMED one, and no amount is in the SET clause.
    const updated = await db
      .update(eVouchers)
      .set({ status: ALIVE })
      .where(eq(eVouchers.status, DEAD))
      .returning({ id: eVouchers.id });

    logger.warn('[EgiftRescue] repaired gift cards that were created unusable', {
      repaired: updated.length,
      totalMinor: before.totalMinor,
      actor: (req as any).firebaseUser?.uid,
    });

    setImmediate(() => {
      logAuditEvent({
        actorUserId: (req as any).firebaseUser?.uid,
        actorRole: 'admin',
        actionType: 'EGIFT_RESCUE_REPAIR',
        targetType: 'e_voucher',
        targetId: 'all_pending',
        ip: req.ip,
        userAgent: req.headers['user-agent'] as string | undefined,
        metadata: {
          repaired: updated.length,
          totalMinor: before.totalMinor,
          ids: updated.map((r) => r.id),
        },
      }).catch(() => {});
    });

    return res.json({
      repaired: updated.length,
      totalValueMinor: before.totalMinor,
      recipients: before.rows.map((r) => r.recipientEmail).filter(Boolean),
      note: 'These gift cards are now claimable. Telling the recipients is a separate, deliberate decision — no email was sent.',
    });
  } catch (error: any) {
    return sendSanitizedError(res, error, 'EGIFT_RESCUE_FAILED', { logContext: { op: 'egift-rescue-repair' } });
  }
});

export default router;
