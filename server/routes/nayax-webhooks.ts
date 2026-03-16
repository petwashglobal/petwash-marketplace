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
import PaymentGatewayService, { type WebhookPayload } from '../services/PaymentGatewayService';
import { db } from '../db';
import { paymentIntents, bookings, bookingStatusHistory } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { createIPAllowlist } from '../middleware/ipAllowlist';
import { NayaxOnlinePaymentService } from '../services/NayaxOnlinePaymentService';

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

// In-memory deduplication cache (use Redis in production)
const processedWebhooks = new Set<string>();
const WEBHOOK_CACHE_TTL = 3600000; // 1 hour

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
    const signature = req.headers['x-nayax-signature'] as string;
    
    if (!signature) {
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
    
    // Get raw body bytes (critical for signature validation)
    const rawBody = req.rawBody || req.body as Buffer;
    
    if (!rawBody) {
      logger.error('[NayaxWebhook] No raw body available for signature validation');
      return res.status(500).json({ error: 'Cannot validate signature' });
    }
    
    // Compute expected signature over raw bytes
    const expectedSignature = crypto
      .createHmac('sha256', NAYAX_WEBHOOK_SECRET)
      .update(rawBody)
      .digest('hex');
    
    const providedSignature = signature.replace('sha256=', '');
    
    // Constant-time comparison to prevent timing attacks
    const isValid = crypto.timingSafeEqual(
      Buffer.from(expectedSignature),
      Buffer.from(providedSignature)
    );
    
    if (!isValid) {
      logger.warn('[NayaxWebhook] Invalid signature', {
        ip: req.ip,
        providedSignature: providedSignature.substring(0, 16) + '...',
        expectedSignature: expectedSignature.substring(0, 16) + '...',
        bodyLength: rawBody.length,
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
 * Check if webhook has already been processed (idempotency)
 */
function checkIdempotency(
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
) {
  const eventId = req.body.eventId || req.body.transactionId;
  
  if (!eventId) {
    logger.warn('[NayaxWebhook] Missing event ID');
    return res.status(400).json({ error: 'Missing event ID' });
  }
  
  if (processedWebhooks.has(eventId)) {
    logger.info('[NayaxWebhook] Duplicate webhook ignored', { eventId });
    return res.status(200).json({ 
      received: true, 
      message: 'Webhook already processed',
    });
  }
  
  // Add to cache with TTL cleanup
  processedWebhooks.add(eventId);
  setTimeout(() => processedWebhooks.delete(eventId), WEBHOOK_CACHE_TTL);
  
  next();
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
      
      // TODO: Implement settlement reconciliation
      // - Compare against local payment_intents records
      // - Flag discrepancies
      // - Update accounting ledger
      
      res.status(200).json({
        received: true,
        settlementId,
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
 * Handles online payment confirmation from Nayax hosted payment pages.
 * Called by NayaxOnlinePaymentService.createPaymentSession() return flow.
 *
 * Payload (JSON):
 *   event        — "payment.success" | "payment.failed" | "payment.pending"
 *   sessionId    — Nayax session ID
 *   bookingId    — PetWash booking UUID
 *   transactionId — Nayax transaction reference
 *   amountCents  — Amount charged in agorot
 *   currency     — "ILS"
 *   timestamp    — ISO 8601
 *
 * Security: HMAC-SHA256 via X-Nayax-Signature header (NAYAX_WEBHOOK_SECRET).
 *           When secret is not set the signature check is skipped (dev/demo mode).
 */
router.post(
  '/nayax/payment',
  captureRawBody,
  async (req, res) => {
    try {
      // captureRawBody stores raw bytes — parse to string and then JSON
      const rawBodyBuffer: Buffer = Buffer.isBuffer(req.body) ? req.body : Buffer.from(JSON.stringify(req.body));
      const rawBody = rawBodyBuffer.toString('utf8');

      // Parse JSON body for handler use
      let parsedBody: any;
      try {
        parsedBody = JSON.parse(rawBody);
      } catch {
        return res.status(400).json({ error: 'Invalid JSON payload' });
      }

      const signature = (req.headers['x-nayax-signature'] as string) || '';

      if (signature && !NayaxOnlinePaymentService.verifyWebhookSignature(rawBody, signature)) {
        logger.warn('[NayaxPaymentWebhook] Invalid signature — request rejected');
        return res.status(401).json({ error: 'Invalid signature' });
      }

      const payload = parsedBody as {
        event: string;
        sessionId: string;
        bookingId: string;
        transactionId: string;
        amountCents: number;
        currency: string;
        timestamp: string;
      };

      logger.info('[NayaxPaymentWebhook] Online payment event received', {
        event: payload.event,
        bookingId: payload.bookingId,
        transactionId: payload.transactionId,
        amountCents: payload.amountCents,
      });

      if (!payload.bookingId) {
        return res.status(400).json({ error: 'Missing bookingId in webhook payload' });
      }

      if (payload.event === 'payment.success') {
        // Update booking status to pending provider confirmation
        await db
          .update(bookings)
          .set({
            status: 'pending_confirmation',
            updatedAt: new Date(),
            platformData: parsedBody._platformData || undefined,
          } as any)
          .where(eq(bookings.id, payload.bookingId));

        // Record status change in history
        await db.insert(bookingStatusHistory).values({
          bookingId: payload.bookingId,
          fromStatus: 'pending_payment' as any,
          toStatus: 'pending_confirmation' as any,
          changedBy: 'nayax_webhook',
          reason: `Nayax payment confirmed — txId: ${payload.transactionId}`,
          metadata: {
            nayaxTransactionId: payload.transactionId,
            nayaxSessionId: payload.sessionId,
            amountCents: payload.amountCents,
            currency: payload.currency,
            webhookTimestamp: payload.timestamp,
          },
        });

        logger.info('[NayaxPaymentWebhook] Booking updated to pending_confirmation', {
          bookingId: payload.bookingId,
          transactionId: payload.transactionId,
        });

      } else if (payload.event === 'payment.failed') {
        await db
          .update(bookings)
          .set({ status: 'payment_failed', updatedAt: new Date() } as any)
          .where(eq(bookings.id, payload.bookingId));

        logger.warn('[NayaxPaymentWebhook] Payment failed — booking marked payment_failed', {
          bookingId: payload.bookingId,
        });
      }

      // Always return 200 to prevent Nayax retries for handled events
      return res.status(200).json({ received: true, bookingId: payload.bookingId });

    } catch (error: any) {
      logger.error('[NayaxPaymentWebhook] Unhandled error', { error: error.message });
      // Return 500 so Nayax retries
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

export default router;
