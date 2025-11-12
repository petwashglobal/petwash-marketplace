/**
 * Nayax Spark API Integration Service
 * Production-ready payment processing with Nayax Spark/Lynx API
 * 
 * Based on user's Swift iOS and Node.js implementation
 * 
 * Payment Flow:
 * 1. Authorize payment (Spark API)
 * 2. Execute remote vend (K9000 machine start)
 * 3. Settle transaction (capture funds) OR Void (if vend fails)
 * 
 * @see NAYAX_SPARK_API_INTEGRATION.md for complete documentation
 */

import { db } from "../db";
import {
  nayaxTransactions,
  nayaxTelemetry,
  nayaxQrRedemptions,
  customerPaymentTokens,
  auditLedger,
  type InsertNayaxTransaction,
  type InsertNayaxTelemetry,
  type InsertNayaxQrRedemption,
} from "@shared/schema";
import { eq, and, desc } from "drizzle-orm";
import { logger } from "../lib/logger";
import { nanoid } from "nanoid";
import crypto from "crypto";

// ==================== CONFIGURATION ====================

const NAYAX_API_URL = process.env.NAYAX_API_URL || "https://api.nayax.com/spark/v1";
const NAYAX_API_KEY = process.env.NAYAX_API_KEY;
const NAYAX_TERMINAL_ID_MAIN = process.env.NAYAX_TERMINAL_ID_MAIN;
const NAYAX_TERMINAL_ID_SECONDARY = process.env.NAYAX_TERMINAL_ID_SECONDARY;

// DEMO MODE: Controlled by explicit environment variable for safety
// Only enabled when NAYAX_DEMO_MODE=true AND no API key exists
const DEMO_MODE = process.env.NAYAX_DEMO_MODE === 'true' && !NAYAX_API_KEY;

if (DEMO_MODE) {
  logger.warn('[Nayax] Running in DEMO MODE - Payment simulation enabled (NAYAX_DEMO_MODE=true)');
} else if (!NAYAX_API_KEY) {
  logger.warn('[Nayax] API keys not configured - Nayax features disabled until keys are provided');
}

// ==================== TYPE DEFINITIONS ====================

interface NayaxAuthorizeRequest {
  TerminalId: string;
  Amount: number;
  Currency: string;
  Token: string; // Customer payment token
  ExternalTransactionId: string;
}

interface NayaxAuthorizeResponse {
  Status: 'AUTHORIZED' | 'DECLINED';
  TransactionId?: string;
  DeclineReason?: string;
  Message?: string;
}

interface NayaxRemoteVendRequest {
  TerminalId: string;
  ProductCode: string;
  TransactionId: string;
}

interface NayaxRemoteVendResponse {
  Status: 'SUCCESS' | 'FAILED';
  Message?: string;
  ErrorCode?: string;
}

interface NayaxSettleRequest {
  TransactionId: string;
  Amount?: number;
}

interface NayaxSettleResponse {
  Status: 'SETTLED' | 'FAILED';
  Message?: string;
}

interface NayaxVoidRequest {
  TransactionId: string;
}

interface NayaxVoidResponse {
  Status: 'VOIDED' | 'FAILED';
  Message?: string;
}

interface NayaxTelemetryResponse {
  State: 'Idle' | 'InUse' | 'OutOfService' | 'Offline';
  Telemetry: {
    WaterTemp?: number;
    WaterPressure?: number;
    ShampooLevel?: number;
    ConditionerLevel?: number;
  };
  ErrorCode?: string;
  ErrorMessage?: string;
}

interface WashInitiationParams {
  amount: number;
  customerUid: string;
  customerToken: string;
  washType: string;
  stationId: string;
  terminalId?: string;
}

interface QrRedemptionParams {
  qrCode: string;
  customerUid: string;
  stationId: string;
  terminalId?: string;
}

// ==================== NAYAX SPARK SERVICE ====================

export class NayaxSparkService {
  
  // ==================== WASH INITIATION (COMPLETE FLOW) ====================
  
