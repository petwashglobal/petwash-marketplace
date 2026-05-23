/**
 * Supplier-Invoice Screening Service — First Safe PR.
 *
 * Orchestrates the screening pipeline:
 *   upload PDF/image  →  hash  →  OCR (existing receiptOCRService)
 *                                ↓
 *                       fraud engine (existing receiptFraudDetection)
 *                                ↓
 *                       deterministic supplier-invoice checks (file-hash dup,
 *                       business-number match, VAT math, high amount, …)
 *                                ↓
 *                       pure screenInvoice()  →  checks + GREEN/YELLOW/RED + status
 *                                ↓
 *                       persist supplier_invoices + supplier_invoice_checks
 *                                ↓
 *                       audit event ("supplier_invoice_submitted")
 *
 * No money movement. No SUMIT send. No Masav. Terminal state for this PR is
 * 'ready_for_accountant' — actually sending to SUMIT is a separate, flag-gated
 * follow-up PR (see SDD § "First safe PR" and the PR's Deferred TODO).
 *
 * OCR or fraud-engine failures become VISIBLE warning checks (never silent
 * passes), per the SDD's acceptance criteria.
 */

import crypto from 'crypto';
import { nanoid } from 'nanoid';
import { eq, and, ne } from 'drizzle-orm';
import { db } from '../db';
import { suppliers } from '../../shared/schema-corporate';
import {
  supplierInvoices,
  supplierInvoiceChecks,
  type SupplierInvoice,
} from '../../shared/schema';
import { storage } from '../lib/firebase-admin';
import { receiptOCRService } from './ReceiptOCRService';
import { receiptFraudDetection } from './ReceiptFraudDetection';
import { recordAuditEvent } from '../utils/auditSignature';
import { logger } from '../lib/logger';
import {
  screenInvoice,
  evaluateApproval,
  type ScreeningInput,
  type RiskLevel,
} from '../lib/supplierInvoiceScreening';

export interface IngestInput {
  fileBuffer: Buffer;
  fileName: string;
  contentType: string;
  supplierId: number | null;
  uploadedByUid: string;
  uploadedByEmail: string;
  ipAddress: string;
  userAgent: string;
}

export interface IngestResult {
  invoice: SupplierInvoice;
  checks: Array<{ checkType: string; result: string; scoreImpact: number; details?: unknown }>;
}

function normalizedSupplierMatch(invoiceName: string, supplierName: string): boolean {
  const a = invoiceName.trim().toLowerCase();
  const b = supplierName.trim().toLowerCase();
  if (!a || !b) return false;
  return a === b || a.includes(b) || b.includes(a);
}

