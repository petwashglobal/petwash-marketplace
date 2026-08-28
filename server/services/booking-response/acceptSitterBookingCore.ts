/**
 * acceptSitterBookingCore — pure-function version of the ACCEPT branch
 * inside `PATCH /api/sitter-suite/bookings/:bookingId/provider-respond`
 * (server/routes/sitter-suite.ts:1128-1355).
 *
 * MONEY-CRITICAL. Do NOT introduce new business rules here. Every side
 * effect is preserved 1:1 from the original handler:
 *
 *   1. Atomic status claim: pending_provider → payment_pending in a
 *      SINGLE UPDATE with a WHERE guard. Zero-row result → ALREADY_CLAIMED.
 *      A sitter double-click cannot double-charge.
 *
 *   2. nayaxSitterMarketplace.processBookingPayment() charges the
 *      owner's stored payment method. Provider does NOT supply a token.
 *
 *   3. On payment failure: flip status → payment_failed (WHERE-guarded on
 *      payment_pending so an out-of-order webhook cannot overwrite a
 *      confirmed row).
 *
 *   4. On payment success:
 *        • sitterAdvancedBookingEngine.confirmBooking() places escrow.
 *        • sitter_bookings.status → confirmed + paymentStatus=captured
 *          + nayaxTransactionId + confirmedAt.
 *        • syncChatToBookingStatus(bookingId, 'confirmed').
 *        • octopus_bookings.status → CONFIRMED + PAYMENT_CAPTURED ledger.
 *        • calendar event (non-blocking).
 *        • Fiscal receipt — SKIPPED when nayaxTransactionId starts with
 *          'SIM_' (money-invariants §2: no fiscal document for simulated
 *          payments). Otherwise IsraeliDigitalReceiptService.generateReceipt
 *          with the resolved customer email.
 *        • GCS backup of financial record (non-blocking).
 *        • provider_response_changed audit event.
 *
 * WHY THIS EXISTS
 *   The dispatcher (BookingResponseDispatcher) can now route sitter
 *   accept events through this function while the flag is off in prod.
 *   A follow-up cut of the route handler will delegate here so ONE
 *   implementation owns the money path — no drift, no duplication.
 *
 * Design note: docs/design/2026-08-26-booking-accept-dispatcher.md
 */

import { eq, and } from 'drizzle-orm';
import { db } from '../../db';
import {
  sitterBookings,
  sitterProfiles,
  octopusBookings,
  octopusLedger,
  users,
} from '@shared/schema';
import { formatUserAddress, bookingSnapshotToAddress } from '@shared/formatAddress';
import { logger } from '../../lib/logger';
import { nanoid } from 'nanoid';
import { nayaxSitterMarketplace } from '../NayaxSitterMarketplaceService';
import { advancedBookingEngine as sitterAdvancedBookingEngine } from '../SitterAdvancedBookingEngine';
import { calendarIntegrationService } from '../CalendarIntegrationService';
import { syncChatToBookingStatus } from '../../lib/booking-chat-sync';
import { IsraeliDigitalReceiptService } from '../IsraeliDigitalReceiptService';
import { backupFinancialDocument } from '../gcsBackupService';
import { logAuditEvent } from '../../middleware/auditLog';

export type AcceptSitterOutcome =
  | { ok: true; status: 'confirmed'; nayaxTransactionId: string | null; bookingId: string }
  | { ok: false; errorCode:
        | 'BOOKING_NOT_FOUND'
        | 'BOOKING_WRONG_STATE'
        | 'FORBIDDEN'
        | 'ALREADY_CLAIMED'
        | 'PAYMENT_FAILED'
        | 'DB_ERROR';
      message: string;
      currentStatus?: string;
      details?: Record<string, unknown>;
    };

export interface AcceptSitterInput {
  bookingId: string;
  providerUid: string;
  traceId?: string;
}