  /**
   * Complete wash cycle initiation (user's exact flow)
   * Authorize → Remote Vend → Settle | Void
   */
  static async initiateWashCycle(params: WashInitiationParams): Promise<{
    success: boolean;
    message: string;
    transactionId?: string;
    nayaxTransactionId?: string;
  }> {
    const { amount, customerUid, customerToken, washType, stationId, terminalId } = params;
    
    // Determine terminal ID
    const finalTerminalId = terminalId || NAYAX_TERMINAL_ID_MAIN;
    if (!finalTerminalId) {
      throw new Error('Nayax terminal ID not configured');
    }
    
    // Generate external transaction ID
    const externalTransactionId = `PWASH-${Date.now()}-${nanoid(8)}`;
    
    logger.info(`[Nayax] Starting wash cycle`, {
      externalTransactionId,
      amount,
      washType,
      stationId,
    });
    
    // Create initial transaction record
    const transactionId = `tx_${Date.now()}_${nanoid(12)}`;
    
    await db.insert(nayaxTransactions).values({
      id: transactionId,
      externalTransactionId,
      status: 'initiated',
      amount: amount.toString(),
      currency: 'ILS',
      washType,
      stationId,
      terminalId: finalTerminalId,
      customerUid,
      customerToken,
    });
    
    try {
      // STEP A: Authorize Payment
      logger.info(`[Nayax] Step A: Authorizing payment`, { externalTransactionId });
      
      const authResult = await this.authorizePayment({
        amount,
        customerToken,
        terminalId: finalTerminalId,
        externalTransactionId,
      });
      
      if (authResult.Status !== 'AUTHORIZED') {
        // Payment declined
        await db.update(nayaxTransactions)
          .set({
            status: 'failed',
            failedAt: new Date(),
            declineReason: authResult.DeclineReason || 'Payment declined',
          })
          .where(eq(nayaxTransactions.id, transactionId));
        
        return {
          success: false,
          message: `Payment Declined: ${authResult.DeclineReason || 'Unknown reason'}`,
          transactionId: transactionId,
        };
      }
      
      // Update transaction with Nayax ID
      await db.update(nayaxTransactions)
        .set({
          status: 'authorized',
          nayaxTransactionId: authResult.TransactionId,
          authorizedAt: new Date(),
        })
        .where(eq(nayaxTransactions.id, transactionId));
      
      logger.info(`[Nayax] Payment authorized`, {
        externalTransactionId,
        nayaxTransactionId: authResult.TransactionId,
      });
      
      // STEP B: Execute Remote Vend (Start Wash)
      logger.info(`[Nayax] Step B: Executing remote vend`, { externalTransactionId });
      
      await db.update(nayaxTransactions)
        .set({
          status: 'vend_pending',
          vendAttemptedAt: new Date(),
          productCode: washType,
        })
        .where(eq(nayaxTransactions.id, transactionId));
      
      const vendResult = await this.executeRemoteVend({
        terminalId: finalTerminalId,
        productCode: washType,
        transactionId: authResult.TransactionId!,
      });
      
      if (vendResult.Status !== 'SUCCESS') {
        // Vend failed - must void authorization
        logger.error(`[Nayax] Vend failed, voiding authorization`, {
          externalTransactionId,
          vendError: vendResult.Message,
        });
        
        await db.update(nayaxTransactions)
          .set({
            status: 'voided',
            voidedAt: new Date(),
            vendErrorMessage: vendResult.Message || 'Machine failed to start',
          })
          .where(eq(nayaxTransactions.id, transactionId));
        
        // Void the authorization (refund)
        await this.voidTransaction(authResult.TransactionId!);
        
        return {
          success: false,
          message: 'Payment authorized but machine failed to start. Your payment has been refunded.',
          transactionId: transactionId,
          nayaxTransactionId: authResult.TransactionId,
        };
      }
      
      // Vend successful
      await db.update(nayaxTransactions)
        .set({
          status: 'vend_success',
          vendSuccessAt: new Date(),
        })
        .where(eq(nayaxTransactions.id, transactionId));
      
      logger.info(`[Nayax] Vend successful`, { externalTransactionId });
      
      // STEP C: Settle Transaction (Capture Funds)
      logger.info(`[Nayax] Step C: Settling transaction`, { externalTransactionId });
      
      const settleResult = await this.settleTransaction(authResult.TransactionId!, amount);
      
      if (settleResult.Status === 'SETTLED') {
        await db.update(nayaxTransactions)
          .set({
            status: 'settled',
            settledAt: new Date(),
          })
          .where(eq(nayaxTransactions.id, transactionId));
        
        logger.info(`[Nayax] Transaction settled successfully`, { externalTransactionId });
        
        return {
          success: true,
          message: 'Wash started successfully!',
          transactionId: transactionId,
          nayaxTransactionId: authResult.TransactionId,
        };
      } else {
        // Settlement failed (rare case)
        logger.error(`[Nayax] Settlement failed`, {
          externalTransactionId,
          settleError: settleResult.Message,
        });
        
        // Mark as failed but vend already executed
        await db.update(nayaxTransactions)
          .set({
            status: 'failed',
            failedAt: new Date(),
            errorMessage: 'Settlement failed: ' + settleResult.Message,
          })
          .where(eq(nayaxTransactions.id, transactionId));
        
        return {
          success: true, // Wash started even if settlement has issues
          message: 'Wash started successfully (settlement pending)',
          transactionId: transactionId,
          nayaxTransactionId: authResult.TransactionId,
        };
      }
      
    } catch (error: any) {
      logger.error(`[Nayax] Wash initiation failed`, {
        externalTransactionId,
        error: error.message,
      });
      
      await db.update(nayaxTransactions)
        .set({
          status: 'failed',
          failedAt: new Date(),
          errorMessage: error.message,
        })
        .where(eq(nayaxTransactions.id, transactionId));
      
      throw error;
    }
  }
  
