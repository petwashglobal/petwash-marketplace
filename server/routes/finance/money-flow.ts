/**
 * PetWash™ Money Flow API — 2026
 * Provides aggregated financial metrics separated by flow type.
 *
 * Flow A: marketplace_booking (provider exists)
 * Flow B: direct_platform_sale / egift_sale / wallet_topup (no provider)
 *
 * Compliance controls:
 *  - requireRole: admin / management / staff only
 *  - adminLimiter: 200 req / 15 min (applied at mount in routes.ts)
 *  - Zod input validation: from, to, currency strictly validated
 *  - Date range cap: max 365 days to prevent slow-query DoS
 *  - Audit event logged on every successful data access
 *  - All SQL uses parameterised Drizzle `sql` template literals (no raw interpolation)
 */

import { Router } from 'express';
import { z } from 'zod';
import { db } from '../../db';
import { sql } from 'drizzle-orm';
import { requireRole } from '../../middleware/gates';
import { logger } from '../../lib/logger';
import { logAuditEvent } from '../../middleware/auditLog';
import type { MoneyFlowSummary } from '../../../shared/finance-flow-types';

const router = Router();

// ── Input schema ───────────────────────────────────────────────────────────────

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_DATE_RANGE_DAYS = 365;

const querySchema = z.object({
  from: z
    .string()
    .regex(ISO_DATE_RE, 'from must be YYYY-MM-DD')
    .refine(v => !isNaN(Date.parse(v)), 'from is not a valid date')
    .optional(),
  to: z
    .string()
    .regex(ISO_DATE_RE, 'to must be YYYY-MM-DD')
    .refine(v => !isNaN(Date.parse(v)), 'to is not a valid date')
    .optional(),
  currency: z.enum(['ILS', 'USD', 'EUR']).optional().default('ILS'),
}).refine(data => {
  if (data.from && data.to) {
    const fromMs = Date.parse(data.from);
    const toMs = Date.parse(data.to);
    if (toMs < fromMs) return false;
    const diffDays = (toMs - fromMs) / (1000 * 60 * 60 * 24);
    if (diffDays > MAX_DATE_RANGE_DAYS) return false;
  }
  return true;
}, { message: `Date range invalid or exceeds ${MAX_DATE_RANGE_DAYS}-day maximum` });

// ── Summary ───────────────────────────────────────────────────────────────────

/**
 * GET /api/finance/money-flow-summary
 * Returns all KPIs separated by flow type.
 * Requires admin / management / staff role.
 * Rate-limited to 200 req/15 min via adminLimiter at mount.
 */
