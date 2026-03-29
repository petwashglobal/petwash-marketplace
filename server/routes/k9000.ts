/**
 * K9000 IoT Wash Activation Endpoints
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * TWO COMPLETELY SEPARATE PAYMENT FLOWS — DO NOT MIX
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * FLOW A — Direct Terminal Sale  (POST /api/k9000/wash/start_cycle)
 * ────────────────────────────────────────────────────────────────
 * Trigger : Guest / walk-in pays by card or NFC at the Nayax IL terminal.
 * Auth    : IP allowlist + HMAC machine headers ONLY. No user login required.
 * Wallet  : NOT touched. No PetWash balance is read or debited.
 * DB log  : k9000_wash_events { transaction_source:"nayax", redemption_source:"nayax" }
 * Finance : VATCalculatorService records 100% PetWash revenue.
 *
 * FLOW B — PetWash Wallet / Credit Redemption  (POST /api/k9000/redeem-wash)
 * ───────────────────────────────────────────────────────────────────────────
 * Trigger : Registered user opens PetWash app → Wallet → QR screen →
 *           presents a 45-second HMAC-signed QR to the Nayax QR reader.
 * Auth    : IP allowlist + HMAC machine headers + signed user token (user identity).
 * Wallet  : Server MUST debit the correct credit type before activation:
 *             wash_package    → washPackageCredits − 1
 *             wallet_balance  → cashWalletBalanceCents − WASH_PRICE
 *             gift_credit     → egiftBalanceCents − WASH_PRICE
 *             loyalty_benefit → loyaltyPointsBalance − LOYALTY_WASH_COST_POINTS
 *             promo_coupon    → promoBalanceCents − WASH_PRICE
 * Validation: K9000RedemptionService.authorizeRedemption() enforces all 8 steps:
 *   1. User identity (signed token, verified here)
 *   2. Wallet ownership
 *   3. Balance / credit sufficiency
 *   4. Machine eligibility (kiosk registered + active)
 *   5. Station online / ready status
 *   6. Anti-fraud velocity check (max 3/hour)
 *   7. Double-redemption prevention (nonce burned before service call)
 *   8. Atomic debit + creditTransactions + k9000WashEvents + audit ledger
 * DB log  : k9000_wash_events { transaction_source:"petwash", redemption_source:<type> }
 *
 * REPORTING — k9000_wash_events.redemption_source values
 * ─────────────────────────────────────────────────────
 *   "nayax"           → Flow A direct terminal card/NFC payment
 *   "wash_package"    → Flow B prepaid wash-package credit
 *   "wallet_balance"  → Flow B cash wallet (ILS) deduction
 *   "gift_credit"     → Flow B eGift card balance
 *   "loyalty_benefit" → Flow B loyalty-tier free wash
 *   "promo_coupon"    → Flow B promotional/coupon credit
 * ─────────────────────────────────────────────────────────────────────────────
 */

import express from 'express';
import {
  validateK9000MachineIP,
  validateK9000HmacHeaders,
  validateKioskAllowlist,
} from '../middleware/k9000Security';
import { NayaxSparkService } from '../services/NayaxSparkService';
import { z } from 'zod';
import { db } from '../db';
import { nayaxTransactions, auditLedger, walletAccounts, creditTransactions, k9000WashEvents, stationBays, baySessions, bayEvents, bayFaults, bayReaders, stations } from '@shared/schema';
import { eq, and, gt, sql, desc } from 'drizzle-orm';
import { logger } from '../lib/logger';
import { nanoid } from 'nanoid';
import VATCalculatorService from '../services/VATCalculatorService';
import { eventPublisher } from '../services/EventPublisher';
import { DomainEventType } from '@shared/events';
import { verifySignedRedeemToken, consumeNonce } from '../lib/signedRedeemToken';
import { redis } from '../services/redis';
import {
  authorizeRedemption,
  K9000RedemptionType,
  findBay,
  openBaySession,
  closeBaySession,
} from '../services/K9000RedemptionService';

const router = express.Router();

// ── Security layers applied to ALL K9000 endpoints ──────────────────────────
// Layer 1: IP allowlist (blocks non-kiosk IPs in production)
router.use(validateK9000MachineIP);
// Layer 2: Signed HMAC headers  (X-K9000-ID, X-K9000-TS, X-K9000-SIGN)
//          replaces body-only machine secret — stale-timestamp rejection included
router.use(validateK9000HmacHeaders);

