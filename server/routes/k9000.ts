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
import { validateK9000MachineIP, validateMachineSecretKey } from '../middleware/k9000Security';
import { NayaxSparkService } from '../services/NayaxSparkService';
import { db } from '../db';
import { nayaxTransactions, auditLedger } from '@shared/schema';
import { eq, and } from 'drizzle-orm';
import { logger } from '../lib/logger';
import { nanoid } from 'nanoid';

const router = express.Router();

// Apply security middleware to ALL K9000 endpoints
router.use(validateK9000MachineIP);
router.use(validateMachineSecretKey);

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
