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
import { bookingRequests, superAppNotifications, contractorEarnings } from '@shared/schema';
import { and, eq, lt, sql, inArray } from 'drizzle-orm';
import { logger } from '../lib/logger';
import { createEarningRecord } from '../services/payoutLedger';
import { dispatchNotification } from '../lib/notificationDispatcher';

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

      // Idempotency guard: if an earning record already exists for this booking, skip.
      const existing = await db
        .select({ earningId: contractorEarnings.earningId })
        .from(contractorEarnings)
        .where(eq(contractorEarnings.bookingId, booking.requestId))
        .limit(1);

      if (existing.length === 0) {
        const bookingType: 'sitter' | 'walker' =
          booking.providerType === 'sitter' ? 'sitter' : 'walker';
        const contractorType: 'sitter' | 'walker' =
          booking.providerType === 'sitter' ? 'sitter' : 'walker';

        await createEarningRecord({
          contractorId: booking.providerId,
          contractorType,
          bookingType,
          bookingId: booking.requestId,
          baseAmount: (booking.subtotalCents ?? booking.totalCents) / 100,
          platformFeePercent: 15,
          dayCount: booking.totalDays ?? undefined,
          hourCount: booking.totalHours ? parseFloat(booking.totalHours) : undefined,
        });
      }

      const statusHistory = ((booking.statusHistory as any[]) ?? []);
      statusHistory.push({
        status: 'completed',
        timestamp: now.toISOString(),
        actorType: 'system',
        note: 'Auto-approved by platform after 24-hour customer inaction. Payment released to provider.',
      });

      await db
        .update(bookingRequests)
        .set({
          status: 'completed',
          ownerConfirmedAt: now,
          customerApprovedAt: now,
          paymentReleasedAt: now,
          statusHistory,
          updatedAt: now,
        } as any)
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
          actionUrl: `/booking/confirmation/${booking.requestId}`,
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
    await autoApproveExpiredCompletions().catch((err) => {
      logger.error('[AutoApprove] Cron run failed', { error: err.message });
    });
  });

  // Run once shortly after startup to catch any stale bookings from before this
  // cron was introduced (give the server 3 minutes to finish its startup checks).
  setTimeout(() => {
    autoApproveExpiredCompletions().catch((err) => {
      logger.error('[AutoApprove] Startup scan failed', { error: err.message });
    });
  }, 3 * 60 * 1000);
}

export default startAutoApproveCompletionsCron;
