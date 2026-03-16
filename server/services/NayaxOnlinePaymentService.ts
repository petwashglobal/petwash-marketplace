/**
 * Nayax Online Payment Service
 * Hosted payment page (payment link) for marketplace bookings.
 *
 * Covers:
 *  - Walk My Pet™ bookings
 *  - Sitter Suite™ bookings
 *  - Grooming Marketplace bookings
 *
 * Flow:
 *  1. createPaymentSession()  → returns a hosted Nayax payment URL
 *  2. Customer pays on Nayax page (credit card, Apple Pay, etc.)
 *  3. Nayax sends webhook to POST /api/webhooks/nayax/payment
 *  4. verifyWebhookSignature() validates the payload
 *  5. Booking status updated to PAID / PROVIDER_CONFIRMED
 *
 * When NAYAX_API_KEY + NAYAX_MERCHANT_ID are absent the service runs in
 * DEMO MODE and returns a local demo checkout URL so development flows
 * are never blocked.
 *
 * Required env vars for production:
 *   NAYAX_API_KEY          — merchant API key
 *   NAYAX_MERCHANT_ID      — merchant account ID
 *   NAYAX_ONLINE_API_URL   — (optional) override, default https://api.nayax.com/online-payment/v1
 *   NAYAX_WEBHOOK_SECRET   — (optional) HMAC secret for webhook verification
 *   APP_URL                — public base URL (e.g. https://petwash.co.il)
 */

import crypto from 'crypto';
import { logger } from '../lib/logger';

const NAYAX_ONLINE_API_URL =
  process.env.NAYAX_ONLINE_API_URL || 'https://api.nayax.com/online-payment/v1';
const NAYAX_API_KEY = process.env.NAYAX_API_KEY;
const NAYAX_MERCHANT_ID = process.env.NAYAX_MERCHANT_ID;
const NAYAX_WEBHOOK_SECRET = process.env.NAYAX_WEBHOOK_SECRET;
const APP_URL = process.env.APP_URL || 'https://petwash.co.il';

const DEMO_MODE = !NAYAX_API_KEY || !NAYAX_MERCHANT_ID;

if (DEMO_MODE) {
  logger.warn(
    '[NayaxOnline] DEMO MODE — set NAYAX_API_KEY + NAYAX_MERCHANT_ID to enable real payments'
  );
} else {
  logger.info('[NayaxOnline] Production mode — Nayax online payment configured', {
    merchantId: NAYAX_MERCHANT_ID,
    apiUrl: NAYAX_ONLINE_API_URL,
  });
}

export interface NayaxPaymentSessionParams {
  bookingId: string;
  bookingNumber: string;
  amountCents: number;
  currency?: string;
  customerEmail?: string;
  customerName?: string;
  description: string;
  returnUrl?: string;
  cancelUrl?: string;
}

export interface NayaxPaymentSessionResult {
  success: boolean;
  sessionId?: string;
  paymentUrl: string;
  expiresAt?: Date;
  demoMode: boolean;
  error?: string;
}

export interface NayaxWebhookPayload {
  event: 'payment.success' | 'payment.failed' | 'payment.pending';
  sessionId: string;
  bookingId: string;
  transactionId: string;
  amountCents: number;
  currency: string;
  timestamp: string;
  signature?: string;
}

export class NayaxOnlinePaymentService {

  static isDemoMode(): boolean {
    return DEMO_MODE;
  }

