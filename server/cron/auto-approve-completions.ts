/**
 * AUTO-APPROVE BOOKING COMPLETIONS CRON
 *
 * Blueprint §13 specifies a dual-approval gate for service completion:
 *   Step 1: Provider marks complete  → status = provider_marked_complete
 *   Step 2: Customer approves        → status = completed  (escrow released)
 *
 * If the customer takes no action within 24 hours, the platform auto-approves
 * on the customer's behalf. This prevents providers from being trapped in an
 * unpaid limbo when customers forget or go silent.
 *
 * What this job does every 15 minutes:
 *   1. Find all bookings in status = 'provider_marked_complete'
 *      where providerCompletedAt (or updatedAt) is older than 24 hours.
 *   2. Set status = 'completed', paymentReleasedAt = now(), customerApprovedAt = now().
 *   3. Create the earningRecord in payoutLedger (idempotent — skips if already exists).
 *   4. Notify both parties.
 *
 * Safety:
 *   - Idempotent: uses a unique constraint check before inserting earning records.
 *   - Non-fatal: individual booking failures are logged and skipped.
 *   - Processes max 50 bookings per run to avoid overwhelming the DB.
 */

import cron from 'node-cron';
import { db } from '../db';
import { bookingRequests, superAppNotifications, contractorEarnings, bookingDisputes, users } from '@shared/schema';
import { IsraeliDigitalReceiptService } from '../services/IsraeliDigitalReceiptService';
import { formatUserAddress, bookingSnapshotToAddress } from '@shared/formatAddress';
import { and, eq, lt, sql, inArray } from 'drizzle-orm';
import { logger } from '../lib/logger';
import { createEarningRecord } from '../services/payoutLedger';
import { dispatchNotification } from '../lib/notificationDispatcher';
import EscrowService from '../services/EscrowService';
import { writeBookingLedgerEntries } from '../services/bookingLedgerWriter';

const AUTO_APPROVE_AFTER_MS = 24 * 60 * 60 * 1000; // 24 hours
const BATCH_SIZE = 50;

