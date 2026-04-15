/**
 * PetWash™ — Tranzila Per-Event Webhook Routes
 *
 * Mounts at: /api/webhooks/tranzila
 *
 * Provides individual named endpoints for each Tranzila webhook event type.
 * These are aliases to the canonical single-endpoint handler at
 * /api/payments/tranzila/webhook.  Both paths are valid; Tranzila can be
 * configured to use either style.
 *
 * Using named per-event routes allows:
 *   - Fine-grained monitoring and alerting per event class
 *   - Easier per-event rate limiting in the future
 *   - Clearer audit logs with the event type visible in the path
 *
 * All routes share the same security pipeline:
 *   - Raw body capture (for HMAC verification)
 *   - HMAC-SHA256 signature verification (fail-closed)
 *   - IP allowlist check
 *   - Redis-backed idempotency (24h TTL)
 *   - Dispatched to TranzilaWebhookService with event type injected
 *
 * Event → endpoint mapping:
 *   payment_success          → POST /api/webhooks/tranzila/payment-success
 *   payment_failed           → POST /api/webhooks/tranzila/payment-failed
 *   refund_success           → POST /api/webhooks/tranzila/refund-success
 *   refund_failed            → POST /api/webhooks/tranzila/refund-failed
 *   payment_request_updated  → POST /api/webhooks/tranzila/payment-request-updated
 *   document_issued          → POST /api/webhooks/tranzila/document-issued
 *   chargeback_updated       → POST /api/webhooks/tranzila/chargeback-updated
 *   settlement_updated       → POST /api/webhooks/tranzila/settlement-updated
 *
 * Registered in routes.ts:
 *   app.use('/api/webhooks/tranzila', tranzilaEventWebhookRoutes);
 *
 * TODO (before production):
 *   1. Register each endpoint URL with Tranzila console per event type.
 *   2. Set TRANZILA_WEBHOOK_SECRET in secret manager.
 *   3. Set TRANZILA_ALLOWED_IPS to Tranzila server IP ranges.
 */

import express, { Request, Response } from 'express';
import crypto from 'crypto';
import { logger } from '../lib/logger';
import { redis } from '../services/redis';
import TranzilaWebhookService, { TranzilaWebhookPayload, TranzilaWebhookEventType } from '../services/TranzilaWebhookService';

const router = express.Router();

// ── Constants ─────────────────────────────────────────────────────────────────

const WEBHOOK_DEDUP_TTL_SECONDS = 86400; // 24 hours
const TRANZILA_ALLOWED_IPS_RAW  = process.env.TRANZILA_ALLOWED_IPS ?? '';

// ── Event path → canonical event type mapping ─────────────────────────────────

const PATH_TO_EVENT: Record<string, TranzilaWebhookEventType> = {
  'payment-success':          'payment_success',
  'payment-failed':           'payment_failed',
  'refund-success':           'refund_success',
  'refund-failed':            'refund_failed',
  'payment-request-updated':  'payment_request_paid',   // Tranzila may also post as paid or cancelled
  'document-issued':          'document_issued',
  'chargeback-updated':       'chargeback_updated',
  'settlement-updated':       'settlement_imported',
};

// ── Shared security helpers ───────────────────────────────────────────────────

function isIpAllowed(ip: string): boolean {
  if (!TRANZILA_ALLOWED_IPS_RAW) {
    if (process.env.NODE_ENV !== 'production') {
      logger.warn('[TranzilaEventWebhook] TRANZILA_ALLOWED_IPS not set — allowing all IPs in non-production');
      return true;
    }
    logger.error('[TranzilaEventWebhook] TRANZILA_ALLOWED_IPS not set in production — blocking');
    return false;
  }
  const allowed = TRANZILA_ALLOWED_IPS_RAW.split(',').map((s) => s.trim()).filter(Boolean);
  return allowed.includes(ip);
}

async function isDuplicate(dedupKey: string): Promise<boolean> {
  if (!redis) {
    logger.warn('[TranzilaEventWebhook] Redis unavailable — dedup bypassed');
    return false;
  }
  try {
    const result = await (redis as any).set(dedupKey, '1', 'EX', WEBHOOK_DEDUP_TTL_SECONDS, 'NX');
    return result === null;
  } catch (err: any) {
    logger.warn('[TranzilaEventWebhook] Redis dedup error — bypassing', { error: err?.message });
    return false;
  }
}