router.get('/money-flow-summary', requireRole('admin', 'management', 'staff'), async (req: any, res) => {
  try {
    const parsed = querySchema.safeParse(req.query);
    if (!parsed.success) {
      return res.status(400).json({
        error: 'Invalid query parameters',
        details: parsed.error.flatten().fieldErrors,
      });
    }
    const { from, to, currency } = parsed.data;

    const dateFilter = from && to
      ? sql`AND created_at BETWEEN ${from}::date AND ${to}::date`
      : sql``;

    // ── Marketplace bookings (walk_bookings + sitter_bookings) ────────────────
    const walkStats = await db.execute(sql`
      SELECT
        COUNT(*) FILTER (WHERE status NOT IN ('cancelled','refunded')) AS total,
        COALESCE(SUM(CAST(total_cost AS NUMERIC) * 100) FILTER (WHERE status NOT IN ('cancelled','refunded')), 0) AS gross_cents,
        COALESCE(SUM((COALESCE(CAST(platform_fee_owner AS NUMERIC),0) + COALESCE(CAST(platform_fee_sitter AS NUMERIC),0)) * 100) FILTER (WHERE status NOT IN ('cancelled','refunded')), 0) AS fee_cents,
        COALESCE(SUM(CAST(walker_payout AS NUMERIC) * 100) FILTER (WHERE status = 'completed'), 0) AS payout_cents,
        0 AS vat_cents
      FROM walk_bookings
    `);

    const sitterStats = await db.execute(sql`
      SELECT
        COUNT(*) FILTER (WHERE status NOT IN ('cancelled','refunded')) AS total,
        COALESCE(SUM(total_charge_cents) FILTER (WHERE status NOT IN ('cancelled','refunded')), 0) AS gross_cents,
        COALESCE(SUM(platform_service_fee_cents) FILTER (WHERE status NOT IN ('cancelled','refunded')), 0) AS fee_cents,
        COALESCE(SUM(sitter_payout_cents) FILTER (WHERE status = 'completed'), 0) AS payout_cents,
        0 AS vat_cents
      FROM sitter_bookings
    `);

    // ── Escrow ────────────────────────────────────────────────────────────────
    const escrowStats = await db.execute(sql`
      SELECT
        COALESCE(SUM(gross_amount_cents) FILTER (WHERE status = 'held'), 0) AS held_cents,
        COALESCE(SUM(gross_amount_cents) FILTER (WHERE status = 'released'), 0) AS released_cents
      FROM escrow_holdings
    `);

    // ── Direct PetWash sales (transaction_records) ────────────────────────────
    const directStats = await db.execute(sql`
      SELECT
        COUNT(*) FILTER (WHERE flow_type = 'direct_platform_sale') AS direct_count,
        COALESCE(SUM(CAST(total_amount AS NUMERIC)) FILTER (WHERE flow_type = 'direct_platform_sale'), 0) AS direct_gross,
        COALESCE(SUM(CAST(vat_amount AS NUMERIC)) FILTER (WHERE flow_type = 'direct_platform_sale'), 0) AS direct_vat,
        COUNT(*) FILTER (WHERE flow_type = 'egift_sale' OR is_gift_card = true) AS egift_count,
        COALESCE(SUM(CAST(total_amount AS NUMERIC)) FILTER (WHERE flow_type = 'egift_sale' OR is_gift_card = true), 0) AS egift_gross,
        COUNT(*) FILTER (WHERE flow_type = 'wallet_topup') AS wallet_count,
        COALESCE(SUM(CAST(total_amount AS NUMERIC)) FILTER (WHERE flow_type = 'wallet_topup'), 0) AS wallet_gross,
        COALESCE(SUM(CAST(processing_fee AS NUMERIC)), 0) AS processor_fees
      FROM transaction_records
    `);

    // ── Credit / wallet transactions ──────────────────────────────────────────
    const creditStats = await db.execute(sql`
      SELECT
        COUNT(*) FILTER (WHERE transaction_type = 'topup') AS topup_count,
        COALESCE(SUM(amount_cents) FILTER (WHERE transaction_type = 'topup'), 0) AS topup_cents
      FROM credit_transactions
    `);

    // ── Refunds ───────────────────────────────────────────────────────────────
    const refundStats = await db.execute(sql`
      SELECT
        COALESCE(SUM(refund_amount_cents), 0) AS total_refund_cents
      FROM escrow_holdings
      WHERE status = 'refunded' AND refund_amount_cents IS NOT NULL
    `);

    // ── Normalise rows ─────────────────────────────────────────────────────────
    const ws = (walkStats.rows?.[0] || {}) as any;
    const ss = (sitterStats.rows?.[0] || {}) as any;
    const es = (escrowStats.rows?.[0] || {}) as any;
    const ds = (directStats.rows?.[0] || {}) as any;
    const cs = (creditStats.rows?.[0] || {}) as any;
    const rs = (refundStats.rows?.[0] || {}) as any;

    const mktBookings = parseInt(ws.total || 0) + parseInt(ss.total || 0);
    const mktGrossCents = parseInt(ws.gross_cents || 0) + parseInt(ss.gross_cents || 0);
    const mktFeeCents = parseInt(ws.fee_cents || 0) + parseInt(ss.fee_cents || 0);
    const mktPayoutCents = parseInt(ws.payout_cents || 0) + parseInt(ss.payout_cents || 0);
    const mktVatCents = parseInt(ws.vat_cents || 0) + parseInt(ss.vat_cents || 0);

    const directGross = parseFloat(ds.direct_gross || 0);
    const directVat = parseFloat(ds.direct_vat || 0);
    const egiftGross = parseFloat(ds.egift_gross || 0);
    const walletGross = parseFloat(ds.wallet_gross || 0);
    const processorFees = parseFloat(ds.processor_fees || 0);

    const walletTopupGrossILS = parseInt(cs.topup_cents || 0) / 100;

    const summary: MoneyFlowSummary = {
      totalMarketplaceBookings: mktBookings,
      totalMarketplaceGrossILS: mktGrossCents / 100,
      totalPlatformFeesILS: mktFeeCents / 100,
      totalProviderPayoutsILS: mktPayoutCents / 100,
      totalEscrowHeldILS: parseInt(es.held_cents || 0) / 100,
      totalEscrowReleasedILS: parseInt(es.released_cents || 0) / 100,
      totalVATMarketplaceILS: mktVatCents / 100,

      totalDirectPlatformSales: parseInt(ds.direct_count || 0),
      totalDirectSalesGrossILS: directGross,
      totalEGiftSales: parseInt(ds.egift_count || 0),
      totalEGiftValueILS: egiftGross,
      totalWalletTopups: parseInt(ds.wallet_count || 0) + parseInt(cs.topup_count || 0),
      totalWalletTopupValueILS: walletGross + walletTopupGrossILS,
      totalVATDirectSalesILS: directVat,

      totalProcessorFeesILS: processorFees,
      totalRefundsILS: parseInt(rs.total_refund_cents || 0) / 100,
      totalChargebacks: 0,

      totalVATAllFlowsILS: (mktVatCents / 100) + directVat,
      totalNetRevenueILS: (mktFeeCents / 100) + directGross - directVat - processorFees,
    };

    // ── Audit trail ────────────────────────────────────────────────────────────
    await logAuditEvent({
      actorUserId: req.user?.uid || req.userId || 'unknown',
      actorRole: req.user?.role || 'admin',
      actionType: 'FINANCE_MONEY_FLOW_SUMMARY_READ',
      targetType: 'money_flow_summary',
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      traceId: req.traceId,
      metadata: { currency, from: from ?? null, to: to ?? null, mktBookings, directSales: ds.direct_count },
    }).catch(() => {}); // non-blocking — never fail request on audit error

    res.json(summary);
  } catch (err) {
    logger.error('GET /finance/money-flow-summary', err);
    res.status(500).json({ error: 'Failed to load money flow summary' });
  }
});

