/**
 * Booking expiry / reassignment poller.
 *
 * CONCURRENCY (2026-08-17, sprint/money-concurrency M3) — no financial rule
 * changed; every timeout window, every status and every amount below is
 * byte-for-byte what it was.
 *
 * THE PROBLEM
 * -----------
 * `startBookingExpiryPoller` is a plain `setInterval` started from
 * server/index.ts, so it runs on EVERY Cloud Run instance. Each pass did
 * `SELECT` candidates → `for (…) { UPDATE … WHERE booking_id = ? }` with the
 * update guarded on nothing but the primary key. Two instances (or one instance
 * whose previous 5-minute pass had not finished, or a restart mid-pass) both
 * selected the same row and both ran the whole body — including the money work:
 *
 *   • `UPDATE escrow_holdings SET status='refunded'` — voiding the same escrow
 *     twice, and doing so with NO regard for the escrow's current status, so a
 *     hold that had already been RELEASED to the provider could be stamped
 *     `refunded` (paid AND refunded on one booking)
 *   • releasing the availability slot twice
 *   • incrementing `reassignment_count` twice, burning a provider's
 *     reassignment budget at double rate and reassigning to two different
 *     providers in the same pass
 *   • duplicate `SystemEventService.bookingStuck` alerts and duplicate chat
 *     status syncs
 *
 * THE FIX
 * -------
 * Every state change is now an ATOMIC CLAIM: a compare-and-set
 * `UPDATE … WHERE <primary key> AND <the exact state we read> … RETURNING`.
 * Postgres executes that as one statement, so of N racing workers exactly one
 * gets a row back; the others get zero rows and skip the entire body. The claim
 * is taken BEFORE any refund/void/slot/notification work, never after.
 *
 * Restart-safe and retry-safe by construction: there is no in-process lock to
 * leak and no lease to expire. A worker killed between claim and side effect
 * leaves the row in its new state; the next pass simply does not re-select it,
 * exactly as before. A re-run of the same pass claims zero rows.
 *
 * The multi-table marketplace payment-timeout path additionally runs its three
 * writes (booking → slot → escrow) inside ONE transaction, so a crash cannot
 * leave the slot released with the escrow un-voided.
 */
import { db } from '../db';
import { walkBookings, sitterBookings, walkerProfiles, sitterProfiles, availabilitySlots, escrowHoldings, bookings } from '@shared/schema';
import { eq, and, lt, notInArray, sql } from 'drizzle-orm';
import { logger } from '../lib/logger';
import { syncChatToBookingStatus } from '../lib/booking-chat-sync';
import EscrowService from '../services/EscrowService';
import { SystemEventService } from '../services/SystemEventService';

const MAX_REASSIGNMENT_ATTEMPTS = 3;

/**
 * Escrow statuses a timeout sweep must NEVER overwrite.
 *
 * This is a concurrency guard, not a policy change: the rule has always been
 * "void the escrow of a booking whose payment was never captured". A holding
 * that is already `released` (money paid out to the provider) or already
 * `refunded` is not that, and stamping it again is a duplicate/incorrect write
 * — precisely what the claim below exists to prevent.
 */
