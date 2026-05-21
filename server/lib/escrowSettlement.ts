/**
 * Pure escrow-settlement decision helpers for the booking lifecycle.
 *
 * A booking has at most ONE escrow holding (`escrow_holdings`). These pure
 * functions decide what to do with that row on the two money-bearing events,
 * so the decision is idempotent and unit-testable independent of the DB:
 *
 *   - planEscrowOnCreate   — when a deposit is received and we capture into escrow.
 *   - planEscrowOnTerminal — when the booking is cancelled or refunded.
 *
 * They exist because `escrow_holdings` has no UNIQUE(booking_id) constraint yet
 * and two code paths can create rows, so re-entry must NOT duplicate or
 * double-settle a holding (no double / missed funds).
 */

export type EscrowCreatePlan = 'insert' | 'promote' | 'skip';

/**
 * Decide how to capture a deposit into escrow given the current row status.
 *   - no row yet            → insert a fresh 'held' row
 *   - 'pending'/'pending_payment' → promote the existing row to 'held'
 *   - already held/processed → skip (idempotent re-entry; never duplicate)
 */
export function planEscrowOnCreate(currentStatus: string | null | undefined): EscrowCreatePlan {
  if (!currentStatus) return 'insert';
  const s = currentStatus.toLowerCase();
  if (s === 'held' || s === 'releasing' || s === 'released' || s === 'refunded') return 'skip';
  return 'promote';
}

export type EscrowTerminalPlan = 'refund' | 'skip';

/**
 * Decide whether a cancel/refund must settle the escrow back to the customer.
 *   - already 'released' (paid to provider) or 'refunded' → skip (idempotent)
 *   - anything else (pending/held/releasing/disputed)      → refund
 * A null/absent status means there is no holding to settle → skip.
 */
export function planEscrowOnTerminal(currentStatus: string | null | undefined): EscrowTerminalPlan {
  if (!currentStatus) return 'skip';
  const s = currentStatus.toLowerCase();
  if (s === 'released' || s === 'refunded') return 'skip';
  return 'refund';
}
