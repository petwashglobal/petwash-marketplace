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
import { nayaxTransactions, auditLedger, walletAccounts, creditTransactions, k9000WashEvents, stationBays, baySessions, bayEvents, bayFaults, bayReaders, stations, machineCommands, kioskMachines, users } from '@shared/schema';
import { eq, and, gt, sql, desc } from 'drizzle-orm';
import { logger } from '../lib/logger';
import { alertManager } from '../lib/alerts';
import { nanoid } from 'nanoid';
import { isK9000MachineConfigured } from '../lib/k9000-env-guard';
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
import * as MachineCommandService from '../services/MachineCommandService';
import { createOrUpdateAlert } from '../services/AlertEngine';
import { requireActive } from '../middleware/requireActive';

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

    // SECURITY (2026-08-22): HMAC middleware verifies the SIGNED kiosk id
    // in the X-K9000-ID header, but this handler previously trusted the
    // body-supplied `machineId` for everything downstream — revenue,
    // VAT, SUMIT receipt, stations.totalWashes, alert routing. A signed
    // kiosk A could therefore inflate station B's revenue and tax
    // invoice, or clear alerts against a station it doesn't own. Enforce
    // equality with the HMAC-verified id before doing anything.
    const signedKioskId = String(stationInfo?.kioskId || '');
    if (!signedKioskId) {
      return res.status(401).json({
        error: 'Missing signed kiosk identity (X-K9000-ID)',
        correlationId,
      });
    }
    if (String(machineId || '') !== signedKioskId) {
      logger.warn('[K9000 Wash] REJECT — body.machineId does not match HMAC header X-K9000-ID', {
        bodyMachineId: String(machineId || ''),
        signedKioskId,
        clientIP,
        correlationId,
      });
      return res.status(403).json({
        error: 'machineId does not match signed kiosk identity',
        correlationId,
      });
    }

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
        const qrResult = await NayaxSparkService.redeemQrCode({
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
    const washId = `wash_${Date.now()}_${nanoid(12)}`;
    let machineCommandSent = false;

    // PR-K env-presence guard: refuse activation in ANY environment when
    // MACHINE_ACTIVATION_URL is unset. The prior production-only guard left
    // dev/staging in a "fake machine success" state where Nayax was already
    // authorized but no physical machine was commanded. Per Rule H ("no fake
    // success") this is forbidden everywhere. Developers wishing to exercise
    // the path locally must point MACHINE_ACTIVATION_URL at a local stub.
    // Auto-refund of the pre-authorised Nayax charge for blocked activations
    // is a separate concern owned by Part 7 (Nayax) of the Financial Core
    // Architecture Spec — out of scope for PR-K.
    const machineActivationUrl = process.env.MACHINE_ACTIVATION_URL;
    if (!isK9000MachineConfigured()) {
      logger.error('[K9000 Wash] FATAL: MACHINE_ACTIVATION_URL not set — blocking wash activation', {
        washId, machineId, transactionId,
      });
      return res.status(503).json({
        error: 'עמדת השטיפה אינה זמינה כעת. אנא נסה שוב מאוחר יותר.',
        errorEn: 'Wash station is not available. Please try again later.',
        status: 'MACHINE_NOT_CONFIGURED',
      });
    }

    {
      // Validate the URL is a legitimate HTTP/HTTPS URL and matches the
      // configured base to prevent SSRF if the env var is tampered with.
      let parsedMachineUrl: URL;
      try {
        parsedMachineUrl = new URL(machineActivationUrl);
      } catch {
        throw new Error('MACHINE_ACTIVATION_URL is not a valid URL');
      }
      if (parsedMachineUrl.protocol !== 'http:' && parsedMachineUrl.protocol !== 'https:') {
        throw new Error('MACHINE_ACTIVATION_URL must use http or https');
      }
      // SSRF guard: reject private IPs, loopback, and cloud metadata endpoints.
      // Even though the URL comes from an env var, defense-in-depth requires we
      // also verify the resolved hostname is not an IMDS / RFC-1918 address.
      // CodeQL CWE-918: taint flows from req.body.machineId into the fetch URL;
      // this guard and the machineId regex below break the dangerous taint path.
      const activationHostname = parsedMachineUrl.hostname.toLowerCase();
      const isPrivateOrMetadata = (
        activationHostname === 'localhost' ||
        activationHostname === '::1' ||
        // IPv4 loopback
        /^127\./.test(activationHostname) ||
        // APIPA / AWS/GCP metadata
        /^169\.254\./.test(activationHostname) ||
        // RFC-1918 private ranges
        /^10\./.test(activationHostname) ||
        /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(activationHostname) ||
        /^192\.168\./.test(activationHostname) ||
        // Any raw 0.0.0.0
        activationHostname === '0.0.0.0' ||
        // IPv6 private prefixes
        /^fc00:/.test(activationHostname) ||
        /^fd[0-9a-f]{2}:/i.test(activationHostname)
      );
      if (isPrivateOrMetadata) {
        throw new Error('MACHINE_ACTIVATION_URL hostname is not allowed (blocked private/metadata range)');
      }
      // Validate machineId format (alphanumeric + _ -) to prevent injection.
      // SSRF CWE-918 true fix: user-controlled machineId is validated but is
      // NEVER included in the outbound fetch URL. The controller is reached at
      // the exact pre-validated MACHINE_ACTIVATION_URL; machineId is sent only
      // in the POST body where it cannot alter the HTTP destination.
      if (!/^[A-Za-z0-9_-]{1,64}$/.test(String(machineId))) {
        throw new Error('Invalid machineId format');
      }
      try {
        // Fetch the pre-validated base URL with no user-controlled path segments.
        const machineRes = await fetch(parsedMachineUrl.href, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            program: washType,
            bayNumber,
            token: process.env.MACHINE_SECRET_KEY,
            washId,
            transactionId,
          }),
          signal: AbortSignal.timeout(5000),
        });
        machineCommandSent = machineRes.ok;
        if (!machineRes.ok) {
          logger.error('[K9000 Wash] Machine activation HTTP error', {
            washId, machineId, status: machineRes.status,
          });
        } else {
          logger.info('[K9000 Wash] ✅ Machine activation command sent', { washId, machineId });
        }
      } catch (machineErr: any) {
        logger.error('[K9000 Wash] Machine activation command failed', {
          washId, machineId, error: machineErr.message,
        });
      }
    }
    
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

    // === STEP 2.6: BAY READY GUARD ===
    // If the bay is registered and not in "ready" state, reject immediately.
    // This covers Nayax card taps that arrive while a bay is busy, in the 30-sec
    // cleanup window, faulted, or under maintenance.
    //
    // Cleanup case: firmware SHOULD prevent new payments, but belt-and-suspenders:
    // if a card tap arrives during cleanup, log it as nayax_rejected_cleanup_window
    // so operators can see the collision in the bay event log.
    if (resolvedBay && (resolvedBay.status !== 'ready' || !resolvedBay.isActive)) {
      const isCleanup = resolvedBay.status === 'cleanup';
      const isBusy    = resolvedBay.status === 'busy';

      logger.warn('[K9000 Wash] Bay not ready — rejecting activation', {
        bayId: resolvedBay.id,
        side: resolvedSide,
        bayStatus: resolvedBay.status,
        isActive: resolvedBay.isActive,
        rejectCode: isCleanup ? 'rejected_cleanup_window' : 'BAY_NOT_READY',
        correlationId,
      });

      // Write a 'rejected_start' bay event for every blocked-state rejection so
      // operators see ALL Nayax collisions in the event log — not just cleanup.
      // This is critical: fault/maintenance/busy rejections must also be visible
      // in Octopus so the ops team can detect pattern failures (e.g. card taps
      // on a faulted bay, indicating firmware is not honouring the lockout).
      if (stationInfo?.stationId) {
        const rejectReason =
          isCleanup ? 'Nayax card tap during 30-second cleanup grace window' :
          isBusy    ? 'Nayax card tap while bay has an active wash session' :
                      `Nayax card tap while bay is in '${resolvedBay.status}' state`;

        db.insert(bayEvents).values({
          bayId:     resolvedBay.id,
          stationId: stationInfo.stationId,
          side:      resolvedSide,
          eventType: 'rejected_start',
          sessionId: resolvedBay.currentSessionId ?? null,
          source:    'nayax',
          metadata:  JSON.stringify({
            transactionId: transactionId ?? null,
            rejectedAt:    new Date().toISOString(),
            bayStatus:     resolvedBay.status,
            reason:        'bay_not_ready',
            detail:        rejectReason,
          }),
          occurredAt: new Date(),
        }).catch((e: Error) => {
          logger.warn('[K9000 Wash] Could not log rejected_start bay event', { error: e.message });
        });
      }

      return res.status(503).json({
        error: isCleanup
          ? 'ניקוי עמדה בתהליך — המתן מספר שניות ונסה שוב.'
          : isBusy
            ? 'עמדת השטיפה תפוסה כרגע.'
            : 'עמדת השטיפה אינה זמינה.',
        errorEn: isCleanup
          ? 'Bay cleanup in progress — please wait a few seconds.'
          : isBusy
            ? 'Bay is currently in use.'
            : 'Bay is not available.',
        status:     isCleanup ? 'rejected_cleanup_window' : 'BAY_NOT_READY',
        bayStatus:  resolvedBay.status,
        bayId:      resolvedBay.id,
        side:       resolvedSide,
        correlationId,
      });
    }

    // ── FAIL-CLOSED: paid but the machine did NOT start (CEO 2026-07-03) ──────
    // In LIVE mode (MACHINE_ACTIVATION_URL set), a failed/timed-out activation
    // means the Nayax terminal already CAPTURED the card payment but no wash
    // began. We must NEVER return success + record revenue for a wash that
    // didn't happen. There is no automated Nayax refund rail, so we mark the
    // transaction failed + refund-due and page ops to credit the customer.
    const liveActivationFailed = !!machineActivationUrl && !machineCommandSent;
    if (liveActivationFailed && !isFreeWash) {
      logger.error('[K9000 Wash] LIVE machine activation FAILED after payment — refund DUE', {
        washId, machineId, side: resolvedSide, transactionId, correlationId,
      });

      if (transactionId) {
        await db.update(nayaxTransactions)
          .set({ status: 'failed', updatedAt: new Date() })
          .where(eq(nayaxTransactions.id, transactionId))
          .catch((e: any) => logger.error('[K9000 Wash] mark txn failed error', { error: e?.message }));
      }

      await db.insert(auditLedger).values({
        id: `audit_wash_fail_${Date.now()}_${nanoid(12)}`,
        eventType: 'k9000_wash_activation_failed_refund_due',
        customerUid: customerUid || null,
        metadata: JSON.stringify({ machineId, side: resolvedSide, washType, transactionId, washId, reason: 'machine_activation_failed', refundStatus: 'refund_pending' }),
        ipAddress: clientIP, userAgent: req.headers['user-agent'] || null, previousHash: null,
      }).catch((e: any) => logger.error('[K9000 Wash] fail audit error', { error: e?.message }));

      await alertManager.triggerAlert({
        name: 'K9000_PAID_WASH_NOT_STARTED',
        message: `Machine ${machineId} took payment (txn ${transactionId}) but did NOT start. Customer refund DUE — no auto-refund rail, credit manually.`,
        severity: 'critical', timestamp: new Date(),
        metadata: { machineId, side: resolvedSide, washType, transactionId, washId, correlationId },
      }).catch(() => {});

      // Honest response — NOT success. Kiosk shows an error; no revenue recorded.
      return res.status(502).json({
        success: false,
        error: 'MACHINE_ACTIVATION_FAILED',
        errorCode: 'MACHINE_NOT_STARTED',
        refundStatus: 'refund_pending',
        message: 'Payment was taken but the wash could not start. A refund is being processed — please contact support with your receipt.',
        washId, transactionId,
      });
    }

    // Successful activation (live command sent, or demo mode with no live URL).
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
        machineCommandSent,      // false = demo mode / MACHINE_ACTIVATION_URL not set
        machineActivationMode: machineActivationUrl ? 'live' : 'demo',
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

      if (isFreeWash) {
        // Genuinely free (loyalty/voucher/staff) — correctly no revenue entry.
        logger.info('[K9000 Revenue] Free wash — no revenue entry needed', { washId });
      } else if (chargeILS > 0) {
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
        // A PAID wash whose charge we could not determine — the nayax_transactions
        // row was missing or unreadable, so chargeILS came back 0.
        //
        // This used to fall into the same branch as a free wash and log
        // "Free wash — no revenue entry needed". A wash the customer PAID for was
        // therefore silently booked as free: revenue missing from the monthly
        // report the CPA files from, with a log line stating all was well. Never
        // conflate "free" with "unknown".
        logger.error('[K9000 Revenue] UNBOOKED — paid wash with no resolvable charge', {
          washId, machineId, transactionId, washType,
        });
        await createOrUpdateAlert({
          dedupeKey: `k9000_revenue_unbooked:${washId}`,
          category: 'payment',
          severity: 'critical',
          title: 'K9000 wash revenue not booked',
          message: `Wash ${washId} on machine ${machineId} was not a free wash, but no charge could be resolved${transactionId ? ` from nayax transaction ${transactionId}` : ' (no transaction id on the wash)'}. Revenue is MISSING from the books — reconcile against Nayax before the monthly close.`,
          linkedEntityType: 'wash',
          linkedEntityId: String(washId),
          source: 'k9000_revenue',
          metadata: { washId, machineId, transactionId, washType, chargeILS },
        }).catch(() => { /* alerting must never break the wash */ });
      }
    } catch (revenueError: any) {
      // The wash already happened and the customer has been charged — we cannot
      // undo it here. But swallowing this into a log line means the money quietly
      // never reaches the books. Raise it so it is reconciled before month end.
      logger.error('[K9000 Revenue] Failed to record revenue', {
        washId,
        error: revenueError.message,
      });
      await createOrUpdateAlert({
        dedupeKey: `k9000_revenue_failed:${washId}`,
        category: 'payment',
        severity: 'critical',
        title: 'K9000 revenue recording FAILED',
        message: `Wash ${washId} on machine ${machineId} completed but recordK9000Transaction threw: ${revenueError?.message}. The customer was charged and the revenue is NOT in the books — reconcile against Nayax before the monthly close.`,
        linkedEntityType: 'wash',
        linkedEntityId: String(washId),
        source: 'k9000_revenue',
        metadata: { washId, machineId, transactionId, error: String(revenueError?.message) },
      }).catch(() => { /* alerting must never break the wash */ });
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
      // CRITICAL: this row is the REVENUE + receipt record for a Flow A Nayax card
      // sale that was ALREADY charged at the terminal. Swallowing it silently loses
      // the revenue record AND the SUMIT receipt (gated on washEventId below). We do
      // NOT 5xx here — the wash/charge already happened and a caller retry could
      // re-activate — instead we make it LOUD + recoverable: a critical log with the
      // full payload + an ops alert. Idempotency key nayax:${transactionId} makes a
      // manual replay safe (no double-count).
      logger.error('[K9000 Wash] CRITICAL: failed to write k9000WashEvents — revenue/receipt record lost', {
        error: washLogErr.message, washId, transactionId,
        nayaxAmountCents, stationId: stationInfo?.stationId ?? machineId, baySide: resolvedSide,
      });
      import('../services/alerts').then(({ sendSecurityAlert }) => sendSecurityAlert(
        'K9000 revenue record FAILED to save (Flow A card sale)',
        `<p>A Flow A Nayax card wash was charged but its k9000WashEvents revenue/receipt row failed to insert.</p>
         <ul><li>washId: ${washId}</li><li>nayaxTransactionId: ${transactionId ?? 'n/a'}</li>
         <li>amountCents: ${nayaxAmountCents}</li><li>station: ${stationInfo?.stationId ?? machineId}</li>
         <li>side: ${resolvedSide}</li><li>error: ${washLogErr.message}</li></ul>
         <p>Reconstruct manually — idempotency key nayax:${transactionId ?? washId}.</p>`
      )).catch(() => {});
    }

    // === STEP 4.8b: SUMIT tax-invoice/receipt — DIRECT Nayax card sale only ===
    // A walk-up Nayax CARD tap is a NEW taxable cash sale, so Pet Wash Ltd must
    // issue a חשבונית מס/קבלה. Credit/package/eGift redemptions go through Flow B
    // and were already taxed when the stored value was purchased — issuing again
    // here would DOUBLE the VAT, so they intentionally do NOT receipt here.
    // Fire-and-forget + fail-safe: no-op until SUMIT is wired, and a receipt
    // failure can never affect the wash that already ran. Idempotent on the txn.
    if (washEventId && nayaxAmountCents > 0) {
      void (async () => {
        try {
          // Identify the buyer only when an app user was linked at the bay; an
          // anonymous tap gets an UNNAMED receipt (valid for an unattended sale).
          let customerEmail: string | undefined;
          let customerName: string | undefined;
          if (customerUid) {
            const [u] = await db
              .select({ email: users.email, first: users.firstName, last: users.lastName })
              .from(users)
              .where(eq(users.id, customerUid))
              .limit(1);
            customerEmail = u?.email || undefined;
            customerName = [u?.first, u?.last].filter(Boolean).join(' ') || undefined;
          }
          const { SumitReceiptService } = await import('../services/SumitReceiptService');
          const r = await SumitReceiptService.issueCustomerReceipt({
            idempotencyKey: `k9000-${transactionId || washId}`,
            sourceRef: washEventId,
            customerName: customerName || 'PetWash Customer',
            customerEmail,
            totalAmountIls: nayaxAmountCents / 100,
            description: `PetWash K9000 wash${washType ? ` — ${washType}` : ''}`,
          });
          if (r.ok && r.sumitDocumentId) {
            await db.update(k9000WashEvents)
              .set({ sumitDocumentId: r.sumitDocumentId })
              .where(eq(k9000WashEvents.id, washEventId));
          }
        } catch (e: any) {
          logger.error('[K9000 Wash] SUMIT receipt failed (wash unaffected)', { washId, error: e?.message });
        }
      })();
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

    // === STEP 4.9: DISPATCH START_PUMP — machine command reliability layer ===
    // Command is created in machine_commands and fired asynchronously.
    // Payment is already confirmed. Response goes to kiosk immediately.
    // If the machine never ACKs within 10 s the timeout scanner retries
    // (up to maxRetries=2) then marks failed and triggers compensation.
    //
    // commandId is stable — the machine deduplicates on it so retries are safe.
    if (stationInfo?.stationId && resolvedBay) {
      MachineCommandService.dispatch({
        commandType:     'START_PUMP',
        stationId:       stationInfo.stationId,
        bayId:           resolvedBay.id,
        sessionId:       baySessionId ?? undefined,
        side:            resolvedSide,
        payload: {
          washId,
          washType,
          machineId,
          transactionId: transactionId ?? null,
          source:        'nayax',
          isFreeWash,
        },
        machineClientIp: clientIP ?? undefined,
        correlationId:   washId,
        source:          'nayax',
      }).then(({ commandId }) => {
        logger.info('[K9000 Wash] START_PUMP queued', {
          commandId,
          washId,
          side:      resolvedSide,
          bayId:     resolvedBay!.id,
          sessionId: baySessionId,
        });
      }).catch((err: Error) => {
        logger.warn('[K9000 Wash] START_PUMP dispatch failed (non-fatal) — kiosk polls /bays', {
          error: err.message,
          washId,
        });
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
router.post('/redeem-wash', validateKioskAllowlist, requireActive, async (req, res) => {
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

    // SECURITY (2026-08-22): validateKioskAllowlist only checks the kiosk
    // exists+active. It does NOT confirm body.kioskId equals the
    // HMAC-verified X-K9000-ID header. Without this check a signed kiosk
    // A could burn a customer's wallet against kiosk B (cross-station
    // wallet drain, wrong bay activated).
    const signedKioskId = String(stationInfo?.kioskId || '');
    if (!signedKioskId) {
      return res.status(401).json({
        error: 'Missing signed kiosk identity (X-K9000-ID)',
        correlationId,
      });
    }
    if (kioskId !== signedKioskId) {
      logger.warn('[K9000 Redeem] REJECT — body.kioskId does not match HMAC header X-K9000-ID', {
        bodyKioskId: kioskId,
        signedKioskId,
        correlationId,
      });
      return res.status(403).json({
        error: 'kioskId does not match signed kiosk identity',
        correlationId,
      });
    }

    logger.info('[K9000 Redeem] Scan received', {
      kioskId,
      side,
      redemptionType,
      correlationId,
      codeLen: scannedCode.length,
    });

    // ── PR-K env-presence guard ─────────────────────────────────────────────
    // Block wallet debit in ANY environment when MACHINE_ACTIVATION_URL is
    // unset. Without it the debit would succeed but the physical machine
    // would never start — customers would pay without receiving a wash.
    // Per Rule H ("no fake success") this is forbidden across all envs;
    // developers exercising the QR flow locally must point
    // MACHINE_ACTIVATION_URL at a local stub.
    if (!isK9000MachineConfigured()) {
      logger.error('[K9000 Redeem] FATAL: MACHINE_ACTIVATION_URL not set — blocking wallet redemption to prevent charging without wash delivery', {
        kioskId, correlationId,
      });
      return res.status(503).json({
        error: 'עמדת השטיפה אינה מוגדרת לעבודה. לא בוצע חיוב. אנא פנה לצוות.',
        errorEn: 'Wash station is not configured. No charge was made. Contact staff.',
        status: 'MACHINE_NOT_CONFIGURED',
        correlationId,
      });
    }

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

    // DURABLE FAIL-CLOSED replay guard (2026-06-18). Previously, when Redis was
    // down the only protection was the per-PROCESS in-memory burn — on multi-instance
    // Cloud Run the same QR could be redeemed once per instance. Claim the nonce in
    // Postgres atomically (unique PK + ON CONFLICT DO NOTHING). If the row already
    // exists, this QR was already redeemed → reject BEFORE any money moves. This works
    // even with Redis down, and is the source of truth.
    try {
      const claim = await db.execute(
        sql`INSERT INTO k9000_redeemed_nonces (nonce) VALUES (${nonce}) ON CONFLICT (nonce) DO NOTHING RETURNING nonce`
      );
      const claimed = (claim as any).rowCount ?? (claim as any).rows?.length ?? 0;
      if (!claimed) {
        logger.warn('[K9000 Redeem] DB nonce replay blocked', { nonce, userId, correlationId });
        return res.status(409).json({
          error: 'קוד זה כבר שומש. הצג קוד חדש.',
          errorEn: 'QR code already used. Please generate a new one.',
          status: 'REPLAYED',
          correlationId,
        });
      }
    } catch (dbErr: any) {
      // Fail CLOSED: if we cannot prove the nonce is fresh, do not authorize a wash.
      logger.error('[K9000 Redeem] DB nonce claim failed — refusing redemption (fail-closed)', { error: dbErr?.message, correlationId });
      return res.status(503).json({
        error: 'השירות אינו זמין כעת. נסה שוב.',
        errorEn: 'Service temporarily unavailable. Please try again.',
        status: 'NONCE_STORE_UNAVAILABLE',
        correlationId,
      });
    }

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

    // ── Step 9: Dispatch START_PUMP via machine command reliability layer ──
    // authorizeRedemption() already committed the debit.  We now create a
    // tracked command record and fire it asynchronously to the controller.
    //
    // commandId is stable — machine deduplicates on it, so retries are safe.
    // If the machine never ACKs within 10 s the timeout scanner retries up to
    // maxRetries=2 times, then marks failed + logs compensation_required.
    //
    // CRITICAL: `side` and `bayId` MUST be in the payload so the K9000
    // controller knows which pump to start.  Left and right run independently.
    const clientIP = stationInfo?.clientIP;

    MachineCommandService.dispatch({
      commandType:     'START_PUMP',
      stationId:       stationInfo?.stationId ?? kioskId,
      bayId:           bayId ?? undefined,
      sessionId:       sessionId ?? undefined,
      side:            authorisedSide,
      payload: {
        washId,
        sessionId,
        bayId,
        side:          authorisedSide,
        source:        'petwash_wallet',
        redemptionType,
        userId,
        kioskId,
      },
      machineClientIp: clientIP ?? undefined,
      correlationId,
      source:          'petwash_wallet',
    }).then(({ commandId }) => {
      logger.info('[K9000 Redeem] START_PUMP queued', {
        commandId,
        washId,
        side:      authorisedSide,
        bayId,
        sessionId,
        correlationId,
      });
    }).catch((cmdErr: Error) => {
      logger.warn('[K9000 Redeem] START_PUMP dispatch failed (non-fatal) — kiosk polls /bays', {
        error: cmdErr.message,
        washId,
        correlationId,
      });
    });

    // ── Apple Wallet push update (non-blocking fire-and-forget) ────────────
    // Notifies Apple that the pass changed → device pulls fresh pass data.
    const passTypeId = process.env.APPLE_PASS_TYPE_ID || 'pass.com.petwash.voucher';
    const appleWalletPushUrl = `${process.env.BASE_URL || 'https://petwash.co.il'}/api/wallet/notify-pass-update`;
    // Attach the internal-service secret so the loopback POST authenticates
    // against wallet.ts /notify-pass-update (hardened 2026-08-22).
    const internalSecret = process.env.INTERNAL_SERVICE_SECRET || '';
    fetch(appleWalletPushUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(internalSecret ? { 'x-internal-secret': internalSecret } : {}),
      },
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
 * POST /api/k9000/commands/:commandId/ack
 *
 * Machine ACK endpoint — called by the K9000 controller after it has
 * successfully received and begun executing a command (e.g. started the pump).
 *
 * Security: same IP allowlist + HMAC layers as all K9000 endpoints.
 * Auth is enforced by the global router.use() middleware above.
 *
 * Idempotent: re-ACKing an already-acknowledged commandId is a no-op (200).
 */
router.post('/commands/:commandId/ack', async (req, res) => {
  const { commandId } = req.params;
  const correlationId = nanoid(10);

  if (!commandId || typeof commandId !== 'string' || commandId.length > 64) {
    return res.status(400).json({ error: 'Invalid commandId', correlationId });
  }

  try {
    const result = await MachineCommandService.acknowledge(commandId);

    if (!result.ok && result.reason === 'command_not_found') {
      logger.warn('[K9000 ACK] Unknown commandId', { commandId, correlationId });
      return res.status(404).json({
        error:       'Command not found',
        commandId,
        correlationId,
      });
    }

    logger.info('[K9000 ACK] ACK accepted', {
      commandId,
      commandType: result.cmd?.commandType,
      status:      result.cmd?.status,
      correlationId,
    });

    return res.status(200).json({
      ok:        true,
      commandId,
      status:    result.cmd?.status,
      correlationId,
    });
  } catch (err: any) {
    logger.error('[K9000 ACK] Error processing ACK', {
      commandId,
      error: err.message,
      correlationId,
    });
    return res.status(500).json({ error: 'Internal error', correlationId });
  }
});

// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/k9000/stations/:stationId/commands
 *
 * Octopus / admin visibility — last 50 commands for a station.
 *
 * Returns each command's full lifecycle record plus a summary:
 *   lastCommandType | lastCommandStatus | lastAckTime | timeoutCount | failedCount
 *
 * Security: same IP allowlist + HMAC layers as all K9000 endpoints.
 * Intended for the Octopus ops dashboard and for integration tests.
 */
router.get('/stations/:stationId/commands', async (req, res) => {
  const { stationId } = req.params;
  const limitRaw = parseInt(String(req.query.limit ?? '50'), 10);
  const limit    = Number.isFinite(limitRaw) && limitRaw > 0 && limitRaw <= 200 ? limitRaw : 50;
  const correlationId = nanoid(10);

  try {
    const data = await MachineCommandService.getStationCommands(stationId, limit);

    return res.status(200).json({
      stationId,
      ...data,
      correlationId,
    });
  } catch (err: any) {
    logger.error('[K9000 Commands] Error fetching command history', {
      stationId,
      error: err.message,
      correlationId,
    });
    return res.status(500).json({ error: 'Internal error', correlationId });
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
      // Display label for Octopus / admin UI
      // "Active wash" | "Cleanup in progress" | "Ready" | "Fault" | "Maintenance" | "Offline"
      const displayStatus =
        bay.status === 'busy'        ? 'Active wash' :
        bay.status === 'cleanup'     ? 'Cleanup in progress' :
        bay.status === 'ready'       ? 'Ready' :
        bay.status === 'fault'       ? 'Fault' :
        bay.status === 'maintenance' ? 'Maintenance' :
        bay.status === 'offline'     ? 'Offline' : bay.status;

      bayMap[bay.side] = {
        bayId:    bay.id,
        side:     bay.side,
        label:    bay.bayLabel,
        labelHe:  bay.bayLabelHe,

        // status: "ready" | "busy" | "cleanup" | "fault" | "maintenance" | "offline"
        // "cleanup" = 30-sec complimentary tub-clean window; NOT available for new users
        status:        bay.status,
        displayStatus,
        isReady:       bay.status === 'ready' && bay.isActive,
        isActive:      bay.isActive,

        // Current session (populated when busy or in cleanup)
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
        readySides:   Object.keys(bayMap).filter((s) => bayMap[s].isReady),
        // "busy" = active wash; "cleanup" = grace window — both are unavailable to new users
        busySides:    Object.keys(bayMap).filter((s) => bayMap[s].status === 'busy'),
        cleanupSides: Object.keys(bayMap).filter((s) => bayMap[s].status === 'cleanup'),
        faultSides:   Object.keys(bayMap).filter((s) => bayMap[s].status === 'fault'),
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

/**
 * POST /api/k9000/heartbeat
 *
 * IoT heartbeat endpoint — called by the K9000 controller every 30–60 seconds
 * to signal that the station is alive and to push per-bay status snapshots.
 *
 * Auth: machine IP allowlist + HMAC headers (inherits router middleware).
 *
 * Body:
 *   kioskId            string   — matches kioskMachines.kioskId
 *   bays               array    — [{side: 'left'|'right', status, waterTempC?, shampooLevelPct?}]
 *   firmwareVersion?   string
 *
 * Effect:
 *   - Updates kioskMachines.lastHeartbeat = NOW(), isOnline = true
 *   - Updates stationBays snapshot fields per bay (status NOT overwritten if
 *     controller says 'busy' — that is owned by the session lifecycle)
 */
router.post('/heartbeat', async (req, res) => {
  const correlationId = nanoid(10);
  try {
    const { kioskId, bays = [], firmwareVersion } = req.body as {
      kioskId: string;
      bays?: { side: string; status?: string; waterTempC?: number; shampooLevelPct?: number }[];
      firmwareVersion?: string;
    };

    if (!kioskId) {
      return res.status(400).json({ ok: false, error: 'kioskId required' });
    }

    // SECURITY (2026-08-22): heartbeat previously trusted the body-supplied
    // kioskId. A signed kiosk A could therefore mark kiosk B as ONLINE,
    // auto-clear kiosk B's `offline` alerts, and re-enable activations on
    // faulted equipment — leading to paid-but-not-delivered washes on the
    // real station B. Enforce equality with the HMAC-verified header.
    const stationInfo = (req as any).k9000Station;
    const signedKioskId = String(stationInfo?.kioskId || '');
    if (!signedKioskId) {
      return res.status(401).json({ ok: false, error: 'Missing signed kiosk identity' });
    }
    if (kioskId !== signedKioskId) {
      logger.warn('[K9000 Heartbeat] REJECT — body.kioskId does not match HMAC header', {
        bodyKioskId: kioskId,
        signedKioskId,
        correlationId,
      });
      return res.status(403).json({ ok: false, error: 'kioskId does not match signed kiosk identity' });
    }

    const now = new Date();

    // Update machine last_heartbeat + mark online
    await db
      .update(kioskMachines)
      .set({
        lastHeartbeat: now,
        isOnline:      true,
        updatedAt:     now,
      } as any)
      .where(eq(kioskMachines.kioskId, kioskId));

    // PR-5: When a kiosk reports a heartbeat, auto-resolve any open
    // 'offline' station_alerts that were raised by the heartbeat-monitor
    // cron. Strictly non-blocking + idempotent — if no open alerts exist,
    // the helper returns resolvedCount=0. Never affects heartbeat response.
    try {
      const { resolveStationAlerts } = await import('../lib/stationAlertWriter');
      const r = await resolveStationAlerts(kioskId, 'offline');
      if (r.resolvedCount > 0) {
        logger.info('[K9000 Heartbeat] auto-resolved offline alerts on recovery', {
          kioskId, resolvedCount: r.resolvedCount,
        });
      }
    } catch (resolveErr: any) {
      logger.warn('[K9000 Heartbeat] alert auto-resolve raised exception (non-blocking)', {
        kioskId, error: resolveErr?.message ?? String(resolveErr),
      });
    }

    // Update per-bay telemetry snapshots.
    // We only update telemetry fields — session-owned fields (status, currentSessionId)
    // are managed by the session lifecycle and must not be overwritten here.
    for (const bay of bays) {
      if (!bay.side) continue;
      const updatePayload: Record<string, any> = {
        lastHeartbeat: now,
        updatedAt:     now,
      };
      if (typeof bay.waterTempC === 'number') {
        updatePayload.waterTempC = String(bay.waterTempC);
      }
      if (typeof bay.shampooLevelPct === 'number') {
        updatePayload.shampooLevelPct = bay.shampooLevelPct;
      }
      await db
        .update(stationBays)
        .set(updatePayload)
        .where(and(eq(stationBays.stationId, kioskId), eq(stationBays.side, bay.side)));
    }

    logger.debug('[K9000 Heartbeat] Received', { kioskId, bayCount: bays.length, firmwareVersion, correlationId });
    return res.json({ ok: true, serverTime: now.toISOString() });
  } catch (error: any) {
    logger.error('[K9000 Heartbeat] Failed', { error: error.message, correlationId });
    return res.status(500).json({ ok: false, error: 'Heartbeat processing failed', correlationId });
  }
});

export default router;