/**
 * POST /api/k9000/wash/start_cycle — FLOW A: Direct Nayax Terminal Payment
 *
 * Called by the K9000 controller immediately after the Nayax card/NFC reader
 * on ONE specific bay has authorised a payment.
 *
 * CRITICAL:  `side` identifies WHICH physical bay this terminal belongs to.
 *   - Card reader on the LEFT  tub → side: "left"
 *   - Card reader on the RIGHT tub → side: "right"
 * Only THAT bay is activated. The other bay is not touched.
 *
 * Bay readiness is validated BEFORE payment; the response includes bayId and
 * sessionId so the K9000 controller can associate the wash with the correct bay.
 */
router.post('/wash/start_cycle', async (req, res) => {
  const correlationId = nanoid(10);
  try {
    const {
      machineId,        // Station kioskId (matches kioskMachines.kioskId)
      transactionId,    // Nayax transaction ID from the terminal
      selectedProgram,  // Wash program: "basic" | "standard" | "premium" | "deluxe"
      side,             // REQUIRED: "left" | "right" — which bay's terminal fired
      bayNumber,        // Legacy: 1=left, 2=right — accepted if side absent
      qrCode,           // Optional: Nayax loyalty QR scanned at the terminal
      customerUid,      // Optional: customer ID for loyalty tracking
    } = req.body;

    // Resolve side from either explicit "side" field or legacy bayNumber
    const resolvedSide: 'left' | 'right' | undefined =
      side === 'left' || side === 'right'
        ? side
        : bayNumber === 1 || bayNumber === '1' ? 'left'
        : bayNumber === 2 || bayNumber === '2' ? 'right'
        : undefined;

    if (!resolvedSide) {
      return res.status(400).json({
        error: 'שדה חסר: side (left/right) נדרש.',
        errorEn: 'Missing required field: side ("left" or "right").',
        correlationId,
      });
    }
    
    // Get station info from middleware
    const stationInfo = (req as any).k9000Station;
    const clientIP = stationInfo?.clientIP || 'unknown';
    
    logger.info('[K9000 Wash] Activation request received', {
      machineId,
      transactionId,
      selectedProgram,
      bayNumber,
      clientIP,
      stationId: stationInfo?.stationId,
    });
    
    // === STEP 1: PAYMENT VERIFICATION ===
    // Verify payment was successful (either direct payment or QR redemption)
    
    let paymentVerified = false;
    let discountApplied = 0;
    let discountPercent = 0;
    let washType = selectedProgram || 'standard';
    let isFreeWash = false;
    
    // Check if this is a QR code redemption
    if (qrCode) {
      logger.info('[K9000 Wash] QR code detected - checking loyalty/voucher');
      
      try {
        const qrResult = await NayaxSparkService.redeemQRCode({
          qrCode,
          customerUid: customerUid || 'anonymous',
          stationId: stationInfo?.stationId || machineId,
        });
        
        if (qrResult.success) {
          paymentVerified = true;
          discountPercent = qrResult.discountPercent || 0;
          discountApplied = qrResult.discountAmount || 0;
          isFreeWash = qrResult.isFreeWash || false;
          washType = qrResult.washType || selectedProgram;
          
          logger.info('[K9000 Wash] QR redemption successful', {
            discountPercent,
            discountApplied,
            isFreeWash,
            washType,
          });
        } else {
          logger.warn('[K9000 Wash] QR redemption failed', {
            qrCode,
            reason: qrResult.message,
          });
        }
      } catch (error: any) {
        logger.error('[K9000 Wash] QR redemption error', {
          error: error.message,
        });
      }
    }
    
    // If no QR or QR failed, verify regular Nayax transaction
    if (!paymentVerified && transactionId) {
      const transaction = await db
        .select()
        .from(nayaxTransactions)
        .where(eq(nayaxTransactions.id, transactionId))
        .limit(1);
      
      if (transaction.length > 0) {
        const tx = transaction[0];
        
        // Check if transaction is authorized or settled
        if (tx.status === 'authorized' || tx.status === 'settled') {
          paymentVerified = true;
          logger.info('[K9000 Wash] Payment verified via Nayax transaction', {
            transactionId,
            status: tx.status,
            amount: tx.amount,
          });
        } else {
          logger.warn('[K9000 Wash] Transaction not authorized', {
            transactionId,
            status: tx.status,
          });
        }
      } else {
        logger.warn('[K9000 Wash] Transaction not found', { transactionId });
      }
    }
    
    // If payment still not verified, reject
    if (!paymentVerified) {
      return res.status(402).json({
        error: 'תשלום לא מאושר. אנא נסה שוב.',
        errorEn: 'Payment not authorized. Please try again.',
        status: 'PAYMENT_REQUIRED',
      });
    }

    // === IDEMPOTENCY CHECK: prevent double-activation for same transaction ===
    if (transactionId) {
      const existingWash = await db
        .select({ id: auditLedger.id, metadata: auditLedger.metadata })
        .from(auditLedger)
        .where(eq(auditLedger.eventType, 'k9000_wash_activated'))
        .limit(50);

      const duplicate = existingWash.find((row) => {
        try {
          const meta = typeof row.metadata === 'string'
            ? JSON.parse(row.metadata)
            : row.metadata;
          return meta?.transactionId === transactionId;
        } catch {
          return false;
        }
      });

      if (duplicate) {
        logger.warn('[K9000 Wash] Duplicate activation attempt blocked', {
          transactionId,
          existingAuditId: duplicate.id,
        });
        return res.status(409).json({
          error: 'עסקה זו כבר שימשה להפעלת עמדת שטיפה.',
          errorEn: 'This payment has already been used to start a wash cycle.',
          status: 'ALREADY_ACTIVATED',
          transactionId,
        });
      }
    }

    // === STEP 2: SEND ACTIVATION COMMAND TO K9000 ===
    // In production, this would send a command to the K9000 controller
    // For now, we'll simulate and log the wash start
    
    const washId = `wash_${Date.now()}_${nanoid(12)}`;
    
    // TODO: In production, send HTTP POST to K9000 controller
    // const machine_url = `http://${clientIP}/api/start/${machineId}`;
    // const response = await fetch(machine_url, {
    //   method: 'POST',
    //   headers: { 'Content-Type': 'application/json' },
    //   body: JSON.stringify({
    //     program: selectedProgram,
    //     bayNumber,
    //     token: process.env.MACHINE_SECRET_KEY,
    //   }),
    // });
    
    // === STEP 2.5: BAY LOOKUP — find the specific bay record for this side ===
    // resolvedSide was validated above. If the bay isn't in station_bays yet
    // (e.g. first install), we proceed but skip openBaySession (non-fatal).
    let resolvedBay: typeof stationBays.$inferSelect | null = null;
    if (stationInfo?.stationId) {
      try {
        resolvedBay = await findBay(stationInfo.stationId, resolvedSide);
        if (resolvedBay) {
          logger.info('[K9000 Wash] Bay located', {
            bayId: resolvedBay.id,
            side: resolvedSide,
            bayStatus: resolvedBay.status,
            stationId: stationInfo.stationId,
          });
        } else {
          logger.warn('[K9000 Wash] Bay not found in station_bays — session will not be created', {
            stationId: stationInfo.stationId,
            side: resolvedSide,
          });
        }
      } catch (bayLookupErr: any) {
        logger.warn('[K9000 Wash] Bay lookup failed (non-fatal)', { error: bayLookupErr.message });
      }
    }

    // Simulate successful activation
    logger.info('[K9000 Wash] ✅ Wash cycle activated', {
      washId,
      machineId,
      side: resolvedSide,
      bayId: resolvedBay?.id,
      program: washType,
      isFreeWash,
      discountPercent,
    });
    
    // === STEP 3: UPDATE STATION STATS ===
    
    if (stationInfo?.stationId) {
      try {
        await db
          .update(stations)
          .set({
            totalWashes: db.raw('total_washes + 1'),
            lastWashAt: new Date(),
          })
          .where(eq(stations.id, stationInfo.stationId));
      } catch (error: any) {
        logger.error('[K9000 Wash] Failed to update station stats', {
          error: error.message,
        });
      }
    }
    
    // === STEP 4: AUDIT LOG ===
    
    await db.insert(auditLedger).values({
      id: `audit_wash_${Date.now()}_${nanoid(12)}`,
      eventType: 'k9000_wash_activated',
      customerUid: customerUid || null,
      metadata: JSON.stringify({
        machineId,
        side: resolvedSide,      // REQUIRED: which bay's terminal fired
        bayId: resolvedBay?.id,  // FK to station_bays, null if not yet registered
        washType,
        transactionId,
        qrCode: qrCode ? '***REDACTED***' : null,
        isFreeWash,
        discountPercent,
        washId,
      }),
      ipAddress: clientIP,
      userAgent: req.headers['user-agent'] || null,
      previousHash: null,
    });
    
    // === STEP 4.5: PUBLISH DOMAIN EVENT ===
    
    try {
      const transaction = await db
        .select()
        .from(nayaxTransactions)
        .where(eq(nayaxTransactions.id, transactionId))
        .limit(1);
      
      const amount = transaction.length > 0 ? parseFloat(transaction[0].amount) : 0;
      
      await eventPublisher.publishEvent(
        DomainEventType.WASH_STARTED,
        {
          washId,
          stationId: stationInfo?.stationId || machineId,
          bayId: resolvedBay?.id,
          side: resolvedSide,
          customerId: customerUid,
          programType: washType,
          amount,
        },
        {
          aggregateType: 'wash',
          aggregateId: washId,
          userId: customerUid,
          ipAddress: clientIP,
          userAgent: req.headers['user-agent'],
        }
      );
      
      logger.info('[K9000 Wash] Domain event published: WASH_STARTED', { washId });
    } catch (eventError: any) {
      logger.error('[K9000 Wash] Failed to publish domain event', {
        washId,
        error: eventError.message,
      });
    }
    
    // === STEP 4.7: RECORD REVENUE (100% PETWASH — NO PROVIDER SPLIT) ===
    try {
      const nayaxRow = transactionId
        ? await db
            .select({ amount: nayaxTransactions.amount })
            .from(nayaxTransactions)
            .where(eq(nayaxTransactions.id, transactionId))
            .limit(1)
        : [];

      const chargeILS = nayaxRow.length > 0 ? parseFloat(nayaxRow[0].amount) : 0;

      if (!isFreeWash && chargeILS > 0) {
        await VATCalculatorService.recordK9000Transaction({
          washId,
          machineId,
          transactionId: transactionId ?? undefined,
          chargeILS,
          washType,
          isFreeWash,
          customerUid: customerUid ?? undefined,
          stationId: stationInfo?.stationId ?? undefined,
        });
      } else {
        logger.info('[K9000 Revenue] Free wash — no revenue entry needed', { washId });
      }
    } catch (revenueError: any) {
      logger.error('[K9000 Revenue] Failed to record revenue', {
        washId,
        error: revenueError.message,
      });
    }

    // === STEP 4.8: LOG TO k9000_wash_events (FLOW A — NAYAX TERMINAL) ===
    // transaction_source = "nayax" and redemption_source = "nayax" for ALL
    // direct terminal payments. The PetWash wallet is never touched in this flow.
    // baySide is ALWAYS populated — which side's card reader fired.
    let washEventId: string | null = null;
    let nayaxAmountCents = 0;
    try {
      const nayaxAmountRow = transactionId
        ? await db
            .select({ amount: nayaxTransactions.amount })
            .from(nayaxTransactions)
            .where(eq(nayaxTransactions.id, transactionId))
            .limit(1)
        : [];
      const amountILS = nayaxAmountRow.length > 0 ? parseFloat(nayaxAmountRow[0].amount) : 0;
      nayaxAmountCents = Math.round(amountILS * 100);

      const [washEventRow] = await db.insert(k9000WashEvents).values({
        transactionSource: 'nayax',          // FLOW A: direct terminal sale
        redemptionSource: 'nayax',           // reporting: direct_terminal_sale
        stationId: stationInfo?.stationId ?? machineId,
        baySide: resolvedSide,               // "left" | "right" — critical for per-bay reporting
        nayaxTransactionId: transactionId ?? null,
        nayaxTerminalId: stationInfo?.terminalId ?? null,
        platform: 'k9000',
        product: washType,
        amountCents: nayaxAmountCents,
        currency: 'ILS',
        loyaltyPointsAwarded: 0,
        loyaltyEventLogged: false,
        status: 'completed',
        idempotencyKey: transactionId ? `nayax:${transactionId}` : `nayax:${washId}`,
      }).returning({ id: k9000WashEvents.id });
      washEventId = washEventRow?.id ?? null;
      logger.info('[K9000 Wash] k9000WashEvents logged (nayax terminal)', {
        washId,
        washEventId,
        baySide: resolvedSide,
      });
    } catch (washLogErr: any) {
      logger.error('[K9000 Wash] Failed to write k9000WashEvents', { error: washLogErr.message, washId });
    }

    // === STEP 4.9: OPEN BAY SESSION (FLOW A) ===
    // Mark the specific bay as busy and create a session record.
    // Non-fatal if bay is not yet registered in station_bays.
    let baySessionId: string | null = null;
    if (resolvedBay) {
      try {
        const { sessionId } = await openBaySession({
          bay: resolvedBay,
          source: 'terminal_card',
          userId: customerUid || undefined,
          nayaxTransactionId: transactionId || undefined,
          nayaxTerminalId: stationInfo?.terminalId || undefined,
          washProgram: washType,
          amountCents: nayaxAmountCents,
          correlationId: washId,
          washEventId: washEventId || undefined,
        });
        baySessionId = sessionId;
        logger.info('[K9000 Wash] Bay session opened', {
          sessionId,
          bayId: resolvedBay.id,
          side: resolvedSide,
        });
      } catch (sessionErr: any) {
        logger.warn('[K9000 Wash] Bay session creation failed (non-fatal)', {
          error: sessionErr.message,
          bayId: resolvedBay.id,
          side: resolvedSide,
        });
      }
    }

    // === STEP 5: SEND SUCCESS RESPONSE ===
    
    res.status(200).json({
      status: 'SUCCESS',
      message_heb: isFreeWash 
        ? 'שטיפה חינמית החלה! תהנה/י עם הכלב!' 
        : 'השטיפה החלה! תהנה/י עם הכלב!',
      messageEn: isFreeWash
        ? 'Free wash started! Enjoy with your dog!'
        : 'Wash started! Enjoy with your dog!',
      washId,
      machineId,
      side: resolvedSide,       // "left" | "right" — which bay was activated
      bayId: resolvedBay?.id ?? null,
      sessionId: baySessionId,
      program: washType,
      isFreeWash,
      discountPercent,
      estimatedDuration: getEstimatedDuration(washType),
    });
    
  } catch (error: any) {
    logger.error('[K9000 Wash] Activation failed', {
      error: error.message,
      stack: error.stack,
    });
    
    res.status(500).json({
      error: 'שגיאה פנימית. אנא נסה/י שוב.',
      errorEn: 'Internal error. Please try again.',
      status: 'ERROR',
    });
  }
});

