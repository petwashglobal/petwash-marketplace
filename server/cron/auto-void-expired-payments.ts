/**
 * AUTO-VOID EXPIRED PAYMENT HOLDS
 * 
 * Cron job that runs every 5 minutes to automatically void expired payment authorizations
 * 
 * Critical for customer satisfaction:
 * - Prevents overcharging customers when operators don't respond
 * - Releases funds back to customer's card
 * - Maintains PCI DSS compliance (no unauthorized holds)
 * 
 * 2025 USA Competitor Standards (Uber, DoorDash, Airbnb):
 * - Auto-release after timeout (typically 10-15 minutes)
 * - Customer notification
 * - Automatic refund processing
 */

import cron from 'node-cron';
import { db } from '../db';
import { paymentIntents, jobOffers } from '@shared/schema';
import { eq, and, lt, sql } from 'drizzle-orm';
import { logger } from '../lib/logger';
import NayaxJobDispatchPaymentService from '../services/NayaxJobDispatchPaymentService';

/**
 * Find and void expired payment authorizations
 * 
 * Criteria:
 * - status = 'authorized' (not yet captured)
 * - created > 15 minutes ago
 * - associated job offer is not accepted
 */
async function voidExpiredPayments() {
  try {
    logger.info('[AutoVoid] Starting expired payment scan');
    
    const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);
    
    // Find expired authorized payments
    const expiredPayments = await db.select()
      .from(paymentIntents)
      .where(and(
        eq(paymentIntents.status, 'authorized'),
        lt(paymentIntents.createdAt, fifteenMinutesAgo)
      ))
      .limit(50); // Process in batches to avoid overwhelming Nayax API
    
    // Filter out payments with accepted job offers
    // CRITICAL: Use jobOfferId foreign key to check exact offer status
    const filteredPayments = [];
    for (const payment of expiredPayments) {
      try {
        // If no job offer linked, safe to void (orphaned payment authorization)
        if (!payment.jobOfferId) {
          filteredPayments.push(payment);
          continue;
        }
        
        // Fetch the exact job offer using foreign key relationship
        const [offer] = await db.select()
          .from(jobOffers)
          .where(eq(jobOffers.id, payment.jobOfferId))
          .limit(1);
        
        // Only void if no job offer found OR job offer not accepted
        if (!offer || offer.status !== 'accepted') {
          filteredPayments.push(payment);
        }
      } catch (error) {
        // If job offer doesn't exist, void the payment
        filteredPayments.push(payment);
      }
    }
    
    if (filteredPayments.length === 0) {
      logger.info('[AutoVoid] No expired payments found');
      return;
    }
    
    logger.info('[AutoVoid] Found expired payments', {
      total: expiredPayments.length,
      filtered: filteredPayments.length,
    });
    
    // Void each expired payment
    const results = await Promise.allSettled(
      filteredPayments.map(async (paymentIntent) => {
        try {
          const result = await NayaxJobDispatchPaymentService.voidPayment(
            paymentIntent.id!,
            'Booking expired - no operator accepted'
          );
          
          if (result.success) {
            logger.info('[AutoVoid] Payment voided successfully', {
              paymentIntentId: paymentIntent.id,
              bookingId: paymentIntent.bookingId,
              amountCents: paymentIntent.amountCents,
            });
          } else {
            logger.error('[AutoVoid] Failed to void payment', {
              paymentIntentId: paymentIntent.id,
              error: result.error,
            });
          }
          
          return result;
        } catch (error) {
          logger.error('[AutoVoid] Void payment exception', {
            paymentIntentId: paymentIntent.id,
            error,
          });
          throw error;
        }
      })
    );
    
    const successful = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;
    
    logger.info('[AutoVoid] Batch complete', {
      total: filteredPayments.length,
      successful,
      failed,
    });
    
  } catch (error) {
    logger.error('[AutoVoid] Cron job error', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
  }
}

/**
 * Initialize cron job
 * 
 * Runs every 5 minutes (cron: star-slash-5-star-star-star-star)
 */
export function startAutoVoidCron() {
  logger.info('[AutoVoid] Initializing auto-void cron job (every 5 minutes)');
  
  // Run every 5 minutes
  cron.schedule('*/5 * * * *', async () => {
    await voidExpiredPayments();
  });
  
  // Also run immediately on startup (catch any missed during downtime)
  setTimeout(async () => {
    logger.info('[AutoVoid] Running initial scan on startup');
    await voidExpiredPayments();
  }, 10000); // Wait 10 seconds for server to fully initialize
  
  logger.info('[AutoVoid] Cron job started successfully');
}

export default startAutoVoidCron;