  // ==================== INDIVIDUAL API OPERATIONS ====================
  
  /**
   * Step A: Authorize payment via Spark API
   */
  static async authorizePayment(params: {
    amount: number;
    customerToken: string;
    terminalId: string;
    externalTransactionId: string;
  }): Promise<NayaxAuthorizeResponse> {
    
    // DEMO MODE: Simulate successful authorization
    if (DEMO_MODE) {
      logger.info('[Nayax DEMO] Simulating payment authorization', {
        amount: params.amount,
        externalTransactionId: params.externalTransactionId,
      });
      
      return {
        Status: 'AUTHORIZED',
        TransactionId: `DEMO_${params.externalTransactionId}`,
        Message: 'DEMO MODE - Simulated authorization',
      };
    }
    
    if (!NAYAX_API_KEY) {
      throw new Error('Nayax API key not configured');
    }
    
    const requestBody: NayaxAuthorizeRequest = {
      TerminalId: params.terminalId,
      Amount: params.amount,
      Currency: 'ILS',
      Token: params.customerToken,
      ExternalTransactionId: params.externalTransactionId,
    };
    
    const response = await fetch(`${NAYAX_API_URL}/payment/authorize`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${NAYAX_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });
    
    if (!response.ok) {
      throw new Error(`Nayax API error: ${response.statusText}`);
    }
    
    const data: NayaxAuthorizeResponse = await response.json();
    return data;
  }
  
  /**
   * Step B: Execute remote vend (start wash cycle)
   */
  static async executeRemoteVend(params: {
    terminalId: string;
    productCode: string;
    transactionId: string;
  }): Promise<NayaxRemoteVendResponse> {
    
    // DEMO MODE: Simulate successful vend
    if (DEMO_MODE) {
      logger.info('[Nayax DEMO] Simulating remote vend', {
        productCode: params.productCode,
        transactionId: params.transactionId,
      });
      
      return {
        Status: 'SUCCESS',
        Message: 'DEMO MODE - Simulated vend',
      };
    }
    
    if (!NAYAX_API_KEY) {
      throw new Error('Nayax API key not configured');
    }
    
    const requestBody: NayaxRemoteVendRequest = {
      TerminalId: params.terminalId,
      ProductCode: params.productCode,
      TransactionId: params.transactionId,
    };
    
    const response = await fetch(`${NAYAX_API_URL}/device/remotevend`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${NAYAX_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });
    
    if (!response.ok) {
      throw new Error(`Nayax API error: ${response.statusText}`);
    }
    
    const data: NayaxRemoteVendResponse = await response.json();
    return data;
  }
  
