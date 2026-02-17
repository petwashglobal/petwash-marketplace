/**
 * Financial Compliance Reconciliation Service
 * 
 * Cross-checks escrow payments, payout ledger entries, VAT records, and digital receipts
 * with a unified reconciliationId tracing money flow:
 *   customer payment → escrow hold → provider payout → VAT reporting
 * 
 * Israeli Tax Authority Compliance:
 * - Invoice number sequential verification (no gaps)
 * - B2B electronic invoicing threshold check (≥₪25,000)
 * - VAT return accuracy validation (output VAT - input VAT = net)
 * - Annual tax summary generation
 * 
 * Data Integrity:
 * - SHA-256 hashes on financial summaries
 * - Blockchain-style chaining of monthly reports
 * - Tamper detection via hash verification
 * 
 * Israeli VAT Rate: 18% | Platform Commission: 15% | Currency: ILS
 */

import admin from '../lib/firebase-admin';
import { db } from '../db';
import { contractorEarnings, electronicInvoices, digitalReceipts } from '@shared/schema';
import { logger } from '../lib/logger';
import { createHash } from 'crypto';
import { nanoid } from 'nanoid';
import { eq, and, gte, lte, desc, sql } from 'drizzle-orm';

const ISRAELI_VAT_RATE = 0.18;
const PLATFORM_COMMISSION_RATE = 0.15;
const B2B_ELECTRONIC_THRESHOLD = 25000;
const CURRENCY = 'ILS';

export interface ReconciliationLink {
  reconciliationId: string;
  escrowPaymentId: string;
  payoutLedgerEntryId: string | null;
  vatRecordId: string | null;
  digitalReceiptId: string | null;
  bookingId: string;
  customerId: string;
  providerId: string;
  amount: number;
  currency: string;
  status: 'linked' | 'partial' | 'mismatch' | 'orphaned';
  createdAt: Date;
  metadata?: any;
}

export interface MonthlyReconciliationReport {
  reportId: string;
  reportPeriod: string;
  month: number;
  year: number;
  generatedAt: Date;
  escrowSummary: {
    totalHeld: number;
    totalReleased: number;
    totalRefunded: number;
    totalDisputed: number;
    count: number;
  };
  payoutSummary: {
    totalBaseAmount: number;
    totalPlatformFees: number;
    totalVATOnFees: number;
    totalNetToProviders: number;
    count: number;
  };
  vatSummary: {
    totalVATCollected: number;
    totalOutputVAT: number;
    totalInputVAT: number;
    netVATPayable: number;
  };
  receiptSummary: {
    totalReceiptsIssued: number;
    totalReceiptAmount: number;
    count: number;
  };
  discrepancies: ReconciliationDiscrepancy[];
  integrityHash: string;
  previousReportHash: string | null;
  chainValid: boolean;
}

export interface ReconciliationDiscrepancy {
  type: 'escrow_payout_mismatch' | 'vat_calculation_error' | 'missing_receipt' | 'orphaned_record' | 'amount_mismatch' | 'invoice_gap';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  expectedValue?: number;
  actualValue?: number;
  recordIds: string[];
}

export interface InvoiceSequenceResult {
  isSequential: boolean;
  totalInvoices: number;
  gaps: Array<{ after: string; before: string; missingCount: number }>;
  duplicates: string[];
}

export interface AnnualTaxSummary {
  taxYear: number;
  generatedAt: Date;
  totalRevenue: number;
  totalPlatformCommission: number;
  totalVATCollected: number;
  totalVATRemitted: number;
  totalPayoutsToProviders: number;
  totalEscrowHeld: number;
  totalEscrowReleased: number;
  totalRefunds: number;
  monthlyBreakdown: Array<{
    month: number;
    revenue: number;
    commission: number;
    vatCollected: number;
    payouts: number;
  }>;
  complianceStatus: 'compliant' | 'warning' | 'non_compliant';
  complianceNotes: string[];
  integrityHash: string;
}

