/**
 * Provider Payout Service - Israeli Bank Transfer Only
 * 
 * Processes provider payouts after 72hr escrow release
 * MANDATE: Israeli bank transfers ONLY - NO STRIPE EVER
 * 
 * Flow:
 * 1. Escrow expires after 72 hours
 * 2. Auto-release job finds expired escrows
 * 3. Process payout via Israeli bank transfer
 * 4. Update payout status to 'completed'
 */

import { db } from "../db";
import { superAppPayouts, providers } from "@shared/schema";
import { eq, and, lte, sql } from "drizzle-orm";
import { logger } from "../lib/logger";
import { nanoid } from "nanoid";
import { AIPayoutVerificationService } from "./AIPayoutVerificationService";

export class ProviderPayoutService {
  
  /**
   * Find all escrows ready for release (72 hours passed)
   */
  static async findExpiredEscrows(): Promise<any[]> {
    try {
      const now = new Date();
      
      const expired = await db.select()
        .from(superAppPayouts)
        .where(
          and(
            eq(superAppPayouts.status, 'in_escrow'),
            lte(superAppPayouts.escrowReleaseDate, now)
          )
        );

      logger.info('[ProviderPayout] Found expired escrows', {
        count: expired.length,
      });

      return expired;
    } catch (error) {
      logger.error('[ProviderPayout] Error finding expired escrows', error);
      throw error;
    }
  }

