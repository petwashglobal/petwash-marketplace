/**
 * NAYAX JOB DISPATCH PAYMENT SERVICE
 * 
 * Two-phase payment flow for Uber/Airbnb-style operator dispatch:
 * 1. AUTHORIZE (Hold): When booking created → Hold customer's card (don't charge yet)
 * 2. CAPTURE: When operator accepts → Actually charge the held amount
 * 3. VOID: If no operator accepts or timeout → Release the hold
 * 
 * This is different from existing Nayax services which do authorize+capture in one step.
 * 
 * Payment Timeline:
 * - Customer books → AUTHORIZE (payment held)
 * - Operator accepts (within 15 min) → CAPTURE (customer charged)
 * - No acceptance / timeout → VOID (hold released)
 * 
 * Israeli Compliance: Nayax Israel, ILS currency, full audit trail
 */

import { db } from "../db";
import { paymentIntents } from "@shared/schema";
import { eq, and, sql, lt } from "drizzle-orm";
import { logger } from "../lib/logger";
import { nanoid } from "nanoid";

// ==================== TYPE DEFINITIONS ====================

interface NayaxAuthorizeRequest {
  TerminalId: string;
  Amount: number; // In agorot (Israeli cents)
  Currency: string; // "ILS"
  Token: string; // Customer payment token
  ExternalTransactionId: string;
  Description: string;
  HoldOnly: boolean; // true for authorize-only (don't capture yet)
}

interface NayaxAuthorizeResponse {
  Status: 'SUCCESS' | 'FAILED' | 'DECLINED';
  AuthorizationId?: string; // Reference for future capture/void
  ExpiresAt?: string; // ISO timestamp when hold expires
  Message?: string;
  DeclineReason?: string;
}

interface NayaxCaptureRequest {
  AuthorizationId: string;
  Amount?: number; // Optional: partial capture
  ExternalTransactionId: string;
}

interface NayaxCaptureResponse {
  Status: 'SUCCESS' | 'FAILED';
  TransactionId?: string; // Final transaction ID
  Message?: string;
}

interface NayaxVoidRequest {
  AuthorizationId: string;
  Reason: string;
}

interface NayaxVoidResponse {
  Status: 'SUCCESS' | 'FAILED';
  Message?: string;
}

export interface AuthorizePaymentParams {
  bookingId: string;
  platform: 'sitter_suite' | 'walk_my_pet' | 'pet_trek';
  amountCents: number;
  currency: string;
  customerPaymentToken: string;
  terminalId?: string;
  metadata?: Record<string, any>;
}

export interface CapturePaymentParams {
  paymentIntentId: string;
  amountCents?: number; // Optional partial capture
}

export interface VoidPaymentParams {
  paymentIntentId: string;
  reason: string;
}

// ==================== NAYAX JOB DISPATCH PAYMENT SERVICE ====================

export class NayaxJobDispatchPaymentService {
  
  private static readonly NAYAX_API_URL = process.env.NAYAX_API_URL || 'https://api.nayax.com/spark/v1';
  private static readonly NAYAX_API_KEY = process.env.NAYAX_API_KEY;
  private static readonly NAYAX_TERMINAL_ID = process.env.NAYAX_TERMINAL_ID;
  private static readonly DEFAULT_AUTH_EXPIRY_MINUTES = 30; // Default hold duration
  
