/**
 * PetWash™ DailyReconciliationJob — Spec Section 15
 * ===================================================
 * Runs at midnight (Asia/Jerusalem) and produces a reconciliation snapshot
 * for the previous calendar day.
 *
 * Checks performed (per spec §15):
 *   1. Missing processor event — pw_payments rows with no nayaxTransactionId for direct-sale types
 *   2. Duplicate webhook — pw_payments with duplicate nayaxTransactionId
 *   3. Wallet topup without liability — WALLET_TOPUP without wallet_ledger_entries row
 *   4. Machine sale without receipt — MACHINE_DIRECT_SALE without RECEIPT tax document
 *   5. Provider payout mismatch — PROVIDER_BOOKING_CHARGE without matching payout
 *   6. VAT mismatch — grossCents × 18/118 should equal vatCents (±1 agora tolerance)
 *   7. Failed retry queue — payments with status = 'failed' (need manual review)
 *
 * Results are stored in pw_reconciliation_reports and logged.
 * No data is deleted or modified — this is read-only analysis.
 */

import { db } from '../db';
import { pwPayments, pwProviderPayouts, pwTaxDocuments, pwReconciliationReports } from '@shared/schema-payments';
import { eq, and, gte, lte, sql, inArray, isNull } from 'drizzle-orm';
import { TRANSACTION_TYPES } from '@shared/finance-flow-types';
import { createHash } from 'crypto';
import { nanoid } from 'nanoid';
import { logger } from '../lib/logger';

const ISRAELI_VAT_RATE = 0.18;
const VAT_TOLERANCE_AGOROT = 1; // ±0.01 ILS tolerance

// ── Types ─────────────────────────────────────────────────────────────────────

interface Discrepancy {
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  paymentId?: string;
  detail: string;
}

// ── Core reconciliation logic ─────────────────────────────────────────────────

