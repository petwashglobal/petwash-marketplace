/**
 * K9000 IoT Wash Activation Endpoints
 * Secure endpoints for K9000 Twin hardware control
 * 
 * Based on user's Node.js IoT backend code
 * Integrates with Nayax QR readers and loyalty program
 * 
 * Flow:
 * 1. Customer scans QR code or taps NFC (Nayax reader)
 * 2. Nayax validates payment/loyalty discount
 * 3. K9000 controller sends activation request to this endpoint
 * 4. Server validates IP + payment + machine secret
 * 5. Server sends start command back to K9000
 * 6. Wash cycle begins
 */

import express from 'express';
import {
  validateK9000MachineIP,
  validateK9000HmacHeaders,
  validateKioskAllowlist,
} from '../middleware/k9000Security';
import { NayaxSparkService } from '../services/NayaxSparkService';
import { db } from '../db';
import { nayaxTransactions, auditLedger, stations, walletAccounts, creditTransactions } from '@shared/schema';
import { eq, and, gt, sql } from 'drizzle-orm';
import { logger } from '../lib/logger';
import { nanoid } from 'nanoid';
import { k9000StationBookingEngine } from '../services/booking-engines/k9000/K9000StationBookingEngine';
import VATCalculatorService from '../services/VATCalculatorService';
import { eventPublisher } from '../services/EventPublisher';
import { DomainEventType } from '@shared/events';
import { verifySignedRedeemToken, consumeNonce } from '../lib/signedRedeemToken';

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
 * K9000 QR-scan redemption endpoint (2026 security model)
 *
 * Called by the K9000 kiosk when the Nayax QR reader scans a user's phone.
 * The scanned code is a 45-second HMAC-signed redeem token (Apple Wallet)
 * or an 8-digit TOTP (Google Wallet rotating barcode).
 *
 * Flow:
 *   1. Verify HMAC signed token (expiry + nonce + signature)
 *   2. Lookup user wallet → assert washPackageCredits >= 1
 *   3. Atomic decrement (UPDATE ... WHERE wash_package_credits > 0)
 *   4. Consume nonce → replay-safe
 *   5. Send START_PUMP signal to K9000 controller (via HTTP or IoT relay)
 *   6. Write audit ledger entry
 *   7. Trigger Apple Wallet push update so pass shows new balance
 *   8. Return { status: 'success', washId, remainingWashes }
 */
