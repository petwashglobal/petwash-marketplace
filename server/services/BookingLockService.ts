/**
 * BookingLockService — 5-minute slot reservation locks
 *
 * Operates on the `availability_slots` table which has the full lock schema:
 *   locked_by_uid, locked_at, lock_expires_at, lock_token, status
 *
 * Public API (static class):
 *   acquireLock({ slotId, userId, lockDurationSeconds? })
 *   releaseLock(lockToken, userId)
 *   cleanExpiredLocks()          — background sweep
 */

import { db } from '../db';
import { availabilitySlots } from '@shared/schema';
import { eq, and, or, lt, isNull } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { logger } from '../lib/logger';

const DEFAULT_LOCK_SECONDS = 300; // 5 minutes

interface AcquireLockInput {
  slotId: number;
  userId: string;
  lockDurationSeconds?: number;
}

interface LockResult {
  success: boolean;
  lockToken?: string;
  expiresAt?: Date;
  message: string;
}

export class BookingLockService {
  /**
   * Atomically acquire a 5-minute lock on an availability slot.
   *
   * Uses a single UPDATE … WHERE … RETURNING to eliminate the TOCTOU race.
   * Succeeds only when the slot is:
   *   (a) available (status = 'available') AND lock not held  — fresh lock
   *   (b) already locked by the same user                     — re-lock/extend
   */
  static async acquireLock({ slotId, userId, lockDurationSeconds }: AcquireLockInput): Promise<LockResult> {
    const durationSec = lockDurationSeconds ?? DEFAULT_LOCK_SECONDS;
    const now = new Date();
    const expiresAt = new Date(now.getTime() + durationSec * 1000);
    const lockToken = nanoid(32);

    try {
      // Atomic claim: only succeeds if slot is available or already ours
      const [claimed] = await db
        .update(availabilitySlots)
        .set({
          lockedByUid: userId,
          lockedAt: now,
          lockExpiresAt: expiresAt,
          lockToken,
          status: 'held',
          updatedAt: now,
        })
        .where(
          and(
            eq(availabilitySlots.id, slotId),
            or(
              // Slot is free
              and(
                eq(availabilitySlots.status, 'available'),
                or(isNull(availabilitySlots.lockToken), lt(availabilitySlots.lockExpiresAt!, now))
              ),
              // Slot is already locked by this same user (re-lock / extend)
              and(
                eq(availabilitySlots.lockedByUid!, userId),
                eq(availabilitySlots.status, 'held')
              )
            )
          )
        )
        .returning({ id: availabilitySlots.id });

      if (!claimed) {
        logger.info('[BookingLock] Slot unavailable or already locked by another user', { slotId, userId });
        return { success: false, message: 'Time slot is no longer available. Please choose another.' };
      }

      logger.info('[BookingLock] Lock acquired', { slotId, userId, lockToken, expiresAt });
      return { success: true, lockToken, expiresAt, message: 'Slot locked for 5 minutes.' };
    } catch (err: any) {
      logger.error('[BookingLock] acquireLock error', { slotId, userId, err: err.message });
      return { success: false, message: 'Failed to acquire lock. Please try again.' };
    }
  }

  /**
   * Release a lock.  Only the user who set the lock can release it.
   */
  static async releaseLock(lockToken: string, userId: string): Promise<LockResult> {
    try {
      const [released] = await db
        .update(availabilitySlots)
        .set({
          lockedByUid: null,
          lockedAt: null,
          lockExpiresAt: null,
          lockToken: null,
          status: 'available',
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(availabilitySlots.lockToken, lockToken),
            eq(availabilitySlots.lockedByUid!, userId)
          )
        )
        .returning({ id: availabilitySlots.id });

      if (!released) {
        return { success: false, message: 'Lock not found or belongs to another user.' };
      }

      logger.info('[BookingLock] Lock released', { lockToken, userId });
      return { success: true, message: 'Lock released.' };
    } catch (err: any) {
      logger.error('[BookingLock] releaseLock error', { lockToken, userId, err: err.message });
      return { success: false, message: 'Failed to release lock.' };
    }
  }

  /**
   * Sweep expired locks back to 'available'.
   * Called by a background job or on demand.
   */
  static async cleanExpiredLocks(): Promise<number> {
    const now = new Date();
    try {
      const freed = await db
        .update(availabilitySlots)
        .set({
          lockedByUid: null,
          lockedAt: null,
          lockExpiresAt: null,
          lockToken: null,
          status: 'available',
          updatedAt: now,
        })
        .where(
          and(
            eq(availabilitySlots.status, 'held'),
            lt(availabilitySlots.lockExpiresAt!, now)
          )
        )
        .returning({ id: availabilitySlots.id });

      if (freed.length > 0) {
        logger.info('[BookingLock] Cleaned expired locks', { count: freed.length });
      }
      return freed.length;
    } catch (err: any) {
      logger.error('[BookingLock] cleanExpiredLocks error', { err: err.message });
      return 0;
    }
  }
}
