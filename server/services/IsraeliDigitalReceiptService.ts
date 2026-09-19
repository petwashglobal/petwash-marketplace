/**
 * ISRAELI DIGITAL RECEIPT SERVICE (שירות קבלות דיגיטליות)
 * 
 * Israeli Tax Authority compliant digital receipts - per Israeli law 2026
 * Implements the marketplace broker broker model for subcontractors:
 * - Customer pays Pet Wash Ltd (platform)
 * - Platform deducts broker commission + VAT
 * - Platform applies withholding tax (ניכוי מס במקור) on provider payout
 * - Provider receives net payment after all deductions
 * 
 * Legal Requirements:
 * 1. Sequential receipt numbering (מספר קבלה רץ)
 * 2. VAT breakdown at 18% (מע"מ 18%)
 * 3. Company registration details (ח.פ)
 * 4. Digital receipt emailed to customer
 * 5. Receipt recorded in internal accounting system
 * 6. SHA-256 audit hash for tamper detection
 * 7. Withholding tax deducted from subcontractor payments
 * 
 * References:
 * - Israeli VAT Law (חוק מע"מ)
 * - Israeli Income Tax Ordinance (פקודת מס הכנסה)
 * - Israeli Bookkeeping Law (חוק ניהול ספרים)
 * - Israeli Digital Invoice Law 2024/2025 (חוק חשבוניות דיגיטליות)
 */

import { db, pool } from '../db';
import {
  runFiscalDocumentAndPersistOnFailure,
  FiscalOutboxUnavailableError,
} from './fiscalDocumentOutbox';
import { digitalReceipts, providerCommissions, withholdingRemittanceLedger, octopusLedger } from '@shared/schema';
import { eq, and, sql, desc } from 'drizzle-orm';
import { logger } from '../lib/logger';
import { getSumitDocumentMapping, type PetWashPaymentClass } from './sumitDocumentMapping';
import { nanoid } from 'nanoid';
import { createHash } from 'crypto';
import { createMailService, isSendGridConfigured } from '../lib/sendgrid';
import { appendFormSubmission } from './googleSheetsIntegration';
import { allocateTaxSequenceNumber } from './TaxSequenceService';
import { generateCommissionInvoiceNumber } from '../lib/invoiceSequence';
import { SUPPORT_EMAIL as CANONICAL_SUPPORT_EMAIL, SUPPORT_WHATSAPP_URL } from '@shared/support-contact';

import {
  ISRAEL_VAT_RATE as ISRAELI_VAT_RATE,
  WITHHOLDING_RATE_POLICY,
  COMPANY_TAX_ID as CONFIG_COMPANY_TAX_ID,
  COMPANY_NAME_EN as CONFIG_COMPANY_NAME,
  COMPANY_NAME_HE as CONFIG_COMPANY_NAME_HE,
  resolveWithholdingRate,
  getWithholdingPeriod,
  isShaamAllocationRequired,
} from '@shared/israel-compliance-config';

/** The slice of SumitClient this service issues documents through. */
export interface SumitIssuer {
  createCustomerReceipt: (i: any) => Promise<{ sumitDocumentId?: string; reason?: string }>;
  createCreditDocument: (i: any) => Promise<{ sumitDocumentId?: string; reason?: string }>;
  findDocumentByExternalReference: (i: {
    externalReference: string; documentTypes: string[]; createAttemptAt: Date | null | undefined;
  }) => Promise<
    | { outcome: 'FOUND' | 'FOUND_MISMATCH'; documentId: string; documentNumber?: string; documentType?: string }
    | { outcome: 'ABSENT' }
    | { outcome: 'INCONCLUSIVE'; reason: string }
  >;
}

/**
 * What a SUMIT dispatch did. Every outcome that leaves a paid sale or a refund
 * WITHOUT its SUMIT document throws instead — see issueOnceAtSumit.
 */
/**
 * The amounts a credit note must carry, mirroring the document it reverses
 * (2026-09-17).
 *
 * A credit reverses the SAME share of the SAME document: refunding a fraction
 * of a sale credits that fraction of its VAT, and — for a marketplace booking,
 * whose Pet Wash document covers only Pet Wash's fee (one money model,
 * shared/marketplaceMoney.ts) — credits only that fraction of the fee at SUMIT.
 *
 * Before: VAT was 18/118 of the whole refund whatever the original said, and
 * SUMIT was credited the whole refund. A full refund of a ₪1,150 walk credited
 * ₪1,150 (VAT ₪175.42) against a Pet Wash invoice of ₪150 (VAT ₪22.88), and a
 * refunded eGift credited VAT that was never charged.
 */
export function creditNoteAmounts(original: {
  totalAmount: string | number | null;
  vatAmount: string | number | null;
  providerPayoutAmount?: string | number | null;
  brokerCommissionAmount?: string | number | null;
  platformFeeAmount?: string | number | null;
}, refundAmount: number): {
  refund: number;
  ratio: number;
  localVat: number;
  localSubtotal: number;
  sumitTotal: number;
  sumitVat: number;
  feeOnly: boolean;
} {
  const n = (v: unknown) => {
    const x = Number(v);
    return Number.isFinite(x) ? Math.abs(x) : 0;
  };
  const r2 = (x: number) => Math.round(x * 100) / 100;
  const refund = r2(Math.abs(refundAmount));
  const originalTotal = n(original.totalAmount);
  const ratio = originalTotal > 0 ? Math.min(1, refund / originalTotal) : 1;
  const localVat = r2(n(original.vatAmount) * ratio);
  const feeOnly = n(original.providerPayoutAmount) > 0;
  const fee = n(original.brokerCommissionAmount) || n(original.platformFeeAmount);
  const sumitTotal = feeOnly ? r2(fee * ratio) : refund;
  return {
    refund,
    ratio,
    localVat,
    localSubtotal: r2(refund - localVat),
    sumitTotal,
    // The original's VAT already sits on the part Pet Wash documented (the fee
    // for a marketplace booking, the whole sale otherwise) — same share.
    sumitVat: localVat,
    feeOnly,
  };
}

/**
 * A sale was paid for and no tax document could be written. One open alert per
 * booking in the admin alert centre, so it is fixed by hand today rather than
 * found in a VAT return. Never throws — the money has already moved.
 */
export async function raiseMissingReceiptAlert(input: {
  bookingId: string; platform: string; totalAmount: number; error: string;
}): Promise<void> {
  try {
    const { createOrUpdateAlert } = await import('./AlertEngine');
    await createOrUpdateAlert({
      dedupeKey: `receipt_missing:${input.bookingId}`,
      category: 'finance_doc',
      severity: 'critical',
      title: 'Paid sale with no tax document',
      message: `${input.platform} ${input.bookingId} was paid ₪${Number(input.totalAmount ?? 0).toFixed(2)} but no receipt could be written (${input.error}). Issue the document in SUMIT and check the customer got it.`,
      linkedEntityType: 'booking',
      linkedEntityId: input.bookingId,
      source: 'receipt_engine',
      metadata: { platform: input.platform, totalAmount: input.totalAmount, error: input.error },
    });
  } catch {
    /* an alert failure must never turn into a failed sale */
  }
}

export type SumitDispatchResult = {
  status: 'issued' | 'recovered' | 'already_issued' | 'not_wired' | 'nothing_to_issue';
  sumitDocumentId?: string;
};

const PLATFORM_COMMISSION_RATE = 0.15; // Flat 15% on all platforms
const DEFAULT_WITHHOLDING_TAX_RATE = WITHHOLDING_RATE_POLICY.defaultRate;
const COMPANY_NAME = CONFIG_COMPANY_NAME;
const COMPANY_NAME_HE = CONFIG_COMPANY_NAME_HE;
const COMPANY_TAX_ID = CONFIG_COMPANY_TAX_ID;
const COMPANY_ADDRESS = 'ישראל';
const FROM_EMAIL = 'noreply@petwash.co.il';
const FROM_NAME = '⁦PetWash™⁩';

export interface ReceiptGenerationParams {
  platform: string;
  /**
   * PetWash payment class — drives the SUMIT document type per the CPA mapping
   * (getSumitDocumentMapping). Optional: when omitted, SUMIT issues the default
   * InvoiceAndReceipt. Used only when SUMIT is the issuer (isWired()); the local
   * self-issued PW- path is unchanged.
   */
  paymentClass?: PetWashPaymentClass;
  bookingId: string;
  nayaxTransactionId?: string;
  customerEmail: string;
  customerName?: string;
  customerPhone?: string;
  /**
   * The customer's account id (CEO 2026-09-19: "transaction id user id").
   * Display + support tracing only — printed on the receipt so a customer
   * question can be tied to an account without a database lookup. Never a
   * DB column, exactly like the display-only address field further down.
   */
  customerId?: string;
  providerName?: string;
  providerId?: string;
  providerType?: string;
  serviceDescription: string;
  serviceDescriptionHe: string;
  /**
   * Pre-rendered service / delivery address (via shared/formatAddress). DISPLAY
   * ONLY — shown on the receipt so the customer sees where the service/goods went.
   * Never affects amount, VAT (vatMode/resolveReceiptVat), the tax sequence, or
   * the bookingId dedup key. Omit for stored-value (wallet/eGift). (2026-07-29)
   */
  serviceAddress?: string;
  subtotalAmount: number;
  platformFeeAmount: number;
  totalAmount: number;
  paymentMethod: string;
  providerPayoutAmount?: number;
  brokerCommissionAmount?: number;
}

