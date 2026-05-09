/**
 * Financial Transaction Audit & Monitoring API
 * 
 * Government-ready transaction ledger with:
 * - Unified view of all booking transactions across all 7 platforms
 * - Credit wallet redemption tracking (e-gift, wash packages, loyalty, promo)
 * - Israeli digital receipt linkage
 * - Immutable transaction stamps with SHA-256 audit hashes
 * - Reconciliation status tracking
 * - Platform behavior monitoring
 * 
 * Israeli Tax Authority Compliance:
 * - Sequential receipt numbers
 * - VAT breakdown at 18%
 * - Complete payment trail for audit
 * - Credit/debit reconciliation
 */

import { Router } from 'express';
import { db } from '../../db';
import { 
  bookings, 
  superAppPayments, 
  creditTransactions, 
  redemptionSessions, 
  digitalReceipts,
  auditLedger,
  walletAccounts,
} from '@shared/schema';
import { eq, desc, and, gte, lte, sql, or, like } from 'drizzle-orm';
import { requireAdmin } from '../../adminAuth';
import { logger } from '../../lib/logger';
import { z } from 'zod';
import { createHash } from 'crypto';
import { COMPANY_TAX_ID, COMPANY_NAME_EN, COMPANY_NAME_HE } from '@shared/finance-identity';

const router = Router();

router.use(requireAdmin);

const queryParamsSchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(50),
  platform: z.string().optional(),
  status: z.string().optional(),
  paymentMethod: z.string().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  search: z.string().optional(),
  hasCredits: z.enum(['true', 'false']).optional(),
});

/**
 * GET /api/finance/transaction-audit/overview
 * Dashboard overview of all financial activity
 */
