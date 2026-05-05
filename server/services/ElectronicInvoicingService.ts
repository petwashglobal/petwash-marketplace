import crypto from 'crypto';
import { db } from '../db';
import { electronicInvoices } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { logger } from '../lib/logger';
import IsraeliTaxAPIService, { type InvoiceSubmissionPayload } from './IsraeliTaxAPIService';
import { GoogleSheetsService } from './googleSheetsIntegration';
import { requiresAllocationNumber } from './LegalThresholdConfig';
import { ISRAEL_VAT_RATE } from '@shared/israel-compliance-config';

/**
 * THRESHOLD NOTE — Israeli Digital Invoice Law (חוק חשבוניות דיגיטליות):
 *
 *   From 1 Jan 2026:  ₪10,000 before VAT  (B2B mandatory electronic invoicing)
 *   From 1 Jun 2026:  ₪5,000  before VAT
 *   From 1 Jan 2027:  ₪0      (all B2B)
 *
 * Do NOT use a hardcoded constant — thresholds change by date.
 * Use requiresAllocationNumber() from LegalThresholdConfig for all checks.
 */

interface CreateInvoiceParams {
  serviceType: 'k9000_wash' | 'sitter_suite' | 'walk_my_pet' | 'pettrek_transport' | 'pet_wash' | 'other';
  transactionId?: string;
  customerName: string;
  customerEmail?: string;
  customerPhone?: string;
  customerTaxId?: string;
  customerAddress?: string;
  totalAmount: number;
  vatRate?: number;
  vatAmount?: number;
  amountBeforeVAT?: number;
  invoiceNumber?: string;
  invoiceDate?: string;
  currency?: string;
  lineItems: Array<{
    description: string;
    quantity: number;
    unitPrice: number;
    totalPrice?: number;
    vatRate?: number;
  }>;
  paymentMethod?: string;
  createdBy?: string;
}

class ElectronicInvoicingService {
  private generateInvoiceNumber(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const random = crypto.randomInt(0, 10000).toString().padStart(4, '0');
    return `INV-${year}-${month}${day}-${random}`;
  }

  private generateInvoiceId(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const random = crypto.randomInt(0, 10000).toString().padStart(4, '0');
    return `INV-${year}-${month}${day}-${random}`;
  }

  private calculateAmounts(params: CreateInvoiceParams) {
    const { totalAmount, vatRate = ISRAEL_VAT_RATE, lineItems, vatAmount: providedVatAmount, amountBeforeVAT: providedAmountBeforeVAT } = params;

    const calculatedLineItems = lineItems.map(item => {
      const itemVatRate = item.vatRate ?? vatRate;
      const totalPrice = item.totalPrice ?? (item.quantity * item.unitPrice);
      return {
        ...item,
        totalPrice,
        vatRate: itemVatRate,
      };
    });

    // Use provided amounts if available, otherwise calculate
    const amountBeforeVat = providedAmountBeforeVAT ?? (totalAmount / (1 + vatRate));
    const vatAmount = providedVatAmount ?? (totalAmount - amountBeforeVat);

    return {
      amountBeforeVat: Number(amountBeforeVat.toFixed(2)),
      vatAmount: Number(vatAmount.toFixed(2)),
      totalAmount: Number(totalAmount.toFixed(2)),
      lineItems: calculatedLineItems,
    };
  }

  private determineInvoiceType(totalAmount: number, customerTaxId?: string): 'B2B' | 'B2C' {
    if (customerTaxId && customerTaxId.length > 0) {
      return 'B2B';
    }
    return 'B2C';
  }

  /**
   * Determines if this invoice requires ITA allocation number.
   * Uses the date-aware threshold from LegalThresholdConfig.
   * amountBeforeVat must be in NIS (not agorot).
   */
  private requiresElectronicInvoicing(
    invoiceType: 'B2B' | 'B2C',
    amountBeforeVat: number,
    issueDate: Date = new Date()
  ): boolean {
    if (invoiceType !== 'B2B') return false;
    return requiresAllocationNumber(amountBeforeVat, true, issueDate);
  }

