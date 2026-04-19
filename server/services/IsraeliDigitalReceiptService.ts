/**
 * ISRAELI DIGITAL RECEIPT SERVICE (שירות קבלות דיגיטליות)
 * 
 * Israeli Tax Authority compliant digital receipts - per Israeli law 2026
 * Implements the Wolt/Airbnb broker model for subcontractors:
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

import { db } from '../db';
import { digitalReceipts, providerCommissions, withholdingRemittanceLedger, octopusLedger } from '@shared/schema';
import { eq, sql, desc } from 'drizzle-orm';
import { logger } from '../lib/logger';
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

const PLATFORM_COMMISSION_RATE = 0.15; // Flat 15% on all platforms
const DEFAULT_WITHHOLDING_TAX_RATE = WITHHOLDING_RATE_POLICY.defaultRate;
const COMPANY_NAME = CONFIG_COMPANY_NAME;
const COMPANY_NAME_HE = CONFIG_COMPANY_NAME_HE;
const COMPANY_TAX_ID = CONFIG_COMPANY_TAX_ID;
const COMPANY_ADDRESS = 'ישראל';
const FROM_EMAIL = 'noreply@petwash.co.il';
const FROM_NAME = '⁦Pet Wash™⁩';

export interface ReceiptGenerationParams {
  platform: string;
  bookingId: string;
  nayaxTransactionId?: string;
  customerEmail: string;
  customerName?: string;
  customerPhone?: string;
  providerName?: string;
  providerId?: string;
  providerType?: string;
  serviceDescription: string;
  serviceDescriptionHe: string;
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
    return `PW-${year}-${sequenceNumber.toString().padStart(6, '0')}`;
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
   * Calculate provider settlement with Israeli law deductions
   * Implements Wolt/Airbnb subcontractor model:
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

    const brokerCommission = parseFloat((grossPayoutAmount * PLATFORM_COMMISSION_RATE / (1 - PLATFORM_COMMISSION_RATE)).toFixed(2));
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
  static async generateReceipt(params: ReceiptGenerationParams): Promise<ReceiptResult> {
    try {
      const receiptNumber = await this.generateReceiptNumber();
      const issuedAt = new Date();

      const vatBreakdown = this.calculateVATBreakdown(params.totalAmount);

      // SHAAM allocation number requirement (ITA Digital Invoice Law 2026)
      const shaamRequired = this.isShaamRequired(vatBreakdown.subtotalBeforeVAT, issuedAt);

      const auditHash = this.generateAuditHash({
        receiptNumber,
        totalAmount: params.totalAmount,
        vatAmount: vatBreakdown.vatAmount,
        customerEmail: params.customerEmail,
        issuedAt: issuedAt.toISOString(),
      });

      const [receipt] = await db.insert(digitalReceipts).values({
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
        vatRate: (ISRAELI_VAT_RATE * 100).toFixed(2),
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

      return {
        success: true,
        receiptNumber,
        receiptId: receipt.id,
        emailSent,
        accountingRecorded: true,
      };

    } catch (error: any) {
      logger.error('[Digital Receipt] Generation failed', { error: error.message });
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

      const commissionRate = params.commissionRate || PLATFORM_COMMISSION_RATE * 100;

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

      const receiptNumber = await this.generateReceiptNumber();
      const auditHash = this.generateAuditHash({
        receiptNumber,
        totalAmount: settlement.grossPayout,
        vatAmount: settlement.vatOnCommission,
        customerEmail: `provider-${params.providerId}@internal`,
        issuedAt: new Date().toISOString(),
      });

      await db.insert(digitalReceipts).values({
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

      const vatRate = parseFloat(receipt.vatRate);
      const subtotal = parseFloat(receipt.subtotalAmount);
      const vatAmount = parseFloat(receipt.vatAmount);
      const total = parseFloat(receipt.totalAmount);
      const platformFee = parseFloat(receipt.platformFeeAmount || '0');

      const emailHtml = `
<!DOCTYPE html>
<html dir="rtl" lang="he">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>קבלה דיגיטלית - ⁦Pet Wash™⁩</title>
</head>
<body style="margin:0;padding:0;background-color:#f8f9fa;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;background:#ffffff;">
    <!-- Header -->
    <tr>
      <td style="background:#000000;padding:30px 40px;text-align:center;">
        <h1 style="color:#ffffff;margin:0;font-size:24px;letter-spacing:2px;">⁦Pet Wash™⁩</h1>
        <p style="color:#999999;margin:8px 0 0;font-size:12px;letter-spacing:1px;">${COMPANY_NAME_HE} | ח.פ ${COMPANY_TAX_ID}</p>
      </td>
    </tr>

    <!-- Receipt Title -->
    <tr>
      <td style="padding:30px 40px 10px;text-align:center;">
        <h2 style="margin:0;font-size:22px;color:#000000;">קבלה דיגיטלית</h2>
        <p style="margin:5px 0;color:#666666;font-size:14px;">Digital Receipt</p>
      </td>
    </tr>

    <!-- Receipt Number & Date -->
    <tr>
      <td style="padding:10px 40px;">
        <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e0e0e0;border-radius:8px;">
          <tr>
            <td style="padding:15px 20px;border-left:1px solid #e0e0e0;text-align:center;">
              <p style="margin:0;color:#999;font-size:11px;">מספר קבלה</p>
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

    <!-- VAT Breakdown -->
    <tr>
      <td style="padding:10px 40px;">
        <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
          <tr>
            <td style="padding:8px 16px;font-size:13px;color:#666;">סכום לפני מע"מ</td>
            <td style="padding:8px 16px;font-size:13px;text-align:left;color:#666;">₪${subtotal.toFixed(2)}</td>
          </tr>
          <tr>
            <td style="padding:8px 16px;font-size:13px;color:#666;">מע"מ ${vatRate}%</td>
            <td style="padding:8px 16px;font-size:13px;text-align:left;color:#666;">₪${vatAmount.toFixed(2)}</td>
          </tr>
          <tr style="border-top:2px solid #000;">
            <td style="padding:12px 16px;font-size:16px;font-weight:bold;color:#000;">סה"כ לתשלום</td>
            <td style="padding:12px 16px;font-size:16px;font-weight:bold;text-align:left;color:#000;">₪${total.toFixed(2)}</td>
          </tr>
        </table>
      </td>
    </tr>

    <!-- Payment Method -->
    <tr>
      <td style="padding:15px 40px;">
        <p style="margin:0;font-size:12px;color:#999;">אמצעי תשלום: ${receipt.paymentMethod}</p>
        ${receipt.nayaxTransactionId ? `<p style="margin:4px 0 0;font-size:12px;color:#999;">מספר עסקה: ${receipt.nayaxTransactionId}</p>` : ''}
      </td>
    </tr>

    <!-- Legal Footer -->
    <tr>
      <td style="padding:20px 40px;border-top:1px solid #e0e0e0;">
        <p style="margin:0;font-size:11px;color:#999;text-align:center;">
          מסמך זה מהווה קבלה דיגיטלית בהתאם לחוק ניהול ספרים ותקנות מס הכנסה
        </p>
        <p style="margin:4px 0;font-size:11px;color:#999;text-align:center;">
          This document is a legally valid digital receipt per Israeli tax law
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
        <p style="margin:0;color:#ffffff;font-size:12px;font-family:Arial,sans-serif;">⁦Pet Wash™⁩ | ${COMPANY_NAME_HE}</p>
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
        subject: `קבלה דיגיטלית ${receipt.receiptNumber} | ⁦Pet Wash™⁩`,
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

      const creditNoteNumber = await this.generateReceiptNumber();
      const issuedAt = new Date();

      const refundAmount = Math.abs(params.refundAmount);
      const vatBreakdown = this.calculateVATBreakdown(refundAmount);
      const shaamRequired = this.isShaamRequired(vatBreakdown.subtotalBeforeVAT, issuedAt);

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
        vatRate: (ISRAELI_VAT_RATE * 100).toFixed(2),
        vatAmount: (-vatBreakdown.vatAmount).toFixed(2),
        platformFeeAmount: '0',
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
}