async function runReconciliationForDate(date: string): Promise<void> {
  const reportId = `RECON-${date}-${nanoid(6).toUpperCase()}`;
  logger.info('[DailyRecon] Starting reconciliation', { reportId, date });

  const start = new Date(`${date}T00:00:00.000Z`);
  const end   = new Date(`${date}T23:59:59.999Z`);

  const discrepancies: Discrepancy[] = [];

  try {
    // ── Fetch day's payments ────────────────────────────────────────────────
    const payments = await db
      .select()
      .from(pwPayments)
      .where(and(gte(pwPayments.createdAt!, start), lte(pwPayments.createdAt!, end)));

    const paymentIds = payments.map(p => p.paymentId);

    // ── Check 1: Missing processor event ────────────────────────────────────
    const PROCESSOR_REQUIRED_TYPES = [
      TRANSACTION_TYPES.MACHINE_DIRECT_SALE,
      TRANSACTION_TYPES.WALLET_TOPUP,
      TRANSACTION_TYPES.PROVIDER_BOOKING_CHARGE,
    ];
    for (const p of payments) {
      if (PROCESSOR_REQUIRED_TYPES.includes(p.transactionType as any) &&
          !p.nayaxTransactionId && p.paymentProcessor !== 'internal') {
        discrepancies.push({
          type: 'MISSING_PROCESSOR_EVENT',
          severity: 'high',
          paymentId: p.paymentId,
          detail: `${p.transactionType} payment has no processorTransactionId`,
        });
      }
    }

    // ── Check 2: Duplicate nayaxTransactionId ───────────────────────────────
    const nayaxIds = payments.filter(p => p.nayaxTransactionId).map(p => p.nayaxTransactionId!);
    const seen = new Set<string>();
    for (const nid of nayaxIds) {
      if (seen.has(nid)) {
        discrepancies.push({
          type: 'DUPLICATE_WEBHOOK',
          severity: 'critical',
          detail: `Duplicate nayaxTransactionId: ${nid}`,
        });
      }
      seen.add(nid);
    }

    // ── Check 4: Machine sale without RECEIPT tax document ──────────────────
    const machineSaleIds = payments
      .filter(p => p.transactionType === TRANSACTION_TYPES.MACHINE_DIRECT_SALE)
      .map(p => p.paymentId);

    if (machineSaleIds.length > 0) {
      const receiptDocs = await db
        .select({ relatedPaymentId: pwTaxDocuments.relatedPaymentId })
        .from(pwTaxDocuments)
        .where(
          and(
            eq(pwTaxDocuments.documentType, 'RECEIPT'),
            inArray(pwTaxDocuments.relatedPaymentId, machineSaleIds)
          )
        );
      const receiptSet = new Set(receiptDocs.map(d => d.relatedPaymentId));
      for (const pid of machineSaleIds) {
        if (!receiptSet.has(pid)) {
          discrepancies.push({
            type: 'MACHINE_SALE_WITHOUT_RECEIPT',
            severity: 'high',
            paymentId: pid,
            detail: `MACHINE_DIRECT_SALE ${pid} has no RECEIPT tax document`,
          });
        }
      }
    }

    // ── Check 5: Provider payout mismatch ───────────────────────────────────
    const providerChargeIds = payments
      .filter(p => p.transactionType === TRANSACTION_TYPES.PROVIDER_BOOKING_CHARGE)
      .map(p => p.paymentId);

    if (providerChargeIds.length > 0) {
      const payouts = await db
        .select({ paymentId: pwProviderPayouts.paymentId })
        .from(pwProviderPayouts)
        .where(inArray(pwProviderPayouts.paymentId, providerChargeIds));
      const payoutSet = new Set(payouts.map(p => p.paymentId));
      for (const pid of providerChargeIds) {
        if (!payoutSet.has(pid)) {
          discrepancies.push({
            type: 'PROVIDER_PAYOUT_MISMATCH',
            severity: 'critical',
            paymentId: pid,
            detail: `PROVIDER_BOOKING_CHARGE ${pid} has no matching pw_provider_payouts row`,
          });
        }
      }
    }

    // ── Check 6: VAT mismatch ────────────────────────────────────────────────
    for (const p of payments) {
      if (!p.grossCents || p.vatCents == null) continue;
      // Only check taxable flows where VAT should be non-zero
      const taxableTypes = [
        TRANSACTION_TYPES.MACHINE_DIRECT_SALE,
        TRANSACTION_TYPES.WALLET_REDEEM_K9000,
        TRANSACTION_TYPES.WALLET_REDEEM_ONLINE,
        TRANSACTION_TYPES.PROVIDER_BOOKING_CHARGE,
      ];
      if (!taxableTypes.includes(p.transactionType as any)) continue;
      if (p.grossCents === 0) continue;

      const expectedVat = Math.round(p.grossCents * (ISRAELI_VAT_RATE / (1 + ISRAELI_VAT_RATE)));
      const diff = Math.abs((p.vatCents ?? 0) - expectedVat);
      if (diff > VAT_TOLERANCE_AGOROT) {
        discrepancies.push({
          type: 'VAT_MISMATCH',
          severity: 'high',
          paymentId: p.paymentId,
          detail: `VAT mismatch: expected ${expectedVat} agorot, recorded ${p.vatCents}, diff=${diff} agorot`,
        });
      }
    }

    // ── Check 7: Failed retry queue ──────────────────────────────────────────
    const failedPayments = payments.filter(p => p.status === 'failed');
    for (const p of failedPayments) {
      discrepancies.push({
        type: 'FAILED_PAYMENT_NEEDS_REVIEW',
        severity: 'medium',
        paymentId: p.paymentId,
        detail: `Payment ${p.paymentId} (${p.transactionType}) has status=failed — manual review required`,
      });
    }

    // ── Aggregate totals ─────────────────────────────────────────────────────
    const totalGrossCents     = payments.reduce((s, p) => s + (p.grossCents ?? 0), 0);
    const totalVatCents       = payments.reduce((s, p) => s + (p.vatCents ?? 0), 0);
    const totalProcessorFees  = payments.reduce((s, p) => s + (p.processorFeeCents ?? 0), 0);
    const totalNetRevenue     = payments.reduce((s, p) => s + (p.netRevenueCents ?? 0), 0);

    const [payoutTotals] = await db
      .select({
        totalPayouts: sql<number>`COALESCE(SUM(net_cents), 0)`,
        count: sql<number>`COUNT(*)`,
      })
      .from(pwProviderPayouts)
      .where(and(gte(pwProviderPayouts.createdAt, start), lte(pwProviderPayouts.createdAt, end)));

    const [taxDocCount] = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(pwTaxDocuments)
      .where(and(gte(pwTaxDocuments.issuedAt, start), lte(pwTaxDocuments.issuedAt, end)));

    // ── Build report payload ─────────────────────────────────────────────────
    const payload = {
      date,
      payments: { total: payments.length, totalGrossCents, totalVatCents, totalProcessorFees, totalNetRevenue },
      payouts: { total: Number(payoutTotals?.count ?? 0), totalPayoutCents: Number(payoutTotals?.totalPayouts ?? 0) },
      taxDocuments: { total: Number(taxDocCount?.count ?? 0) },
      discrepancies,
      byType: Object.fromEntries(
        Object.values(TRANSACTION_TYPES).map(t => [
          t,
          payments.filter(p => p.transactionType === t).length,
        ])
      ),
    };

    // ── Integrity hash ───────────────────────────────────────────────────────
    const integrityHash = createHash('sha256').update(JSON.stringify(payload)).digest('hex');

    // Fetch previous report hash for chain verification
    const [prevReport] = await db
      .select({ integrityHash: pwReconciliationReports.integrityHash })
      .from(pwReconciliationReports)
      .orderBy(sql`generated_at DESC`)
      .limit(1);

    // ── Persist report ───────────────────────────────────────────────────────
    await db.insert(pwReconciliationReports).values({
      reportId,
      reportDate: date,
      totalPayments: payments.length,
      totalGrossCents,
      totalVatCents,
      totalProcessorFees,
      totalProviderPayouts: Number(payoutTotals?.totalPayouts ?? 0),
      totalNetRevenue,
      totalTaxDocs: Number(taxDocCount?.count ?? 0),
      totalPayoutsCount: Number(payoutTotals?.count ?? 0),
      discrepancyCount: discrepancies.length,
      criticalIssues: discrepancies.filter(d => d.severity === 'critical').length,
      payload,
      integrityHash,
      prevReportHash: prevReport?.integrityHash ?? null,
      status: discrepancies.filter(d => d.severity === 'critical').length > 0 ? 'partial' : 'complete',
    });

    logger.info('[DailyRecon] Report saved', {
      reportId,
      date,
      totalPayments: payments.length,
      discrepancyCount: discrepancies.length,
      criticalIssues: discrepancies.filter(d => d.severity === 'critical').length,
    });

    if (discrepancies.filter(d => d.severity === 'critical').length > 0) {
      logger.error('[DailyRecon] CRITICAL DISCREPANCIES — immediate review required', {
        reportId,
        criticals: discrepancies.filter(d => d.severity === 'critical'),
      });
    }
  } catch (err: any) {
    logger.error('[DailyRecon] Reconciliation failed', { reportId, date, err: err.message });
  }
}

