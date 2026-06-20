/**
 * Admin Payments Control — read-only control panel over the unified pw_payments
 * ledger. Mounted at /api/admin/payments-control (under the /api/admin/
 * middleware stack — Firebase token + admin limiter applied at the mount).
 *
 *   GET /api/admin/payments-control          — paged, filtered ledger list.
 *   GET /api/admin/payments-control/summary   — today's (Asia/Jerusalem) totals.
 *
 * READ-ONLY by design. There are NO mutation endpoints here. Retry-activation /
 * retry-document actions are a deliberate, separate follow-up and are NOT
 * stubbed here so the panel never lies about what it can do.
 *
 * All monetary columns are INTEGER CENTS (ILS × 100) — divide by 100 to display.
 *
 * requireAdmin (isSuperAdmin) guards the whole router.
 */
import { Router, type Request, type Response } from 'express';
import { db } from '../db';
import { pwPayments } from '../../shared/schema-payments';
import { and, or, eq, gte, lte, ilike, desc, sql } from 'drizzle-orm';
import { isSuperAdmin } from '../middleware/rbac';
import { logAuditEvent } from '../middleware/auditLog';
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

const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 200;

function str(v: unknown): string | undefined {
  return typeof v === 'string' && v.trim() ? v.trim() : undefined;
}

