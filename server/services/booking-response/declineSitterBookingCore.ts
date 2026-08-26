/**
 * declineSitterBookingCore — the pure-function version of the DECLINE
 * branch inside `PATCH /api/sitter-suite/bookings/:bookingId/provider-respond`
 * (server/routes/sitter-suite.ts:1357-1450).
 *
 * WHY THIS EXISTS
 *   The dispatcher (`BookingResponseDispatcher`) must be able to route
 *   a booking-response event to the sitter pipeline WITHOUT calling the
 *   Express route handler. Extracting the decline logic to a pure
 *   function achieves two things at once:
 *     1. The v2 provider-response route can delegate to the same
 *        function the dispatcher will call (single implementation, one
 *        set of side effects, no drift).
 *     2. Regression tests can exercise the branch without spinning up
 *        express + supertest.
 *
 * STATUS 2026-08-26: DECLINE branch is EXTRACTED first because it has
 * no payment side effects — a decline never touches Nayax/SUMIT/escrow,
 * so this extraction is money-safe. The ACCEPT branch (which DOES touch
 * money) will be extracted in a follow-up once this shape is proven.
 *
 * Design note: docs/design/2026-08-26-booking-accept-dispatcher.md
 *
 * IMPORTANT — side effects preserved 1:1 from the route handler:
 *   • sitter_bookings.status → 'declined' (with declineReason + cancelledAt)
 *   • releaseSlotLock() to free the sitter's calendar (P0-1 fix)
 *   • syncChatToBookingStatus(bookingId, 'cancelled')
 *   • octopus_bookings.status → 'CANCELLED' + octopus_ledger CANCELLATION entry
 *   • Void any existing receipts (defence in depth — decline should have none)
 *   • provider_response_changed audit event
 *
 * All of these were `try/catch` non-fatal in the original handler;
 * they stay non-fatal here. The function itself returns { ok: true }
 * once the status flip succeeds — everything downstream is
 * best-effort observability, mirroring the original handler exactly.
 */

import { eq } from 'drizzle-orm';
import { db } from '../../db';
import { sitterBookings, sitterProfiles, octopusBookings, octopusLedger } from '@shared/schema';
import { logger } from '../../lib/logger';
import { nanoid } from 'nanoid';
import { releaseSlotLock } from '../../lib/marketplaceSlotLock';
import { syncChatToBookingStatus } from '../../lib/booking-chat-sync';
import { IsraeliDigitalReceiptService } from '../IsraeliDigitalReceiptService';
import { logAuditEvent } from '../../middleware/auditLog';

export type DeclineSitterOutcome =
  | { ok: true; status: 'declined'; message: string }
  | { ok: false; errorCode: 'BOOKING_NOT_FOUND' | 'BOOKING_WRONG_STATE' | 'FORBIDDEN' | 'DB_ERROR'; message: string; currentStatus?: string };

export interface DeclineSitterInput {
  bookingId: string;
  providerUid: string;
  declineReason?: string | null;
  /** Optional express-provided traceId — plumbed into audit for correlation. */
  traceId?: string;
}

export async function declineSitterBookingCore(input: DeclineSitterInput): Promise<DeclineSitterOutcome> {
  const { bookingId, providerUid } = input;
  const declineReason = input.declineReason ?? null;

  try {
    const [booking] = await db
      .select()
      .from(sitterBookings)
      .where(eq(sitterBookings.bookingId, bookingId));
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

    // Authorisation: only the assigned provider can decline. Matches the
    // route handler's check exactly. This runs BEFORE the state flip so
    // an unauthorized caller never mutates the row.
    const [sitter] = await db
      .select()
      .from(sitterProfiles)
      .where(eq(sitterProfiles.id, booking.sitterId));
    if (!sitter || sitter.userId !== providerUid) {
      return { ok: false, errorCode: 'FORBIDDEN', message: 'Only the assigned provider can respond to this booking' };
    }

    // Primary side effect — flip the row. Any error here bubbles up.
    await db
      .update(sitterBookings)
      .set({
        status: 'declined',
        cancellationReason: declineReason || 'Provider declined the booking request',
        cancelledAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(sitterBookings.bookingId, bookingId));

    // Free the sitter's calendar — the request is dead. Non-blocking.
    await releaseSlotLock(db, bookingId).catch((relErr) =>
      logger.warn('[declineSitterBookingCore] slot-lock release skipped', { bookingId, error: String(relErr) }),
    );

    // Chat status flip — non-blocking.
    await syncChatToBookingStatus(bookingId, 'cancelled', 'sitter_suite').catch((chatErr) =>
      logger.warn('[declineSitterBookingCore] chat sync failed (non-blocking)', { bookingId, error: String(chatErr) }),
    );

    // Octopus ledger CANCELLATION — no money captured yet at decline, so
    // amount is 0 but the entry keeps the audit trail complete.
    try {
      const [octopusRecord] = await db
        .select()
        .from(octopusBookings)
        .where(eq(octopusBookings.idempotencyKey, bookingId))
        .limit(1);
      if (octopusRecord) {
        await db
          .update(octopusBookings)
          .set({ status: 'CANCELLED', updatedAt: new Date() })
          .where(eq(octopusBookings.id, octopusRecord.id));
        await db.insert(octopusLedger).values({
          id: `OL-${nanoid(8)}`,
          type: 'CANCELLATION',
          bookingId: octopusRecord.id,
          amount: 0,
          platform: 'PETSITTER',
          metadata: {
            reason: declineReason || 'Provider declined',
            cancelledBy: 'provider',
            cancelledAt: new Date().toISOString(),
          },
        });
      }
    } catch (octopusErr) {
      logger.warn('[declineSitterBookingCore] Octopus cancellation ledger entry failed (non-blocking)', octopusErr);
    }

    // Defensive receipt void — payment isn't captured until accept in
    // this flow, so no receipts should exist. A retry/race could leave
    // a stale one; void it.
    try {
      const existingReceipts = await IsraeliDigitalReceiptService.getReceiptByBookingId(bookingId);
      for (const r of existingReceipts) {
        if (!r.isVoided) {
          await IsraeliDigitalReceiptService.voidReceipt({
            receiptId: r.id,
            voidReason: `Booking declined by provider: ${declineReason || 'no reason given'}`,
          });
        }
      }
    } catch (voidErr) {
      logger.warn('[declineSitterBookingCore] Receipt void on decline failed (non-blocking)', voidErr);
    }

    logger.info('[declineSitterBookingCore] ❌ Provider DECLINED booking', { bookingId, reason: declineReason });

    // Append-only audit — mirrors the ACCEPT branch shape so downstream
    // queries can filter on metadata.response.
    void logAuditEvent({
      actorUserId: providerUid,
      actionType: 'provider_response_changed',
      targetType: 'booking',
      targetId: bookingId,
      severity: 'info',
      traceId: input.traceId,
      metadata: {
        response: 'decline',
        newStatus: 'declined',
        platform: 'sitter_suite',
        reason: typeof declineReason === 'string' ? declineReason.slice(0, 200) : null,
      },
    }).catch(() => { /* helper already swallows; double-guard */ });

    return {
      ok: true,
      status: 'declined',
      message: 'ההזמנה נדחתה. הלקוח/ה יקבל/תקבל הודעה.',
    };
  } catch (err: any) {
    logger.error('[declineSitterBookingCore] unexpected error', { bookingId, providerUid, error: err?.message });
    return { ok: false, errorCode: 'DB_ERROR', message: err?.message ?? 'unexpected error' };
  }
}
