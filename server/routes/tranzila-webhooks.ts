/**
 * PetWash™ — Tranzila Webhook Routes
 *
 * Single entry point: POST /api/payments/tranzila/webhook
 *
 * Security:
 *   - Raw body capture (must run before express.json)
 *   - HMAC-SHA256 signature verification (fail-closed when secret missing)
 *   - IP allowlist (configurable via TRANZILA_ALLOWED_IPS env var; required in production+staging)
 *   - Redis-backed idempotency deduplication (TTL 24h)
 *   - Rate limiter applied at mount point in routes.ts
 *
 * All 10 webhook event types are dispatched via TranzilaWebhookService.
 * Handlers are idempotent — duplicate delivery is safe.
 *
 * TODO (before enabling any Tranzila flag in production):
 *   1. Set TRANZILA_WEBHOOK_SECRET from Tranzila console.
 *   2. Set TRANZILA_ALLOWED_IPS to real Tranzila server IP ranges.
 *   3. Register this webhook URL with Tranzila: POST /api/payments/tranzila/webhook
 */

import express, { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { logger } from '../lib/logger';
import { redis } from '../services/redis';
import TranzilaWebhookService, { TranzilaWebhookPayload } from '../services/TranzilaWebhookService';

const router = express.Router();

// ── Constants ────────────────────────────────────────────────────────────────

const WEBHOOK_DEDUP_TTL_SECONDS = 86400; // 24 hours
const TRANZILA_ALLOWED_IPS_RAW = process.env.TRANZILA_ALLOWED_IPS ?? '';

// ── Raw body capture ─────────────────────────────────────────────────────────

/**
 * Capture raw request body bytes before express.json() consumes them.
 * HMAC signature verification requires the exact raw bytes Tranzila signed.
 */
const captureRawBody = express.raw({
  type: 'application/json',
  limit: '1mb',
});

// ── IP Allowlist ─────────────────────────────────────────────────────────────

function isIpAllowed(ip: string): boolean {
  if (!TRANZILA_ALLOWED_IPS_RAW) {
    const env = (process.env.NODE_ENV || '').toLowerCase();
    const isRestrictedEnv = env === 'production' || env === 'staging';
    if (isRestrictedEnv) {
      logger.error('[TranzilaWebhook] TRANZILA_ALLOWED_IPS not set in ' + env + ' — blocking webhook', {
        audit: 'webhook_rejected',
        reason: 'ip_not_allowed',
        clientIp: ip,
      });
      return false;
    }
    logger.warn('[TranzilaWebhook] TRANZILA_ALLOWED_IPS not set — allowing all IPs in ' + (env || 'development'));
    return true;
  }

  const allowed = TRANZILA_ALLOWED_IPS_RAW.split(',').map((s) => s.trim()).filter(Boolean);
  return allowed.includes(ip);
}

// ── Deduplication ─────────────────────────────────────────────────────────────

/**
 * Redis-based deduplication using a compound key built from event type + IDs.
 * Falls back to accepting (non-deduplicating) when Redis is unavailable.
 */
async function isDuplicate(dedupKey: string): Promise<boolean> {
  if (!redis) {
    logger.warn('[TranzilaWebhook] Redis unavailable — dedup bypassed');
    return false;
  }
  try {
    const result = await (redis as any).set(dedupKey, '1', 'EX', WEBHOOK_DEDUP_TTL_SECONDS, 'NX');
    // NX: only set if not exists. null = already existed → duplicate
    return result === null;
  } catch (err: any) {
    logger.warn('[TranzilaWebhook] Redis dedup error — bypassing', { error: err?.message });
    return false;
  }
}

function buildDedupKey(payload: TranzilaWebhookPayload): string {
  const parts: string[] = ['trz-wh', payload.event];
  if (payload.tran_num) parts.push(payload.tran_num);
  if (payload.payment_request_id) parts.push(payload.payment_request_id);
  if (payload.chargeback_case_id) parts.push(payload.chargeback_case_id);
  if (payload.settlement_batch_reference) parts.push(payload.settlement_batch_reference);
  if (payload.doc_number) parts.push(payload.doc_number);
  // Add event_at to prevent false dedup for legitimately separate events on same transaction
  if (payload.event_at) parts.push(payload.event_at);
  return parts.join(':');
}

// ── Main webhook endpoint ─────────────────────────────────────────────────────

router.post(
  '/',
  captureRawBody,
  async (req: Request & { rawBody?: Buffer }, res: Response): Promise<void> => {
    const clientIp =
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ??
      req.socket.remoteAddress ??
      'unknown';

    // ── IP Allowlist check ───────────────────────────────────────────────────
    if (!isIpAllowed(clientIp)) {
      logger.warn('[TranzilaWebhook] Request from non-allowed IP — rejected', {
        audit: 'webhook_rejected',
        reason: 'ip_not_allowed',
        clientIp,
      });
      res.status(403).json({ error: 'Forbidden' });
      return;
    }

    // ── Signature verification ───────────────────────────────────────────────
    const signatureHeader = req.headers['x-tranzila-signature'] as string | undefined;
    const rawBody: Buffer = Buffer.isBuffer(req.body) ? req.body : Buffer.from(JSON.stringify(req.body));

    const sigResult = TranzilaWebhookService.verifySignature(rawBody, signatureHeader);
    if (!sigResult.ok) {
      // Reason already logged by verifySignature; add route-level context here.
      logger.warn('[TranzilaWebhook] Signature check failed — 401', {
        audit: 'webhook_rejected',
        reason: sigResult.rejectReason,
        clientIp,
      });
      res.status(401).json({ error: 'Invalid signature' });
      return;
    }

    // ── Parse payload ────────────────────────────────────────────────────────
    let payload: TranzilaWebhookPayload;
    try {
      payload = JSON.parse(rawBody.toString('utf8')) as TranzilaWebhookPayload;
    } catch (err: any) {
      logger.error('[TranzilaWebhook] Failed to parse webhook body', { error: err?.message });
      res.status(400).json({ error: 'Invalid JSON' });
      return;
    }

    if (!payload.event) {
      logger.warn('[TranzilaWebhook] Missing event field in payload');
      res.status(400).json({ error: 'Missing event field' });
      return;
    }

    // ── Idempotency / deduplication ──────────────────────────────────────────
    const dedupKey = buildDedupKey(payload);
    const duplicate = await isDuplicate(dedupKey);
    if (duplicate) {
      logger.info('[TranzilaWebhook] Duplicate webhook — ignoring', {
        audit: 'webhook_rejected',
        reason: 'duplicate_event',
        event: payload.event,
        dedupKey,
      });
      res.status(200).json({ status: 'already_processed' });
      return;
    }

    // ── Dispatch ─────────────────────────────────────────────────────────────
    try {
      const result = await TranzilaWebhookService.dispatch(payload);
      logger.info('[TranzilaWebhook] Event dispatched successfully', {
        event: payload.event,
        outcome: result.outcome,
        processorTransactionId: result.processorTransactionId,
      });
      res.status(200).json({ status: 'ok', outcome: result.outcome });
    } catch (err: any) {
      logger.error('[TranzilaWebhook] Unhandled dispatch error', {
        event: payload.event,
        error: err?.message,
      });
      // Return 200 to prevent Tranzila from retrying a permanently broken event
      res.status(200).json({ status: 'error_logged' });
    }
  },
);

export default router;
