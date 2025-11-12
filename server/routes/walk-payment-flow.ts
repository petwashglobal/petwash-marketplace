/**
 * 🚀 EMERGENCY WALK PAYMENT FLOW (UBER-STYLE)
 * Pay first → Create booking (eliminates no-shows)
 * 
 * Flow:
 * 1. Create 10-minute slot hold
 * 2. Redirect to Nayax payment
 * 3. Webhook confirms payment → creates booking
 * 4. Return URL shows confirmation
 */

import { Router } from 'express';
import { db } from '../db';
import { sql } from 'drizzle-orm';
import { z } from 'zod';
import crypto from 'crypto';
import { logger } from '../lib/logger';

const router = Router();

// =================== SLOT HOLD SYSTEM ===================

const createHoldSchema = z.object({
  slotId: z.string(), // CRITICAL: Required for preventing double-booking
  walkerId: z.string(),
  latitude: z.number(),
  longitude: z.number(),
  petName: z.string(),
  walkDuration: z.number(),
  estimatedAmount: z.number(),
});

/**
 * POST /api/walks/holds - Create temporary slot hold
 * Prevents double-booking during checkout
 */
router.post('/api/walks/holds', async (req, res) => {
  try {
    const userId = req.body.userId || (req as any).user?.uid;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const validation = createHoldSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ error: 'Invalid request', details: validation.error.errors });
    }

    const { slotId, walkerId, latitude, longitude, petName, walkDuration, estimatedAmount } = validation.data;
    
    const holdId = `HOLD-${crypto.randomUUID()}`;
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Store hold in database with slotId for uniqueness enforcement
    await db.execute(sql`
      INSERT INTO walk_slot_holds (hold_id, slot_id, user_id, walker_id, expires_at, status, metadata)
      VALUES (
        ${holdId},
        ${slotId},
        ${userId},
        ${walkerId},
        ${expiresAt},
        'active',
        ${JSON.stringify({ latitude, longitude, petName, walkDuration, estimatedAmount })}
      )
      ON CONFLICT (slot_id) WHERE status = 'active' DO NOTHING
    `);

    // Verify hold was created (not conflicted)
    const createdHold = await db.execute(sql`
      SELECT * FROM walk_slot_holds WHERE hold_id = ${holdId} LIMIT 1
    `);

    if (!createdHold.rows || createdHold.rows.length === 0) {
      return res.status(409).json({
        success: false,
        error: 'Slot already held by another user. Please try a different time.',
      });
    }

    logger.info('[WalkPayment] Slot hold created', { holdId, slotId, userId, walkerId, expiresAt });

    res.json({
      success: true,
      holdId,
      slotId,
      expiresAt,
      message: 'Slot held for 10 minutes',
    });

  } catch (error: any) {
    logger.error('[WalkPayment] Hold creation failed', { error: error.message });
    res.status(500).json({ error: 'Failed to create hold' });
  }
});

// =================== PAYMENT SESSION ===================

/**
 * POST /api/payments/nayax/walk-session - Start Nayax payment for walk
 */