  /**
   * Step C: Settle transaction (capture funds)
   */
  static async settleTransaction(
    transactionId: string,
    amount?: number
  ): Promise<NayaxSettleResponse> {
    
    // DEMO MODE: Simulate successful settlement
    if (DEMO_MODE) {
      logger.info('[Nayax DEMO] Simulating transaction settlement', {
        transactionId,
        amount,
      });
      
      return {
        Status: 'SETTLED',
        Message: 'DEMO MODE - Simulated settlement',
      };
    }
    
    if (!NAYAX_API_KEY) {
      throw new Error('Nayax API key not configured');
    }
    
    const requestBody: NayaxSettleRequest = {
      TransactionId: transactionId,
      ...(amount && { Amount: amount }),
    };
    
    const response = await fetch(`${NAYAX_API_URL}/payment/settle`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${NAYAX_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });
    
    if (!response.ok) {
      throw new Error(`Nayax API error: ${response.statusText}`);
    }
    
    const data: NayaxSettleResponse = await response.json();
    return data;
  }
  
  /**
   * Void transaction (refund if vend fails)
   */
  static async voidTransaction(transactionId: string): Promise<NayaxVoidResponse> {
    
    // DEMO MODE: Simulate successful void
    if (DEMO_MODE) {
      logger.info('[Nayax DEMO] Simulating transaction void', { transactionId });
      
      return {
        Status: 'VOIDED',
        Message: 'DEMO MODE - Simulated void/refund',
      };
    }
    
    if (!NAYAX_API_KEY) {
      throw new Error('Nayax API key not configured');
    }
    
    const requestBody: NayaxVoidRequest = {
      TransactionId: transactionId,
    };
    
    const response = await fetch(`${NAYAX_API_URL}/payment/void`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${NAYAX_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });
    
    if (!response.ok) {
      throw new Error(`Nayax API error: ${response.statusText}`);
    }
    
    const data: NayaxVoidResponse = await response.json();
    return data;
  }
  
  // ==================== MACHINE STATUS (LYNX TELEMETRY) ====================
  
  /**
   * Get machine status via Lynx API (Enhanced with firmware tracking)
   */
  static async getMachineStatus(terminalId: string): Promise<{
    isAvailable: boolean;
    state: string;
    temperature?: number;
    pressure?: number;
    shampooLevel?: number;
    conditionerLevel?: number;
    firmwareVersion?: string;
    connectionStatus?: string;
  }> {
    if (!NAYAX_API_KEY) {
      throw new Error('Nayax API key not configured');
    }
    
    const response = await fetch(`${NAYAX_API_URL}/device/status/${terminalId}`, {
      headers: {
        'Authorization': `Bearer ${NAYAX_API_KEY}`,
      },
    });
    
    if (!response.ok) {
      throw new Error(`Nayax API error: ${response.statusText}`);
    }
    
    const data: NayaxTelemetryResponse = await response.json();
    
    // Store telemetry snapshot with enhanced data
    const stationId = await this.getStationIdForTerminal(terminalId);
    
    await db.insert(nayaxTelemetry).values({
      terminalId,
      stationId: stationId || 'unknown',
      state: data.State,
      waterTemp: data.Telemetry.WaterTemp?.toString(),
      waterPressure: data.Telemetry.WaterPressure?.toString(),
      shampooLevel: data.Telemetry.ShampooLevel,
      conditionerLevel: data.Telemetry.ConditionerLevel,
      isOnline: data.State !== 'Offline',
      lastPingAt: new Date(),
      errorCode: data.ErrorCode,
      errorMessage: data.ErrorMessage,
    });
    
    return {
      isAvailable: data.State === 'Idle',
      state: data.State,
      temperature: data.Telemetry.WaterTemp,
      pressure: data.Telemetry.WaterPressure,
      shampooLevel: data.Telemetry.ShampooLevel,
      conditionerLevel: data.Telemetry.ConditionerLevel,
      firmwareVersion: (data as any).FirmwareVersion,
      connectionStatus: (data as any).ConnectionStatus,
    };
  }
  
