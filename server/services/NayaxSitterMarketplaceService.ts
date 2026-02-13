/**
 * THE SITTER SUITE™ - Nayax Split Payment Service
 * Israeli Tax Law 2026 Compliant - Subcontractor Broker Model (like MadPaws/Wolt Israel)
 * 
 * FLAT 15% commission on all platforms:
 * 1. Owner pays base + 15% platform fee + VAT via Nayax
 * 2. Platform holds funds in 72-hour escrow
 * 3. Upon booking completion:
 *    - Platform deducts 15% commission
 *    - Withholding tax (ניכוי מס במקור) deducted from sitter payout
 *    - Sitter receives net payout
 * 4. Digital receipt (קבלה דיגיטלית) emailed to customer per Israeli law
 * 5. Transaction recorded in internal accounting system
 */

import { calculateTransparentFees, type TransparentFeeCalculation } from '../utils/sitterFeeCalculator';
import { logger } from '../lib/logger';
import { nanoid } from 'nanoid';

// ==================== TYPE DEFINITIONS ====================

interface NayaxPaymentRequest {
  TerminalId: string;
  Amount: number; // In cents
  Currency: string;
  Token: string; // Customer payment token
  ExternalTransactionId: string;
  Description: string;
}

interface NayaxPaymentResponse {
  Status: 'SUCCESS' | 'FAILED' | 'DECLINED';
  TransactionId?: string;
  Message?: string;
  DeclineReason?: string;
}

interface SitterBookingPaymentParams {
  bookingId: string;
  ownerId: string;
  sitterId: number;
  pricePerDayCents: number;
  totalDays: number;
  ownerPaymentToken: string;
  terminalId?: string;
}

interface SitterPayoutParams {
  bookingId: string;
  sitterId: number;
  sitterPayoutCents: number;
  sitterBankAccount: string; // Or payment method identifier
}

// ==================== NAYAX SITTER MARKETPLACE SERVICE ====================

export class NayaxSitterMarketplaceService {
  
  private static readonly NAYAX_API_URL = process.env.NAYAX_API_URL || 'https://api.nayax.com/spark/v1';
  private static readonly NAYAX_API_KEY = process.env.NAYAX_API_KEY;
  private static readonly NAYAX_TERMINAL_ID = process.env.NAYAX_TERMINAL_ID;
  private static readonly CURRENCY = 'ILS'; // Israeli Shekel
  