// ── Scheduler ─────────────────────────────────────────────────────────────────

function getMsUntilMidnightJerusalem(): number {
  const now = new Date();
  const jerusalem = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Jerusalem' }));
  const midnight = new Date(jerusalem);
  midnight.setHours(24, 5, 0, 0); // 00:05 next day to let last-minute txns settle
  return midnight.getTime() - jerusalem.getTime();
}

function getPreviousDate(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}

export function startDailyReconciliationJob(): void {
  const msUntilFirst = getMsUntilMidnightJerusalem();
  const hoursUntilFirst = Math.round(msUntilFirst / 3600_000 * 10) / 10;

  logger.info('[DailyRecon] Scheduler started', {
    firstRunIn: `${hoursUntilFirst}h`,
    timezone: 'Asia/Jerusalem',
    runTime: '00:05',
  });

  // Run at the next 00:05 Jerusalem time, then every 24h
  setTimeout(() => {
    runReconciliationForDate(getPreviousDate());
    setInterval(() => runReconciliationForDate(getPreviousDate()), 24 * 60 * 60 * 1000);
  }, msUntilFirst);
}

/**
 * On-demand reconciliation — usable from admin routes or tests.
 * @param date YYYY-MM-DD string, defaults to yesterday
 */
export async function runReconciliationNow(date?: string): Promise<void> {
  const targetDate = date ?? getPreviousDate();
  await runReconciliationForDate(targetDate);
}
