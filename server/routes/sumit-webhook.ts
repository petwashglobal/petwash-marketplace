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
import { activateFromVerifiedPayment } from '../services/PurchaseActivationService';
import { isCommerceFlagEnabled, COMMERCE_FLAGS } from '@shared/purchase-lifecycle/flags';

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

/**
 * Allowlist of SUMIT event types that may trigger a Phase-1 activation. ONLY a
 * payment/charge SUCCESS confirms money was taken — receipt/document/refund/
 * chargeback/subscription events for the same charge MUST NOT enter the
 * activation path (a refund or document event carrying a valid txn id would
 * otherwise activate an order). Matched case-insensitively as a substring so
 * provider variants (payment.succeeded / charge.approved / transaction-approved)
 * are covered without knowing the exact swagger casing. Refund/charge-back/void
 * are explicitly excluded even if they contain "payment".
 */
function isPaymentSuccessEvent(eventType: string): boolean {
  const t = eventType.toLowerCase();
  // Hard exclusions first — these can contain "payment"/"charge" substrings.
  if (/(refund|chargeback|charge[-_. ]?back|reversal|void|cancel|fail|declin|expire)/.test(t)) {
    return false;
  }
  const isPaymentish = /(payment|charge|transaction)/.test(t);
  const isSuccessish = /(succe|approv|paid|complete|captur|confirm)/.test(t);
  return isPaymentish && isSuccessish;
}

/**
 * Categorize the SUMIT lifecycle event so we can audit + observe non-money
 * events (document / recurring / subscription / payment-fail) that today were
 * silently dropped after signature verification. Item 7 of the SUMIT Phase 2
 * lane (2026-08-19 CEO approval). NONE of these categories touches the money
 * path — they only fan out into structured audit rows for admin observability.
 */
type SumitLifecycleCategory =
  | 'payment.success'
  | 'payment.failed'
  | 'document.confirmed'
  | 'document.failed'
  | 'subscription.event'
  | 'recurring.event'
  | 'refund.event'
  | 'other';