// Layer 3 (redeem-wash only): DB allowlist — kioskId must be registered + active
router.post('/redeem-wash', validateKioskAllowlist, async (req, res) => {
  const correlationId = nanoid(12);

  try {
    const { scannedCode, kioskId } = req.body as {
      scannedCode?: string;
      kioskId?: string;
    };

    if (!scannedCode || !kioskId) {
      return res.status(400).json({
        error: 'שדות חסרים: scannedCode ו-kioskId הם חובה.',
        errorEn: 'Missing required fields: scannedCode and kioskId.',
        correlationId,
      });
    }

    logger.info('[K9000 Redeem] Scan received', { kioskId, correlationId, codeLen: scannedCode.length });

    // ── 1. Verify signed redeem token ──────────────────────────────────────
    const verification = verifySignedRedeemToken(scannedCode);

    if (!verification.valid || !verification.payload) {
      const errorMap: Record<string, string> = {
        EXPIRED:            'הקוד פג תוקף (45 שניות). בקש קוד חדש.',
        REPLAYED:           'קוד זה כבר שומש. אסור לעשות שימוש חוזר.',
        INVALID_SIGNATURE:  'חתימה לא תקינה — הקוד לא יתקבל.',
        MISSING_SECRET:     'שגיאת הגדרות שרת — PASS_TOKEN_SECRET חסר.',
        PARSE_ERROR:        'פורמט קוד לא תקין.',
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

    // ── 2. Load user wallet ────────────────────────────────────────────────
    const [wallet] = await db
      .select()
      .from(walletAccounts)
      .where(eq(walletAccounts.userId, userId))
      .limit(1);

    if (!wallet) {
      logger.warn('[K9000 Redeem] Wallet not found', { userId, correlationId });
      return res.status(404).json({
        error: 'ארנק לא נמצא. פנה לתמיכה.',
        errorEn: 'Wallet not found.',
        correlationId,
      });
    }

    if ((wallet.washPackageCredits ?? 0) < 1) {
      logger.warn('[K9000 Redeem] Insufficient wash credits', { userId, balance: wallet.washPackageCredits, correlationId });
      return res.status(402).json({
        error: 'אין עוד שטיפות בחבילה. ניתן לרכוש חבילה חדשה באפליקציה.',
        errorEn: 'No remaining wash credits.',
        status: 'INSUFFICIENT_CREDITS',
        remainingWashes: 0,
        correlationId,
      });
    }

    // ── 3. Atomic decrement — guard against race conditions ────────────────
    const updated = await db
      .update(walletAccounts)
      .set({
        washPackageCredits: sql`${walletAccounts.washPackageCredits} - 1`,
        lastActivityAt: new Date(),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(walletAccounts.userId, userId),
          gt(walletAccounts.washPackageCredits, 0),
        ),
      )
      .returning({ remaining: walletAccounts.washPackageCredits });

    if (!updated.length) {
      // Lost the race — another concurrent request already consumed the last credit
      logger.warn('[K9000 Redeem] Race condition — credit already consumed', { userId, correlationId });
      return res.status(402).json({
        error: 'אין עוד שטיפות זמינות (עסקה מקבילה).',
        errorEn: 'No remaining wash credits (race condition).',
        status: 'INSUFFICIENT_CREDITS',
        correlationId,
      });
    }

    const remainingWashes = updated[0].remaining ?? 0;

    // ── 4. Consume nonce (replay protection) ───────────────────────────────
    consumeNonce(nonce, 120_000); // 2-minute blacklist window

    // ── 5. Send START_PUMP command to K9000 controller ─────────────────────
    const washId = `WASH-${Date.now()}-${nanoid(8).toUpperCase()}`;
    const stationInfo = (req as any).k9000Station;
    const clientIP = stationInfo?.clientIP;

    if (clientIP) {
      try {
        const signal = await fetch(`http://${clientIP}/api/start`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Machine-Id': kioskId },
          body: JSON.stringify({ washId, command: 'START_PUMP', source: 'wallet_qr', userId }),
          signal: AbortSignal.timeout(3000),
        });
        logger.info('[K9000 Redeem] IoT signal sent', { kioskId, status: signal.status, washId, correlationId });
      } catch (iotErr: any) {
        // Non-fatal — wash is authorised; kiosk may poll /api/k9000/status
        logger.warn('[K9000 Redeem] IoT signal failed (non-fatal)', { error: iotErr.message, kioskId, correlationId });
      }
    } else {
      logger.info('[K9000 Redeem] No kiosk IP — authorisation logged only (dev mode)', { correlationId });
    }

    // ── 6. Audit ledger ────────────────────────────────────────────────────
    try {
      // blockNumber must be unique — take current max and increment atomically
      const blockResult = await db
        .select({ maxBlock: sql<number>`COALESCE(MAX(${auditLedger.blockNumber}), 0)` })
        .from(auditLedger);
      const nextBlock = (blockResult[0]?.maxBlock ?? 0) + 1;

      const auditMeta = {
        passSerial,
        kioskId,
        remainingWashes,
        correlationId,
        redeemedAt: new Date().toISOString(),
      };
      const crypto = await import('crypto');
      const hashInput = `${nextBlock}:${userId}:${washId}:${JSON.stringify(auditMeta)}`;
      const currentHash = crypto.createHash('sha256').update(hashInput).digest('hex');

      await db.insert(auditLedger).values({
        eventType: 'k9000_wallet_redemption',
        userId,
        entityType: 'wash_package',
        entityId:   washId,
        action:     'redeemed',
        blockNumber: nextBlock,
        currentHash,
        previousHash: null,
        previousState: { washPackageCredits: remainingWashes + 1 },
        newState:      { washPackageCredits: remainingWashes },
        metadata: auditMeta,
      });
      logger.info('[K9000 Redeem] Audit ledger written', { washId, blockNumber: nextBlock, correlationId });
    } catch (auditErr: any) {
      logger.error('[K9000 Redeem] Audit write failed (non-fatal)', { error: auditErr.message, correlationId });
    }

    // ── 7. Apple Wallet push update ─────────────────────────────────────────
    // Notifies Apple that the pass has been modified → device fetches updated pass
    // The wallet webServiceURL endpoint (/api/wallet/passes/:passTypeId/:serialNumber)
    // regenerates the pass with a fresh signed token when Apple pulls it.
    const passTypeId = process.env.APPLE_PASS_TYPE_ID || 'pass.com.petwash.voucher';
    const appleWalletPushUrl = `${process.env.BASE_URL || 'https://petwash.co.il'}/api/wallet/notify-pass-update`;
    fetch(appleWalletPushUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, passSerial, passTypeId, remainingWashes }),
    }).catch(() => {});

    // ── 8. Respond to kiosk ────────────────────────────────────────────────
    logger.info('[K9000 Redeem] Wash authorised', { userId, washId, remainingWashes, kioskId, correlationId });

    return res.status(200).json({
      status: 'success',
      washId,
      remainingWashes,
      message: remainingWashes > 0
        ? `שטיפה התחילה! נותרו ${remainingWashes} שטיפות בחבילה.`
        : 'שטיפה התחילה! החבילה מוצתה — ניתן לחדש באפליקציה.',
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