class SupplierInvoiceScreeningService {
  async ingest(input: IngestInput): Promise<IngestResult> {
    const fileHash = crypto.createHash('sha256').update(input.fileBuffer).digest('hex');

    // Deterministic duplicate: same file hash, not already rejected.
    const [existingByHash] = await db
      .select({ id: supplierInvoices.id })
      .from(supplierInvoices)
      .where(and(eq(supplierInvoices.fileHash, fileHash), ne(supplierInvoices.status, 'rejected')))
      .limit(1);
    const fileHashDuplicate = !!existingByHash;

    // OCR — failure is visible, not silent.
    let ocrData: Awaited<ReturnType<typeof receiptOCRService.extractReceiptData>> | null = null;
    let ocrAvailable = true;
    try {
      ocrData = await receiptOCRService.extractReceiptData(input.fileBuffer);
    } catch (err) {
      ocrAvailable = false;
      logger.warn('[SupplierInvoiceScreening] OCR unavailable', { err: (err as Error).message });
    }

    // Persist file to Firebase Storage, signed-URL for the fraud engine to fetch.
    const bucket = storage.bucket();
    const ext = (input.fileName.split('.').pop() || 'pdf').toLowerCase().replace(/[^a-z0-9]/g, '') || 'pdf';
    const storagePath = `supplier-invoices/${input.supplierId ?? 'unassigned'}/${nanoid(24)}.${ext}`;
    const fileObj = bucket.file(storagePath);
    await fileObj.save(input.fileBuffer, { metadata: { contentType: input.contentType } });
    let fileUrl: string | null = null;
    try {
      const [url] = await fileObj.getSignedUrl({
        action: 'read',
        expires: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7d signed URL for fraud-engine fetch + admin review
      });
      fileUrl = url;
    } catch (err) {
      logger.warn('[SupplierInvoiceScreening] Signed-URL generation failed', { err: (err as Error).message });
    }

    // Optional supplier lookup for business-number / name / Osek-classification
    // comparison. osek_classification is read so the screening lib can flag a
    // patur-supplier-charging-VAT mismatch (per PR-S5c).
    let supplierRow:
      | {
          id: number;
          companyName: string;
          taxId: string | null;
          osekClassification: string;
        }
      | null = null;
    if (input.supplierId != null) {
      const [row] = await db
        .select({
          id: suppliers.id,
          companyName: suppliers.companyName,
          taxId: suppliers.taxId,
          osekClassification: suppliers.osekClassification,
        })
        .from(suppliers)
        .where(eq(suppliers.id, input.supplierId))
        .limit(1);
      supplierRow = row ?? null;
    }

    const businessNumberOnInvoice = ocrData?.taxId ?? null;
    const businessNumberMatchesSupplier: boolean | null =
      businessNumberOnInvoice && supplierRow?.taxId
        ? businessNumberOnInvoice === supplierRow.taxId
        : null;

    const supplierNameMatchesSupplier: boolean | null =
      ocrData?.vendorName && supplierRow?.companyName
        ? normalizedSupplierMatch(ocrData.vendorName, supplierRow.companyName)
        : null;

    // Fraud engine — failure is visible, not silent.
    let fraudEngineScore: number | null = null;
    let fraudEngineFlags: string[] = [];
    let fraudEngineAvailable = true;
    if (fileUrl) {
      try {
        const totalForEngine = ocrData?.totalAmount ?? 0;
        const result = await receiptFraudDetection.analyzeReceipt(
          fileUrl,
          input.uploadedByUid,
          totalForEngine,
        );
        fraudEngineScore = result.fraudScore;
        fraudEngineFlags = result.flags;
      } catch (err) {
        fraudEngineAvailable = false;
        logger.warn('[SupplierInvoiceScreening] Fraud engine unavailable', { err: (err as Error).message });
      }
    } else {
      fraudEngineAvailable = false;
    }

    const osekClassification =
      (supplierRow?.osekClassification as 'patur' | 'murshe' | 'chevra' | 'unknown' | undefined) ??
      undefined;

    const facts: ScreeningInput = {
      fileHashDuplicate,
      // Per-supplier invoice-number duplicate detection is deferred until
      // explicit invoice-number extraction is added (see PR Deferred TODO).
      invoiceNumberDuplicate: false,
      businessNumberOnInvoice,
      businessNumberMatchesSupplier,
      supplierNameMatchesSupplier,
      // Bank-account extraction now wired via ReceiptOCRService.bankAccount.
      // The "verified" comparison against a supplier's saved bank account is
      // still pending (suppliers.bankAccountDetails is encrypted jsonb; the
      // compare needs a structured-field PR), so matchesVerified stays null.
      bankAccountVisibleOnInvoice: !!ocrData?.bankAccount,
      bankAccountMatchesVerified: null,
      amountBeforeVat: null,
      vatAmount: null,
      totalAmount: ocrData?.totalAmount ?? null,
      ocrAvailable,
      fraudEngineAvailable,
      fraudEngineScore,
      // Osek classification — wired now (PR-S5c columns are on main). When
      // the supplier is 'unknown' the lib emits an osek_classification_unknown
      // warning so finance classifies the supplier before approving.
      //
      // SHAAM (ff PR-S5a) fields are NOT wired here yet — the
      // supplier_invoices.shaam_required / shaam_allocation_number columns
      // and the matching ScreeningInput fields live on the unmerged PR-S5a
      // stack. Once that merges to main a follow-up adds:
      //   shaamAllocationRequired, shaamAllocationNumberOnInvoice into facts,
      //   shaamRequired + shaamAllocationNumber into the insert below.
      supplierOsekClassification: osekClassification,
    };
    const screening = screenInvoice(facts);

    const now = new Date();
    const [inserted] = await db
      .insert(supplierInvoices)
      .values({
        supplierId: input.supplierId ?? null,
        fileUrl,
        fileHash,
        source: 'admin_upload',
        ocrInvoiceNumber: null,
        ocrSupplierName: ocrData?.vendorName ?? null,
        ocrBusinessNumber: businessNumberOnInvoice,
        ocrInvoiceDate: ocrData?.date ?? null,
        ocrAmountBeforeVat: null,
        ocrVatAmount: null,
        ocrTotalAmount: ocrData?.totalAmount != null ? String(ocrData.totalAmount) : null,
        ocrCurrency: 'ILS',
        ocrRawText: ocrData?.rawText ?? null,
        fraudEngineScore,
        fraudEngineFlags,
        riskScore: screening.riskScore,
        riskLevel: screening.riskLevel,
        status: screening.status,
        uploadedBy: input.uploadedByUid,
        // shaamRequired + shaamAllocationNumber columns will be added by
        // PR-S5a (migration 0026). The OCR extracts shaamAllocationNumber
        // into ocrData already (PR-OCR-1 is on main); the persistence wiring
        // follows once PR-S5a's migration lands.
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    if (screening.checks.length > 0) {
      await db.insert(supplierInvoiceChecks).values(
        screening.checks.map((c) => ({
          invoiceId: inserted.id,
          checkType: c.type,
          result: c.result,
          scoreImpact: c.scoreImpact,
          details: (c.details ?? null) as unknown,
        })),
      );
    }

    await recordAuditEvent({
      eventType: 'supplier_invoice_submitted',
      customerUid: input.uploadedByUid,
      metadata: {
        invoiceId: inserted.id,
        supplierId: input.supplierId,
        fileHash,
        riskScore: screening.riskScore,
        riskLevel: screening.riskLevel,
        status: screening.status,
        ocrAvailable,
        fraudEngineAvailable,
      },
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
    }).catch((err) =>
      logger.warn('[SupplierInvoiceScreening] audit failed (non-blocking)', { err: (err as Error).message }),
    );

    return {
      invoice: inserted,
      checks: screening.checks.map((c) => ({
        checkType: c.type,
        result: c.result,
        scoreImpact: c.scoreImpact,
        details: c.details,
      })),
    };
  }

  async approve(opts: {
    invoiceId: number;
    actorUid: string;
    actorEmail: string;
    actorRole: string;
    note?: string;
    ipAddress: string;
    userAgent: string;
  }) {
    const [invoice] = await db
      .select()
      .from(supplierInvoices)
      .where(eq(supplierInvoices.id, opts.invoiceId))
      .limit(1);
    if (!invoice) {
      const e = new Error('Invoice not found');
      (e as Error & { code?: string }).code = 'NOT_FOUND';
      throw e;
    }
    if (invoice.status === 'ready_for_accountant' || invoice.status === 'rejected') {
      const e = new Error(`Invoice already ${invoice.status}`);
      (e as Error & { code?: string }).code = 'INVALID_STATE';
      throw e;
    }
    const decision = evaluateApproval({
      invoice: {
        uploadedBy: invoice.uploadedBy ?? '',
        riskLevel: (invoice.riskLevel as RiskLevel) ?? 'green',
        status: invoice.status,
      },
      actor: { userId: opts.actorUid, role: opts.actorRole },
      action: 'approve',
      note: opts.note,
    });
    if (!decision.ok) {
      const e = new Error(decision.reason ?? 'approval_denied');
      (e as Error & { code?: string }).code = 'APPROVAL_DENIED';
      throw e;
    }
    const now = new Date();
    await db
      .update(supplierInvoices)
      .set({
        status: 'ready_for_accountant',
        approvedBy: opts.actorUid,
        approvedAt: now,
        approvalNote: opts.note ?? null,
        updatedAt: now,
      })
      .where(eq(supplierInvoices.id, opts.invoiceId));

    await recordAuditEvent({
      eventType: 'supplier_invoice_approved',
      customerUid: opts.actorEmail,
      metadata: {
        invoiceId: opts.invoiceId,
        fromStatus: invoice.status,
        riskLevel: invoice.riskLevel,
        note: opts.note ?? null,
      },
      ipAddress: opts.ipAddress,
      userAgent: opts.userAgent,
    }).catch((err) =>
      logger.warn('[SupplierInvoiceScreening] audit failed (non-blocking)', { err: (err as Error).message }),
    );
    return { ok: true as const, status: 'ready_for_accountant' as const };
  }

  async reject(opts: {
    invoiceId: number;
    actorUid: string;
    actorEmail: string;
    actorRole: string;
    reason: string;
    ipAddress: string;
    userAgent: string;
  }) {
    const [invoice] = await db
      .select()
      .from(supplierInvoices)
      .where(eq(supplierInvoices.id, opts.invoiceId))
      .limit(1);
    if (!invoice) {
      const e = new Error('Invoice not found');
      (e as Error & { code?: string }).code = 'NOT_FOUND';
      throw e;
    }
    if (invoice.status === 'ready_for_accountant' || invoice.status === 'rejected') {
      const e = new Error(`Invoice already ${invoice.status}`);
      (e as Error & { code?: string }).code = 'INVALID_STATE';
      throw e;
    }
    const decision = evaluateApproval({
      invoice: {
        uploadedBy: invoice.uploadedBy ?? '',
        riskLevel: (invoice.riskLevel as RiskLevel) ?? 'green',
        status: invoice.status,
      },
      actor: { userId: opts.actorUid, role: opts.actorRole },
      action: 'reject',
    });
    if (!decision.ok) {
      const e = new Error(decision.reason ?? 'rejection_denied');
      (e as Error & { code?: string }).code = 'APPROVAL_DENIED';
      throw e;
    }
    const now = new Date();
    await db
      .update(supplierInvoices)
      .set({
        status: 'rejected',
        rejectedBy: opts.actorUid,
        rejectedAt: now,
        rejectionReason: opts.reason,
        updatedAt: now,
      })
      .where(eq(supplierInvoices.id, opts.invoiceId));

    await recordAuditEvent({
      eventType: 'supplier_invoice_rejected',
      customerUid: opts.actorEmail,
      metadata: { invoiceId: opts.invoiceId, reason: opts.reason, fromStatus: invoice.status },
      ipAddress: opts.ipAddress,
      userAgent: opts.userAgent,
    }).catch((err) =>
      logger.warn('[SupplierInvoiceScreening] audit failed (non-blocking)', { err: (err as Error).message }),
    );
    return { ok: true as const, status: 'rejected' as const };
  }

  async get(invoiceId: number) {
    const [invoice] = await db
      .select()
      .from(supplierInvoices)
      .where(eq(supplierInvoices.id, invoiceId))
      .limit(1);
    if (!invoice) return null;
    const checks = await db
      .select()
      .from(supplierInvoiceChecks)
      .where(eq(supplierInvoiceChecks.invoiceId, invoiceId));
    return { invoice, checks };
  }

  /**
   * Admin list endpoint. Returns the most recent invoices first, with
   * optional risk-level and status filters. Pagination via offset/limit.
   * Cap is 100 per page so the admin table stays responsive.
   */
  async list(opts: {
    limit?: number;
    offset?: number;
    riskLevel?: 'green' | 'yellow' | 'red';
    status?: string;
  }) {
    const limit = Math.min(Math.max(opts.limit ?? 50, 1), 100);
    const offset = Math.max(opts.offset ?? 0, 0);

    const conditions = [] as any[];
    if (opts.riskLevel) conditions.push(eq(supplierInvoices.riskLevel, opts.riskLevel));
    if (opts.status) conditions.push(eq(supplierInvoices.status, opts.status));

    const baseQuery = db
      .select()
      .from(supplierInvoices)
      .$dynamic();

    const filtered = conditions.length > 0 ? baseQuery.where(and(...conditions)) : baseQuery;
    const rows = await filtered.limit(limit).offset(offset);

    // Sort newest first in app code (Drizzle orderBy DESC syntax varies by version).
    rows.sort((a, b) => {
      const aT = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const bT = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return bT - aT;
    });

    return { rows, limit, offset };
  }
}

export const supplierInvoiceScreeningService = new SupplierInvoiceScreeningService();