async function autoApproveExpiredCompletions(): Promise<void> {
  const cutoff = new Date(Date.now() - AUTO_APPROVE_AFTER_MS);

  // Find bookings that the provider has marked complete but the customer has not
  // confirmed for 24+ hours. We look at providerCompletedAt first; fall back to
  // updatedAt (the timestamp of the provider_marked_complete state transition).
  const stale = await db
    .select()
    .from(bookingRequests)
    .where(
      and(
        eq(bookingRequests.status, 'provider_marked_complete'),
        // providerCompletedAt is nullable; use the COALESCE with updatedAt as fallback
        sql`COALESCE(${bookingRequests.providerCompletedAt}, ${bookingRequests.updatedAt}) < ${cutoff.toISOString()}`,
      ),
    )
    .limit(BATCH_SIZE);

  if (stale.length === 0) {
    logger.debug('[AutoApprove] No stale completions to process');
    return;
  }

  logger.info('[AutoApprove] Found stale completions to auto-approve', { count: stale.length });

  for (const booking of stale) {
    try {
      const now = new Date();

      // Dispute guard (2026-07-08): NEVER auto-approve — and pay out — a booking
      // that has an OPEN dispute. A dispute filed on the escrow rail mirrors into
      // booking_disputes (server/routes/escrow.ts) and freezes the escrow; the
      // SQL payout gate reads booking_disputes only. Without this skip, the 24h
      // auto-approve would create the earning + release escrow for a disputed
      // booking. Statuses mirror payoutGate.OPEN_DISPUTE_STATUSES.
      const openDispute = await db
        .select({ id: bookingDisputes.id })
        .from(bookingDisputes)
        .where(and(
          eq(bookingDisputes.bookingId, booking.requestId),
          inArray(bookingDisputes.status, ['open', 'under_review', 'pending', 'escalated']),
        ))
        .limit(1);
      if (openDispute.length > 0) {
        logger.warn('[AutoApprove] SKIPPED — booking has an open dispute; not auto-releasing', {
          requestId: booking.requestId,
        });
        continue;
      }

      // Idempotency guard: if an earning record already exists for this booking, skip.
      const existing = await db
        .select({ earningId: contractorEarnings.earningId })
        .from(contractorEarnings)
        .where(eq(contractorEarnings.bookingId, booking.requestId))
        .limit(1);

      if (existing.length === 0) {
        // providerType drives both bookingType and contractorType — same mapping rule.
        const providerRole: 'sitter' | 'walker' =
          booking.providerType === 'sitter' ? 'sitter' : 'walker';

        await createEarningRecord({
          contractorId: booking.providerId,
          contractorType: providerRole,
          bookingType: providerRole,
          bookingId: booking.requestId,
          baseAmount: (booking.subtotalCents ?? booking.totalCents) / 100,
          platformFeePercent: 15,
          dayCount: booking.totalDays ?? undefined,
          hourCount: booking.totalHours ? parseFloat(booking.totalHours) : undefined,
        });
      }

      const statusHistory = ((booking.statusHistory as unknown as any[]) ?? []);
      statusHistory.push({
        status: 'completed',
        timestamp: now.toISOString(),
        actorType: 'system',
        note: 'Auto-approved by platform after 24-hour customer inaction. Payment released to provider.',
      });

      // ── Real escrow release: update Firestore escrow to 'released' ──────────
      try {
        const escrows = await EscrowService.getEscrowsByBooking(booking.requestId);
        for (const escrow of escrows) {
          if (escrow.status === 'held') {
            await EscrowService.releaseEscrowPayment(escrow.id, 'system_auto_approve');
            logger.info('[AutoApprove] Firestore escrow released', { requestId: booking.requestId, escrowId: escrow.id });
          }
        }
      } catch (escrowErr: any) {
        logger.warn('[AutoApprove] Firestore escrow release failed (non-blocking)', {
          error: escrowErr.message, requestId: booking.requestId,
        });
      }

      // ── Write canonical pw_payments + pw_provider_payouts rows ──────────────
      try {
        await writeBookingLedgerEntries({
          requestId: booking.requestId,
          ownerId: booking.ownerId,
          providerId: booking.providerId,
          providerType: booking.providerType,
          totalCents: booking.totalCents,
          subtotalCents: booking.subtotalCents ?? booking.totalCents,
          serviceFeeCents: booking.serviceFeeCents,
          paymentTransactionId: booking.paymentTransactionId,
          paymentMethod: booking.paymentMethod,
        });
      } catch (ledgerErr: any) {
        logger.warn('[AutoApprove] Ledger write failed (non-blocking)', {
          error: ledgerErr.message, requestId: booking.requestId,
        });
      }

      // ── Fiscal receipt at the SAME escrow-release event (2026-07-30 audit):
      // this cron completed bookings + released money with NO receipt — the
      // manual /confirm path issues one, so 24h-inaction customers silently got
      // no tax document. Mirrors handleConfirmCompletion; generateReceipt has
      // its own exactly-once guard so double-fire is safe (money-invariants §2).
      try {
        const [owner] = await db
          .select({ email: users.email, first: users.firstName, last: users.lastName })
          .from(users)
          .where(eq(users.id, booking.ownerId))
          .limit(1);
        const commissionIls = (booking.serviceFeeCents || 0) / 100;
        await IsraeliDigitalReceiptService.generateReceipt({
          platform: 'booking-requests',
          paymentClass: 'PROVIDER_BOOKING_COMMISSION',
          bookingId: booking.requestId,
          customerEmail: owner?.email || '',
          customerName: [owner?.first, owner?.last].filter(Boolean).join(' '),
          serviceAddress: formatUserAddress(bookingSnapshotToAddress(booking), { lang: 'he' }) || undefined,
          providerId: booking.providerId,
          providerType: booking.providerType,
          serviceDescription: `PetWash booking — ${booking.serviceType}`,
          serviceDescriptionHe: `הזמנת PetWash — ${booking.serviceType}`,
          subtotalAmount: (booking.subtotalCents || 0) / 100,
          platformFeeAmount: commissionIls,
          totalAmount: (booking.totalCents || booking.subtotalCents || 0) / 100,
          paymentMethod: 'Escrow (card)',
          providerPayoutAmount:
            ((booking.subtotalCents || 0) - (booking.serviceFeeCents || 0)) / 100,
          brokerCommissionAmount: commissionIls,
        });
      } catch (receiptErr: any) {
        logger.warn('[AutoApprove] Receipt generation failed (non-blocking)', {
          error: receiptErr?.message, requestId: booking.requestId,
        });
      }

      // Review-request email — auto-approved completions (the DEFAULT path:
      // 24h customer inaction) never published booking.completed and never
      // asked for a review (2026-07-30 audit). Direct sender, fail-soft.
      try {
        const { sendServiceCompletedReview } = await import('../email/sendServiceCompletedReview');
        await sendServiceCompletedReview({
          requestId: booking.requestId,
          ownerId: booking.ownerId,
          providerId: booking.providerId,
          serviceType: booking.providerType,
          totalCents: booking.totalCents,
          petDetails: (booking as any).petDetails,
          endDate: (booking as any).endDate,
        });
      } catch (reviewErr: any) {
        logger.warn('[AutoApprove] review email failed (non-blocking)', {
          error: reviewErr?.message, requestId: booking.requestId,
        });
      }

      await db
        .update(bookingRequests)
        .set({
          status: 'completed',
          ownerConfirmedAt: now,
          customerApprovedAt: now,
          paymentReleasedAt: now,
          statusHistory: statusHistory as any, // jsonb column — cast required by Drizzle
          updatedAt: now,
        })
        .where(
          and(
            eq(bookingRequests.requestId, booking.requestId),
            // Re-check status to prevent race with manual customer approval
            eq(bookingRequests.status, 'provider_marked_complete'),
          ),
        );

      // Notify provider
      try {
        await dispatchNotification({
          uid: booking.providerId,
          type: 'receipt',
          title: '💰 תשלום שוחרר (אישור אוטומטי)',
          bodyHtml: `<p>ה-24 שעות חלפו. התשלום עבור הזמנה <strong>${booking.requestId}</strong> שוחרר אוטומטית. ₪${((booking.subtotalCents ?? booking.totalCents) / 100).toFixed(2)} יועבר לחשבונך תוך 72 שעות.</p>`,
          channels: ['inbox'],
          priority: 5,
          meta: { bookingId: booking.requestId },
        });
      } catch (notifErr: any) {
        logger.warn('[AutoApprove] Provider notification failed', { error: notifErr.message, requestId: booking.requestId });
      }

      // Notify customer
      try {
        await db.insert(superAppNotifications).values({
          userId: booking.ownerId,
          type: 'booking_auto_completed',
          title: '✅ הזמנה הושלמה אוטומטית',
          titleHe: '✅ הזמנה הושלמה אוטומטית',
          body: `לא אישרת את הזמנה ${booking.requestId} תוך 24 שעות. ההזמנה סגורה אוטומטית והתשלום שוחרר לספק.`,
          bodyHe: `לא אישרת את הזמנה ${booking.requestId} תוך 24 שעות. ההזמנה סגורה אוטומטית והתשלום שוחרר לספק.`,
          // ?review=1 fires the end-of-stay banner + rating form auto-scroll
          // on BookingConfirmation.tsx (PR #1906). The customer never rated
          // the service (that's why cron auto-approved) — deep-link them
          // straight to the star form so they can still leave a review.
          actionUrl: `/booking/confirmation/${booking.requestId}?review=1`,
          actionType: 'open_booking',
          channels: ['in_app'],
          isRead: false,
          createdAt: now,
        } as any);
      } catch (notifErr: any) {
        logger.warn('[AutoApprove] Customer notification failed', { error: notifErr.message, requestId: booking.requestId });
      }

      logger.info('[AutoApprove] Booking auto-approved', {
        requestId: booking.requestId,
        providerId: booking.providerId,
        ownerId: booking.ownerId,
        subtotalCents: booking.subtotalCents,
      });
    } catch (err: any) {
      logger.error('[AutoApprove] Failed to auto-approve booking', {
        requestId: booking.requestId,
        error: err.message,
      });
    }
  }
}

