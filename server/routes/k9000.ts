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
import { nayaxTransactions, auditLedger, stations, walletAccounts, creditTransactions, k9000WashEvents } from '@shared/schema';
import { eq, and, gt, sql } from 'drizzle-orm';
import { logger } from '../lib/logger';
import { nanoid } from 'nanoid';
import { k9000StationBookingEngine } from '../services/booking-engines/k9000/K9000StationBookingEngine';
import VATCalculatorService from '../services/VATCalculatorService';
import { eventPublisher } from '../services/EventPublisher';
import { DomainEventType } from '@shared/events';
import { verifySignedRedeemToken, consumeNonce } from '../lib/signedRedeemToken';
import { redis } from '../services/redis';
import { authorizeRedemption, K9000RedemptionType } from '../services/K9000RedemptionService';

const router = express.Router();

// ── Security layers applied to ALL K9000 endpoints ──────────────────────────
// Layer 1: IP allowlist (blocks non-kiosk IPs in production)
router.use(validateK9000MachineIP);
// Layer 2: Signed HMAC headers  (X-K9000-ID, X-K9000-TS, X-K9000-SIGN)
//          replaces body-only machine secret — stale-timestamp rejection included
router.use(validateK9000HmacHeaders);

/**
 * POST /api/k9000/wash/start_cycle
 * Start K9000 wash cycle after payment validation
 * 
 * Based on user's code:
 * app.post('/api/wash/start_cycle_il', async (req, res) => { ... })
 * 
 * Security Layers:
 * 1. IP whitelist (validateK9000MachineIP middleware)
 * 2. Payment verification (Nayax Spark API)
 * 3. Machine secret key (optional, for extra security)
 */
router.post('/wash/start_cycle', async (req, res) => {
  try {
    const {
      machineId,        // K9000 controller ID (e.g., "K9000-TWIN-UNIT-1-BAY-1")
      transactionId,    // Nayax transaction ID
      selectedProgram,  // Wash program: "basic", "premium", "deluxe"
      bayNumber,        // Which bay (1 or 2 for Twin units)
      qrCode,           // Optional: QR code for loyalty/voucher
      customerUid,      // Optional: Customer ID for loyalty tracking
    } = req.body;
    
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
    
    // Simulate successful activation
    logger.info('[K9000 Wash] ✅ Wash cycle activated', {
      washId,
      machineId,
      bayNumber,
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
        bayNumber,
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
    try {
      const nayaxAmountRow = transactionId
        ? await db
            .select({ amount: nayaxTransactions.amount })
            .from(nayaxTransactions)
            .where(eq(nayaxTransactions.id, transactionId))
            .limit(1)
        : [];
      const amountILS = nayaxAmountRow.length > 0 ? parseFloat(nayaxAmountRow[0].amount) : 0;

      await db.insert(k9000WashEvents).values({
        transactionSource: 'nayax',          // FLOW A: direct terminal sale
        redemptionSource: 'nayax',           // reporting: direct_terminal_sale
        stationId: stationInfo?.stationId ?? machineId,
        nayaxTransactionId: transactionId ?? null,
        nayaxTerminalId: stationInfo?.terminalId ?? null,
        platform: 'k9000',
        product: washType,
        amountCents: Math.round(amountILS * 100),
        currency: 'ILS',
        loyaltyPointsAwarded: 0,
        loyaltyEventLogged: false,
        status: 'completed',
        idempotencyKey: transactionId ? `nayax:${transactionId}` : `nayax:${washId}`,
      });
      logger.info('[K9000 Wash] k9000WashEvents logged (nayax terminal)', { washId });
    } catch (washLogErr: any) {
      logger.error('[K9000 Wash] Failed to write k9000WashEvents', { error: washLogErr.message, washId });
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
      bayNumber,
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

    const { scannedCode, kioskId, redemptionType, washType } = parsed.data;
    const stationInfo = (req as any).k9000Station;

    logger.info('[K9000 Redeem] Scan received', {
      kioskId,
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
        stationId: stationInfo?.stationId,
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

    const { washId, remainingBalance, remainingUnit } = authorization;

    // ── Step 9: Send START_PUMP activation signal to K9000 controller ──────
    // Activation is sent ONLY after authorizeRedemption() succeeds.
    // Failure here is non-fatal — the debit is already committed.
    // The kiosk can poll /api/k9000/status as a fallback.
    const clientIP = stationInfo?.clientIP;
    if (clientIP) {
      try {
        const signal = await fetch(`http://${clientIP}/api/start`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Machine-Id': kioskId },
          body: JSON.stringify({
            washId,
            command: 'START_PUMP',
            source: 'petwash_wallet',
            redemptionType,
            userId,
          }),
          signal: AbortSignal.timeout(3000),
        });
        logger.info('[K9000 Redeem] IoT activation signal sent', {
          kioskId,
          httpStatus: signal.status,
          washId,
          correlationId,
        });
      } catch (iotErr: any) {
        logger.warn('[K9000 Redeem] IoT signal failed (non-fatal) — kiosk should poll /status', {
          error: iotErr.message,
          kioskId,
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