router.get('/overview', async (_req, res) => {
  try {
    const [bookingStats] = await db.execute(sql`
      SELECT 
        COUNT(*)::int AS total_bookings,
        COUNT(*) FILTER (WHERE status = 'completed')::int AS completed_bookings,
        COUNT(*) FILTER (WHERE status = 'confirmed')::int AS confirmed_bookings,
        COUNT(*) FILTER (WHERE status = 'cancelled')::int AS cancelled_bookings,
        COALESCE(SUM(CAST(total AS DECIMAL)) FILTER (WHERE status IN ('completed', 'confirmed')), 0) AS total_revenue_ils,
        COALESCE(SUM(CAST(platform_fee AS DECIMAL)) FILTER (WHERE status IN ('completed', 'confirmed')), 0) AS total_platform_fees_ils,
        COALESCE(SUM(CAST(provider_payout AS DECIMAL)) FILTER (WHERE status IN ('completed', 'confirmed')), 0) AS total_provider_payouts_ils
      FROM bookings
      WHERE created_at >= NOW() - INTERVAL '30 days'
    `);

    const [walletStats] = await db.execute(sql`
      SELECT 
        COUNT(*)::int AS total_redemptions,
        COUNT(*) FILTER (WHERE status = 'completed')::int AS completed_redemptions,
        COALESCE(SUM(total_credits_applied_cents) FILTER (WHERE status = 'completed'), 0)::bigint AS total_credits_redeemed_cents,
        COALESCE(SUM(cash_due_cents) FILTER (WHERE status = 'completed'), 0)::bigint AS total_cash_collected_cents,
        COALESCE(SUM(egift_applied_cents) FILTER (WHERE status = 'completed'), 0)::bigint AS total_egift_redeemed_cents,
        COALESCE(SUM(wash_packages_applied) FILTER (WHERE status = 'completed'), 0)::int AS total_wash_packages_used
      FROM redemption_sessions
      WHERE created_at >= NOW() - INTERVAL '30 days'
    `);

    const [receiptStats] = await db.execute(sql`
      SELECT 
        COUNT(*)::int AS total_receipts,
        COALESCE(SUM(CAST(total_amount AS DECIMAL)), 0) AS total_receipted_amount,
        COALESCE(SUM(CAST(vat_amount AS DECIMAL)), 0) AS total_vat_collected,
        COUNT(*) FILTER (WHERE email_sent = true)::int AS receipts_emailed
      FROM digital_receipts
      WHERE issued_at >= NOW() - INTERVAL '30 days'
    `);

    const [paymentStats] = await db.execute(sql`
      SELECT 
        COUNT(*)::int AS total_transactions,
        COUNT(*) FILTER (WHERE status = 'completed')::int AS completed_transactions,
        COUNT(*) FILTER (WHERE status = 'refunded')::int AS refunded_transactions,
        COALESCE(SUM(CAST(amount AS DECIMAL)) FILTER (WHERE status = 'completed'), 0) AS total_amount
      FROM super_app_payments
      WHERE created_at >= NOW() - INTERVAL '30 days'
    `);

    const reportHash = createHash('sha256')
      .update(JSON.stringify({
        generatedAt: new Date().toISOString(),
        bookingStats: bookingStats,
        walletStats: walletStats,
        receiptStats: receiptStats,
        paymentStats: paymentStats,
      }))
      .digest('hex');

    res.json({
      success: true,
      period: 'last_30_days',
      generatedAt: new Date().toISOString(),
      reportHash,
      bookings: bookingStats,
      wallet: walletStats,
      receipts: receiptStats,
      payments: paymentStats,
    });
  } catch (error: any) {
    logger.error('[TransactionAudit] Overview error', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/finance/transaction-audit/bookings
 * Paginated booking transaction ledger with credit breakdown
 */
router.get('/bookings', async (req, res) => {
  try {
    const params = queryParamsSchema.parse(req.query);
    const offset = (params.page - 1) * params.limit;

    let whereConditions: any[] = [];
    
    if (params.platform) {
      whereConditions.push(sql`b.platform_id = ${params.platform}`);
    }
    if (params.status) {
      whereConditions.push(sql`b.status = ${params.status}`);
    }
    if (params.paymentMethod) {
      whereConditions.push(sql`b.payment_method = ${params.paymentMethod}`);
    }
    if (params.dateFrom) {
      whereConditions.push(sql`b.created_at >= ${params.dateFrom}::timestamp`);
    }
    if (params.dateTo) {
      whereConditions.push(sql`b.created_at <= ${params.dateTo}::timestamp`);
    }
    if (params.search) {
      whereConditions.push(sql`(
        b.booking_number ILIKE ${`%${params.search}%`} OR 
        b.user_id ILIKE ${`%${params.search}%`} OR
        b.id ILIKE ${`%${params.search}%`}
      )`);
    }
    if (params.hasCredits === 'true') {
      whereConditions.push(sql`b.payment_method LIKE '%wallet%'`);
    }

    const whereClause = whereConditions.length > 0 
      ? sql`WHERE ${sql.join(whereConditions, sql` AND `)}` 
      : sql``;

    const [countResult] = await db.execute(sql`
      SELECT COUNT(*)::int AS total FROM bookings b ${whereClause}
    `);

    const results = await db.execute(sql`
      SELECT 
        b.id,
        b.booking_number,
        b.platform_id,
        b.user_id,
        b.status,
        b.payment_status,
        b.payment_method,
        b.payment_intent_id,
        CAST(b.subtotal AS DECIMAL) AS subtotal,
        CAST(b.total AS DECIMAL) AS total,
        CAST(b.platform_fee AS DECIMAL) AS platform_fee,
        CAST(b.provider_payout AS DECIMAL) AS provider_payout,
        b.currency,
        b.service_type,
        b.platform_data,
        b.created_at,
        b.confirmed_at,
        b.completed_at,
        b.cancelled_at,
        dr.receipt_number,
        dr.total_amount AS receipt_total,
        dr.vat_amount AS receipt_vat,
        dr.audit_hash AS receipt_audit_hash,
        dr.issued_at AS receipt_issued_at
      FROM bookings b
      LEFT JOIN digital_receipts dr ON dr.booking_id = b.id
      ${whereClause}
      ORDER BY b.created_at DESC
      LIMIT ${params.limit} OFFSET ${offset}
    `);

    const resultRows = Array.isArray(results) ? results : (results as any).rows || [];
    const bookingsWithCredits = resultRows.map((row: any) => {
      const platformData = row.platform_data || {};
      const creditBreakdown = platformData.creditBreakdown || null;
      const paymentSplit = platformData.paymentSplit || null;

      return {
        ...row,
        creditBreakdown,
        paymentSplit,
        receiptInfo: row.receipt_number ? {
          receiptNumber: row.receipt_number,
          total: row.receipt_total,
          vat: row.receipt_vat,
          auditHash: row.receipt_audit_hash,
          issuedAt: row.receipt_issued_at,
        } : null,
      };
    });

    res.json({
      success: true,
      data: bookingsWithCredits,
      pagination: {
        page: params.page,
        limit: params.limit,
        total: (countResult as any).total || 0,
        totalPages: Math.ceil(((countResult as any).total || 0) / params.limit),
      },
    });
  } catch (error: any) {
    logger.error('[TransactionAudit] Bookings error', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/finance/transaction-audit/credit-transactions
 * All credit wallet transactions (redemptions, purchases, refunds)
 */
router.get('/credit-transactions', async (req, res) => {
  try {
    const params = queryParamsSchema.parse(req.query);
    const offset = (params.page - 1) * params.limit;

    const transactions = await db.select()
      .from(creditTransactions)
      .orderBy(desc(creditTransactions.createdAt))
      .limit(params.limit)
      .offset(offset);

    const [countResult] = await db.select({ count: sql<number>`count(*)` })
      .from(creditTransactions);

    res.json({
      success: true,
      data: transactions,
      pagination: {
        page: params.page,
        limit: params.limit,
        total: countResult?.count || 0,
        totalPages: Math.ceil((countResult?.count || 0) / params.limit),
      },
    });
  } catch (error: any) {
    logger.error('[TransactionAudit] Credit transactions error', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/finance/transaction-audit/redemption-sessions
 * All wallet redemption sessions with status
 */
router.get('/redemption-sessions', async (req, res) => {
  try {
    const params = queryParamsSchema.parse(req.query);
    const offset = (params.page - 1) * params.limit;

    const sessions = await db.select()
      .from(redemptionSessions)
      .orderBy(desc(redemptionSessions.createdAt))
      .limit(params.limit)
      .offset(offset);

    const [countResult] = await db.select({ count: sql<number>`count(*)` })
      .from(redemptionSessions);

    res.json({
      success: true,
      data: sessions,
      pagination: {
        page: params.page,
        limit: params.limit,
        total: countResult?.count || 0,
        totalPages: Math.ceil((countResult?.count || 0) / params.limit),
      },
    });
  } catch (error: any) {
    logger.error('[TransactionAudit] Redemption sessions error', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/finance/transaction-audit/receipts
 * All Israeli digital receipts
 */
router.get('/receipts', async (req, res) => {
  try {
    const params = queryParamsSchema.parse(req.query);
    const offset = (params.page - 1) * params.limit;

    const receipts = await db.select()
      .from(digitalReceipts)
      .orderBy(desc(digitalReceipts.issuedAt))
      .limit(params.limit)
      .offset(offset);

    const [countResult] = await db.select({ count: sql<number>`count(*)` })
      .from(digitalReceipts);

    res.json({
      success: true,
      data: receipts,
      pagination: {
        page: params.page,
        limit: params.limit,
        total: countResult?.count || 0,
        totalPages: Math.ceil((countResult?.count || 0) / params.limit),
      },
    });
  } catch (error: any) {
    logger.error('[TransactionAudit] Receipts error', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/finance/transaction-audit/audit-trail
 * Blockchain-style audit ledger entries
 */
router.get('/audit-trail', async (req, res) => {
  try {
    const params = queryParamsSchema.parse(req.query);
    const offset = (params.page - 1) * params.limit;

    const entries = await db.select()
      .from(auditLedger)
      .orderBy(desc(auditLedger.createdAt))
      .limit(params.limit)
      .offset(offset);

    const [countResult] = await db.select({ count: sql<number>`count(*)` })
      .from(auditLedger);

    res.json({
      success: true,
      data: entries,
      pagination: {
        page: params.page,
        limit: params.limit,
        total: countResult?.count || 0,
        totalPages: Math.ceil((countResult?.count || 0) / params.limit),
      },
    });
  } catch (error: any) {
    logger.error('[TransactionAudit] Audit trail error', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/finance/transaction-audit/booking/:bookingId/full-trail
 * Complete financial trail for a single booking (for government review)
 */
router.get('/booking/:bookingId/full-trail', async (req, res) => {
  try {
    const { bookingId } = req.params;

    const [booking] = await db.select()
      .from(bookings)
      .where(eq(bookings.id, bookingId))
      .limit(1);

    if (!booking) {
      return res.status(404).json({ success: false, error: 'Booking not found' });
    }

    const payments = await db.select()
      .from(superAppPayments)
      .where(eq(superAppPayments.bookingId, bookingId))
      .orderBy(desc(superAppPayments.createdAt));

    const receipts = await db.select()
      .from(digitalReceipts)
      .where(eq(digitalReceipts.bookingId, bookingId))
      .orderBy(desc(digitalReceipts.issuedAt));

    const auditEntries = await db.select()
      .from(auditLedger)
      .where(eq(auditLedger.targetId, bookingId))
      .orderBy(desc(auditLedger.createdAt));

    const platformData = (booking.platformData as any) || {};
    const creditBreakdown = platformData.creditBreakdown || null;
    const paymentSplit = platformData.paymentSplit || null;
    const priceSnapshot = platformData.priceSnapshot || null;

    const trailHash = createHash('sha256')
      .update(JSON.stringify({
        bookingId,
        bookingNumber: booking.bookingNumber,
        total: booking.total,
        status: booking.status,
        paymentsCount: payments.length,
        receiptsCount: receipts.length,
        auditEntriesCount: auditEntries.length,
        generatedAt: new Date().toISOString(),
      }))
      .digest('hex');

    res.json({
      success: true,
      bookingId,
      bookingNumber: booking.bookingNumber,
      trailHash,
      generatedAt: new Date().toISOString(),
      booking: {
        id: booking.id,
        bookingNumber: booking.bookingNumber,
        platformId: booking.platformId,
        userId: booking.userId,
        status: booking.status,
        paymentStatus: booking.paymentStatus,
        paymentMethod: booking.paymentMethod,
        subtotal: booking.subtotal,
        total: booking.total,
        platformFee: booking.platformFee,
        providerPayout: booking.providerPayout,
        currency: booking.currency,
        createdAt: booking.createdAt,
        confirmedAt: booking.confirmedAt,
        completedAt: booking.completedAt,
      },
      financials: {
        priceSnapshot,
        creditBreakdown,
        paymentSplit,
      },
      payments,
      receipts,
      auditTrail: auditEntries,
    });
  } catch (error: any) {
    logger.error('[TransactionAudit] Full trail error', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/finance/transaction-audit/wallet-balances
 * Current wallet balances across all users (admin monitoring)
 */
router.get('/wallet-balances', async (req, res) => {
  try {
    const params = queryParamsSchema.parse(req.query);
    const offset = (params.page - 1) * params.limit;

    const wallets = await db.select()
      .from(walletAccounts)
      .orderBy(desc(walletAccounts.lastActivityAt))
      .limit(params.limit)
      .offset(offset);

    const [countResult] = await db.select({ count: sql<number>`count(*)` })
      .from(walletAccounts);

    const [totals] = await db.execute(sql`
      SELECT 
        COALESCE(SUM(egift_balance_cents), 0)::bigint AS total_egift_cents,
        COALESCE(SUM(wash_package_credits), 0)::int AS total_wash_packages,
        COALESCE(SUM(loyalty_points_balance), 0)::int AS total_loyalty_points,
        COALESCE(SUM(promo_balance_cents), 0)::bigint AS total_promo_cents,
        COALESCE(SUM(referral_balance_cents), 0)::bigint AS total_referral_cents,
        COUNT(*) FILTER (WHERE is_active = true)::int AS active_wallets
      FROM wallet_accounts
    `);

    res.json({
      success: true,
      data: wallets,
      totals,
      pagination: {
        page: params.page,
        limit: params.limit,
        total: countResult?.count || 0,
        totalPages: Math.ceil((countResult?.count || 0) / params.limit),
      },
    });
  } catch (error: any) {
    logger.error('[TransactionAudit] Wallet balances error', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/finance/transaction-audit/compliance-report
 * Government-ready compliance report with integrity hash
 */
router.get('/compliance-report', async (req, res) => {
  try {
    const { month, year } = req.query;
    const reportMonth = parseInt(month as string) || new Date().getMonth() + 1;
    const reportYear = parseInt(year as string) || new Date().getFullYear();

    const startDate = new Date(reportYear, reportMonth - 1, 1);
    const endDate = new Date(reportYear, reportMonth, 0, 23, 59, 59);

    const [bookingSummary] = await db.execute(sql`
      SELECT 
        COUNT(*)::int AS total_bookings,
        COUNT(*) FILTER (WHERE status = 'completed')::int AS completed,
        COUNT(*) FILTER (WHERE status = 'cancelled')::int AS cancelled,
        COUNT(*) FILTER (WHERE status = 'refunded')::int AS refunded,
        COALESCE(SUM(CAST(total AS DECIMAL)) FILTER (WHERE status = 'completed'), 0) AS gross_revenue,
        COALESCE(SUM(CAST(platform_fee AS DECIMAL)) FILTER (WHERE status = 'completed'), 0) AS platform_fees,
        COALESCE(SUM(CAST(provider_payout AS DECIMAL)) FILTER (WHERE status = 'completed'), 0) AS provider_payouts
      FROM bookings
      WHERE created_at >= ${startDate.toISOString()}::timestamp
        AND created_at <= ${endDate.toISOString()}::timestamp
    `);

    const [receiptSummary] = await db.execute(sql`
      SELECT 
        COUNT(*)::int AS total_receipts,
        COALESCE(SUM(CAST(total_amount AS DECIMAL)), 0) AS total_receipted,
        COALESCE(SUM(CAST(vat_amount AS DECIMAL)), 0) AS total_vat,
        MIN(receipt_number) AS first_receipt,
        MAX(receipt_number) AS last_receipt
      FROM digital_receipts
      WHERE issued_at >= ${startDate.toISOString()}::timestamp
        AND issued_at <= ${endDate.toISOString()}::timestamp
    `);

    const [creditSummary] = await db.execute(sql`
      SELECT 
        COUNT(*)::int AS total_credit_transactions,
        COUNT(*) FILTER (WHERE transaction_type = 'redeem')::int AS redemptions,
        COUNT(*) FILTER (WHERE transaction_type = 'purchase')::int AS purchases,
        COUNT(*) FILTER (WHERE transaction_type = 'refund')::int AS refunds,
        COALESCE(SUM(ABS(amount_cents)) FILTER (WHERE transaction_type = 'redeem'), 0)::bigint AS total_redeemed_cents,
        COALESCE(SUM(amount_cents) FILTER (WHERE transaction_type = 'purchase'), 0)::bigint AS total_purchased_cents
      FROM credit_transactions
      WHERE created_at >= ${startDate.toISOString()}::timestamp
        AND created_at <= ${endDate.toISOString()}::timestamp
    `);

    const reportData = {
      period: `${reportYear}-${reportMonth.toString().padStart(2, '0')}`,
      generatedAt: new Date().toISOString(),
      company: {
        name: COMPANY_NAME_EN,
        nameHe: COMPANY_NAME_HE,
        taxId: COMPANY_TAX_ID,
        country: 'Israel',
      },
      bookings: bookingSummary,
      receipts: receiptSummary,
      credits: creditSummary,
    };

    const integrityHash = createHash('sha256')
      .update(JSON.stringify(reportData))
      .digest('hex');

    res.json({
      success: true,
      ...reportData,
      integrityHash,
      disclaimer: 'This report is generated from the Pet Wash™ financial system. All amounts in ILS. VAT rate: 18%. For Israeli Tax Authority compliance review.',
    });
  } catch (error: any) {
    logger.error('[TransactionAudit] Compliance report error', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