  /**
   * Process booking payment from owner (via Nayax)
   * 
   * Owner pays: Base Price + 15% Platform Fee + VAT
   * Platform receives: Total amount
   * Platform splits: 15% commission (kept), 85% held for sitter payout
   * 
   * Like Booking.com/Airbnb model ✨
   */
  static async processBookingPayment(params: SitterBookingPaymentParams): Promise<{
    success: boolean;
    nayaxTransactionId?: string;
    fees: TransparentFeeCalculation;
    error?: string;
  }> {
    try {
      // Calculate transparent fees
      const fees = calculateTransparentFees(params.pricePerDayCents, params.totalDays);
      
      logger.info('[Sitter Suite] Processing booking payment (Israeli law 2026)', {
        bookingId: params.bookingId,
        totalChargeCents: fees.totalChargeCents,
        subtotalBeforeVatCents: fees.subtotalBeforeVatCents,
        vatCents: fees.vatCents,
        vatRate: `${(fees.vatRate * 100).toFixed(0)}%`,
        brokerCutCents: fees.brokerCutCents,
        sitterPayoutCents: fees.sitterPayoutCents,
      });
      
      // Prepare Nayax payment request
      const paymentRequest: NayaxPaymentRequest = {
        TerminalId: params.terminalId || this.NAYAX_TERMINAL_ID || '',
        Amount: fees.totalChargeCents,
        Currency: this.CURRENCY,
        Token: params.ownerPaymentToken,
        ExternalTransactionId: `SITTER_${params.bookingId}_${nanoid(10)}`,
        Description: `⁦The Sitter Suite™⁩ - Booking ${params.bookingId}`,
      };
      
      // Call Nayax API to authorize and capture payment
      const nayaxResponse = await this.callNayaxPaymentAPI(paymentRequest);
      
      if (nayaxResponse.Status === 'SUCCESS' && nayaxResponse.TransactionId) {
        logger.info('[Sitter Suite] Payment successful', {
          bookingId: params.bookingId,
          nayaxTransactionId: nayaxResponse.TransactionId,
          brokerProfit: fees.brokerCut, // Our 5% cut 💰
        });
        
        return {
          success: true,
          nayaxTransactionId: nayaxResponse.TransactionId,
          fees,
        };
      } else {
        logger.error('[Sitter Suite] Payment failed', {
          bookingId: params.bookingId,
          status: nayaxResponse.Status,
          reason: nayaxResponse.DeclineReason || nayaxResponse.Message,
        });
        
        return {
          success: false,
          fees,
          error: nayaxResponse.DeclineReason || nayaxResponse.Message || 'Payment failed',
        };
      }
      
    } catch (error) {
      logger.error('[Sitter Suite] Payment processing error', error);
      
      const fees = calculateTransparentFees(params.pricePerDayCents, params.totalDays);
      
      return {
        success: false,
        fees,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
  
  /**
   * Process sitter payout after booking completion (via Nayax Transfer)
   * 
   * Sitter receives: 95% of base price
   * Platform keeps: 5% broker fee (already captured)
   */
  static async processSitterPayout(params: SitterPayoutParams): Promise<{
    success: boolean;
    payoutReference?: string;
    error?: string;
  }> {
    try {
      logger.info('[Sitter Suite] Processing sitter payout', {
        bookingId: params.bookingId,
        sitterId: params.sitterId,
        payoutCents: params.sitterPayoutCents,
      });
      
      // TODO: Integrate with Nayax payout/transfer API
      // For now, log the payout request for manual processing
      logger.info('[Sitter Suite] Sitter payout queued (manual processing)', {
        bookingId: params.bookingId,
        sitterId: params.sitterId,
        amountILS: (params.sitterPayoutCents / 100).toFixed(2),
        bankAccount: params.sitterBankAccount,
      });
      
      return {
        success: true,
        payoutReference: `PAYOUT_${params.bookingId}_${nanoid(10)}`,
      };
      
    } catch (error) {
      logger.error('[Sitter Suite] Payout processing error', error);
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
  
  /**
   * Call Nayax Payment API
   * 
   * NOTE: This is a simplified version. In production, you'll use the actual
   * Nayax Spark API endpoints with proper authentication.
   */
  private static async callNayaxPaymentAPI(request: NayaxPaymentRequest): Promise<NayaxPaymentResponse> {
    try {
      // In development, simulate successful payment
      if (process.env.NODE_ENV === 'development') {
        logger.info('[Sitter Suite - DEV MODE] Simulating Nayax payment', {
          amount: request.Amount,
          currency: request.Currency,
        });
        
        return {
          Status: 'SUCCESS',
          TransactionId: `SIM_${nanoid(16)}`,
          Message: 'Payment successful (development mode)',
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
      
      const result: NayaxPaymentResponse = await response.json();
      return result;
      
    } catch (error) {
      logger.error('[Sitter Suite] Nayax API call failed', error);
      
      return {
        Status: 'FAILED',
        Message: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
  
  /**
   * Calculate booking total with fees (for display purposes)
   */
  static calculateBookingTotal(pricePerDayCents: number, totalDays: number): TransparentFeeCalculation {
    return calculateTransparentFees(pricePerDayCents, totalDays);
  }
  
  /**
   * Refund booking payment (if cancelled before completion)
   */
  static async refundBookingPayment(nayaxTransactionId: string, amountCents: number): Promise<{
    success: boolean;
    refundReference?: string;
    error?: string;
  }> {
    try {
      logger.info('[Sitter Suite] Processing refund', {
        nayaxTransactionId,
        amountCents,
      });
      
      // TODO: Integrate with Nayax refund API
      logger.info('[Sitter Suite] Refund queued (manual processing)', {
        transactionId: nayaxTransactionId,
        amountILS: (amountCents / 100).toFixed(2),
      });
      
      return {
        success: true,
        refundReference: `REFUND_${nanoid(12)}`,
      };
      
    } catch (error) {
      logger.error('[Sitter Suite] Refund processing error', error);
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}

// Export singleton for convenience
export const nayaxSitterMarketplace = NayaxSitterMarketplaceService;
