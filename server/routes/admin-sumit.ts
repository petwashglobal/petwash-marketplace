/**
 * Admin SUMIT — control + preflight routes.
 *
 * Mission-4. Read-only endpoints the admin UI uses to surface
 * activation readiness without ever firing a real send.
 *
 *   GET /api/admin/sumit/health
 *     Returns current mode, both feature-flag values, env-presence
 *     booleans (NEVER the secret values), and a count of invoices
 *     in each sumit_status bucket.
 *
 *   GET /api/admin/sumit/preflight/:invoiceId
 *     Returns a full PreflightResult for one invoice + supplier.
 *     The UI renders this as a checklist.
 *
 * Both routes are flag-gated by ff.supplier_invoice_control.enabled
 * (so the existence of SUMIT activation is not leaked when the
 * feature is off in prod). Admin auth required.
 */

import { Router, type Request, type Response, type NextFunction } from 'express';
import { eq, sql } from 'drizzle-orm';
import { db } from '../db';
import { supplierInvoices } from '../../shared/schema';
import { suppliers } from '../../shared/schema-corporate';
import { systemConfig } from '../services/SystemConfig';
import { validateFirebaseToken } from '../middleware/firebase-auth';
import { loadUserRole, checkAccessLevel, isSuperAdminVerified } from '../middleware/rbac';
import { runPreflight, type SumitMode } from '../services/SumitPreflightCheck';
import { logger } from '../lib/logger';

const router = Router();

function flagGate(_req: Request, res: Response, next: NextFunction) {
  if (!systemConfig.get('ff.supplier_invoice_control.enabled')) {
    return res.status(404).json({ error: 'Not found' });
  }
  next();
}

/**
 * Tightened gate for the SUMIT control surface. The control panel exposes
 * env-presence booleans (which secrets are/aren't set), the activation
 * mode, the feature-flag state, and a per-bucket invoice count. None of
 * this is operational data for a regular finance admin — it's the
 * "wiring inspector" view. Limit to super-admin so a compromised
 * regular-admin account cannot enumerate which secrets are configured.
 *
 * Pattern: validateFirebaseToken → loadUserRole → checkAccessLevel(8) →
 *          require-super-admin.
 *
 * On non-super-admin → 404 (not 403) so we don't reveal that the
 * endpoint exists to lower-privilege admins.
 */
function requireSuperAdminGate(req: Request, res: Response, next: NextFunction) {
  if (!isSuperAdminVerified(req)) {
    return res.status(404).json({ error: 'Not found' });
  }
  next();
}

const requireSuperAdmin = [
  flagGate,
  validateFirebaseToken,
  loadUserRole,
  checkAccessLevel(8),
  requireSuperAdminGate,
];

function envFlags() {
  return {
    sumitApiKey: Boolean(process.env.SUMIT_API_KEY),
    sumitCompanyId: Boolean(process.env.SUMIT_COMPANY_ID),
    sumitWebhookSecret: Boolean(process.env.SUMIT_WEBHOOK_SECRET),
    accountantEmail: Boolean(process.env.ACCOUNTANT_EMAIL),
    sendgridApiKey: Boolean(process.env.SENDGRID_API_KEY),
  };
}

router.get('/health', ...requireSuperAdmin, async (_req: Request, res: Response) => {
  try {
    const mode = systemConfig.get('sumit.mode') as SumitMode;
    const parentFlag = systemConfig.get('ff.supplier_invoice_control.enabled');
    const sendFlag = systemConfig.get('ff.supplier_invoice_control.sumit_send.enabled');

    // Aggregate sumit_status counts. Cheap on tables this small; if it
    // grows, swap for an indexed materialised count.
    const bucketRows = await db
      .select({
        bucket: sql<string>`coalesce(${supplierInvoices.sumitStatus}, 'not_sent')`,
        count: sql<number>`count(*)::int`,
      })
      .from(supplierInvoices)
      .groupBy(supplierInvoices.sumitStatus);

    const counts: Record<string, number> = {};
    for (const r of bucketRows) {
      counts[r.bucket] = Number(r.count);
    }

    return res.json({
      mode,
      flags: { parent: parentFlag, send: sendFlag },
      env: envFlags(),
      counts,
      // Snapshot facts — never the secret values themselves.
      sumitApiBaseUrl: process.env.SUMIT_API_BASE_URL || 'https://api.sumit.co.il',
      accountantEmailDomain: process.env.ACCOUNTANT_EMAIL
        ? `***@${process.env.ACCOUNTANT_EMAIL.split('@')[1] ?? '***'}`
        : null,
    });
  } catch (err) {
    logger.error('[AdminSumit] health failed', err);
    return res.status(500).json({ error: 'Health check failed' });
  }
});

