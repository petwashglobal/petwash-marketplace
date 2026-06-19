/**
 * Supplier Fraud Control — READ-ONLY detector (spec section 20).
 *
 *   GET /api/admin/supplier-fraud-flags   (admin/finance, level 8)
 *
 * Pure SELECT over supplier_invoices (+ suppliers). NEVER writes, NEVER
 * changes invoice status or money. Each check is wrapped in its own
 * try/catch so one failing query cannot blank the whole report — a
 * crashed check returns `{ error: true }` instead of a fabricated clean
 * result.
 *
 * Checks that are REAL (the column exists) vs SKIPPED (no column on the
 * model — we refuse to fabricate a flag):
 *
 *   REAL:
 *     - duplicate_invoice_number    supplier_invoices.ocr_invoice_number
 *     - duplicate_file_hash         supplier_invoices.file_hash
 *     - shared_bank_account         suppliers.bank_account_details (jsonb)
 *     - missing_osek_classification suppliers.osek_classification = 'unknown'
 *     - missing_shaam_allocation    supplier_invoices.shaam_required
 *                                   AND shaam_allocation_number IS NULL
 *
 *   SKIPPED (no such column on supplier_invoices):
 *     - amount_above_approved_po    — there is no per-invoice PO / approved-job
 *                                     amount field on supplier_invoices.
 *     - invoice_before_service_date — supplier_invoices has ocr_invoice_date
 *                                     only; there is no service_date to compare
 *                                     against.
 *
 * Gated by ff.supplier_invoice_control.enabled (404 when OFF) so the
 * feature is not leaked in prod before the CEO turns it on.
 */

import { Router, type Request, type Response, type NextFunction } from 'express';
import { and, eq, isNotNull, isNull, sql } from 'drizzle-orm';
import { db } from '../db';
import { supplierInvoices } from '../../shared/schema';
import { suppliers } from '../../shared/schema-corporate';
import { systemConfig } from '../services/SystemConfig';
import { validateFirebaseToken } from '../middleware/firebase-auth';
import { loadUserRole, checkAccessLevel } from '../middleware/rbac';
import { logger } from '../lib/logger';

const router = Router();

function flagGate(_req: Request, res: Response, next: NextFunction) {
  if (!systemConfig.get('ff.supplier_invoice_control.enabled')) {
    return res.status(404).json({ error: 'Not found' });
  }
  next();
}

const requireFinanceOrAdmin = [
  flagGate,
  validateFirebaseToken,
  loadUserRole,
  checkAccessLevel(8),
];

type FraudFlag = {
  /** stable machine key for the check */
  key: string;
  /** affected supplier-invoice ids */
  invoiceIds: number[];
  /** human reason — bilingual */
  reason: { he: string; en: string };
  /** detector severity hint (display only; never mutates anything) */
  severity: 'high' | 'medium';
  /** present + true when this check failed to run */
  error?: boolean;
};

/** Run one detector; never let it throw. A crashed check is reported as
 *  errored, NOT as a clean pass — honesty over a false green. */
async function safeCheck(
  name: string,
  fn: () => Promise<FraudFlag[]>,
): Promise<FraudFlag[]> {
  try {
    return await fn();
  } catch (err) {
    logger.error(`[SupplierFraudFlags] check "${name}" failed`, err);
    return [
      {
        key: name,
        invoiceIds: [],
        severity: 'medium',
        error: true,
        reason: {
          he: 'בדיקת הונאה זו נכשלה ולא הושלמה',
          en: 'This fraud check failed to run',
        },
      },
    ];
  }
}

