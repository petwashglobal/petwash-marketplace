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
import { validateFirebaseToken } from '../middleware/firebase-auth';
import {
  awardLoyaltyPoints as awardCanonicalPoints,
  reverseLoyaltyPoints as reverseCanonicalPoints,
} from '../services/loyaltyEarn';
import {
  recordQualifyingWash as recordPunch,
  reverseWash as reversePunch,
} from '../services/MonyxPunchCardService';

// Stable source tag for kiosk (Nayax/Monyx) earns in the canonical Prestige
// store. Distinct from the online 'wash_package_purchase' source, so the two
// ingest paths never collide on idempotency.
const KIOSK_LOYALTY_SOURCE = 'nayax_kiosk';

// Phase-16 gate. At launch the BAY loyalty is Nayax's own Monyx 5+1 punch card
// (configured in Nayax Core) — the operator plan is "one system first, keep
// loyalty separate". Mirroring station spend into our app-side Prestige tier
// ladder is a Phase-16 (Prestige app + Nayax API) concern, so it stays DARK until
// this flag is explicitly enabled. The wallet-side balance (pass / K9000 redeem /
// me-status) is unaffected — it is pre-existing and always written.
const KIOSK_PRESTIGE_SYNC_ENABLED =
  String(process.env.KIOSK_PRESTIGE_SYNC_ENABLED).toLowerCase().trim() === 'true';

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