  /**
   * Create a hosted payment session.
   * Returns the payment URL to redirect the customer to.
   */
  static async createPaymentSession(
    params: NayaxPaymentSessionParams
  ): Promise<NayaxPaymentSessionResult> {
    if (DEMO_MODE) {
      return this.createDemoSession(params);
    }

    try {
      const returnUrl =
        params.returnUrl || `${APP_URL}/bookings/${params.bookingId}/success`;
      const cancelUrl =
        params.cancelUrl || `${APP_URL}/bookings/${params.bookingId}/cancel`;

      const requestBody = {
        merchant_id: NAYAX_MERCHANT_ID,
        amount: params.amountCents,
        currency: params.currency || 'ILS',
        order_id: params.bookingId,
        order_reference: params.bookingNumber,
        description: params.description,
        customer_email: params.customerEmail,
        customer_name: params.customerName,
        success_url: returnUrl,
        cancel_url: cancelUrl,
        webhook_url: `${APP_URL}/api/webhooks/nayax/payment`,
        language: 'he',
        metadata: {
          booking_id: params.bookingId,
          booking_number: params.bookingNumber,
          source: 'petwash_marketplace',
        },
      };

      logger.info('[NayaxOnline] Creating payment session', {
        bookingId: params.bookingId,
        amountCents: params.amountCents,
      });

      const response = await fetch(`${NAYAX_ONLINE_API_URL}/sessions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${NAYAX_API_KEY}`,
          'X-Merchant-Id': NAYAX_MERCHANT_ID!,
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorText = await response.text();
        logger.error('[NayaxOnline] Payment session creation failed', {
          status: response.status,
          body: errorText,
          bookingId: params.bookingId,
        });
        return {
          success: false,
          paymentUrl: '',
          demoMode: false,
          error: `Nayax API error ${response.status}: ${errorText}`,
        };
      }

      const data = await response.json() as any;

      const sessionId = data.session_id || data.id;
      const paymentUrl = data.payment_url || data.checkout_url || data.url;

      if (!paymentUrl) {
        logger.error('[NayaxOnline] No payment URL in response', {
          bookingId: params.bookingId,
          response: data,
        });
        return {
          success: false,
          paymentUrl: '',
          demoMode: false,
          error: 'Nayax response did not include a payment URL',
        };
      }

      logger.info('[NayaxOnline] Payment session created', {
        bookingId: params.bookingId,
        sessionId,
      });

      return {
        success: true,
        sessionId,
        paymentUrl,
        expiresAt: data.expires_at ? new Date(data.expires_at) : undefined,
        demoMode: false,
      };

    } catch (error: any) {
      logger.error('[NayaxOnline] Unexpected error creating payment session', {
        bookingId: params.bookingId,
        error: error.message,
      });
      return {
        success: false,
        paymentUrl: '',
        demoMode: false,
        error: error.message,
      };
    }
  }

  /**
   * Demo session — returns a local URL that shows a demo payment page.
   * Booking is treated as paid immediately in demo flows.
   */
  private static createDemoSession(
    params: NayaxPaymentSessionParams
  ): NayaxPaymentSessionResult {
    const demoUrl = `${APP_URL}/payment/demo/${params.bookingId}?amount=${params.amountCents}&ref=${params.bookingNumber}`;

    logger.info('[NayaxOnline] Demo payment session created', {
      bookingId: params.bookingId,
      amountCents: params.amountCents,
    });

    return {
      success: true,
      sessionId: `demo_${params.bookingId}`,
      paymentUrl: demoUrl,
      demoMode: true,
    };
  }

  /**
   * Verify that an incoming webhook request came from Nayax.
   * Uses HMAC-SHA256 over the raw request body.
   *
   * Returns true if signature is valid or if no webhook secret is configured
   * (so demo / test environments pass without breaking).
   */
  static verifyWebhookSignature(rawBody: string, signature: string): boolean {
    if (!NAYAX_WEBHOOK_SECRET) {
      logger.warn('[NayaxOnline] NAYAX_WEBHOOK_SECRET not set — skipping signature verification (set in production)');
      return true;
    }

    try {
      const expected = crypto
        .createHmac('sha256', NAYAX_WEBHOOK_SECRET)
        .update(rawBody)
        .digest('hex');

      const signatureBuffer = Buffer.from(signature, 'hex');
      const expectedBuffer = Buffer.from(expected, 'hex');

      if (signatureBuffer.length !== expectedBuffer.length) return false;
      return crypto.timingSafeEqual(signatureBuffer, expectedBuffer);
    } catch {
      return false;
    }
  }
}
