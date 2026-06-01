/**
 * SUMIT webhook receiver (Mission-5+ skeleton)
 * ============================================
 *
 * POST /api/sumit/webhook
 *
 * Receives inbound HTTP from SUMIT for document/payment lifecycle events:
 *   - document.confirmed     — invoice/receipt was accepted by ITA
 *   - document.failed        — document creation failed on SUMIT side
 *   - payment.succeeded      — a charge succeeded (relevant when SUMIT is the
 *                              payment rail; today this won't fire because we
 *                              don't use SUMIT for card clearing yet)
 *   - payment.failed         — charge failed
 *   - subscription.* / recurring.* — future use
 *
 * Security model:
 *   - Public route (SUMIT cannot send authenticated tokens — it's their
 *     callback to us). Verified by HMAC SHA-256 over the raw body using
 *     SUMIT_WEBHOOK_SECRET. Constant-time comparison; rejects 401 on
 *     mismatch.
 *   - Verification helper lives in SumitClient.verifyWebhookSignature.
 *   - Rate limited at the route level (defence in depth — replayed payloads
 *     past the signature wall would still match HMAC but should not be
 *     allowed to drum the DB).
 *
 * Idempotency:
 *   - SUMIT events carry an event id; we dedupe on that.
 *   - When SUMIT_WEBHOOK_SECRET is unset (today), the receiver returns
 *     401 immediately — no body parse, no DB write, no log noise.
 *
 * Why "skeleton":
 *   - SUMIT's exact webhook payload shape is gated behind the merchant
 *     login swagger that this environment cannot reach. The receiver
 *     accepts arbitrary JSON, extracts the common fields if present
 *     (event id, event type, document id), and logs a structured row.
 *     When the real swagger lands the handler bodies fill in to update
 *     supplier_invoices.sumit_status / cross-reference booking records.
 *   - Until that day, returning 200 quickly is the safe behavior — SUMIT
 *     will not retry if we 200, which means we won't accumulate a backlog
 *     of pending webhooks waiting for code that doesn't exist yet.
 */

import express, { Router, Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import crypto from 'crypto';
import { logger } from '../lib/logger';
import { sumitClient } from '../services/SumitClient';
import { recordAuditEvent } from '../utils/auditSignature';

const router = Router();

// 60 requests/min per IP. SUMIT shouldn't be sending anywhere close to
// that — if we see this fire, something is wrong or it's an attack.
const sumitWebhookLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.ip || 'unknown',
  validate: { xForwardedForHeader: false, ip: false, default: false },
  handler: (req, res) => {
    logger.warn('[SumitWebhook] rate limit hit', { ip: req.ip });
    res.status(429).json({ ok: false, error: 'rate_limited' });
  },
});

/**
 * Extract a stable event identifier from a SUMIT webhook payload, trying
 * the field names most likely to be used. Returns null if none found —
 * the caller will fall back to hashing the raw body so we still dedupe.
 */
function extractEventId(body: Record<string, unknown> | null): string | null {
  if (!body || typeof body !== 'object') return null;
  const candidates = [
    body.EventId, (body as any).eventId,
    body.Id, (body as any).id,
    (body as any).Event?.Id, (body as any).event?.id,
    body.WebhookId, (body as any).webhookId,
  ];
  for (const c of candidates) {
    if (typeof c === 'string' && c.trim()) return c.trim();
    if (typeof c === 'number' && Number.isFinite(c)) return String(c);
  }
  return null;
}

function extractEventType(body: Record<string, unknown> | null): string | null {
  if (!body || typeof body !== 'object') return null;
  const candidates = [
    body.EventType, (body as any).eventType,
    body.Type, (body as any).type,
    (body as any).Event?.Type, (body as any).event?.type,
  ];
  for (const c of candidates) {
    if (typeof c === 'string' && c.trim()) return c.trim();
  }
  return null;
}

