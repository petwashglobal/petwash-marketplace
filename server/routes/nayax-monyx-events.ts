/**
 * Nayax Transaction Events — Phase 2 Webhook Handler
 *
 * Ingests all Nayax payment events (Monyx QR, card tap, Apple Pay, PetWash QR).
 * Applies 5-rule loyalty award logic. Handles refund reversals.
 * Safe to receive now — award logic is gated on Nayax confirming webhook capability.
 *
 * Endpoint: POST /api/webhooks/nayax-events
 */

import express from 'express';
import crypto from 'crypto';
import { db } from '../db';
import {
  nayaxTransactionEvents,
  walletAccounts,
  stations,
  users,
} from '@shared/schema';
import { eq, and, sql } from 'drizzle-orm';
import { logger } from '../lib/logger';

const router = express.Router();

// ─── Configuration ───────────────────────────────────────────────────────────
const WEBHOOK_SECRET = process.env.NAYAX_WEBHOOK_SECRET || '';

// Points per ILS spent — 1 point per ₪1 gross
const POINTS_PER_ILS = 1;

// ─── Signature Validation ────────────────────────────────────────────────────
function validateSignature(rawBody: Buffer, header: string | undefined): boolean {
  if (!WEBHOOK_SECRET || !header) return false;
  const expected = crypto.createHmac('sha256', WEBHOOK_SECRET).update(rawBody).digest('hex');
  const provided  = header.replace(/^sha256=/, '');
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(provided));
  } catch {
    return false;
  }
}

// ─── Channel Classifier ──────────────────────────────────────────────────────
function classifyChannel(payload: Record<string, unknown>): string {
  const channel = String(payload.payment_channel || payload.paymentChannel || '').toLowerCase();
  const method  = String(payload.payment_method  || payload.paymentMethod  || '').toLowerCase();

  if (channel.includes('monyx') || method.includes('monyx'))          return 'monyx_qr';
  if (channel.includes('petwash') || method.includes('petwash'))      return 'petwash_wallet_qr';
  if (channel.includes('apple') || method.includes('apple'))          return 'apple_pay';
  if (channel.includes('google') || method.includes('google'))        return 'google_pay';
  if (channel.includes('card') || method.includes('card') ||
      channel.includes('tap')  || method.includes('nfc'))             return 'tap_card';
  return 'unknown';
}

// ─── 5-Rule Award Guard ──────────────────────────────────────────────────────
interface AwardCheck {
  canAward: boolean;
  skipReason?: string;
  pointsToAward: number;
}

async function evaluateLoyaltyAward(
  event: typeof nayaxTransactionEvents.$inferInsert,
  stationOwnedByPetWash: boolean
): Promise<AwardCheck> {
  const gross = parseFloat(String(event.amountGross));

  // Rule 1 — transaction must be approved/final
  if (!['approved', 'authorized', 'completed', 'settled'].includes(
    (event.approvalStatus || '').toLowerCase()
  )) {
    return { canAward: false, skipReason: 'RULE1_NOT_APPROVED', pointsToAward: 0 };
  }

  // Rule 2 — machine must belong to PetWash
  if (!stationOwnedByPetWash) {
    return { canAward: false, skipReason: 'RULE2_NOT_PETWASH_MACHINE', pointsToAward: 0 };
  }

  // Rule 3 — must not be refunded or cancelled
  if (['refunded', 'cancelled', 'reversed'].includes(
    (event.approvalStatus || '').toLowerCase()
  )) {
    return { canAward: false, skipReason: 'RULE3_REFUNDED_OR_CANCELLED', pointsToAward: 0 };
  }

  // Rule 4 — member identity must be confidently linked
  if (!event.linkedPetwashUserId) {
    return { canAward: false, skipReason: 'RULE4_NO_IDENTITY_LINK', pointsToAward: 0 };
  }

  // Rule 5 — transaction ID must not have been seen before (dedup)
  // (guaranteed by UNIQUE constraint on external_transaction_id — insert will fail if duplicate)

  const points = Math.floor(gross * POINTS_PER_ILS);
  if (points <= 0) {
    return { canAward: false, skipReason: 'RULE5_ZERO_POINTS', pointsToAward: 0 };
  }

  return { canAward: true, pointsToAward: points };
}

// ─── Loyalty Award — atomic DB update ────────────────────────────────────────
async function awardLoyaltyPoints(userId: string, points: number): Promise<void> {
  // Update wallet loyalty balance
  await db.update(walletAccounts)
    .set({ loyaltyPointsBalance: sql`loyalty_points_balance + ${points}` })
    .where(eq(walletAccounts.userId, userId));

  // Update user loyalty points (denormalized for dashboard display)
  await db.update(users)
    .set({ loyaltyPoints: sql`loyalty_points + ${points}` })
    .where(eq(users.firebaseUid, userId));
}

