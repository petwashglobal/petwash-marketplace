/**
 * acceptWalkBookingCore — pure-function version of the ACCEPT branch
 * inside `PATCH /api/walk-my-pet/bookings/:bookingId/provider-respond`
 * (server/routes/walk-my-pet.ts:848-1019).
 *
 * PAYMENT-RAIL GAP (CEO §24, money-invariants §2)
 *   The current walk accept path is HONESTLY BROKEN: it flips the row
 *   to 'confirmed' via `walkEliteBookingEngine.confirmBooking()`, which
 *   writes a Firestore escrow document but INVOKES NO PAYMENT RAIL.
 *   The row therefore reads 'confirmed' with no money captured, no
 *   Nayax card charge, no wallet debit, no SUMIT/ITA fiscal document.
 *
 *   This extraction preserves that reality 1:1 so a future refactor
 *   cannot silently strip the honesty. The core returns an EXPLICIT
 *   `paymentRail: 'MISSING'` marker on the ok payload; the dispatcher
 *   uses it to refuse dispatching (PAYMENT_RAIL_MISSING) so real
 *   production traffic is blocked from confirming a paperless walk
 *   even after BOOKING_ACCEPT_DISPATCHER_ENABLED flips on.
 *
 *   Two remediation steps are required before this core can safely
 *   own live traffic:
 *     1. Wire a real payment rail (card capture OR wallet debit)
 *        BEFORE the escrow confirm.
 *     2. Fiscal receipt at the verified fiscal event (currently the
 *        original handler emits `logger.error(...) NO receipt issued`).
 *
 *   Once (1) and (2) land, this core's success payload can drop the
 *   MISSING marker and the dispatcher can route walk accepts.
 *
 * IMPORTANT — 1:1 with the original handler:
 *   • Atomic status claim: pending_provider → payment_pending in ONE
 *     UPDATE with WHERE guard. Zero-row → ALREADY_CLAIMED.
 *   • walkEliteBookingEngine.confirmBooking() places the escrow
 *     Firestore doc. Failure → ESCROW_HOLD_FAILED (do NOT confirm).
 *   • walk_bookings.status → 'confirmed' with WHERE guard on
 *     payment_pending (never overwrites a subsequently-cancelled row).
 *   • syncChatToBookingStatus(bookingId, 'confirmed', 'walk_my_pet').
 *   • Octopus DRAFT → CONFIRMED. NO PAYMENT_CAPTURED ledger entry —
 *     because no payment was actually captured (this is the honest
 *     state the current code documents at length).
 *   • Explicit warn log naming the missing-rail state.
 *   • Calendar event (non-fatal).
 *   • GCS backup of escrow_record (non-blocking).
 *   • dispatchNotification (customer inbox+sms+push).
 *
 * Design note: docs/design/2026-08-26-booking-accept-dispatcher.md
 */

import { eq, and } from 'drizzle-orm';
import { db } from '../../db';
import {
  walkBookings,
  walkerProfiles,
  octopusBookings,
} from '@shared/schema';
import { logger } from '../../lib/logger';
import { calendarIntegrationService } from '../CalendarIntegrationService';
import { syncChatToBookingStatus } from '../../lib/booking-chat-sync';
import { backupFinancialDocument } from '../gcsBackupService';
import { advancedBookingEngine as walkEliteBookingEngine } from '../WalkEliteBookingEngine';
import { pool } from '../../db';

export type AcceptWalkOutcome =
  | { ok: true; status: 'confirmed'; bookingId: string;
      /** MISSING today — see PAYMENT-RAIL GAP note above. */
      paymentRail: 'MISSING'; }
  | { ok: false; errorCode:
        | 'BOOKING_NOT_FOUND'
        | 'BOOKING_WRONG_STATE'
        | 'FORBIDDEN'
        | 'ALREADY_CLAIMED'
        | 'ESCROW_HOLD_FAILED'
        | 'DB_ERROR';
      message: string;
      currentStatus?: string;
      details?: Record<string, unknown>;
    };

export interface AcceptWalkInput {
  bookingId: string;
  providerUid: string;
}

