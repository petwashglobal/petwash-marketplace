/**
 * WALK MY PET™ - Nayax Marketplace Payment Service
 *
 * ⚠️  STATUS 2026-08-26: ORPHANED / SUPERSEDED.
 *
 * Zero active callers (Lane C audit, verified via full-repo grep of
 * `NayaxWalkMarketplaceService`). The last importer at
 * server/services/PaymentGatewayService.ts:21 never referenced the
 * symbol and was removed on 2026-08-26.
 *
 * ⚠️  MONEY-MODEL INCOMPATIBILITY: the docstring below describes the
 * OLD "Base + 18% VAT on top" pricing model (₪100 → owner pays ₪118).
 * The CURRENT rule enforced by server/utils/walkFeeCalculator.ts is
 * VAT EXTRACTED FROM THE DISPLAYED PRICE (18/118) — the same rule the
 * sitter and academy pipelines use. Re-activating this file without
 * rewriting against walkFeeCalculator would recreate the exact
 * money-leak the audit flagged.
 *
 * ⚠️  If the walk card rail lands (design note:
 * docs/design/2026-08-26-booking-accept-dispatcher.md §"walk"), it
 * MUST delegate to walkFeeCalculator + walletService and MUST NOT
 * restore this service.
 *
 * File is retained (not deleted) per CEO safety directive: "Never
 * delete legacy code without proof no current caller AND a written
 * replacement". The replacement is scoped in the design note above;
 * deletion happens once the walk card rail PR lands.
 *
 * ── Original docstring (for archaeology only — DO NOT trust as spec) ──
 * Marketplace payment processing using NAYAX ISRAEL (חברה בורסאית יציבה)
 * Owner pays: Base + 18% VAT (INCORRECT under current rules).
 */

import { calculateWalkFees, validateWalkFeeCalculation, type WalkFeeCalculation } from '../utils/walkFeeCalculator';
import { logger } from '../lib/logger';
import { nanoid } from 'nanoid';

// ==================== TYPE DEFINITIONS ====================

interface NayaxPaymentRequest {
  TerminalId: string;
  Amount: number; // In agorot (Israeli cents)
  Currency: string; // Always "ILS"
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

interface WalkBookingPaymentParams {
  bookingId: string;
  walkId: number;
  ownerId: string;
  walkerId: string;
  basePriceCents: number; // Walker's rate in agorot
  ownerPaymentToken: string;
  terminalId?: string;
}

interface WalkerPayoutParams {
  walkId: number;
  walkerId: string;
  walkerPayoutCents: number;
  walkerBankAccount: string; // Or Nayax wallet identifier
}

// ==================== NAYAX WALK MARKETPLACE SERVICE ====================

export class NayaxWalkMarketplaceService {
  
  private static readonly NAYAX_API_URL = process.env.NAYAX_API_URL || process.env.NAYAX_BASE_URL || 'https://api.nayax.com/spark/v1';
  private static readonly NAYAX_API_KEY = process.env.NAYAX_API_KEY;
  private static readonly NAYAX_TERMINAL_ID = process.env.NAYAX_TERMINAL_ID;
  private static readonly CURRENCY = 'ILS'; // Israeli Shekel ONLY
  