/**
 * GET /api/k9000/status/:machineId
 * Get K9000 machine status and telemetry
 */
router.get('/status/:machineId', async (req, res) => {
  try {
    const { machineId } = req.params;
    const stationInfo = (req as any).k9000Station;
    
    // Get machine status from Nayax
    if (stationInfo?.terminalId) {
      const status = await NayaxSparkService.getMachineStatus(stationInfo.terminalId);
      
      res.json({
        status: 'OK',
        machine: {
          id: machineId,
          stationId: stationInfo.stationId,
          location: stationInfo.location,
          locationHe: stationInfo.locationHe,
        },
        telemetry: {
          isAvailable: status.isAvailable,
          state: status.state,
          temperature: status.temperature,
          pressure: status.pressure,
          shampooLevel: status.shampooLevel,
          conditionerLevel: status.conditionerLevel,
        },
      });
    } else {
      res.status(404).json({
        error: 'Station not found',
      });
    }
  } catch (error: any) {
    logger.error('[K9000 Status] Error fetching status', {
      error: error.message,
    });
    res.status(500).json({
      error: 'Failed to fetch machine status',
    });
  }
});

// ─── POST /api/k9000/redeem-wash ─────────────────────────────────────────────
/**
 * FLOW B — PetWash Wallet / Credit Redemption
 *
 * Called by the K9000 kiosk when the Nayax QR reader scans a user's
 * 45-second HMAC-signed QR code from the PetWash app or Apple Wallet pass.
 *
 * This endpoint handles ALL five PetWash-side credit types:
 *   wash_package    — prepaid wash-package credit (washPackageCredits)
 *   wallet_balance  — cash wallet ILS deduction (cashWalletBalanceCents)
 *   gift_credit     — eGift card balance (egiftBalanceCents)
 *   loyalty_benefit — loyalty-tier free wash (loyaltyPointsBalance)
 *   promo_coupon    — promotional credit (promoBalanceCents)
 *
 * Security layers in order:
 *   Layer 1 (global) : IP allowlist         → validateK9000MachineIP
 *   Layer 2 (global) : HMAC machine headers → validateK9000HmacHeaders
 *   Layer 3 (here)   : DB kiosk allowlist   → validateKioskAllowlist
 *   Layer 4 (here)   : Signed user token    → verifySignedRedeemToken
 *   Layer 5 (here)   : Redis nonce burn     → consumeNonce (replay prevention)
 *   Layer 6 (service): All 8 validation steps inside authorizeRedemption()
 *
 * Machine activation is issued ONLY after authorizeRedemption() returns success.
 * If the service throws, the kiosk MUST NOT activate.
 */
