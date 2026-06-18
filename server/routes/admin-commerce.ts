/**
 * Admin Commerce recovery — the human "fix a stuck order" console for the
 * SUMIT Commerce OS. READ + human-triggered RECOVERY only. No autonomous money
 * actions: an admin clicks, the action is idempotent, and every action is
 * written to the audit ledger.
 *
 *   GET  /api/admin/commerce/orders          — list (default: stuck = paid-but-not-activated + failed)
 *   POST /api/admin/commerce/orders/:id/retry-activation  — re-run activation (idempotent)
 *   POST /api/admin/commerce/orders/:id/resend-egift      — re-send gift email (no re-mint)
 *
 * Super-admin only. NOT behind a feature flag — recovery must work the moment
 * an order is stuck, including before the commerce flag is flipped on.
 */
import { Router, type Request, type Response, type NextFunction } from 'express';
import { desc, eq, inArray, sql } from 'drizzle-orm';
import { db } from '../db';
import { purchases } from '@shared/schema';
import { validateFirebaseToken } from '../middleware/firebase-auth';
import { loadUserRole, checkAccessLevel, isSuperAdminVerified } from '../middleware/rbac';
import { retryActivationForPurchase, resendEgiftEmail } from '../services/PurchaseActivationService';
import { logger } from '../lib/logger';

const router = Router();

// On non-super-admin → 404 (don't reveal the surface to lower-privilege admins).
function requireSuperAdminGate(req: Request, res: Response, next: NextFunction) {
  if (!isSuperAdminVerified(req)) return res.status(404).json({ error: 'Not found' });
  next();
}
const requireSuperAdmin = [validateFirebaseToken, loadUserRole, checkAccessLevel(8), requireSuperAdminGate];

function actorOf(req: Request): string {
  return (req as any).userRecord?.uid || (req as any).firebaseUser?.uid || 'admin';
}

/**
 * GET /health — the daily-watchdog summary. READ-ONLY. Surfaces the one signal
 * that matters most: "did anyone PAY and NOT get their product?" (paid-but-not-
 * activated). A scheduled report + the admin dashboard both read this.
 */
router.get('/health', ...requireSuperAdmin, async (_req: Request, res: Response) => {
  try {
    const rows = await db.execute<{ status: string; count: number; gross: number }>(sql`
      SELECT status, count(*)::int AS count, COALESCE(SUM(amount_cents), 0)::bigint AS gross
      FROM purchases
      GROUP BY status
    `);
    const byStatus: Record<string, { count: number; grossCents: number }> = {};
    for (const r of rows.rows ?? []) {
      byStatus[r.status] = { count: Number(r.count), grossCents: Number(r.gross) };
    }
    const stuckCount = (byStatus.paid?.count ?? 0) + (byStatus.failed?.count ?? 0);

    // Oldest stuck order — the most urgent one to look at.
    const oldest = await db.select({
      id: purchases.id, status: purchases.status, productType: purchases.productType,
      amountCents: purchases.amountCents, createdAt: purchases.createdAt,
    }).from(purchases)
      .where(inArray(purchases.status, ['paid', 'failed']))
      .orderBy(purchases.createdAt)
      .limit(1);

    return res.json({
      generatedAt: new Date().toISOString(),
      stuckCount,
      needsAttention: stuckCount > 0,
      byStatus,
      oldestStuck: oldest[0] ?? null,
    });
  } catch (err: any) {
    logger.error('[AdminCommerce] health failed', err);
    return res.status(500).json({ error: 'Health summary failed' });
  }
});

/** GET /orders?status=stuck|paid|failed|activated|all&limit=100 */
router.get('/orders', ...requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const status = String(req.query.status || 'stuck');
    const limit = Math.min(Math.max(Number(req.query.limit) || 100, 1), 500);

    const cols = {
      id: purchases.id,
      surface: purchases.surface,
      surfaceRefId: purchases.surfaceRefId,
      buyerUserId: purchases.buyerUserId,
      productType: purchases.productType,
      amountCents: purchases.amountCents,
      currency: purchases.currency,
      status: purchases.status,
      transactionId: purchases.transactionId,
      metadataJson: purchases.metadataJson,
      createdAt: purchases.createdAt,
      updatedAt: purchases.updatedAt,
    };

    let rows;
    if (status === 'all') {
      rows = await db.select(cols).from(purchases).orderBy(desc(purchases.createdAt)).limit(limit);
    } else if (status === 'stuck') {
      // Paid-but-not-activated is the dangerous bucket (customer paid, got nothing yet).
      rows = await db.select(cols).from(purchases)
        .where(inArray(purchases.status, ['paid', 'failed']))
        .orderBy(desc(purchases.createdAt)).limit(limit);
    } else {
      rows = await db.select(cols).from(purchases)
        .where(eq(purchases.status, status))
        .orderBy(desc(purchases.createdAt)).limit(limit);
    }

    // Never leak secrets; surface only the activation flag from metadata.
    const orders = rows.map((r: any) => ({
      ...r,
      activation: (r.metadataJson as any)?.activation ?? null,
      metadataJson: undefined,
    }));
    return res.json({ status, count: orders.length, orders });
  } catch (err: any) {
    logger.error('[AdminCommerce] list orders failed', err);
    return res.status(500).json({ error: 'Failed to list orders' });
  }
});

/** POST /orders/:id/retry-activation */
router.post('/orders/:id/retry-activation', ...requireSuperAdmin, async (req: Request, res: Response) => {
  const id = String(req.params.id);
  try {
    const result = await retryActivationForPurchase(id, actorOf(req));
    const httpStatus = result.outcome === 'not_found' ? 404 : 200;
    return res.status(httpStatus).json(result);
  } catch (err: any) {
    logger.error('[AdminCommerce] retry-activation failed', { id, err: err?.message });
    return res.status(500).json({ outcome: 'failed', reason: 'retry_crashed' });
  }
});

/** POST /orders/:id/resend-egift */
router.post('/orders/:id/resend-egift', ...requireSuperAdmin, async (req: Request, res: Response) => {
  const id = String(req.params.id);
  try {
    const result = await resendEgiftEmail(id, actorOf(req));
    return res.status(result.ok ? 200 : 400).json(result);
  } catch (err: any) {
    logger.error('[AdminCommerce] resend-egift failed', { id, err: err?.message });
    return res.status(500).json({ ok: false, reason: 'resend_crashed' });
  }
});

export default router;