  /**
   * Create Nayax loyalty card (for QR-based loyalty program)
   * Based on user's production code
   */
  static async createLoyaltyCard(params: {
    customerName: string;
    loyaltyId: string;
    customerUid: string;
  }): Promise<{
    success: boolean;
    message: string;
    nayaxCardId?: string;
  }> {
    if (!NAYAX_API_KEY) {
      throw new Error('Nayax API key not configured');
    }
    
    logger.info('[Nayax] Creating loyalty card', {
      customerName: params.customerName,
      loyaltyId: params.loyaltyId,
    });
    
    try {
      const cardData = {
        CardHolderName: params.customerName,
        CardUniqueIdentifier: params.loyaltyId,
        CardType: 33, // Prepaid Card type
        CardPhysicalType: 943237560, // QR Code type
      };
      
      const response = await fetch(`${NAYAX_API_URL}/lynx/v1/cards`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${NAYAX_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(cardData),
      });
      
      if (response.status === 201) {
        const data = await response.json();
        
        logger.info('[Nayax] Loyalty card created successfully', {
          customerName: params.customerName,
          nayaxCardId: data.id,
        });
        
        return {
          success: true,
          message: 'Loyalty card created successfully',
          nayaxCardId: data.id,
        };
      } else {
        const errorText = await response.text();
        logger.error('[Nayax] Failed to create loyalty card', { error: errorText });
        
        return {
          success: false,
          message: `Failed to create card: ${errorText}`,
        };
      }
    } catch (error: any) {
      logger.error('[Nayax] Loyalty card creation error', { error: error.message });
      return {
        success: false,
        message: 'System error during card creation',
      };
    }
  }
  
  // ==================== QR REDEMPTION ====================
  