  async createInvoice(params: CreateInvoiceParams) {
    try {
      if (!params.invoiceNumber) {
        throw new Error('invoiceNumber is required for ITA electronic invoicing — generate a sequential number via TaxSequenceService before calling createInvoice');
      }
      const invoiceId = params.invoiceNumber;
      const invoiceNumber = params.invoiceNumber;
      const amounts = this.calculateAmounts(params);
      const invoiceType = this.determineInvoiceType(amounts.totalAmount, params.customerTaxId);
      const issueDate = params.invoiceDate ? new Date(params.invoiceDate) : new Date();
      // Pass amountBeforeVat (not total) — threshold is applied to pre-VAT amount
      const requiresElectronic = this.requiresElectronicInvoicing(invoiceType, amounts.amountBeforeVat, issueDate);

      logger.info('[Electronic Invoicing] Creating invoice', {
        invoiceId,
        invoiceNumber,
        invoiceType,
        totalAmount: amounts.totalAmount,
        requiresElectronic,
        serviceType: params.serviceType,
      });

      const [invoice] = await db.insert(electronicInvoices).values({
        invoiceId,
        invoiceNumber,
        serviceType: params.serviceType,
        transactionId: params.transactionId,
        invoiceDate: new Date(),
        invoiceType,
        customerTaxId: params.customerTaxId || null,
        customerName: params.customerName,
        customerEmail: params.customerEmail || null,
        customerPhone: params.customerPhone || null,
        customerAddress: params.customerAddress || null,
        amountBeforeVat: amounts.amountBeforeVat.toString(),
        vatAmount: amounts.vatAmount.toString(),
        totalAmount: amounts.totalAmount.toString(),
        vatRate: (params.vatRate || ISRAEL_VAT_RATE).toString(),
        currency: 'ILS',
        lineItems: amounts.lineItems,
        paymentMethod: params.paymentMethod || 'other',
        paymentStatus: 'paid',
        itaSubmissionStatus: requiresElectronic ? 'pending' : 'not_required',
        requiresElectronicInvoicing: requiresElectronic,
        complianceStatus: 'compliant',
        createdBy: params.createdBy || 'system',
      }).returning();

      GoogleSheetsService.logInvoice({
        invoiceId,
        invoiceNumber,
        customerName: params.customerName,
        customerEmail: params.customerEmail || '',
        amount: amounts.amountBeforeVat.toString(),
        vatAmount: amounts.vatAmount.toString(),
        totalAmount: amounts.totalAmount.toString(),
        currency: params.currency || 'ILS',
        dueDate: new Date().toISOString().split('T')[0],
        paymentStatus: 'paid',
        description: params.lineItems.map(i => i.description).join(', '),
        platform: params.serviceType,
      }).catch(err => logger.error('[Electronic Invoicing] Google Sheets logging failed - DB record saved', err));

      if (requiresElectronic && IsraeliTaxAPIService.isConfigured()) {
        logger.info('[Electronic Invoicing] Submitting to ITA API (B2B ≥ ₪25,000)', {
          invoiceId,
          totalAmount: amounts.totalAmount,
        });

        await this.submitToITA(invoice.id);
      } else if (requiresElectronic && !IsraeliTaxAPIService.isConfigured()) {
        logger.warn('[Electronic Invoicing] ⚠️ Invoice requires electronic submission but ITA API not configured', {
          invoiceId,
          totalAmount: amounts.totalAmount,
        });

        await db.update(electronicInvoices)
          .set({
            complianceStatus: 'warning',
            complianceNotes: 'ITA API credentials not configured. Electronic invoicing required but not submitted.',
          })
          .where(eq(electronicInvoices.id, invoice.id));
      }

      return invoice;
    } catch (error: any) {
      logger.error('[Electronic Invoicing] Failed to create invoice', {
        error: error.message,
        params,
      });
      throw error;
    }
  }

  async submitToITA(invoiceDbId: number) {
    try {
      const invoice = await db.query.electronicInvoices.findFirst({
        where: eq(electronicInvoices.id, invoiceDbId),
      });

      if (!invoice) {
        throw new Error(`Invoice not found: ${invoiceDbId}`);
      }

      if (invoice.itaSubmissionStatus === 'submitted' || invoice.itaSubmissionStatus === 'accepted') {
        logger.info('[Electronic Invoicing] Invoice already submitted to ITA', {
          invoiceId: invoice.invoiceId,
          status: invoice.itaSubmissionStatus,
        });
        return;
      }

      const payload: InvoiceSubmissionPayload = {
        invoiceNumber: invoice.invoiceNumber,
        invoiceDate: new Date(invoice.invoiceDate).toISOString(),
        customerTaxId: invoice.customerTaxId || '',
        customerName: invoice.customerName,
        totalAmount: parseFloat(invoice.totalAmount),
        vatAmount: parseFloat(invoice.vatAmount),
        amountBeforeVAT: parseFloat(invoice.amountBeforeVat),
        lineItems: (invoice.lineItems as any[]).map(item => ({
          description: item.description,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          totalPrice: item.totalPrice,
          vatRate: item.vatRate,
        })),
        invoiceType: invoice.invoiceType as 'B2B' | 'B2C',
        currency: invoice.currency,
        paymentMethod: invoice.paymentMethod || undefined,
      };

      const result = await IsraeliTaxAPIService.submitInvoice(payload);

      await db.update(electronicInvoices)
        .set({
          itaSubmissionStatus: result.status,
          itaReferenceNumber: result.itaReferenceNumber || null,
          itaSubmittedAt: result.success ? new Date() : null,
          itaResponse: result as any,
          itaErrorMessage: result.errorMessage || null,
          complianceStatus: result.success ? 'compliant' : 'warning',
          complianceNotes: result.errorMessage || null,
          updatedAt: new Date(),
        })
        .where(eq(electronicInvoices.id, invoiceDbId));

      logger.info('[Electronic Invoicing] ITA submission completed', {
        invoiceId: invoice.invoiceId,
        success: result.success,
        itaReference: result.itaReferenceNumber,
      });

      return result;
    } catch (error: any) {
      logger.error('[Electronic Invoicing] ITA submission failed', {
        invoiceDbId,
        error: error.message,
      });

      await db.update(electronicInvoices)
        .set({
          itaSubmissionStatus: 'error',
          itaErrorMessage: error.message,
          complianceStatus: 'non_compliant',
          complianceNotes: `ITA API submission failed: ${error.message}`,
          updatedAt: new Date(),
        })
        .where(eq(electronicInvoices.id, invoiceDbId));

      throw error;
    }
  }

