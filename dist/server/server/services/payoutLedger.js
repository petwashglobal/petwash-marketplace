import { db } from '../db';
import { contractorEarnings } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { logger } from '../lib/logger';
import { nanoid } from 'nanoid';
import { feeConfigService } from './FeeConfigurationService';
/**
 * Create earning record with automatic escrow and VAT calculation
 */
export async function createEarningRecord(params) {
    try {
        const { contractorId, contractorType, bookingType, bookingId, baseAmount, bonusAmount = 0, platformFeePercent, dayCount, hourCount, walkDurationMinutes, walkDistanceKm, tripDistanceKm, tollCharges, } = params;
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
    }
    catch (error) {
        logger.error('[PayoutLedger] Error creating earning record', { error });
        throw error;
    }
}
/**
 * Calculate sitter earnings (day/hour rates)
 */
export async function calculateSitterEarnings(contractorId, bookingId, dayCount, hourCount, dailyRate, hourlyRate, bonusAmount = 0) {
    try {
        // Calculate base amount
        const baseAmount = dayCount * dailyRate + hourCount * hourlyRate;
        // Platform fee: 18% for all providers (MadPaws 2026 model)
        const feeRates = feeConfigService.getFeeRates();
        const platformFeePercent = feeRates.providerServiceFeePercent;
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
    }
    catch (error) {
        logger.error('[PayoutLedger] Error calculating sitter earnings', { error });
        throw error;
    }
}
/**
 * Calculate walker earnings (GPS time/distance)
 */
export async function calculateWalkerEarnings(contractorId, bookingId, walkDurationMinutes, walkDistanceKm, minuteRate, distanceRate, bonusAmount = 0) {
    try {
        // Calculate base amount (time + distance components)
        const timeComponent = (walkDurationMinutes / 60) * minuteRate;
        const distanceComponent = walkDistanceKm * distanceRate;
        const baseAmount = timeComponent + distanceComponent;
        // Platform fee: 18% for all providers (MadPaws 2026 model)
        const feeRates = feeConfigService.getFeeRates();
        const platformFeePercent = feeRates.providerServiceFeePercent;
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
    }
    catch (error) {
        logger.error('[PayoutLedger] Error calculating walker earnings', { error });
        throw error;
    }
}
/**
 * Calculate driver earnings (mileage + tolls)
 */
export async function calculateDriverEarnings(contractorId, bookingId, tripDistanceKm, tollCharges, perKmRate, bonusAmount = 0) {
    try {
        // Calculate base amount (distance + tolls)
        const distanceAmount = tripDistanceKm * perKmRate;
        const baseAmount = distanceAmount + tollCharges;
        // Platform fee: 18% for all providers (MadPaws 2026 model)
        const feeRates = feeConfigService.getFeeRates();
        const platformFeePercent = feeRates.providerServiceFeePercent;
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
    }
    catch (error) {
        logger.error('[PayoutLedger] Error calculating driver earnings', { error });
        throw error;
    }
}
/**
 * Release escrow payment (called after 72 hours)
 */
export async function releaseEscrow(earningId) {
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
    }
    catch (error) {
        logger.error('[PayoutLedger] Error releasing escrow', { earningId, error });
        throw error;
    }
}
/**
 * Process payout to contractor bank account
 *
 * COMPLIANCE: Pet Wash Ltd payout architecture (2026):
 * - ALL providers: Israeli bank transfer ONLY (ACH/Isracard rails)
 * - Nayax Israel payment gateway (exclusive)
 * - NO Stripe, NO international payment processors
 *
 * Security:
 * - Runtime validation ensures only 'bank_transfer' accepted
 * - Rejects any non-Israeli transfer attempts
 */
export async function processPayout(earningId, payoutMethod, payoutTransactionId) {
    // CRITICAL: Validate Israeli bank transfer only
    if (payoutMethod !== 'bank_transfer') {
        throw new Error(`Invalid payout method: ${payoutMethod}. Only Israeli bank transfers allowed.`);
    }
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
            throw new Error(`Earning ${earningId} cannot be paid out (status: ${earning.payoutStatus})`);
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
    }
    catch (error) {
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
                }
                catch (error) {
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
    }
    catch (error) {
        logger.error('[PayoutLedger] Error in auto-release job', { error });
        throw error;
    }
}
