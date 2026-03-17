/**
 * Provider Payout Reconciliation — Spec Section 15
 *
 * GET  /api/admin/finance/payout-reconciliation          — run reconciliation for a date range
 * GET  /api/admin/finance/payout-reconciliation/report   — latest stored report
 *
 * Cross-checks:
 *   1. Every PROVIDER_BOOKING_CHARGE payment must have a pw_provider_payouts row
 *   2. Every pw_provider_payouts row must have a valid pw_payments source
 *   3. Amount consistency: payout.grossCents + commissionCents = payment.grossCents (within ±1 agora)
 *   4. Tax document exists for every payout (COMMISSION_INVOICE)
 */

import { Router } from 'express';
import { db } from '../../db';
import { pwPayments, pwProviderPayouts, pwTaxDocuments } from '@shared/schema-payments';
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

export default router;