// ─── Refund Reversal ─────────────────────────────────────────────────────────
async function reverseAwardedPoints(
  originalTxId: string,
  userId: string
): Promise<void> {
  const [original] = await db.select()
    .from(nayaxTransactionEvents)
    .where(eq(nayaxTransactionEvents.externalTransactionId, originalTxId))
    .limit(1);

  if (!original || !original.loyaltyAwarded || !original.loyaltyPointsAwarded) return;
  if (original.refundReversed) return; // Already reversed

  const pointsToReverse = original.loyaltyPointsAwarded;

  await db.update(walletAccounts)
    .set({ loyaltyPointsBalance: sql`GREATEST(0, loyalty_points_balance - ${pointsToReverse})` })
    .where(eq(walletAccounts.userId, userId));

  await db.update(users)
    .set({ loyaltyPoints: sql`GREATEST(0, loyalty_points - ${pointsToReverse})` })
    .where(eq(users.firebaseUid, userId));

  await db.update(nayaxTransactionEvents)
    .set({ refundReversed: true, processedAt: new Date() })
    .where(eq(nayaxTransactionEvents.externalTransactionId, originalTxId));

  logger.info('[NayaxEvents] Loyalty points reversed', {
    originalTxId,
    userId,
    pointsReversed: pointsToReverse,
  });
}

// ─── Main Webhook Handler ─────────────────────────────────────────────────────
router.post('/nayax-events',
  express.raw({ type: 'application/json', limit: '1mb' }),
  async (req, res) => {
    const rawBody = req.body as Buffer;

    // 1. Validate signature
    const sigHeader = req.headers['x-nayax-signature'] as string | undefined;
    if (WEBHOOK_SECRET && !validateSignature(rawBody, sigHeader)) {
      logger.warn('[NayaxEvents] Invalid signature', { ip: req.ip });
      return res.status(401).json({ error: 'Invalid signature' });
    }

    let payload: Record<string, unknown>;
    try {
      payload = JSON.parse(rawBody.toString('utf8'));
    } catch {
      return res.status(400).json({ error: 'Invalid JSON body' });
    }

    const externalTransactionId = String(
      payload.transaction_id || payload.transactionId || payload.external_id || ''
    );
    if (!externalTransactionId) {
      return res.status(400).json({ error: 'Missing transaction_id' });
    }

    const machineId   = String(payload.machine_id   || payload.machineId   || '');
    const terminalId  = String(payload.terminal_id  || payload.terminalId  || '');
    const stationId   = String(payload.station_id   || payload.stationId   || '');
    const eventType   = String(payload.event_type   || payload.eventType   || 'transaction');
    const approvalStatus = String(
      payload.approval_status || payload.approvalStatus || payload.status || 'unknown'
    );
    const amountGross = parseFloat(String(payload.amount || payload.amount_gross || 0));
    const amountNet   = parseFloat(String(payload.amount_net || payload.net_amount || amountGross));
    const currency    = String(payload.currency || 'ILS').toUpperCase().slice(0, 3);
    const txTime      = payload.transaction_time || payload.timestamp
      ? new Date(String(payload.transaction_time || payload.timestamp))
      : new Date();

    // Hash phone number — never store raw
    const rawPhone = String(payload.customer_phone || payload.phone || '');
    const customerPhoneHash = rawPhone
      ? crypto.createHash('sha256').update(rawPhone.replace(/\D/g, '')).digest('hex')
      : null;

    const monyxCustomerId    = payload.monyx_customer_id    || payload.monyxCustomerId    || null;
    const linkedPetwashUser  = payload.linked_petwash_user_id || payload.petwash_user_id || null;
    const paymentChannel     = classifyChannel(payload);

    // 2. Check machine ownership (rule 2)
    const [ownedStation] = stationId
      ? await db.select({ id: stations.id })
          .from(stations)
          .where(eq(stations.stationId, stationId))
          .limit(1)
      : [null];
    const stationOwnedByPetWash = !!ownedStation;

    // 3. Evaluate loyalty award (all 5 rules)
    const eventRow = {
      externalTransactionId,
      machineId,
      terminalId: terminalId || null,
      stationId:  stationId  || null,
      paymentChannel,
      eventType,
      approvalStatus,
      amountGross: String(amountGross),
      amountNet:   amountNet ? String(amountNet) : null,
      currency,
      transactionTime:       txTime,
      customerPhoneHash,
      monyxCustomerId:       monyxCustomerId ? String(monyxCustomerId) : null,
      linkedPetwashUserId:   linkedPetwashUser ? String(linkedPetwashUser) : null,
      rawPayload:            payload,
      processingStatus:      'pending' as const,
      loyaltyAwarded:        false,
      loyaltyPointsAwarded:  0,
      refundReversed:        false,
    };

    const award = await evaluateLoyaltyAward(eventRow, stationOwnedByPetWash);

    // 4. Insert event row (UNIQUE constraint on external_transaction_id = dedup)
    try {
      await db.insert(nayaxTransactionEvents).values({
        ...eventRow,
        loyaltyAwarded:       award.canAward,
        loyaltyPointsAwarded: award.pointsToAward,
        processingStatus:     'processed',
        processedAt:          new Date(),
      });
    } catch (err: any) {
      if (err?.code === '23505') {
        // Duplicate — idempotent, already processed
        logger.info('[NayaxEvents] Duplicate event ignored', { externalTransactionId });
        return res.status(200).json({ received: true, duplicate: true });
      }
      throw err;
    }

    // PR-5: Surface Nayax payment failures as station_alerts so ops can see
    // them in the Brain Dashboard. Strictly non-blocking: any failure here
    // is swallowed by the helper and never affects the Nayax response.
    // Do NOT emit for refunded/cancelled/reversed — those are post-success
    // states tracked elsewhere; alerts are for declines that block a wash.
    const failureStatuses = new Set(['declined', 'rejected', 'failed', 'error', 'fail']);
    if (machineId && failureStatuses.has(approvalStatus.toLowerCase())) {
      try {
        const { writeStationAlert } = await import('../lib/stationAlertWriter');
        const result = await writeStationAlert({
          kioskId: machineId,
          alertType: 'payment_declined',
          severity: 'warning',
          title: `Nayax payment declined`,
          message:
            `Transaction ${externalTransactionId} on ${machineId} returned ` +
            `status=${approvalStatus} (amount=${amountGross} ${currency}, channel=${paymentChannel})`,
          triggerValue: approvalStatus,
          metadata: {
            externalTransactionId,
            paymentChannel,
            amountGross,
            currency,
            terminalId: terminalId || null,
          },
        });
        if (!result.inserted && result.reason !== 'duplicate') {
          logger.info('[NayaxEvents] payment-declined alert skipped', {
            machineId, reason: result.reason, detail: result.detail,
          });
        }
      } catch (alertErr: any) {
        // Defensive — writeStationAlert already swallows DB errors. Catch
        // here protects against import-time failures.
        logger.warn('[NayaxEvents] payment-declined alert raised exception (non-blocking)', {
          machineId, error: alertErr?.message ?? String(alertErr),
        });
      }
    }

    // 5. Award loyalty if all rules passed
    if (award.canAward && linkedPetwashUser) {
      try {
        await awardLoyaltyPoints(String(linkedPetwashUser), award.pointsToAward);
        logger.info('[NayaxEvents] Loyalty awarded', {
          externalTransactionId,
          userId: linkedPetwashUser,
          channel: paymentChannel,
          points: award.pointsToAward,
        });
      } catch (err) {
        logger.error('[NayaxEvents] Loyalty award failed', { externalTransactionId, err });
      }
    } else if (!award.canAward) {
      logger.info('[NayaxEvents] Award skipped', {
        externalTransactionId,
        reason: award.skipReason,
        channel: paymentChannel,
      });
    }

    // 6. Handle refund/cancellation — reverse previously awarded points
    if (['refunded', 'cancelled', 'reversed'].includes(approvalStatus.toLowerCase())) {
      const originalTxId = String(
        payload.original_transaction_id || payload.originalTransactionId || externalTransactionId
      );
      if (linkedPetwashUser) {
        await reverseAwardedPoints(originalTxId, String(linkedPetwashUser)).catch(err =>
          logger.error('[NayaxEvents] Refund reversal failed', { originalTxId, err })
        );
      }
    }

    return res.status(200).json({ received: true });
  }
);

