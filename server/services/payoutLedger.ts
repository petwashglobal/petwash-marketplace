import { db } from '../db';
import { contractorEarnings, sitterBookings, walkBookings, pettrekTrips } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { logger } from '../lib/logger';
import { nanoid } from 'nanoid';

/**
 * Financial Payout Ledger Service (2026 Spec)
 * 
 * Role-specific earnings calculation:
 * - Sitters: Charged by day/hour
 * - Walkers: Charged by GPS time/distance
 * - Drivers: Charged by mileage + tolls
 * 
 * Features:
 * - 72-hour escrow hold
 * - Automatic VAT calculation (18% Israeli compliance)
 * - Platform fee deduction
 * - Tax reporting integration
 */

interface CreateEarningParams {
  contractorId: string;
  contractorType: 'sitter' | 'walker' | 'driver';
  bookingType: 'sitter' | 'walker' | 'pettrek';
  bookingId: string;
  baseAmount: number;
  bonusAmount?: number;
  platformFeePercent: number; // e.g., 15 = 15%
  
  // Role-specific params
  dayCount?: number; // For sitters
  hourCount?: number; // For sitters
  walkDurationMinutes?: number; // For walkers
  walkDistanceKm?: number; // For walkers
  tripDistanceKm?: number; // For drivers
  tollCharges?: number; // For drivers
}

/**
 * Create earning record with automatic escrow and VAT calculation
 */
export async function createEarningRecord(params: CreateEarningParams) {
  try {
    const {
      contractorId,
      contractorType,
      bookingType,
      bookingId,
      baseAmount,
      bonusAmount = 0,
      platformFeePercent,
      dayCount,
      hourCount,
      walkDurationMinutes,
      walkDistanceKm,
      tripDistanceKm,
      tollCharges,
    } = params;

    // Calculate platform fee
    const platformFee = (baseAmount * platformFeePercent) / 100;

    // Calculate VAT (18% on commission only, effective Jan 1, 2025)
    // VAT is calculated on the platform fee, not the full amount
    const vatAmount = (platformFee * 18) / 100;

    // Calculate net earnings
    const netEarnings = baseAmount + bonusAmount - platformFee - vatAmount;

    // Generate unique earning ID
    const earningId = `EARN-${new Date().getFullYear()}-${nanoid(6).toUpperCase()}`;

    // 72-hour escrow release date
    const escrowReleaseDate = new Date();
    escrowReleaseDate.setHours(escrowReleaseDate.getHours() + 72);

    // Determine tax year and quarter
    const now = new Date();
    const taxYear = now.getFullYear();
    const taxQuarter = Math.floor(now.getMonth() / 3) + 1;

    // Insert earning record
    const [earning] = await db
      .insert(contractorEarnings)
      .values({
        earningId,
        contractorId,
        contractorType,
        bookingType,
        bookingId,
        baseAmount: baseAmount.toString(),
        bonusAmount: bonusAmount.toString(),
        platformFee: platformFee.toString(),
        vatAmount: vatAmount.toString(),
        netEarnings: netEarnings.toString(),
        currency: 'ILS',
        payoutStatus: 'in_escrow',
        escrowReleaseDate,
        // Role-specific fields
        dayCount: dayCount || null,
        hourCount: hourCount?.toString() || null,
        walkDurationMinutes: walkDurationMinutes || null,
        walkDistanceKm: walkDistanceKm?.toString() || null,
        tripDistanceKm: tripDistanceKm?.toString() || null,
        tollCharges: tollCharges?.toString() || null,
        // Tax reporting
        taxYear,
        taxQuarter,
        includeInTaxReport: true,
      })
      .returning();

    logger.info('[PayoutLedger] Earning record created', {
      earningId,
      contractorId,
      baseAmount,
      platformFee,
      vatAmount,
      netEarnings,
      escrowReleaseDate,
    });

    return earning;
  } catch (error) {
    logger.error('[PayoutLedger] Error creating earning record', { error });
    throw error;
  }
}

/**
 * Calculate sitter earnings (day/hour rates)
 */
export async function calculateSitterEarnings(
  contractorId: string,
  bookingId: string,
  dayCount: number,
  hourCount: number,
  dailyRate: number,
  hourlyRate: number,
  bonusAmount: number = 0
) {
  try {
    // Calculate base amount
    const baseAmount = dayCount * dailyRate + hourCount * hourlyRate;

    // Platform fee: 15% for sitters
    const platformFeePercent = 15;

    return await createEarningRecord({
      contractorId,
      contractorType: 'sitter',
      bookingType: 'sitter',
      bookingId,
      baseAmount,
      bonusAmount,
      platformFeePercent,
      dayCount,
      hourCount,
    });
  } catch (error) {
    logger.error('[PayoutLedger] Error calculating sitter earnings', { error });
    throw error;
  }
}

/**
 * Calculate walker earnings (GPS time/distance)
 */