export async function acceptWalkBookingCore(input: AcceptWalkInput): Promise<AcceptWalkOutcome> {
  const { bookingId, providerUid } = input;

  try {
    const [booking] = await db
      .select()
      .from(walkBookings)
      .where(eq(walkBookings.bookingId, bookingId));
    if (!booking) {
      return { ok: false, errorCode: 'BOOKING_NOT_FOUND', message: 'Booking not found' };
    }
    if (booking.status !== 'pending_provider') {
      return {
        ok: false, errorCode: 'BOOKING_WRONG_STATE',
        message: `Booking is already ${booking.status}`,
        currentStatus: booking.status,
      };
    }

    const [walker] = await db
      .select()
      .from(walkerProfiles)
      .where(eq(walkerProfiles.walkerId, booking.walkerId));
    if (!walker || walker.userId !== providerUid) {
      return { ok: false, errorCode: 'FORBIDDEN', message: 'Only the assigned walker can respond' };
    }

    // ── ATOMIC CLAIM ────────────────────────────────────────────────────
    const claimResult = await db
      .update(walkBookings)
      .set({ status: 'payment_pending', updatedAt: new Date() })
      .where(and(
        eq(walkBookings.bookingId, bookingId),
        eq(walkBookings.status, 'pending_provider'),
      ))
      .returning({ id: walkBookings.id });
    if (claimResult.length === 0) {
      logger.warn('[acceptWalkBookingCore] concurrent accept — atomic claim lost', { bookingId, providerUid });
      return {
        ok: false, errorCode: 'ALREADY_CLAIMED',
        message: 'This booking is already being processed — please refresh.',
      };
    }

    // Escrow confirm via the luxury engine. FAIL CLOSED: if the escrow
    // hold can't be placed we must NOT confirm the booking. Doing so
    // would record a paid, confirmed walk with no money actually held.
    try {
      const pricing = {
        subtotal: parseFloat(booking.walkerRate || '0'),
        platformFee: parseFloat(booking.platformFeeOwner || '0') + parseFloat(booking.platformFeeSitter || '0'),
        providerPayout: parseFloat(booking.walkerPayout || '0'),
        totalPrice: parseFloat(booking.totalCost || '0'),
        loyaltyDiscount: 0,
        currency: booking.currency || 'ILS',
        breakdown: [],
        baseRate: parseFloat(booking.walkerRate || '0'),
      };
      await walkEliteBookingEngine.confirmBooking(
        booking.bookingId,
        pricing,
        booking.ownerId,
        walker.userId,
      );
    } catch (escrowErr: any) {
      logger.error('[acceptWalkBookingCore] Escrow confirmation FAILED — booking NOT confirmed', {
        bookingId, error: escrowErr?.message,
      });
      return {
        ok: false, errorCode: 'ESCROW_HOLD_FAILED',
        message: 'Could not secure the payment hold for this booking. Please try again.',
      };
    }

    await db
      .update(walkBookings)
      .set({ status: 'confirmed', updatedAt: new Date() })
      .where(and(
        eq(walkBookings.bookingId, bookingId),
        eq(walkBookings.status, 'payment_pending'),
      ));

    await syncChatToBookingStatus(bookingId, 'confirmed', 'walk_my_pet').catch((chatErr) =>
      logger.warn('[acceptWalkBookingCore] chat sync failed (non-blocking)', { bookingId, error: String(chatErr) }),
    );

    logger.info(`[acceptWalkBookingCore] Walker ACCEPTED booking ${bookingId}`);

    // Octopus DRAFT → CONFIRMED. NO PAYMENT_CAPTURED entry — this rail
    // captures nothing today. A capture ledger entry for money that
    // never moved is a false book entry (2026-07-30 audit).
    try {
      const [octopusRecord] = await db.select().from(octopusBookings)
        .where(eq(octopusBookings.idempotencyKey, booking.bookingId)).limit(1);
      if (octopusRecord) {
        await db.update(octopusBookings)
          .set({ status: 'CONFIRMED', updatedAt: new Date() })
          .where(eq(octopusBookings.id, octopusRecord.id));
        logger.info('[acceptWalkBookingCore] Walk booking confirmed (no payment captured on this rail)', { octopusId: octopusRecord.id });
      }
    } catch (octopusErr) {
      logger.warn('[acceptWalkBookingCore] Failed to update walk octopus status (non-blocking)', octopusErr);
    }

    // Explicit warn — the current rail invokes no payment. Preserving
    // the honest gap so ops can see it in logs until a real rail lands.
    logger.error('[acceptWalkBookingCore] Booking accepted WITHOUT a payment rail — no money collected, no receipt issued. Wire this path to a verified payment before launch.', {
      bookingId: booking.bookingId,
      totalCost: booking.totalCost,
    });

    // Calendar event — non-fatal.
    calendarIntegrationService.createBookingEvent({
      platform: 'walk-my-pet',
      bookingId: booking.bookingId,
      title: `⁦Walk My Pet™⁩ - Dog Walk (${booking.durationMinutes} min)`,
      description: `Dog walking booking confirmed for ${booking.durationMinutes} minutes`,
      startTime: new Date(booking.scheduledDate),
      endTime: new Date(new Date(booking.scheduledDate).getTime() + (booking.durationMinutes || 60) * 60000),
      providerName: walker.businessName || `Walker ${walker.walkerId}`,
    }).catch(() => {});

    // GCS backup — non-blocking.
    (async () => {
      try {
        await backupFinancialDocument({
          documentType: 'escrow_record',
          bookingId: booking.bookingId,
          platform: 'walk_my_pet',
          content: JSON.stringify({
            bookingId: booking.bookingId,
            ownerId: booking.ownerId,
            walkerId: booking.walkerId,
            totalCost: booking.totalCost,
            walkerPayout: booking.walkerPayout,
            platformFeeOwner: booking.platformFeeOwner,
            platformFeeSitter: booking.platformFeeSitter,
            confirmedAt: new Date().toISOString(),
            escrowHoldHours: 72,
            durationMinutes: booking.durationMinutes,
          }, null, 2),
        });
      } catch (gcsErr) {
        logger.warn('[acceptWalkBookingCore] GCS financial backup failed (non-blocking)', gcsErr);
      }
    })();

    // Customer notification (2026-07-31 fix): the response claims the
    // customer was notified, so this actually dispatches inbox+sms+push.
    // Fail-soft.
    try {
      const { dispatchNotification } = await import('../../lib/notificationDispatcher');
      const { rows: ownerRows } = await pool.query('SELECT email, phone FROM users WHERE id = $1', [booking.ownerId]);
      const owner = ownerRows[0] || {};
      const base = process.env.APP_URL || 'https://petwash.co.il';
      await dispatchNotification({
        uid: booking.ownerId,
        email: owner.email ?? undefined,
        phone: owner.phone ?? undefined,
        type: 'booking_accepted',
        title: '✅ הטיול אושר!',
        bodyHtml: `<p>המטייל/ת אישר/ה את הטיול שלך ב-⁦Walk My Pet™⁩. אפשר לצפות בפרטים באזור ההזמנות שלך.</p>`,
        bodyText: 'הטיול שלך ב-Walk My Pet אושר! היכנס/י לאזור ההזמנות לפרטים.',
        ctaText: 'צפייה בהזמנות',
        ctaUrl: `${base}/bookings`,
        channels: ['inbox', 'sms', 'push'],
        priority: 8,
        meta: { bookingId: booking.bookingId },
      });
    } catch (notifErr: any) {
      logger.warn('[acceptWalkBookingCore] accept customer-notification failed (non-blocking)', { error: notifErr?.message });
    }

    return {
      ok: true,
      status: 'confirmed',
      bookingId,
      paymentRail: 'MISSING',
    };
  } catch (err: any) {
    logger.error('[acceptWalkBookingCore] unexpected error', { bookingId, providerUid, error: err?.message });
    return { ok: false, errorCode: 'DB_ERROR', message: err?.message ?? 'unexpected error' };
  }
}