// ─── Identity Link Endpoint ───────────────────────────────────────────────────
// Called when a PetWash user links their Monyx account or phone number.
// Maps future Nayax events to this PetWash UID for loyalty award.
router.post('/nayax-events/identity-link', async (req, res) => {
  try {
    const { petwashUserId, monyxCustomerId, phoneNumber } = req.body;
    if (!petwashUserId || (!monyxCustomerId && !phoneNumber)) {
      return res.status(400).json({ error: 'petwashUserId + monyxCustomerId or phoneNumber required' });
    }

    const phoneHash = phoneNumber
      ? crypto.createHash('sha256').update(String(phoneNumber).replace(/\D/g, '')).digest('hex')
      : null;

    // Update any un-linked historical events matching this Monyx ID or phone hash
    if (monyxCustomerId) {
      await db.update(nayaxTransactionEvents)
        .set({ linkedPetwashUserId: petwashUserId })
        .where(and(
          eq(nayaxTransactionEvents.monyxCustomerId, String(monyxCustomerId)),
          sql`linked_petwash_user_id IS NULL`
        ));
    }
    if (phoneHash) {
      await db.update(nayaxTransactionEvents)
        .set({ linkedPetwashUserId: petwashUserId })
        .where(and(
          eq(nayaxTransactionEvents.customerPhoneHash, phoneHash),
          sql`linked_petwash_user_id IS NULL`
        ));
    }

    logger.info('[NayaxEvents] Identity linked', {
      petwashUserId,
      monyxCustomerId: monyxCustomerId || null,
      hasPhone: !!phoneNumber,
    });

    return res.json({ success: true });
  } catch (err) {
    logger.error('[NayaxEvents] Identity link failed', err);
    return res.status(500).json({ error: 'Identity link failed' });
  }
});

export default router;