export function startAutoApproveCompletionsCron(): void {
  logger.info('[AutoApprove] Initializing auto-approve completions cron (every 15 minutes)');

  cron.schedule('*/15 * * * *', async () => {
    // Leader-elected: on multi-replica Cloud Run exactly ONE instance runs this
    // tick, so two replicas can't both create an earning for the same booking
    // (2026-07-08 double-payout fix). Fail-safe: runs anyway if Redis is down.
    try {
      const { BackgroundJobProcessor } = await import('../backgroundJobs');
      await BackgroundJobProcessor.runWithLock('autoApproveCompletions', autoApproveExpiredCompletions);
    } catch (err: any) {
      logger.error('[AutoApprove] Cron run failed', { error: err.message });
    }
  });

  // Run once shortly after startup to catch any stale bookings from before this
  // cron was introduced (give the server 3 minutes to finish its startup checks).
  setTimeout(async () => {
    try {
      const { BackgroundJobProcessor } = await import('../backgroundJobs');
      await BackgroundJobProcessor.runWithLock('autoApproveCompletions', autoApproveExpiredCompletions);
    } catch (err: any) {
      logger.error('[AutoApprove] Startup scan failed', { error: err.message });
    }
  }, 3 * 60 * 1000);
}

export default startAutoApproveCompletionsCron;