  /**
   * Release escrow and process payout
   * Updates status from 'in_escrow' → 'processing' → 'completed'
   * MANDATORY: AI verification before payout release
   */
  static async releaseEscrowAndPayout(payoutId: string, skipAIVerification = false): Promise<{
    success: boolean;
    error?: string;
    aiVerification?: {
      verified: boolean;
      confidenceScore: number;
      riskLevel: string;
    };
  }> {
    try {
      // Get payout record
      const [payout] = await db.select()
        .from(superAppPayouts)
        .where(eq(superAppPayouts.id, payoutId))
        .limit(1);

      if (!payout) {
        return {
          success: false,
          error: 'Payout not found',
        };
      }

      if (payout.status !== 'in_escrow') {
        return {
          success: false,
          error: `Payout not in escrow (status: ${payout.status})`,
        };
      }

      // STEP 1: AI Verification (Gemini 2.5 Flash)
      if (!skipAIVerification) {
        logger.info('[ProviderPayout] Running AI verification before payout', { payoutId });
        
        const aiResult = await AIPayoutVerificationService.verifyWorkForPayout(payoutId);
        
        if (!aiResult.verified) {
          logger.warn('[ProviderPayout] AI verification failed - payout blocked', {
            payoutId,
            confidenceScore: aiResult.confidenceScore,
            riskLevel: aiResult.riskLevel,
            issues: aiResult.issues,
          });

          // Update payout with verification failure
          await db.update(superAppPayouts)
            .set({
              aiVerified: false,
              aiVerificationScore: aiResult.confidenceScore,
              aiRiskLevel: aiResult.riskLevel,
              aiVerificationNotes: aiResult.issues.join('; '),
              updatedAt: new Date(),
            })
            .where(eq(superAppPayouts.id, payoutId));

          return {
            success: false,
            error: `AI verification failed: ${aiResult.issues.join('; ')}`,
            aiVerification: {
              verified: aiResult.verified,
              confidenceScore: aiResult.confidenceScore,
              riskLevel: aiResult.riskLevel,
            },
          };
        }

        logger.info('[ProviderPayout] AI verification passed', {
          payoutId,
          confidenceScore: aiResult.confidenceScore,
          riskLevel: aiResult.riskLevel,
        });
      }

      // Get provider bank details
      const [provider] = await db.select()
        .from(providers)
        .where(eq(providers.id, payout.providerId))
        .limit(1);

      if (!provider) {
        return {
          success: false,
          error: 'Provider not found',
        };
      }

      // Update status to 'processing'
      await db.update(superAppPayouts)
        .set({
          status: 'processing',
          processedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(superAppPayouts.id, payoutId));

      logger.info('[ProviderPayout] Processing payout', {
        payoutId,
        providerId: payout.providerId,
        netAmount: payout.netAmount,
      });

      // Process Israeli bank transfer
      const transferResult = await this.processIsraeliBankTransfer(payout, provider);

      if (transferResult.success) {
        // Update status to 'completed'
        await db.update(superAppPayouts)
          .set({
            status: 'completed',
            bankTransferReference: transferResult.bankTransferReference,
            paidAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(superAppPayouts.id, payoutId));

        logger.info('[ProviderPayout] Payout completed', {
          payoutId,
          bankTransferReference: transferResult.bankTransferReference,
          netAmount: payout.netAmount,
        });

        return {
          success: true,
        };
      } else {
        // Mark as failed
        await db.update(superAppPayouts)
          .set({
            status: 'failed',
            failureReason: transferResult.error,
            updatedAt: new Date(),
          })
          .where(eq(superAppPayouts.id, payoutId));

        logger.error('[ProviderPayout] Payout failed', {
          payoutId,
          error: transferResult.error,
        });

        return {
          success: false,
          error: transferResult.error,
        };
      }
    } catch (error) {
      logger.error('[ProviderPayout] Error releasing escrow', error, { payoutId });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to release escrow',
      };
    }
  }

  /**
   * Process Israeli Bank Transfer
   * 
   * PRODUCTION: Integrate with Israeli bank API (Bank Hapoalim, Leumi, etc.)
   * DEVELOPMENT: Stub implementation with simulated ACH reference
   */
  private static async processIsraeliBankTransfer(
    payout: any,
    provider: any
  ): Promise<{
    success: boolean;
    bankTransferReference?: string;
    error?: string;
  }> {
    try {
      // Validate provider has bank details
      if (!provider.bankAccountNumber || !provider.bankName) {
        return {
          success: false,
          error: 'Provider bank details not configured',
        };
      }

      logger.info('[ProviderPayout] Initiating Israeli bank transfer', {
        providerId: provider.id,
        providerName: provider.name,
        bankName: provider.bankName,
        netAmount: payout.netAmount,
        currency: payout.currency,
      });

      // STUB: Production would call Israeli bank API here
      // Example integration points:
      // - Bank Hapoalim API
      // - Bank Leumi API
      // - Israeli ACH network
      // - Mizrahi-Tefahot Bank API
      
      const bankTransferReference = `IL_ACH_${Date.now()}_${nanoid(8).toUpperCase()}`;

      logger.info('[ProviderPayout] Israeli bank transfer simulated (STUB)', {
        bankTransferReference,
        netAmount: payout.netAmount,
        providerId: provider.id,
      });

      return {
        success: true,
        bankTransferReference,
      };

      // PRODUCTION CODE (commented out):
      /*
      const transferResult = await IsraeliBankAPI.initiateTransfer({
        accountNumber: provider.bankAccountNumber,
        bankCode: provider.bankCode,
        branchCode: provider.bankBranchCode,
        accountHolderName: provider.legalName || provider.name,
        amount: parseFloat(payout.netAmount),
        currency: 'ILS',
        description: `Pet Wash payout - Booking ${payout.bookingId}`,
        reference: `PETWASH_${payout.id}`,
      });

      if (transferResult.success) {
        return {
          success: true,
          bankTransferReference: transferResult.referenceNumber,
        };
      } else {
        return {
          success: false,
          error: transferResult.errorMessage,
        };
      }
      */

    } catch (error) {
      logger.error('[ProviderPayout] Bank transfer error', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Bank transfer failed',
      };
    }
  }

  /**
   * Auto-release expired escrows (background job)
   * Called by cron job every hour
   */
  static async autoReleaseExpiredEscrows(): Promise<{
    released: number;
    failed: number;
    errors: string[];
  }> {
    try {
      const expiredEscrows = await this.findExpiredEscrows();
      
      let released = 0;
      let failed = 0;
      const errors: string[] = [];

      for (const escrow of expiredEscrows) {
        const result = await this.releaseEscrowAndPayout(escrow.id);
        
        if (result.success) {
          released++;
        } else {
          failed++;
          errors.push(`Payout ${escrow.id}: ${result.error}`);
        }
      }

      logger.info('[ProviderPayout] Auto-release job completed', {
        total: expiredEscrows.length,
        released,
        failed,
      });

      return {
        released,
        failed,
        errors,
      };
    } catch (error) {
      logger.error('[ProviderPayout] Auto-release job error', error);
      throw error;
    }
  }

  /**
   * Get provider payout history
   */
  static async getProviderPayouts(providerId: number, limit = 50): Promise<any[]> {
    try {
      const payouts = await db.select()
        .from(superAppPayouts)
        .where(eq(superAppPayouts.providerId, providerId))
        .limit(limit)
        .orderBy(sql`${superAppPayouts.createdAt} DESC`);

      return payouts;
    } catch (error) {
      logger.error('[ProviderPayout] Error fetching provider payouts', error);
      throw error;
    }
  }

  /**
   * Get payout by ID
   */
  static async getPayoutById(payoutId: string): Promise<any | null> {
    try {
      const [payout] = await db.select()
        .from(superAppPayouts)
        .where(eq(superAppPayouts.id, payoutId))
        .limit(1);

      return payout || null;
    } catch (error) {
      logger.error('[ProviderPayout] Error fetching payout', error);
      throw error;
    }
  }

  /**
   * Cancel escrow and refund customer (for booking cancellations)
   */
  static async cancelEscrowAndRefund(payoutId: string, reason: string): Promise<{
    success: boolean;
    error?: string;
  }> {
    try {
      const [payout] = await db.select()
        .from(superAppPayouts)
        .where(eq(superAppPayouts.id, payoutId))
        .limit(1);

      if (!payout) {
        return {
          success: false,
          error: 'Payout not found',
        };
      }

      if (payout.status !== 'in_escrow') {
        return {
          success: false,
          error: `Cannot cancel payout with status: ${payout.status}`,
        };
      }

      // Update status to 'failed' (escrow cancelled)
      await db.update(superAppPayouts)
        .set({
          status: 'failed',
          failureReason: `Cancelled: ${reason}`,
          updatedAt: new Date(),
        })
        .where(eq(superAppPayouts.id, payoutId));

      logger.info('[ProviderPayout] Escrow cancelled for refund', {
        payoutId,
        reason,
      });

      // TODO: Trigger Nayax refund webhook to actually refund customer

      return {
        success: true,
      };
    } catch (error) {
      logger.error('[ProviderPayout] Error cancelling escrow', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to cancel escrow',
      };
    }
  }
}

export default ProviderPayoutService;