  async getInvoiceStatus(invoiceId: string) {
    const invoice = await db.query.electronicInvoices.findFirst({
      where: eq(electronicInvoices.invoiceId, invoiceId),
    });

    if (!invoice) {
      throw new Error(`Invoice not found: ${invoiceId}`);
    }

    if (invoice.itaReferenceNumber && IsraeliTaxAPIService.isConfigured()) {
      try {
        const itaStatus = await IsraeliTaxAPIService.checkInvoiceStatus(invoice.itaReferenceNumber);
        
        await db.update(electronicInvoices)
          .set({
            itaSubmissionStatus: itaStatus.status,
            itaResponse: itaStatus.details,
            updatedAt: new Date(),
          })
          .where(eq(electronicInvoices.id, invoice.id));

        return {
          ...invoice,
          itaLiveStatus: itaStatus,
        };
      } catch (error: any) {
        logger.error('[Electronic Invoicing] Failed to check ITA status', {
          invoiceId,
          error: error.message,
        });
      }
    }

    return invoice;
  }

  async retryFailedSubmissions() {
    const failedInvoices = await db.query.electronicInvoices.findMany({
      where: eq(electronicInvoices.itaSubmissionStatus, 'error'),
    });

    logger.info('[Electronic Invoicing] Retrying failed submissions', {
      count: failedInvoices.length,
    });

    const results = [];
    for (const invoice of failedInvoices) {
      try {
        const result = await this.submitToITA(invoice.id);
        results.push({ invoiceId: invoice.invoiceId, success: result.success });
      } catch (error: any) {
        results.push({ invoiceId: invoice.invoiceId, success: false, error: error.message });
      }
    }

    return results;
  }

  async generateComplianceReport(startDate: Date, endDate: Date) {
    const invoices = await db.query.electronicInvoices.findMany();

    const filtered = invoices.filter(inv => {
      const invoiceDate = new Date(inv.invoiceDate);
      return invoiceDate >= startDate && invoiceDate <= endDate;
    });

    // Use date-aware threshold per LegalThresholdConfig (₪10k from Jan 2026, ₪5k from Jun 2026)
    const b2bRequiringAllocation = filtered.filter(inv => {
      if (inv.invoiceType !== 'B2B') return false;
      const invDate = new Date(inv.invoiceDate);
      const amountBeforeVat = parseFloat(inv.amountBeforeVat ?? inv.totalAmount) / (1 + ISRAEL_VAT_RATE);
      return requiresAllocationNumber(amountBeforeVat, true, invDate);
    });

    const submitted = b2bRequiringAllocation.filter(inv => 
      inv.itaSubmissionStatus === 'submitted' || inv.itaSubmissionStatus === 'accepted'
    );

    const pending = b2bRequiringAllocation.filter(inv => inv.itaSubmissionStatus === 'pending');
    const failed = b2bRequiringAllocation.filter(inv => 
      inv.itaSubmissionStatus === 'error' || inv.itaSubmissionStatus === 'rejected'
    );

    return {
      period: {
        start: startDate.toISOString(),
        end: endDate.toISOString(),
      },
      totalInvoices: filtered.length,
      b2bOver25k: {
        total: b2bOver25k.length,
        submitted: submitted.length,
        pending: pending.length,
        failed: failed.length,
      },
      complianceRate: b2bOver25k.length > 0 
        ? ((submitted.length / b2bOver25k.length) * 100).toFixed(2) + '%'
        : '100%',
      failedInvoices: failed.map(inv => ({
        invoiceId: inv.invoiceId,
        invoiceNumber: inv.invoiceNumber,
        totalAmount: inv.totalAmount,
        errorMessage: inv.itaErrorMessage,
      })),
    };
  }
}

export default new ElectronicInvoicingService();
