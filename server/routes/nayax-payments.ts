/**
 * Nayax Spark API Payment Routes
 * Production-ready payment processing endpoints
 * 
 * Based on user's Swift iOS and Node.js implementation
 * 
 * @see NAYAX_SPARK_API_INTEGRATION.md for complete documentation
 */

import { Router } from 'express';
import { NayaxSparkService } from '../services/NayaxSparkService';
import { requireAuth } from '../customAuth';
import { logger } from '../lib/logger';
import { z } from 'zod';
import { db } from '../db';
import { nayaxQrRedemptions } from '../../shared/schema';
import { eq } from 'drizzle-orm';

const router = Router();

// ==================== VALIDATION SCHEMAS ====================

const washInitiationSchema = z.object({
  amount: z.number().positive().max(1000),
  customerUid: z.string(),
  customerToken: z.string().min(10), // Encrypted Nayax payment token
  washType: z.enum(['DOGWASH_PREMIUM', 'DOGWASH_BASIC', 'DOGWASH_DELUXE', 'DOGWASH_EXPRESS']),
  stationId: z.string(),
  terminalId: z.string().optional(),
});

const qrRedemptionSchema = z.object({
  qrCode: z.string().min(8),
  customerUid: z.string(),
  stationId: z.string(),
  terminalId: z.string().optional(),
});

const machineStatusSchema = z.object({
  terminalId: z.string(),
});

const authorizePaymentSchema = z.object({
  amount: z.number().positive().max(1000),
  customerToken: z.string().min(10),
  terminalId: z.string(),
  externalTransactionId: z.string().optional(),
});

const remoteVendSchema = z.object({
  terminalId: z.string(),
  productCode: z.string(),
  transactionId: z.string(),
});

const settleTransactionSchema = z.object({
  transactionId: z.string(),
  amount: z.number().positive().optional(),
});

const voidTransactionSchema = z.object({
  transactionId: z.string(),
});

// ==================== WASH PAYMENT ENDPOINTS ====================

/**
 * POST /api/payments/nayax/initiate-wash
 * Complete wash cycle: Authorize → Remote Vend → Settle
 */
router.post('/initiate-wash', requireAuth, async (req, res) => {
  try {
    // Validate request body
    const validationResult = washInitiationSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({
        error: 'Invalid request',
        details: validationResult.error.errors,
      });
    }
    
    const params = validationResult.data;
    
    logger.info('[Nayax API] Wash initiation request', {
      customerUid: params.customerUid,
      washType: params.washType,
      amount: params.amount,
      stationId: params.stationId,
    });
    
    // Execute complete payment flow
    const result = await NayaxSparkService.initiateWashCycle(params);
    
    if (result.success) {
      res.json({
        success: true,
        message: result.message,
        transactionId: result.transactionId,
        nayaxTransactionId: result.nayaxTransactionId,
      });
    } else {
      res.status(402).json({
        success: false,
        message: result.message,
        transactionId: result.transactionId,
      });
    }
    
  } catch (error: any) {
    logger.error('[Nayax API] Wash initiation failed', { error: error.message });
    res.status(500).json({
      error: 'Payment processing failed',
      message: error.message,
    });
  }
});

/**
 * POST /api/payments/nayax/authorize
 * Step A: Authorize payment only (separate from vend)
 */