router.post('/api/payments/nayax/walk-session', async (req, res) => {
  try {
    const userId = req.body.userId || (req as any).user?.uid;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { holdId, amount, service } = req.body;

    if (!holdId || !amount) {
      return res.status(400).json({ error: 'Missing holdId or amount' });
    }

    // Verify hold is active
    const holds = await db.execute(sql`
      SELECT * FROM walk_slot_holds 
      WHERE hold_id = ${holdId} 
      AND user_id = ${userId}
      AND status = 'active'
      AND expires_at > NOW()
      LIMIT 1
    `);

    if (!holds.rows || holds.rows.length === 0) {
      return res.status(400).json({ error: 'Hold expired or invalid' });
    }

    // Create Nayax payment session
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
 * GET /api/payments/nayax/redirect/:sessionId - Simulate Nayax payment page
 * In production, this would redirect to actual Nayax
 */
router.get('/api/payments/nayax/redirect/:sessionId', async (req, res) => {
  const { sessionId } = req.params;
  const { holdId, amount, service } = req.query;

  // In production: redirect to Nayax with metadata
  // For now: show payment confirmation page
  
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
        <h2>🐕 Emergency Walk Payment</h2>
        <p><strong>Session:</strong> ${sessionId}</p>
        <p><strong>Service:</strong> ${service}</p>
        <div class="amount">₪${parseFloat(amount as string).toFixed(2)}</div>
        <p>Secure payment powered by Nayax Israel</p>
        
        <button onclick="confirmPayment()">✓ Pay Now with Nayax</button>
        <button class="cancel" onclick="cancelPayment()">✗ Cancel Payment</button>
      </div>

      <script>
        function confirmPayment() {
          // Simulate successful payment
          fetch('/api/payments/nayax/webhook-simulate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              event: 'payment.succeeded',
              sessionId: '${sessionId}',
              holdId: '${holdId}',
              amount: ${amount},
              service: '${service}',
              paymentId: 'NAYAX-' + Date.now()
            })
          }).then(() => {
            window.location.href = '/walks/confirmed?session=${sessionId}';
          });
        }

        function cancelPayment() {
          window.location.href = '/walks/cancelled?holdId=${holdId}';
        }
      </script>
    </body>
    </html>
  `);
});

// =================== WEBHOOK (SOURCE OF TRUTH) ===================

/**
 * POST /api/payments/nayax/webhook - Nayax payment webhook
 * Creates booking ONLY after successful payment
 */
router.post('/api/payments/nayax/webhook', async (req, res) => {
  try {
    const { event, holdId, amount, paymentId, sessionId } = req.body;

    logger.info('[WalkPayment] Webhook received', { event, holdId, paymentId });

    if (event === 'payment.succeeded') {
      // Verify hold is active
      const holds = await db.execute(sql`
        SELECT * FROM walk_slot_holds 
        WHERE hold_id = ${holdId}
        AND status = 'active'
        LIMIT 1
      `);

      if (!holds.rows || holds.rows.length === 0) {
        logger.warn('[WalkPayment] Hold not found or expired', { holdId });
        return res.status(400).json({ error: 'Hold expired' });
      }

      const hold: any = holds.rows[0];

      // Create booking NOW that payment is confirmed
      const bookingId = `WALK-${crypto.randomUUID()}`;
      const metadata = typeof hold.metadata === 'string' ? JSON.parse(hold.metadata) : hold.metadata;

      // Import EmergencyWalkService
      const { EmergencyWalkService } = await import('../services/EmergencyWalkService');
      
      // Create the booking
      const result = await EmergencyWalkService.requestEmergencyWalk({
        ownerId: hold.user_id,
        petName: metadata.petName,
        location: {
          latitude: metadata.latitude,
          longitude: metadata.longitude,
        },
        walkDuration: metadata.walkDuration,
        paymentId, // Link to Nayax payment
        paymentAmount: amount,
      });

      // Mark hold as consumed
      await db.execute(sql`
        UPDATE walk_slot_holds 
        SET status = 'consumed', consumed_at = NOW()
        WHERE hold_id = ${holdId}
      `);

      logger.info('[WalkPayment] Booking created after payment', { bookingId, paymentId, holdId });

      res.json({
        success: true,
        bookingId: result.bookingId,
        message: 'Booking confirmed',
      });

    } else if (event === 'payment.failed' || event === 'payment.cancelled') {
      // Release hold
      await db.execute(sql`
        UPDATE walk_slot_holds 
        SET status = 'released'
        WHERE hold_id = ${holdId}
      `);

      logger.info('[WalkPayment] Payment failed, hold released', { holdId });

      res.json({ success: true, message: 'Hold released' });
    }

  } catch (error: any) {
    logger.error('[WalkPayment] Webhook processing failed', { error: error.message });
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

/**
 * POST /api/payments/nayax/webhook-simulate - DEV ONLY: Simulate webhook
 */
router.post('/api/payments/nayax/webhook-simulate', async (req, res) => {
  // In production, remove this endpoint
  // For now, it simulates Nayax webhook
  return router.handle({ ...req, url: '/api/payments/nayax/webhook', method: 'POST' } as any, res, () => {});
});

// =================== RETURN URL FLOW ===================

/**
 * GET /api/walks/by-payment/:sessionId - Get booking by payment session
 */
router.get('/api/walks/by-payment/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;

    // In production: query by Nayax session ID
    // For now: return mock success
    res.json({
      success: true,
      booking: {
        bookingId: `WALK-${Date.now()}`,
        status: 'confirmed',
        message: 'Your emergency walk is confirmed! Walker will arrive shortly.',
      },
    });

  } catch (error: any) {
    res.status(500).json({ error: 'Failed to fetch booking' });
  }
});

export default router;
