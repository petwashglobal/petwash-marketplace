import { db } from '../db';
import { electronicInvoices } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { logger } from '../lib/logger';
import IsraeliTaxAPIService, { type InvoiceSubmissionPayload } from './IsraeliTaxAPIService';

const THRESHOLD_B2B_ELECTRONIC = 25000; // ₪25,000 - B2B threshold for mandatory electronic invoicing (2025)

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
    const random = Math.floor(Math.random() * 9999).toString().padStart(4, '0');
    return `INV-${year}-${month}${day}-${random}`;
  }

  private generateInvoiceId(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const random = Math.floor(Math.random() * 9999).toString().padStart(4, '0');
    return `INV-${year}-${month}${day}-${random}`;
  }

  private calculateAmounts(params: CreateInvoiceParams) {
    const { totalAmount, vatRate = 0.18, lineItems, vatAmount: providedVatAmount, amountBeforeVAT: providedAmountBeforeVAT } = params;

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

  private requiresElectronicInvoicing(invoiceType: 'B2B' | 'B2C', totalAmount: number): boolean {
    if (invoiceType === 'B2B' && totalAmount >= THRESHOLD_B2B_ELECTRONIC) {
      return true;
    }
    return false;
  }

  async createInvoice(params: CreateInvoiceParams) {
    try {
      const invoiceId = params.invoiceNumber || this.generateInvoiceId();
      const invoiceNumber = params.invoiceNumber || this.generateInvoiceNumber();
      const amounts = this.calculateAmounts(params);
      const invoiceType = this.determineInvoiceType(amounts.totalAmount, params.customerTaxId);
      const requiresElectronic = this.requiresElectronicInvoicing(invoiceType, amounts.totalAmount);

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
        vatRate: (params.vatRate || 0.18).toString(),
        currency: 'ILS',
        lineItems: amounts.lineItems,
        paymentMethod: params.paymentMethod || 'other',
        paymentStatus: 'paid',
        itaSubmissionStatus: requiresElectronic ? 'pending' : 'not_required',
        requiresElectronicInvoicing: requiresElectronic,
        complianceStatus: 'compliant',
        createdBy: params.createdBy || 'system',
      }).returning();

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

    const b2bOver25k = filtered.filter(inv => 
      inv.invoiceType === 'B2B' && parseFloat(inv.totalAmount) >= THRESHOLD_B2B_ELECTRONIC
    );

    const submitted = b2bOver25k.filter(inv => 
      inv.itaSubmissionStatus === 'submitted' || inv.itaSubmissionStatus === 'accepted'
    );

    const pending = b2bOver25k.filter(inv => inv.itaSubmissionStatus === 'pending');
    const failed = b2bOver25k.filter(inv => 
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
