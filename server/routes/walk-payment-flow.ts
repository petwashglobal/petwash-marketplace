/**
 * EMERGENCY WALK PAYMENT FLOW (UBER-STYLE)
 * Pay first → Create booking (eliminates no-shows)
 *
 * Flow:
 * 1. Create 10-minute slot hold (handled in walk-my-pet.ts)
 * 2. Redirect to Nayax payment
 * 3. Webhook confirms payment → creates booking
 * 4. Return URL shows confirmation
 */

import { Router } from 'express';
import crypto from 'crypto';
import { logger } from '../lib/logger';
import { requireAuth } from '../customAuth';

const router = Router();

const IS_PRODUCTION = process.env.NODE_ENV === 'production';

function htmlEncode(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// =================== PAYMENT SESSION ===================

/**
 * POST /payments/nayax/walk-session - Start Nayax payment for walk
 * Mount: /api → effective path: /api/payments/nayax/walk-session
 */
router.post('/payments/nayax/walk-session', requireAuth, async (req, res) => {
  try {
    const userId = req.user!.uid;

    const { holdId, amount, service } = req.body;

    if (!holdId || !amount) {
      return res.status(400).json({ error: 'Missing holdId or amount' });
    }

    // Validate holdId format (in-memory holds from walk-my-pet.ts)
    if (!holdId.startsWith('HOLD-')) {
      return res.status(400).json({ error: 'Invalid holdId format' });
    }

    const sessionId = `NAYAX-${crypto.randomUUID()}`;
    const redirectUrl = `/api/payments/nayax/redirect/${sessionId}?holdId=${holdId}&amount=${amount}&service=${service || 'emergency_walk'}`;

    logger.info('[WalkPayment] Payment session created', { sessionId, holdId, amount });

    res.json({
      success: true,
      redirectUrl,
      sessionId,
    });

  } catch (error: any) {
    logger.error('[WalkPayment] Payment session failed', { error: error.message });
    res.status(500).json({ error: 'Failed to create payment session' });
  }
});

/**
 * GET /payments/nayax/redirect/:sessionId - Simulate Nayax payment page
 * Mount: /api → effective path: /api/payments/nayax/redirect/:sessionId
 * DEV ONLY: disabled in production — real Nayax redirects go to the Nayax hosted page
 */
router.get('/payments/nayax/redirect/:sessionId', async (req, res) => {
  if (IS_PRODUCTION) {
    return res.status(404).json({ error: 'Not found' });
  }
  const { sessionId } = req.params;
  const { holdId, amount, service } = req.query;
  const safeSessionId = htmlEncode(String(sessionId));
  const safeService = htmlEncode(String(service || ''));
  const safeHoldId = htmlEncode(String(holdId || ''));

  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Nayax Payment - Pet Wash™</title>
      <style>
        body { font-family: system-ui; max-width: 500px; margin: 100px auto; padding: 20px; }
        .card { border: 1px solid #ddd; border-radius: 12px; padding: 30px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
        h2 { color: #2563eb; }
        button { background: #2563eb; color: white; border: none; padding: 15px 30px; border-radius: 8px; font-size: 16px; cursor: pointer; width: 100%; margin: 5px 0; }
        button:hover { background: #1d4ed8; }
        .cancel { background: #dc2626; }
        .cancel:hover { background: #b91c1c; }
        .amount { font-size: 32px; font-weight: bold; color: #16a34a; margin: 20px 0; }
      </style>
    </head>
    <body>
      <div class="card">
        <h2>Emergency Walk Payment</h2>
        <p><strong>Session:</strong> ${safeSessionId}</p>
        <p><strong>Service:</strong> ${safeService}</p>
        <div class="amount">₪${parseFloat(amount as string || '0').toFixed(2)}</div>
        <p>Secure payment powered by Nayax Israel</p>
        <button onclick="confirmPayment()">Pay Now with Nayax</button>
        <button class="cancel" onclick="cancelPayment()">Cancel Payment</button>
      </div>
      <script>
        function confirmPayment() {
          fetch('/api/payments/nayax/webhook', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              event: 'payment.succeeded',
              sessionId: '${safeSessionId}',
              holdId: '${safeHoldId}',
              amount: ${parseFloat(amount as string || '0')},
              service: '${safeService}',
              paymentId: 'NAYAX-' + Date.now()
            })
          }).then(() => {
            window.location.href = '/walks/confirmed?session=${safeSessionId}';
          });
        }
        function cancelPayment() {
          window.location.href = '/walks/cancelled?holdId=${safeHoldId}';
        }
      </script>
    </body>
    </html>
  `);
});

// =================== WEBHOOK ===================

/**
 * POST /payments/nayax/webhook - Nayax payment webhook
 * Creates booking ONLY after successful payment
 * Mount: /api → effective path: /api/payments/nayax/webhook
 * DEV ONLY: disabled in production — production payments arrive at /api/webhooks/nayax/payment
 */
router.post('/payments/nayax/webhook', async (req, res) => {
  if (IS_PRODUCTION) {
    return res.status(404).json({ error: 'Not found' });
  }
  try {
    const { event, holdId, amount, paymentId } = req.body;

    logger.info('[WalkPayment] Webhook received', { event, holdId, paymentId });

    if (event === 'payment.succeeded') {
      if (!holdId || !holdId.startsWith('HOLD-')) {
        return res.status(400).json({ error: 'Invalid holdId' });
      }

      const { EmergencyWalkService } = await import('../services/EmergencyWalkService');
      const result = await EmergencyWalkService.requestEmergencyWalk({
        ownerId: req.body.userId || 'payment-webhook',
        petName: req.body.petName || 'Unknown',
        location: { latitude: 0, longitude: 0 },
        walkDuration: req.body.walkDuration || 30,
        paymentId,
        paymentAmount: amount,
      });

      logger.info('[WalkPayment] Booking created after payment', { paymentId, holdId });

      res.json({ success: true, bookingId: result.bookingId, message: 'Booking confirmed' });

    } else if (event === 'payment.failed' || event === 'payment.cancelled') {
      logger.info('[WalkPayment] Payment failed/cancelled', { holdId });
      res.json({ success: true, message: 'Hold released' });
    } else {
      res.status(400).json({ error: 'Unknown event type' });
    }

  } catch (error: any) {
    logger.error('[WalkPayment] Webhook processing failed', { error: error.message });
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

/**
 * POST /payments/nayax/webhook-simulate - DEV ONLY: Simulate Nayax webhook
 * Mount: /api → effective path: /api/payments/nayax/webhook-simulate
 * Blocked in production — simulation endpoint must never be reachable on petwash.co.il
 */
router.post('/payments/nayax/webhook-simulate', async (req, res) => {
  if (IS_PRODUCTION) {
    return res.status(404).json({ error: 'Not found' });
  }
  req.url = '/payments/nayax/webhook';
  return router.handle(req as any, res, () => {});
});

// =================== RETURN URL ===================

/**
 * GET /walks/by-payment/:sessionId - Get booking by payment session
 * Mount: /api → effective path: /api/walks/by-payment/:sessionId
 *
 * NOTE: Requires a `payment_session_id` column on the `walk_bookings` table to
 * correlate a Nayax payment session with the booking it created. Until that
 * column is added and the webhook populates it, this endpoint returns 501 so
 * callers know the linkage is not yet wired rather than receiving fake data.
 */
router.get('/walks/by-payment/:sessionId', async (req, res) => {
  res.status(501).json({
    error: 'session_lookup_not_implemented',
    message:
      'Payment session lookup is not yet wired. The walk_bookings table needs a ' +
      'payment_session_id column to correlate Nayax sessions with bookings. ' +
      'Please check your bookings list at /my-walks instead.',
  });
});

export default router;
