import { db } from '../db';
import { walkBookings, sitterBookings, walkerProfiles, sitterProfiles } from '@shared/schema';
import { eq, and, lt, notInArray, sql } from 'drizzle-orm';
import { logger } from '../lib/logger';
import { syncChatToBookingStatus } from '../lib/booking-chat-sync';
import EscrowService from '../services/EscrowService';

const MAX_REASSIGNMENT_ATTEMPTS = 3;

async function findReplacementWalker(city: string, excludeIds: string[]): Promise<string | null> {
  const [candidate] = await db
    .select({ walkerId: walkerProfiles.walkerId })
    .from(walkerProfiles)
    .where(and(
      eq(walkerProfiles.isAvailable, true),
      eq(walkerProfiles.verificationStatus, 'verified'),
      eq(walkerProfiles.city, city),
      excludeIds.length > 0 ? notInArray(walkerProfiles.walkerId, excludeIds) : sql`TRUE`
    ))
    .orderBy(walkerProfiles.averageRating, walkerProfiles.responseTimeMinutes)
    .limit(1);
  return candidate?.walkerId ?? null;
}

async function findReplacementSitter(city: string, excludeUids: string[]): Promise<{ id: number } | null> {
  const [candidate] = await db
    .select({ id: sitterProfiles.id })
    .from(sitterProfiles)
    .where(and(
      eq(sitterProfiles.isAvailable, true),
      eq(sitterProfiles.verificationStatus, 'verified'),
      eq(sitterProfiles.city, city),
      excludeUids.length > 0 ? notInArray(sitterProfiles.userId, excludeUids) : sql`TRUE`
    ))
    .orderBy(sitterProfiles.averageRating, sitterProfiles.responseTimeMinutes)
    .limit(1);
  return candidate ?? null;
}

async function processExpiredWalkBookings(): Promise<void> {
  const now = new Date();
  const expiryWindow = new Date(now.getTime() - 2 * 60 * 60 * 1000);

  const stale = await db.select().from(walkBookings).where(and(
    eq(walkBookings.status, 'pending_provider'),
    lt(walkBookings.createdAt, expiryWindow)
  ));

  for (const booking of stale) {
    const prev = booking.previousProviders ?? [];
    const attempts = booking.reassignmentCount ?? 0;

    if (attempts < MAX_REASSIGNMENT_ATTEMPTS) {
      const city = (booking as any).city ?? '';
      const exclude = [booking.walkerId, ...prev].filter(Boolean) as string[];
      const next = city ? await findReplacementWalker(city, exclude) : null;

      if (next) {
        await db.update(walkBookings).set({
          walkerId: next,
          reassignmentCount: attempts + 1,
          previousProviders: exclude,
          lastReassignedAt: now,
          updatedAt: now,
        }).where(eq(walkBookings.bookingId, booking.bookingId));
        logger.info('[BookingExpiry] Walk reassigned', { bookingId: booking.bookingId, to: next, attempt: attempts + 1 });
        continue;
      }

      await db.update(walkBookings).set({ reassignmentCount: attempts + 1, updatedAt: now })
        .where(eq(walkBookings.bookingId, booking.bookingId));
    }

    await db.update(walkBookings).set({ status: 'expired', updatedAt: now })
      .where(eq(walkBookings.bookingId, booking.bookingId));
    await syncChatToBookingStatus(booking.bookingId, 'expired', 'walk_my_pet');
    logger.info('[BookingExpiry] Walk hard-expired', { bookingId: booking.bookingId, attempts });
  }
}

async function processExpiredSitterBookings(): Promise<void> {
  const now = new Date();
  const expiryWindow = new Date(now.getTime() - 4 * 60 * 60 * 1000);

  const stale = await db.select().from(sitterBookings).where(and(
    eq(sitterBookings.status, 'pending_provider'),
    lt(sitterBookings.createdAt, expiryWindow)
  ));

  for (const booking of stale) {
    const prev = booking.previousProviders ?? [];
    const attempts = booking.reassignmentCount ?? 0;
    const currentSitterStr = booking.sitterId?.toString() ?? '';

    if (attempts < MAX_REASSIGNMENT_ATTEMPTS) {
      const city = (booking as any).city ?? '';
      const exclude = [currentSitterStr, ...prev].filter(Boolean);
      const next = city ? await findReplacementSitter(city, exclude) : null;

      if (next) {
        await db.update(sitterBookings).set({
          sitterId: next.id,
          reassignmentCount: attempts + 1,
          previousProviders: exclude,
          lastReassignedAt: now,
          updatedAt: now,
        }).where(eq(sitterBookings.bookingId, booking.bookingId));
        logger.info('[BookingExpiry] Sitter reassigned', { bookingId: booking.bookingId, to: next.id, attempt: attempts + 1 });
        continue;
      }

      await db.update(sitterBookings).set({ reassignmentCount: attempts + 1, updatedAt: now })
        .where(eq(sitterBookings.bookingId, booking.bookingId));
    }

    await db.update(sitterBookings).set({ status: 'expired', updatedAt: now })
      .where(eq(sitterBookings.bookingId, booking.bookingId));
    await syncChatToBookingStatus(booking.bookingId, 'expired', 'sitter_suite');
    logger.info('[BookingExpiry] Sitter hard-expired', { bookingId: booking.bookingId, attempts });
  }
}

async function processEscrowAutoRelease(): Promise<void> {
  try {
    const released = await EscrowService.autoReleaseExpiredHolds();
    if (released > 0) {
      logger.info('[BookingExpiry] Escrow auto-released', { count: released });
    }
  } catch (err) {
    logger.error('[BookingExpiry] Escrow auto-release error', err);
  }
}

export function startBookingExpiryPoller() {
  logger.info('[BookingExpiry] Poller started — expiry/reassignment every 5m, escrow every 15m');

  setInterval(async () => {
    try {
      await processExpiredWalkBookings();
      await processExpiredSitterBookings();
    } catch (err) {
      logger.error('[BookingExpiry] Expiry/reassignment cycle error', err);
    }
  }, 5 * 60 * 1000);

  setInterval(async () => {
    await processEscrowAutoRelease();
  }, 15 * 60 * 1000);

  processEscrowAutoRelease().catch(err =>
    logger.warn('[BookingExpiry] Initial escrow release check failed', err)
  );
}