  /**
   * Redeem QR code (loyalty/voucher) and optionally trigger free/discounted wash
   */
  static async redeemQrCode(params: QrRedemptionParams): Promise<{
    success: boolean;
    message: string;
    discountAmount?: number;
    discountPercent?: number;
    transactionId?: string;
    washType?: string;
    isFreeWash?: boolean;
  }> {
    const { qrCode, customerUid, stationId, terminalId } = params;
    
    const finalTerminalId = terminalId || NAYAX_TERMINAL_ID_MAIN;
    if (!finalTerminalId) {
      throw new Error('Nayax terminal ID not configured');
    }
    
    logger.info(`[Nayax] Redeeming QR code`, { qrCode, customerUid, stationId });
    
    try {
      // Generate redemption hash (prevent double-spend GLOBALLY)
      // Hash the QR code alone - not per-customer
      const redemptionHash = crypto
        .createHash('sha256')
        .update(qrCode)
        .digest('hex');
      
      // Check for duplicate redemption (GLOBAL check - any customer)
      const existingRedemption = await db
        .select()
        .from(nayaxQrRedemptions)
        .where(
          and(
            eq(nayaxQrRedemptions.redemptionHash, redemptionHash),
            eq(nayaxQrRedemptions.status, 'success')
          )
        )
        .limit(1);
      
      if (existingRedemption.length > 0) {
        return {
          success: false,
          message: 'This QR code has already been used',
        };
      }
      
      // Decode QR code (format: TYPE:ID:AMOUNT or TYPE:ID:PERCENT)
      // Examples:
      // - VOUCHER:abc123:50 (50 ILS voucher)
      // - LOYALTY:gold:20 (20% loyalty discount)
      // - GIFT:def456:100 (100 ILS gift card)
      // - FREE:premium:0 (Free premium wash)
      
      const qrParts = qrCode.split(':');
      if (qrParts.length < 2) {
        return {
          success: false,
          message: 'Invalid QR code format',
        };
      }
      
      const [type, id, valueStr] = qrParts;
      const value = parseFloat(valueStr || '0');
      
      let discountAmount = 0;
      let discountPercent = 0;
      let washType = 'standard';
      let isFreeWash = false;
      
      // Handle different QR types
      switch (type.toUpperCase()) {
        case 'VOUCHER':
          // Fixed amount discount (ILS)
          discountAmount = value;
          break;
        
        case 'LOYALTY':
          // Percentage discount based on tier
          discountPercent = value;
          break;
        
        case 'GIFT':
          // Gift card - full amount discount
          discountAmount = value;
          break;
        
        case 'FREE':
          // Free wash (e.g., promotional, employee perk)
          isFreeWash = true;
          washType = id; // premium, standard, basic
          discountPercent = 100;
          break;
        
        default:
          return {
            success: false,
            message: `Unknown QR code type: ${type}`,
          };
      }
      
      // Log redemption attempt
      const redemptionId = `qr_${Date.now()}_${nanoid(12)}`;
      
      await db.insert(nayaxQrRedemptions).values({
        qrCode,
        qrType: type.toLowerCase(),
        customerUid,
        stationId,
        discountAmount: discountAmount > 0 ? discountAmount.toString() : null,
        discountPercent,
        status: 'pending',
        terminalId: finalTerminalId,
        redemptionHash,
      });
      
      // If free wash, trigger remote vend immediately
      if (isFreeWash) {
        logger.info(`[Nayax] Triggering free wash via QR redemption`, {
          redemptionId,
          washType,
        });
        
        // Create a zero-cost transaction for audit trail
        const transactionId = `tx_free_${Date.now()}_${nanoid(12)}`;
        const externalTransactionId = `ext_qr_${Date.now()}`;
        
        await db.insert(nayaxTransactions).values({
          id: transactionId,
          externalTransactionId,
          status: 'initiated',
          amount: '0',
          currency: 'ILS',
          washType,
          stationId,
          terminalId: finalTerminalId,
          customerUid,
          customerToken: 'QR_REDEMPTION',
        });
        
        // Execute remote vend
        const vendResult = await this.executeRemoteVend({
          terminalId: finalTerminalId,
          productCode: washType,
          transactionId: externalTransactionId,
        });
        
        if (vendResult.Status === 'SUCCESS') {
          // Mark as redeemed
          await db.update(nayaxQrRedemptions)
            .set({
              status: 'success',
            })
            .where(eq(nayaxQrRedemptions.redemptionHash, redemptionHash));
          
          await db.update(nayaxTransactions)
            .set({
              status: 'settled',
              settledAt: new Date(),
            })
            .where(eq(nayaxTransactions.id, transactionId));
          
          // Record audit entry
          await db.insert(auditLedger).values({
            id: `audit_qr_${Date.now()}_${nanoid(12)}`,
            eventType: 'qr_redemption',
            customerUid,
            metadata: JSON.stringify({
              qrType: type,
              washType,
              redemptionId,
              transactionId,
            }),
            ipAddress: null,
            userAgent: null,
            previousHash: null,
          });
          
          logger.info(`[Nayax] Free wash started successfully via QR`, {
            redemptionId,
            transactionId,
          });
          
          return {
            success: true,
            message: 'Free wash started successfully!',
            transactionId,
            washType,
            isFreeWash: true,
            discountPercent: 100,
          };
        } else {
          // Vend failed
          await db.update(nayaxQrRedemptions)
            .set({
              status: 'failed',
            })
            .where(eq(nayaxQrRedemptions.redemptionHash, redemptionHash));
          
          await db.update(nayaxTransactions)
            .set({
              status: 'failed',
              failedAt: new Date(),
              errorMessage: vendResult.Message || 'Vend failed',
            })
            .where(eq(nayaxTransactions.id, transactionId));
          
          return {
            success: false,
            message: 'Failed to start wash. Please try again.',
          };
        }
      }
      
      // For discount vouchers/loyalty, mark as success and return discount info
      await db.update(nayaxQrRedemptions)
        .set({
          status: 'success',
        })
        .where(eq(nayaxQrRedemptions.redemptionHash, redemptionHash));
      
      return {
        success: true,
        message: `Discount applied: ${discountPercent > 0 ? `${discountPercent}%` : `₪${discountAmount}`}`,
        discountAmount,
        discountPercent,
        washType,
        isFreeWash: false,
      };
      
    } catch (error: any) {
      logger.error(`[Nayax] QR redemption failed`, {
        qrCode,
        customerUid,
        error: error.message,
      });
      
      return {
        success: false,
        message: 'QR redemption failed. Please try again.',
      };
    }
  }
  
