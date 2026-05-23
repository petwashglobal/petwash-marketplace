/**
 * SUMIT email dispatcher — Mission-4 activation mode 'email'.
 *
 * When `sumit.mode === 'email'`, an admin click on "Send to SUMIT"
 * routes here instead of the (still-unwired) HTTP API. We compose a
 * structured email to ACCOUNTANT_EMAIL with the supplier invoice
 * attached (PDF/image from firebase storage) and a machine-readable
 * JSON block in the body. The accountant manually enters it into
 * SUMIT through their own login session.
 *
 * Why this exists: most small Israeli businesses operate exactly this
 * way — the API does the same thing the accountant types in, and
 * SUMIT explicitly supports both. Email mode unblocks "live soon"
 * without requiring the still-403'd API spec.
 *
 * Triple-gated upstream by the dispatcher — this service never fires
 * without (a) both feature flags ON, (b) mode === 'email', (c) preflight
 * passed. It DOES require SENDGRID_API_KEY + ACCOUNTANT_EMAIL env.
 *
 * Uses the canonical `sendGuardedEmail` wrapper so the EmailSpendGuard
 * circuit-breaker can short-circuit a runaway send loop. Counters are
 * tracked under service tag 'sumit_dispatch'.
 */

import { sendGuardedEmail } from '../lib/guarded-sendgrid';
import { storage } from '../lib/firebase-admin';
import { logger } from '../lib/logger';
import type { SupplierInvoice } from '../../shared/schema';

export interface SumitEmailDispatchInput {
  invoice: SupplierInvoice;
  supplierName: string;
  idempotencyKey: string;
  /** Optional override; defaults to process.env.ACCOUNTANT_EMAIL. */
  toEmailOverride?: string;
}

export interface SumitEmailDispatchResult {
  sent: boolean;
  /**
   * Always 'email:<idempotencyKey>' on success so the persisted
   * sumit_document_id reflects how the document reached SUMIT. The
   * accountant's own SUMIT document number is set separately later
   * when they reply to the email or update the invoice manually.
   */
  pseudoDocumentId: string;
  reason?: string;
}

function readAccountantEmail(): string | null {
  const v = process.env.ACCOUNTANT_EMAIL;
  return v && v.trim() ? v.trim() : null;
}

