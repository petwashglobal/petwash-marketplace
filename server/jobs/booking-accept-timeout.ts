/**
 * Phase B5 — Accept Timeout System.
 *
 * If a provider does not respond to a `pending` booking request within
 * ACCEPT_TIMEOUT_HOURS, the system auto-declines the request, releases
 * any wallet hold the customer placed, and notifies the customer to
 * try a different provider.
 *
 * Scope:
 *   - Only `pending` rows on booking_requests (Postgres canonical).
 *   - Triggered by:
 *       startAcceptTimeoutPoller() — setInterval, registered alongside
 *       startBookingExpiryPoller in server/index.ts.
 *
 * Env:
 *   ACCEPT_TIMEOUT_HOURS   — default 24
 *   ACCEPT_TIMEOUT_POLL_MS — default 5 * 60 * 1000  (5 minutes)
 *
 * Failure mode:
 *   Each booking is processed in its own try/catch. One failure never
 *   blocks the rest of the batch. Wallet-release / notification errors
 *   are logged at warn level — the auto-decline still completes.
 */

import { db } from '../db';
import { bookingRequests } from '@shared/schema';
import { eq, and, lt } from 'drizzle-orm';
import { logger } from '../lib/logger';
import { applyTransition, type BookingStatus } from '@shared/lib/bookingStateMachine';
// WalletService and notificationDispatcher are lazy-loaded inside
// processStaleAcceptRequests so the pure helpers above (computeCutoff,
// shouldAutoDecline, getAcceptTimeoutMs, getAcceptTimeoutPollMs) can
// be unit-tested without WALLET_LINK_SECRET / SendGrid env present.

/** How long a `pending` request can sit before the system auto-declines. */
export function getAcceptTimeoutMs(): number {
  const h = Number(process.env.ACCEPT_TIMEOUT_HOURS ?? '24');
  if (!Number.isFinite(h) || h <= 0) return 24 * 60 * 60 * 1000;
  return h * 60 * 60 * 1000;
}

/** Poll interval — how often the cron tick runs. */
export function getAcceptTimeoutPollMs(): number {
  const ms = Number(process.env.ACCEPT_TIMEOUT_POLL_MS ?? String(5 * 60 * 1000));
  if (!Number.isFinite(ms) || ms <= 0) return 5 * 60 * 1000;
  return ms;
}

/**
 * The cutoff timestamp: any `pending` booking older than this is stale
 * and will be auto-declined on the next tick.
 *
 * Pure function — accepts `now` so tests can pin time without mocks.
 */
export function computeCutoff(now: Date = new Date(), timeoutMs: number = getAcceptTimeoutMs()): Date {
  return new Date(now.getTime() - timeoutMs);
}

/**
 * Pure predicate — does a snapshot of (status, createdAt) qualify for
 * auto-decline given the cutoff?
 */
export function shouldAutoDecline(
  booking: { status: string; createdAt: Date | string | null | undefined },
  cutoff: Date,
): boolean {
  if (booking.status !== 'pending') return false;
  if (!booking.createdAt) return false;
  const created = booking.createdAt instanceof Date
    ? booking.createdAt
    : new Date(booking.createdAt);
  if (Number.isNaN(created.getTime())) return false;
  return created.getTime() < cutoff.getTime();
}

/**
 * Run one cycle of the auto-decline cron tick.
 *
 * Returns counts so the caller (and tests) can observe progress.
 */
