/**
 * PetWash Wallet Reconciliation Job
 *
 * Heals the commercial ↔ financial state drift that occurs when:
 *   1. A provider accepts a booking (HTTP 200 returned)
 *   2. The server crashes before the setImmediate debitFromWalletHold completes
 *   3. Result: booking.status = 'accepted', booking.finance_state = 'hold_active'
 *
 * The job is FULLY IDEMPOTENT:
 *   - debitBookingFromHold uses a deterministic key `wallet:booking:debit:{bookingId}`
 *   - If the debit already completed, WalletLedger returns the cached result (idempotent: true)
 *   - Running this job 10× produces the same outcome as running it once
 *
 * Scheduled: runs at server startup + every 5 minutes via cron.
 * Safe to call manually from the admin proof-pass endpoint.
 */

import cron from 'node-cron';
import { db } from '../db';
import { sql } from 'drizzle-orm';
import { eq } from 'drizzle-orm';
import { bookingRequests } from '@shared/schema';
import { walletService } from '../services/WalletService';
import { resetVelocity } from '../services/WalletLedger';
import { logger } from '../lib/logger';

const LABEL = '[WalletReconciliation]';

export interface ReconciliationOutcome {
  bookingId:  string;
  ownerId:    string;
  holdCents:  number;
  result:     'debited' | 'already_idempotent' | 'error';
  txnId?:     string;
  error?:     string;
  durationMs: number;
}

export interface ReconciliationReport {
  runAt:      string;
  drifted:    number;
  healed:     number;
  idempotent: number;
  failed:     number;
  outcomes:   ReconciliationOutcome[];
}

function divisionCodeFor(serviceType: string | null | undefined): string {
  switch (serviceType) {
    case 'sitting':  return 'petsitter';
    case 'walking':  return 'walkers';
    case 'training': return 'academy';
    case 'pettrek':  return 'pettrek';
    default:         return 'general';
  }
}

/**
 * Run one reconciliation pass. Returns structured report.
 * Logs every outcome. Safe to await or fire-and-forget.
 */
export async function runWalletReconciliation(): Promise<ReconciliationReport> {
  const runAt = new Date().toISOString();
  const outcomes: ReconciliationOutcome[] = [];

  // ── 1. Find all drifted bookings ─────────────────────────────────────────
  let drifted: any[];
  try {
    const rows: any = await db.execute(sql`
      SELECT request_id, owner_id, service_type, wallet_hold_cents
      FROM booking_requests
      WHERE status        = 'accepted'
        AND finance_state = 'hold_active'
        AND wallet_hold_cents > 0
    `);
    drifted = rows?.rows ?? rows ?? [];
  } catch (err: any) {
    logger.error(`${LABEL} Query failed`, { error: err.message });
    return { runAt, drifted: 0, healed: 0, idempotent: 0, failed: 0, outcomes: [] };
  }

  if (drifted.length === 0) {
    logger.info(`${LABEL} Clean — no drifted bookings found`);
    return { runAt, drifted: 0, healed: 0, idempotent: 0, failed: 0, outcomes: [] };
  }

  logger.warn(`${LABEL} ${drifted.length} drifted booking(s) detected`, {
    bookingIds: drifted.map((b: any) => b.request_id),
  });

  // ── 2. Replay debit for each drifted booking ──────────────────────────────
  for (const booking of drifted) {
    const bookingId   = String(booking.request_id);
    const ownerId     = String(booking.owner_id);
    const holdCents   = Number(booking.wallet_hold_cents);
    const divisionCode = divisionCodeFor(String(booking.service_type ?? ''));
    const t0 = Date.now();

    try {
      // Reset velocity so the crash-recovery bypass does not trip the rate limiter.
      // Idempotency key prevents any double-charge even without the velocity guard.
      resetVelocity(ownerId);

      const result = await walletService.debitBookingFromHold({
        userId:      ownerId,
        amountCents: holdCents,
        bookingId,
        divisionCode,
        ipAddress:   null,
      });

      // Update booking finance state
      await db
        .update(bookingRequests)
        .set({
          walletDebitedCents: holdCents,
          walletDebitKey:     result.txnId,
          financeState:       'debited',
          updatedAt:          new Date(),
        })
        .where(eq(bookingRequests.requestId, bookingId));

      const outcome: ReconciliationOutcome = {
        bookingId,
        ownerId,
        holdCents,
        result:     result.idempotent ? 'already_idempotent' : 'debited',
        txnId:      result.txnId,
        durationMs: Date.now() - t0,
      };
      outcomes.push(outcome);
      logger.info(`${LABEL} Healed booking`, outcome);

    } catch (err: any) {
      const outcome: ReconciliationOutcome = {
        bookingId,
        ownerId,
        holdCents,
        result:     'error',
        error:      err.message,
        durationMs: Date.now() - t0,
      };
      outcomes.push(outcome);
      logger.error(`${LABEL} Failed to heal booking`, outcome);
    }
  }

  const healed     = outcomes.filter(o => o.result === 'debited').length;
  const idempotent = outcomes.filter(o => o.result === 'already_idempotent').length;
  const failed     = outcomes.filter(o => o.result === 'error').length;

  logger.info(`${LABEL} Pass complete`, {
    total: drifted.length, healed, idempotent, failed,
  });

  return { runAt, drifted: drifted.length, healed, idempotent, failed, outcomes };
}

/**
 * Start the reconciliation scheduler:
 *   - Immediate run at server startup (deferred 10 s to let DB pool stabilise)
 *   - Cron run every 5 minutes thereafter
 */
export function startWalletReconciliationJob(): void {
  // Startup run — deferred 10 s to avoid racing with pool initialisation
  setTimeout(() => {
    runWalletReconciliation().catch((err: any) =>
      logger.error(`${LABEL} Startup run failed`, { error: err.message }),
    );
  }, 10_000);

  // Recurring every 5 minutes (*/5 * * * *)
  cron.schedule('*/5 * * * *', () => {
    runWalletReconciliation().catch((err: any) =>
      logger.error(`${LABEL} Cron run failed`, { error: err.message }),
    );
  });

  logger.info(`${LABEL} Scheduler started — startup run in 10 s, then every 5 min`);
}
