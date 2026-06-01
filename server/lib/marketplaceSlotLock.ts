/**
 * Marketplace booking slot-lock helper.
 *
 * Closes the hostile-audit critical: two customers booking the same
 * provider at overlapping times. Backed by the Postgres EXCLUDE
 * constraint in migration 0028 — the DB itself rejects overlapping
 * inserts, so this code can never race-condition itself into a
 * double-book.
 *
 * Usage pattern (inside a transaction):
 *
 *   await db.transaction(async (tx) => {
 *     await acquireSlotLock(tx, {
 *       providerId, startAt, endAt, bookingRef, serviceType,
 *     });
 *     await tx.insert(bookingRequests).values({ ... });
 *   });
 *
 * If acquireSlotLock throws BookingSlotConflictError, the whole
 * transaction rolls back — both the lock and the booking row are gone.
 *
 * On booking cancellation the caller MUST release the lock by
 * deleting the row matching bookingRef. See releaseSlotLock().
 */

import { eq } from 'drizzle-orm';
import {
  marketplaceBookingSlotLocks,
  type InsertMarketplaceBookingSlotLock,
} from '../../shared/schema';
import { db } from '../db';
import { logger } from './logger';

export class BookingSlotConflictError extends Error {
  constructor(readonly providerId: string, readonly startAt: Date, readonly endAt: Date) {
    super(
      `Provider ${providerId} is already booked between ${startAt.toISOString()} and ${endAt.toISOString()}`,
    );
    this.name = 'BookingSlotConflictError';
  }
}

export interface SlotLockInput {
  providerId: string;
  startAt: Date;
  endAt: Date;
  bookingRef: string;
  serviceType: string;
}

/**
 * Attempt to acquire a non-overlapping slot lock. Throws
 * BookingSlotConflictError when the provider already has any overlapping
 * booking (the EXCLUDE constraint fires with PG error code 23P01 —
 * exclusion_violation). All other errors bubble up untouched.
 *
 * @param tx — a Drizzle transaction (or the db root). Always pass the
 *   same transaction that wraps the booking-row insert so the two
 *   together are atomic.
 */
export async function acquireSlotLock(
  tx: typeof db,
  input: SlotLockInput,
): Promise<void> {
  if (input.endAt <= input.startAt) {
    throw new Error('Slot end must be strictly after start');
  }

  const values: InsertMarketplaceBookingSlotLock = {
    providerId: input.providerId,
    startAt: input.startAt,
    endAt: input.endAt,
    bookingRef: input.bookingRef,
    serviceType: input.serviceType,
  };

  try {
    await tx.insert(marketplaceBookingSlotLocks).values(values);
  } catch (err) {
    const code = (err as { code?: string }).code;
    // 23P01 = exclusion_violation (the EXCLUDE constraint fired —
    // overlapping range). 23505 = unique_violation (PK collision —
    // shouldn't happen with serial PK but defend anyway).
    if (code === '23P01' || code === '23505') {
      logger.warn('[SlotLock] conflict acquiring lock', {
        providerId: input.providerId,
        startAt: input.startAt.toISOString(),
        endAt: input.endAt.toISOString(),
        bookingRef: input.bookingRef,
      });
      throw new BookingSlotConflictError(input.providerId, input.startAt, input.endAt);
    }
    throw err;
  }
}

/**
 * Release the slot lock when a booking is cancelled. Safe to call
 * multiple times (no-op when no row matches). Returns the number of
 * rows deleted so callers can log it.
 */
export async function releaseSlotLock(
  tx: typeof db,
  bookingRef: string,
): Promise<number> {
  const result = await tx
    .delete(marketplaceBookingSlotLocks)
    .where(eq(marketplaceBookingSlotLocks.bookingRef, bookingRef))
    .returning();
  return result.length;
}