// Layer 3 (redeem-wash only): DB allowlist — kioskId must be registered + active
router.post('/redeem-wash', validateKioskAllowlist, async (req, res) => {
  const correlationId = nanoid(12);

  try {
    const bodySchema = z.object({
      scannedCode:   z.string().min(10),
      kioskId:       z.string().min(1),
      // side — REQUIRED. Each Nayax DOT QR reader belongs to exactly one bay.
      // The kiosk firmware must send "left" or "right" depending on which bay's
      // QR reader scanned the code. This is how we know which pump to start.
      side: z.enum(['left', 'right']),
      // redemptionType defaults to 'wash_package' for backward compatibility
      // with existing kiosk firmware that does not yet send this field.
      redemptionType: z.enum([
        'wash_package',
        'wallet_balance',
        'gift_credit',
        'loyalty_benefit',
        'promo_coupon',
      ]).default('wash_package'),
      washType: z.string().optional(),
    });

    const parsed = bodySchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: 'שדות לא תקינים בבקשה.',
        errorEn: 'Invalid request fields.',
        details: parsed.error.flatten().fieldErrors,
        correlationId,
      });
    }

    const { scannedCode, kioskId, side, redemptionType, washType } = parsed.data;
    const stationInfo = (req as any).k9000Station;

    logger.info('[K9000 Redeem] Scan received', {
      kioskId,
      side,
      redemptionType,
      correlationId,
      codeLen: scannedCode.length,
    });

    // ── Step 1: Verify HMAC-signed user token (expiry + nonce + signature) ─
    const verification = verifySignedRedeemToken(scannedCode);

    if (!verification.valid || !verification.payload) {
      const errorMap: Record<string, string> = {
        EXPIRED:           'הקוד פג תוקף (45 שניות). הצג קוד חדש.',
        REPLAYED:          'קוד זה כבר שומש. אסור לעשות שימוש חוזר.',
        INVALID_SIGNATURE: 'חתימה לא תקינה — הקוד לא יתקבל.',
        MISSING_SECRET:    'שגיאת הגדרות שרת — PASS_TOKEN_SECRET חסר.',
        PARSE_ERROR:       'פורמט קוד לא תקין.',
      };
      const heMsg = errorMap[verification.error || ''] || 'קוד לא תקין.';
      logger.warn('[K9000 Redeem] Token rejected', { error: verification.error, kioskId, correlationId });
      return res.status(403).json({
        error: heMsg,
        errorEn: verification.error,
        status: 'TOKEN_REJECTED',
        correlationId,
      });
    }

    const { uid: userId, ps: passSerial, nonce } = verification.payload;

    // ── Step 7 (pre-debit): Burn nonce before calling the service ──────────
    // In-memory burn first (fast, same-process protection)
    consumeNonce(nonce, 120_000);

    // Redis-backed burn for cross-process / post-restart replay protection.
    // Atomic SETNX EX: first writer wins, no race window between GET and SET.
    // Falls back gracefully to in-memory when Redis is unavailable.
    const redisNonceKey = `k9000:nonce:${nonce}`;
    if (redis.isConnected()) {
      const claimed = await redis.setNx(redisNonceKey, true, 120);
      if (!claimed) {
        logger.warn('[K9000 Redeem] Redis SETNX replay blocked', { nonce, userId, correlationId });
        return res.status(409).json({
          error: 'קוד זה כבר שומש. הצג קוד חדש.',
          errorEn: 'QR code already used. Please generate a new one.',
          status: 'REPLAYED',
          correlationId,
        });
      }
    }

    // ── Steps 2-8: Delegate to K9000RedemptionService ──────────────────────
    // This service enforces wallet ownership, balance check, machine eligibility,
    // station ready status, velocity anti-fraud, atomic debit, and full audit log.
    // It will throw a typed error if ANY check fails.
    let authorization;
    try {
      authorization = await authorizeRedemption({
        userId,
        redemptionType: redemptionType as K9000RedemptionType,
        kioskId,
        side,            // which bay's QR reader was scanned — critical for bay lookup
        washType: washType || 'standard',
        correlationId,
      });
    } catch (svcErr: any) {
      // Typed rejection from the service — return the appropriate HTTP status
      const httpStatus = svcErr.httpStatus ?? 400;
      logger.warn('[K9000 Redeem] Authorisation rejected', {
        code: svcErr.code,
        userId,
        redemptionType,
        correlationId,
      });
      return res.status(httpStatus).json({
        error: svcErr.message,
        errorEn: svcErr.code,
        status: svcErr.code,
        correlationId,
      });
    }

    const { washId, bayId, sessionId, side: authorisedSide, remainingBalance, remainingUnit } = authorization;

    // ── Step 9: Send START_PUMP activation signal to K9000 controller ──────
    // Activation is sent ONLY after authorizeRedemption() succeeds.
    // Failure here is non-fatal — the debit is already committed.
    // The kiosk can poll /api/k9000/bays/:stationId as a fallback.
    //
    // CRITICAL: `side` and `bayId` MUST be in the payload so the K9000
    // controller knows which pump to start. Left and right run independently.
    const clientIP = stationInfo?.clientIP;
    if (clientIP) {
      try {
        const signal = await fetch(`http://${clientIP}/api/start`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Machine-Id': kioskId },
          body: JSON.stringify({
            washId,
            sessionId,
            bayId,
            side: authorisedSide,   // "left" | "right" — which pump to activate
            command: 'START_PUMP',
            source: 'petwash_wallet',
            redemptionType,
            userId,
          }),
          signal: AbortSignal.timeout(3000),
        });
        logger.info('[K9000 Redeem] IoT activation signal sent', {
          kioskId,
          side: authorisedSide,
          bayId,
          sessionId,
          httpStatus: signal.status,
          washId,
          correlationId,
        });
      } catch (iotErr: any) {
        logger.warn('[K9000 Redeem] IoT signal failed (non-fatal) — kiosk should poll /api/k9000/bays/:stationId', {
          error: iotErr.message,
          kioskId,
          side: authorisedSide,
          correlationId,
        });
      }
    } else {
      logger.info('[K9000 Redeem] No kiosk IP — dev mode, authorisation logged only', { correlationId });
    }

    // ── Apple Wallet push update (non-blocking fire-and-forget) ────────────
    // Notifies Apple that the pass changed → device pulls fresh pass data.
    const passTypeId = process.env.APPLE_PASS_TYPE_ID || 'pass.com.petwash.voucher';
    const appleWalletPushUrl = `${process.env.BASE_URL || 'https://petwash.co.il'}/api/wallet/notify-pass-update`;
    fetch(appleWalletPushUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId,
        passSerial,
        passTypeId,
        remainingBalance,
        remainingUnit,
        redemptionType,
      }),
    }).catch(() => {});

    // ── Respond to kiosk ───────────────────────────────────────────────────
    logger.info('[K9000 Redeem] Wash authorised ✅', {
      userId,
      washId,
      bayId,
      sessionId,
      side: authorisedSide,
      redemptionType,
      remainingBalance,
      remainingUnit,
      kioskId,
      correlationId,
    });

    const remainingLabel = remainingUnit === 'washes'
      ? `${remainingBalance} שטיפות`
      : `₪${(remainingBalance / 100).toFixed(2)}`;

    return res.status(200).json({
      status: 'success',
      washId,
      bayId,
      sessionId,
      side: authorisedSide,       // "left" | "right" — which bay was activated
      redemptionType,
      remainingBalance,
      remainingUnit,
      message: remainingBalance > 0
        ? `שטיפה התחילה! נותרו ${remainingLabel} ביתרתך.`
        : 'שטיפה התחילה! היתרה אוזלה — ניתן לטעון באפליקציה.',
      messageEn: 'Wash authorised. Enjoy!',
      correlationId,
    });

  } catch (error: any) {
    logger.error('[K9000 Redeem] Unexpected error', { error: error.message, correlationId });
    return res.status(500).json({
      error: 'שגיאת שרת פנימית.',
      errorEn: 'Internal server error.',
      correlationId,
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/k9000/:stationId/bays
 *
 * Real-time readiness for each bay (left + right) at a station.
 *
 * Returns per-bay status independently — a fault or busy state on left does
 * NOT affect right, and vice versa.  Two customers can use both bays at the
 * same time.
 *
 * Auth: IP allowlist + HMAC headers (same as all K9000 endpoints).
 * Used by: K9000 kiosk UI, PetWash admin panel, monitoring dashboards.
 */
router.get('/:stationId/bays', async (req, res) => {
  const correlationId = nanoid(10);
  try {
    const { stationId } = req.params;

    const bays = await db
      .select()
      .from(stationBays)
      .where(eq(stationBays.stationId, stationId));

    if (bays.length === 0) {
      return res.status(404).json({
        error: 'Station not found or has no registered bays.',
        stationId,
        correlationId,
      });
    }

    // Build per-bay readiness map (always left + right, even if only one exists)
    const bayMap: Record<string, any> = {};
    for (const bay of bays) {
      bayMap[bay.side] = {
        bayId:    bay.id,
        side:     bay.side,
        label:    bay.bayLabel,
        labelHe:  bay.bayLabelHe,
        status:   bay.status,          // "ready" | "busy" | "fault" | "maintenance" | "offline"
        isReady:  bay.status === 'ready' && bay.isActive,
        isActive: bay.isActive,

        // Current session (populated when busy)
        currentSessionId: bay.currentSessionId ?? null,

        // Telemetry snapshot
        lastHeartbeat:      bay.lastHeartbeat,
        waterTempC:         bay.waterTempC,
        shampooLevelPct:    bay.shampooLevelPct,
        conditionerLevelPct: bay.conditionerLevelPct,

        // Fault info (populated when status = "fault")
        lastFaultCode: bay.lastFaultCode ?? null,
        lastFaultAt:   bay.lastFaultAt ?? null,

        // Stats
        totalSessions:    bay.totalSessions,
        lastSessionAt:    bay.lastSessionAt,
      };
    }

    const allReady  = Object.values(bayMap).every((b: any) => b.isReady);
    const anyReady  = Object.values(bayMap).some((b: any) => b.isReady);
    const anyFault  = Object.values(bayMap).some((b: any) => b.status === 'fault');

    logger.info('[K9000 Bays] Readiness checked', {
      stationId,
      bays: Object.keys(bayMap),
      anyReady,
      correlationId,
    });

    return res.status(200).json({
      stationId,
      bays: bayMap,
      summary: {
        allReady,
        anyReady,
        anyFault,
        readySides: Object.keys(bayMap).filter((s) => bayMap[s].isReady),
        busySides:  Object.keys(bayMap).filter((s) => bayMap[s].status === 'busy'),
        faultSides: Object.keys(bayMap).filter((s) => bayMap[s].status === 'fault'),
      },
      correlationId,
    });
  } catch (error: any) {
    logger.error('[K9000 Bays] Failed to fetch bay status', {
      error: error.message,
      correlationId,
    });
    return res.status(500).json({ error: 'Failed to fetch bay status.', correlationId });
  }
});

// ─────────────────────────────────────────────────────────────────────────────

/**
 * Helper: Get estimated wash duration by program
 */
function getEstimatedDuration(washType: string): number {
  const durations: Record<string, number> = {
    basic: 8,     // 8 minutes
    standard: 12, // 12 minutes
    premium: 15,  // 15 minutes
    deluxe: 18,   // 18 minutes
  };
  
  return durations[washType] || 12;
}

export default router;