export async function calculateWalkerEarnings(
  contractorId: string,
  bookingId: string,
  walkDurationMinutes: number,
  walkDistanceKm: number,
  minuteRate: number,
  distanceRate: number,
  bonusAmount: number = 0
) {
  try {
    // Calculate base amount (time + distance components)
    const timeComponent = (walkDurationMinutes / 60) * minuteRate;
    const distanceComponent = walkDistanceKm * distanceRate;
    const baseAmount = timeComponent + distanceComponent;

    // Platform fee: 12% for walkers
    const platformFeePercent = 12;

    return await createEarningRecord({
      contractorId,
      contractorType: 'walker',
      bookingType: 'walker',
      bookingId,
      baseAmount,
      bonusAmount,
      platformFeePercent,
      walkDurationMinutes,
      walkDistanceKm,
    });
  } catch (error) {
    logger.error('[PayoutLedger] Error calculating walker earnings', { error });
    throw error;
  }
}

/**
 * Calculate driver earnings (mileage + tolls)
 */
export async function calculateDriverEarnings(
  contractorId: string,
  bookingId: string,
  tripDistanceKm: number,
  tollCharges: number,
  perKmRate: number,
  bonusAmount: number = 0
) {
  try {
    // Calculate base amount (distance + tolls)
    const distanceAmount = tripDistanceKm * perKmRate;
    const baseAmount = distanceAmount + tollCharges;

    // Platform fee: 10% for drivers (lower due to tolls)
    const platformFeePercent = 10;

    return await createEarningRecord({
      contractorId,
      contractorType: 'driver',
      bookingType: 'pettrek',
      bookingId,
      baseAmount,
      bonusAmount,
      platformFeePercent,
      tripDistanceKm,
      tollCharges,
    });
  } catch (error) {
    logger.error('[PayoutLedger] Error calculating driver earnings', { error });
    throw error;
  }
}

/**
 * Release escrow payment (called after 72 hours)
 */
export async function releaseEscrow(earningId: string) {
  try {
    const [earning] = await db
      .select()
      .from(contractorEarnings)
      .where(eq(contractorEarnings.earningId, earningId))
      .limit(1);

    if (!earning) {
      throw new Error(`Earning ${earningId} not found`);
    }

    if (earning.payoutStatus !== 'in_escrow') {
      throw new Error(`Earning ${earningId} is not in escrow (status: ${earning.payoutStatus})`);
    }

    // Check if 72 hours have passed
    const now = new Date();
    if (earning.escrowReleaseDate && new Date(earning.escrowReleaseDate) > now) {
      throw new Error(`Earning ${earningId} escrow period not yet expired`);
    }

    // Release from escrow
    await db
      .update(contractorEarnings)
      .set({
        payoutStatus: 'released',
        updatedAt: now,
      })
      .where(eq(contractorEarnings.earningId, earningId));

    logger.info('[PayoutLedger] Escrow released', {
      earningId,
      netEarnings: earning.netEarnings,
      contractorId: earning.contractorId,
    });

    return true;
  } catch (error) {
    logger.error('[PayoutLedger] Error releasing escrow', { earningId, error });
    throw error;
  }
}

/**
 * Process payout to contractor bank account
 * 
 * COMPLIANCE: Pet Wash Ltd mandate - All payouts via Israeli bank transfer only.
 * No third-party payment processors (PayPal, Stripe, etc.) allowed.
 */
export async function processPayout(
  earningId: string,
  payoutMethod: 'bank_transfer',
  payoutTransactionId: string
) {
  try {
    const [earning] = await db
      .select()
      .from(contractorEarnings)
      .where(eq(contractorEarnings.earningId, earningId))
      .limit(1);

    if (!earning) {
      throw new Error(`Earning ${earningId} not found`);
    }

    if (earning.payoutStatus !== 'released') {
      throw new Error(
        `Earning ${earningId} cannot be paid out (status: ${earning.payoutStatus})`
      );
    }

    // Mark as paid out
    const now = new Date();
    await db
      .update(contractorEarnings)
      .set({
        payoutStatus: 'paid_out',
        paidOutAt: now,
        payoutMethod,
        payoutTransactionId,
        updatedAt: now,
      })
      .where(eq(contractorEarnings.earningId, earningId));

    logger.info('[PayoutLedger] Payout processed', {
      earningId,
      netEarnings: earning.netEarnings,
      contractorId: earning.contractorId,
      payoutMethod,
      payoutTransactionId,
    });

    return true;
  } catch (error) {
    logger.error('[PayoutLedger] Error processing payout', { earningId, error });
    throw error;
  }
}

/**
 * Auto-release expired escrows (background job)
 */
export async function autoReleaseExpiredEscrows() {
  try {
    const now = new Date();

    // Find all escrows that have expired
    const expiredEscrows = await db
      .select()
      .from(contractorEarnings)
      .where(eq(contractorEarnings.payoutStatus, 'in_escrow'));

    const released = [];
    for (const earning of expiredEscrows) {
      if (earning.escrowReleaseDate && new Date(earning.escrowReleaseDate) <= now) {
        try {
          await releaseEscrow(earning.earningId);
          released.push(earning.earningId);
        } catch (error) {
          logger.error('[PayoutLedger] Error auto-releasing escrow', {
            earningId: earning.earningId,
            error,
          });
        }
      }
    }

    logger.info('[PayoutLedger] Auto-released expired escrows', {
      count: released.length,
      earningIds: released,
    });

    return released;
  } catch (error) {
    logger.error('[PayoutLedger] Error in auto-release job', { error });
    throw error;
  }
}