  // ==================== REMOTE CONTROL OPERATIONS ====================
  
  /**
   * Remote K9000 Activation (Based on user's Node.js code)
   * Activates wash cycle remotely via Nayax Spark/Lynx API
   * 
   * Use case: Dashboard emergency test, free promotional washes, maintenance testing
   */
  static async remoteActivateWash(params: {
    terminalId: string;
    stationId: string;
    washProgramId: number | string; // 1=Basic, 2=Standard, 3=Premium, etc.
    sessionTimeoutSec?: number;
    userId?: string; // For loyalty tracking
    amount?: number; // ILS amount (optional, for paid remote activation)
  }): Promise<{
    success: boolean;
    message_heb: string;
    message_en: string;
    nayaxResponse?: any;
  }> {
    const {
      terminalId,
      stationId,
      washProgramId,
      sessionTimeoutSec = 300, // Default 5 minutes
      userId = 'admin',
      amount = 0
    } = params;
    
    if (!NAYAX_API_KEY) {
      throw new Error('Nayax API key not configured');
    }
    
    logger.info('[Nayax] Remote wash activation requested', {
      terminalId,
      stationId,
      washProgramId,
      userId,
    });
    
    try {
      // Nayax Spark/Marshall Remote Device Start API
      const nayax_start_url = `${NAYAX_API_URL}/device/${terminalId}/start`;
      
      const start_payload = {
        Amount: amount,
        CurrencyCode: 'ILS',
        ControlData: {
          ServiceCode: washProgramId, // Wash program selection
          SessionTimeoutSec: sessionTimeoutSec,
          CustomUserId: userId, // Loyalty card integration
        }
      };
      
      const nayax_response = await fetch(nayax_start_url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${NAYAX_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(start_payload)
      });
      
      const nayax_data = await nayax_response.json();
      
      // Handle Nayax response
      if (nayax_response.ok && (nayax_data.Status === 'Success' || nayax_data.Status === 'SUCCESS')) {
        
        logger.info(`[Nayax] K9000 activated successfully`, {
          terminalId,
          stationId,
          washProgramId,
        });
        
        // Log to audit trail
        await db.insert(auditLedger).values({
          id: `audit_remote_start_${Date.now()}_${nanoid(12)}`,
          eventType: 'k9000_remote_activation',
          customerUid: userId,
          metadata: JSON.stringify({
            terminalId,
            stationId,
            washProgramId,
            amount,
            sessionTimeoutSec,
          }),
          ipAddress: null,
          userAgent: 'K9000_DASHBOARD',
          previousHash: null,
        });
        
        return {
          success: true,
          message_heb: `השטיפה הופעלה! התחל/י לשטוף את הכלב. סכום: ${amount} ₪`,
          message_en: `Wash activated! Start washing your dog. Amount: ₪${amount}`,
          nayaxResponse: nayax_data
        };
        
      } else {
        logger.error('[Nayax] Remote activation failed', {
          terminalId,
          nayaxError: nayax_data,
        });
        
        return {
          success: false,
          message_heb: 'כשל בהפעלת המכונה דרך Nayax.',
          message_en: 'Failed to activate machine via Nayax.',
          nayaxResponse: nayax_data
        };
      }
      
    } catch (error: any) {
      logger.error('[Nayax] Remote activation error', {
        terminalId,
        error: error.message,
      });
      
      return {
        success: false,
        message_heb: 'שגיאת שרת פנימית בחיבור ל-Nayax.',
        message_en: 'Internal server error connecting to Nayax.',
      };
    }
  }
  