router.get(
  '/preflight/:invoiceId',
  ...requireSuperAdmin,
  async (req: Request, res: Response) => {
    const invoiceId = Number(req.params.invoiceId);
    if (!Number.isInteger(invoiceId) || invoiceId <= 0) {
      return res.status(400).json({ error: 'Invalid invoiceId' });
    }

    try {
      const [invoice] = await db
        .select()
        .from(supplierInvoices)
        .where(eq(supplierInvoices.id, invoiceId))
        .limit(1);

      let supplier: typeof suppliers.$inferSelect | null = null;
      if (invoice?.supplierId != null) {
        const [row] = await db
          .select()
          .from(suppliers)
          .where(eq(suppliers.id, invoice.supplierId))
          .limit(1);
        supplier = row ?? null;
      }

      const mode = systemConfig.get('sumit.mode') as SumitMode;
      const result = runPreflight({
        parentFlag: systemConfig.get('ff.supplier_invoice_control.enabled'),
        sendFlag: systemConfig.get('ff.supplier_invoice_control.sumit_send.enabled'),
        mode,
        invoice: invoice
          ? {
              id: invoice.id,
              status: invoice.status,
              riskLevel: invoice.riskLevel as 'green' | 'yellow' | 'red',
              sumitStatus: invoice.sumitStatus as
                | 'pending'
                | 'sent'
                | 'confirmed'
                | 'failed'
                | null,
              sumitDocumentId: invoice.sumitDocumentId,
            }
          : null,
        supplier: supplier
          ? {
              id: supplier.id,
              isApproved: supplier.isApproved,
              osekClassification: supplier.osekClassification as
                | 'unknown'
                | 'patur'
                | 'murshe'
                | 'chevra',
            }
          : null,
        env: envFlags(),
      });

      return res.json(result);
    } catch (err) {
      logger.error('[AdminSumit] preflight failed', err);
      return res.status(500).json({ error: 'Preflight failed' });
    }
  },
);

/**
 * GET /api/admin/sumit/sync-dryrun
 *
 * Mission-5+ skeleton — "if SUMIT were enabled today, here's what would
 * sync." Read-only; never fires a real SUMIT call. Useful for verifying
 * the data is ready (providers classified, secrets bound, jobs queue
 * healthy) BEFORE flipping sumit.mode='api'.
 *
 * Surfaces:
 *   - sumit.mode + SumitClient.isWired() — the gates
 *   - Supplier osek_type distribution — how many providers are still
 *     `unknown`; those would be skipped by SumitSyncService until
 *     classified
 *   - SUMIT_* job queue depth (PENDING / PROCESSING / DONE / FAILED)
 *   - Latest 5 SUMIT audit events from the immutable ledger
 */
router.get('/sync-dryrun', ...requireSuperAdmin, async (_req: Request, res: Response) => {
  try {
    const { sumitClient } = await import('../services/SumitClient');
    const mode = systemConfig.get('sumit.mode') as SumitMode;
    const health = sumitClient.health();

    // Supplier osek_type breakdown.
    const osekRows = await db.execute<{ bucket: string; count: number }>(sql`
      SELECT coalesce(osek_type, 'unknown') AS bucket, count(*)::int AS count
      FROM suppliers
      GROUP BY 1
      ORDER BY 1
    `);
    const osekBuckets: Record<string, number> = {};
    for (const r of osekRows.rows ?? []) osekBuckets[r.bucket] = Number(r.count);

    // SUMIT_* job queue depth.
    const queueRows = await db.execute<{ status: string; count: number }>(sql`
      SELECT status, count(*)::int AS count
      FROM pw_async_jobs
      WHERE job_type IN ('SUMIT_CUSTOMER_SYNC', 'SUMIT_DOCUMENT_CREATE', 'SUMIT_DOCUMENT_CANCEL')
      GROUP BY status
      ORDER BY status
    `);
    const queue: Record<string, number> = {};
    for (const r of queueRows.rows ?? []) queue[r.status] = Number(r.count);

    // Last 5 sumit-prefixed audit events for a quick glance.
    const auditRows = await db.execute<{
      created_at: string; event_type: string; metadata: string | null;
    }>(sql`
      SELECT created_at, event_type, metadata
      FROM audit_ledger
      WHERE event_type LIKE 'sumit.%'
      ORDER BY created_at DESC
      LIMIT 5
    `);

    return res.json({
      mode,
      wired: health.wired,
      wiredReason: health.reason,
      baseUrl: health.baseUrl,
      env: envFlags(),
      osekBuckets,
      queue,
      recentEvents: (auditRows.rows ?? []).map((r) => ({
        createdAt: r.created_at,
        eventType: r.event_type,
        metadata: (() => { try { return JSON.parse(r.metadata ?? 'null'); } catch { return r.metadata; } })(),
      })),
    });
  } catch (err: any) {
    logger.error('[AdminSumit] sync-dryrun failed', err);
    return res.status(500).json({ error: 'Sync dry-run failed', message: err.message });
  }
});

export default router;