export interface ReceiptResult {
  success: boolean;
  receiptNumber?: string;
  receiptId?: number;
  emailSent?: boolean;
  accountingRecorded?: boolean;
  error?: string;
}

export interface ProviderSettlementParams {
  bookingId: string;
  providerId: string;
  providerType: string;
  grossPayoutAmount: number;
  hasWithholdingExemption?: boolean;
  exemptionPercentage?: number;
  providerWithholdingRate?: number;
  isVatRegistered?: boolean;
  // ── Stage 2: Osek classification drives VAT and withholding logic ──────────
  // osek_patur: annual revenue < ₪120,000 — exempt from VAT, withholding applies
  // osek_murshe: annual revenue ≥ ₪120,000 — VAT registered, commission includes 18% VAT
  // When undefined the service falls back to legacy behaviour.
  osekType?: "osek_patur" | "osek_murshe";
  // ── Form 2542: ITA withholding certificate ─────────────────────────────────
  // withholdingCertExpiryDate: expiry date from providerTaxCompliance table.
  // If today > expiryDate, the certificate has lapsed and DEFAULT_WITHHOLDING_TAX_RATE applies.
  // withholdingCertRate: the specific reduced rate (0–100) granted by the ITA certificate.
  withholdingCertExpiryDate?: Date;
  withholdingCertRate?: number; // e.g. 5 for 5% — overrides providerWithholdingRate when cert is valid
  /**
   * The Pet Wash fee ACTUALLY charged on this booking, in ILS, when the caller
   * stored it. Preferred over the back-calculation below, which assumes the fee
   * was taken OUT of the payout (payout × 15% / 85%). Under the fee-on-top model
   * (shared/marketplaceMoney.ts) the payout is the full rate and that formula
   * would book ₪176.47 of commission on a ₪1,000 stay whose fee was ₪150.
   * For a booking made under the old model the two agree, so passing the stored
   * fee is correct for both.
   */
  brokerCommissionAmount?: number;
}

export interface ProviderSettlementResult {
  grossPayout: number;
  withholdingTaxRate: number;
  withholdingTaxAmount: number;
  vatOnCommission: number;
  brokerCommission: number;
  netPaymentToProvider: number;
  commissionId: string;
  osekType?: "osek_patur" | "osek_murshe"; // echoed back for P&L ledger storage
}

export class IsraeliDigitalReceiptService {

  /**
   * Determine whether a SHAAM allocation number is required for this invoice.
   * Israeli ITA Digital Invoice Law 2026:
   *   Phase 1 (1.1.2026): required when ex-VAT amount > ₪10,000
   *   Phase 2 (1.6.2026): required when ex-VAT amount > ₪5,000
   */
  static isShaamRequired(exVatAmount: number, invoiceDate: Date = new Date()): boolean {
    return isShaamAllocationRequired(exVatAmount, invoiceDate);
  }

  /**
   * Compute the reporting period string "YYYY-QN" for a given date.
   * Used as the period key in the withholding_remittance_ledger.
   */
  static getReportingPeriod(date: Date = new Date()): string {
    return getWithholdingPeriod(date);
  }

  /**
   * Generate next sequential receipt number — ITA compliant, concurrent-safe.
   * Format: PW-YYYY-XXXXXX (Pet Wash - Year - Sequential)
   *
   * Uses TaxSequenceService (pg_advisory_lock + MAX FOR UPDATE) instead of
   * the previous SELECT MAX + 1 pattern which was racy under concurrent
   * inserts and could produce duplicate receipt numbers — a violation of
   * Israeli law (חוק ניהול ספרים / ITA digital invoice regulations).
   */
  static async generateReceiptNumber(): Promise<string> {
    const { year, sequenceNumber } = await allocateTaxSequenceNumber('RECEIPT');

    // The allocator reads MAX from pw_tax_documents, but this ledger
    // (digital_receipts, UNIQUE on receipt_number) advances independently of
    // it. Floor the candidate at this ledger's own MAX for the year so the
    // number is monotonic HERE too — otherwise a receipt issued between
    // pw_tax_documents RECEIPT rows collides with an earlier digital receipt.
    const prefix = `PW-${year}-`;
    const [row] = await db
      .select({
        maxSeq: sql<number | null>`MAX(CAST(SUBSTRING(${digitalReceipts.receiptNumber} FROM ${prefix.length + 1}) AS INTEGER))`,
      })
      .from(digitalReceipts)
      .where(sql`${digitalReceipts.receiptNumber} ~ ${`^${prefix}[0-9]+$`}`);

    const ownMax = Number(row?.maxSeq ?? 0) || 0;
    const seq = Math.max(sequenceNumber, ownMax + 1);
    return `${prefix}${seq.toString().padStart(6, '0')}`;
  }