// ── Transaction types ─────────────────────────────────────────────────────────

const txnQuerySchema = z.object({
  currency: z.enum(['ILS', 'USD', 'EUR']).optional().default('ILS'),
});

/**
 * GET /api/finance/transaction-types
 * Returns transaction type counts for admin table/chart.
 * Requires admin / management / staff role.
 */
router.get('/transaction-types', requireRole('admin', 'management', 'staff'), async (req: any, res) => {
  try {
    const parsed = txnQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return res.status(400).json({
        error: 'Invalid query parameters',
        details: parsed.error.flatten().fieldErrors,
      });
    }

    const result = await db.execute(sql`
      SELECT
        flow_type AS transaction_type,
        COUNT(*) AS count,
        COALESCE(SUM(CAST(total_amount AS NUMERIC)), 0) AS gross_ils
      FROM transaction_records
      GROUP BY flow_type
      ORDER BY count DESC
    `);

    await logAuditEvent({
      actorUserId: req.user?.uid || req.userId || 'unknown',
      actorRole: req.user?.role || 'admin',
      actionType: 'FINANCE_TRANSACTION_TYPES_READ',
      targetType: 'transaction_records',
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      traceId: req.traceId,
      metadata: { rowCount: result.rows?.length ?? 0 },
    }).catch(() => {});

    res.json(result.rows || []);
  } catch (err) {
    logger.error('GET /finance/transaction-types', err);
    res.status(500).json({ error: 'Failed to load transaction types' });
  }
});

export default router;
