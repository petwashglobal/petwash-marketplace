/**
 * BOOKING LOCK SERVICE
 * 
 * 5-Minute Payment Lock System for Marketplace Bookings
 * Prevents double-booking and ensures smooth payment flow
 * 
 * Features:
 * - Acquire lock on availability slot (5-minute expiry)
 * - Validate lock before payment
 * - Release lock (manual or auto on expiry)
 * - Clean up expired locks
 */

import { db } from '../db';
import { availabilitySlots } from '@shared/schema';
import { eq, and, lt, isNull, or } from 'drizzle-orm';
import { sql } from 'drizzle-orm';
import crypto from 'crypto';

export interface LockSlotParams {
  slotId: number;
  userId: string; // Firebase UID
  lockDurationSeconds?: number; // Default: 300 (5 minutes)
}

export interface LockResult {
  success: boolean;
  lockToken?: string;
  expiresAt?: Date;
  message?: string;
}

export class BookingLockService {
  private static readonly DEFAULT_LOCK_DURATION = 5 * 60; // 5 minutes in seconds

  /**
   * Acquire a lock on an availability slot
   * Idempotent: If user already has active lock on this slot, return existing lock
   */
  static async acquireLock(params: LockSlotParams): Promise<LockResult> {
    const { slotId, userId, lockDurationSeconds = this.DEFAULT_LOCK_DURATION } = params;

    try {
      // First, clean up any expired locks
      await this.cleanupExpiredLocks();

      // Check if slot exists and is available
      const slot = await db.query.availabilitySlots.findFirst({
        where: eq(availabilitySlots.id, slotId),
      });

      if (!slot) {
        return {
          success: false,
          message: 'Availability slot not found',
        };
      }

      // Check if slot is already booked
      if (slot.status === 'booked' || slot.bookingId) {
        return {
          success: false,
          message: 'This time slot is already booked',
        };
      }

      // Check if user already has active lock on this slot
      const now = new Date();
      if (
        slot.lockedByUid === userId &&
        slot.lockExpiresAt &&
        new Date(slot.lockExpiresAt) > now
      ) {
        // Return existing lock
        return {
          success: true,
          lockToken: slot.lockToken!,
          expiresAt: new Date(slot.lockExpiresAt),
          message: 'Lock already active',
        };
      }

      // Check if slot is locked by another user
      if (
        slot.lockedByUid &&
        slot.lockedByUid !== userId &&
        slot.lockExpiresAt &&
        new Date(slot.lockExpiresAt) > now
      ) {
        return {
          success: false,
          message: 'This time slot is currently reserved by another user',
        };
      }

      // Acquire new lock - ATOMIC UPDATE with conditions
      const lockToken = crypto.randomBytes(16).toString('hex');
      const lockedAt = new Date();
      const lockExpiresAt = new Date(lockedAt.getTime() + lockDurationSeconds * 1000);

      // Atomic update: only succeed if slot is still available OR locked by this user
      const result = await db
        .update(availabilitySlots)
        .set({
          status: 'held',
          lockedByUid: userId,
          lockedAt,
          lockExpiresAt,
          lockToken,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(availabilitySlots.id, slotId),
            // Only update if:
            or(
              // 1. Slot is available (no lock)
              and(
                isNull(availabilitySlots.lockedByUid),
                or(
                  eq(availabilitySlots.status, 'available'),
                  eq(availabilitySlots.status, 'held')
                )
              ),
              // 2. OR lock expired (lockExpiresAt in past)
              lt(availabilitySlots.lockExpiresAt, now)
            ),
            // 3. AND not already booked
            isNull(availabilitySlots.bookingId)
          )
        );

      // Check if update actually happened (rowCount > 0 means lock acquired)
      if (!result.rowCount || result.rowCount === 0) {
        return {
          success: false,
          message: 'Slot was already reserved by another user just now',
        };
      }

      return {
        success: true,
        lockToken,
        expiresAt: lockExpiresAt,
        message: 'Slot reserved successfully',
      };
    } catch (error) {
      console.error('BookingLockService.acquireLock error:', error);
      return {
        success: false,
        message: 'Failed to acquire lock on time slot',
      };
    }
  }

