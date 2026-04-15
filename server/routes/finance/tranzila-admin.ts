/**
 * PetWash™ — Tranzila Admin Routes
 *
 * Read-only admin endpoints for Tranzila processor monitoring.
 * All writes go through webhook handlers — these are for admin visibility only.
 *
 * Endpoints:
 *   GET  /api/admin/finance/tranzila/transactions           — processor transaction lookup
 *   GET  /api/admin/finance/tranzila/transactions/:id       — single transaction detail
 *   GET  /api/admin/finance/tranzila/payment-requests       — payment requests dashboard
 *   GET  /api/admin/finance/tranzila/chargebacks            — chargeback dashboard
 *   GET  /api/admin/finance/tranzila/settlements            — settlement batches
 *   POST /api/admin/finance/tranzila/settlement/import      — import a settlement batch
 *   GET  /api/admin/finance/tranzila/status                 — integration health / flag status
 *
 * Security:
 *   - All routes require admin authentication.
 *   - No mutation of pw_payments or pw_tax_documents — admin can only view.
 *   - Settlement import is append-only with an immutable import timestamp.
 *
 * State:
 *   All endpoints are live (return real data from tranzila_* tables).
 *   Until credentials are set and flags enabled, tables will be empty.
 */

import { Router } from 'express';
import { z } from 'zod';
import { db } from '../../db';
import {
  tranzilaTransactions,
  tranzilaPaymentRequests,
  tranzilaChargebacks,
  tranzilaSettlementBatches,
} from '../../../shared/schema-tranzila';
import { eq, desc, and, gte, lte, or, ilike, sql } from 'drizzle-orm';
import { requireAdmin } from '../../adminAuth';
import { logger } from '../../lib/logger';
import { nanoid } from 'nanoid';
import TranzilaChargebackService from '../../services/TranzilaChargebackService';
import TranzilaPaymentRequestService from '../../services/TranzilaPaymentRequestService';
import {
  TRANZILA_EGIFT_ENABLED,
  TRANZILA_WALLET_TOPUP_ENABLED,
  TRANZILA_MARKETPLACE_ENABLED,
  TRANZILA_PAYMENT_REQUESTS_ENABLED,
  TRANZILA_DOCUMENT_INGESTION_ENABLED,
  TRANZILA_CHARGEBACK_ALERTS_ENABLED,
  TRANZILA_SETTLEMENT_RECONCILIATION_ENABLED,
} from '../../lib/payment-flags';

const router = Router();

// All routes require admin auth
router.use(requireAdmin);

// ── GET /transactions ────────────────────────────────────────────────────────

