/**
 * Provider Payout Reconciliation — Spec Section 15
 *
 * GET  /api/admin/finance/payout-reconciliation          — run reconciliation for a date range
 * GET  /api/admin/finance/payout-reconciliation/report   — latest stored report
 * GET  /api/admin/finance/payout-reconciliation/israel   — Israel-specific compliance checks
 *
 * Cross-checks (existing):
 *   1. Every PROVIDER_BOOKING_CHARGE payment must have a pw_provider_payouts row
 *   2. Every pw_provider_payouts row must have a valid pw_payments source
 *   3. Amount consistency: payout.grossCents + commissionCents = payment.grossCents (within ±1 agora)
 *   4. Tax document exists for every payout (COMMISSION_INVOICE)
 *
 * Israel compliance cross-checks (new):
 *   5. Every completed digital_receipt must have a provider_commissions row
 *   6. Every provider_commissions row must have a withholding_remittance_ledger entry
 *   7. No 'held' withholding entries remain for voided/credit_note receipts
 *   8. SHAAM-required receipts must have a shaamAllocationNumber (or be flagged as pending)
 *   9. Form 2542 cert expiry warnings for providers whose cert expires soon
 */

import { Router } from 'express';
import { db } from '../../db';
import { pwPayments, pwProviderPayouts, pwTaxDocuments } from '@shared/schema-payments';
import {
  digitalReceipts,
  providerCommissions,
  withholdingRemittanceLedger,
  providerTaxCompliance,
} from '@shared/schema';
import { eq, and, gte, lte, isNull, sql, inArray } from 'drizzle-orm';
import { TRANSACTION_TYPES } from '@shared/finance-flow-types';
import { logger } from '../../lib/logger';
import { timingSafeAdminSecretMatch } from '../../middleware/adminAuth';

const router = Router();

// ── Auth helper ───────────────────────────────────────────────────────────────

function isAdmin(req: any): boolean {
  if (timingSafeAdminSecretMatch(req)) return true;
  const role = req.user?.role ?? req.user?.customClaims?.role;
  return ['super_admin', 'finance'].includes(role);
}

// ── Run reconciliation ────────────────────────────────────────────────────────