function categorizeSumitEvent(eventType: string): SumitLifecycleCategory {
  const t = eventType.toLowerCase();
  if (/(refund|chargeback|reversal)/.test(t)) return 'refund.event';
  if (isPaymentSuccessEvent(eventType))       return 'payment.success';
  if (/(payment|charge|transaction)/.test(t) && /(fail|declin|expire|void|cancel)/.test(t)) {
    return 'payment.failed';
  }
  if (/document/.test(t)) {
    return /(fail|reject|declin|error)/.test(t) ? 'document.failed' : 'document.confirmed';
  }
  if (/subscription/.test(t)) return 'subscription.event';
  if (/recurring/.test(t))    return 'recurring.event';
  return 'other';
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

/** SUMIT payment/transaction id — the stable idempotency anchor for activation. */
function extractTransactionId(body: Record<string, unknown> | null): string | null {
  if (!body || typeof body !== 'object') return null;
  const b = body as any;
  const candidates = [
    b.TransactionID, b.transactionId, b.TransactionId,
    b.PaymentID, b.paymentId, b.PaymentId,
    b.Data?.TransactionID, b.data?.transactionId,
    b.Payment?.ID, b.payment?.id,
    b.ID, b.id,
  ];
  for (const c of candidates) {
    if (typeof c === 'string' && c.trim()) return c.trim();
    if (typeof c === 'number' && Number.isFinite(c)) return String(c);
  }
  return null;
}

/** Our ExternalIdentifier echoed back (purchases.surfaceRefId). */
function extractExternalRef(body: Record<string, unknown> | null): string | null {
  if (!body || typeof body !== 'object') return null;
  const b = body as any;
  const candidates = [
    b.ExternalIdentifier, b.externalIdentifier,
    b.ExternalId, b.externalId, b.ext,
    b.OrderId, b.orderId, b.OrderID,
    b.Data?.ExternalIdentifier, b.data?.externalId,
  ];
  for (const c of candidates) {
    if (typeof c === 'string' && c.trim()) return c.trim();
    if (typeof c === 'number' && Number.isFinite(c)) return String(c);
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

    // ── Phase-1 activation (PetWash-owned products only). Gated behind the
    //    Commerce OS umbrella flag — default OFF. The webhook is the ONLY
    //    thing that activates a purchase (never the frontend redirect).
    //    ALWAYS 200 so SUMIT does not retry-storm; the outcome is reported
    //    in the body and, when it's a not_found, escalated via an audit alert.
    let activation: { outcome: string; purchaseId?: string; reason?: string } | undefined;
    // ONLY a verified payment-SUCCESS event may activate. Refund / chargeback /
    // document / subscription events for the same charge are logged + audited
    // above but never enter the money path, even if they carry a valid txn id.
    if (isCommerceFlagEnabled(COMMERCE_FLAGS.enabled) && isPaymentSuccessEvent(eventType)) {
      const transactionId = extractTransactionId(parsed) || undefined;
      const externalRef = extractExternalRef(parsed) || undefined;
      // The idempotency anchor: prefer the SUMIT transaction/payment id;
      // fall back to the stable event id so a duplicate delivery still dedupes.
      const providerReference = transactionId || eventId;
      try {
        activation = await activateFromVerifiedPayment({
          providerReference,
          transactionId,
          externalRef,
        });
      } catch (err: any) {
        // The service itself never throws, but belt-and-suspenders: a thrown
        // error must not turn into a non-2xx (which would trigger SUMIT retries).
        logger.error('[SumitWebhook] activation threw (returning 200)', { eventId, err: err?.message });
        activation = { outcome: 'failed', reason: 'activation_threw' };
      }

      if (activation.outcome === 'not_found') {
        logger.warn('[SumitWebhook] verified payment has no matching purchase', {
          eventId, transactionId, externalRef,
        });
        try {
          await recordAuditEvent({
            eventType: 'sumit.webhook.unmatched_payment',
            customerUid: 'system',
            metadata: { eventId, transactionId: transactionId ?? null, externalRef: externalRef ?? null, sumitEventType: eventType },
            ipAddress: req.ip || null,
            userAgent: '[SumitWebhook]',
          });
        } catch (err: any) {
          logger.error('[SumitWebhook] unmatched-payment audit failed', { err: err?.message });
        }
      }
    }

    // ── Item 7 (2026-08-19): SUMIT Phase 2 lifecycle observability ─────────
    // Before this, document/subscription/recurring/refund events were logged
    // once at line ~247 and then silently dropped. Now we categorize each
    // non-payment-success event and write a per-category audit row so admin
    // dashboards and the Item 11 reconciler have something to compare against.
    // NONE of this touches the money path — activation still gates on
    // isPaymentSuccessEvent above. This is pure observability + a hook point
    // for the follow-up handlers (subscription auto-renew, refund cascade).
    const category = categorizeSumitEvent(eventType);
    if (category !== 'payment.success' && category !== 'other') {
      try {
        const transactionId = extractTransactionId(parsed) || null;
        const externalRef   = extractExternalRef(parsed) || null;
        await recordAuditEvent({
          eventType: `sumit.webhook.${category}`,
          customerUid: 'system',
          metadata: {
            eventId,
            sumitEventType: eventType,
            transactionId,
            externalRef,
            category,
          },
          ipAddress: req.ip || null,
          userAgent: '[SumitWebhook]',
        });
        logger.info('[SumitWebhook] lifecycle event categorized', {
          eventId,
          eventType,
          category,
          transactionId,
          externalRef,
        });
      } catch (err: any) {
        // Never let audit-write failures turn into a retry storm. SUMIT only
        // retries on non-2xx; we still ack 200.
        logger.error('[SumitWebhook] lifecycle audit failed (continuing)', {
          err: err?.message,
          category,
          eventId,
        });
      }
    }

    // 200 quickly — SUMIT only retries on non-2xx. We've persisted the raw
    // payload in the audit chain and (when the flag is on) attempted an
    // idempotent activation. The outcome is echoed for observability.
    res.status(200).json({
      ok: true,
      eventId,
      eventType,
      received: true,
      activation: activation?.outcome ?? 'skipped',
      category,
    });
  },
);

export default router;
