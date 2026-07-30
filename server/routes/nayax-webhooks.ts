/**
 * NAYAX WEBHOOK ROUTES
 * 
 * Handles real-time transaction updates from Nayax Israel payment terminals
 * 
 * Security Features:
 * - HMAC-SHA256 signature validation
 * - IP allowlist (Nayax production servers only)
 * - Idempotency protection (duplicate prevention)
 * - Rate limiting
 * 
 * 2025 USA Competitor Standards:
 * - HMAC webhook signatures
 * - Automatic retry with exponential backoff
 * - Comprehensive audit logging
 */

import express from 'express';
import crypto from 'crypto';
import { logger } from '../lib/logger';
import { redis } from '../services/redis';
import { tryClaimWebhookEvent } from '../lib/nayaxWebhookDedup';
import PaymentGatewayService, { type WebhookPayload } from '../services/PaymentGatewayService';
import { db } from '../db';
import { paymentIntents, bookings, bookingStatusHistory, availabilitySlots, escrowHoldings, users } from '@shared/schema';
import { eq, sql } from 'drizzle-orm';
import { createIPAllowlist } from '../middleware/ipAllowlist';
import { NayaxOnlinePaymentService } from '../services/NayaxOnlinePaymentService';
import { logReceipt, appendFormSubmission, logOpsLiveFeed } from '../services/googleSheetsIntegration';
import { canConfirmBooking } from '../services/DealGateService';
import { dispatchNotifications } from '../services/PetWashNotificationEngine';
import { createOrUpdateAlert } from '../services/AlertEngine';

const SHEETS_API_ERRORS = 'API Error Log';

const router = express.Router();

// ==================== RAW BODY CAPTURE ====================

/**
 * Capture raw request body for signature validation
 * CRITICAL: Must run BEFORE express.json() middleware
 * 
 * Nayax signs the raw body bytes, so we need to preserve them
 */
const captureRawBody = express.raw({ 
  type: 'application/json',
  limit: '10mb',
});

// ==================== CONFIGURATION ====================

const NAYAX_WEBHOOK_SECRET = process.env.NAYAX_WEBHOOK_SECRET || '';
const NAYAX_ALLOWED_IPS = process.env.NAYAX_ALLOWED_IPS?.split(',') || [
  // Nayax Israel production webhook servers
  // These IPs should be obtained from Nayax documentation
  '185.60.216.0/24', // Example - replace with actual Nayax IPs
];

// Redis-based deduplication — survives restarts and horizontal scaling.
// Falls back to accepting (non-deduplicating) when Redis is unavailable,
// logging a warning so ops can see when dedup is degraded.
const WEBHOOK_DEDUP_TTL_SECONDS = 86400; // 24 hours — covers Nayax retry window

// ==================== MIDDLEWARE ====================

/**
 * IP allowlist middleware for Nayax webhooks
 * Uses enterprise-grade IP filtering with CIDR support
 */
const validateIPAllowlist = createIPAllowlist('NAYAX_ALLOWED_IPS', 'Nayax');

/**
 * Validate Nayax webhook signature
 * 
 * Nayax signs webhooks with HMAC-SHA256 using shared secret
 * Signature format: sha256=<hex_digest>
 * 
 * CRITICAL: Uses raw body bytes (preserved by captureRawBody middleware)
 */
function validateNayaxSignature(
  req: express.Request & { rawBody?: Buffer },
  res: express.Response,
  next: express.NextFunction
) {
  try {
    // Headers arrive as string | string[] | undefined. A duplicated header makes
    // this an ARRAY (parameter tampering) — normalise to a single string and reject
    // anything that isn't one, so the downstream .replace()/HMAC compare can't be
    // confused by a non-string value.
    const rawSig = req.headers['x-nayax-signature'];
    const signature = Array.isArray(rawSig) ? rawSig[0] : rawSig;

    if (typeof signature !== 'string' || !signature) {
      logger.warn('[NayaxWebhook] Missing signature', {
        ip: req.ip,
        url: req.url,
      });
      return res.status(401).json({ error: 'Missing webhook signature' });
    }
    
    if (!NAYAX_WEBHOOK_SECRET) {
      logger.error('[NayaxWebhook] Webhook secret not configured');
      return res.status(500).json({ error: 'Webhook validation not configured' });
    }
    
    // Get raw body bytes (critical for signature validation). Only trust the
    // captured raw Buffer — NEVER HMAC a parsed body object (type confusion).
    const rawBody = req.rawBody;

    if (!Buffer.isBuffer(rawBody)) {
      logger.error('[NayaxWebhook] No raw body buffer available for signature validation');
      return res.status(500).json({ error: 'Cannot validate signature' });
    }
    
    // Compute expected signature over raw bytes
    const expectedSignature = crypto
      .createHmac('sha256', NAYAX_WEBHOOK_SECRET)
      .update(rawBody)
      .digest('hex');
    
    const providedSignature = signature.replace('sha256=', '');

    // Constant-time comparison to prevent timing attacks. timingSafeEqual throws a
    // RangeError on unequal-length buffers, so length-check first (a mismatched
    // length is simply an invalid signature — not a 500).
    const expectedBuf = Buffer.from(expectedSignature);
    const providedBuf = Buffer.from(providedSignature);
    const isValid =
      expectedBuf.length === providedBuf.length &&
      crypto.timingSafeEqual(expectedBuf, providedBuf);
    
    if (!isValid) {
      logger.warn('[NayaxWebhook] Invalid signature', {
        ip: req.ip,
        providedSignature: providedSignature.substring(0, 16) + '...',
        expectedSignature: expectedSignature.substring(0, 16) + '...',
        bodyLength: (Buffer.isBuffer(rawBody) || typeof rawBody === 'string') ? rawBody.length : 0,
      });
      return res.status(401).json({ error: 'Invalid webhook signature' });
    }
    
    logger.info('[NayaxWebhook] Signature validated successfully');
    
    // Parse JSON body for route handlers (rawBody was a Buffer)
    if (Buffer.isBuffer(rawBody)) {
      req.body = JSON.parse(rawBody.toString('utf8'));
    }
    
    next();
  } catch (error) {
    logger.error('[NayaxWebhook] Signature validation error', error);
    return res.status(500).json({ error: 'Signature validation failed' });
  }
}

/**
 * Check if webhook has already been processed (idempotency).
 *
 * DB-backed insert-first dedup using nayax_processed_event_ids (PK on
 * event_id). The INSERT is atomic — survives Node restart and works
 * across horizontally-scaled Cloud Run instances without shared state.
 *
 * Behavior:
 *   - new event → INSERT succeeds, next()
 *   - duplicate event → INSERT short-circuits via ON CONFLICT DO NOTHING,
 *     returns 200 OK with { deduplicated: true } so Nayax stops retrying
 *   - DB failure → 503 (fail closed). Nayax retries on its own schedule.
 *     This is intentional: failing OPEN here is what caused the prior
 *     vulnerability (Redis fallback allowed duplicates through and
 *     could double-credit wallets on Nayax's retry).
 */
async function checkIdempotency(
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
) {
  const eventId = req.body.eventId || req.body.transactionId;

  if (!eventId) {
    logger.warn('[NayaxWebhook] Missing event ID');
    return res.status(400).json({ error: 'Missing event ID' });
  }

  try {
    const result = await tryClaimWebhookEvent({
      eventId: String(eventId),
      sourceRoute: req.originalUrl || req.url,
    });
    if (result.processed === 'duplicate') {
      return res.status(200).json({
        received: true,
        deduplicated: true,
        message: 'Webhook already processed',
      });
    }
    return next();
  } catch (err) {
    // Fail CLOSED on DB outage — Nayax will retry. Better than failing
    // open and risking duplicate processing of a real payment event.
    logger.error('[NayaxWebhook] DB dedup unavailable — failing closed', {
      eventId,
      err: (err as Error).message,
    });
    return res.status(503).json({
      error: 'Webhook deduplication service unavailable — Nayax should retry',
    });
  }
}

// ==================== ROUTES ====================

/**
 * POST /api/webhooks/nayax/terminal
 * 
 * Receives terminal transaction webhooks from Nayax
 * 
 * Expected payload:
 * {
 *   "eventType": "payment.success",
 *   "eventId": "evt_abc123",
 *   "transactionId": "txn_xyz789",
 *   "terminalId": "TERM_001",
 *   "stationId": "K9000_TLV_001",
 *   "amount": 45.00,
 *   "currency": "ILS",
 *   "status": "completed",
 *   "timestamp": "2025-01-15T10:30:00Z",
 *   "cardBrand": "visa",
 *   "cardLast4": "4242"
 * }
 */