  /**
   * Validate lock before payment
   * Checks if lock is still valid and owned by the user
   */
  static async validateLock(lockToken: string, userId: string): Promise<LockResult> {
    try {
      const slot = await db.query.availabilitySlots.findFirst({
        where: and(
          eq(availabilitySlots.lockToken, lockToken),
          eq(availabilitySlots.lockedByUid, userId)
        ),
      });

      if (!slot) {
        return {
          success: false,
          message: 'Lock not found or does not belong to you',
        };
      }

      const now = new Date();
      if (!slot.lockExpiresAt || new Date(slot.lockExpiresAt) <= now) {
        // Lock expired - release it
        await this.releaseLock(lockToken, userId);
        return {
          success: false,
          message: 'Lock has expired',
        };
      }

      return {
        success: true,
        lockToken: slot.lockToken!,
        expiresAt: new Date(slot.lockExpiresAt),
        message: 'Lock is valid',
      };
    } catch (error) {
      console.error('BookingLockService.validateLock error:', error);
      return {
        success: false,
        message: 'Failed to validate lock',
      };
    }
  }

  /**
   * Release lock (manual cancellation or after successful payment)
   */
  static async releaseLock(lockToken: string, userId: string): Promise<LockResult> {
    try {
      const slot = await db.query.availabilitySlots.findFirst({
        where: and(
          eq(availabilitySlots.lockToken, lockToken),
          eq(availabilitySlots.lockedByUid, userId)
        ),
      });

      if (!slot) {
        return {
          success: false,
          message: 'Lock not found or does not belong to you',
        };
      }

      // Release lock - set back to available if no booking
      await db
        .update(availabilitySlots)
        .set({
          status: slot.bookingId ? 'booked' : 'available',
          lockedByUid: null,
          lockedAt: null,
          lockExpiresAt: null,
          lockToken: null,
          updatedAt: new Date(),
        })
        .where(eq(availabilitySlots.id, slot.id));

      return {
        success: true,
        message: 'Lock released successfully',
      };
    } catch (error) {
      console.error('BookingLockService.releaseLock error:', error);
      return {
        success: false,
        message: 'Failed to release lock',
      };
    }
  }

  /**
   * Clean up expired locks
   * Called periodically or before acquiring new locks
   */
  static async cleanupExpiredLocks(): Promise<number> {
    try {
      const now = new Date();

      const result = await db
        .update(availabilitySlots)
        .set({
          status: 'available',
          lockedByUid: null,
          lockedAt: null,
          lockExpiresAt: null,
          lockToken: null,
          updatedAt: new Date(),
        })
        .where(
          and(
            lt(availabilitySlots.lockExpiresAt, now),
            isNull(availabilitySlots.bookingId) // Don't clean if already booked
          )
        );

      const cleanedCount = result.rowCount || 0;
      if (cleanedCount > 0) {
        console.log(`BookingLockService: Cleaned up ${cleanedCount} expired locks`);
      }

      return cleanedCount;
    } catch (error) {
      console.error('BookingLockService.cleanupExpiredLocks error:', error);
      return 0;
    }
  }

  /**
   * Get remaining lock time in seconds
   */
  static getRemainingTime(expiresAt: Date): number {
    const now = new Date();
    const remaining = Math.floor((expiresAt.getTime() - now.getTime()) / 1000);
    return Math.max(0, remaining);
  }

  /**
   * Convert lock to booking (called after successful payment)
   */
  static async convertLockToBooking(
    lockToken: string,
    userId: string,
    bookingId: string
  ): Promise<LockResult> {
    try {
      // Validate lock first
      const validation = await this.validateLock(lockToken, userId);
      if (!validation.success) {
        return validation;
      }

      const slot = await db.query.availabilitySlots.findFirst({
        where: eq(availabilitySlots.lockToken, lockToken),
      });

      if (!slot) {
        return {
          success: false,
          message: 'Lock not found',
        };
      }

      // Convert lock to booking
      await db
        .update(availabilitySlots)
        .set({
          status: 'booked',
          bookingId,
          lockedByUid: null,
          lockedAt: null,
          lockExpiresAt: null,
          lockToken: null,
          updatedAt: new Date(),
        })
        .where(eq(availabilitySlots.id, slot.id));

      return {
        success: true,
        message: 'Lock converted to booking successfully',
      };
    } catch (error) {
      console.error('BookingLockService.convertLockToBooking error:', error);
      return {
        success: false,
        message: 'Failed to convert lock to booking',
      };
    }
  }
}