// Parse an ISO date string into a Date; returns undefined when absent/invalid.
function isoDate(v: unknown): Date | undefined {
  const s = str(v);
  if (!s) return undefined;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

// ── GET / — paged + filtered ledger list ──────────────────────────────────────
router.get('/', async (req: Request, res: Response) => {
  try {
    const processor       = str(req.query.processor);       // nayax | stripe | manual
    const status          = str(req.query.status);
    const vertical        = str(req.query.vertical);
    const transactionType = str(req.query.transactionType);
    const q               = str(req.query.q);
    const from            = isoDate(req.query.from);
    const to              = isoDate(req.query.to);

    const page = Math.max(1, parseInt(String(req.query.page ?? '1'), 10) || 1);
    const pageSize = Math.min(
      MAX_PAGE_SIZE,
      Math.max(1, parseInt(String(req.query.pageSize ?? String(DEFAULT_PAGE_SIZE)), 10) || DEFAULT_PAGE_SIZE),
    );

    const conds: any[] = [];
    if (processor)       conds.push(eq(pwPayments.paymentProcessor, processor));
    if (status)          conds.push(eq(pwPayments.status, status));
    if (vertical)        conds.push(eq(pwPayments.vertical, vertical));
    if (transactionType) conds.push(eq(pwPayments.transactionType, transactionType));
    if (from)            conds.push(gte(pwPayments.createdAt, from));
    if (to)              conds.push(lte(pwPayments.createdAt, to));
    if (q) {
      const like = `%${q}%`;
      conds.push(
        or(
          ilike(pwPayments.paymentId, like),
          ilike(pwPayments.customerId, like),
          ilike(pwPayments.providerId, like),
          ilike(pwPayments.nayaxTransactionId, like),
          ilike(pwPayments.invoiceId, like),
        ),
      );
    }

    const where = conds.length ? and(...conds) : undefined;

    const rows = await db
      .select({
        paymentId:          pwPayments.paymentId,
        transactionType:    pwPayments.transactionType,
        vertical:           pwPayments.vertical,
        commercialModel:    pwPayments.commercialModel,
        customerId:         pwPayments.customerId,
        providerId:         pwPayments.providerId,
        grossCents:         pwPayments.grossCents,
        netRevenueCents:    pwPayments.netRevenueCents,
        vatCents:           pwPayments.vatCents,
        paymentMethod:      pwPayments.paymentMethod,
        paymentProcessor:   pwPayments.paymentProcessor,
        walletUsed:         pwPayments.walletUsed,
        invoiceId:          pwPayments.invoiceId,
        receiptId:          pwPayments.receiptId,
        status:             pwPayments.status,
        nayaxTransactionId: pwPayments.nayaxTransactionId,
        createdAt:          pwPayments.createdAt,
        settledAt:          pwPayments.settledAt,
      })
      .from(pwPayments)
      .where(where)
      .orderBy(desc(pwPayments.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize);

    const [{ total }] = await db
      .select({ total: sql<number>`count(*)::int` })
      .from(pwPayments)
      .where(where);

    return res.json({ rows, total: total ?? 0, page, pageSize });
  } catch (err: any) {
    logger.error('[AdminPaymentsControl] list failed', { err: err?.message });
    return res.status(500).json({ error: 'payments_control_list_failed' });
  }
});

// ── GET /summary — today's (Asia/Jerusalem) aggregates ────────────────────────
router.get('/summary', async (req: Request, res: Response) => {
  try {
    // "Today" is the calendar day in Asia/Jerusalem. We compute the day window
    // entirely in Postgres so the boundary respects DST correctly.
    const todayStart = sql`((now() AT TIME ZONE 'Asia/Jerusalem')::date)::timestamp AT TIME ZONE 'Asia/Jerusalem'`;
    const createdToday = gte(pwPayments.createdAt, todayStart as any);

    // Count + gross grouped by processor (today).
    const byProcessor = await db
      .select({
        processor: pwPayments.paymentProcessor,
        count:     sql<number>`count(*)::int`,
        grossCents: sql<number>`coalesce(sum(${pwPayments.grossCents}), 0)::int`,
      })
      .from(pwPayments)
      .where(createdToday)
      .groupBy(pwPayments.paymentProcessor);

    // Wallet-covered totals (today). walletUsed can overlap any processor, so
    // this is reported separately, not as a processor bucket.
    const [walletAgg] = await db
      .select({
        count:     sql<number>`count(*)::int`,
        grossCents: sql<number>`coalesce(sum(${pwPayments.grossCents}), 0)::int`,
      })
      .from(pwPayments)
      .where(and(createdToday, eq(pwPayments.walletUsed, true)));

    // Refunds / reversals (today) — by status.
    const [refundAgg] = await db
      .select({
        count:     sql<number>`count(*)::int`,
        grossCents: sql<number>`coalesce(sum(${pwPayments.grossCents}), 0)::int`,
      })
      .from(pwPayments)
      .where(and(createdToday, sql`${pwPayments.status} in ('refunded','reversed')`));

    // HEURISTIC "paid but not activated": captured/settled with no invoice and
    // no settle timestamp. This is a best-effort signal that money came in but a
    // downstream document/activation step may not have run — NOT an authoritative
    // ledger state. Surfaced for human review only.
    const [{ paidNotActivated }] = await db
      .select({ paidNotActivated: sql<number>`count(*)::int` })
      .from(pwPayments)
      .where(
        and(
          sql`${pwPayments.status} in ('captured','settled')`,
          sql`${pwPayments.invoiceId} is null`,
          sql`${pwPayments.settledAt} is null`,
        ),
      );

    // Light audit trail — admin viewed the financial summary.
    void logAuditEvent({
      actorUserId: (req as any).firebaseUser?.uid || (req as any).firebaseUser?.email || 'unknown_admin',
      actorRole: 'admin',
      actionType: 'PAYMENTS_CONTROL_SUMMARY_VIEW',
      targetType: 'pw_payments',
      ip: req.ip || (req.headers['x-forwarded-for'] as string)?.split(',')[0],
      userAgent: req.headers['user-agent'],
      severity: 'info',
    }).catch(() => {});

    return res.json({
      byProcessor,                                  // [{ processor, count, grossCents }]
      wallet: walletAgg ?? { count: 0, grossCents: 0 },
      refunds: refundAgg ?? { count: 0, grossCents: 0 },
      // Labelled clearly as a heuristic so the UI can caveat it.
      paidNotActivated: paidNotActivated ?? 0,
      paidNotActivatedIsHeuristic: true,
    });
  } catch (err: any) {
    logger.error('[AdminPaymentsControl] summary failed', { err: err?.message });
    return res.status(500).json({ error: 'payments_control_summary_failed' });
  }
});

export default router;