router.post(
  '/nayax/terminal',
  validateIPAllowlist, // MUST be first - blocks unauthorized IPs
  captureRawBody, // Captures raw bytes for signature validation
  validateNayaxSignature, // Uses raw bytes for HMAC
  checkIdempotency,
  async (req, res) => {
    try {
      const payload: WebhookPayload = req.body;
      
      logger.info('[NayaxWebhook] Terminal webhook received', {
        eventType: payload.eventType,
        transactionId: payload.transactionId,
        terminalId: payload.terminalId,
        amount: payload.amount,
        status: payload.status,
      });
      
      // Process through PaymentGatewayService
      const result = await PaymentGatewayService.handleNayaxWebhook(payload);
      
      if (result.processed) {
        res.status(200).json({
          received: true,
          transactionId: payload.transactionId,
        });
      } else {
        logger.error('[NayaxWebhook] Processing failed', result.error, {
          transactionId: payload.transactionId,
        });
        
        // Return 200 to prevent Nayax retries (we've logged the error)
        res.status(200).json({
          received: true,
          error: result.error,
        });
      }
    } catch (error) {
      logger.error('[NayaxWebhook] Unexpected error', error);
      
      // Return 500 to trigger Nayax retry
      res.status(500).json({
        error: 'Internal server error',
      });
    }
  }
);

/**
 * POST /api/webhooks/nayax/settlement
 * 
 * Daily settlement report from Nayax
 * Used for reconciliation and accounting
 */
router.post(
  '/nayax/settlement',
  validateIPAllowlist, // Block unauthorized IPs
  captureRawBody,
  validateNayaxSignature,
  checkIdempotency,
  async (req, res) => {
    try {
      const { settlementId, date, totalAmount, currency, transactions } = req.body;
      
      logger.info('[NayaxWebhook] Settlement webhook received', {
        settlementId,
        date,
        totalAmount,
        transactionCount: transactions?.length || 0,
      });
      
      // ── Compare Nayax settlement against local nayax_transactions ─────────
      const discrepancies: Array<{ nayaxTxId: string; issue: string; nayaxAmount?: number; localAmount?: number }> = [];
      let matchedCount = 0;

      if (Array.isArray(transactions) && transactions.length > 0) {
        for (const nayaxTx of transactions) {
          const localRecords = await db
            .select()
            .from(paymentIntents)
            .where(eq(paymentIntents.transactionId, nayaxTx.transactionId || nayaxTx.id))
            .limit(1);

          if (localRecords.length === 0) {
            discrepancies.push({
              nayaxTxId: nayaxTx.transactionId || nayaxTx.id,
              issue: 'not_found_locally',
              nayaxAmount: nayaxTx.amount,
            });
          } else {
            const local = localRecords[0];
            const nayaxAmountAgorot = Math.round((nayaxTx.amount || 0) * 100);
            if (Math.abs(nayaxAmountAgorot - (local.amount || 0)) > 1) {
              discrepancies.push({
                nayaxTxId: nayaxTx.transactionId || nayaxTx.id,
                issue: 'amount_mismatch',
                nayaxAmount: nayaxTx.amount,
                localAmount: (local.amount || 0) / 100,
              });
            } else {
              // Mark local payment_intent as settled
              await db
                .update(paymentIntents)
                .set({ status: 'settled' })
                .where(eq(paymentIntents.transactionId, nayaxTx.transactionId || nayaxTx.id));
              matchedCount++;
            }
          }
        }
      }

      // ── Persist reconciliation result to nayax_settlement_reports ────────
      try {
        await db.execute(sql`
          INSERT INTO nayax_settlement_reports (
            settlement_id, date, total_amount_nayax, currency,
            transaction_count, matched_count, discrepancy_count,
            discrepancies_json, status, created_at, updated_at
          ) VALUES (
            ${settlementId}, ${date ? date : new Date().toISOString().slice(0,10)},
            ${totalAmount || 0}, ${currency || 'ILS'},
            ${transactions?.length || 0}, ${matchedCount},
            ${discrepancies.length},
            ${JSON.stringify(discrepancies)},
            ${discrepancies.length > 0 ? 'discrepancy' : 'matched'},
            NOW(), NOW()
          )
          ON CONFLICT (settlement_id) DO UPDATE SET
            matched_count      = EXCLUDED.matched_count,
            discrepancy_count  = EXCLUDED.discrepancy_count,
            discrepancies_json = EXCLUDED.discrepancies_json,
            status             = EXCLUDED.status,
            updated_at         = NOW()
        `);
      } catch (insertErr: any) {
        logger.warn('[NayaxWebhook] Could not persist settlement record', { error: insertErr.message });
      }

      logger.info('[NayaxWebhook] Settlement reconciliation complete', {
        settlementId,
        total: transactions?.length || 0,
        matched: matchedCount,
        discrepancies: discrepancies.length,
      });

      res.status(200).json({
        received: true,
        settlementId,
        reconciliation: {
          total: transactions?.length || 0,
          matched: matchedCount,
          discrepancies: discrepancies.length,
          status: discrepancies.length > 0 ? 'discrepancy' : 'matched',
        },
      });
    } catch (error) {
      logger.error('[NayaxWebhook] Settlement error', error);
      res.status(500).json({ error: 'Settlement processing failed' });
    }
  }
);

/**
 * POST /api/webhooks/nayax/refund
 * 
 * Refund notification from Nayax
 */
router.post(
  '/nayax/refund',
  validateIPAllowlist, // Block unauthorized IPs
  captureRawBody,
  validateNayaxSignature,
  checkIdempotency,
  async (req, res) => {
    try {
      const { transactionId, refundId, amount, currency, reason } = req.body;
      
      logger.info('[NayaxWebhook] Refund webhook received', {
        transactionId,
        refundId,
        amount,
        reason,
      });
      
      // Update payment intent status to refunded
      await db.update(paymentIntents)
        .set({
          status: 'refunded',
          updatedAt: new Date(),
        })
        .where(eq(paymentIntents.transactionId, transactionId));
      
      res.status(200).json({
        received: true,
        refundId,
      });
    } catch (error) {
      logger.error('[NayaxWebhook] Refund error', error);
      res.status(500).json({ error: 'Refund processing failed' });
    }
  }
);

/**
 * POST /api/webhooks/nayax/payment
 *
 * Hardened online payment webhook for Nayax hosted payment pages.
 *
 * Security controls implemented:
 *  1. Idempotency      — booking.payment_intent_id checked; duplicate transaction rejected
 *  2. Transaction ID   — stored in bookings.payment_intent_id (indexed varchar column)
 *  3. Amount check     — payload.amountCents validated against booking.total (±1 agora tolerance)
 *  4. Currency check   — must be ILS
 *  5. Status gate      — only transitions from pending_payment; any other status returns 200+note
 *  6. Signature        — HMAC-SHA256 via X-Nayax-Signature; REQUIRED when NAYAX_WEBHOOK_SECRET set
 *  7. Event coverage   — success / failed / expired / cancelled all handled
 */