router.get('/', async (req, res) => {
  if (!isAdmin(req)) return res.status(403).json({ error: 'Admin only' });

  const fromDate = req.query.from ? new Date(String(req.query.from)) : new Date(Date.now() - 7 * 86400_000);
  const toDate   = req.query.to   ? new Date(String(req.query.to))   : new Date();

  try {
    // All PROVIDER_BOOKING_CHARGE payments in range
    const payments = await db
      .select()
      .from(pwPayments)
      .where(
        and(
          eq(pwPayments.transactionType, TRANSACTION_TYPES.PROVIDER_BOOKING_CHARGE),
          gte(pwPayments.createdAt!, fromDate),
          lte(pwPayments.createdAt!, toDate),
        )
      );

    // All payouts in range
    const payouts = await db
      .select()
      .from(pwProviderPayouts)
      .where(
        and(
          gte(pwProviderPayouts.createdAt, fromDate),
          lte(pwProviderPayouts.createdAt, toDate),
        )
      );

    const payoutByPaymentId = new Map(payouts.map(p => [p.paymentId, p]));
    const paymentByPaymentId = new Map(payments.map(p => [p.paymentId, p]));

    const discrepancies: Array<{
      type: string;
      severity: 'low' | 'medium' | 'high' | 'critical';
      paymentId?: string;
      payoutId?: string;
      detail: string;
    }> = [];

    // Check 1: every payment must have a payout
    for (const pay of payments) {
      if (!payoutByPaymentId.has(pay.paymentId)) {
        discrepancies.push({
          type: 'PAYMENT_WITHOUT_PAYOUT',
          severity: 'critical',
          paymentId: pay.paymentId,
          detail: `PROVIDER_BOOKING_CHARGE ${pay.paymentId} has no matching pw_provider_payouts row`,
        });
      } else {
        const payout = payoutByPaymentId.get(pay.paymentId)!;

        // Check 3: amount consistency within ±1 agora (0.01 ILS)
        const expectedPayoutGross = (pay.providerGrossCents ?? 0);
        const diff = Math.abs((payout.grossCents ?? 0) - expectedPayoutGross);
        if (diff > 1) {
          discrepancies.push({
            type: 'AMOUNT_MISMATCH',
            severity: 'high',
            paymentId: pay.paymentId,
            payoutId: payout.payoutId,
            detail: `Amount mismatch: payment.providerGrossCents=${expectedPayoutGross}, payout.grossCents=${payout.grossCents}, diff=${diff} agorot`,
          });
        }
      }
    }

    // Check 2: every payout must reference a valid payment
    for (const payout of payouts) {
      if (!paymentByPaymentId.has(payout.paymentId)) {
        discrepancies.push({
          type: 'PAYOUT_WITHOUT_PAYMENT',
          severity: 'critical',
          payoutId: payout.payoutId,
          detail: `Payout ${payout.payoutId} references payment ${payout.paymentId} which does not exist in pw_payments`,
        });
      }
    }

    // Check 4: commission invoice exists for each marketplace payout
    if (payments.length > 0) {
      const paymentIds = payments.map(p => p.paymentId);
      const commissionDocs = await db
        .select({ relatedPaymentId: pwTaxDocuments.relatedPaymentId })
        .from(pwTaxDocuments)
        .where(
          and(
            eq(pwTaxDocuments.documentType, 'COMMISSION_INVOICE'),
            inArray(pwTaxDocuments.relatedPaymentId, paymentIds)
          )
        );
      const docsSet = new Set(commissionDocs.map(d => d.relatedPaymentId));

      for (const pay of payments) {
        if ((pay.commercialModel === 'MARKETPLACE_COMMISSION') && !docsSet.has(pay.paymentId)) {
          discrepancies.push({
            type: 'MISSING_COMMISSION_INVOICE',
            severity: 'high',
            paymentId: pay.paymentId,
            detail: `No COMMISSION_INVOICE tax document found for marketplace payment ${pay.paymentId}`,
          });
        }
      }
    }

    const summary = {
      period: { from: fromDate.toISOString(), to: toDate.toISOString() },
      totalPayments: payments.length,
      totalPayouts: payouts.length,
      totalGrossCents: payments.reduce((s, p) => s + (p.grossCents ?? 0), 0),
      totalProviderPayoutCents: payouts.reduce((s, p) => s + (p.netCents ?? 0), 0),
      totalCommissionCents: payouts.reduce((s, p) => s + (p.commissionCents ?? 0), 0),
      discrepancyCount: discrepancies.length,
      criticalCount: discrepancies.filter(d => d.severity === 'critical').length,
      highCount: discrepancies.filter(d => d.severity === 'high').length,
    };

    logger.info('[PayoutReconciliation] Reconciliation run complete', summary);

    return res.status(200).json({
      success: true,
      summary,
      discrepancies,
      status: discrepancies.filter(d => d.severity === 'critical').length > 0 ? 'CRITICAL' :
              discrepancies.length > 0 ? 'DISCREPANCIES_FOUND' : 'CLEAN',
    });
  } catch (err: any) {
    logger.error('[PayoutReconciliation] Error', { err: err.message });
    return res.status(500).json({ error: 'Reconciliation failed', detail: err.message });
  }
});

// ── Israel compliance cross-checks ───────────────────────────────────────────
// GET /api/admin/finance/payout-reconciliation/israel
//
// Additional Israeli-law-specific reconciliation on top of the general checks.
// Covers:
//   • digital_receipts ↔ provider_commissions completeness
//   • withholding_remittance_ledger consistency
//   • SHAAM allocation number pending items
//   • Form 2542 cert expiry warnings (30-day lookahead)