router.get('/transactions', async (req, res) => {
  try {
    const pageRaw = parseInt(String(req.query.page ?? '1'), 10);
    const limitRaw = parseInt(String(req.query.limit ?? '50'), 10);
    const page = isNaN(pageRaw) || pageRaw < 1 ? 1 : pageRaw;
    const limit = isNaN(limitRaw) || limitRaw < 1 || limitRaw > 200 ? 50 : limitRaw;
    const offset = (page - 1) * limit;

    const status = req.query.status as string | undefined;
    const productType = req.query.product_type as string | undefined;
    const from = req.query.from as string | undefined;
    const to = req.query.to as string | undefined;

    const conditions = [];
    if (status) conditions.push(eq(tranzilaTransactions.status, status));
    if (productType) conditions.push(eq(tranzilaTransactions.productType, productType));
    if (from) conditions.push(gte(tranzilaTransactions.createdAt, new Date(from)));
    if (to) conditions.push(lte(tranzilaTransactions.createdAt, new Date(to)));

    const rows = await db
      .select()
      .from(tranzilaTransactions)
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(tranzilaTransactions.createdAt))
      .limit(limit)
      .offset(offset);

    const countResult = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(tranzilaTransactions)
      .where(conditions.length ? and(...conditions) : undefined);

    res.json({
      data: rows,
      pagination: {
        page,
        limit,
        total: countResult[0]?.count ?? 0,
        pages: Math.ceil((countResult[0]?.count ?? 0) / limit),
      },
    });
  } catch (err: any) {
    logger.error('[TranzilaAdmin] GET /transactions error', { error: err?.message });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── GET /transactions/:id ────────────────────────────────────────────────────

router.get('/transactions/:id', async (req, res) => {
  try {
    const { id } = req.params;
    // id may be processorTransactionId or idempotencyKey
    const rows = await db
      .select()
      .from(tranzilaTransactions)
      .where(
        or(
          eq(tranzilaTransactions.processorTransactionId, id),
          eq(tranzilaTransactions.idempotencyKey, id),
        ),
      )
      .limit(1);

    if (rows.length === 0) {
      res.status(404).json({ error: 'Transaction not found' });
      return;
    }
    res.json({ data: rows[0] });
  } catch (err: any) {
    logger.error('[TranzilaAdmin] GET /transactions/:id error', { error: err?.message });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── GET /payment-requests ────────────────────────────────────────────────────

router.get('/payment-requests', async (req, res) => {
  try {
    const pageRaw = parseInt(String(req.query.page ?? '1'), 10);
    const limitRaw = parseInt(String(req.query.limit ?? '50'), 10);
    const page = isNaN(pageRaw) || pageRaw < 1 ? 1 : pageRaw;
    const limit = isNaN(limitRaw) || limitRaw < 1 || limitRaw > 200 ? 50 : limitRaw;
    const offset = (page - 1) * limit;

    const status = req.query.status as string | undefined;
    const conditions = [];
    if (status) conditions.push(eq(tranzilaPaymentRequests.status, status));

    const rows = await db
      .select()
      .from(tranzilaPaymentRequests)
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(tranzilaPaymentRequests.createdAt))
      .limit(limit)
      .offset(offset);

    const countResult = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(tranzilaPaymentRequests)
      .where(conditions.length ? and(...conditions) : undefined);

    res.json({
      data: rows,
      pagination: {
        page,
        limit,
        total: countResult[0]?.count ?? 0,
        pages: Math.ceil((countResult[0]?.count ?? 0) / limit),
      },
    });
  } catch (err: any) {
    logger.error('[TranzilaAdmin] GET /payment-requests error', { error: err?.message });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── GET /chargebacks ─────────────────────────────────────────────────────────

router.get('/chargebacks', async (req, res) => {
  try {
    const pageRaw = parseInt(String(req.query.page ?? '1'), 10);
    const limitRaw = parseInt(String(req.query.limit ?? '50'), 10);
    const page = isNaN(pageRaw) || pageRaw < 1 ? 1 : pageRaw;
    const limit = isNaN(limitRaw) || limitRaw < 1 || limitRaw > 200 ? 50 : limitRaw;
    const offset = (page - 1) * limit;

    const status = req.query.status as string | undefined;
    const conditions = [];
    if (status) conditions.push(eq(tranzilaChargebacks.status, status));

    const rows = await db
      .select()
      .from(tranzilaChargebacks)
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(tranzilaChargebacks.openedAt))
      .limit(limit)
      .offset(offset);

    const openCount = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(tranzilaChargebacks)
      .where(eq(tranzilaChargebacks.status, 'opened'));

    const evidenceNeededCount = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(tranzilaChargebacks)
      .where(eq(tranzilaChargebacks.status, 'evidence_needed'));

    res.json({
      data: rows,
      summary: {
        openCount: openCount[0]?.count ?? 0,
        evidenceNeededCount: evidenceNeededCount[0]?.count ?? 0,
      },
      pagination: {
        page,
        limit,
        total: rows.length,
      },
    });
  } catch (err: any) {
    logger.error('[TranzilaAdmin] GET /chargebacks error', { error: err?.message });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── GET /settlements ─────────────────────────────────────────────────────────

router.get('/settlements', async (req, res) => {
  try {
    const rows = await db
      .select()
      .from(tranzilaSettlementBatches)
      .orderBy(desc(tranzilaSettlementBatches.importedAt))
      .limit(100);

    res.json({ data: rows });
  } catch (err: any) {
    logger.error('[TranzilaAdmin] GET /settlements error', { error: err?.message });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── POST /settlement/import ──────────────────────────────────────────────────

const settlementImportSchema = z.object({
  periodFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  periodTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  processorBatchReference: z.string().optional(),
  totalGrossCents: z.number().int().nonnegative(),
  totalProcessorFeesCents: z.number().int().nonnegative(),
  totalNetCents: z.number().int().nonnegative(),
  transactionCount: z.number().int().nonnegative(),
  refundCount: z.number().int().nonnegative().default(0),
  reportPayload: z.record(z.unknown()).optional(),
  reportHash: z.string().optional(),
});

router.post('/settlement/import', async (req, res) => {
  try {
    const parsed = settlementImportSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid request', details: parsed.error.flatten() });
      return;
    }

    const data = parsed.data;
    const settlementBatchId = `TRZSETT-${data.periodFrom.replace(/-/g, '')}-${nanoid(6).toUpperCase()}`;
    const adminUid = (req as any).admin?.uid ?? 'unknown';

    const [inserted] = await db
      .insert(tranzilaSettlementBatches)
      .values({
        settlementBatchId,
        processorBatchReference: data.processorBatchReference ?? null,
        periodFrom: data.periodFrom,
        periodTo: data.periodTo,
        totalGrossCents: data.totalGrossCents,
        totalProcessorFeesCents: data.totalProcessorFeesCents,
        totalNetCents: data.totalNetCents,
        transactionCount: data.transactionCount,
        refundCount: data.refundCount,
        status: 'imported',
        reportPayload: (data.reportPayload ?? {}) as any,
        reportHash: data.reportHash ?? null,
        importedByAdminUid: adminUid,
      })
      .returning({ settlementBatchId: tranzilaSettlementBatches.settlementBatchId });

    logger.info('[TranzilaAdmin] Settlement batch imported', {
      settlementBatchId: inserted.settlementBatchId,
      importedByAdminUid: adminUid,
    });

    res.status(201).json({
      status: 'imported',
      settlementBatchId: inserted.settlementBatchId,
      reconciliationNote: TRANZILA_SETTLEMENT_RECONCILIATION_ENABLED
        ? 'Reconciliation will run automatically'
        : 'TRANZILA_SETTLEMENT_RECONCILIATION_ENABLED=false — reconciliation is manual',
    });
  } catch (err: any) {
    logger.error('[TranzilaAdmin] POST /settlement/import error', { error: err?.message });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── POST /chargebacks/:caseId/evidence-submitted ────────────────────────────
// Record that admin has submitted evidence in Tranzila console for a chargeback.

router.post('/chargebacks/:caseId/evidence-submitted', async (req, res) => {
  const { caseId } = req.params;
  const schema = z.object({
    notes: z.string().max(2000).optional(),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid request', details: parsed.error.format() });
    return;
  }

  const adminUid = (req as any).adminUid ?? 'unknown';
  const result = await TranzilaChargebackService.recordEvidenceSubmitted(
    caseId,
    adminUid,
    parsed.data.notes,
  );

  if (result.outcome === 'not_found') {
    res.status(404).json({ error: 'Chargeback case not found', chargebackCaseId: caseId });
    return;
  }
  if (result.outcome === 'already_resolved') {
    res.status(409).json({ error: 'Case already in terminal state', chargebackCaseId: caseId });
    return;
  }
  if (result.outcome === 'error') {
    res.status(500).json({ error: result.error ?? 'Internal error' });
    return;
  }

  res.json({ status: 'recorded', chargebackCaseId: caseId });
});

// ── POST /payment-requests/:id/cancel ───────────────────────────────────────
// Cancel an outstanding payment request.

router.post('/payment-requests/:id/cancel', async (req, res) => {
  const { id } = req.params;
  const result = await TranzilaPaymentRequestService.cancel(id);

  if (result.outcome === 'not_found') {
    res.status(404).json({ error: 'Payment request not found', paymentRequestId: id });
    return;
  }
  if (result.outcome === 'already_terminal') {
    res.status(409).json({ error: 'Payment request already in terminal state', paymentRequestId: id });
    return;
  }
  if (result.outcome === 'disabled') {
    res.status(503).json({ error: 'TRANZILA_PAYMENT_REQUESTS_ENABLED is false' });
    return;
  }
  if (result.outcome === 'error') {
    res.status(500).json({ error: result.error ?? 'Internal error' });
    return;
  }

  res.json({ status: 'cancelled', paymentRequestId: id });
});

// ── GET /status ──────────────────────────────────────────────────────────────

router.get('/status', async (_req, res) => {
  const hasTerminalName  = !!process.env.TRANZILA_TERMINAL_NAME;
  const hasTerminalPass  = !!process.env.TRANZILA_TERMINAL_PASSWORD;
  const hasWebhookSecret = !!process.env.TRANZILA_WEBHOOK_SECRET;
  const hasAllowedIPs    = !!(process.env.TRANZILA_ALLOWED_IPS || '').trim();
  const bypassActive     = process.env.TRANZILA_WEBHOOK_BYPASS_SIGNATURE === 'true';
  const env              = (process.env.NODE_ENV || 'development').toLowerCase();
  const isRestrictedEnv  = env === 'production' || env === 'staging';

  // Production-safe = all required config present AND bypass not active
  const productionSafe =
    hasTerminalName &&
    hasTerminalPass &&
    hasWebhookSecret &&
    hasAllowedIPs &&
    !bypassActive;

  res.json({
    integration: 'tranzila',
    // ── Webhook readiness checklist ──────────────────────────────────────────
    webhookReadiness: {
      webhookSecretSet:  hasWebhookSecret  ? 'YES' : 'NO — set TRANZILA_WEBHOOK_SECRET',
      allowedIPsSet:     hasAllowedIPs     ? 'YES' : 'NO — set TRANZILA_ALLOWED_IPS',
      bypassFlagActive:  bypassActive      ? 'YES — INSECURE, disable in non-dev' : 'no',
      productionSafe:    productionSafe    ? 'YES' : 'NO — see itemsBlocking',
    },
    credentials: {
      TRANZILA_TERMINAL_NAME:     hasTerminalName  ? 'set' : 'MISSING',
      TRANZILA_TERMINAL_PASSWORD: hasTerminalPass  ? 'set' : 'MISSING',
      TRANZILA_WEBHOOK_SECRET:    hasWebhookSecret ? 'set' : 'MISSING',
    },
    featureFlags: {
      TRANZILA_EGIFT_ENABLED,
      TRANZILA_WALLET_TOPUP_ENABLED,
      TRANZILA_MARKETPLACE_ENABLED,
      TRANZILA_PAYMENT_REQUESTS_ENABLED,
      TRANZILA_DOCUMENT_INGESTION_ENABLED,
      TRANZILA_CHARGEBACK_ALERTS_ENABLED,
      TRANZILA_SETTLEMENT_RECONCILIATION_ENABLED,
    },
    productionSafe,
    itemsBlocking: [
      !hasTerminalName  && 'TRANZILA_TERMINAL_NAME not set',
      !hasTerminalPass  && 'TRANZILA_TERMINAL_PASSWORD not set',
      !hasWebhookSecret && 'TRANZILA_WEBHOOK_SECRET not set',
      !hasAllowedIPs    && 'TRANZILA_ALLOWED_IPS not set — required in production/staging',
      (bypassActive && isRestrictedEnv) && 'TRANZILA_WEBHOOK_BYPASS_SIGNATURE=true in ' + env + ' — FATAL on boot',
      (bypassActive && !isRestrictedEnv) && 'TRANZILA_WEBHOOK_BYPASS_SIGNATURE=true — remove before deploying to staging/production',
    ].filter(Boolean),
    itemsWaitingOnCpaLegal: [
      !TRANZILA_DOCUMENT_INGESTION_ENABLED &&
        'CPA written confirmation on VAT document timing required before TRANZILA_DOCUMENT_INGESTION_ENABLED=true',
    ].filter(Boolean),
    webhookEndpoint: 'POST /api/payments/tranzila/webhook',
    webhookEventEndpoints: {
      payment_success:         'POST /api/webhooks/tranzila/payment-success',
      payment_failed:          'POST /api/webhooks/tranzila/payment-failed',
      refund_success:          'POST /api/webhooks/tranzila/refund-success',
      refund_failed:           'POST /api/webhooks/tranzila/refund-failed',
      payment_request_updated: 'POST /api/webhooks/tranzila/payment-request-updated',
      document_issued:         'POST /api/webhooks/tranzila/document-issued',
      chargeback_updated:      'POST /api/webhooks/tranzila/chargeback-updated',
      settlement_updated:      'POST /api/webhooks/tranzila/settlement-updated',
    },
    adminDashboard: '/api/admin/finance/tranzila',
  });
});

export default router;