function buildDedupKey(eventType: TranzilaWebhookEventType, payload: TranzilaWebhookPayload): string {
  const parts: string[] = ['trz-ev', eventType];
  if (payload.tran_num)                    parts.push(payload.tran_num);
  if (payload.payment_request_id)          parts.push(payload.payment_request_id);
  if (payload.chargeback_case_id)          parts.push(payload.chargeback_case_id);
  if (payload.settlement_batch_reference)  parts.push(payload.settlement_batch_reference);
  if (payload.doc_number)                  parts.push(payload.doc_number);
  if (payload.event_at)                    parts.push(payload.event_at);
  return parts.join(':');
}

// ── Handler factory ───────────────────────────────────────────────────────────

/**
 * Builds a route handler for a specific Tranzila webhook event type.
 *
 * The handler:
 *   1. Extracts and checks the caller IP.
 *   2. Reads the raw body buffer and verifies the HMAC signature.
 *   3. Parses JSON, injects the event type from the path if missing.
 *   4. Deduplicates via Redis.
 *   5. Delegates to TranzilaWebhookService.dispatch().
 *   6. Returns 200 to prevent Tranzila from retrying on application errors.
 */
function makeHandler(eventType: TranzilaWebhookEventType) {
  return async (req: Request & { rawBody?: Buffer }, res: Response): Promise<void> => {
    const clientIp =
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ??
      req.socket.remoteAddress ??
      'unknown';

    // IP check
    if (!isIpAllowed(clientIp)) {
      logger.warn('[TranzilaEventWebhook] Non-allowed IP — rejected', { eventType, clientIp });
      res.status(403).json({ error: 'Forbidden' });
      return;
    }

    // Signature check
    const signatureHeader = req.headers['x-tranzila-signature'] as string | undefined;
    const rawBody: Buffer = Buffer.isBuffer(req.body) ? req.body : Buffer.from(JSON.stringify(req.body));
    const verified = TranzilaWebhookService.verifySignature(rawBody, signatureHeader);
    if (!verified) {
      logger.warn('[TranzilaEventWebhook] Signature verification failed — rejected', { eventType, clientIp });
      res.status(401).json({ error: 'Invalid signature' });
      return;
    }

    // Parse
    let payload: TranzilaWebhookPayload;
    try {
      payload = JSON.parse(rawBody.toString('utf8')) as TranzilaWebhookPayload;
    } catch (err: any) {
      logger.error('[TranzilaEventWebhook] Invalid JSON body', { eventType, error: err?.message });
      res.status(400).json({ error: 'Invalid JSON' });
      return;
    }

    // Inject event type from path if not already set in body
    if (!payload.event) {
      payload.event = eventType;
    }

    // Dedup
    const dedupKey = buildDedupKey(eventType, payload);
    if (await isDuplicate(dedupKey)) {
      logger.info('[TranzilaEventWebhook] Duplicate webhook — ignoring', { eventType, dedupKey });
      res.status(200).json({ status: 'duplicate' });
      return;
    }

    // Dispatch
    logger.info('[TranzilaEventWebhook] Dispatching event', {
      eventType,
      tran_num: payload.tran_num,
      payment_request_id: payload.payment_request_id,
      chargeback_case_id: payload.chargeback_case_id,
    });

    try {
      const result = await TranzilaWebhookService.dispatch(payload);
      res.status(200).json({ status: 'ok', outcome: result.outcome });
    } catch (err: any) {
      // Always 200 — prevent Tranzila from flooding retries on unhandled errors
      logger.error('[TranzilaEventWebhook] Dispatch threw unexpectedly', {
        eventType,
        error: err?.message,
        stack: err?.stack,
      });
      res.status(200).json({ status: 'error', message: 'Handler error — event received' });
    }
  };
}

// ── Raw body capture ──────────────────────────────────────────────────────────

const captureRawBody = express.raw({
  type: 'application/json',
  limit: '1mb',
});

// ── Mount per-event routes ────────────────────────────────────────────────────

router.post('/payment-success',         captureRawBody, makeHandler('payment_success'));
router.post('/payment-failed',          captureRawBody, makeHandler('payment_failed'));
router.post('/refund-success',          captureRawBody, makeHandler('refund_success'));
router.post('/refund-failed',           captureRawBody, makeHandler('refund_failed'));
router.post('/payment-request-updated', captureRawBody, makeHandler('payment_request_paid'));
router.post('/document-issued',         captureRawBody, makeHandler('document_issued'));
router.post('/chargeback-updated',      captureRawBody, makeHandler('chargeback_updated'));
router.post('/settlement-updated',      captureRawBody, makeHandler('settlement_imported'));

export default router;