const ESCROW_TERMINAL_STATUSES = ['released', 'refunded'] as const;

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
        // ATOMIC CLAIM — the WHERE pins both the status AND the exact
        // reassignment_count we read, so two workers cannot each burn an
        // attempt (and hand the job to two different walkers) on one pass.
        const claimed = await db.update(walkBookings).set({
          walkerId: next,
          reassignmentCount: attempts + 1,
          previousProviders: exclude,
          lastReassignedAt: now,
          updatedAt: now,
        }).where(and(
          eq(walkBookings.bookingId, booking.bookingId),
          eq(walkBookings.status, 'pending_provider'),
          eq(walkBookings.reassignmentCount, attempts),
        )).returning({ bookingId: walkBookings.bookingId });

        if (claimed.length === 0) {
          logger.info('[BookingExpiry] Walk reassign claim lost — another worker handled it', { bookingId: booking.bookingId });
          continue;
        }
        logger.info('[BookingExpiry] Walk reassigned', { bookingId: booking.bookingId, to: next, attempt: attempts + 1 });
        continue;
      }

      // No replacement available — still record the attempt, atomically.
      await db.update(walkBookings).set({ reassignmentCount: attempts + 1, updatedAt: now })
        .where(and(
          eq(walkBookings.bookingId, booking.bookingId),
          eq(walkBookings.status, 'pending_provider'),
          eq(walkBookings.reassignmentCount, attempts),
        ));
    }

    // ATOMIC CLAIM before the terminal transition + its side effects. Only the
    // worker that actually flips pending_provider → expired syncs the chat and
    // raises the ops alert.
    const expired = await db.update(walkBookings).set({ status: 'expired', updatedAt: now })
      .where(and(
        eq(walkBookings.bookingId, booking.bookingId),
        eq(walkBookings.status, 'pending_provider'),
      )).returning({ bookingId: walkBookings.bookingId });

    if (expired.length === 0) {
      logger.info('[BookingExpiry] Walk expiry claim lost — already handled', { bookingId: booking.bookingId });
      continue;
    }

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
        // ATOMIC CLAIM — status + exact reassignment_count (see the walk path).
        const claimed = await db.update(sitterBookings).set({
          sitterId: next.id,
          reassignmentCount: attempts + 1,
          previousProviders: exclude,
          lastReassignedAt: now,
          updatedAt: now,
        }).where(and(
          eq(sitterBookings.bookingId, booking.bookingId),
          eq(sitterBookings.status, 'pending_provider'),
          eq(sitterBookings.reassignmentCount, attempts),
        )).returning({ bookingId: sitterBookings.bookingId });

        if (claimed.length === 0) {
          logger.info('[BookingExpiry] Sitter reassign claim lost — another worker handled it', { bookingId: booking.bookingId });
          continue;
        }
        logger.info('[BookingExpiry] Sitter reassigned', { bookingId: booking.bookingId, to: next.id, attempt: attempts + 1 });
        continue;
      }

      await db.update(sitterBookings).set({ reassignmentCount: attempts + 1, updatedAt: now })
        .where(and(
          eq(sitterBookings.bookingId, booking.bookingId),
          eq(sitterBookings.status, 'pending_provider'),
          eq(sitterBookings.reassignmentCount, attempts),
        ));
    }

    // ATOMIC CLAIM before the terminal transition + its side effects.
    const expired = await db.update(sitterBookings).set({ status: 'expired', updatedAt: now })
      .where(and(
        eq(sitterBookings.bookingId, booking.bookingId),
        eq(sitterBookings.status, 'pending_provider'),
      )).returning({ bookingId: sitterBookings.bookingId });

    if (expired.length === 0) {
      logger.info('[BookingExpiry] Sitter expiry claim lost — already handled', { bookingId: booking.bookingId });
      continue;
    }

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
    // Trainer bookings stuck in pending for >45 minutes.
    // NOTE: the column is `booking_status`, not `status` (shared/schema.ts:7287).
    // Prod-runtime-errors regression 2026-08-20: querying `status` here 500'd every 60s.
    const trainerStuck = await db.execute(sql`
      SELECT booking_id, booking_status, created_at,
        EXTRACT(EPOCH FROM (NOW() - created_at)) / 60 AS age_minutes
      FROM trainer_bookings
      WHERE booking_status IN ('pending', 'payment_pending')
        AND created_at < NOW() - INTERVAL '45 minutes'
      LIMIT 50
    `);
    for (const row of trainerStuck.rows as any[]) {
      SystemEventService.bookingStuck(
        'booking_expiry_unified',
        row.booking_id,
        row.booking_status,
        Math.round(row.age_minutes),
      );
      logger.warn('[BookingExpiry] Trainer booking stuck', {
        bookingId: row.booking_id, status: row.booking_status, ageMin: Math.round(row.age_minutes),
      });
    }

    // Orphaned wallet holds — wallet_hold_key set but booking is >45min and still pending.
    // Same column-name fix: booking_status not status.
    const orphaned = await db.execute(sql`
      SELECT tb.booking_id, tb.wallet_hold_cents, tb.created_at,
        EXTRACT(EPOCH FROM (NOW() - tb.created_at)) / 60 AS age_minutes
      FROM trainer_bookings tb
      WHERE tb.wallet_hold_key IS NOT NULL
        AND tb.wallet_debit_key IS NULL
        AND tb.booking_status IN ('pending', 'payment_pending', 'expired', 'cancelled')
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
      // ── ATOMIC CLAIM, THEN ALL THREE WRITES IN ONE TRANSACTION ────────────
      // This is the only money-moving branch of the poller: it voids an escrow
      // holding. The claim on `bookings` is taken FIRST and inside the same
      // transaction as the slot release and the escrow void, so:
      //   • of N racing workers exactly one claims the booking; the rest get
      //     zero rows and do no refund/void work at all;
      //   • a crash between the writes rolls all three back rather than
      //     leaving the slot free with the escrow still held.
      const claimed = await db.transaction(async (tx) => {
        const rows = await tx.update(bookings)
          .set({ status: 'payment_failed', paymentStatus: 'expired', updatedAt: now } as any)
          .where(and(
            eq(bookings.id, b.id),
            eq(bookings.status, 'pending_payment'),
          ))
          .returning({ id: bookings.id });

        if (rows.length === 0) return false; // another worker already expired it

        // Release the slot this booking held
        await tx.update(availabilitySlots)
          .set({
            status: 'available',
            bookingId: null,
            lockToken: null,
            lockExpiresAt: null,
            lockedByUid: null,
            updatedAt: now,
          } as any)
          .where(eq(availabilitySlots.bookingId, b.id));

        // Void escrow — payment was never captured.
        // The status guard is part of the same concurrency fix: without it this
        // sweep would stamp `refunded` over a holding that had already been
        // RELEASED to the provider, recording one booking as both paid out and
        // refunded. Same rule, applied only where it was always meant to apply.
        await tx.update(escrowHoldings)
          .set({ status: 'refunded', updatedAt: now } as any)
          .where(and(
            eq(escrowHoldings.bookingId, b.id),
            notInArray(escrowHoldings.status, [...ESCROW_TERMINAL_STATUSES]),
          ));

        return true;
      });

      if (!claimed) {
        logger.info('[BookingExpiry] Marketplace payment-timeout claim lost — already handled', { bookingId: b.id });
        continue;
      }

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
        // ATOMIC CLAIM — the WHERE pins the status we selected on, so a second
        // worker (or a second pass) cannot re-expire the booking and raise a
        // duplicate ops alert.
        const expired = await db.update(bookings)
          .set({ status: 'expired', updatedAt: now } as any)
          .where(and(
            eq(bookings.id, b.id),
            eq(bookings.status, stuckStatus as string),
          ))
          .returning({ id: bookings.id });

        if (expired.length === 0) {
          logger.info('[BookingExpiry] Marketplace expiry claim lost — already handled', { bookingId: b.id, fromStatus: stuckStatus });
          continue;
        }

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