  /**
   * PHASE 1: AUTHORIZE (Hold) Payment
   * 
   * Call when booking is created - holds customer's card but doesn't charge yet
   * Returns payment intent ID for later capture/void
   */
  static async authorizePayment(params: AuthorizePaymentParams): Promise<{
    success: boolean;
    paymentIntentId?: string;
    error?: string;
  }> {
    try {
      logger.info('[Nayax Job Dispatch] Authorizing payment', {
        bookingId: params.bookingId,
        platform: params.platform,
        amountILS: (params.amountCents / 100).toFixed(2),
      });

      // Prepare authorization request
      const authRequest: NayaxAuthorizeRequest = {
        TerminalId: params.terminalId || this.NAYAX_TERMINAL_ID || '',
        Amount: params.amountCents,
        Currency: params.currency,
        Token: params.customerPaymentToken,
        ExternalTransactionId: `AUTH_${params.platform.toUpperCase()}_${params.bookingId}_${nanoid(8)}`,
        Description: `${params.platform} - Booking ${params.bookingId} (Authorization)`,
        HoldOnly: true, // CRITICAL: Don't capture yet!
      };

      // Call Nayax authorize endpoint
      const authResponse = await this.callNayaxAuthorizeAPI(authRequest);

      if (authResponse.Status === 'SUCCESS' && authResponse.AuthorizationId) {
        // Calculate expiry time (Nayax provides it, or use default)
        const expiresAt = authResponse.ExpiresAt 
          ? new Date(authResponse.ExpiresAt)
          : new Date(Date.now() + this.DEFAULT_AUTH_EXPIRY_MINUTES * 60 * 1000);

        // Create payment intent record
        const [paymentIntent] = await db.insert(paymentIntents).values({
          id: nanoid(),
          bookingId: params.bookingId,
          platform: params.platform,
          amountCents: params.amountCents,
          currency: params.currency,
          status: 'authorized',
          authorizationId: authResponse.AuthorizationId,
          expiresAt,
          metadata: params.metadata || {},
          createdAt: new Date(),
        }).returning();

        logger.info('[Nayax Job Dispatch] Payment authorized successfully', {
          paymentIntentId: paymentIntent.id,
          authorizationId: authResponse.AuthorizationId,
          expiresAt: expiresAt.toISOString(),
        });

        return {
          success: true,
          paymentIntentId: paymentIntent.id,
        };
      } else {
        logger.error('[Nayax Job Dispatch] Authorization failed', {
          bookingId: params.bookingId,
          status: authResponse.Status,
          reason: authResponse.DeclineReason || authResponse.Message,
        });

        return {
          success: false,
          error: authResponse.DeclineReason || authResponse.Message || 'Authorization failed',
        };
      }
    } catch (error) {
      logger.error('[Nayax Job Dispatch] Authorization error', { error });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * PHASE 2: CAPTURE Payment
   * 
   * Call when operator accepts job - actually charges the held amount
   */
  static async capturePayment(params: CapturePaymentParams): Promise<{
    success: boolean;
    transactionId?: string;
    error?: string;
  }> {
    try {
      // Get payment intent
      const [intent] = await db.select()
        .from(paymentIntents)
        .where(eq(paymentIntents.id, params.paymentIntentId))
        .limit(1);

      if (!intent) {
        return { success: false, error: 'Payment intent not found' };
      }

      if (intent.status !== 'authorized') {
        return { success: false, error: `Payment already ${intent.status}` };
      }

      if (!intent.authorizationId) {
        return { success: false, error: 'Missing authorization ID' };
      }

      // Check if authorization expired
      if (intent.expiresAt && new Date() > intent.expiresAt) {
        await db.update(paymentIntents)
          .set({ status: 'expired', updatedAt: new Date() })
          .where(eq(paymentIntents.id, params.paymentIntentId));
        
        return { success: false, error: 'Authorization expired' };
      }

      logger.info('[Nayax Job Dispatch] Capturing payment', {
        paymentIntentId: params.paymentIntentId,
        authorizationId: intent.authorizationId,
        amountILS: (intent.amountCents / 100).toFixed(2),
      });

      // Prepare capture request
      const captureRequest: NayaxCaptureRequest = {
        AuthorizationId: intent.authorizationId,
        Amount: params.amountCents, // Optional partial capture
        ExternalTransactionId: `CAPTURE_${intent.platform.toUpperCase()}_${intent.bookingId}_${nanoid(8)}`,
      };

      // Call Nayax capture endpoint
      const captureResponse = await this.callNayaxCaptureAPI(captureRequest);

      if (captureResponse.Status === 'SUCCESS' && captureResponse.TransactionId) {
        // Update payment intent
        await db.update(paymentIntents)
          .set({
            status: 'captured',
            capturedAt: new Date(),
            transactionId: captureResponse.TransactionId,
            updatedAt: new Date(),
          })
          .where(eq(paymentIntents.id, params.paymentIntentId));

        logger.info('[Nayax Job Dispatch] Payment captured successfully', {
          paymentIntentId: params.paymentIntentId,
          transactionId: captureResponse.TransactionId,
        });

        return {
          success: true,
          transactionId: captureResponse.TransactionId,
        };
      } else {
        // Capture failed - mark intent
        await db.update(paymentIntents)
          .set({
            status: 'capture_failed',
            errorMessage: captureResponse.Message,
            updatedAt: new Date(),
          })
          .where(eq(paymentIntents.id, params.paymentIntentId));

        logger.error('[Nayax Job Dispatch] Capture failed', {
          paymentIntentId: params.paymentIntentId,
          message: captureResponse.Message,
        });

        // TODO: Alert ops team for manual intervention
        // TODO: Consider auto-void if Nayax says auth no longer valid

        return {
          success: false,
          error: captureResponse.Message || 'Capture failed',
        };
      }
    } catch (error) {
      logger.error('[Nayax Job Dispatch] Capture error', { error });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * PHASE 3: VOID (Cancel) Authorization
   * 
   * Call when no operator accepts or timeout - releases the hold
   */
  static async voidPayment(params: VoidPaymentParams): Promise<{
    success: boolean;
    error?: string;
  }> {
    try {
      // Get payment intent
      const [intent] = await db.select()
        .from(paymentIntents)
        .where(eq(paymentIntents.id, params.paymentIntentId))
        .limit(1);

      if (!intent) {
        return { success: false, error: 'Payment intent not found' };
      }

      if (intent.status !== 'authorized') {
        return { success: false, error: `Payment already ${intent.status}` };
      }

      if (!intent.authorizationId) {
        return { success: false, error: 'Missing authorization ID' };
      }

      logger.info('[Nayax Job Dispatch] Voiding authorization', {
        paymentIntentId: params.paymentIntentId,
        authorizationId: intent.authorizationId,
        reason: params.reason,
      });

      // Prepare void request
      const voidRequest: NayaxVoidRequest = {
        AuthorizationId: intent.authorizationId,
        Reason: params.reason,
      };

      // Call Nayax void endpoint
      const voidResponse = await this.callNayaxVoidAPI(voidRequest);

      if (voidResponse.Status === 'SUCCESS') {
        // Update payment intent
        await db.update(paymentIntents)
          .set({
            status: 'voided',
            voidedAt: new Date(),
            voidReason: params.reason,
            updatedAt: new Date(),
          })
          .where(eq(paymentIntents.id, params.paymentIntentId));

        logger.info('[Nayax Job Dispatch] Authorization voided successfully', {
          paymentIntentId: params.paymentIntentId,
        });

        return { success: true };
      } else {
        logger.error('[Nayax Job Dispatch] Void failed', {
          paymentIntentId: params.paymentIntentId,
          message: voidResponse.Message,
        });

        return {
          success: false,
          error: voidResponse.Message || 'Void failed',
        };
      }
    } catch (error) {
      logger.error('[Nayax Job Dispatch] Void error', { error });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Auto-void expired authorizations (called by cron/background worker)
   * 
   * Finds payment intents that are about to expire and voids them
   */
  static async autoVoidExpiredAuthorizations(): Promise<{
    voidedCount: number;
    errors: Array<{ paymentIntentId: string; error: string }>;
  }> {
    try {
      logger.info('[Nayax Job Dispatch] Running auto-void sweep for expired authorizations');

      // Find authorized intents that expire within 5 minutes
      const expiringIntents = await db.select()
        .from(paymentIntents)
        .where(
          and(
            eq(paymentIntents.status, 'authorized'),
            lt(paymentIntents.expiresAt, new Date(Date.now() + 5 * 60 * 1000))
          )
        );

      const errors: Array<{ paymentIntentId: string; error: string }> = [];
      let voidedCount = 0;

      for (const intent of expiringIntents) {
        const result = await this.voidPayment({
          paymentIntentId: intent.id,
          reason: 'Auto-void: Authorization expiring soon',
        });

        if (result.success) {
          voidedCount++;
        } else {
          errors.push({
            paymentIntentId: intent.id,
            error: result.error || 'Unknown error',
          });
        }
      }

      logger.info('[Nayax Job Dispatch] Auto-void sweep complete', {
        totalFound: expiringIntents.length,
        voidedCount,
        errorCount: errors.length,
      });

      return { voidedCount, errors };
    } catch (error) {
      logger.error('[Nayax Job Dispatch] Auto-void sweep error', { error });
      return { voidedCount: 0, errors: [] };
    }
  }

  // ==================== NAYAX API CALLS ====================

  private static async callNayaxAuthorizeAPI(request: NayaxAuthorizeRequest): Promise<NayaxAuthorizeResponse> {
    try {
      // Development mode: Simulate successful authorization
      if (process.env.NODE_ENV === 'development') {
        logger.info('[Nayax Job Dispatch - DEV MODE] Simulating authorization', {
          amount: request.Amount,
          currency: request.Currency,
        });

        return {
          Status: 'SUCCESS',
          AuthorizationId: `AUTH_SIM_${nanoid(16)}`,
          ExpiresAt: new Date(Date.now() + this.DEFAULT_AUTH_EXPIRY_MINUTES * 60 * 1000).toISOString(),
          Message: 'Authorization successful (development mode)',
        };
      }

      // Production: Call actual Nayax API
      if (!this.NAYAX_API_KEY) {
        throw new Error('NAYAX_API_KEY not configured');
      }

      const response = await fetch(`${this.NAYAX_API_URL}/payments/authorize`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.NAYAX_API_KEY}`,
        },
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        throw new Error(`Nayax API error: ${response.statusText}`);
      }

      const result: NayaxAuthorizeResponse = await response.json();
      return result;
    } catch (error) {
      logger.error('[Nayax Job Dispatch] Authorize API call failed', { error });
      return {
        Status: 'FAILED',
        Message: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  private static async callNayaxCaptureAPI(request: NayaxCaptureRequest): Promise<NayaxCaptureResponse> {
    try {
      // Development mode: Simulate successful capture
      if (process.env.NODE_ENV === 'development') {
        logger.info('[Nayax Job Dispatch - DEV MODE] Simulating capture', {
          authorizationId: request.AuthorizationId,
        });

        return {
          Status: 'SUCCESS',
          TransactionId: `TXN_SIM_${nanoid(16)}`,
          Message: 'Capture successful (development mode)',
        };
      }

      // Production: Call actual Nayax API
      if (!this.NAYAX_API_KEY) {
        throw new Error('NAYAX_API_KEY not configured');
      }

      const response = await fetch(`${this.NAYAX_API_URL}/payments/capture`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.NAYAX_API_KEY}`,
        },
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        throw new Error(`Nayax API error: ${response.statusText}`);
      }

      const result: NayaxCaptureResponse = await response.json();
      return result;
    } catch (error) {
      logger.error('[Nayax Job Dispatch] Capture API call failed', { error });
      return {
        Status: 'FAILED',
        Message: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  private static async callNayaxVoidAPI(request: NayaxVoidRequest): Promise<NayaxVoidResponse> {
    try {
      // Development mode: Simulate successful void
      if (process.env.NODE_ENV === 'development') {
        logger.info('[Nayax Job Dispatch - DEV MODE] Simulating void', {
          authorizationId: request.AuthorizationId,
          reason: request.Reason,
        });

        return {
          Status: 'SUCCESS',
          Message: 'Void successful (development mode)',
        };
      }

      // Production: Call actual Nayax API
      if (!this.NAYAX_API_KEY) {
        throw new Error('NAYAX_API_KEY not configured');
      }

      const response = await fetch(`${this.NAYAX_API_URL}/payments/void`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.NAYAX_API_KEY}`,
        },
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        throw new Error(`Nayax API error: ${response.statusText}`);
      }

      const result: NayaxVoidResponse = await response.json();
      return result;
    } catch (error) {
      logger.error('[Nayax Job Dispatch] Void API call failed', { error });
      return {
        Status: 'FAILED',
        Message: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}

// Export singleton for convenience
export default NayaxJobDispatchPaymentService;