router.get('/israel', async (req, res) => {
  if (!isAdmin(req)) return res.status(403).json({ error: 'Admin only' });

  const fromDate = req.query.from
    ? new Date(String(req.query.from))
    : new Date(Date.now() - 7 * 86_400_000);
  const toDate = req.query.to
    ? new Date(String(req.query.to))
    : new Date();

  try {
    const discrepancies: Array<{
      type: string;
      severity: 'low' | 'medium' | 'high' | 'critical';
      bookingId?: string;
      receiptNumber?: string;
      detail: string;
    }> = [];

    // ── Check 5: digital_receipts ↔ provider_commissions ─────────────────────
    const settlementReceipts = await db
      .select()
      .from(digitalReceipts)
      .where(
        sql`issued_at >= ${fromDate} AND issued_at <= ${toDate}
            AND receipt_type = 'provider_settlement'
            AND is_voided = false`,
      );

    // Build a set of booking_ids that have a commission row
    const receiptBookingIds = [...new Set(
      settlementReceipts.map(r => r.bookingId).filter(Boolean) as string[],
    )];

    let commissionBookingIds = new Set<string>();
    if (receiptBookingIds.length > 0) {
      const commRows = await db
        .select({ commissionId: providerCommissions.commissionId })
        .from(providerCommissions)
        .where(
          sql`transaction_date >= ${fromDate} AND transaction_date <= ${toDate}`,
        );
      // providerCommissions.bookingId is a numeric FK; we cross-match via commissionId suffix
      // For now flag settlement receipts that have NO matching commission row by bookingId
      const allCommissions = await db.select().from(providerCommissions).where(
        sql`transaction_date >= ${fromDate} AND transaction_date <= ${toDate}`,
      );
      commissionBookingIds = new Set(
        allCommissions.map(c => String(c.bookingId)).filter(Boolean),
      );
    }

    for (const receipt of settlementReceipts) {
      if (receipt.bookingId && !commissionBookingIds.has(receipt.bookingId)) {
        discrepancies.push({
          type: 'SETTLEMENT_WITHOUT_COMMISSION',
          severity: 'high',
          bookingId: receipt.bookingId ?? undefined,
          receiptNumber: receipt.receiptNumber,
          detail: `Settlement receipt ${receipt.receiptNumber} (booking ${receipt.bookingId}) has no matching provider_commissions row`,
        });
      }
    }

    // ── Check 6: provider_commissions ↔ withholding_remittance_ledger ────────
    const commissionRows = await db
      .select()
      .from(providerCommissions)
      .where(
        sql`transaction_date >= ${fromDate} AND transaction_date <= ${toDate}`,
      );

    const withholdingByCommission = new Map<string, typeof withholdingRemittanceLedger.$inferSelect[]>();
    if (commissionRows.length > 0) {
      const commissionIds = commissionRows.map(c => c.commissionId);
      const wrlRows = await db
        .select()
        .from(withholdingRemittanceLedger)
        .where(
          sql`commission_id = ANY(${sql.raw(`ARRAY[${commissionIds.map(id => `'${id}'`).join(',')}]`)})`,
        );
      for (const row of wrlRows) {
        if (!row.commissionId) continue;
        const arr = withholdingByCommission.get(row.commissionId) ?? [];
        arr.push(row);
        withholdingByCommission.set(row.commissionId, arr);
      }
    }

    for (const comm of commissionRows) {
      const withholdingAmt = parseFloat(String(comm.commissionAmount));
      if (withholdingAmt <= 0) continue; // no withholding due

      const wrlEntries = withholdingByCommission.get(comm.commissionId) ?? [];
      if (wrlEntries.length === 0) {
        discrepancies.push({
          type: 'COMMISSION_WITHOUT_WITHHOLDING_LEDGER',
          severity: 'high',
          detail: `Commission ${comm.commissionId} has no withholding_remittance_ledger entry`,
        });
      }
    }

    // ── Check 7: cancelled / voided receipts must have reversed withholding ──
    const voidedReceiptsInRange = await db
      .select()
      .from(digitalReceipts)
      .where(
        sql`voided_at >= ${fromDate} AND voided_at <= ${toDate} AND is_voided = true`,
      );

    for (const voided of voidedReceiptsInRange) {
      if (!voided.bookingId) continue;
      const heldRows = await db
        .select()
        .from(withholdingRemittanceLedger)
        .where(
          sql`booking_id = ${voided.bookingId} AND status = 'held'`,
        );
      if (heldRows.length > 0) {
        discrepancies.push({
          type: 'HELD_WITHHOLDING_AFTER_VOID',
          severity: 'critical',
          bookingId: voided.bookingId,
          receiptNumber: voided.receiptNumber,
          detail: `Receipt ${voided.receiptNumber} was voided but ${heldRows.length} held withholding entry/entries remain for booking ${voided.bookingId}`,
        });
      }
    }

    // ── Check 8: SHAAM required but missing allocation number ────────────────
    const shaamPending = await db
      .select()
      .from(digitalReceipts)
      .where(
        sql`issued_at >= ${fromDate} AND issued_at <= ${toDate}
            AND shaam_required = true
            AND shaam_allocation_number IS NULL
            AND is_voided = false`,
      );

    for (const r of shaamPending) {
      discrepancies.push({
        type: 'SHAAM_ALLOCATION_MISSING',
        severity: 'medium',
        bookingId: r.bookingId ?? undefined,
        receiptNumber: r.receiptNumber,
        detail: `Receipt ${r.receiptNumber} requires a SHAAM allocation number but none assigned — SHAAM API integration pending`,
      });
    }

    // ── Check 9: Form 2542 cert expiry warnings (30-day lookahead) ───────────
    const thirtyDaysFromNow = new Date(Date.now() + 30 * 86_400_000);
    const expiringCerts = await db
      .select()
      .from(providerTaxCompliance)
      .where(
        sql`withholding_cert_expiry_date IS NOT NULL
            AND withholding_cert_expiry_date <= ${thirtyDaysFromNow}
            AND withholding_cert_expiry_date >= ${new Date()}`,
      );

    for (const cert of expiringCerts) {
      discrepancies.push({
        type: 'FORM_2542_EXPIRING_SOON',
        severity: 'low',
        detail: `Provider ${cert.providerId} Form 2542 expires on ${cert.withholdingCertExpiryDate} — platform will fall back to default withholding rate after expiry`,
      });
    }

    // ── Summary ───────────────────────────────────────────────────────────────
    const summary = {
      period: { from: fromDate.toISOString(), to: toDate.toISOString() },
      checks: {
        settlementReceipts: settlementReceipts.length,
        commissionRows: commissionRows.length,
        voidedReceipts: voidedReceiptsInRange.length,
        shaamPendingCount: shaamPending.length,
        expiringCertCount: expiringCerts.length,
      },
      discrepancyCount: discrepancies.length,
      criticalCount: discrepancies.filter(d => d.severity === 'critical').length,
      highCount: discrepancies.filter(d => d.severity === 'high').length,
    };

    logger.info('[PayoutReconciliation/Israel] Israel compliance check complete', summary);

    return res.status(200).json({
      success: true,
      summary,
      discrepancies,
      status:
        discrepancies.filter(d => d.severity === 'critical').length > 0
          ? 'CRITICAL'
          : discrepancies.length > 0
          ? 'DISCREPANCIES_FOUND'
          : 'CLEAN',
    });
  } catch (err: any) {
    logger.error('[PayoutReconciliation/Israel] Error', { err: err.message });
    return res.status(500).json({ error: 'Israel compliance check failed', detail: err.message });
  }
});

export default router;