export async function processStaleAcceptRequests(): Promise<{
  scanned: number;
  declined: number;
  walletReleased: number;
  errors: number;
}> {
  const cutoff = computeCutoff();
  let scanned = 0;
  let declined = 0;
  let walletReleased = 0;
  let errors = 0;

  let stale: any[] = [];
  try {
    stale = await db.select()
      .from(bookingRequests)
      .where(and(
        eq(bookingRequests.status, 'pending'),
        lt(bookingRequests.createdAt, cutoff),
      ))
      .limit(200); // batch cap; the next tick picks up the rest
  } catch (selectErr: any) {
    logger.error('[AcceptTimeout] Stale-request select failed', { error: selectErr?.message });
    return { scanned: 0, declined: 0, walletReleased: 0, errors: 1 };
  }

  scanned = stale.length;
  if (scanned === 0) return { scanned, declined, walletReleased, errors };

  logger.info('[AcceptTimeout] Found stale pending requests', { count: scanned, cutoff: cutoff.toISOString() });

  for (const booking of stale) {
    try {
      // Centralised state-machine transition (system actor).
      const trans = applyTransition({
        from: booking.status as BookingStatus,
        to: 'declined',
        actor: 'system',
        actorId: 'accept-timeout-poller',
        note: `Auto-declined: provider did not respond within ${(getAcceptTimeoutMs() / 3600000).toFixed(0)}h`,
      });
      if (!trans.result.ok) {
        // Should never happen for from=pending → to=declined (system),
        // but handle defensively in case the state machine evolves.
        logger.warn('[AcceptTimeout] State machine refused transition', {
          requestId: booking.requestId,
          from: booking.status,
          code: trans.result.code,
        });
        continue;
      }

      const statusHistory = (booking.statusHistory as any[]) || [];
      statusHistory.push(trans.historyEntry);

      await db.update(bookingRequests)
        .set({
          status: 'declined',
          statusHistory,
          providerResponse: trans.historyEntry?.note ?? null,
          updatedAt: new Date(),
        } as any)
        .where(eq(bookingRequests.requestId, booking.requestId));

      declined += 1;

      // Release wallet hold if one was placed when the request was created.
      if (booking.financeState === 'hold_active' && Number(booking.walletHoldCents) > 0) {
        try {
          // Lazy import — WalletService throws at module load when
          // WALLET_LINK_SECRET is unset (tests run without it).
          const { walletService } = await import('../services/WalletService');
          const divisionCode = (booking.serviceType === 'sitting'
            ? 'petsitter'
            : booking.serviceType === 'walking' ? 'walkers'
            : booking.serviceType === 'training' ? 'academy'
            : 'general') as 'petsitter' | 'walkers' | 'academy' | 'general';

          const releaseResult = await walletService.releaseBookingHold({
            userId:      booking.ownerId,
            amountCents: Number(booking.walletHoldCents),
            bookingId:   booking.requestId,
            divisionCode,
            ipAddress:   null,
          });
          await db.update(bookingRequests)
            .set({
              walletReleaseKey: releaseResult.txnId,
              financeState: 'released',
              updatedAt: new Date(),
            } as any)
            .where(eq(bookingRequests.requestId, booking.requestId));
          walletReleased += 1;
        } catch (walletErr: any) {
          // Non-blocking: the booking is still declined; ops sees drift in
          // wallet reconciliation reports.
          logger.warn('[AcceptTimeout] Wallet release failed (booking still declined)', {
            requestId: booking.requestId, error: walletErr?.message,
          });
        }
      }

      // Notify the owner — non-blocking.
      try {
        const { dispatchNotification } = await import('../lib/notificationDispatcher');
        await dispatchNotification({
          userId:    booking.ownerId,
          type:      'booking_request' as any,
          title:     'Provider did not respond',
          body:      `The provider did not respond to your booking request in time. We have refunded your hold so you can try a different provider.`,
          channels:  ['email', 'sms'],
          entityId:  booking.requestId,
          idempotencyKey: `accept-timeout-${booking.requestId}`,
        } as any);
      } catch (notifErr: any) {
        logger.warn('[AcceptTimeout] Owner notification failed', {
          requestId: booking.requestId, error: notifErr?.message,
        });
      }
    } catch (perBookingErr: any) {
      errors += 1;
      logger.error('[AcceptTimeout] Auto-decline failed for booking (continuing batch)', {
        requestId: booking.requestId, error: perBookingErr?.message,
      });
    }
  }

  logger.info('[AcceptTimeout] Cycle complete', { scanned, declined, walletReleased, errors });
  return { scanned, declined, walletReleased, errors };
}

/**
 * Start the periodic poller. Call once at server start.
 *
 * Design mirrors startBookingExpiryPoller (server/jobs/booking-expiry.ts):
 *   - setInterval with a sensible default
 *   - one initial run after a short delay so we don't pile work onto
 *     the boot sequence
 *   - errors inside the poll are caught + logged; the interval keeps
 *     ticking
 */
export function startAcceptTimeoutPoller(): void {
  const pollMs = getAcceptTimeoutPollMs();
  logger.info('[AcceptTimeout] Poller starting', {
    timeoutHours: getAcceptTimeoutMs() / 3600000,
    pollMs,
  });

  setInterval(() => {
    processStaleAcceptRequests().catch(err =>
      logger.error('[AcceptTimeout] Cycle threw', { error: err?.message }),
    );
  }, pollMs);

  // Initial run after 30s so we don't compete with boot.
  setTimeout(() => {
    processStaleAcceptRequests().catch(err =>
      logger.warn('[AcceptTimeout] Initial run failed', { error: err?.message }),
    );
  }, 30_000);
}