router.post(
  '/nayax/payment',
  validateIPAllowlist, // Block unauthorized IPs (consistent with /nayax/terminal and /nayax/settlement)
  captureRawBody,
  async (req, res) => {
    try {
      // ── Parse raw body ────────────────────────────────────────────────────────
      const rawBodyBuffer: Buffer = Buffer.isBuffer(req.body)
        ? req.body
        : Buffer.from(JSON.stringify(req.body));
      const rawBody = rawBodyBuffer.toString('utf8');

      let parsedBody: any;
      try {
        parsedBody = JSON.parse(rawBody);
      } catch {
        return res.status(400).json({ error: 'Invalid JSON payload' });
      }

      // ── [6] Signature verification — FAIL-CLOSED (2026-06-14) ─────────────────
      // This webhook MARKS A BOOKING PAID. It must never trust an unsigned body.
      // Previously, when NAYAX_WEBHOOK_SECRET was unset, isSignatureEnforced()
      // returned false and the missing-signature check was SKIPPED — meaning any
      // request that passed the IP allowlist could mark a booking paid for free.
      // We now REJECT outright when the secret is not configured (no secret →
      // cannot verify authenticity → cannot trust a "paid" event). Real Nayax
      // traffic resumes the moment NAYAX_WEBHOOK_SECRET is set in the secret
      // pipeline. (IP allowlist already ran above — this is defense in depth.)
      const signature = (req.headers['x-nayax-signature'] as string) || '';

      if (!NayaxOnlinePaymentService.isSignatureEnforced()) {
        logger.error('[NayaxPaymentWebhook] NAYAX_WEBHOOK_SECRET not configured — rejecting webhook (fail-closed). Set the secret to enable Nayax online payments.');
        return res.status(503).json({ error: 'Webhook signature verification not configured' });
      }

      if (!signature) {
        logger.warn('[NayaxPaymentWebhook] Missing required signature header — request rejected');
        return res.status(401).json({ error: 'X-Nayax-Signature header is required' });
      }

      if (!NayaxOnlinePaymentService.verifyWebhookSignature(rawBody, signature)) {
        logger.warn('[NayaxPaymentWebhook] Invalid signature — request rejected');
        return res.status(401).json({ error: 'Invalid signature' });
      }

      // ── Validate required payload fields ──────────────────────────────────────
      const payload = parsedBody as {
        event: string;
        sessionId?: string;
        bookingId: string;
        transactionId: string;
        amountCents: number;
        currency: string;
        timestamp: string;
      };

      if (!payload.bookingId || !payload.transactionId || !payload.event) {
        return res.status(400).json({ error: 'Missing required fields: bookingId, transactionId, event' });
      }

      // ── [4] Currency validation ────────────────────────────────────────────────
      if (payload.currency && payload.currency !== 'ILS') {
        logger.error('[NayaxPaymentWebhook] Currency mismatch — only ILS accepted', {
          received: payload.currency,
          bookingId: payload.bookingId,
        });
        return res.status(400).json({ error: `Invalid currency: ${payload.currency}. Only ILS is accepted.` });
      }

      logger.info('[NayaxPaymentWebhook] Webhook received', {
        event: payload.event,
        bookingId: payload.bookingId,
        transactionId: payload.transactionId,
        amountCents: payload.amountCents,
        signaturePresent: !!signature,
      });

      // ── Fetch booking — required for all controls below ───────────────────────
      const [booking] = await db
        .select()
        .from(bookings)
        .where(eq(bookings.id, payload.bookingId))
        .limit(1);

      if (!booking) {
        logger.error('[NayaxPaymentWebhook] Booking not found', { bookingId: payload.bookingId });
        return res.status(404).json({ error: 'Booking not found' });
      }

      // ── [1] Idempotency — reject duplicate transactions ───────────────────────
      if (booking.paymentIntentId && booking.paymentIntentId === payload.transactionId) {
        logger.info('[NayaxPaymentWebhook] Duplicate webhook — transaction already processed', {
          bookingId: payload.bookingId,
          transactionId: payload.transactionId,
        });
        return res.status(200).json({
          received: true,
          note: 'already_processed',
          bookingId: payload.bookingId,
        });
      }

      // ── Process by event type ─────────────────────────────────────────────────
      if (payload.event === 'payment.success') {

        // ── [5] Status gate — only transition from pending_payment ────────────
        if (booking.status !== 'pending_payment') {
          logger.warn('[NayaxPaymentWebhook] Status gate: booking not in pending_payment', {
            bookingId: payload.bookingId,
            currentStatus: booking.status,
          });
          return res.status(200).json({
            received: true,
            note: 'status_gate_blocked',
            currentStatus: booking.status,
            bookingId: payload.bookingId,
          });
        }

        // ── [3] Amount validation ─────────────────────────────────────────────
        const bookingTotalCents = Math.round(parseFloat(String(booking.total)) * 100);
        const TOLERANCE_AGOROT = 1; // 1 agora tolerance for decimal rounding
        if (Math.abs(payload.amountCents - bookingTotalCents) > TOLERANCE_AGOROT) {
          logger.error('[NayaxPaymentWebhook] Amount mismatch — POTENTIAL FRAUD or configuration error', {
            bookingId: payload.bookingId,
            transactionId: payload.transactionId,
            expected: bookingTotalCents,
            received: payload.amountCents,
            diff: payload.amountCents - bookingTotalCents,
          });
          return res.status(400).json({
            error: 'Amount mismatch',
            expected: bookingTotalCents,
            received: payload.amountCents,
          });
        }

        // ── [2] Atomic transaction: booking + status history + escrow ────────
        // All three writes are PostgreSQL. Wrapping them in db.transaction()
        // guarantees atomicity: if the escrow update fails, the booking status
        // update also rolls back — no "paid but escrow still pending_payment" drift.
        await db.transaction(async (tx) => {
          await tx
            .update(bookings)
            .set({
              status: 'pending_confirmation',
              paymentStatus: 'paid',
              paymentIntentId: payload.transactionId,  // [2] indexed DB column
              updatedAt: new Date(),
            } as any)
            .where(eq(bookings.id, payload.bookingId));

          await tx.insert(bookingStatusHistory).values({
            bookingId: payload.bookingId,
            fromStatus: 'pending_payment' as any,
            toStatus: 'pending_confirmation' as any,
            changedBy: 'nayax_webhook',
            reason: `Nayax online payment confirmed — txId: ${payload.transactionId}`,
            metadata: {
              nayaxTransactionId: payload.transactionId,
              nayaxSessionId: payload.sessionId,
              amountCents: payload.amountCents,
              bookingTotalCents,
              currency: payload.currency || 'ILS',
              webhookTimestamp: payload.timestamp,
              signatureVerified: !!signature,
            },
          });

          // Transition escrow_holdings pending_payment → held inside same transaction.
          // Created at checkout, confirmed only on real Nayax payment.callback.
          await tx
            .update(escrowHoldings)
            .set({
              status: 'held',
              capturedAt: new Date(),
              paymentIntentId: payload.transactionId,
              updatedAt: new Date(),
            } as any)
            .where(eq(escrowHoldings.bookingId, payload.bookingId));
        });

        logger.info('[NayaxPaymentWebhook] ✅ Atomic transaction committed — booking paid, escrow held', {
          bookingId: payload.bookingId,
          transactionId: payload.transactionId,
          amountCents: payload.amountCents,
        });

        // ── [Ops] Fire-and-forget: Sheets receipt + live feed ─────────────────
        setImmediate(() => {
          const amountILS = (payload.amountCents / 100).toFixed(2);
          Promise.all([
            logReceipt({
              receiptId: `nayax-${payload.transactionId}`,
              transactionId: payload.transactionId,
              customerName: '',
              email: '',
              amount: amountILS,
              paymentMethod: 'Nayax Online',
              platform: booking.platformId || 'PetWash',
              serviceType: booking.serviceType || 'Booking',
              description: `Nayax payment confirmed — booking ${payload.bookingId}`,
              status: 'Completed',
            }),
            logOpsLiveFeed({
              eventType: 'payment.success',
              source: 'nayax_webhook',
              entityId: payload.transactionId,
              bookingId: payload.bookingId,
              amountILS,
              currency: payload.currency || 'ILS',
              platform: booking.platformId || 'PetWash',
              status: 'confirmed',
              actor: 'nayax',
              details: `booking → pending_confirmation`,
            }),
          ]).catch(e => logger.warn('[NayaxPaymentWebhook] Sheets logging error (non-blocking)', e));
        });

      } else if (payload.event === 'payment.failed') {
        // ── [7] Failed ────────────────────────────────────────────────────────
        await db
          .update(bookings)
          .set({ status: 'payment_failed', paymentStatus: 'failed', updatedAt: new Date() } as any)
          .where(eq(bookings.id, payload.bookingId));

        // ── [P1-FIX] Release the booked slot so it can be re-booked ─────────
        // Without this the slot stays 'booked' forever even though no payment happened.
        await db
          .update(availabilitySlots)
          .set({
            status: 'available',
            bookingId: null,
            lockToken: null,
            lockExpiresAt: null,
            lockedByUid: null,
            updatedAt: new Date(),
          } as any)
          .where(eq(availabilitySlots.bookingId, payload.bookingId));

        // ── [P1-FIX] Void the escrow record — payment never captured ─────────
        await db
          .update(escrowHoldings)
          .set({ status: 'refunded', updatedAt: new Date() } as any)
          .where(eq(escrowHoldings.bookingId, payload.bookingId));

        logger.warn('[NayaxPaymentWebhook] Payment failed — booking marked payment_failed, slot released, escrow voided', {
          bookingId: payload.bookingId,
          transactionId: payload.transactionId,
        });

        // ── Customer notification: payment failed (ADDITIVE, fire-and-forget) ──
        // No money behavior changed — just tells the customer their payment
        // didn't complete and the slot was released, so they can retry. Dynamic
        // imports match this file's pattern; fully wrapped so it can never affect
        // the webhook's money path.
        setImmediate(async () => {
          try {
            const { users: usersTbl } = await import('@shared/schema');
            const { dispatchNotification } = await import('../lib/notificationDispatcher');
            const custId = (booking as any)?.userId || (booking as any)?.customerId;
            if (custId) {
              const [cust] = await db
                .select({ email: usersTbl.email, phone: usersTbl.phone, firstName: usersTbl.firstName })
                .from(usersTbl)
                .where(eq(usersTbl.id, custId))
                .limit(1);
              if (cust) {
                const retryUrl = `https://petwash.co.il/booking/confirmation/${payload.bookingId}`;
                await dispatchNotification({
                  uid: custId,
                  email: cust.email || undefined,
                  phone: cust.phone || undefined,
                  type: 'payment_failed',
                  title: 'התשלום לא הושלם · Payment not completed — PetWash™',
                  bodyHtml: `<!DOCTYPE html><html><body style="font-family:Arial;direction:rtl;text-align:right;padding:24px;background:#fff;color:#000;"><h2 style="color:#000;">התשלום לא הושלם — PetWash™</h2><p>שלום ${cust.firstName || ''},</p><p>התשלום עבור ההזמנה לא הושלם והמקום שוחרר. אפשר לנסות שוב או לבחור אמצעי תשלום אחר.</p><p><a href="${retryUrl}" style="background:#D4AF37;color:#000;padding:10px 20px;border-radius:8px;text-decoration:none;display:inline-block;font-weight:bold;">נסה/י שוב</a></p><p style="margin-top:24px;font-size:12px;color:#888;">PetWash Ltd. | petwash.co.il</p></body></html>`,
                  bodyText: `PetWash: התשלום עבור ההזמנה לא הושלם. ניתן לנסות שוב: ${retryUrl}`,
                  ctaText: 'Try again',
                  ctaUrl: retryUrl,
                  channels: ['inbox', 'email', 'sms'],
                  priority: 9,
                });
              }
            }
          } catch (e: any) {
            logger.warn('[NayaxPaymentWebhook] payment-failed customer notification failed (non-fatal)', { error: e?.message, bookingId: payload.bookingId });
          }
        });

        // ── [Ops] Fire-and-forget: API errors sheet + live feed ───────────────
        setImmediate(() => {
          Promise.all([
            appendFormSubmission(SHEETS_API_ERRORS, {
              errorId: `nayax-fail-${payload.transactionId}`,
              endpoint: '/api/webhooks/nayax/payment',
              method: 'POST',
              statusCode: '402',
              errorMessage: `payment.failed — txId: ${payload.transactionId}`,
              userId: booking.customerId || '',
              ipAddress: '',
              responseTimeMs: '',
              requestSizeKB: '',
              service: 'nayax_payment',
              resolved: 'false',
              notes: `bookingId: ${payload.bookingId}`,
            }),
            logOpsLiveFeed({
              eventType: 'payment.failed',
              source: 'nayax_webhook',
              entityId: payload.transactionId,
              bookingId: payload.bookingId,
              amountILS: payload.amountCents ? (payload.amountCents / 100).toFixed(2) : '',
              currency: payload.currency || 'ILS',
              platform: booking.platformId || 'PetWash',
              status: 'payment_failed',
              actor: 'nayax',
              details: `booking status → payment_failed`,
            }),
          ]).catch(e => logger.warn('[NayaxPaymentWebhook] Sheets logging error (non-blocking)', e));
        });

      } else if (payload.event === 'payment.expired') {
        // ── [7] Session expired ───────────────────────────────────────────────
        // Revert to draft so customer can restart the payment flow
        await db
          .update(bookings)
          .set({ status: 'draft', paymentStatus: 'expired', updatedAt: new Date() } as any)
          .where(eq(bookings.id, payload.bookingId));

        // ── [P1-FIX] Release slot + void escrow ──────────────────────────────
        await db
          .update(availabilitySlots)
          .set({
            status: 'available',
            bookingId: null,
            lockToken: null,
            lockExpiresAt: null,
            lockedByUid: null,
            updatedAt: new Date(),
          } as any)
          .where(eq(availabilitySlots.bookingId, payload.bookingId));

        await db
          .update(escrowHoldings)
          .set({ status: 'refunded', updatedAt: new Date() } as any)
          .where(eq(escrowHoldings.bookingId, payload.bookingId));

        logger.warn('[NayaxPaymentWebhook] Payment session expired — booking reverted to draft, slot released, escrow voided', {
          bookingId: payload.bookingId,
        });

        // ── [Ops] Fire-and-forget: API errors sheet + live feed ───────────────
        setImmediate(() => {
          Promise.all([
            appendFormSubmission(SHEETS_API_ERRORS, {
              errorId: `nayax-expired-${payload.bookingId}`,
              endpoint: '/api/webhooks/nayax/payment',
              method: 'POST',
              statusCode: '408',
              errorMessage: `payment.expired — session timed out`,
              userId: booking.customerId || '',
              ipAddress: '',
              responseTimeMs: '',
              requestSizeKB: '',
              service: 'nayax_payment',
              resolved: 'false',
              notes: `bookingId: ${payload.bookingId}`,
            }),
            logOpsLiveFeed({
              eventType: 'payment.expired',
              source: 'nayax_webhook',
              entityId: payload.sessionId || payload.bookingId,
              bookingId: payload.bookingId,
              currency: 'ILS',
              platform: booking.platformId || 'PetWash',
              status: 'expired',
              actor: 'nayax',
              details: `payment session expired — booking reverted to draft`,
            }),
          ]).catch(e => logger.warn('[NayaxPaymentWebhook] Sheets logging error (non-blocking)', e));
        });

      } else if (payload.event === 'payment.cancelled') {
        // ── [7] Customer cancelled ────────────────────────────────────────────
        await db
          .update(bookings)
          .set({ status: 'draft', paymentStatus: 'cancelled', updatedAt: new Date() } as any)
          .where(eq(bookings.id, payload.bookingId));

        // ── [P1-FIX] Release slot + void escrow ──────────────────────────────
        await db
          .update(availabilitySlots)
          .set({
            status: 'available',
            bookingId: null,
            lockToken: null,
            lockExpiresAt: null,
            lockedByUid: null,
            updatedAt: new Date(),
          } as any)
          .where(eq(availabilitySlots.bookingId, payload.bookingId));

        await db
          .update(escrowHoldings)
          .set({ status: 'refunded', updatedAt: new Date() } as any)
          .where(eq(escrowHoldings.bookingId, payload.bookingId));

        logger.info('[NayaxPaymentWebhook] Payment cancelled by customer — booking reverted to draft, slot released, escrow voided', {
          bookingId: payload.bookingId,
        });

        // ── [Ops] Fire-and-forget: live feed ─────────────────────────────────
        setImmediate(() => {
          logOpsLiveFeed({
            eventType: 'payment.cancelled',
            source: 'nayax_webhook',
            entityId: payload.sessionId || payload.bookingId,
            bookingId: payload.bookingId,
            currency: 'ILS',
            platform: booking.platformId || 'PetWash',
            status: 'cancelled',
            actor: 'customer',
            details: `customer cancelled payment — booking reverted to draft`,
          }).catch(e => logger.warn('[NayaxPaymentWebhook] Sheets logging error (non-blocking)', e));
        });

      } else {
        logger.warn('[NayaxPaymentWebhook] Unrecognised event type (logged, no action taken)', {
          event: payload.event,
          bookingId: payload.bookingId,
        });
      }

      // Return 200 for all handled events to prevent Nayax retries
      return res.status(200).json({ received: true, bookingId: payload.bookingId });

    } catch (error: any) {
      logger.error('[NayaxPaymentWebhook] Unhandled error', { error: error.message });
      // Return 500 to trigger Nayax retry on genuine server errors
      return res.status(500).json({ error: 'Internal server error' });
    }
  }
);

