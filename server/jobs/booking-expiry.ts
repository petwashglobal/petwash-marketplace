import { db } from '../db';
import { walkBookings, sitterBookings, walkerProfiles, sitterProfiles, availabilitySlots, escrowHoldings, bookings } from '@shared/schema';
import { eq, and, lt, notInArray, sql } from 'drizzle-orm';
import { logger } from '../lib/logger';
import { syncChatToBookingStatus } from '../lib/booking-chat-sync';
import EscrowService from '../services/EscrowService';
import { SystemEventService } from '../services/SystemEventService';

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
      eq(sitterProfiles.isActive, true),
      eq(sitterProfiles.verificationStatus, 'verified'),
      eq(sitterProfiles.city, city),
      excludeUids.length > 0 ? notInArray(sitterProfiles.userId, excludeUids) : sql`TRUE`
    ))
    .orderBy(sitterProfiles.rating, sitterProfiles.responseTimeMinutes)
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
    SystemEventService.bookingStuck('booking_expiry', booking.bookingId, 'pending_provider', 120);
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
    SystemEventService.bookingStuck('booking_expiry', booking.bookingId, 'pending_provider', 240);
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

/**
 * Detect unified/academy bookings stuck in intermediate states >45 minutes.
 * These are bookings from trainer_bookings or the unified booking engine
 * that never transitioned out of "pending" or "payment_pending".
 */
async function processStuckUnifiedBookings(): Promise<void> {
  const now = new Date();
  try {
    // Trainer bookings stuck in pending for >45 minutes
    const trainerStuck = await db.execute(sql`
      SELECT booking_id, status, created_at,
        EXTRACT(EPOCH FROM (NOW() - created_at)) / 60 AS age_minutes
      FROM trainer_bookings
      WHERE status IN ('pending', 'payment_pending')
        AND created_at < NOW() - INTERVAL '45 minutes'
      LIMIT 50
    `);
    for (const row of trainerStuck.rows as any[]) {
      SystemEventService.bookingStuck(
        'booking_expiry_unified',
        row.booking_id,
        row.status,
        Math.round(row.age_minutes),
      );
      logger.warn('[BookingExpiry] Trainer booking stuck', {
        bookingId: row.booking_id, status: row.status, ageMin: Math.round(row.age_minutes),
      });
    }

    // Orphaned wallet holds — wallet_hold_key set but booking is >45min and still pending
    // This catches the "payment taken but booking row never created" scenario
    const orphaned = await db.execute(sql`
      SELECT tb.booking_id, tb.wallet_hold_cents, tb.created_at,
        EXTRACT(EPOCH FROM (NOW() - tb.created_at)) / 60 AS age_minutes
      FROM trainer_bookings tb
      WHERE tb.wallet_hold_key IS NOT NULL
        AND tb.wallet_debit_key IS NULL
        AND tb.status IN ('pending', 'payment_pending', 'expired', 'cancelled')
        AND tb.created_at < NOW() - INTERVAL '45 minutes'
        AND (tb.wallet_hold_cents IS NOT NULL AND tb.wallet_hold_cents > 0)
      LIMIT 50
    `);
    for (const row of orphaned.rows as any[]) {
      SystemEventService.orphanedPaymentHold(
        'booking_expiry_unified',
        row.booking_id,
        Number(row.wallet_hold_cents ?? 0),
      );
    }
  } catch (err: any) {
    // Table may not exist in some environments — swallow gracefully
    if (!err.message?.includes('does not exist')) {
      logger.error('[BookingExpiry] Unified stuck scan error', { error: err.message });
    }
  }
}

/**
 * P1-FIX: Expire marketplace bookings from the unified `bookings` table.
 *
 * This table was missing from ALL prior expiry jobs, meaning:
 *   - `pending_payment` bookings could hold a slot forever if the customer abandoned checkout
 *   - `inquiry`/`quote_sent`/`pending_provider` bookings could stay open indefinitely
 *
 * Timeouts (conservative, aligned with Israeli consumer protection norms):
 *   - pending_payment  > 2 h   → payment_failed + release slot + void escrow
 *   - inquiry          > 24 h  → expired (no slot held at this stage)
 *   - quote_sent       > 48 h  → expired
 *   - pending_provider > 24 h  → expired
 *   - deposit_pending  > 48 h  → expired
 */
async function processExpiredMarketplaceBookings(): Promise<void> {
  const now = new Date();

  try {
    // ── 1. pending_payment > 2h — customer abandoned checkout ────────────────
    const paymentExpiredBookings = await db
      .select({ id: bookings.id })
      .from(bookings)
      .where(
        and(
          eq(bookings.status, 'pending_payment'),
          lt(bookings.updatedAt, new Date(now.getTime() - 2 * 60 * 60 * 1000))
        )
      )
      .limit(50);

    for (const b of paymentExpiredBookings) {
      await db.update(bookings)
        .set({ status: 'payment_failed', paymentStatus: 'expired', updatedAt: now } as any)
        .where(eq(bookings.id, b.id));

      // Release the slot this booking held
      await db.update(availabilitySlots)
        .set({
          status: 'available',
          bookingId: null,
          lockToken: null,
          lockExpiresAt: null,
          lockedByUid: null,
          updatedAt: now,
        } as any)
        .where(eq(availabilitySlots.bookingId, b.id));

      // Void escrow — payment was never captured
      await db.update(escrowHoldings)
        .set({ status: 'refunded', updatedAt: now } as any)
        .where(eq(escrowHoldings.bookingId, b.id));

      logger.warn('[BookingExpiry] Marketplace booking payment timeout — slot released, escrow voided', {
        bookingId: b.id,
      });
      SystemEventService.bookingStuck('marketplace_payment_timeout', b.id, 'pending_payment', 120);
    }

    // ── 2. Early-stage bookings stuck without a slot (alert only) ────────────
    const staleStates = [
      { status: 'inquiry',          maxAgeH: 24 },
      { status: 'quote_sent',       maxAgeH: 48 },
      { status: 'pending_provider', maxAgeH: 24 },
      { status: 'deposit_pending',  maxAgeH: 48 },
    ] as const;

    for (const { status: stuckStatus, maxAgeH } of staleStates) {
      const stale = await db
        .select({ id: bookings.id })
        .from(bookings)
        .where(
          and(
            eq(bookings.status, stuckStatus as string),
            lt(bookings.updatedAt, new Date(now.getTime() - maxAgeH * 60 * 60 * 1000))
          )
        )
        .limit(50);

      for (const b of stale) {
        await db.update(bookings)
          .set({ status: 'expired', updatedAt: now } as any)
          .where(eq(bookings.id, b.id));
        logger.warn('[BookingExpiry] Marketplace booking expired', {
          bookingId: b.id, fromStatus: stuckStatus, maxAgeH,
        });
        SystemEventService.bookingStuck('marketplace_booking_expired', b.id, stuckStatus, maxAgeH * 60);
      }
    }
  } catch (err: any) {
    if (!err.message?.includes('does not exist')) {
      logger.error('[BookingExpiry] Marketplace expiry scan error', { error: err.message });
    }
  }
}

export function startBookingExpiryPoller() {
  logger.info('[BookingExpiry] Poller started — expiry/reassignment every 5m, escrow every 15m');

  setInterval(async () => {
    try {
      await processExpiredWalkBookings();
      await processExpiredSitterBookings();
      await processStuckUnifiedBookings();
      await processExpiredMarketplaceBookings(); // P1-FIX: was missing entirely
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
