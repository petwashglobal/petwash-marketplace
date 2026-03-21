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
import { nanoid } from 'nanoid';
import { db } from '../db';
import { sql } from 'drizzle-orm';
import { eq } from 'drizzle-orm';
import { bookingRequests, trainerBookings, walletReconciliationRuns } from '@shared/schema';
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
 * Persists every run to wallet_reconciliation_runs for history + audit.
 * Safe to await or fire-and-forget.
 */
export async function runWalletReconciliation(
  triggeredBy: string = 'cron',
): Promise<ReconciliationReport> {
  const t0 = Date.now();
  const runId = `rec-${nanoid(12)}`;
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

  if (drifted.length > 0) {
    logger.warn(`${LABEL} ${drifted.length} drifted booking(s) detected`, {
      bookingIds: drifted.map((b: any) => b.request_id),
    });
  }

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

  // ── 3. Also reconcile Academy (trainer_bookings) confirmed + hold_active ─────
  let academyDrifted: any[];
  try {
    const rows: any = await db.execute(sql`
      SELECT booking_id, user_id, wallet_hold_cents
      FROM trainer_bookings
      WHERE booking_status = 'confirmed'
        AND finance_state   = 'hold_active'
        AND wallet_hold_cents > 0
    `);
    academyDrifted = rows?.rows ?? rows ?? [];
  } catch (err: any) {
    logger.error(`${LABEL} Academy query failed`, { error: err.message });
    academyDrifted = [];
  }

  if (academyDrifted.length > 0) {
    logger.warn(`${LABEL} ${academyDrifted.length} drifted Academy booking(s) detected`, {
      bookingIds: academyDrifted.map((b: any) => b.booking_id),
    });

    for (const booking of academyDrifted) {
      const bookingId  = String(booking.booking_id);
      const ownerId    = String(booking.user_id);
      const holdCents  = Number(booking.wallet_hold_cents);
      const t0 = Date.now();

      try {
        resetVelocity(ownerId);

        const result = await walletService.debitBookingFromHold({
          userId:      ownerId,
          amountCents: holdCents,
          bookingId,
          divisionCode: 'academy',
          ipAddress:   null,
        });

        await db
          .update(trainerBookings)
          .set({
            walletDebitedCents: holdCents,
            walletDebitKey:     result.txnId,
            financeState:       'debited',
            updatedAt:          new Date(),
          })
          .where(eq(trainerBookings.bookingId, bookingId));

        const outcome: ReconciliationOutcome = {
          bookingId, ownerId, holdCents,
          result:     result.idempotent ? 'already_idempotent' : 'debited',
          txnId:      result.txnId,
          durationMs: Date.now() - t0,
        };
        outcomes.push(outcome);
        logger.info(`${LABEL} Academy healed`, outcome);
      } catch (err: any) {
        const outcome: ReconciliationOutcome = {
          bookingId, ownerId, holdCents,
          result:     'error',
          error:      err.message,
          durationMs: Date.now() - t0,
        };
        outcomes.push(outcome);
        logger.error(`${LABEL} Academy heal failed`, outcome);
      }
    }
  }

  const totalDrifted = drifted.length + academyDrifted.length;
  const healed     = outcomes.filter(o => o.result === 'debited').length;
  const idempotent = outcomes.filter(o => o.result === 'already_idempotent').length;
  const failed     = outcomes.filter(o => o.result === 'error').length;
  const durationMs = Date.now() - t0;

  if (totalDrifted === 0) {
    logger.info(`${LABEL} Clean — no drifted bookings found`);
  } else {
    logger.info(`${LABEL} Pass complete`, {
      total: totalDrifted, healed, idempotent, failed,
    });
  }

  // ── 4. Stuck-hold detection — pending bookings in hold_active > 48 h ─────────
  // These are bookings where the customer paid a hold but the provider never responded.
  // They need manual review — we DO NOT auto-release (would need provider context).
  try {
    const stuckWalkSit: any = await db.execute(sql`
      SELECT request_id, owner_id, service_type, wallet_hold_cents, created_at
      FROM booking_requests
      WHERE status        = 'pending'
        AND finance_state = 'hold_active'
        AND wallet_hold_cents > 0
        AND created_at < NOW() - INTERVAL '48 hours'
    `);
    const stuckBookings = stuckWalkSit?.rows ?? stuckWalkSit ?? [];
    if (stuckBookings.length > 0) {
      logger.warn(`${LABEL} [ALERT][StuckHold] ${stuckBookings.length} walker/sitter booking(s) stuck in hold_active for > 48 h`, {
        severity: 'WARN',
        bookings: stuckBookings.map((b: any) => ({
          bookingId:   b.request_id,
          ownerId:     b.owner_id,
          serviceType: b.service_type,
          holdCents:   Number(b.wallet_hold_cents),
          createdAt:   b.created_at,
        })),
      });
    }

    const stuckAcademy: any = await db.execute(sql`
      SELECT booking_id, user_id, wallet_hold_cents, created_at
      FROM trainer_bookings
      WHERE booking_status = 'pending'
        AND finance_state   = 'hold_active'
        AND wallet_hold_cents > 0
        AND created_at < NOW() - INTERVAL '48 hours'
    `);
    const stuckAcademyBookings = stuckAcademy?.rows ?? stuckAcademy ?? [];
    if (stuckAcademyBookings.length > 0) {
      logger.warn(`${LABEL} [ALERT][StuckHold] ${stuckAcademyBookings.length} academy booking(s) stuck in hold_active for > 48 h`, {
        severity: 'WARN',
        bookings: stuckAcademyBookings.map((b: any) => ({
          bookingId: b.booking_id,
          userId:    b.user_id,
          holdCents: Number(b.wallet_hold_cents),
          createdAt: b.created_at,
        })),
      });
    }
  } catch (stuckErr: any) {
    logger.error(`${LABEL} Stuck-hold detection failed`, { error: stuckErr.message });
  }

  // ── 5. Post-run integrity alerts — negative balances + pending drift ──────────
  try {
    const negRows: any = await db.execute(sql`
      SELECT user_id, wallet_id,
             cash_wallet_balance_cents, egift_balance_cents,
             promo_balance_cents, referral_balance_cents, pending_balance_cents
      FROM wallet_accounts
      WHERE cash_wallet_balance_cents < 0
         OR egift_balance_cents       < 0
         OR promo_balance_cents       < 0
         OR referral_balance_cents    < 0
         OR pending_balance_cents     < 0
    `);
    const negBalances = negRows?.rows ?? negRows ?? [];
    if (negBalances.length > 0) {
      logger.error(`${LABEL} [ALERT][NegativeBalance] CRITICAL: ${negBalances.length} wallet(s) have negative bucket balance`, {
        severity: 'CRITICAL',
        wallets: negBalances.map((r: any) => ({
          userId:      r.user_id,
          walletId:    r.wallet_id,
          cash:        Number(r.cash_wallet_balance_cents),
          egift:       Number(r.egift_balance_cents),
          promo:       Number(r.promo_balance_cents),
          referral:    Number(r.referral_balance_cents),
          pending:     Number(r.pending_balance_cents),
        })),
      });
    }

    const driftRows: any = await db.execute(sql`
      WITH ledger_pending AS (
        SELECT user_id,
          SUM(CASE WHEN event_type = 'hold'    AND direction = 'credit' THEN amount_cents ELSE 0 END)
            - SUM(CASE WHEN event_type = 'debit'   AND direction = 'debit'  THEN amount_cents ELSE 0 END)
            - SUM(CASE WHEN event_type = 'release' AND direction = 'debit'  THEN amount_cents ELSE 0 END)
          AS ledger_pending
        FROM wallet_ledger_entries
        WHERE event_type IN ('hold','debit','release')
        GROUP BY user_id
      )
      SELECT w.user_id, w.pending_balance_cents AS wallet_pending, lp.ledger_pending,
             ABS(w.pending_balance_cents - lp.ledger_pending) AS drift_cents
      FROM wallet_accounts w
      JOIN ledger_pending lp ON lp.user_id = w.user_id
      WHERE ABS(w.pending_balance_cents - lp.ledger_pending) > 0
    `);
    const driftAccounts = driftRows?.rows ?? driftRows ?? [];
    if (driftAccounts.length > 0) {
      logger.error(`${LABEL} [ALERT][PendingDrift] ${driftAccounts.length} wallet(s) have pending_balance drift vs ledger`, {
        severity: 'HIGH',
        accounts: driftAccounts.map((r: any) => ({
          userId:        r.user_id,
          walletPending: Number(r.wallet_pending),
          ledgerPending: Number(r.ledger_pending),
          driftCents:    Number(r.drift_cents),
        })),
      });
    } else {
      logger.info(`${LABEL} Integrity checks passed — no negative balances, no pending drift`);
    }
  } catch (alertErr: any) {
    logger.error(`${LABEL} Post-run integrity check failed`, { error: alertErr.message });
  }

  const report: ReconciliationReport = {
    runAt, drifted: totalDrifted, healed, idempotent, failed, outcomes,
  };

  // Persist to wallet_reconciliation_runs (fire-and-forget — never block the run itself)
  db.insert(walletReconciliationRuns).values({
    runId,
    runType:     'reconciliation',
    status:      'completed',
    startedAt:   new Date(t0),
    completedAt: new Date(),
    durationMs,
    drifted:     totalDrifted,
    healed,
    failedCount: failed,
    triggeredBy,
    summaryJson: report as any,
  }).catch((err: any) =>
    logger.error(`${LABEL} Failed to persist run to DB`, { error: err.message }),
  );

  return report;
}

/**
 * Start the reconciliation scheduler:
 *   - Immediate run at server startup (deferred 10 s to let DB pool stabilise)
 *   - Cron run every 5 minutes thereafter
 */
export function startWalletReconciliationJob(): void {
  // Startup run — deferred 10 s to avoid racing with pool initialisation
  setTimeout(() => {
    runWalletReconciliation('startup').catch((err: any) =>
      logger.error(`${LABEL} Startup run failed`, { error: err.message }),
    );
  }, 10_000);

  // Recurring every 5 minutes (*/5 * * * *)
  cron.schedule('*/5 * * * *', () => {
    runWalletReconciliation('cron').catch((err: any) =>
      logger.error(`${LABEL} Cron run failed`, { error: err.message }),
    );
  });

  logger.info(`${LABEL} Scheduler started — startup run in 10 s, then every 5 min`);
}