// ─── Loyalty Award — dual-write ──────────────────────────────────────────────
// Kiosk earns must land in BOTH loyalty stores, which different surfaces read:
//   • walletAccounts.loyaltyPointsBalance / users.loyaltyPoints — the wallet
//     pass, K9000 free-wash redemption, me-status, account pages.
//   • loyaltyProfiles (canonical Prestige engine) — the tier ladder / Prestige UI.
// Before this, kiosk washes fed only the wallet side, so paying at a station
// never moved a member up the Prestige tiers (audit gap #2). userId here is the
// linked PetWash Firebase UID (the key both stores use).
async function awardLoyaltyPoints(userId: string, points: number, sourceId: string): Promise<void> {
  // Wallet-side balance (unchanged — powers pass + redemption + me-status).
  await db.update(walletAccounts)
    .set({ loyaltyPointsBalance: sql`loyalty_points_balance + ${points}` })
    .where(eq(walletAccounts.userId, userId));

  // Denormalized user field (dashboard display).
  await db.update(users)
    .set({ loyaltyPoints: sql`loyalty_points + ${points}` })
    .where(eq(users.firebaseUid, userId));

  // Canonical Prestige store — moves the tier ladder. DARK until Phase 16
  // (see KIOSK_PRESTIGE_SYNC_ENABLED): at launch the bay runs Nayax's Monyx 5+1
  // punch card, not our tier ladder. Idempotent per (userId, source, sourceId);
  // fail-closed if the member has no profile.
  if (KIOSK_PRESTIGE_SYNC_ENABLED) {
    await awardCanonicalPoints({
      userId,
      amount: points,
      source: KIOSK_LOYALTY_SOURCE,
      sourceId,
      description: 'Station wash (Nayax/Monyx)',
    });
  }
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

  // Symmetric reversal from the canonical Prestige store — only when the mirror
  // is enabled (else there is no canonical credit to unwind). Idempotent per
  // source/sourceId; keyed by the ORIGINAL transaction id (the award's sourceId).
  if (KIOSK_PRESTIGE_SYNC_ENABLED) {
    await reverseCanonicalPoints({
      userId,
      source: KIOSK_LOYALTY_SOURCE,
      sourceId: originalTxId,
      description: 'Station wash refund (Nayax/Monyx)',
    });
  }

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
    // TRUE raw bytes only when index.ts exempts this path from the global JSON
    // parser (it does). If a future middleware change re-parses the body, the
    // signature CANNOT be verified against re-stringified JSON — fail closed
    // rather than accept a webhook whose bytes we never saw.
    const rawBody: Buffer | null = Buffer.isBuffer(req.body) ? req.body : null;

    // 1. Validate signature
    const sigHeader = req.headers['x-nayax-signature'] as string | undefined;
    // SECURITY: fail CLOSED in production — never process unsigned webhooks live.
    if (!WEBHOOK_SECRET) {
      if (process.env.NODE_ENV === 'production') {
        logger.error('[NayaxEvents] NAYAX_WEBHOOK_SECRET unset in production — rejecting webhook');
        return res.status(503).json({ error: 'Webhook not configured' });
      }
      logger.warn('[NayaxEvents] NAYAX_WEBHOOK_SECRET unset — skipping signature check (DEV ONLY)');
    } else if (!rawBody) {
      logger.error('[NayaxEvents] Raw body unavailable (JSON parser consumed it — check index.ts RAW_BODY_WEBHOOK_PATHS)');
      return res.status(500).json({ error: 'raw_body_unavailable' });
    } else if (!validateSignature(rawBody, sigHeader)) {
      logger.warn('[NayaxEvents] Invalid signature', { ip: req.ip });
      return res.status(401).json({ error: 'Invalid signature' });
    }

    let payload: Record<string, unknown>;
    try {
      payload = rawBody
        ? JSON.parse(rawBody.toString('utf8'))
        : (typeof req.body === 'object' && req.body !== null && !Buffer.isBuffer(req.body)
            ? (req.body as Record<string, unknown>)   // dev-only path (no secret set)
            : JSON.parse(String(req.body)));
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
        await awardLoyaltyPoints(String(linkedPetwashUser), award.pointsToAward, String(externalTransactionId));

        // 5+1 punch card — ONLY for Monyx-paid washes in the standard-price band.
        // A plain bank-card tap keeps working and simply earns nothing, exactly as
        // the Nayax campaign would have behaved. The service filters and dedups
        // itself (UNIQUE on external_transaction_id), so calling it is always safe.
        if (paymentChannel === 'monyx_qr') {
          const punch = await recordPunch({
            userId: String(linkedPetwashUser),
            externalTransactionId: String(externalTransactionId),
            amountIls: amountGross,
            machineId,
          });
          if (punch.rewardEarned) {
            logger.info('[NayaxEvents] 5+1 COMPLETE — free wash earned', {
              userId: linkedPetwashUser, cardId: punch.cardId, punches: punch.punches,
            });
          }
        }
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
        // Un-punch the 5+1 card too — a refunded wash must not count toward the
        // free one. Idempotent, and it deliberately leaves an ALREADY-COMPLETED
        // card alone (the reward was earned in good faith).
        await reversePunch(originalTxId).catch(err =>
          logger.error('[NayaxEvents] Punch reversal failed', { originalTxId, err })
        );
      }
    }

    return res.status(200).json({ received: true });
  }
);

// ─── Identity Link Endpoint ───────────────────────────────────────────────────
// Called when a PetWash user links their Monyx account or phone number.
// Maps future Nayax events to this PetWash UID for loyalty award.
router.post('/nayax-events/identity-link', validateFirebaseToken, async (req, res) => {
  try {
    // SECURITY 2026-06-25: this is a USER action (link MY Monyx/phone), but it had
    // NO auth and sat on the CSRF-exempt /api/webhooks prefix — so anyone could POST
    // a victim's phone/Monyx id with their OWN petwashUserId and steal the victim's
    // historical Nayax loyalty points. Now requires the user's Firebase token and the
    // linked UID is FORCED to that token (body petwashUserId is ignored).
    const petwashUserId = (req as any).firebaseUser?.uid;
    if (!petwashUserId) return res.status(401).json({ error: 'unauthenticated' });
    const { monyxCustomerId, phoneNumber } = req.body;
    if (!monyxCustomerId && !phoneNumber) {
      return res.status(400).json({ error: 'monyxCustomerId or phoneNumber required' });
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