router.post('/authorize', requireAuth, async (req, res) => {
  try {
    const validationResult = authorizePaymentSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({
        error: 'Invalid request',
        details: validationResult.error.errors,
      });
    }
    
    const { amount, customerToken, terminalId, externalTransactionId } = validationResult.data;
    
    const result = await NayaxSparkService.authorizePayment({
      amount,
      customerToken,
      terminalId,
      externalTransactionId: externalTransactionId || `PWASH-${Date.now()}`,
    });
    
    res.json(result);
    
  } catch (error: any) {
    logger.error('[Nayax API] Authorization failed', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/payments/nayax/remote-vend
 * Step B: Execute remote vend (start wash machine)
 */
router.post('/remote-vend', requireAuth, async (req, res) => {
  try {
    const validationResult = remoteVendSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({
        error: 'Invalid request',
        details: validationResult.error.errors,
      });
    }
    
    const { terminalId, productCode, transactionId } = validationResult.data;
    
    const result = await NayaxSparkService.executeRemoteVend({
      terminalId,
      productCode,
      transactionId,
    });
    
    res.json(result);
    
  } catch (error: any) {
    logger.error('[Nayax API] Remote vend failed', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/payments/nayax/settle
 * Step C: Settle transaction (capture funds)
 */
router.post('/settle', requireAuth, async (req, res) => {
  try {
    const validationResult = settleTransactionSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({
        error: 'Invalid request',
        details: validationResult.error.errors,
      });
    }
    
    const { transactionId, amount } = validationResult.data;
    
    const result = await NayaxSparkService.settleTransaction(transactionId, amount);
    
    res.json(result);
    
  } catch (error: any) {
    logger.error('[Nayax API] Settlement failed', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/payments/nayax/void
 * Void transaction (refund if vend fails)
 */
router.post('/void', requireAuth, async (req, res) => {
  try {
    const validationResult = voidTransactionSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({
        error: 'Invalid request',
        details: validationResult.error.errors,
      });
    }
    
    const { transactionId } = validationResult.data;
    
    const result = await NayaxSparkService.voidTransaction(transactionId);
    
    res.json(result);
    
  } catch (error: any) {
    logger.error('[Nayax API] Void failed', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

// ==================== MACHINE STATUS ENDPOINTS ====================

/**
 * GET /api/payments/nayax/machine-status/:terminalId
 * Get machine status via Lynx API
 */
router.get('/machine-status/:terminalId', requireAuth, async (req, res) => {
  try {
    const { terminalId } = req.params;
    
    if (!terminalId) {
      return res.status(400).json({ error: 'Missing terminal ID' });
    }
    
    const status = await NayaxSparkService.getMachineStatus(terminalId);
    
    res.json(status);
    
  } catch (error: any) {
    logger.error('[Nayax API] Machine status check failed', {
      terminalId: req.params.terminalId,
      error: error.message,
    });
    res.status(500).json({ error: error.message });
  }
});

// ==================== LOYALTY CARD MANAGEMENT ====================

/**
 * POST /api/payments/nayax/loyalty/create-card
 * Create Nayax loyalty card (QR-based loyalty program)
 */
router.post('/loyalty/create-card', requireAuth, async (req, res) => {
  try {
    const validationResult = z.object({
      customerName: z.string().min(2),
      loyaltyId: z.string(),
      customerUid: z.string(),
    }).safeParse(req.body);

    if (!validationResult.success) {
      return res.status(400).json({
        error: 'Invalid request',
        details: validationResult.error.errors,
      });
    }

    const result = await NayaxSparkService.createLoyaltyCard(validationResult.data);

    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error: any) {
    logger.error('[Nayax API] Loyalty card creation failed', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

// ==================== QR REDEMPTION ENDPOINTS ====================

/**
 * POST /api/payments/nayax/cortina/inquiry
 * Webhook endpoint for Nayax Cortina Dynamic QR
 * Called by Nayax server when QR is scanned at machine
 * 
 * Based on user's production code - enables real-time QR validation
 */
router.post('/cortina/inquiry', async (req, res) => {
  try {
    const {
      transactionId,
      qrCodeData,
      amount,
      deviceId,
    } = req.body;

    logger.info('[Nayax Cortina] Dynamic QR inquiry received', {
      transactionId,
      deviceId,
      amount,
      qrCodeSnippet: qrCodeData?.substring(0, 8) + '...',
    });

    // Validate QR code format
    if (!qrCodeData || !transactionId) {
      return res.json({
        ResponseCode: '096',
        TransactionStatus: 'DECLINED',
        StatusMessage: 'Invalid request data',
      });
    }

    // Parse QR code (format: TYPE:ID:VALUE)
    const qrParts = qrCodeData.split(':');
    if (qrParts.length < 2) {
      return res.json({
        ResponseCode: '051',
        TransactionStatus: 'DECLINED',
        StatusMessage: 'Invalid QR code format',
      });
    }

    const [type, id, value] = qrParts;

    // Validate double-spend using SHA-256 hash
    const crypto = await import('crypto');
    const redemptionHash = crypto.createHash('sha256').update(qrCodeData).digest('hex');

    // Check if already redeemed
    const existingRedemption = await db
      .select()
      .from(nayaxQrRedemptions)
      .where(eq(nayaxQrRedemptions.redemptionHash, redemptionHash))
      .limit(1);

    if (existingRedemption.length > 0) {
      logger.warn('[Nayax Cortina] QR already redeemed', {
        transactionId,
        redemptionHash: redemptionHash.substring(0, 16) + '...',
      });

      return res.json({
        ResponseCode: '051',
        TransactionStatus: 'DECLINED',
        StatusMessage: 'QR code already redeemed',
      });
    }

    // Validate QR type supports at-machine redemption
    if (type.toUpperCase() === 'FREE' || type.toUpperCase() === 'VOUCHER') {
      // Record redemption in database
      await db.insert(nayaxQrRedemptions).values({
        redemptionHash,
        qrCode: qrCodeData,
        qrType: type.toUpperCase(),
        discountAmount: parseFloat(value) || 0,
        stationId: deviceId || 'UNKNOWN',
        terminalId: deviceId || 'UNKNOWN',
        customerUid: 'MACHINE_SCAN', // Machine-initiated
        status: 'success',
      });

      logger.info('[Nayax Cortina] QR redemption approved', {
        transactionId,
        type: type.toUpperCase(),
        deviceId,
      });

      return res.json({
        ResponseCode: '000',
        TransactionStatus: 'APPROVED',
        AuthCode: `CORTINA-${transactionId}`,
      });
    }

    // For other types (LOYALTY, GIFT), decline for now
    logger.warn('[Nayax Cortina] Unsupported QR type for at-machine redemption', { type });
    
    return res.json({
      ResponseCode: '051',
      TransactionStatus: 'DECLINED',
      StatusMessage: 'QR type not supported for at-machine redemption',
    });

  } catch (error: any) {
    // Log detailed Drizzle error
    console.error('[Nayax Cortina] DETAILED ERROR:', error);
    console.error('[Nayax Cortina] Error cause:', error?.cause);
    console.error('[Nayax Cortina] Error message:', error?.message);
    
    logger.error('[Nayax Cortina] Inquiry processing failed', { 
      message: error?.message || 'Unknown error',
      name: error?.name,
      cause: error?.cause,
      stack: error?.stack,
    });
    res.json({
      ResponseCode: '096',
      TransactionStatus: 'ERROR',
      StatusMessage: 'System error',
    });
  }
});

/**
 * POST /api/payments/nayax/redeem-qr
 * Redeem QR code (loyalty/voucher) and trigger payment flow
 * Mobile app redemption (static QR)
 */
router.post('/redeem-qr', requireAuth, async (req, res) => {
  try {
    const validationResult = qrRedemptionSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({
        error: 'Invalid request',
        details: validationResult.error.errors,
      });
    }
    
    const params = validationResult.data;
    
    logger.info('[Nayax API] QR redemption request', {
      customerUid: params.customerUid,
      qrCode: params.qrCode.substring(0, 8) + '...',
      stationId: params.stationId,
    });
    
    const result = await NayaxSparkService.redeemQrCode(params);
    
    res.json(result);
    
  } catch (error: any) {
    logger.error('[Nayax API] QR redemption failed', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

// ==================== TRANSACTION HISTORY ====================

/**
 * GET /api/payments/nayax/transactions/:id
 * Get transaction by ID
 */
router.get('/transactions/:id', requireAuth, async (req, res) => {
  try {
    const transactionId = req.params.id;
    
    if (!transactionId) {
      return res.status(400).json({ error: 'Invalid transaction ID' });
    }
    
    const transaction = await NayaxSparkService.getTransaction(transactionId);
    
    if (!transaction) {
      return res.status(404).json({ error: 'Transaction not found' });
    }
    
    res.json(transaction);
    
  } catch (error: any) {
    logger.error('[Nayax API] Transaction lookup failed', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/payments/nayax/transactions/customer/:customerUid
 * Get customer transaction history
 */
router.get('/transactions/customer/:customerUid', requireAuth, async (req, res) => {
  try {
    const { customerUid } = req.params;
    const limit = parseInt(req.query.limit as string) || 10;
    
    const transactions = await NayaxSparkService.getCustomerTransactions(customerUid, limit);
    
    res.json(transactions);
    
  } catch (error: any) {
    logger.error('[Nayax API] Customer transaction history failed', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

export default router;
