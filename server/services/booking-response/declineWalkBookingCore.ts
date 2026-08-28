/**
 * declineWalkBookingCore — pure-function version of the DECLINE branch
 * inside `PATCH /api/walk-my-pet/bookings/:bookingId/provider-respond`
 * (server/routes/walk-my-pet.ts:1020-1086).
 *
 * Sibling of declineSitterBookingCore. Same extract-decline-first
 * discipline (money-safe: walk decline never captures payment) so the
 * dispatcher can route walk decline events today while the accept
 * path stays behind its extraction.
 *
 * IMPORTANT — 1:1 with the original handler:
 *   • walk_bookings.status → 'cancelled' (NOT 'declined' — this is a
 *     real semantic difference from sitter and it must be preserved).
 *   • releaseSlotLock() — frees the walker's calendar.
 *   • syncChatToBookingStatus(bookingId, 'cancelled', 'walk_my_pet').
 *   • octopus_bookings.status → 'CANCELLED' + octopus_ledger CANCELLATION
 *     entry (amount 0 — no capture at decline).
 *   • Void any stale receipts (defence in depth).
 *   • NO logAuditEvent — the walk decline handler does not fire one
 *     today. Preserving that gap 1:1; a future audit-parity PR can
 *     add it if the sitter parity is desired.
 *
 * Design note: docs/design/2026-08-26-booking-accept-dispatcher.md
 */

import crypto from 'node:crypto';
import { eq } from 'drizzle-orm';
import { db } from '../../db';
import { walkBookings, walkerProfiles, octopusBookings, octopusLedger } from '@shared/schema';
import { logger } from '../../lib/logger';
import { releaseSlotLock } from '../../lib/marketplaceSlotLock';
import { syncChatToBookingStatus } from '../../lib/booking-chat-sync';
import { IsraeliDigitalReceiptService } from '../IsraeliDigitalReceiptService';

export type DeclineWalkOutcome =
  | { ok: true; status: 'cancelled'; message: string }
  | { ok: false; errorCode: 'BOOKING_NOT_FOUND' | 'BOOKING_WRONG_STATE' | 'FORBIDDEN' | 'DB_ERROR'; message: string; currentStatus?: string };

export interface DeclineWalkInput {
  bookingId: string;
  providerUid: string;
  declineReason?: string | null;
}

export async function declineWalkBookingCore(input: DeclineWalkInput): Promise<DeclineWalkOutcome> {
  const { bookingId, providerUid } = input;
  const declineReason = input.declineReason ?? null;

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

    // Primary side effect — flip the row. Note status='cancelled' not
    // 'declined' (walk semantic differs from sitter — preserved 1:1).
    await db
      .update(walkBookings)
      .set({ status: 'cancelled', updatedAt: new Date() })
      .where(eq(walkBookings.bookingId, bookingId));

    // Free the walker's calendar. Non-blocking.
    await releaseSlotLock(db, bookingId).catch((relErr) =>
      logger.warn('[declineWalkBookingCore] slot-lock release skipped', { bookingId, error: String(relErr) }),
    );

    await syncChatToBookingStatus(bookingId, 'cancelled', 'walk_my_pet').catch((chatErr) =>
      logger.warn('[declineWalkBookingCore] chat sync failed (non-blocking)', { bookingId, error: String(chatErr) }),
    );

    // Octopus ledger CANCELLATION — no capture at decline, amount is 0.
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
          id: `OL-${crypto.randomBytes(4).toString('hex').toUpperCase()}`,
          type: 'CANCELLATION',
          bookingId: octopusRecord.id,
          amount: 0,
          platform: 'walk_my_pet',
          metadata: {
            reason: declineReason || 'Walker declined',
            cancelledBy: 'provider',
            cancelledAt: new Date().toISOString(),
          },
        });
      }
    } catch (octopusErr) {
      logger.warn('[declineWalkBookingCore] Octopus cancellation ledger entry failed (non-blocking)', octopusErr);
    }

    // Defensive receipt void — payment isn't captured until accept in this
    // flow, so no receipts should exist. A retry could leave a stale one.
    try {
      const existingReceipts = await IsraeliDigitalReceiptService.getReceiptByBookingId(bookingId);
      for (const r of existingReceipts) {
        if (!r.isVoided) {
          await IsraeliDigitalReceiptService.voidReceipt({
            receiptId: r.id,
            voidReason: `Walk declined by walker: ${declineReason || 'no reason given'}`,
          });
        }
      }
    } catch (voidErr) {
      logger.warn('[declineWalkBookingCore] Receipt void on decline failed (non-blocking)', voidErr);
    }

    logger.info(`[declineWalkBookingCore] Walker DECLINED booking ${bookingId}, reason: ${declineReason}`);

    return {
      ok: true,
      status: 'cancelled',
      message: 'הטיול נדחה. הלקוח/ה יקבל/תקבל הודעה.',
    };
  } catch (err: any) {
    logger.error('[declineWalkBookingCore] unexpected error', { bookingId, providerUid, error: err?.message });
    return { ok: false, errorCode: 'DB_ERROR', message: err?.message ?? 'unexpected error' };
  }
}