  /**
   * Allocate a receipt number and run the caller's INSERT, retrying with a
   * FRESH number if the insert loses a receipt_number unique race (Postgres
   * 23505). Two concurrent issuances can allocate the same candidate — the
   * loser must re-allocate (which now sees the winner's committed row), not
   * throw. Without this, one of two simultaneous receipts crashes.
   */
  private static async withReceiptNumberRetry<T>(
    insertWithNumber: (receiptNumber: string) => Promise<T>,
    maxAttempts = 3,
  ): Promise<T> {
    let lastErr: unknown;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const receiptNumber = await this.generateReceiptNumber();
      try {
        return await insertWithNumber(receiptNumber);
      } catch (err: any) {
        const code = err?.code ?? err?.cause?.code;
        if (code !== '23505' || attempt === maxAttempts) throw err;
        lastErr = err;
        logger.warn('[Digital Receipt] receipt_number unique race — retrying with a fresh number', {
          attempt, receiptNumber, error: err?.message,
        });
        await new Promise((r) => setTimeout(r, 50 * attempt));
      }
    }
    throw lastErr;
  }

  /**
   * Generate SHA-256 audit hash for tamper detection
   */
  static generateAuditHash(data: Record<string, any>): string {
    const hashInput = JSON.stringify({
      receiptNumber: data.receiptNumber,
      totalAmount: data.totalAmount,
      vatAmount: data.vatAmount,
      customerEmail: data.customerEmail,
      issuedAt: data.issuedAt,
      companyTaxId: COMPANY_TAX_ID,
    });
    return createHash('sha256').update(hashInput).digest('hex');
  }

  /**
   * Calculate VAT breakdown for customer receipt
   * Israeli law: Total amount includes VAT at 18%
   */
  static calculateVATBreakdown(totalAmountIncludingVAT: number): {
    subtotalBeforeVAT: number;
    vatAmount: number;
    totalAmount: number;
  } {
    const subtotalBeforeVAT = parseFloat((totalAmountIncludingVAT / (1 + ISRAELI_VAT_RATE)).toFixed(2));
    const vatAmount = parseFloat((totalAmountIncludingVAT - subtotalBeforeVAT).toFixed(2));
    return {
      subtotalBeforeVAT,
      vatAmount,
      totalAmount: totalAmountIncludingVAT,
    };
  }

  /**
   * VAT breakdown that HONOURS the CPA's per-payment-class vatMode
   * (getSumitDocumentMapping) — fix P0-4, 2026-07-25.
   *
   * Before this, generateReceipt always booked 18% on the FULL amount, ignoring
   * the vatMode the call sites already declare via `paymentClass`. That made
   * every stored-value top-up (eGift/wallet) charge VAT it shouldn't, and every
   * disclosed-agent booking book VAT on the whole gross instead of on PetWash's
   * commission. The call sites were already correct; only the engine was wrong.
   *
   *   - FULL_VAT / VAT_AT_REDEMPTION → 18% extracted from the full total.
   *   - NO_VAT_STORED_VALUE          → zero VAT now (tax event is at redemption).
   *   - VAT_ON_COMMISSION_ONLY       → 18% extracted from PetWash's commission
   *                                    only (disclosed-agent), matching
   *                                    VATCalculatorService.calculateMarketplaceVAT.
   *   - CREDIT / no class            → full VAT (safe default; credit notes use
   *                                    the dedicated issueCreditNote path).
   */
  static resolveReceiptVat(params: ReceiptGenerationParams): {
    subtotalBeforeVAT: number;
    vatAmount: number;
    totalAmount: number;
    vatRatePct: number;
  } {
    const vatMode = params.paymentClass
      ? getSumitDocumentMapping(params.paymentClass).vatMode
      : 'FULL_VAT';
    const total = params.totalAmount;
    const fullRatePct = parseFloat((ISRAELI_VAT_RATE * 100).toFixed(2));

    switch (vatMode) {
      case 'NO_VAT_STORED_VALUE':
        return { subtotalBeforeVAT: parseFloat(total.toFixed(2)), vatAmount: 0, totalAmount: total, vatRatePct: 0 };

      case 'VAT_ON_COMMISSION_ONLY': {
        // Commission is VAT-inclusive; extract the VAT portion of it only.
        // `|| ` not `??`: a ZERO commission on a paid provider booking means the
        // caller failed to compute the fee, not that PetWash worked for free —
        // `0 ?? x` kept the 0 and issued receipts declaring ₪0 VAT for every
        // quote-engine booking (2026-07-30 audit). Fall back to the canonical
        // 15% of the total so the tax document is never understated.
        const commissionGross =
          params.brokerCommissionAmount || params.platformFeeAmount || total * PLATFORM_COMMISSION_RATE;
        const vatAmount = this.calculateVATBreakdown(commissionGross).vatAmount;
        return {
          subtotalBeforeVAT: parseFloat((total - vatAmount).toFixed(2)),
          vatAmount,
          totalAmount: total,
          vatRatePct: fullRatePct,
        };
      }

      case 'FULL_VAT':
      case 'VAT_AT_REDEMPTION':
      default: {
        const b = this.calculateVATBreakdown(total);
        return { ...b, vatRatePct: fullRatePct };
      }
    }
  }

  /**
   * Calculate provider settlement with Israeli law deductions
   * Implements marketplace broker subcontractor model:
   * 1. Gross payout = customer payment - platform commission
   * 2. Withholding tax deducted at source (ניכוי מס במקור)
   * 3. Net payment = gross - withholding tax
   */
  static calculateProviderSettlement(params: ProviderSettlementParams): ProviderSettlementResult {
    const {
      grossPayoutAmount,
      hasWithholdingExemption = false,
      exemptionPercentage = 0,
      providerWithholdingRate,
      isVatRegistered = false,
      osekType,
      withholdingCertExpiryDate,
      withholdingCertRate,
    } = params;

    // ── Osek Patur / Osek Murshe differentiation (Israeli 2026 rules) ──────────
    // Osek Patur (עוסק פטור, < ₪122,833/year in 2026):
    //   • NOT VAT-registered → does NOT charge VAT on their services
    //   • Platform's broker commission does NOT carry a provider-side VAT obligation
    //   • Withholding tax (ניכוי מס במקור) STILL applies at policy default or individual rate
    //
    // Osek Murshe (עוסק מורשה, ≥ ₪122,833/year in 2026):
    //   • IS VAT-registered → charges VAT on their services
    //   • Platform's broker commission invoice to the Osek Murshe carries 18% VAT
    //   • Withholding tax STILL applies; however the net-payout is from the pre-VAT base
    //
    // When osekType is undefined we fall back to the legacy isVatRegistered flag.
    const resolvedIsVatRegistered =
      osekType === 'osek_murshe' ? true :
      osekType === 'osek_patur' ? false :
      isVatRegistered;

    // ── Form 2542 expiry check via shared config ─────────────────────────────────
    // resolveWithholdingRate() checks cert validity against today's date.
    // If the certificate has lapsed we MUST fall back to the policy default rate.
    const wh = resolveWithholdingRate(withholdingCertExpiryDate, withholdingCertRate);

    let effectiveRate = wh.rate;

    // Legacy manual override (providerWithholdingRate) — only used when there is no cert
    if (wh.source === 'policy_default' && providerWithholdingRate !== undefined) {
      effectiveRate = providerWithholdingRate / 100;
    }

    // Legacy exemption logic — only applies when certificate is NOT being used
    if (wh.source === 'policy_default' && hasWithholdingExemption && exemptionPercentage > 0) {
      effectiveRate = effectiveRate * (1 - exemptionPercentage / 100);
    }

    const withholdingTaxAmount = parseFloat((grossPayoutAmount * effectiveRate).toFixed(2));
    const netPaymentToProvider = parseFloat((grossPayoutAmount - withholdingTaxAmount).toFixed(2));

    const storedFee = Number(params.brokerCommissionAmount);
    const brokerCommission = Number.isFinite(storedFee) && storedFee >= 0
      ? parseFloat(storedFee.toFixed(2))
      // Legacy callers that stored no fee: the old net-model back-calculation.
      : parseFloat((grossPayoutAmount * PLATFORM_COMMISSION_RATE / (1 - PLATFORM_COMMISSION_RATE)).toFixed(2));
    // Only Osek Murshe providers result in a VAT-carrying invoice for the broker commission.
    // Osek Patur providers are VAT-exempt — the platform does not owe VAT on their behalf.
    const vatOnCommission = resolvedIsVatRegistered
      ? parseFloat((brokerCommission * ISRAELI_VAT_RATE / (1 + ISRAELI_VAT_RATE)).toFixed(2))
      : 0;

    const commissionId = `COMM-${new Date().getFullYear()}-${nanoid(8).toUpperCase()}`;

    return {
      grossPayout: grossPayoutAmount,
      withholdingTaxRate: effectiveRate,
      withholdingTaxAmount,
      vatOnCommission,
      brokerCommission,
      netPaymentToProvider,
      commissionId,
      osekType,
    };
  }

  /**
   * Generate and save digital receipt (קבלה דיגיטלית)
   * Records in PostgreSQL for accounting compliance
   */
  /**
   * The SUMIT leg of a customer receipt, re-runnable (2026-09-13). Loads the
   * local PW- row, skips when SUMIT is not wired or the row already carries a
   * sumit_document_id, otherwise issues the per-class document and stamps the
   * id back. THROWS on a SUMIT/network failure so the outbox drainer retries.
   * Idempotent at SUMIT via idempotencyKey = receiptNumber.
   */
  static async dispatchReceiptToSumit(params: { receiptId: number; paymentClass?: PetWashPaymentClass; retry?: boolean }): Promise<SumitDispatchResult> {
    const { sumitClient } = await import('./SumitClient');
    if (sumitClient.isWired()) {
      return IsraeliDigitalReceiptService.dispatchReceiptToSumitWired(sumitClient as unknown as SumitIssuer, params);
    }
    return { status: 'not_wired' };
  }

  /**
   * Issue ONE document at SUMIT, safely retryable (2026-09-17).
   *
   * Before: a SUMIT rejection or a dropped connection came back as "no document
   * id" WITHOUT throwing, so runFiscalDocumentAndPersistOnFailure counted it as
   * success, nothing was queued, and a paid customer had no legal document.
   * Blindly throwing is not enough either: when the request reached SUMIT and
   * only the reply was lost, a retry would issue a SECOND legal document, which
   * can never be deleted — only credited.
   *
   * So: on a retry, READ BEFORE RECREATE (the same guard the Nayax rails use).
   *   FOUND          → link the existing document.
   *   ABSENT         → create it.
   *   MISMATCH / INCONCLUSIVE → do not create; throw, so the outbox keeps it and
   *                    eventually marks it failed_needs_review for a person.
   * And any create that returns no document id THROWS, so the outbox retries it.
   */
  static async issueOnceAtSumit(opts: {
    sumitClient: SumitIssuer;
    retry: boolean;
    externalReference: string;
    documentTypes: string[];
    createAttemptAt: Date;
    create: () => Promise<{ sumitDocumentId?: string; reason?: string }>;
  }): Promise<{ sumitDocumentId: string; recovered: boolean }> {
    if (opts.retry) {
      const lookup = await opts.sumitClient.findDocumentByExternalReference({
        externalReference: opts.externalReference,
        documentTypes: opts.documentTypes,
        createAttemptAt: opts.createAttemptAt,
      });
      if (lookup.outcome === 'FOUND') {
        return { sumitDocumentId: String(lookup.documentId), recovered: true };
      }
      if (lookup.outcome !== 'ABSENT') {
        const why = lookup.outcome === 'FOUND_MISMATCH'
          ? `reference exists under another document type (${lookup.documentType ?? '?'})`
          : `lookup inconclusive (${(lookup as { reason?: string }).reason ?? '?'})`;
        throw new Error(`SUMIT_RECONCILE_NEEDED:${opts.externalReference}: ${why}`);
      }
    }
    const result = await opts.create();
    if (!result.sumitDocumentId) {
      throw new Error(`SUMIT_NOT_ISSUED:${opts.externalReference}: ${result.reason ?? 'no document id returned'}`);
    }
    return { sumitDocumentId: String(result.sumitDocumentId), recovered: false };
  }

  private static async dispatchReceiptToSumitWired(
    sumitClient: SumitIssuer,
    params: { receiptId: number; paymentClass?: PetWashPaymentClass; retry?: boolean },
  ): Promise<SumitDispatchResult> {
    const [row] = await db.select().from(digitalReceipts).where(eq(digitalReceipts.id, params.receiptId)).limit(1);
    if (!row) throw new Error(`RECEIPT_NOT_FOUND:${params.receiptId}`);
    if (row.sumitDocumentId) return { status: 'already_issued', sumitDocumentId: row.sumitDocumentId };
    const receiptNumber = row.receiptNumber;

    // Per-class SUMIT document type from the CPA mapping (#1359). Refund
    // classes go through the credit-note path, not here, so a CreditInvoice
    // mapping is never used for a customer receipt.
    const classDocType = params.paymentClass
      ? getSumitDocumentMapping(params.paymentClass).documentType
      : undefined;

    // MARKETPLACE GROSS MODEL (CEO 2026-09-14 — Rover / Mad Paws; the design in
    // docs/finance/00-platform-role-model.md §0.6–0.7):
    //   • the provider is the legal seller of the service and invoices the
    //     customer for their own price (gross), from their own books;
    //   • Pet Wash's revenue is ONLY its platform fee, charged to the customer on
    //     top of the provider's price (quoteEngine: total = subtotal + 15%).
    // So Pet Wash's document for a marketplace booking covers the FEE AMOUNT ONLY,
    // VAT-inclusive, as the canonical already-paid document
    // (sumitDocTypeForPaidSale → חשבונית מס/קבלה). It never covers the
    // provider's service. (Replaces the 2026-09-13 withhold: the old call sent
    // the whole booking as a pre-VAT line — ₪100 → ₪115.30 with ₪17.59 VAT.)
    if (params.paymentClass && getSumitDocumentMapping(params.paymentClass).vatMode === 'VAT_ON_COMMISSION_ONLY') {
      const feeIls = Number(row.brokerCommissionAmount ?? row.platformFeeAmount ?? 0);
      if (!(feeIls > 0)) {
        logger.warn('[Digital Receipt] marketplace booking with no platform fee — nothing of Pet Wash\'s to document', { receiptNumber });
        return { status: 'nothing_to_issue' };
      }
      const feeVat = Math.round((feeIls - feeIls / (1 + ISRAELI_VAT_RATE)) * 100) / 100;
      const fee = await IsraeliDigitalReceiptService.issueOnceAtSumit({
        sumitClient,
        retry: params.retry === true,
        externalReference: receiptNumber,
        documentTypes: ['InvoiceAndReceipt'],
        createAttemptAt: new Date(row.issuedAt ?? Date.now()),
        create: () => sumitClient.createCustomerReceipt({
        idempotencyKey: receiptNumber,
        documentType: 'InvoiceAndReceipt',
        customer: {
          name: row.customerName || row.customerEmail || '',
          email: row.customerEmail || undefined,
          phone: row.customerPhone || undefined,
        },
        description: `דמי שירות פלטפורמת Pet Wash™ — ${row.bookingId ?? receiptNumber}. השירות עצמו ניתן ומחויב על ידי נותן השירות.`,
        amountBeforeVat: Math.round((feeIls - feeVat) * 100) / 100,
        vatAmount: feeVat,
        totalAmount: feeIls,
        currency: 'ILS',
        context: { platform: row.platform, bookingId: row.bookingId ?? undefined, receiptNumber, kind: 'platform_fee' },
        }),
      });
      await db.update(digitalReceipts)
        .set({ sumitDocumentId: fee.sumitDocumentId, issuerOfRecord: 'sumit' })
        .where(eq(digitalReceipts.id, row.id));
      return { status: fee.recovered ? 'recovered' : 'issued', sumitDocumentId: fee.sumitDocumentId };
    }

    const docType = classDocType && classDocType !== 'CreditInvoice' ? classDocType : undefined;
    const issued = await IsraeliDigitalReceiptService.issueOnceAtSumit({
      sumitClient,
      retry: params.retry === true,
      externalReference: receiptNumber,
      documentTypes: [docType ?? 'InvoiceAndReceipt'],
      createAttemptAt: new Date(row.issuedAt ?? Date.now()),
      create: () => sumitClient.createCustomerReceipt({
      idempotencyKey: receiptNumber,
      documentType: docType,
      customer: {
        name: row.customerName || row.customerEmail || '',
        email: row.customerEmail || undefined,
        phone: row.customerPhone || undefined,
      },
      description: row.serviceDescriptionHe || row.serviceDescription || '',
      amountBeforeVat: Number(row.subtotalAmount),
      vatAmount: Number(row.vatAmount),
      totalAmount: Number(row.totalAmount),
      currency: 'ILS',
      context: { platform: row.platform, bookingId: row.bookingId ?? undefined, receiptNumber },
      }),
    });
    await db.update(digitalReceipts)
      .set({ sumitDocumentId: issued.sumitDocumentId, issuerOfRecord: 'sumit' })
      .where(eq(digitalReceipts.id, row.id));
    logger.info('[Digital Receipt] SUMIT document issued', { receiptNumber: row.receiptNumber, sumitDocumentId: issued.sumitDocumentId, platform: row.platform, recovered: issued.recovered });
    return { status: issued.recovered ? 'recovered' : 'issued', sumitDocumentId: issued.sumitDocumentId };
  }

  static async generateReceipt(params: ReceiptGenerationParams): Promise<ReceiptResult> {
    try {
      // ── Exactly-once guard (no double receipt per booking) ──────────────────
      // A booking charge must yield exactly ONE customer receipt. Without this,
      // a webhook retry, a double client submit, or two call-sites firing would
      // each INSERT a fresh receipt — consuming a gapless tax sequence number and
      // double-emailing the customer (a real ITA/legal problem). If an active
      // (non-voided) customer_payment receipt already exists for this bookingId,
      // return it idempotently instead of issuing a second one.
      //   • Only when bookingId is present — K9000 walk-ins keyed by Nayax txn
      //     have a null bookingId and are legitimately one-receipt-per-txn.
      //   • This guard covers the common SEQUENTIAL causes (retries / double
      //     submit). The race-proof guarantee is a DB partial-unique index on
      //     (booking_id) WHERE NOT is_voided AND receipt_type='customer_payment'
      //     — that needs a migration + a prod dup-check first (CEO ops).
      if (params.bookingId) {
        try {
          const [existing] = await db.select()
            .from(digitalReceipts)
            .where(and(
              eq(digitalReceipts.bookingId, params.bookingId),
              eq(digitalReceipts.receiptType, 'customer_payment'),
              eq(digitalReceipts.isVoided, false),
            ))
            .orderBy(desc(digitalReceipts.issuedAt))
            .limit(1);
          if (existing) {
            logger.warn('[Digital Receipt] Duplicate suppressed — active receipt already exists for booking', {
              bookingId: params.bookingId,
              existingReceiptNumber: existing.receiptNumber,
              existingReceiptId: existing.id,
              platform: params.platform,
            });
            return {
              success: true,
              receiptNumber: existing.receiptNumber,
              receiptId: existing.id,
              emailSent: existing.emailSent,
              accountingRecorded: existing.accountingRecorded,
            };
          }
        } catch (guardErr: any) {
          // A guard read failure must never block issuing a valid receipt for a
          // completed payment — log and fall through to normal issuance.
          logger.warn('[Digital Receipt] dedup guard read failed — issuing normally', {
            bookingId: params.bookingId, error: guardErr?.message,
          });
        }
      }

      const issuedAt = new Date();

      // VAT per the CPA's per-class rule (stored-value = 0, disclosed-agent =
      // commission-only, principal = full) — see resolveReceiptVat (P0-4 fix).
      const vatBreakdown = this.resolveReceiptVat(params);

      // SHAAM allocation number requirement (ITA Digital Invoice Law 2026)
      const shaamRequired = this.isShaamRequired(vatBreakdown.subtotalBeforeVAT, issuedAt);

      const { receipt, receiptNumber } = await this.withReceiptNumberRetry(async (receiptNumber) => {
      const auditHash = this.generateAuditHash({
        receiptNumber,
        totalAmount: params.totalAmount,
        vatAmount: vatBreakdown.vatAmount,
        customerEmail: params.customerEmail,
        issuedAt: issuedAt.toISOString(),
      });

      // Concurrency-P0 (migration 0124): the partial UNIQUE index on
      // (booking_id) WHERE customer_payment AND NOT is_voided now enforces
      // one active receipt per booking at DB layer. If a concurrent request
      // beats us to the INSERT, catch the 23505 and return the winning row
      // — never burn a second gapless ITA sequence number.
      let receipt: any;
      try {
        [receipt] = await db.insert(digitalReceipts).values({
        receiptNumber,
        receiptType: 'customer_payment',
        platform: params.platform,
        bookingId: params.bookingId,
        nayaxTransactionId: params.nayaxTransactionId || null,
        customerEmail: params.customerEmail,
        customerName: params.customerName || null,
        customerPhone: params.customerPhone || null,
        providerName: params.providerName || null,
        providerId: params.providerId || null,
        providerType: params.providerType || null,
        serviceDescription: params.serviceDescription,
        serviceDescriptionHe: params.serviceDescriptionHe,
        subtotalAmount: vatBreakdown.subtotalBeforeVAT.toFixed(2),
        // Effective rate for THIS document: 0 for stored value, 18 otherwise.
        vatRate: vatBreakdown.vatRatePct.toFixed(2),
        vatAmount: vatBreakdown.vatAmount.toFixed(2),
        platformFeeAmount: (params.platformFeeAmount || 0).toFixed(2),
        totalAmount: params.totalAmount.toFixed(2),
        currency: 'ILS',
        providerPayoutAmount: params.providerPayoutAmount?.toFixed(2) || null,
        brokerCommissionAmount: params.brokerCommissionAmount?.toFixed(2) || null,
        paymentMethod: params.paymentMethod,
        paymentStatus: 'completed',
        companyName: COMPANY_NAME,
        companyTaxId: COMPANY_TAX_ID,
        companyAddress: COMPANY_ADDRESS,
        auditHash,
        shaamRequired,
        // shaamAllocationNumber is null until the SHAAM API integration is complete
        issuedAt,
        accountingRecorded: true,
      }).returning();
      } catch (err: any) {
        if (err?.code === '23505' && params.bookingId) {
          const [winner] = await db.select()
            .from(digitalReceipts)
            .where(and(
              eq(digitalReceipts.bookingId, params.bookingId),
              eq(digitalReceipts.receiptType, 'customer_payment'),
              eq(digitalReceipts.isVoided, false),
            ))
            .orderBy(desc(digitalReceipts.issuedAt))
            .limit(1);
          if (winner) {
            logger.warn('[Digital Receipt] Concurrent duplicate rejected by uq_digital_receipts_active_customer_payment — returning winning row (this receipt number is wasted)', {
              bookingId: params.bookingId,
              attemptedReceiptNumber: receiptNumber,
              winningReceiptNumber: winner.receiptNumber,
            });
            receipt = winner;
          } else {
            throw err;
          }
        } else {
          throw err;
        }
      }
      return { receipt, receiptNumber: receipt.receiptNumber };
      });

      if (shaamRequired) {
        logger.warn('[Digital Receipt] SHAAM allocation number required — pending SHAAM API integration', {
          receiptNumber,
          exVatAmount: vatBreakdown.subtotalBeforeVAT,
          bookingId: params.bookingId,
        });
      }

      logger.info('[Digital Receipt] Receipt generated', {
        receiptNumber,
        receiptId: receipt.id,
        platform: params.platform,
        bookingId: params.bookingId,
        totalAmount: params.totalAmount,
        vatAmount: vatBreakdown.vatAmount,
        shaamRequired,
      });

      // Carry the (display-only) service address onto the receipt object so the
      // email renderer can show it. sendReceiptEmail(receipt) has no access to
      // `params`, and serviceAddress is intentionally NOT a DB column — so attach
      // it in-memory here. (2026-07-29 hotfix: was `params.serviceAddress` inside
      // sendReceiptEmail, an out-of-scope ref that threw and skipped the email.)
      (receipt as any).serviceAddress = params.serviceAddress ?? null;
      (receipt as any).customerReference = params.customerId ?? null;

      let emailSent = false;
      try {
        emailSent = await this.sendReceiptEmail(receipt);
        if (emailSent) {
          await db.update(digitalReceipts)
            .set({ emailSent: true, emailSentAt: new Date() })
            .where(eq(digitalReceipts.id, receipt.id));
        }
      } catch (emailError: any) {
        logger.error('[Digital Receipt] Email sending failed', {
          receiptNumber,
          error: emailError.message,
        });
        await db.update(digitalReceipts)
          .set({ emailError: emailError.message })
          .where(eq(digitalReceipts.id, receipt.id));
      }

      try {
        await this.backupToGoogleSheets(receipt);
      } catch (sheetsError) {
        logger.warn('[Digital Receipt] Google Sheets backup failed', { receiptNumber });
      }

      // SMART-ISSUE RULE (Israel "Invoice Israel" / חשבונית ישראל law):
      // Below the SHAAM threshold (≈ every PetWash sale — ex-VAT ≤ ₪5,000 from
      // 2026-06) a self-issued חשבונית מס/קבלה with our gapless PW-YYYY-NNNNNN
      // numbering is FULLY VALID and needs NO government allocation number and
      // SUMIT is the fiscal ISSUER OF RECORD for EVERY sale when the account is
      // wired (CEO 2026-07-09: "all templates at SUMIT, automatic"). We call SUMIT
      // on every receipt — not just above the ₪5k SHAAM threshold — so each sale
      // gets a SUMIT-issued חשבונית/קבלה reported to the ITA. sumitDocumentId is
      // persisted onto the local row below, which becomes our internal ledger
      // reference to the official SUMIT document.
      // Dormant until the account is switched on: isWired() is false unless
      // SUMIT_ENABLED=true AND api key/company id/webhook secret are all set, so
      // this is a no-op (returns {wired:false}, no HTTP) until go-live. It must
      // NEVER throw: a SUMIT hiccup cannot fail a receipt for an already-completed
      // payment. Idempotency key = our sequential receiptNumber.
      // GO-LIVE CHECK: on the first real sale after enabling, confirm SUMIT issues
      // exactly ONE document per sale (SUMIT's), so the local doc is a reference,
      // not a second official tax invoice.
      // SUMIT leg — DURABLE (2026-09-13). Before: one try/catch that turned a
      // SUMIT outage into a log line; the local PW- row stayed
      // issuer_of_record=NULL and nothing ever retried, so the official ITA
      // document was silently lost. Now: inline attempt, else a durable
      // fiscal_document_outbox row (kind sumit_receipt_dispatch) the drainer
      // retries; the receipt itself never fails because of SUMIT.
      try {
        const outcome = await runFiscalDocumentAndPersistOnFailure({
          pool,
          kind: 'sumit_receipt_dispatch',
          sourceKey: `receipt:${receiptNumber}`,
          payload: { receiptId: receipt.id, receiptNumber, paymentClass: params.paymentClass ?? null, bookingId: params.bookingId ?? null },
          runNow: () => IsraeliDigitalReceiptService.dispatchReceiptToSumit({ receiptId: receipt.id, paymentClass: params.paymentClass }),
        });
        if (!outcome.ranInline) {
          logger.error('[Digital Receipt] 🔴 SUMIT dispatch failed — enqueued for retry (receipt still valid locally)', {
            receiptNumber, bookingId: params.bookingId, error: outcome.inlineError,
          });
        }
      } catch (sumitError: any) {
        // Both inline AND outbox failed. Never fail the receipt because of SUMIT.
        logger.error('[Digital Receipt] 🔴 SUMIT dispatch failed AND outbox unavailable (receipt still valid locally)', {
          receiptNumber, bookingId: params.bookingId, error: sumitError?.message,
        });
      }

      return {
        success: true,
        receiptNumber,
        receiptId: receipt.id,
        emailSent,
        accountingRecorded: true,
      };

    } catch (error: any) {
      // 2026-09-17: every caller ignores this return value (booking, shop,
      // academy, prestige pass, guest eGift, wallet top-up / eGift / wash
      // package). A customer had paid and the tax document did not exist, with
      // one log line nobody reads. Raise it where it happens, so it is one
      // alert per sale regardless of which surface sold it. The sale itself is
      // never failed for this — the money already moved.
      logger.error('[Digital Receipt] 🔴 Generation failed — customer paid with NO tax document', {
        bookingId: params.bookingId, platform: params.platform,
        totalAmount: params.totalAmount, error: error.message,
      });
      await raiseMissingReceiptAlert({
        bookingId: params.bookingId ?? `${params.platform}:unknown`,
        platform: params.platform,
        totalAmount: params.totalAmount,
        error: error.message,
      });
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Record provider commission and settlement in DB
   * Per Israeli law: withholding tax deducted, commission recorded with VAT
   */
  static async recordProviderSettlement(
    params: ProviderSettlementParams & {
      customerPaidAmount: number;
      bookingDbId: number;
      commissionRate?: number;
    }
  ): Promise<{ success: boolean; commissionId?: string; settlement?: ProviderSettlementResult; error?: string }> {
    try {
      const settlement = this.calculateProviderSettlement(params);

      // The rate recorded beside the amount must REPRODUCE the amount:
      // commission ÷ what the customer paid. That is 15.00 for a booking where
      // the fee came out of the rate, 13.04 where it sat on top (₪150 of
      // ₪1,150). A caller-supplied number is used only when there is no
      // customer total to derive it from — a hand-written rate is how Sitter
      // Suite came to store "7.50" next to a 15% commission.
      const paid = Number(params.customerPaidAmount);
      const commissionRate = paid > 0
        ? (settlement.brokerCommission / paid) * 100
        : (params.commissionRate || PLATFORM_COMMISSION_RATE * 100);

      const invoiceNumber = await generateCommissionInvoiceNumber();

      await db.insert(providerCommissions).values({
        commissionId: settlement.commissionId,
        providerId: params.providerId,
        providerType: params.providerType,
        bookingId: params.bookingDbId,
        customerPaidAmount: params.customerPaidAmount.toFixed(2),
        commissionRate: commissionRate.toFixed(2),
        commissionAmount: settlement.brokerCommission.toFixed(2),
        providerEarnings: settlement.netPaymentToProvider.toFixed(2),
        includesVat: true,
        vatAmount: settlement.vatOnCommission.toFixed(2),
        status: 'pending',
        invoiceGenerated: false,
        invoiceNumber,
        transactionDate: new Date(),
      });

      await this.withReceiptNumberRetry(async (receiptNumber) => {
      const auditHash = this.generateAuditHash({
        receiptNumber,
        totalAmount: settlement.grossPayout,
        vatAmount: settlement.vatOnCommission,
        customerEmail: `provider-${params.providerId}@internal`,
        issuedAt: new Date().toISOString(),
      });

      return db.insert(digitalReceipts).values({
        receiptNumber,
        receiptType: 'provider_settlement',
        platform: 'sitter-suite',
        bookingId: params.bookingId,
        providerId: params.providerId,
        providerType: params.providerType,
        customerEmail: `provider-${params.providerId}@internal`,
        serviceDescription: `Provider settlement - Booking ${params.bookingId}`,
        serviceDescriptionHe: `סילוק ספק - הזמנה ${params.bookingId}`,
        subtotalAmount: settlement.grossPayout.toFixed(2),
        vatRate: (ISRAELI_VAT_RATE * 100).toFixed(2),
        vatAmount: settlement.vatOnCommission.toFixed(2),
        totalAmount: settlement.grossPayout.toFixed(2),
        currency: 'ILS',
        providerPayoutAmount: settlement.netPaymentToProvider.toFixed(2),
        brokerCommissionAmount: settlement.brokerCommission.toFixed(2),
        withholdingTaxAmount: settlement.withholdingTaxAmount.toFixed(2),
        withholdingTaxRate: (settlement.withholdingTaxRate * 100).toFixed(2),
        netPaymentToProvider: settlement.netPaymentToProvider.toFixed(2),
        paymentMethod: 'bank_transfer',
        paymentStatus: 'pending',
        auditHash,
        shaamRequired: this.isShaamRequired(settlement.grossPayout),
        accountingRecorded: true,
        issuedAt: new Date(),
      });
      });

      // ── Withholding remittance ledger — ITA Form 856 quarterly tracking ───────
      // Write a 'held' entry so finance can track what is owed to the ITA vs
      // what has already been remitted. Status transitions:
      //   held → remitted  (on quarterly ITA payment)
      //   held → reversed  (on booking cancellation after settlement)
      if (settlement.withholdingTaxAmount > 0) {
        try {
          await db.insert(withholdingRemittanceLedger).values({
            bookingId: params.bookingId,
            providerId: params.providerId,
            providerType: params.providerType,
            withholdingAmount: settlement.withholdingTaxAmount.toFixed(2),
            withholdingRate: (settlement.withholdingTaxRate * 100).toFixed(2),
            grossPayoutAmount: settlement.grossPayout.toFixed(2),
            period: this.getReportingPeriod(),
            status: 'held',
            osekType: settlement.osekType || null,
            commissionId: settlement.commissionId,
          });
        } catch (wrlError: any) {
          // Non-blocking: failure to write remittance ledger must not abort the settlement
          logger.error('[Digital Receipt] withholding_remittance_ledger write failed', {
            bookingId: params.bookingId,
            providerId: params.providerId,
            error: wrlError.message,
          });
        }
      }

      logger.info('[Digital Receipt] Provider settlement recorded', {
        commissionId: settlement.commissionId,
        providerId: params.providerId,
        grossPayout: settlement.grossPayout,
        withholdingTax: settlement.withholdingTaxAmount,
        netPayment: settlement.netPaymentToProvider,
        brokerCommission: settlement.brokerCommission,
      });

      return {
        success: true,
        commissionId: settlement.commissionId,
        settlement,
      };

    } catch (error: any) {
      logger.error('[Digital Receipt] Provider settlement recording failed', { error: error.message });
      return { success: false, error: error.message };
    }
  }

  /**
   * Send digital receipt via email (SendGrid)
   * Israeli law requires digital receipt to be sent to customer
   */
  static async sendReceiptEmail(receipt: any): Promise<boolean> {
    if (!isSendGridConfigured()) {
      logger.info('[Digital Receipt] SendGrid not configured - receipt email queued', {
        receiptNumber: receipt.receiptNumber,
        customerEmail: receipt.customerEmail,
      });
      return false;
    }

    try {
      const mailService = createMailService();

      const subtotal = parseFloat(receipt.subtotalAmount);
      const total = parseFloat(receipt.totalAmount);
      const platformFee = parseFloat(receipt.platformFeeAmount || '0');

      const emailHtml = `
<!DOCTYPE html>
<html dir="rtl" lang="he">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>אישור תשלום - ⁦PetWash™⁩</title>
</head>
<body style="margin:0;padding:0;background-color:#f8f9fa;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;background:#ffffff;">
    <!-- Header -->
    <tr>
      <td style="background:#000000;padding:30px 40px;text-align:center;">
        <!-- 2026-09-19: this drew the brand as TEXT while every other PetWash email
       uses the real asset. Brand rule: the real logo file, never a redrawn or
       typed substitute. Dark header, so the white-wordmark asset. -->
  <img src="https://petwash.co.il/brand/petwash-logo-black-bg.png" alt="⁦PetWash™⁩" width="150"
       style="display:block;margin:0 auto;width:150px;height:auto;border:0;" />
        <p style="color:#999999;margin:8px 0 0;font-size:12px;letter-spacing:1px;">${COMPANY_NAME_HE} | ח.פ ${COMPANY_TAX_ID}</p>
      </td>
    </tr>

    <!-- Receipt Title -->
    <tr>
      <td style="padding:30px 40px 10px;text-align:center;">
        <h2 style="margin:0;font-size:22px;color:#000000;">אישור תשלום</h2>
        <p style="margin:5px 0;color:#666666;font-size:14px;">Payment confirmation</p>
      </td>
    </tr>

    <!-- Receipt Number & Date -->
    <tr>
      <td style="padding:10px 40px;">
        <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e0e0e0;border-radius:8px;">
          <tr>
            <td style="padding:15px 20px;border-left:1px solid #e0e0e0;text-align:center;">
              <p style="margin:0;color:#999;font-size:11px;">מספר אסמכתא</p>
              <p style="margin:4px 0 0;font-weight:bold;font-size:14px;color:#000;">${receipt.receiptNumber}</p>
            </td>
            <td style="padding:15px 20px;text-align:center;">
              <p style="margin:0;color:#999;font-size:11px;">תאריך</p>
              <p style="margin:4px 0 0;font-weight:bold;font-size:14px;color:#000;">${new Date(receipt.issuedAt).toLocaleDateString('he-IL')}</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>

    <!-- Customer Details -->
    <tr>
      <td style="padding:15px 40px;">
        <p style="margin:0;font-size:12px;color:#999;">לכבוד:</p>
        <p style="margin:4px 0;font-weight:bold;color:#000;">${receipt.customerName || receipt.customerEmail}</p>
        ${receipt.serviceAddress ? `<p style="margin:2px 0 0;font-size:12px;color:#555;">${receipt.serviceAddress}</p>` : ''}
      </td>
    </tr>

    <!-- Service Description -->
    <tr>
      <td style="padding:10px 40px;">
        <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
          <tr style="background:#f8f8f8;">
            <td style="padding:12px 16px;border:1px solid #e0e0e0;font-weight:bold;font-size:13px;">תיאור השירות</td>
            <td style="padding:12px 16px;border:1px solid #e0e0e0;font-weight:bold;font-size:13px;text-align:left;width:120px;">סכום</td>
          </tr>
          <tr>
            <td style="padding:12px 16px;border:1px solid #e0e0e0;font-size:13px;">${receipt.serviceDescriptionHe}</td>
            <td style="padding:12px 16px;border:1px solid #e0e0e0;font-size:13px;text-align:left;">₪${subtotal.toFixed(2)}</td>
          </tr>
          ${platformFee > 0 ? `
          <tr>
            <td style="padding:12px 16px;border:1px solid #e0e0e0;font-size:13px;">דמי שירות פלטפורמה</td>
            <td style="padding:12px 16px;border:1px solid #e0e0e0;font-size:13px;text-align:left;">₪${platformFee.toFixed(2)}</td>
          </tr>` : ''}
        </table>
      </td>
    </tr>

    <!-- Total (the VAT breakdown lives on the official SUMIT document only —
         this email is a payment confirmation, 2026-09-17) -->
    <tr>
      <td style="padding:10px 40px;">
        <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
          <tr style="border-top:2px solid #000;">
            <td style="padding:12px 16px;font-size:16px;font-weight:bold;color:#000;">סה"כ שולם</td>
            <td style="padding:12px 16px;font-size:16px;font-weight:bold;text-align:left;color:#000;">₪${total.toFixed(2)}</td>
          </tr>
        </table>
      </td>
    </tr>

    <!-- Payment Method -->
    <tr>
      <td style="padding:15px 40px;">
        <p style="margin:0;font-size:12px;color:#999;">אמצעי תשלום: ${receipt.paymentMethod}</p>
        ${receipt.bookingId ? `<p style="margin:4px 0 0;font-size:12px;color:#999;">מספר הזמנה: ${String(receipt.bookingId).replace(/^(shop:|sumit:)/, '')}</p>` : ''}
        ${receipt.nayaxTransactionId ? `<p style="margin:4px 0 0;font-size:12px;color:#999;">מספר עסקה: ${receipt.nayaxTransactionId}</p>` : ''}
        ${receipt.customerReference ? `<p style="margin:4px 0 0;font-size:12px;color:#999;">מספר לקוח: ${receipt.customerReference}</p>` : ''}
      </td>
    </tr>

    <!-- Legal Footer -->
    <tr>
      <td style="padding:20px 40px;border-top:1px solid #e0e0e0;">
        <p style="margin:0;font-size:11px;color:#999;text-align:center;">
          זהו אישור תשלום ואינו מסמך מס. מסמך המס הרשמי נשלח אליך בנפרד.
        </p>
        <p style="margin:4px 0;font-size:11px;color:#999;text-align:center;">
          This is a payment confirmation, not a tax document. Your official tax document is sent separately.
        </p>
        <p style="margin:8px 0 0;font-size:11px;color:#cccccc;text-align:center;">
          Hash: ${receipt.auditHash?.substring(0, 16)}...
        </p>
      </td>
    </tr>

    <!-- Social Media Buttons -->
    <tr>
      <td style="padding:28px 40px 20px;text-align:center;background:#fafafa;border-top:1px solid #f0f0f0;">
        <p style="margin:0 0 16px;font-size:12px;color:#888;letter-spacing:0.5px;">עקבו אחרינו / Follow us</p>
        <table cellpadding="0" cellspacing="0" style="margin:0 auto;">
          <tr>
            <!-- Instagram -->
            <td style="padding:0 6px;">
              <a href="https://www.instagram.com/petwashltd" target="_blank" style="display:inline-block;text-decoration:none;">
                <table cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="background:linear-gradient(45deg,#f09433,#e6683c,#dc2743,#cc2366,#bc1888);border-radius:10px;padding:10px 16px;">
                      <span style="color:#ffffff;font-size:13px;font-weight:bold;font-family:Arial,sans-serif;letter-spacing:0.3px;">📷 Instagram</span>
                    </td>
                  </tr>
                </table>
              </a>
            </td>
            <!-- Facebook -->
            <td style="padding:0 6px;">
              <a href="https://www.facebook.com/petwashltd" target="_blank" style="display:inline-block;text-decoration:none;">
                <table cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="background:#1877F2;border-radius:10px;padding:10px 16px;">
                      <span style="color:#ffffff;font-size:13px;font-weight:bold;font-family:Arial,sans-serif;letter-spacing:0.3px;">f Facebook</span>
                    </td>
                  </tr>
                </table>
              </a>
            </td>
            <!-- TikTok -->
            <td style="padding:0 6px;">
              <a href="https://www.tiktok.com/@petwashltd" target="_blank" style="display:inline-block;text-decoration:none;">
                <table cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="background:#010101;border-radius:10px;padding:10px 16px;border:1px solid #333;">
                      <span style="color:#ffffff;font-size:13px;font-weight:bold;font-family:Arial,sans-serif;letter-spacing:0.3px;">♪ TikTok</span>
                    </td>
                  </tr>
                </table>
              </a>
            </td>
            <!-- WhatsApp -->
            <td style="padding:0 6px;">
              <a href="${SUPPORT_WHATSAPP_URL}" target="_blank" style="display:inline-block;text-decoration:none;">
                <table cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="background:#25D366;border-radius:10px;padding:10px 16px;">
                      <span style="color:#ffffff;font-size:13px;font-weight:bold;font-family:Arial,sans-serif;letter-spacing:0.3px;">💬 WhatsApp</span>
                    </td>
                  </tr>
                </table>
              </a>
            </td>
          </tr>
        </table>
      </td>
    </tr>

    <!-- Privacy / Links bar -->
    <tr>
      <td style="padding:14px 40px;text-align:center;background:#fafafa;">
        <a href="https://petwash.co.il/privacy" style="color:#999;font-size:11px;text-decoration:none;margin:0 10px;font-family:Arial,sans-serif;">Privacy Policy / פרטיות</a>
        <span style="color:#ddd;font-size:11px;">|</span>
        <a href="mailto:${CANONICAL_SUPPORT_EMAIL}" style="color:#999;font-size:11px;text-decoration:none;margin:0 10px;font-family:Arial,sans-serif;">Contact / צור קשר</a>
        <span style="color:#ddd;font-size:11px;">|</span>
        <a href="https://petwash.co.il/terms" style="color:#999;font-size:11px;text-decoration:none;margin:0 10px;font-family:Arial,sans-serif;">Terms / תנאי שימוש</a>
      </td>
    </tr>

    <!-- Footer -->
    <tr>
      <td style="background:#000000;padding:20px 40px;text-align:center;">
        <p style="margin:0;color:#ffffff;font-size:12px;font-family:Arial,sans-serif;">⁦PetWash™⁩ | ${COMPANY_NAME_HE}</p>
        <p style="margin:6px 0 0;color:#666666;font-size:11px;font-family:Arial,sans-serif;">
          <a href="https://petwash.co.il" style="color:#888;text-decoration:none;">petwash.co.il</a>
          &nbsp;·&nbsp;
          <a href="mailto:${CANONICAL_SUPPORT_EMAIL}" style="color:#888;text-decoration:none;">${CANONICAL_SUPPORT_EMAIL}</a>
        </p>
        <p style="margin:6px 0 0;color:#444444;font-size:10px;font-family:Arial,sans-serif;">© ${new Date().getFullYear()} ${COMPANY_NAME_HE}. All rights reserved.</p>
      </td>
    </tr>
  </table>
</body>
</html>`;

      await mailService.send({
        to: receipt.customerEmail,
        from: { email: FROM_EMAIL, name: FROM_NAME },
        subject: `אישור תשלום ${receipt.receiptNumber} | ⁦PetWash™⁩`,
        html: emailHtml,
      });

      logger.info('[Digital Receipt] Email sent successfully', {
        receiptNumber: receipt.receiptNumber,
        to: receipt.customerEmail,
      });

      return true;

    } catch (error: any) {
      logger.error('[Digital Receipt] Email sending failed', {
        receiptNumber: receipt.receiptNumber,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Backup receipt to Google Sheets for accounting records
   */
  static async backupToGoogleSheets(receipt: any): Promise<void> {
    try {
      await appendFormSubmission('receipts', {
        receiptNumber: receipt.receiptNumber,
        date: new Date(receipt.issuedAt).toLocaleDateString('he-IL'),
        platform: receipt.platform,
        bookingId: receipt.bookingId || '',
        customerEmail: receipt.customerEmail,
        customerName: receipt.customerName || '',
        serviceDescription: receipt.serviceDescriptionHe,
        subtotal: `₪${receipt.subtotalAmount}`,
        vatRate: `${receipt.vatRate}%`,
        vatAmount: `₪${receipt.vatAmount}`,
        totalAmount: `₪${receipt.totalAmount}`,
        paymentMethod: receipt.paymentMethod,
        paymentStatus: receipt.paymentStatus,
        auditHash: receipt.auditHash?.substring(0, 16) || '',
      });

      await db.update(digitalReceipts)
        .set({ sheetsBackupId: `sheets-${receipt.receiptNumber}` })
        .where(eq(digitalReceipts.id, receipt.id));

      logger.info('[Digital Receipt] Backed up to Google Sheets', { receiptNumber: receipt.receiptNumber });
    } catch (error) {
      logger.warn('[Digital Receipt] Google Sheets backup failed (non-critical)', { receiptNumber: receipt.receiptNumber });
    }
  }

  /**
   * Get receipt by booking ID (for customer viewing)
   */
  static async getReceiptByBookingId(bookingId: string) {
    return db.select()
      .from(digitalReceipts)
      .where(eq(digitalReceipts.bookingId, bookingId))
      .orderBy(desc(digitalReceipts.issuedAt));
  }

  /**
   * Get all receipts for accounting export
   */
  static async getReceiptsForPeriod(startDate: Date, endDate: Date) {
    return db.select()
      .from(digitalReceipts)
      .where(
        sql`issued_at >= ${startDate} AND issued_at <= ${endDate} AND is_voided = false`
      )
      .orderBy(desc(digitalReceipts.issuedAt));
  }

  // ── Void & Credit Note ───────────────────────────────────────────────────────

  /**
   * Void an existing digital receipt.
   * Called when a booking is cancelled BEFORE a P&L settlement was created.
   * Marks the receipt as voided — it is kept in the DB for audit purposes
   * (Israeli law: receipts must not be deleted, only voided).
   *
   * If a withholding_remittance_ledger entry exists for this booking it is
   * also reversed here.
   */
  static async voidReceipt(params: {
    receiptId: number;
    voidReason: string;
  }): Promise<{ success: boolean; error?: string }> {
    try {
      const [updated] = await db
        .update(digitalReceipts)
        .set({
          isVoided: true,
          voidedAt: new Date(),
          voidReason: params.voidReason,
          paymentStatus: 'voided',
        })
        .where(eq(digitalReceipts.id, params.receiptId))
        .returning();

      if (!updated) {
        return { success: false, error: `Receipt ${params.receiptId} not found` };
      }

      logger.info('[Digital Receipt] Receipt voided', {
        receiptId: params.receiptId,
        receiptNumber: updated.receiptNumber,
        voidReason: params.voidReason,
      });

      // Reverse any withholding_remittance_ledger 'held' entry for this booking
      if (updated.bookingId) {
        try {
          await db
            .update(withholdingRemittanceLedger)
            .set({
              status: 'reversed',
              reversedAt: new Date(),
              reverseReason: `Receipt voided: ${params.voidReason}`,
              updatedAt: new Date(),
            })
            .where(
              sql`booking_id = ${updated.bookingId} AND status = 'held'`
            );
        } catch (wrlErr: any) {
          logger.warn('[Digital Receipt] Failed to reverse withholding_remittance_ledger entry', {
            bookingId: updated.bookingId,
            error: wrlErr.message,
          });
        }
      }

      return { success: true };
    } catch (error: any) {
      logger.error('[Digital Receipt] voidReceipt failed', { receiptId: params.receiptId, error: error.message });
      return { success: false, error: error.message };
    }
  }

  /**
   * Issue a credit note (הזיכוי) for an existing receipt.
   * Called when a booking is cancelled AFTER a P&L settlement was recorded
   * (i.e. a tax invoice was already issued to the customer or the ITA ledger
   * already has an entry). Israeli law requires an explicit credit note — the
   * original receipt must NOT be deleted or modified.
   *
   * The credit note is a new `digital_receipts` row with:
   *   receiptType = 'credit_note'
   *   originalReceiptId = id of the original receipt
   *   totalAmount = negative of original amount (or the refund amount)
   *   shaamRequired / shaamAllocationNumber mirrored from original
   */
  static async issueCreditNote(params: {
    originalReceiptId: number;
    refundAmount: number;
    reason: string;
    platform: string;
    bookingId: string;
    customerEmail: string;
  }): Promise<{ success: boolean; creditNoteNumber?: string; creditNoteId?: number; error?: string }> {
    try {
      const [original] = await db
        .select()
        .from(digitalReceipts)
        .where(eq(digitalReceipts.id, params.originalReceiptId))
        .limit(1);

      if (!original) {
        return { success: false, error: `Original receipt ${params.originalReceiptId} not found` };
      }

      const issuedAt = new Date();

      const refundAmount = Math.abs(params.refundAmount);
      // Mirror the original document's VAT share — never a flat 18/118 of the
      // refund (see creditNoteAmounts).
      const amounts = creditNoteAmounts(original, refundAmount);
      const vatBreakdown = { subtotalBeforeVAT: amounts.localSubtotal, vatAmount: amounts.localVat };
      const shaamRequired = this.isShaamRequired(vatBreakdown.subtotalBeforeVAT, issuedAt);

      const { creditNote, creditNoteNumber } = await this.withReceiptNumberRetry(async (creditNoteNumber) => {
      const auditHash = this.generateAuditHash({
        receiptNumber: creditNoteNumber,
        totalAmount: -refundAmount,
        vatAmount: -vatBreakdown.vatAmount,
        customerEmail: params.customerEmail,
        issuedAt: issuedAt.toISOString(),
      });

      const [creditNote] = await db.insert(digitalReceipts).values({
        receiptNumber: creditNoteNumber,
        receiptType: 'credit_note',
        platform: params.platform,
        bookingId: params.bookingId,
        customerEmail: params.customerEmail,
        customerName: original.customerName,
        serviceDescription: `Credit note for ${original.receiptNumber} — ${params.reason}`,
        serviceDescriptionHe: `זיכוי על ${original.receiptNumber} — ${params.reason}`,
        subtotalAmount: (-vatBreakdown.subtotalBeforeVAT).toFixed(2),
        vatRate: original.vatRate ?? (ISRAELI_VAT_RATE * 100).toFixed(2),
        vatAmount: (-vatBreakdown.vatAmount).toFixed(2),
        platformFeeAmount: '0',
        // The fee share this credit reverses — read back by the SUMIT dispatch.
        brokerCommissionAmount: amounts.feeOnly ? (-amounts.sumitTotal).toFixed(2) : null,
        providerPayoutAmount: amounts.feeOnly ? (-(amounts.refund - amounts.sumitTotal)).toFixed(2) : null,
        totalAmount: (-refundAmount).toFixed(2),
        currency: 'ILS',
        paymentMethod: original.paymentMethod,
        paymentStatus: 'refunded',
        companyName: COMPANY_NAME,
        companyTaxId: COMPANY_TAX_ID,
        companyAddress: COMPANY_ADDRESS,
        auditHash,
        originalReceiptId: params.originalReceiptId,
        shaamRequired,
        issuedAt,
        accountingRecorded: true,
      }).returning();
      return { creditNote, creditNoteNumber };
      });

      // Mark the original receipt as voided
      await db
        .update(digitalReceipts)
        .set({
          isVoided: true,
          voidedAt: issuedAt,
          voidReason: `Credit note issued: ${creditNoteNumber} — ${params.reason}`,
        })
        .where(eq(digitalReceipts.id, params.originalReceiptId));

      // Reverse any held withholding
      try {
        await db
          .update(withholdingRemittanceLedger)
          .set({
            status: 'reversed',
            reversedAt: issuedAt,
            reverseReason: `Credit note issued: ${creditNoteNumber}`,
            updatedAt: issuedAt,
          })
          .where(
            sql`booking_id = ${params.bookingId} AND status = 'held'`
          );
      } catch (wrlErr: any) {
        logger.warn('[Digital Receipt] Failed to reverse withholding_remittance_ledger on credit note', {
          bookingId: params.bookingId,
          error: wrlErr.message,
        });
      }

      // SUMIT leg — DURABLE (2026-09-17). SUMIT is the issuer of record for
      // every credit note (זיכוי). Before, the SUMIT call sat in a try/catch
      // and a rejected or dropped call came back WITHOUT throwing: the refund
      // went through, the local credit note existed, and SUMIT — the document
      // the tax authority sees — never got one. Nothing retried; nothing
      // alerted. Now it goes through the same durable outbox as receipts, and a
      // retry reads SUMIT before it creates (issueOnceAtSumit). A refund the
      // customer is owed never fails because of SUMIT.
      try {
        const outcome = await runFiscalDocumentAndPersistOnFailure({
          pool,
          kind: 'sumit_credit_dispatch',
          sourceKey: `credit_note:${creditNote.id}`,
          payload: { creditNoteId: creditNote.id, creditNoteNumber, bookingId: params.bookingId },
          runNow: () => IsraeliDigitalReceiptService.dispatchCreditNoteToSumit({ creditNoteId: creditNote.id }),
        });
        if (!outcome.ranInline) {
          logger.error('[Digital Receipt] 🔴 SUMIT credit document failed — queued for retry (refund and local credit note stand)', {
            creditNoteNumber, bookingId: params.bookingId, error: outcome.inlineError,
          });
        }
      } catch (fatal: any) {
        // Refund and local credit note stand; only the SUMIT copy is missing.
        logger.error('[Digital Receipt] 🔴 SUMIT credit document failed AND the retry queue is unavailable — reconcile manually', {
          creditNoteNumber, creditNoteId: creditNote.id, bookingId: params.bookingId,
          outboxUnavailable: fatal instanceof FiscalOutboxUnavailableError, error: fatal?.message,
        });
      }

      logger.info('[Digital Receipt] Credit note issued', {
        creditNoteNumber,
        originalReceiptNumber: original.receiptNumber,
        refundAmount,
        shaamRequired,
      });

      return {
        success: true,
        creditNoteNumber,
        creditNoteId: creditNote.id,
      };
    } catch (error: any) {
      logger.error('[Digital Receipt] issueCreditNote failed', { error: error.message });
      return { success: false, error: error.message };
    }
  }

  /**
   * Issue (or recover) the SUMIT credit document for a stored credit note.
   * Inline on refund; the outbox drainer calls it again with retry:true, which
   * looks the document up in SUMIT before creating anything.
   */
  static async dispatchCreditNoteToSumit(params: { creditNoteId: number; retry?: boolean }): Promise<SumitDispatchResult> {
    const { sumitClient } = await import('./SumitClient');
    if (sumitClient.isWired()) {
      return IsraeliDigitalReceiptService.dispatchCreditNoteToSumitWired(sumitClient as unknown as SumitIssuer, params);
    }
    return { status: 'not_wired' };
  }

  static async dispatchCreditNoteToSumitWired(
    sumitClient: SumitIssuer,
    params: { creditNoteId: number; retry?: boolean },
  ): Promise<SumitDispatchResult> {
    const [credit] = await db.select().from(digitalReceipts).where(eq(digitalReceipts.id, params.creditNoteId)).limit(1);
    if (!credit) throw new Error(`CREDIT_NOTE_NOT_FOUND:${params.creditNoteId}`);
    if (credit.sumitDocumentId) return { status: 'already_issued', sumitDocumentId: credit.sumitDocumentId };
    const [original] = credit.originalReceiptId
      ? await db.select().from(digitalReceipts).where(eq(digitalReceipts.id, credit.originalReceiptId)).limit(1)
      : [];

    // A marketplace credit reverses Pet Wash's FEE share only — the document
    // it credits covered only the fee. Stored on the credit row at issue.
    const feeOnly = credit.brokerCommissionAmount != null && Number(credit.providerPayoutAmount ?? 0) !== 0;
    const sumitTotal = feeOnly ? Math.abs(Number(credit.brokerCommissionAmount)) : Math.abs(Number(credit.totalAmount));
    const sumitVat = Math.abs(Number(credit.vatAmount));
    if (!(sumitTotal > 0)) return { status: 'nothing_to_issue' };
    const issued = await IsraeliDigitalReceiptService.issueOnceAtSumit({
      sumitClient,
      retry: params.retry === true,
      externalReference: credit.receiptNumber,
      documentTypes: ['CreditInvoiceAndReceipt'],
      createAttemptAt: new Date(credit.issuedAt ?? Date.now()),
      create: () => sumitClient.createCreditDocument({
        idempotencyKey: credit.receiptNumber,
        originalSumitDocumentId: original?.sumitDocumentId ?? undefined,
        customer: { name: credit.customerName || credit.customerEmail || '', email: credit.customerEmail || undefined },
        description: credit.serviceDescriptionHe || credit.serviceDescription || `זיכוי ${credit.receiptNumber}`,
        amountBeforeVat: Math.round((sumitTotal - sumitVat) * 100) / 100,
        vatAmount: sumitVat,
        totalAmount: sumitTotal,
        currency: 'ILS',
        context: { platform: credit.platform, bookingId: credit.bookingId ?? undefined, creditNoteNumber: credit.receiptNumber },
      }),
    });
    await db.update(digitalReceipts)
      .set({ sumitDocumentId: issued.sumitDocumentId, issuerOfRecord: 'sumit' })
      .where(eq(digitalReceipts.id, credit.id));
    return { status: issued.recovered ? 'recovered' : 'issued', sumitDocumentId: issued.sumitDocumentId };
  }

  /**
   * Refund-flow convenience: find the original (non-voided) customer receipt for
   * a booking/transaction and issue its credit note (זיכוי). Returns
   * {success:false, error:'no_original_receipt'} when nothing was receipted (so
   * a refund of an un-receipted charge is surfaced, not silently skipped).
   * NON-BLOCKING at the call site — a refund must complete regardless.
   */
  static async issueCreditNoteForBooking(params: {
    bookingId: string;
    refundAmount: number;
    reason: string;
  }): Promise<{ success: boolean; creditNoteNumber?: string; error?: string }> {
    try {
      const [original] = await db
        .select()
        .from(digitalReceipts)
        .where(and(
          eq(digitalReceipts.bookingId, params.bookingId),
          eq(digitalReceipts.receiptType, 'customer_payment'),
          eq(digitalReceipts.isVoided, false),
        ))
        .orderBy(desc(digitalReceipts.id))
        .limit(1);
      if (!original) {
        logger.warn('[Digital Receipt] refund with no original receipt to credit', { bookingId: params.bookingId });
        return { success: false, error: 'no_original_receipt' };
      }
      return await this.issueCreditNote({
        originalReceiptId: original.id,
        refundAmount: params.refundAmount,
        reason: params.reason,
        platform: original.platform,
        bookingId: params.bookingId,
        customerEmail: original.customerEmail,
      });
    } catch (error: any) {
      logger.error('[Digital Receipt] issueCreditNoteForBooking failed', { error: error.message });
      return { success: false, error: error.message };
    }
  }
}