export async function acceptSitterBookingCore(input: AcceptSitterInput): Promise<AcceptSitterOutcome> {
  const { bookingId, providerUid } = input;

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

    const [sitter] = await db
      .select()
      .from(sitterProfiles)
      .where(eq(sitterProfiles.id, booking.sitterId));
    if (!sitter || sitter.userId !== providerUid) {
      return { ok: false, errorCode: 'FORBIDDEN', message: 'Only the assigned provider can respond to this booking' };
    }

    // ── ATOMIC CLAIM ────────────────────────────────────────────────────
    // pending_provider → payment_pending in ONE UPDATE with a WHERE guard.
    // Zero rows returned means another request (or a double-click) already
    // claimed it. Preserves the invariant that a single booking is charged
    // at most once.
    const claimResult = await db
      .update(sitterBookings)
      .set({ status: 'payment_pending', updatedAt: new Date() })
      .where(and(
        eq(sitterBookings.bookingId, bookingId),
        eq(sitterBookings.status, 'pending_provider'),
      ))
      .returning({ id: sitterBookings.id });
    if (claimResult.length === 0) {
      logger.warn('[acceptSitterBookingCore] concurrent accept — atomic claim lost', { bookingId, providerUid });
      return {
        ok: false, errorCode: 'ALREADY_CLAIMED',
        message: 'This booking is already being processed — please refresh.',
      };
    }

    // Payment capture against the owner's stored method. Provider does
    // NOT supply a token — this is a marketplace push charge.
    const pricePerDayCents = Math.round(booking.totalChargeCents / booking.totalDays);
    let paymentResult = { success: false, nayaxTransactionId: '', error: '' };
    try {
      paymentResult = await nayaxSitterMarketplace.processBookingPayment({
        bookingId: booking.bookingId,
        ownerId: booking.ownerId,
        sitterId: booking.sitterId,
        pricePerDayCents,
        totalDays: booking.totalDays,
      });
    } catch (paymentErr: any) {
      logger.error('[acceptSitterBookingCore] Payment capture on accept failed', { bookingId, error: paymentErr?.message });
    }

    // Payment failure → flip status → payment_failed with a WHERE guard on
    // the payment_pending state we just claimed. Never overwrite a
    // subsequently-confirmed row.
    if (!paymentResult.success) {
      logger.error('[acceptSitterBookingCore] Cannot confirm booking — payment capture failed', { bookingId });
      await db
        .update(sitterBookings)
        .set({
          status: 'payment_failed',
          paymentStatus: 'failed',
          updatedAt: new Date(),
        })
        .where(and(
          eq(sitterBookings.bookingId, bookingId),
          eq(sitterBookings.status, 'payment_pending'),
        ));
      return {
        ok: false, errorCode: 'PAYMENT_FAILED',
        message: paymentResult.error || 'Payment capture failed',
        details: { hebrewMessage: 'חיוב התשלום נכשל. ההזמנה לא אושרה.' },
      };
    }

    // Escrow hold via the advanced booking engine — releases funds to the
    // real sitter (sitter.userId), not the sitterProfile row id.
    await sitterAdvancedBookingEngine.confirmBooking(
      booking.bookingId,
      {
        subtotal: booking.basePriceCents / 100,
        platformFee: booking.platformServiceFeeCents / 100,
        providerPayout: booking.sitterPayoutCents / 100,
        totalPrice: booking.totalChargeCents / 100,
        loyaltyDiscount: 0,
        currency: 'ILS',
        breakdown: [],
      },
      booking.ownerId,
      sitter.userId,
    );

    // Confirmed row commit. No WHERE guard here — payment_pending is a
    // transient state we just held; a concurrent flip is a bug elsewhere.
    await db
      .update(sitterBookings)
      .set({
        status: 'confirmed',
        paymentStatus: 'captured',
        nayaxTransactionId: paymentResult.nayaxTransactionId || null,
        confirmedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(sitterBookings.bookingId, bookingId));

    await syncChatToBookingStatus(bookingId, 'confirmed', 'sitter_suite').catch((chatErr) =>
      logger.warn('[acceptSitterBookingCore] chat sync failed (non-blocking)', { bookingId, error: String(chatErr) }),
    );

    // Octopus DRAFT → CONFIRMED + PAYMENT_CAPTURED ledger.
    try {
      const [octopusRecord] = await db
        .select()
        .from(octopusBookings)
        .where(eq(octopusBookings.idempotencyKey, bookingId))
        .limit(1);
      if (octopusRecord) {
        await db.update(octopusBookings)
          .set({ status: 'CONFIRMED', updatedAt: new Date() })
          .where(eq(octopusBookings.id, octopusRecord.id));
        await db.insert(octopusLedger).values({
          id: `OL-${nanoid(8)}`,
          type: 'PAYMENT_CAPTURED',
          bookingId: octopusRecord.id,
          amount: octopusRecord.price,
          platform: 'PETSITTER',
          metadata: { nayaxTransactionId: paymentResult.nayaxTransactionId, escrowHoldHours: 72 },
        });
        logger.info('[acceptSitterBookingCore] Sitter booking confirmed + payment captured', { octopusId: octopusRecord.id });
      }
    } catch (octopusErr) {
      logger.warn('[acceptSitterBookingCore] Failed to update sitter octopus status (non-blocking)', octopusErr);
    }

    logger.info('[acceptSitterBookingCore] ✅ Provider ACCEPTED booking - payment captured', { bookingId, sitterId: sitter.id });

    // Calendar event — non-fatal, booking is already confirmed.
    calendarIntegrationService.createBookingEvent({
      platform: 'sitter-suite',
      bookingId: booking.bookingId,
      title: `⁦The Sitter Suite™⁩ - Pet Sitting (${booking.totalDays} days)`,
      description: `Pet sitting booking confirmed for ${booking.totalDays} day(s)`,
      startTime: new Date(booking.startDate),
      endTime: new Date(booking.endDate),
      providerName: `${sitter.firstName} ${sitter.lastName}`,
    }).catch((e: any) =>
      logger.warn('[acceptSitterBookingCore] calendar event create failed (non-fatal, booking already confirmed)', {
        bookingId: booking.bookingId, error: e?.message,
      }),
    );

    // Fiscal receipt — SIMULATED payments (SIM_ prefix) never get one.
    // A real SUMIT/ITA חשבונית for money that was never collected is a
    // false tax document. Money-invariants §2: receipts only at a
    // VERIFIED fiscal event.
    if (paymentResult.nayaxTransactionId?.startsWith('SIM_')) {
      logger.warn('[acceptSitterBookingCore] Simulated payment (SIM_) — booking confirmed for testing, NO fiscal receipt issued', {
        bookingId: booking.bookingId, txId: paymentResult.nayaxTransactionId,
      });
    } else {
      try {
        const [owner] = await db
          .select({ email: users.email, first: users.firstName, last: users.lastName })
          .from(users)
          .where(eq(users.id, booking.ownerId))
          .limit(1);
        await IsraeliDigitalReceiptService.generateReceipt({
          platform: 'sitter-suite',
          paymentClass: 'PROVIDER_BOOKING_COMMISSION',
          bookingId: booking.bookingId,
          nayaxTransactionId: paymentResult.nayaxTransactionId,
          customerEmail: owner?.email || '',
          customerName: [owner?.first, owner?.last].filter(Boolean).join(' '),
          serviceAddress: formatUserAddress(bookingSnapshotToAddress(booking), { lang: 'he' }) || undefined,
          providerName: `${sitter.firstName} ${sitter.lastName}`,
          providerId: sitter.id.toString(),
          providerType: 'sitter',
          serviceDescription: `Pet sitting - ${booking.totalDays} day(s)`,
          serviceDescriptionHe: `שמרטפות - ${booking.totalDays} ${booking.totalDays === 1 ? 'יום' : 'ימים'}`,
          subtotalAmount: booking.basePriceCents / 100,
          platformFeeAmount: booking.platformServiceFeeCents / 100,
          totalAmount: booking.totalChargeCents / 100,
          paymentMethod: 'Nayax Card Payment',
          providerPayoutAmount: booking.sitterPayoutCents / 100,
          brokerCommissionAmount: booking.platformServiceFeeCents / 100,
        });
      } catch (receiptErr) {
        logger.warn('[acceptSitterBookingCore] Receipt generation after accept failed (non-blocking)', receiptErr);
      }
    }

    // GCS backup — non-blocking.
    (async () => {
      try {
        await backupFinancialDocument({
          documentType: 'escrow_record',
          bookingId: booking.bookingId,
          platform: 'PETSITTER',
          content: JSON.stringify({
            bookingId: booking.bookingId,
            ownerId: booking.ownerId,
            sitterId: booking.sitterId,
            totalChargeCents: booking.totalChargeCents,
            platformServiceFeeCents: booking.platformServiceFeeCents,
            sitterPayoutCents: booking.sitterPayoutCents,
            nayaxTransactionId: paymentResult.nayaxTransactionId,
            confirmedAt: new Date().toISOString(),
            escrowHoldHours: 72,
          }, null, 2),
          metadata: {
            nayaxTransactionId: paymentResult.nayaxTransactionId || '',
            totalDays: booking.totalDays.toString(),
          },
        });
      } catch (gcsErr) {
        logger.warn('[acceptSitterBookingCore] GCS financial backup failed (non-blocking)', gcsErr);
      }
    })();

    // Append-only audit — mirrors the DECLINE branch shape so downstream
    // queries can filter on metadata.response.
    void logAuditEvent({
      actorUserId: providerUid,
      actionType: 'provider_response_changed',
      targetType: 'booking',
      targetId: bookingId,
      severity: 'info',
      traceId: input.traceId,
      metadata: {
        response: 'accept',
        newStatus: 'confirmed',
        platform: 'sitter_suite',
      },
    }).catch(() => { /* helper already swallows; double-guard */ });

    return {
      ok: true,
      status: 'confirmed',
      nayaxTransactionId: paymentResult.nayaxTransactionId || null,
      bookingId,
    };
  } catch (err: any) {
    logger.error('[acceptSitterBookingCore] unexpected error', { bookingId, providerUid, error: err?.message });
    return { ok: false, errorCode: 'DB_ERROR', message: err?.message ?? 'unexpected error' };
  }
}