  /**
   * Process walk booking payment from owner (via Nayax Israel)
   * 
   * Owner pays: Base Price + 18% VAT
   * Platform receives: Total amount
   * Platform splits: 15% commission, 85% held for walker payout
   * 
   * PetWash™ marketplace model with Israeli compliance ✨
   */
  static async processWalkPayment(params: WalkBookingPaymentParams): Promise<{
    success: boolean;
    nayaxTransactionId?: string;
    fees: WalkFeeCalculation;
    error?: string;
  }> {
    try {
      // Calculate transparent fees with Israeli VAT
      const fees = calculateWalkFees(params.basePriceCents);
      
      // Validate fee calculation integrity
      if (!validateWalkFeeCalculation(fees)) {
        throw new Error('Fee calculation validation failed');
      }
      
      logger.info('[⁦Walk My Pet™⁩] Processing walk payment', {
        walkId: params.walkId,
        bookingId: params.bookingId,
        basePriceILS: fees.basePrice,
        totalChargeWithVAT: fees.totalChargeWithVAT,
        platformCommissionTotal: fees.platformCommissionTotal,
        walkerPayout: fees.walkerPayout,
      });
      
      // Prepare Nayax payment request
      const paymentRequest: NayaxPaymentRequest = {
        TerminalId: params.terminalId || this.NAYAX_TERMINAL_ID || '',
        Amount: fees.totalChargeWithVATCents, // Charge owner full amount including VAT
        Currency: this.CURRENCY,
        Token: params.ownerPaymentToken,
        ExternalTransactionId: `WALK_${params.walkId}_${nanoid(10)}`,
        Description: `⁦Walk My Pet™⁩ - Walk #${params.walkId}`,
      };
      
      // Call Nayax Israel API to authorize and capture payment
      const nayaxResponse = await this.callNayaxPaymentAPI(paymentRequest);
      
      if (nayaxResponse.Status === 'SUCCESS' && nayaxResponse.TransactionId) {
        logger.info('[⁦Walk My Pet™⁩] Payment successful', {
          walkId: params.walkId,
          nayaxTransactionId: nayaxResponse.TransactionId,
          platformRevenue: fees.platformCommissionTotal, // Our 15% platform commission 💰
          ownerFee: fees.platformServiceFeeOwner,
          walkerFee: fees.walkerFee,
          vatCollected: fees.vat,
        });
        
        return {
          success: true,
          nayaxTransactionId: nayaxResponse.TransactionId,
          fees,
        };
      } else {
        logger.error('[⁦Walk My Pet™⁩] Payment failed', {
          walkId: params.walkId,
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
      logger.error('[⁦Walk My Pet™⁩] Payment processing error', error);
      
      const fees = calculateWalkFees(params.basePriceCents);
      
      return {
        success: false,
        fees,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
  
  /**
   * Process walker payout after GPS-verified walk completion (via Nayax Transfer)
   * 
   * Walker receives: 85% of base price
   * Platform keeps: 15% commission
   * 
   * Triggered automatically after WalkSessionService.checkOut() confirms completion
   */
  static async processWalkerPayout(params: WalkerPayoutParams): Promise<{
    success: boolean;
    payoutReference?: string;
    error?: string;
  }> {
    try {
      logger.info('[⁦Walk My Pet™⁩] Processing walker payout', {
        walkId: params.walkId,
        walkerId: params.walkerId,
        payoutCents: params.walkerPayoutCents,
        payoutILS: (params.walkerPayoutCents / 100).toFixed(2),
      });
      
      // TODO: Integrate with Nayax payout/transfer API when API keys are provided
      // For now, log the payout request for manual processing
      logger.info('[⁦Walk My Pet™⁩] Walker payout queued (awaiting Nayax API keys)', {
        walkId: params.walkId,
        walkerId: params.walkerId,
        amountILS: (params.walkerPayoutCents / 100).toFixed(2),
        bankAccountLast4: params.walkerBankAccount ? '****' + String(params.walkerBankAccount).slice(-4) : null,
        paymentGateway: 'Nayax Israel',
      });
      
      // FAIL-CLOSED (no-fake-money rule): the real Nayax payout/transfer API is not
      // wired yet, so we refuse to report a successful transfer that didn't happen.
      // The request is logged above for manual processing; the caller must treat this
      // as 'pending', never 'paid'.
      return {
        success: false,
        error: 'Walker payout not transferred — real Nayax payout API not wired yet (logged for manual processing).',
        payoutReference: `WALK_PAYOUT_${params.walkId}_${nanoid(10)}`,
      };

    } catch (error) {
      logger.error('[⁦Walk My Pet™⁩] Payout processing error', error);
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
  
  /**
   * Call Nayax Israel Payment API
   * 
   * Production: Uses actual Nayax Spark API endpoints
   * Development: Simulates successful payment for testing
   */
  private static async callNayaxPaymentAPI(request: NayaxPaymentRequest): Promise<NayaxPaymentResponse> {
    try {
      if (!this.NAYAX_API_KEY) {
        // In production, a missing API key is a hard error — never silently succeed.
        if (process.env.NODE_ENV === 'production') {
          throw new Error(
            '[NayaxWalkMarketplace] FATAL: NAYAX_API_KEY is not configured. ' +
            'Walk payments cannot be processed. Set NAYAX_API_KEY in production secrets.'
          );
        }

        // Development only: log prominently so no one thinks real money moved.
        logger.warn('[Walk My Pet™ - DEV MODE] NAYAX_API_KEY not set — walk payment SIMULATED. This must never run in production.', {
          amount: request.Amount,
          currency: request.Currency,
        });
        
        return {
          Status: 'SUCCESS',
          TransactionId: `SIM_NAYAX_${nanoid(16)}`,
          Message: 'Payment simulated (development mode only — no real charge)',
        };
      }
      
      const response = await fetch(`${this.NAYAX_API_URL}/payment/authorize`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.NAYAX_API_KEY}`,
        },
        body: JSON.stringify(request),
      });
      
      if (!response.ok) {
        throw new Error(`Nayax Israel API error: ${response.statusText}`);
      }
      
      const result: NayaxPaymentResponse = await response.json();
      return result;
      
    } catch (error) {
      logger.error('[⁦Walk My Pet™⁩] Nayax Israel API call failed', error);
      
      return {
        Status: 'FAILED',
        Message: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
  
  /**
   * Calculate walk booking total with fees (for display purposes)
   */
  static calculateWalkTotal(basePriceCents: number): WalkFeeCalculation {
    return calculateWalkFees(basePriceCents);
  }
  
  /**
   * Refund walk payment (if cancelled before completion)
   */
  static async refundWalkPayment(nayaxTransactionId: string, amountCents: number): Promise<{
    success: boolean;
    refundReference?: string;
    error?: string;
  }> {
    try {
      logger.info('[⁦Walk My Pet™⁩] Processing refund', {
        nayaxTransactionId,
        amountCents,
        amountILS: (amountCents / 100).toFixed(2),
      });
      
      // TODO: Integrate with Nayax Israel refund API when keys available
      logger.info('[⁦Walk My Pet™⁩] Refund queued (awaiting Nayax API keys)', {
        transactionId: nayaxTransactionId,
        amountILS: (amountCents / 100).toFixed(2),
        gateway: 'Nayax Israel',
      });
      
      // FAIL-CLOSED — real Nayax refund API not wired yet; never report a fake refund.
      return {
        success: false,
        error: 'Walk refund not executed — real Nayax refund API not wired yet (logged for manual processing).',
        refundReference: `WALK_REFUND_${nanoid(12)}`,
      };

    } catch (error) {
      logger.error('[⁦Walk My Pet™⁩] Refund processing error', error);
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}

// Export singleton for convenience
export const nayaxWalkMarketplace = NayaxWalkMarketplaceService;