/**
 * GET /api/webhooks/nayax/health
 * 
 * Health check endpoint for Nayax monitoring
 */
router.get('/nayax/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    service: 'nayax-webhooks',
    timestamp: new Date().toISOString(),
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// POST /api/webhooks/nayax/checkout-payment
//
// Confirms a wash-package purchase initiated via POST /api/checkout.
// The /api/checkout route creates a pending washHistory record and a Nayax
// hosted-payment session.  This webhook fires when the customer completes payment
// on Nayax's page and performs the balance award — ONLY on real confirmation.
//
// bookingId format: "checkout_{washHistoryId}"
// ═══════════════════════════════════════════════════════════════════════════════
router.post(
  '/nayax/checkout-payment',
  validateIPAllowlist,
  captureRawBody,
  async (req: express.Request & { rawBody?: Buffer }, res: express.Response) => {
    try {
      const rawBodyBuffer: Buffer = Buffer.isBuffer(req.body)
        ? req.body
        : Buffer.from(JSON.stringify(req.body));
      const rawBody = rawBodyBuffer.toString('utf8');

      let parsedBody: any;
      try {
        parsedBody = JSON.parse(rawBody);
      } catch {
        return res.status(400).json({ error: 'Invalid JSON body' });
      }

      // Signature check — FAIL-CLOSED (2026-07-08), truly matching /nayax/payment.
      // This webhook CREDITS wallets, so an unsigned request must NEVER be
      // accepted. The old `signatureEnforced && !signature` form silently
      // ACCEPTED unsigned bodies whenever NAYAX_WEBHOOK_SECRET was unset in the
      // runtime — a wide-open wallet-credit endpoint. Now: no secret → 503;
      // missing signature → 401; bad signature → 401.
      const signature = req.headers['x-nayax-signature'] as string | undefined;
      if (!NayaxOnlinePaymentService.isSignatureEnforced()) {
        logger.error('[CheckoutWebhook] NAYAX_WEBHOOK_SECRET not configured — rejecting (fail-closed)');
        return res.status(503).json({ error: 'Webhook signature verification not configured' });
      }
      if (!signature) {
        logger.warn('[CheckoutWebhook] Missing required signature header');
        return res.status(401).json({ error: 'X-Nayax-Signature header is required' });
      }
      if (!NayaxOnlinePaymentService.verifyWebhookSignature(rawBody, signature)) {
        logger.warn('[CheckoutWebhook] Invalid signature');
        return res.status(401).json({ error: 'Invalid signature' });
      }

      const payload = parsedBody as {
        event: string;
        bookingId: string;     // "checkout_{washHistoryId}"
        transactionId: string;
        amountCents: number;
        currency: string;
        sessionId?: string;
        timestamp: string;
      };

      if (!payload.bookingId || !payload.transactionId || !payload.event) {
        return res.status(400).json({ error: 'Missing required fields' });
      }

      // Extract numeric washHistoryId from "checkout_{id}"
      const prefix = 'checkout_';
      if (!payload.bookingId.startsWith(prefix)) {
        logger.warn('[CheckoutWebhook] Unexpected bookingId format', { bookingId: payload.bookingId });
        return res.status(400).json({ error: 'Invalid bookingId format for checkout webhook' });
      }
      const washHistoryId = parseInt(payload.bookingId.slice(prefix.length), 10);
      if (isNaN(washHistoryId)) {
        return res.status(400).json({ error: 'Invalid washHistoryId' });
      }

      // Fail-CLOSED DB dedup (insert-first on nayax_processed_event_ids) — the same
      // helper /nayax/terminal + /nayax/settlement use. Replaces the old fail-OPEN
      // Redis dedup: on a concurrent Nayax retry with Redis down, that path
      // "proceeded without dedup" and could DOUBLE-MINT a wash package (bug hunt
      // 2026-07-09, HIGH). The DB PK makes the claim atomic, and a claim failure
      // fails closed (Nayax retries) instead of processing an unclaimed event.
      try {
        const claim = await tryClaimWebhookEvent({
          eventId: `checkout:${payload.transactionId}`,
          sourceRoute: req.originalUrl || req.url,
        });
        if (claim.processed === 'duplicate') {
          logger.info('[CheckoutWebhook] Duplicate — already processed', { transactionId: payload.transactionId });
          return res.status(200).json({ received: true, note: 'already_processed' });
        }
      } catch (dedupErr: any) {
        logger.error('[CheckoutWebhook] DB dedup unavailable — failing closed (Nayax will retry)', { error: dedupErr?.message });
        return res.status(503).json({ error: 'dedup_unavailable_retry' });
      }

      // Load pending washHistory record
      const { washHistory: washHistoryTable, users: usersTable, washPackages: washPackagesTable } = await import('@shared/schema');
      const [historyRow] = await db
        .select()
        .from(washHistoryTable)
        .where(eq(washHistoryTable.id, washHistoryId))
        .limit(1);

      if (!historyRow) {
        logger.error('[CheckoutWebhook] washHistory record not found', { washHistoryId });
        return res.status(404).json({ error: 'Checkout session not found' });
      }

      // Idempotency: if already completed, return success without re-awarding.
      if (historyRow.status === 'completed') {
        logger.info('[CheckoutWebhook] Already completed — idempotent response', { washHistoryId });
        return res.status(200).json({ received: true, note: 'already_completed' });
      }

      if (payload.event === 'payment.success') {
        // Amount validation (1-agora tolerance)
        const expectedCents = Math.round(parseFloat(String(historyRow.finalPrice)) * 100);
        if (Math.abs(payload.amountCents - expectedCents) > 1) {
          logger.error('[CheckoutWebhook] Amount mismatch — possible fraud', {
            washHistoryId, expected: expectedCents, received: payload.amountCents,
          });
          return res.status(400).json({ error: 'Amount mismatch', expected: expectedCents, received: payload.amountCents });
        }

        // Load session metadata from Firestore (discount info etc.)
        const { db: adminDb } = await import('../lib/firebase-admin');
        const sessionDoc = await adminDb.collection('checkout_sessions').doc(String(washHistoryId)).get();
        const sessionData = sessionDoc.exists ? (sessionDoc.data() as any) : null;

        const userId        = historyRow.userId;
        const washCount     = historyRow.washCount ?? 1;
        const finalPrice    = parseFloat(String(historyRow.finalPrice));
        const pointsEarned  = Math.floor(finalPrice);
        const discountAmount   = sessionData?.discountAmount   ?? 0;
        const discountPercent  = sessionData?.discountPercent  ?? 0;
        const discountType     = sessionData?.discountType     ?? 'none';
        const birthdayYear     = sessionData?.birthdayYear     ?? null;
        const kycType          = sessionData?.kycType          ?? null;
        const isNewMemberDiscountApplied = sessionData?.hasUsedNewMemberDiscount === true;

        // PR-W10: wash-pack credits go to walletAccounts.washPackageCredits
        // (the kiosk reads ONLY this column — see
        // server/services/K9000RedemptionService.ts:782). The legacy
        // users.washBalance was the bleed source: customers paid for packs
        // they could not redeem at the K9000.
        const { walletService } = await import('../services/WalletService');
        await walletService.addCredits(
          userId,
          'wash_package',
          washCount,
          'wash_package_purchase',
          String(washHistoryId),
          `Wash package purchase (${washCount} washes)`,
        );

        // totalSpent + loyaltyPoints are not part of the bleed — they
        // drive tier progression and birthday-coupon math, so they
        // continue to live on the users row.
        await db
          .update(usersTable)
          .set({
            totalSpent:    sql`CAST(${usersTable.totalSpent} AS DECIMAL) + ${finalPrice}`,
            loyaltyPoints: sql`${usersTable.loyaltyPoints} + ${pointsEarned}`,
            updatedAt: new Date(),
          })
          .where(eq(usersTable.id, userId));

        // If this was a new-member-bonus redemption, flag the user so they can't
        // use it again.  (The /api/checkout route set hasUsedNewMemberDiscount: true
        // before creating the session; here we confirm it is persisted.)
        if (isNewMemberDiscountApplied) {
          await db
            .update(usersTable)
            .set({ hasUsedNewMemberDiscount: true, updatedAt: new Date() })
            .where(eq(usersTable.id, userId));
        }

        // Mark wash history as completed with real transaction ID
        await db
          .update(washHistoryTable)
          .set({ status: 'completed' })
          .where(eq(washHistoryTable.id, washHistoryId));

        // Award canonical loyalty points (1 pt/₪ of confirmed spend) into the
        // loyaltyProfiles store the Prestige UI actually reads — before this, no
        // wash-package purchase earned points, so tiers never moved. Non-blocking
        // + idempotent per washHistoryId so a webhook retry can't double-award.
        // (Prestige earn engine, task #13.)
        setImmediate(async () => {
          try {
            const { awardLoyaltyPoints, pointsForSpend } = await import('../services/loyaltyEarn');
            await awardLoyaltyPoints({
              userId,
              amount: pointsForSpend(Number(finalPrice)),
              source: 'wash_package_purchase',
              sourceId: String(washHistoryId),
              description: `Wash package purchase (${washCount} washes)`,
            });
          } catch (earnErr: any) {
            logger.warn('[CheckoutWebhook] Loyalty earn failed (non-blocking)', { error: earnErr?.message, userId });
          }
        });

        // Log discount usage to loyalty ledger (fire-and-forget)
        setImmediate(async () => {
          try {
            if (discountAmount > 0 && discountPercent > 0) {
              if (discountType === 'birthday_coupon' && birthdayYear) {
                const { markBirthdayCouponUsed } = await import('../birthday-coupon');
                await markBirthdayCouponUsed(
                  userId,
                  String(washHistoryId),
                  discountAmount,
                  parseFloat(String(historyRow.originalPrice)),
                  finalPrice,
                  String(historyRow.packageId),
                  birthdayYear,
                );
              } else {
                await adminDb.collection('users').doc(userId).collection('loyalty_ledger').doc(String(washHistoryId)).set({
                  orderId: String(washHistoryId),
                  amount: discountAmount,
                  discountPercent,
                  discountType,
                  kycType: kycType || null,
                  timestamp: new Date(),
                  type: 'discount_applied',
                  packageId: historyRow.packageId,
                  originalPrice: parseFloat(String(historyRow.originalPrice)),
                  finalPrice,
                  nayaxTransactionId: payload.transactionId,
                });
              }
            }
            // Clean up the checkout session metadata
            await adminDb.collection('checkout_sessions').doc(String(washHistoryId)).delete();
          } catch (ledgerErr: any) {
            logger.warn('[CheckoutWebhook] Loyalty ledger write failed (non-blocking)', { error: ledgerErr.message });
          }
        });

        logger.info('[CheckoutWebhook] ✅ Wash balance awarded', {
          userId, washHistoryId, washCount, finalPrice, transactionId: payload.transactionId,
        });

        return res.status(200).json({ received: true, washesAwarded: washCount });

      } else if (payload.event === 'payment.failed' || payload.event === 'payment.expired' || payload.event === 'payment.cancelled') {
        // Mark the pending record as cancelled — no balance awarded.
        await db
          .update(washHistoryTable)
          .set({ status: 'cancelled' })
          .where(eq(washHistoryTable.id, washHistoryId));

        logger.info('[CheckoutWebhook] Payment failed/cancelled — wash history cancelled', {
          washHistoryId, event: payload.event,
        });

        return res.status(200).json({ received: true, note: `checkout_${payload.event}` });
      }

      return res.status(200).json({ received: true, note: 'unhandled_event', event: payload.event });

    } catch (error: any) {
      logger.error('[CheckoutWebhook] Unhandled error', { error: error.message });
      return res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// ═══════════════════════════════════════════════════════════════════════════════
// POST /api/webhooks/nayax/booking-request-payment
//
// Confirms a marketplace booking payment initiated via
// POST /api/booking-requests/:id/pay.
// That route creates a Nayax session and sets booking status = 'payment_pending'.
// This webhook fires when payment is confirmed and transitions the booking to
// 'confirmed', creating the Firestore escrow record with the real transaction ID.
// ═══════════════════════════════════════════════════════════════════════════════
router.post(
  '/nayax/booking-request-payment',
  validateIPAllowlist,
  captureRawBody,
  async (req: express.Request & { rawBody?: Buffer }, res: express.Response) => {
    try {
      const rawBodyBuffer: Buffer = Buffer.isBuffer(req.body)
        ? req.body
        : Buffer.from(JSON.stringify(req.body));
      const rawBody = rawBodyBuffer.toString('utf8');

      let parsedBody: any;
      try {
        parsedBody = JSON.parse(rawBody);
      } catch {
        return res.status(400).json({ error: 'Invalid JSON body' });
      }

      // Signature check — FAIL-CLOSED (2026-07-08), matching /nayax/payment. This
      // webhook flips a booking to 'confirmed' (a paid state), so an unsigned
      // request must never be accepted. No secret → 503; no signature → 401;
      // bad signature → 401 (was fail-open when NAYAX_WEBHOOK_SECRET was unset).
      const signature = req.headers['x-nayax-signature'] as string | undefined;
      if (!NayaxOnlinePaymentService.isSignatureEnforced()) {
        logger.error('[BookingReqWebhook] NAYAX_WEBHOOK_SECRET not configured — rejecting (fail-closed)');
        return res.status(503).json({ error: 'Webhook signature verification not configured' });
      }
      if (!signature) {
        logger.warn('[BookingReqWebhook] Missing required signature header');
        return res.status(401).json({ error: 'X-Nayax-Signature header is required' });
      }
      if (!NayaxOnlinePaymentService.verifyWebhookSignature(rawBody, signature)) {
        logger.warn('[BookingReqWebhook] Invalid signature');
        return res.status(401).json({ error: 'Invalid signature' });
      }

      const payload = parsedBody as {
        event: string;
        bookingId: string;     // booking_requests.requestId (nanoid)
        transactionId: string;
        amountCents: number;
        currency: string;
        sessionId?: string;
        timestamp: string;
      };

      if (!payload.bookingId || !payload.transactionId || !payload.event) {
        return res.status(400).json({ error: 'Missing required fields' });
      }

      // Deduplicate
      const dedupKey = `br-webhook:${payload.transactionId}`;
      try {
        const alreadyProcessed = await redis.get(dedupKey);
        if (alreadyProcessed) {
          logger.info('[BookingReqWebhook] Duplicate — already processed', { transactionId: payload.transactionId });
          return res.status(200).json({ received: true, note: 'already_processed' });
        }
        await redis.setEx(dedupKey, WEBHOOK_DEDUP_TTL_SECONDS, '1');
      } catch (redisErr: any) {
        logger.warn('[BookingReqWebhook] Redis dedup unavailable', { error: redisErr.message });
      }

      const { bookingRequests: bookingRequestsTable } = await import('@shared/schema');

      const [booking] = await db
        .select()
        .from(bookingRequestsTable)
        .where(eq(bookingRequestsTable.requestId, payload.bookingId))
        .limit(1);

      if (!booking) {
        logger.error('[BookingReqWebhook] Booking not found', { bookingId: payload.bookingId });
        return res.status(404).json({ error: 'Booking not found' });
      }

      // Idempotency: already confirmed
      if (booking.status === 'confirmed' || booking.status === 'in_progress') {
        logger.info('[BookingReqWebhook] Booking already confirmed — idempotent', { bookingId: payload.bookingId });
        return res.status(200).json({ received: true, note: 'already_confirmed' });
      }

      if (payload.event === 'payment.success') {
        // ── Status gate (audit 2026-06-24 finding #6) ──────────────────────────
        // Only confirm a booking that is actually AWAITING payment. Without this,
        // a late/stale Nayax webhook (e.g. a 72h retry) could REVIVE a cancelled/
        // declined/refunded booking back to 'confirmed' with escrow held →
        // double-charge. ('confirmed'/'in_progress' already short-circuited above
        // via the idempotency check.) The sibling /nayax/payment webhook enforces
        // the same gate; mirror it here.
        if (booking.status !== 'payment_pending') {
          logger.warn('[BookingReqWebhook] Status gate: booking not in payment_pending — ignoring payment.success', {
            bookingId: payload.bookingId, currentStatus: booking.status,
          });
          return res.status(200).json({ received: true, note: 'status_gate_blocked', currentStatus: booking.status });
        }

        // Amount validation (1-agora tolerance)
        const bookingTotalCents = booking.totalCents;
        if (Math.abs(payload.amountCents - bookingTotalCents) > 1) {
          logger.error('[BookingReqWebhook] Amount mismatch — POTENTIAL FRAUD', {
            bookingId: payload.bookingId, expected: bookingTotalCents, received: payload.amountCents,
          });
          return res.status(400).json({ error: 'Amount mismatch', expected: bookingTotalCents, received: payload.amountCents });
        }

        // ── Deal Gate (2026-07-01): do not fake a booking confirmation ────────
        // Money has just cleared, but this is the canonical provider-marketplace
        // path (booking-requests.ts records BOTH sides into deal_acceptances:
        // provider on /accept, customer on /pay) — so canConfirmBooking() has
        // real evidence to check here, unlike UnifiedBookingEngine which never
        // populates that table (see docs/architecture RESET RFC decision:
        // booking-requests.ts is the canonical provider booking path).
        // If a payment somehow arrived without proper provider/customer
        // acceptance on record, we hold the money (already escrowed) but do
        // NOT flip status to 'confirmed' and do NOT tell the customer/provider
        // "confirmed" — that would be exactly the fake confirmation the CEO's
        // spec forbids. A human reviews via the admin alert instead.
        const dealGate = await canConfirmBooking(payload.bookingId);
        if (!dealGate.can_confirm) {
          logger.error('[BookingReqWebhook] Deal Gate blocked — payment received but booking not confirmable', {
            bookingId: payload.bookingId,
            transactionId: payload.transactionId,
            missing: dealGate.missing_requirements,
          });
          await createOrUpdateAlert({
            dedupeKey: `deal_gate_payment_blocked:${payload.bookingId}`,
            category: 'payment',
            severity: 'critical',
            title: 'Payment received but Deal Gate blocked booking confirmation',
            message: `Booking ${payload.bookingId}: Nayax payment ${payload.transactionId} succeeded but canConfirmBooking() reports missing: ${dealGate.missing_requirements.join(', ')}. Money is held in escrow, not lost — but the booking was NOT auto-confirmed. Needs manual review.`,
            linkedEntityType: 'booking',
            linkedEntityId: payload.bookingId,
            source: 'nayax_booking_request_payment_webhook',
          });
          // 200, not 4xx/5xx: we successfully RECEIVED and recorded the payment
          // event (escrow already holds the money); Nayax must not retry this.
          // The block is a data/process problem for a human, not a delivery failure.
          return res.status(200).json({
            received: true,
            note: 'deal_gate_blocked',
            missingRequirements: dealGate.missing_requirements,
          });
        }

        // Update the Firestore escrow document that was created during /pay.
        // Replace the placeholder sessionId with the real Nayax transactionId.
        // Uses getEscrowsByBooking so the escrow ID doesn't need to be stored separately.
        const EscrowService = (await import('../services/EscrowService')).default;
        try {
          const escrows = await EscrowService.getEscrowsByBooking(payload.bookingId);
          for (const escrow of escrows) {
            // Update the nayaxTransactionId on the Firestore doc with the real txId
            const { db: adminDb } = await import('../lib/firebase-admin');
            await adminDb.collection('escrow_payments').doc(escrow.id).update({
              nayaxTransactionId: payload.transactionId,
              status: 'held',
              updatedAt: new Date(),
            });
          }
        } catch (escrowErr: any) {
          logger.warn('[BookingReqWebhook] Escrow txId update failed (non-blocking)', { error: escrowErr.message });
        }

        const statusHistory = ((booking.statusHistory as any[]) ?? []);
        statusHistory.push({
          status: 'confirmed',
          timestamp: new Date().toISOString(),
          note: `Payment of ₪${(bookingTotalCents / 100).toFixed(2)} confirmed by Nayax. Held in 72-hour escrow. txId: ${payload.transactionId}`,
        });

        // Atomic DB write: confirmed + real transaction ID
        await db
          .update(bookingRequestsTable)
          .set({
            status: 'confirmed',
            paymentTransactionId: payload.transactionId,
            paymentHeldAt: new Date(),
            statusHistory,
            updatedAt: new Date(),
          } as any)
          .where(eq(bookingRequestsTable.requestId, payload.bookingId));

        logger.info('[BookingReqWebhook] ✅ Booking confirmed via real Nayax payment', {
          bookingId: payload.bookingId,
          transactionId: payload.transactionId,
          amountCents: payload.amountCents,
        });

        // ── Legacy mirror write-back (2026-07-30): bridged sitter/walk/academy
        // rows flip to 'confirmed' ONLY here — after verified payment. The
        // provider's accept writes 'accepted'; this is the money truth point.
        try {
          const { applyBridgePaymentConfirmed } = await import('../services/legacyBookingBridge');
          await applyBridgePaymentConfirmed((booking as any).quoteBreakdown);
        } catch (bridgeErr: any) {
          logger.warn('[BookingReqWebhook] legacy confirm write-back failed (non-blocking)', { error: bridgeErr?.message });
        }

        // ── Customer + provider confirmation notification (2026-07-01) ────────
        // This webhook is the ONLY place a booking-requests.ts booking flips
        // payment_pending -> confirmed, and until now nothing here told the
        // customer or provider that happened (the SMS/email code elsewhere in
        // booking-requests.ts belongs to /complete — service completion — not
        // payment confirmation). Fire-and-forget: must never delay or fail the
        // webhook's 200 response or roll back the just-committed status update.
        setImmediate(async () => {
          try {
            const [owner] = await db.select().from(users).where(eq(users.id, booking.ownerId)).limit(1);
            const [provider] = await db.select().from(users).where(eq(users.id, booking.providerId)).limit(1);

            const SERVICE_NAMES: Record<string, { he: string; en: string }> = {
              sitter: { he: 'שמרטפות', en: 'Pet Sitting' },
              walker: { he: 'הליכה עם הכלב', en: 'Dog Walking' },
              trainer: { he: 'אקדמיית PetWash', en: 'PetWash Academy' },
              driver: { he: 'הסעת חיות מחמד', en: 'Pet Transport' },
            };
            const serviceName = SERVICE_NAMES[booking.providerType]?.he
              ? SERVICE_NAMES[booking.providerType]
              : { he: booking.serviceType, en: booking.serviceType };

            const petName = (Array.isArray(booking.petDetails) && (booking.petDetails as any[])[0]?.name)
              ? String((booking.petDetails as any[])[0].name)
              : (owner?.language === 'en' ? 'your pet' : 'חיית המחמד שלך');
            const providerDisplayName = provider?.firstName || (owner?.language === 'en' ? 'your provider' : 'הספק');
            const isHe = (owner?.language ?? 'he') !== 'en';
            const dateFmt = (d: Date | null) => d ? new Date(d).toLocaleDateString(isHe ? 'he-IL' : 'en-GB', { timeZone: 'Asia/Jerusalem' }) : '';

            const subject = isHe
              ? `ההזמנה שלך ב-PetWash אושרה ✨ מס׳ ${payload.bookingId}`
              : `Your PetWash booking is confirmed ✨ Ref: ${payload.bookingId}`;

            const emailHtml = `<!DOCTYPE html><html lang="${isHe ? 'he' : 'en'}" dir="${isHe ? 'rtl' : 'ltr'}"><body style="font-family:Arial;padding:24px;color:#111;background:#fff;">
<h1 style="font-size:20px;margin-bottom:4px;">PetWash™</h1>
<p style="color:#555;margin-top:0;">${isHe ? 'הטיפול בחיית המחמד שלך אושר' : 'Your pet’s care is confirmed'}</p>
<p>${isHe ? `שלום ${owner?.firstName ?? ''},` : `Hi ${owner?.firstName ?? ''},`}</p>
<p>${isHe
    ? `התשלום התקבל וההזמנה שלך עם ${providerDisplayName} אושרה.`
    : `Your payment has been received and your PetWash booking with ${providerDisplayName} is now confirmed.`}</p>
<table style="width:100%;border-collapse:collapse;font-size:14px;margin:16px 0;">
  <tr><td style="padding:6px 0;color:#666;">${isHe ? 'מס׳ הזמנה' : 'Booking Ref'}</td><td style="padding:6px 0;font-weight:bold;">${payload.bookingId}</td></tr>
  <tr><td style="padding:6px 0;color:#666;">${isHe ? 'שירות' : 'Service'}</td><td style="padding:6px 0;">${isHe ? serviceName.he : serviceName.en}</td></tr>
  <tr><td style="padding:6px 0;color:#666;">${isHe ? 'חיית מחמד' : 'Pet'}</td><td style="padding:6px 0;">${petName}</td></tr>
  <tr><td style="padding:6px 0;color:#666;">${isHe ? 'תאריך התחלה' : 'Start date'}</td><td style="padding:6px 0;">${dateFmt(booking.startDate)}</td></tr>
  <tr><td style="padding:6px 0;color:#666;">${isHe ? 'תאריך סיום' : 'End date'}</td><td style="padding:6px 0;">${dateFmt(booking.endDate)}</td></tr>
  <tr><td style="padding:6px 0;color:#666;">${isHe ? 'ספק' : 'Provider'}</td><td style="padding:6px 0;">${providerDisplayName}</td></tr>
</table>
<p style="font-size:13px;color:#666;">${isHe
    ? 'לביטחון כולם, נא לשמור על כל ההודעות, השיחות והתשלומים בתוך PetWash.'
    : 'For everyone’s safety, keep all messages, calls, updates and payments inside PetWash.'}</p>
<p style="margin-top:20px;"><a href="https://petwash.co.il/me" style="background:#000;color:#fff;padding:10px 20px;border-radius:8px;text-decoration:none;display:inline-block;">${isHe ? 'השלמת פרטי טיפול' : 'Complete Care Notes'}</a></p>
<p style="font-size:12px;color:#888;margin-top:20px;">${isHe
    ? 'התשלום שלך נרשם בבטחה ב-PetWash. תשלום הספק לא משתלם באופן מיידי — היתרה מוחזקת בהתאם לכללי PetWash ומשולמת רק לאחר השלמת השירות, בכפוף לביטולים, מחלוקות, החזרים, תקריות ומדיניות הפלטפורמה.'
    : 'Your payment is safely recorded by PetWash. Provider payout is not released immediately. The provider balance is held according to PetWash rules and released only after the service is completed, subject to cancellations, disputes, refunds, incidents and platform policy.'}</p>
<p style="font-size:12px;color:#888;">${isHe ? 'צריך עזרה?' : 'Need help?'} support@petwash.co.il · +972549833355</p>
<p style="font-size:11px;color:#aaa;margin-top:16px;">PetWash Ltd — PetWash.co.il</p>
</body></html>`;

            if (owner?.email || owner?.phone) {
              await dispatchNotifications({
                userId: booking.ownerId,
                eventType: 'booking_confirmed',
                templateKey: 'booking_requests.payment_confirmed',
                channels: [owner?.email ? 'email' : null, owner?.phone ? 'sms' : null, 'push'].filter((c): c is 'email' | 'sms' | 'push' => !!c),
                bookingId: payload.bookingId,
                transactionId: payload.transactionId,
                idempotencyKey: `booking_payment_confirmed:${payload.bookingId}:customer`,
                email: owner?.email ? { to: owner.email, subject, html: emailHtml } : undefined,
                sms: owner?.phone ? {
                  to: owner.phone,
                  text: isHe
                    ? `PetWash: ההזמנה שלך ל${petName} אושרה. מס׳ ${payload.bookingId}. נא להשלים פרטי טיפול, מסירה/איסוף ואיש קשר לחירום באפליקציה.`
                    : `PetWash: your booking for ${petName} is confirmed. Ref ${payload.bookingId}. Please finalise care notes, pickup/drop-off and emergency details in the app.`,
                } : undefined,
                push: {
                  userId: booking.ownerId,
                  title: isHe ? 'ההזמנה שלך אושרה ✨' : 'Booking confirmed ✨',
                  body: isHe ? `ההזמנה שלך ל${petName} אושרה.` : `Your PetWash booking is confirmed for ${petName}.`,
                  data: { type: 'booking_confirmed', bookingId: payload.bookingId },
                },
              });
            }

            // No email/phone gate (2026-07-30): this sends PUSH only, which
            // needs neither — the old guard silently skipped providers whose
            // users row lacked contact fields.
            {
              await dispatchNotifications({
                userId: booking.providerId,
                eventType: 'booking_confirmed',
                templateKey: 'booking_requests.payment_confirmed_provider',
                channels: ['push'],
                bookingId: payload.bookingId,
                transactionId: payload.transactionId,
                idempotencyKey: `booking_payment_confirmed:${payload.bookingId}:provider`,
                push: {
                  userId: booking.providerId,
                  title: 'Booking confirmed',
                  body: `Payment received by PetWash for booking ${payload.bookingId}. Your payout will become available after the booking is completed according to PetWash payout rules.`,
                  data: { type: 'booking_confirmed', bookingId: payload.bookingId },
                },
              });
            }
          } catch (notifyErr: any) {
            logger.error('[BookingReqWebhook] Confirmation notification failed (non-fatal)', {
              bookingId: payload.bookingId, error: notifyErr?.message,
            });
          }
        });

        // ── Calendar sync AFTER payment truth (non-blocking, idempotent) ──────
        // The booking is now paid + confirmed, so this is the correct point to
        // create the Google Calendar event (moved here from provider-accept).
        // Runs after the 200 response via setImmediate so a slow/failed calendar
        // call never delays or rolls back the payment confirmation. The
        // already-confirmed early-return above + createBookingEvent's own
        // petwash_booking_id lookup make webhook redelivery idempotent.
        setImmediate(async () => {
          try {
            const { calendarIntegrationService } = await import('../services/CalendarIntegrationService');
            const { bookingRequests: bookingRequestsTbl, users: usersTbl } = await import('@shared/schema');

            const eventStart = booking.meetGreetDate ?? booking.startDate;
            const eventEnd = booking.endDate ?? new Date(new Date(eventStart).getTime() + 60 * 60 * 1000);

            let ownerEmail: string | undefined;
            let providerEmail: string | undefined;
            try {
              const [owner] = await db.select({ email: usersTbl.email })
                .from(usersTbl).where(eq(usersTbl.id, booking.ownerId)).limit(1);
              ownerEmail = owner?.email ?? undefined;
              const [prov] = await db.select({ email: usersTbl.email })
                .from(usersTbl).where(eq(usersTbl.id, booking.providerId)).limit(1);
              providerEmail = prov?.email ?? undefined;
            } catch { /* non-fatal — event still creates without invites */ }
            const attendeeEmails = [ownerEmail, providerEmail].filter((e): e is string => !!e);

            const result = await calendarIntegrationService.createBookingEvent({
              platform: booking.providerType || booking.serviceType || 'PetWash',
              bookingId: payload.bookingId,
              title: `PetWash™ — ${booking.serviceType || 'Booking'}`,
              description: booking.ownerMessage || `Booking ${payload.bookingId}`,
              startTime: new Date(eventStart),
              endTime: new Date(eventEnd),
              location: booking.meetGreetLocation || undefined,
              customerName: booking.ownerId,
              providerName: booking.providerId,
              attendeeEmails,
            });

            if (result?.eventId) {
              await db.update(bookingRequestsTbl)
                .set({
                  platformCalendarEventId: result.eventId,
                  calendarAttendeesSynced: attendeeEmails.length > 0,
                  updatedAt: new Date(),
                })
                .where(eq(bookingRequestsTbl.requestId, payload.bookingId));
              logger.info('[BookingReqWebhook] Calendar event linked after payment', {
                bookingId: payload.bookingId, eventId: result.eventId, attendees: attendeeEmails.length,
              });
            }
          } catch (calErr: any) {
            logger.warn('[BookingReqWebhook] Calendar create failed (non-blocking)', {
              bookingId: payload.bookingId, error: calErr?.message,
            });
          }
        });

        return res.status(200).json({ received: true, bookingId: payload.bookingId, status: 'confirmed' });

      } else if (payload.event === 'payment.failed' || payload.event === 'payment.expired' || payload.event === 'payment.cancelled') {
        // Revert to the pre-payment status so the customer can retry.
        // The booking_request was in 'payment_pending'; roll back to 'meet_greet_completed'
        // or 'accepted' depending on where it was before.
        const revertStatus = 'meet_greet_completed';

        const statusHistory = ((booking.statusHistory as any[]) ?? []);
        statusHistory.push({
          status: revertStatus,
          timestamp: new Date().toISOString(),
          note: `Payment ${payload.event} — booking reverted to ${revertStatus} for retry. txId: ${payload.transactionId}`,
        });

        await db
          .update(bookingRequestsTable)
          .set({
            status: revertStatus as any,
            statusHistory,
            updatedAt: new Date(),
          } as any)
          .where(eq(bookingRequestsTable.requestId, payload.bookingId));

        // Release the escrow that was created at /pay (not actually held until success,
        // but clean up the Firestore doc to prevent stale records).
        try {
          const EscrowService = (await import('../services/EscrowService')).default;
          const escrows = await EscrowService.getEscrowsByBooking(payload.bookingId);
          for (const escrow of escrows) {
            const { db: adminDb } = await import('../lib/firebase-admin');
            await adminDb.collection('escrow_payments').doc(escrow.id).update({
              status: 'refunded',
              reason: `Payment ${payload.event}`,
              updatedAt: new Date(),
            });
          }
        } catch (escrowErr: any) {
          logger.warn('[BookingReqWebhook] Escrow cleanup failed (non-blocking)', { error: escrowErr.message });
        }

        logger.info('[BookingReqWebhook] Payment failed — booking reverted', {
          bookingId: payload.bookingId, event: payload.event,
        });

        return res.status(200).json({ received: true, note: `payment_${payload.event}`, bookingId: payload.bookingId });
      }

      return res.status(200).json({ received: true, note: 'unhandled_event', event: payload.event });

    } catch (error: any) {
      logger.error('[BookingReqWebhook] Unhandled error', { error: error.message });
      return res.status(500).json({ error: 'Internal server error' });
    }
  }
);

export default router;