// GET /api/admin/supplier-fraud-flags — pure-SELECT fraud detector
router.get('/supplier-fraud-flags', ...requireFinanceOrAdmin, async (_req: Request, res: Response) => {
  // 1) Duplicate invoice NUMBER — same ocr_invoice_number appearing on >1 row.
  const duplicateInvoiceNumber = safeCheck('duplicate_invoice_number', async () => {
    const rows = await db
      .select({
        invoiceNumber: supplierInvoices.ocrInvoiceNumber,
        ids: sql<number[]>`array_agg(${supplierInvoices.id})`,
        n: sql<number>`count(*)`,
      })
      .from(supplierInvoices)
      .where(and(isNotNull(supplierInvoices.ocrInvoiceNumber), sql`${supplierInvoices.ocrInvoiceNumber} <> ''`))
      .groupBy(supplierInvoices.ocrInvoiceNumber)
      .having(sql`count(*) > 1`);

    return rows.map((r) => ({
      key: 'duplicate_invoice_number',
      invoiceIds: (r.ids ?? []).map(Number),
      severity: 'high' as const,
      reason: {
        he: `מספר חשבונית כפול: "${r.invoiceNumber}" מופיע ב-${Number(r.n)} חשבוניות`,
        en: `Duplicate invoice number: "${r.invoiceNumber}" appears on ${Number(r.n)} invoices`,
      },
    }));
  });

  // 2) Duplicate file HASH — identical document uploaded more than once.
  const duplicateFileHash = safeCheck('duplicate_file_hash', async () => {
    const rows = await db
      .select({
        fileHash: supplierInvoices.fileHash,
        ids: sql<number[]>`array_agg(${supplierInvoices.id})`,
        n: sql<number>`count(*)`,
      })
      .from(supplierInvoices)
      .where(and(isNotNull(supplierInvoices.fileHash), sql`${supplierInvoices.fileHash} <> ''`))
      .groupBy(supplierInvoices.fileHash)
      .having(sql`count(*) > 1`);

    return rows.map((r) => ({
      key: 'duplicate_file_hash',
      invoiceIds: (r.ids ?? []).map(Number),
      severity: 'high' as const,
      reason: {
        he: `מסמך זהה (אותו hash) הועלה ב-${Number(r.n)} חשבוניות`,
        en: `Identical document (same file hash) uploaded across ${Number(r.n)} invoices`,
      },
    }));
  });

  // 3) Same bank account across DIFFERENT suppliers — classic supplier-impersonation
  //    / payment-redirect signal. suppliers.bank_account_details is jsonb; we
  //    normalise to a stable text key and group suppliers by it, then list the
  //    invoice ids of every supplier sharing a bank account with another.
  const sharedBankAccount = safeCheck('shared_bank_account', async () => {
    // Build a canonical bank key from the jsonb. Different shapes are tolerated
    // ({ bank, branch, account } | { iban } | flat strings) — we coalesce the
    // common keys, lowercased + trimmed. Empty/absent → skipped.
    const bankKey = sql<string>`lower(trim(coalesce(
      ${suppliers.bankAccountDetails} ->> 'iban',
      concat_ws('-',
        ${suppliers.bankAccountDetails} ->> 'bank',
        ${suppliers.bankAccountDetails} ->> 'branch',
        ${suppliers.bankAccountDetails} ->> 'account'
      ),
      ''
    )))`;

    const rows = await db
      .select({
        bankKey,
        supplierIds: sql<number[]>`array_agg(distinct ${suppliers.id})`,
        n: sql<number>`count(distinct ${suppliers.id})`,
      })
      .from(suppliers)
      .where(sql`${bankKey} <> ''`)
      .groupBy(bankKey)
      .having(sql`count(distinct ${suppliers.id}) > 1`);

    const out: FraudFlag[] = [];
    for (const r of rows) {
      const supplierIds = (r.supplierIds ?? []).map(Number).filter((x) => Number.isFinite(x));
      if (supplierIds.length < 2) continue;
      // Resolve the invoices belonging to those suppliers so the flag points at
      // concrete invoice ids (the page works in invoice space).
      const invs = await db
        .select({ id: supplierInvoices.id })
        .from(supplierInvoices)
        .where(sql`${supplierInvoices.supplierId} = any(${sql.raw(`array[${supplierIds.join(',')}]::int[]`)})`);
      out.push({
        key: 'shared_bank_account',
        invoiceIds: invs.map((i) => Number(i.id)),
        severity: 'high',
        reason: {
          he: `חשבון בנק זהה משותף ל-${Number(r.n)} ספקים שונים`,
          en: `Same bank account shared by ${Number(r.n)} different suppliers`,
        },
      });
    }
    return out;
  });

  // 4) Missing tax/business confirmation — supplier osek classification still
  //    'unknown' (admin never categorised the supplier). Flags every invoice
  //    tied to such a supplier.
  const missingOsekClassification = safeCheck('missing_osek_classification', async () => {
    const rows = await db
      .select({ id: supplierInvoices.id })
      .from(supplierInvoices)
      .innerJoin(suppliers, eq(supplierInvoices.supplierId, suppliers.id))
      .where(eq(suppliers.osekClassification, 'unknown'));

    if (rows.length === 0) return [];
    return [
      {
        key: 'missing_osek_classification',
        invoiceIds: rows.map((r) => Number(r.id)),
        severity: 'medium' as const,
        reason: {
          he: `סיווג מס/עוסק של הספק לא אומת (osek = unknown) ב-${rows.length} חשבוניות`,
          en: `Supplier tax/business classification not confirmed (osek = unknown) on ${rows.length} invoices`,
        },
      },
    ];
  });

  // 5) Missing SHAAM allocation number where required — shaam_required = true
  //    but allocation number is absent. Without it the VAT is not deductible.
  const missingShaamAllocation = safeCheck('missing_shaam_allocation', async () => {
    const rows = await db
      .select({ id: supplierInvoices.id })
      .from(supplierInvoices)
      .where(and(eq(supplierInvoices.shaamRequired, true), isNull(supplierInvoices.shaamAllocationNumber)));

    if (rows.length === 0) return [];
    return [
      {
        key: 'missing_shaam_allocation',
        invoiceIds: rows.map((r) => Number(r.id)),
        severity: 'high' as const,
        reason: {
          he: `נדרש מספר הקצאה (SHAAM) אך הוא חסר ב-${rows.length} חשבוניות`,
          en: `SHAAM allocation number required but missing on ${rows.length} invoices`,
        },
      },
    ];
  });

  try {
    const settled = await Promise.all([
      duplicateInvoiceNumber,
      duplicateFileHash,
      sharedBankAccount,
      missingOsekClassification,
      missingShaamAllocation,
    ]);

    const flags = settled.flat();
    const totalFlagged = new Set(flags.flatMap((f) => f.invoiceIds)).size;

    // Status buckets per spec — READ from existing supplier_invoices.status,
    // never changed here. Buckets are reported for the surface; the detector
    // does not depend on them.
    let buckets: Record<string, number> = {};
    try {
      const bucketRows = await db
        .select({ status: supplierInvoices.status, n: sql<number>`count(*)` })
        .from(supplierInvoices)
        .groupBy(supplierInvoices.status);
      buckets = Object.fromEntries(bucketRows.map((b) => [b.status, Number(b.n)]));
    } catch (err) {
      logger.warn('[SupplierFraudFlags] status-bucket count failed (continuing)', { err: (err as Error).message });
    }

    // Honest disclosure of which checks could not run (no fabricated column).
    const skipped = [
      {
        key: 'amount_above_approved_po',
        reason: {
          he: 'אין שדה סכום מאושר / הזמנת רכש ברמת החשבונית — לא ניתן לבדוק',
          en: 'No per-invoice approved/PO amount field exists — cannot check',
        },
      },
      {
        key: 'invoice_before_service_date',
        reason: {
          he: 'אין שדה תאריך שירות בחשבוניות הספק — לא ניתן לבדוק',
          en: 'No service-date field on supplier invoices — cannot check',
        },
      },
    ];

    return res.json({
      flags,
      flagCount: flags.length,
      totalFlaggedInvoices: totalFlagged,
      statusBuckets: buckets,
      skippedChecks: skipped,
    });
  } catch (err) {
    logger.error('[SupplierFraudFlags] report failed', err);
    return res.status(500).json({ error: 'Fraud-flags report failed' });
  }
});

export default router;