class FinancialReconciliationService {
  private firestore = admin.firestore();
  private reportChain: Map<string, string> = new Map();

  private generateHash(data: any): string {
    return createHash('sha256')
      .update(JSON.stringify(data))
      .digest('hex');
  }

  async linkTransaction(params: {
    escrowPaymentId: string;
    bookingId: string;
    customerId: string;
    providerId: string;
    amount: number;
    payoutLedgerEntryId?: string;
    vatRecordId?: string;
    digitalReceiptId?: string;
    metadata?: any;
  }): Promise<ReconciliationLink> {
    const reconciliationId = `RECON-${new Date().getFullYear()}-${nanoid(10).toUpperCase()}`;

    const hasAllLinks = !!(params.payoutLedgerEntryId && params.vatRecordId && params.digitalReceiptId);
    const hasSomeLinks = !!(params.payoutLedgerEntryId || params.vatRecordId || params.digitalReceiptId);

    const link: ReconciliationLink = {
      reconciliationId,
      escrowPaymentId: params.escrowPaymentId,
      payoutLedgerEntryId: params.payoutLedgerEntryId || null,
      vatRecordId: params.vatRecordId || null,
      digitalReceiptId: params.digitalReceiptId || null,
      bookingId: params.bookingId,
      customerId: params.customerId,
      providerId: params.providerId,
      amount: params.amount,
      currency: CURRENCY,
      status: hasAllLinks ? 'linked' : hasSomeLinks ? 'partial' : 'orphaned',
      createdAt: new Date(),
      metadata: params.metadata,
    };

    try {
      const reconciliationRef = this.firestore.collection('financial_reconciliation').doc(reconciliationId);
      await reconciliationRef.set({
        ...link,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    } catch (firestoreError: any) {
      logger.warn('[FinancialReconciliation] Firestore write failed (non-critical)', {
        reconciliationId,
        error: firestoreError.message,
      });
    }

    logger.info('[FinancialReconciliation] Transaction linked', {
      reconciliationId,
      bookingId: params.bookingId,
      status: link.status,
      amount: params.amount,
    });

    return link;
  }

  async updateReconciliationLink(
    reconciliationId: string,
    updates: Partial<Pick<ReconciliationLink, 'payoutLedgerEntryId' | 'vatRecordId' | 'digitalReceiptId' | 'status'>>
  ): Promise<void> {
    try {
      const reconciliationRef = this.firestore.collection('financial_reconciliation').doc(reconciliationId);
      const doc = await reconciliationRef.get();

      if (!doc.exists) {
        throw new Error(`Reconciliation link ${reconciliationId} not found`);
      }

      const current = doc.data() as ReconciliationLink;
      const updated = { ...current, ...updates };

      const hasAllLinks = !!(updated.payoutLedgerEntryId && updated.vatRecordId && updated.digitalReceiptId);
      if (hasAllLinks && updated.status !== 'mismatch') {
        updated.status = 'linked';
      }

      await reconciliationRef.update({
        ...updates,
        status: updated.status,
      });

      logger.info('[FinancialReconciliation] Reconciliation link updated', {
        reconciliationId,
        status: updated.status,
      });
    } catch (error: any) {
      logger.error('[FinancialReconciliation] Failed to update reconciliation link', {
        reconciliationId,
        error: error.message,
      });
      throw error;
    }
  }

  async generateMonthlyReport(month: number, year: number): Promise<MonthlyReconciliationReport> {
    const reportId = `MR-${year}-${String(month).padStart(2, '0')}-${nanoid(6).toUpperCase()}`;
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59, 999);

    logger.info('[FinancialReconciliation] Generating monthly report', { reportId, month, year });

    const [escrowSummary, payoutSummary, vatSummary, receiptSummary] = await Promise.all([
      this.getEscrowSummary(startDate, endDate),
      this.getPayoutSummary(startDate, endDate),
      this.getVATSummary(startDate, endDate),
      this.getReceiptSummary(startDate, endDate),
    ]);

    const discrepancies = this.detectDiscrepancies(escrowSummary, payoutSummary, vatSummary, receiptSummary);

    const previousReportKey = month === 1
      ? `MR-${year - 1}-12`
      : `MR-${year}-${String(month - 1).padStart(2, '0')}`;
    const previousReportHash = this.reportChain.get(previousReportKey) || null;

    const reportData = {
      reportId,
      reportPeriod: `${String(month).padStart(2, '0')}/${year}`,
      month,
      year,
      generatedAt: new Date(),
      escrowSummary,
      payoutSummary,
      vatSummary,
      receiptSummary,
      discrepancies,
      previousReportHash,
    };

    const integrityHash = this.generateHash({
      ...reportData,
      previousReportHash,
    });

    const report: MonthlyReconciliationReport = {
      ...reportData,
      integrityHash,
      chainValid: true,
    };

    const currentReportKey = `MR-${year}-${String(month).padStart(2, '0')}`;
    this.reportChain.set(currentReportKey, integrityHash);

    try {
      const reportRef = this.firestore.collection('monthly_reconciliation_reports').doc(reportId);
      await reportRef.set({
        ...report,
        generatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    } catch (firestoreError: any) {
      logger.warn('[FinancialReconciliation] Firestore report save failed (non-critical)', {
        reportId,
        error: firestoreError.message,
      });
    }

    logger.info('[FinancialReconciliation] Monthly report generated', {
      reportId,
      month,
      year,
      discrepancyCount: discrepancies.length,
      integrityHash: integrityHash.substring(0, 16) + '...',
    });

    return report;
  }

  private async getEscrowSummary(startDate: Date, endDate: Date) {
    let totalHeld = 0;
    let totalReleased = 0;
    let totalRefunded = 0;
    let totalDisputed = 0;
    let count = 0;

    try {
      const snapshot = await this.firestore
        .collection('escrow_payments')
        .where('createdAt', '>=', startDate)
        .where('createdAt', '<=', endDate)
        .get();

      for (const doc of snapshot.docs) {
        const escrow = doc.data();
        const amount = escrow.amount || 0;
        count++;

        switch (escrow.status) {
          case 'held':
            totalHeld += amount;
            break;
          case 'released':
            totalReleased += amount;
            break;
          case 'refunded':
            totalRefunded += amount;
            break;
          case 'disputed':
            totalDisputed += amount;
            break;
        }
      }
    } catch (error: any) {
      logger.error('[FinancialReconciliation] Failed to get escrow summary', {
        error: error.message,
      });
    }

    return { totalHeld, totalReleased, totalRefunded, totalDisputed, count };
  }

  private async getPayoutSummary(startDate: Date, endDate: Date) {
    let totalBaseAmount = 0;
    let totalPlatformFees = 0;
    let totalVATOnFees = 0;
    let totalNetToProviders = 0;
    let count = 0;

    try {
      const earnings = await db
        .select()
        .from(contractorEarnings)
        .where(
          and(
            gte(contractorEarnings.createdAt, startDate),
            lte(contractorEarnings.createdAt, endDate)
          )
        );

      for (const earning of earnings) {
        totalBaseAmount += parseFloat(earning.baseAmount || '0');
        totalPlatformFees += parseFloat(earning.platformFee || '0');
        totalVATOnFees += parseFloat(earning.vatAmount || '0');
        totalNetToProviders += parseFloat(earning.netEarnings || '0');
        count++;
      }
    } catch (error: any) {
      logger.error('[FinancialReconciliation] Failed to get payout summary', {
        error: error.message,
      });
    }

    return { totalBaseAmount, totalPlatformFees, totalVATOnFees, totalNetToProviders, count };
  }

  private async getVATSummary(startDate: Date, endDate: Date) {
    let totalVATCollected = 0;
    let totalOutputVAT = 0;
    let totalInputVAT = 0;

    try {
      const invoices = await db
        .select()
        .from(electronicInvoices)
        .where(
          and(
            gte(electronicInvoices.invoiceDate, startDate),
            lte(electronicInvoices.invoiceDate, endDate)
          )
        );

      for (const invoice of invoices) {
        const vatAmount = parseFloat(invoice.vatAmount || '0');
        totalVATCollected += vatAmount;
        totalOutputVAT += vatAmount;
      }
    } catch (error: any) {
      logger.error('[FinancialReconciliation] Failed to get VAT summary', {
        error: error.message,
      });
    }

    const netVATPayable = totalOutputVAT - totalInputVAT;

    return { totalVATCollected, totalOutputVAT, totalInputVAT, netVATPayable };
  }

  private async getReceiptSummary(startDate: Date, endDate: Date) {
    let totalReceiptsIssued = 0;
    let totalReceiptAmount = 0;
    let count = 0;

    try {
      const receipts = await db
        .select()
        .from(digitalReceipts)
        .where(
          and(
            gte(digitalReceipts.issuedAt, startDate),
            lte(digitalReceipts.issuedAt, endDate)
          )
        );

      for (const receipt of receipts) {
        totalReceiptAmount += parseFloat(receipt.totalAmount || '0');
        totalReceiptsIssued++;
        count++;
      }
    } catch (error: any) {
      logger.error('[FinancialReconciliation] Failed to get receipt summary', {
        error: error.message,
      });
    }

    return { totalReceiptsIssued, totalReceiptAmount, count };
  }

  private detectDiscrepancies(
    escrow: MonthlyReconciliationReport['escrowSummary'],
    payout: MonthlyReconciliationReport['payoutSummary'],
    vat: MonthlyReconciliationReport['vatSummary'],
    receipts: MonthlyReconciliationReport['receiptSummary']
  ): ReconciliationDiscrepancy[] {
    const discrepancies: ReconciliationDiscrepancy[] = [];

    const escrowReleasedTotal = escrow.totalReleased;
    const payoutTotal = payout.totalBaseAmount + payout.totalPlatformFees + payout.totalVATOnFees;
    if (escrowReleasedTotal > 0 && Math.abs(escrowReleasedTotal - payoutTotal) > 0.01) {
      discrepancies.push({
        type: 'escrow_payout_mismatch',
        severity: Math.abs(escrowReleasedTotal - payoutTotal) > 1000 ? 'high' : 'medium',
        description: `Escrow released total (₪${escrowReleasedTotal.toFixed(2)}) does not match payout total (₪${payoutTotal.toFixed(2)})`,
        expectedValue: escrowReleasedTotal,
        actualValue: payoutTotal,
        recordIds: [],
      });
    }

    const expectedVAT = payout.totalPlatformFees * ISRAELI_VAT_RATE;
    if (payout.totalPlatformFees > 0 && Math.abs(expectedVAT - payout.totalVATOnFees) > 0.01) {
      discrepancies.push({
        type: 'vat_calculation_error',
        severity: 'high',
        description: `Expected VAT on platform fees: ₪${expectedVAT.toFixed(2)}, actual VAT recorded: ₪${payout.totalVATOnFees.toFixed(2)}`,
        expectedValue: expectedVAT,
        actualValue: payout.totalVATOnFees,
        recordIds: [],
      });
    }

    if (payout.count > 0 && receipts.count === 0) {
      discrepancies.push({
        type: 'missing_receipt',
        severity: 'critical',
        description: `${payout.count} payout entries found but no digital receipts issued for the period`,
        expectedValue: payout.count,
        actualValue: 0,
        recordIds: [],
      });
    } else if (payout.count > 0 && receipts.count < payout.count) {
      discrepancies.push({
        type: 'missing_receipt',
        severity: 'medium',
        description: `${payout.count} payout entries but only ${receipts.count} receipts issued`,
        expectedValue: payout.count,
        actualValue: receipts.count,
        recordIds: [],
      });
    }

    return discrepancies;
  }

  async verifyInvoiceSequence(year: number): Promise<InvoiceSequenceResult> {
    try {
      const invoices = await db
        .select({
          invoiceNumber: electronicInvoices.invoiceNumber,
          invoiceDate: electronicInvoices.invoiceDate,
        })
        .from(electronicInvoices)
        .where(
          and(
            gte(electronicInvoices.invoiceDate, new Date(year, 0, 1)),
            lte(electronicInvoices.invoiceDate, new Date(year, 11, 31, 23, 59, 59))
          )
        )
        .orderBy(electronicInvoices.invoiceNumber);

      const invoiceNumbers = invoices.map(i => i.invoiceNumber);
      const gaps: InvoiceSequenceResult['gaps'] = [];
      const duplicates: string[] = [];
      const seen = new Set<string>();

      for (let i = 0; i < invoiceNumbers.length; i++) {
        const num = invoiceNumbers[i];

        if (seen.has(num)) {
          duplicates.push(num);
        }
        seen.add(num);

        if (i > 0) {
          const prevNum = this.extractSequenceNumber(invoiceNumbers[i - 1]);
          const currNum = this.extractSequenceNumber(num);
          if (prevNum !== null && currNum !== null && currNum - prevNum > 1) {
            gaps.push({
              after: invoiceNumbers[i - 1],
              before: num,
              missingCount: currNum - prevNum - 1,
            });
          }
        }
      }

      const result: InvoiceSequenceResult = {
        isSequential: gaps.length === 0 && duplicates.length === 0,
        totalInvoices: invoiceNumbers.length,
        gaps,
        duplicates,
      };

      logger.info('[FinancialReconciliation] Invoice sequence verification', {
        year,
        totalInvoices: result.totalInvoices,
        isSequential: result.isSequential,
        gapCount: gaps.length,
        duplicateCount: duplicates.length,
      });

      return result;
    } catch (error: any) {
      logger.error('[FinancialReconciliation] Invoice sequence verification failed', {
        error: error.message,
      });
      return {
        isSequential: false,
        totalInvoices: 0,
        gaps: [],
        duplicates: [],
      };
    }
  }

  private extractSequenceNumber(invoiceNumber: string): number | null {
    const match = invoiceNumber.match(/(\d+)$/);
    return match ? parseInt(match[1], 10) : null;
  }

  async checkB2BThresholdCompliance(startDate: Date, endDate: Date): Promise<{
    totalB2BInvoices: number;
    aboveThreshold: number;
    belowThreshold: number;
    requiresElectronic: Array<{ invoiceId: string; invoiceNumber: string; amount: number; submitted: boolean }>;
    complianceRate: string;
  }> {
    try {
      const invoices = await db
        .select()
        .from(electronicInvoices)
        .where(
          and(
            gte(electronicInvoices.invoiceDate, startDate),
            lte(electronicInvoices.invoiceDate, endDate),
            eq(electronicInvoices.invoiceType, 'B2B')
          )
        );

      const aboveThreshold = invoices.filter(inv => parseFloat(inv.totalAmount) >= B2B_ELECTRONIC_THRESHOLD);
      const belowThreshold = invoices.filter(inv => parseFloat(inv.totalAmount) < B2B_ELECTRONIC_THRESHOLD);

      const requiresElectronic = aboveThreshold.map(inv => ({
        invoiceId: inv.invoiceId,
        invoiceNumber: inv.invoiceNumber,
        amount: parseFloat(inv.totalAmount),
        submitted: inv.itaSubmissionStatus === 'submitted' || inv.itaSubmissionStatus === 'accepted',
      }));

      const submittedCount = requiresElectronic.filter(r => r.submitted).length;
      const complianceRate = aboveThreshold.length > 0
        ? ((submittedCount / aboveThreshold.length) * 100).toFixed(2) + '%'
        : '100%';

      logger.info('[FinancialReconciliation] B2B threshold compliance check', {
        totalB2B: invoices.length,
        aboveThreshold: aboveThreshold.length,
        complianceRate,
      });

      return {
        totalB2BInvoices: invoices.length,
        aboveThreshold: aboveThreshold.length,
        belowThreshold: belowThreshold.length,
        requiresElectronic,
        complianceRate,
      };
    } catch (error: any) {
      logger.error('[FinancialReconciliation] B2B threshold check failed', {
        error: error.message,
      });
      return {
        totalB2BInvoices: 0,
        aboveThreshold: 0,
        belowThreshold: 0,
        requiresElectronic: [],
        complianceRate: 'N/A',
      };
    }
  }

  async validateVATReturn(month: number, year: number): Promise<{
    isValid: boolean;
    outputVAT: number;
    inputVAT: number;
    expectedNetVAT: number;
    calculatedNetVAT: number;
    variance: number;
    errors: string[];
  }> {
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59, 999);

    const vatSummary = await this.getVATSummary(startDate, endDate);
    const payoutSummary = await this.getPayoutSummary(startDate, endDate);

    const expectedNetVAT = vatSummary.outputVAT - vatSummary.inputVAT;
    const calculatedNetVAT = payoutSummary.totalPlatformFees * ISRAELI_VAT_RATE;
    const variance = Math.abs(expectedNetVAT - calculatedNetVAT);
    const errors: string[] = [];

    if (variance > 0.01) {
      errors.push(
        `VAT return variance detected: expected ₪${expectedNetVAT.toFixed(2)}, ` +
        `calculated from platform fees ₪${calculatedNetVAT.toFixed(2)}, ` +
        `variance ₪${variance.toFixed(2)}`
      );
    }

    if (vatSummary.netVATPayable < 0) {
      errors.push(`Negative net VAT payable (₪${vatSummary.netVATPayable.toFixed(2)}) - input VAT exceeds output VAT`);
    }

    const isValid = errors.length === 0;

    logger.info('[FinancialReconciliation] VAT return validation', {
      month,
      year,
      isValid,
      outputVAT: vatSummary.outputVAT,
      inputVAT: vatSummary.inputVAT,
      expectedNetVAT,
      calculatedNetVAT,
      variance,
    });

    return {
      isValid,
      outputVAT: vatSummary.outputVAT,
      inputVAT: vatSummary.inputVAT,
      expectedNetVAT,
      calculatedNetVAT,
      variance,
      errors,
    };
  }

  async generateAnnualTaxSummary(taxYear: number): Promise<AnnualTaxSummary> {
    logger.info('[FinancialReconciliation] Generating annual tax summary', { taxYear });

    const monthlyBreakdown: AnnualTaxSummary['monthlyBreakdown'] = [];
    let totalRevenue = 0;
    let totalPlatformCommission = 0;
    let totalVATCollected = 0;
    let totalVATRemitted = 0;
    let totalPayoutsToProviders = 0;
    let totalEscrowHeld = 0;
    let totalEscrowReleased = 0;
    let totalRefunds = 0;
    const complianceNotes: string[] = [];

    for (let month = 1; month <= 12; month++) {
      const startDate = new Date(taxYear, month - 1, 1);
      const endDate = new Date(taxYear, month, 0, 23, 59, 59, 999);

      const [escrow, payout, vat] = await Promise.all([
        this.getEscrowSummary(startDate, endDate),
        this.getPayoutSummary(startDate, endDate),
        this.getVATSummary(startDate, endDate),
      ]);

      const monthlyRevenue = payout.totalBaseAmount + payout.totalPlatformFees + payout.totalVATOnFees;

      monthlyBreakdown.push({
        month,
        revenue: monthlyRevenue,
        commission: payout.totalPlatformFees,
        vatCollected: payout.totalVATOnFees,
        payouts: payout.totalNetToProviders,
      });

      totalRevenue += monthlyRevenue;
      totalPlatformCommission += payout.totalPlatformFees;
      totalVATCollected += payout.totalVATOnFees;
      totalVATRemitted += vat.netVATPayable;
      totalPayoutsToProviders += payout.totalNetToProviders;
      totalEscrowHeld += escrow.totalHeld;
      totalEscrowReleased += escrow.totalReleased;
      totalRefunds += escrow.totalRefunded;
    }

    const invoiceSequence = await this.verifyInvoiceSequence(taxYear);
    if (!invoiceSequence.isSequential) {
      complianceNotes.push(`Invoice sequence gaps detected: ${invoiceSequence.gaps.length} gaps found`);
    }

    const b2bCompliance = await this.checkB2BThresholdCompliance(
      new Date(taxYear, 0, 1),
      new Date(taxYear, 11, 31, 23, 59, 59)
    );
    if (b2bCompliance.complianceRate !== '100%' && b2bCompliance.complianceRate !== 'N/A') {
      complianceNotes.push(`B2B electronic invoicing compliance: ${b2bCompliance.complianceRate}`);
    }

    if (Math.abs(totalVATCollected - totalVATRemitted) > 1) {
      complianceNotes.push(
        `VAT collected (₪${totalVATCollected.toFixed(2)}) differs from VAT remitted (₪${totalVATRemitted.toFixed(2)})`
      );
    }

    let complianceStatus: AnnualTaxSummary['complianceStatus'] = 'compliant';
    if (complianceNotes.length > 2) {
      complianceStatus = 'non_compliant';
    } else if (complianceNotes.length > 0) {
      complianceStatus = 'warning';
    }

    const summaryData = {
      taxYear,
      generatedAt: new Date(),
      totalRevenue,
      totalPlatformCommission,
      totalVATCollected,
      totalVATRemitted,
      totalPayoutsToProviders,
      totalEscrowHeld,
      totalEscrowReleased,
      totalRefunds,
      monthlyBreakdown,
      complianceStatus,
      complianceNotes,
    };

    const integrityHash = this.generateHash(summaryData);

    const summary: AnnualTaxSummary = {
      ...summaryData,
      integrityHash,
    };

    try {
      const summaryRef = this.firestore.collection('annual_tax_summaries').doc(`${taxYear}`);
      await summaryRef.set({
        ...summary,
        generatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    } catch (firestoreError: any) {
      logger.warn('[FinancialReconciliation] Firestore annual summary save failed (non-critical)', {
        taxYear,
        error: firestoreError.message,
      });
    }

    logger.info('[FinancialReconciliation] Annual tax summary generated', {
      taxYear,
      totalRevenue,
      totalVATCollected,
      complianceStatus,
      integrityHash: integrityHash.substring(0, 16) + '...',
    });

    return summary;
  }

  async verifyReportIntegrity(reportId: string): Promise<{
    isValid: boolean;
    reportId: string;
    storedHash: string;
    calculatedHash: string;
    tamperDetected: boolean;
  }> {
    try {
      const reportRef = this.firestore.collection('monthly_reconciliation_reports').doc(reportId);
      const doc = await reportRef.get();

      if (!doc.exists) {
        throw new Error(`Report ${reportId} not found`);
      }

      const report = doc.data() as MonthlyReconciliationReport;
      const storedHash = report.integrityHash;

      const recalculatedData = {
        reportId: report.reportId,
        reportPeriod: report.reportPeriod,
        month: report.month,
        year: report.year,
        generatedAt: report.generatedAt,
        escrowSummary: report.escrowSummary,
        payoutSummary: report.payoutSummary,
        vatSummary: report.vatSummary,
        receiptSummary: report.receiptSummary,
        discrepancies: report.discrepancies,
        previousReportHash: report.previousReportHash,
      };

      const calculatedHash = this.generateHash(recalculatedData);
      const isValid = storedHash === calculatedHash;

      if (!isValid) {
        logger.warn('[FinancialReconciliation] TAMPER DETECTED on report', {
          reportId,
          storedHash: storedHash.substring(0, 16) + '...',
          calculatedHash: calculatedHash.substring(0, 16) + '...',
        });
      }

      return {
        isValid,
        reportId,
        storedHash,
        calculatedHash,
        tamperDetected: !isValid,
      };
    } catch (error: any) {
      logger.error('[FinancialReconciliation] Report integrity verification failed', {
        reportId,
        error: error.message,
      });
      return {
        isValid: false,
        reportId,
        storedHash: '',
        calculatedHash: '',
        tamperDetected: true,
      };
    }
  }

  async verifyReportChain(year: number): Promise<{
    isValid: boolean;
    totalReports: number;
    verifiedReports: number;
    brokenAt?: string;
    errors: string[];
  }> {
    const errors: string[] = [];
    let verifiedReports = 0;
    let previousHash: string | null = null;

    try {
      const snapshot = await this.firestore
        .collection('monthly_reconciliation_reports')
        .where('year', '==', year)
        .orderBy('month')
        .get();

      const reports = snapshot.docs.map(doc => doc.data() as MonthlyReconciliationReport);

      for (const report of reports) {
        if (previousHash !== null && report.previousReportHash !== previousHash) {
          errors.push(
            `Chain broken at ${report.reportPeriod}: expected previous hash ${previousHash?.substring(0, 16)}..., ` +
            `got ${report.previousReportHash?.substring(0, 16) || 'null'}...`
          );
          return {
            isValid: false,
            totalReports: reports.length,
            verifiedReports,
            brokenAt: report.reportPeriod,
            errors,
          };
        }
        previousHash = report.integrityHash;
        verifiedReports++;
      }

      logger.info('[FinancialReconciliation] Report chain verification complete', {
        year,
        totalReports: reports.length,
        verifiedReports,
        isValid: errors.length === 0,
      });

      return {
        isValid: errors.length === 0,
        totalReports: reports.length,
        verifiedReports,
        errors,
      };
    } catch (error: any) {
      logger.error('[FinancialReconciliation] Report chain verification failed', {
        year,
        error: error.message,
      });
      return {
        isValid: false,
        totalReports: 0,
        verifiedReports: 0,
        errors: [error.message],
      };
    }
  }

  async getReconciliationByBooking(bookingId: string): Promise<ReconciliationLink | null> {
    try {
      const snapshot = await this.firestore
        .collection('financial_reconciliation')
        .where('bookingId', '==', bookingId)
        .limit(1)
        .get();

      if (snapshot.empty) {
        return null;
      }

      return snapshot.docs[0].data() as ReconciliationLink;
    } catch (error: any) {
      logger.error('[FinancialReconciliation] Failed to get reconciliation by booking', {
        bookingId,
        error: error.message,
      });
      return null;
    }
  }

  async getOrphanedRecords(startDate: Date, endDate: Date): Promise<{
    orphanedEscrows: string[];
    orphanedPayouts: string[];
    orphanedReceipts: string[];
  }> {
    const orphanedEscrows: string[] = [];
    const orphanedPayouts: string[] = [];
    const orphanedReceipts: string[] = [];

    try {
      const reconciliations = await this.firestore
        .collection('financial_reconciliation')
        .where('createdAt', '>=', startDate)
        .where('createdAt', '<=', endDate)
        .get();

      for (const doc of reconciliations.docs) {
        const link = doc.data() as ReconciliationLink;
        if (link.status === 'orphaned') {
          orphanedEscrows.push(link.escrowPaymentId);
        }
        if (link.status === 'partial') {
          if (!link.payoutLedgerEntryId) orphanedPayouts.push(link.reconciliationId);
          if (!link.digitalReceiptId) orphanedReceipts.push(link.reconciliationId);
        }
      }
    } catch (error: any) {
      logger.error('[FinancialReconciliation] Failed to get orphaned records', {
        error: error.message,
      });
    }

    return { orphanedEscrows, orphanedPayouts, orphanedReceipts };
  }
}

export default new FinancialReconciliationService();