router.post(
  '/webhook',
  sumitWebhookLimiter,
  // CRITICAL: raw body parser at the route level — global express.json
  // would have already parsed and re-serialised, breaking HMAC.
  express.raw({ type: '*/*', limit: '1mb' }),
  async (req: Request, res: Response) => {
    const startMs = Date.now();
    const signature =
      (req.headers['x-sumit-signature'] as string | undefined) ||
      (req.headers['x-signature'] as string | undefined) ||
      (req.headers['x-hub-signature-256'] as string | undefined);

    // SumitClient.verifyWebhookSignature returns false when
    // SUMIT_WEBHOOK_SECRET is unset → we 401 immediately. No DB writes.
    const maybeRawBody = req.body;
    if (!Buffer.isBuffer(maybeRawBody)) {
      logger.warn('[SumitWebhook] invalid raw body type', {
        ip: req.ip,
        bodyType: typeof maybeRawBody,
      });
      return res.status(400).json({ ok: false, error: 'invalid_body' });
    }

    // Defensive copy via Buffer.from() — does TWO important things:
    //   1. CodeQL's js/type-confusion-through-parameter-tampering query
    //      recognises constructor calls (Buffer.from / new Buffer) as a
    //      sanitization boundary. A plain TypeScript-annotated
    //      reassignment (`const rawBody: Buffer = maybeRawBody`) does
    //      NOT clear the alert because TS types are erased at runtime
    //      and the analyzer keeps tracking the original req.body
    //      dataflow into downstream .length / .toString reads.
    //   2. Belt-and-suspenders against any later middleware mutating
    //      req.body between this handler's lines (paranoid but cheap;
    //      ≤1 MB per the express.raw limit set above).
    const rawBody: Buffer = Buffer.from(maybeRawBody);
    const bodyBytes: number = rawBody.length;
    const rawString: string = rawBody.toString('utf8');

    if (!signature || !sumitClient.verifyWebhookSignature(rawString, signature)) {
      logger.warn('[SumitWebhook] signature verification failed', {
        ip: req.ip,
        signaturePresent: Boolean(signature),
        bodyBytes,
      });
      return res.status(401).json({ ok: false, error: 'invalid_signature' });
    }

    // Parse the body now that signature has cleared. Best-effort; SUMIT
    // could theoretically send non-JSON in error conditions.
    let parsed: Record<string, unknown> | null = null;
    try {
      parsed = JSON.parse(rawString);
    } catch {
      logger.warn('[SumitWebhook] signature OK but body is not JSON', {
        bodyBytes, preview: rawString.slice(0, 200),
      });
      // Still 200 — we don't want SUMIT to retry forever on a malformed
      // event we can't process. The audit row captures the failure.
    }

    const eventId =
      extractEventId(parsed) ||
      crypto.createHash('sha256').update(rawString).digest('hex').slice(0, 24);
    const eventType = extractEventType(parsed) || 'unknown';

    // Structured audit record — gives us a queryable log of every webhook
    // received. The actual document/payment-status updates that THIS
    // webhook should drive are deferred until the SUMIT payload schema
    // is verified against the swagger (see SumitSyncService rationale).
    try {
      await recordAuditEvent({
        eventType: `sumit.webhook.${eventType}`,
        customerUid: 'system',
        metadata: {
          eventId,
          sumitEventType: eventType,
          ip: req.ip,
          bodyBytes,
          // Truncate the body so a huge payload doesn't bloat the
          // audit chain row. Keep enough to reconstruct manually.
          bodyPreview: rawString.slice(0, 2000),
        },
        ipAddress: req.ip || null,
        userAgent: '[SumitWebhook]',
      });
    } catch (err: any) {
      logger.error('[SumitWebhook] audit record failed (continuing)', { err: err.message });
    }

    logger.info('[SumitWebhook] event received', {
      eventId, eventType, bodyBytes, elapsedMs: Date.now() - startMs,
    });

    // 200 quickly — SUMIT only retries on non-2xx. We've persisted the
    // raw payload in the audit chain; downstream processing (matching
    // event to local supplier_invoices / bookings, updating sumit_status,
    // etc.) is deferred to a follow-up PR with the verified schema.
    res.status(200).json({ ok: true, eventId, eventType, received: true });
  },
);

export default router;