function formatIls(n: number | null | undefined): string {
  if (n == null) return '—';
  return `₪${Number(n).toLocaleString('he-IL', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

class SumitEmailDispatcher {
  async send(input: SumitEmailDispatchInput): Promise<SumitEmailDispatchResult> {
    const to = input.toEmailOverride ?? readAccountantEmail();
    if (!to) {
      return {
        sent: false,
        pseudoDocumentId: `email:${input.idempotencyKey}`,
        reason: 'ACCOUNTANT_EMAIL not configured',
      };
    }

    const inv = input.invoice;

    // Pull the original file as a base64 attachment when available.
    // Reusing the existing firebase storage path the screening service
    // wrote. If the file isn't reachable we still send the structured
    // email — the accountant can request the file separately rather
    // than block the dispatch entirely.
    let attachment: { content: string; filename: string; type: string } | null = null;
    try {
      if (inv.fileUrl) {
        // fileUrl is a 7-day signed URL; we don't fetch through it (could
        // be expired in some edge cases). Instead, derive the storage
        // path from the convention used in SupplierInvoiceScreeningService
        // and download via the admin SDK. If the convention ever drifts,
        // the catch below keeps email dispatch alive.
        const path = `supplier-invoices/${inv.supplierId ?? 'unassigned'}/`;
        const [files] = await storage.bucket().getFiles({ prefix: path });
        const match = files.find((f) => f.name.startsWith(path));
        if (match) {
          const [buf] = await match.download();
          attachment = {
            content: buf.toString('base64'),
            filename: match.name.split('/').pop() ?? `supplier-invoice-${inv.id}.pdf`,
            type: match.metadata.contentType ?? 'application/octet-stream',
          };
        }
      }
    } catch (e) {
      logger.warn('[SumitEmailDispatch] file attach failed; sending without', {
        invoiceId: inv.id,
        err: (e as Error).message,
      });
      attachment = null;
    }

    const subject = `[PetWash] Supplier Invoice #${inv.id} — ${input.supplierName} — ${formatIls(
      inv.ocrTotalAmount != null ? Number(inv.ocrTotalAmount) : null,
    )}`;

    const jsonBlock = JSON.stringify(
      {
        petwash_invoice_id: inv.id,
        idempotency_key: input.idempotencyKey,
        supplier: {
          id: inv.supplierId,
          name: input.supplierName,
          business_number: inv.ocrBusinessNumber,
        },
        invoice: {
          ocr_number: inv.ocrInvoiceNumber,
          ocr_date: inv.ocrInvoiceDate,
          amount_before_vat: inv.ocrAmountBeforeVat,
          vat_amount: inv.ocrVatAmount,
          total_amount: inv.ocrTotalAmount,
          currency: inv.ocrCurrency ?? 'ILS',
          shaam_allocation_number: (inv as any).shaamAllocationNumber ?? null,
        },
        risk: {
          score: inv.riskScore,
          level: inv.riskLevel,
          status: inv.status,
        },
        sent_via: 'petwash-sumit-email-dispatcher-v1',
      },
      null,
      2,
    );

    const html =
      `<p>חשבונית ספק לרישום ב-SUMIT</p>` +
      `<table style="border-collapse:collapse;font-family:Arial,sans-serif;font-size:13px">` +
      `<tr><td><b>ספק:</b></td><td>${escapeHtml(input.supplierName)}</td></tr>` +
      `<tr><td><b>ח.פ:</b></td><td>${escapeHtml(inv.ocrBusinessNumber ?? '—')}</td></tr>` +
      `<tr><td><b>מס׳ חשבונית (OCR):</b></td><td>${escapeHtml(inv.ocrInvoiceNumber ?? '—')}</td></tr>` +
      `<tr><td><b>תאריך:</b></td><td>${escapeHtml(inv.ocrInvoiceDate ?? '—')}</td></tr>` +
      `<tr><td><b>סכום לפני מע״מ:</b></td><td>${formatIls(inv.ocrAmountBeforeVat != null ? Number(inv.ocrAmountBeforeVat) : null)}</td></tr>` +
      `<tr><td><b>מע״מ:</b></td><td>${formatIls(inv.ocrVatAmount != null ? Number(inv.ocrVatAmount) : null)}</td></tr>` +
      `<tr><td><b>סה״כ:</b></td><td>${formatIls(inv.ocrTotalAmount != null ? Number(inv.ocrTotalAmount) : null)}</td></tr>` +
      `<tr><td><b>ציון סיכון:</b></td><td>${inv.riskScore}/100 (${inv.riskLevel})</td></tr>` +
      `<tr><td><b>Idempotency key:</b></td><td><code>${escapeHtml(input.idempotencyKey)}</code></td></tr>` +
      `</table>` +
      `<p>מצורף הקובץ המקורי (PDF/תמונה). מטא-דאטה ב-JSON:</p>` +
      `<pre style="background:#f5f5f5;padding:10px;border-radius:6px;direction:ltr;text-align:left">${escapeHtml(jsonBlock)}</pre>` +
      `<p style="color:#888;font-size:11px">דוא״ל זה נוצר אוטומטית ע״י PetWash. אל תשיב לכתובת ה-from — ענה למייל ההפעלה של PetWash אם צריך הבהרה.</p>`;

    const text =
      `Supplier Invoice for SUMIT entry\n\n` +
      `Supplier: ${input.supplierName}\n` +
      `Tax ID: ${inv.ocrBusinessNumber ?? '—'}\n` +
      `Invoice #: ${inv.ocrInvoiceNumber ?? '—'}\n` +
      `Date: ${inv.ocrInvoiceDate ?? '—'}\n` +
      `Total: ${formatIls(inv.ocrTotalAmount != null ? Number(inv.ocrTotalAmount) : null)}\n` +
      `Idempotency: ${input.idempotencyKey}\n\n` +
      jsonBlock;

    const fromEmail =
      process.env.PETWASH_FROM_EMAIL || 'accounting@petwash.co.il';

    const result = await sendGuardedEmail({
      service: 'sumit_dispatch',
      msg: {
        to,
        from: fromEmail,
        subject,
        text,
        html,
        attachments: attachment
          ? [
              {
                content: attachment.content,
                filename: attachment.filename,
                type: attachment.type,
                disposition: 'attachment',
              },
            ]
          : undefined,
      },
    });

    if (!result.ok) {
      return {
        sent: false,
        pseudoDocumentId: `email:${input.idempotencyKey}`,
        reason:
          result.reason === 'circuit_open'
            ? `EmailSpendGuard circuit open: ${result.detail}`
            : 'SendGrid send failed',
      };
    }

    return {
      sent: true,
      pseudoDocumentId: `email:${input.idempotencyKey}`,
    };
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export const sumitEmailDispatcher = new SumitEmailDispatcher();