  /**
   * Remote Emergency Stop / Cancel Vend
   * Stops a wash cycle in progress via Nayax API
   */
  static async remoteStopWash(params: {
    terminalId: string;
    stationId: string;
    reason?: string;
  }): Promise<{
    success: boolean;
    message_heb: string;
    message_en: string;
    nayaxResponse?: any;
  }> {
    const { terminalId, stationId, reason = 'Emergency stop' } = params;
    
    if (!NAYAX_API_KEY) {
      throw new Error('Nayax API key not configured');
    }
    
    logger.warn('[Nayax] Remote emergency stop requested', {
      terminalId,
      stationId,
      reason,
    });
    
    try {
      // Nayax Spark/Marshall Remote Device Stop/Cancel API
      const nayax_stop_url = `${NAYAX_API_URL}/device/${terminalId}/stop`;
      
      const stop_payload = {
        Reason: reason,
        ForceStop: true, // Emergency stop - immediate
      };
      
      const nayax_response = await fetch(nayax_stop_url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${NAYAX_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(stop_payload)
      });
      
      const nayax_data = await nayax_response.json();
      
      // Handle Nayax response
      if (nayax_response.ok && (nayax_data.Status === 'Success' || nayax_data.Status === 'SUCCESS')) {
        
        logger.info(`[Nayax] K9000 stopped successfully`, {
          terminalId,
          stationId,
          reason,
        });
        
        // Log to audit trail
        await db.insert(auditLedger).values({
          id: `audit_emergency_stop_${Date.now()}_${nanoid(12)}`,
          eventType: 'k9000_emergency_stop',
          customerUid: 'admin',
          metadata: JSON.stringify({
            terminalId,
            stationId,
            reason,
          }),
          ipAddress: null,
          userAgent: 'K9000_DASHBOARD',
          previousHash: null,
        });
        
        return {
          success: true,
          message_heb: `המכונה נעצרה בהצלחה. סיבה: ${reason}`,
          message_en: `Machine stopped successfully. Reason: ${reason}`,
          nayaxResponse: nayax_data
        };
        
      } else {
        logger.error('[Nayax] Remote stop failed', {
          terminalId,
          nayaxError: nayax_data,
        });
        
        return {
          success: false,
          message_heb: 'כשל בעצירת המכונה דרך Nayax.',
          message_en: 'Failed to stop machine via Nayax.',
          nayaxResponse: nayax_data
        };
      }
      
    } catch (error: any) {
      logger.error('[Nayax] Remote stop error', {
        terminalId,
        error: error.message,
      });
      
      return {
        success: false,
        message_heb: 'שגיאת שרת פנימית בחיבור ל-Nayax.',
        message_en: 'Internal server error connecting to Nayax.',
      };
    }
  }
  
  // ==================== HELPER METHODS ====================
  
  /**
   * Get station ID for a given terminal ID
   */
  private static async getStationIdForTerminal(terminalId: string): Promise<string | null> {
    // Query from your stations database
    // This is a placeholder - implement based on your station schema
    return null;
  }
  
  /**
   * Get transaction by ID
   */
  static async getTransaction(id: string) {
    const [transaction] = await db
      .select()
      .from(nayaxTransactions)
      .where(eq(nayaxTransactions.id, id))
      .limit(1);
    
    return transaction;
  }
  
  /**
   * Get transactions for a customer
   */
  static async getCustomerTransactions(customerUid: string, limit: number = 10) {
    return await db
      .select()
      .from(nayaxTransactions)
      .where(eq(nayaxTransactions.customerUid, customerUid))
      .orderBy(desc(nayaxTransactions.createdAt))
      .limit(limit);
  }
}
