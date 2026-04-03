/**
 * Phase 8 — Booking Disputes
 * POST /api/disputes              — customer submits a dispute / report problem
 * GET  /api/disputes/admin        — admin list (all disputes)
 * GET  /api/disputes/my           — customer's own disputes
 * PATCH /api/disputes/:id/resolve — admin resolves a dispute WITH real money movement
 *
 * Resolution types:
 *   customer_favor → customer wallet credited, escrow marked refunded
 *   provider_favor → escrow released to provider (marked for payout)
 *   split          → partial refund to customer, remainder released to provider
 *   no_action      → status updated only, no money movement
 */

import { Router, Request, Response } from 'express';
import { db, pool } from '../db';
import { bookingDisputes, escrowHoldings } from '@shared/schema';
import { eq, desc, and } from 'drizzle-orm';
import { auth } from '../lib/firebase-admin';
import { logger } from '../lib/logger';

const router = Router();

// P0-FIX: SUPER_ADMIN_UID must come from environment variable, not source code.
// Set SUPER_ADMIN_UID env var. If not set, all super-admin routes return 403.
const SUPER_ADMIN_UID = process.env.SUPER_ADMIN_UID || '__SUPER_ADMIN_UID_NOT_CONFIGURED__';

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
// Body: { status, adminNotes, resolutionType, refundAmountCents? }
// resolutionType: 'customer_favor' | 'provider_favor' | 'split' | 'no_action'
// refundAmountCents: integer (agorot). Required for customer_favor and split.
//   For split: refundAmountCents goes to customer; remainder goes to provider.
router.patch('/:id/resolve', async (req: Request, res: Response) => {
  try {
    const uid = await requireAuth(req, res);
    if (!uid) return;
    if (uid !== SUPER_ADMIN_UID) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { id } = req.params;
    const { status, adminNotes, resolutionType, refundAmountCents } = req.body;

    const validStatuses = ['open', 'under_review', 'resolved', 'dismissed'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: `status must be one of: ${validStatuses.join(', ')}` });
    }

    const validResolutionTypes = ['customer_favor', 'provider_favor', 'split', 'no_action'];
    const isResolution = ['resolved', 'dismissed'].includes(status);
    if (isResolution && resolutionType && !validResolutionTypes.includes(resolutionType)) {
      return res.status(400).json({ error: `resolutionType must be one of: ${validResolutionTypes.join(', ')}` });
    }

    // Load the dispute — confirm it exists and is not already resolved (idempotency guard)
    const [existing] = await db.select()
      .from(bookingDisputes)
      .where(eq(bookingDisputes.id, id));

    if (!existing) {
      return res.status(404).json({ error: 'Dispute not found' });
    }
    if (existing.status === 'resolved' && status === 'resolved') {
      logger.warn('[Disputes] Resolve attempted on already-resolved dispute', { disputeId: id, resolvedBy: existing.resolvedBy });
      return res.status(409).json({ error: 'Dispute already resolved — cannot resolve twice', resolvedBy: existing.resolvedBy, resolvedAt: existing.resolvedAt });
    }

    // === MONEY MOVEMENT ===
    // Only executes when transitioning to 'resolved' with a real resolution type that involves money
    let moneyMovementResult: string | null = null;

    if (status === 'resolved' && resolutionType && resolutionType !== 'no_action') {
      const bookingId = existing.bookingId;
      const customerId = existing.customerId;

      // Look up escrow holding for this booking
      const [escrow] = await db.select()
        .from(escrowHoldings)
        .where(eq(escrowHoldings.bookingId, bookingId));

      if (!escrow) {
        logger.warn('[Disputes] No escrow holding found for booking — money movement skipped', { bookingId, disputeId: id });
        moneyMovementResult = 'skipped_no_escrow';
      } else if (escrow.status === 'refunded' || escrow.status === 'released') {
        logger.warn('[Disputes] Escrow already settled — money movement skipped to prevent double-movement', {
          bookingId, escrowStatus: escrow.status, disputeId: id,
        });
        moneyMovementResult = `skipped_escrow_already_${escrow.status}`;
      } else {
        const client = await pool.connect();
        try {
          await client.query('BEGIN');

          if (resolutionType === 'customer_favor') {
            // Full refund to customer wallet
            const refund = typeof refundAmountCents === 'number' ? refundAmountCents : escrow.grossAmountCents;

            // Ensure wallet row exists
            await client.query(
              `INSERT INTO wallet_accounts (wallet_id, user_id, cash_wallet_balance_cents)
               VALUES ($1, $2, 0)
               ON CONFLICT (wallet_id) DO NOTHING`,
              [`WALLET-${customerId.slice(0, 20)}`, customerId],
            );
            // Credit customer
            await client.query(
              `UPDATE wallet_accounts
               SET cash_wallet_balance_cents = cash_wallet_balance_cents + $1,
                   updated_at = NOW()
               WHERE user_id = $2`,
              [refund, customerId],
            );
            // Mark escrow as refunded
            await client.query(
              `UPDATE escrow_holdings
               SET status = 'refunded',
                   refund_amount_cents = $1,
                   refund_processed_at = NOW(),
                   dispute_resolution = 'customer_favor',
                   dispute_resolved_at = NOW(),
                   updated_at = NOW()
               WHERE escrow_id = $2`,
              [refund, escrow.escrowId],
            );

            moneyMovementResult = `customer_credited_${refund}_agorot`;
            logger.info('[Disputes] Customer wallet credited (dispute customer_favor)', {
              disputeId: id, bookingId, customerId, refundAgorot: refund,
            });

          } else if (resolutionType === 'provider_favor') {
            // Release escrow to provider (mark for payout pipeline)
            await client.query(
              `UPDATE escrow_holdings
               SET status = 'released',
                   released_at = NOW(),
                   dispute_resolution = 'provider_favor',
                   dispute_resolved_at = NOW(),
                   updated_at = NOW()
               WHERE escrow_id = $1`,
              [escrow.escrowId],
            );

            moneyMovementResult = `provider_escrow_released_${escrow.netProviderAmountCents}_agorot`;
            logger.info('[Disputes] Escrow released to provider (dispute provider_favor)', {
              disputeId: id, bookingId, providerId: escrow.providerId,
              netProviderAgorot: escrow.netProviderAmountCents,
            });

          } else if (resolutionType === 'split') {
            // Partial refund to customer, remainder released to provider
            const customerRefund = typeof refundAmountCents === 'number' ? refundAmountCents : 0;
            if (customerRefund <= 0) {
              await client.query('ROLLBACK');
              return res.status(400).json({ error: 'refundAmountCents required and must be positive for split resolution' });
            }
            if (customerRefund > escrow.grossAmountCents) {
              await client.query('ROLLBACK');
              return res.status(400).json({ error: 'refundAmountCents cannot exceed escrow gross amount' });
            }

            await client.query(
              `INSERT INTO wallet_accounts (wallet_id, user_id, cash_wallet_balance_cents)
               VALUES ($1, $2, 0)
               ON CONFLICT (wallet_id) DO NOTHING`,
              [`WALLET-${customerId.slice(0, 20)}`, customerId],
            );
            await client.query(
              `UPDATE wallet_accounts
               SET cash_wallet_balance_cents = cash_wallet_balance_cents + $1,
                   updated_at = NOW()
               WHERE user_id = $2`,
              [customerRefund, customerId],
            );
            await client.query(
              `UPDATE escrow_holdings
               SET status = 'released',
                   refund_amount_cents = $1,
                   refund_processed_at = NOW(),
                   released_at = NOW(),
                   dispute_resolution = 'split',
                   dispute_resolved_at = NOW(),
                   updated_at = NOW()
               WHERE escrow_id = $2`,
              [customerRefund, escrow.escrowId],
            );

            moneyMovementResult = `split_customer_${customerRefund}_provider_${escrow.grossAmountCents - customerRefund}_agorot`;
            logger.info('[Disputes] Split resolution executed', {
              disputeId: id, bookingId, customerId, customerRefundAgorot: customerRefund,
              providerRemainingAgorot: escrow.grossAmountCents - customerRefund,
            });
          }

          await client.query('COMMIT');
        } catch (moneyErr: any) {
          await client.query('ROLLBACK');
          logger.error('[Disputes] Money movement transaction failed — dispute status NOT updated', {
            disputeId: id, bookingId, resolutionType, error: moneyErr.message,
          });
          return res.status(500).json({
            error: 'Money movement failed — dispute was not updated. Retry or contact engineering.',
            detail: moneyErr.message,
          });
        } finally {
          client.release();
        }
      }

    }

    // Update dispute status
    const [updated] = await db.update(bookingDisputes)
      .set({
        status,
        adminNotes: adminNotes || null,
        resolvedBy: uid,
        resolvedAt: isResolution ? new Date() : null,
      })
      .where(eq(bookingDisputes.id, id))
      .returning();

    logger.info('[Disputes] Dispute status updated', {
      disputeId: id,
      status,
      resolutionType: resolutionType || null,
      moneyMovementResult,
      resolvedBy: uid,
    });

    res.json({
      success: true,
      dispute: updated,
      moneyMovementResult: moneyMovementResult || 'none',
    });
  } catch (error: any) {
    logger.error('[Disputes] Resolve error', error);
    res.status(500).json({ error: 'Failed to resolve dispute' });
  }
});

export default router;
