/**
 * acceptWalkBookingCore — pure-function version of the ACCEPT branch
 * inside `PATCH /api/walk-my-pet/bookings/:bookingId/provider-respond`
 * (server/routes/walk-my-pet.ts:848-1019).
 *
 * PAYMENT RAIL (CEO 2026-09-18: "a" — the card payment the other bookings use)
 *   Accepting a walk used to flip the row to 'confirmed' with an escrow
 *   DOCUMENT and no money: no card charge, no wallet debit, no fiscal
 *   document. The screen meanwhile promised a hold and a charge.
 *
 *   Now the walker's accept ends at `payment_pending` and nothing else:
 *   no escrow, no 'confirmed'. The customer pays on the SUMIT hosted page
 *   (POST /api/walk-my-pet/walks/:bookingId/pay) and the verified return
 *   (GET .../sumit-return) is what places the escrow hold and confirms the
 *   booking. A walk therefore can never read 'confirmed' unless a real
 *   payment was verified server-side.
 *
 *   The ok payload says `paymentRail: 'AWAITING_CUSTOMER_CARD'`, and the
 *   customer notification is a "pay to confirm" message with the link.
 *
 * WHAT THIS DOES (and nothing more):
 *   • Atomic status claim: pending_provider → payment_pending in ONE
 *     UPDATE with WHERE guard. Zero-row → ALREADY_CLAIMED.
 *   • syncChatToBookingStatus(bookingId, 'payment_pending', 'walk_my_pet').
 *   • Calendar event (non-fatal) and a GCS record of the acceptance.
 *   • dispatchNotification: "the walker accepted — pay to confirm", with the
 *     amount and the payment link (customer inbox+sms+push).
 *   The escrow hold, the 'confirmed' status, the Octopus CONFIRMED move and
 *   the fiscal document all belong to the verified payment.
 *
 * Design note: docs/design/2026-08-26-booking-accept-dispatcher.md
 */

import { eq, and } from 'drizzle-orm';
import { db } from '../../db';
import {
  walkBookings,
  walkerProfiles,
} from '@shared/schema';
import { logger } from '../../lib/logger';
import { calendarIntegrationService } from '../CalendarIntegrationService';
import { syncChatToBookingStatus } from '../../lib/booking-chat-sync';
import { backupFinancialDocument } from '../gcsBackupService';
import { pool } from '../../db';

export type AcceptWalkOutcome =
  | { ok: true; status: 'payment_pending'; bookingId: string;
      /** The customer must pay on the hosted page; the verified return confirms. */
      paymentRail: 'AWAITING_CUSTOMER_CARD';
      /** What the customer owes, in agorot — the amount the rail will charge. */
      amountDueCents: number; }
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

    // NOTHING ELSE HAPPENS HERE. The escrow hold and the 'confirmed' status
    // belong to the verified payment (see the header): walk-my-pet.ts
    // /walks/:bookingId/sumit-return places the hold, flips the status, syncs
    // the chat and moves Octopus to CONFIRMED — only after SUMIT confirms the
    // charge, the amount matches this booking, and the payment is claimed.
    await syncChatToBookingStatus(bookingId, 'payment_pending', 'walk_my_pet').catch((chatErr) =>
      logger.warn('[acceptWalkBookingCore] chat sync failed (non-blocking)', { bookingId, error: String(chatErr) }),
    );

    // NO fiscal receipt is issued here, and none is due: acceptance is an
    // operational event. Israeli law puts מועד החיוב at the supply, so the
    // walk's fiscal record is written at completion (recordProviderSettlement
    // + the P&L ledger entry in /walks/:bookingId/complete).
    logger.info('[acceptWalkBookingCore] Walker ACCEPTED — awaiting the customer\'s card payment (no fiscal receipt issued at accept)', {
      bookingId, totalCost: booking.totalCost,
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
          // Acceptance, not escrow: no money is held until the customer pays.
          documentType: 'booking_accept_record',
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
            acceptedAt: new Date().toISOString(),
            awaitingCustomerCardPayment: true,
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
        title: '✅ המטייל/ת אישר/ה — נותר לשלם',
        bodyHtml: `<p>המטייל/ת אישר/ה את הטיול שלך ב-⁦Walk My Pet™⁩. ההזמנה תאושר סופית לאחר התשלום: ₪${parseFloat(booking.totalCost || '0').toFixed(2)}.</p>`,
        bodyText: `המטייל/ת אישר/ה את הטיול. ההזמנה תאושר לאחר תשלום של ₪${parseFloat(booking.totalCost || '0').toFixed(2)}.`,
        ctaText: 'תשלום ואישור ההזמנה',
        ctaUrl: `${base}/walk-my-pet/bookings/${booking.bookingId}/pay`,
        channels: ['inbox', 'sms', 'push'],
        priority: 8,
        meta: { bookingId: booking.bookingId },
      });
    } catch (notifErr: any) {
      logger.warn('[acceptWalkBookingCore] accept customer-notification failed (non-blocking)', { error: notifErr?.message });
    }

    return {
      ok: true,
      status: 'payment_pending',
      bookingId,
      paymentRail: 'AWAITING_CUSTOMER_CARD',
      amountDueCents: Math.round(parseFloat(booking.totalCost || '0') * 100),
    };
  } catch (err: any) {
    logger.error('[acceptWalkBookingCore] unexpected error', { bookingId, providerUid, error: err?.message });
    return { ok: false, errorCode: 'DB_ERROR', message: err?.message ?? 'unexpected error' };
  }
}
