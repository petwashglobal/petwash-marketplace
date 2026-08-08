/**
 * LedgerService — unified append-only, double-entry money ledger (v2).
 *
 * Foundation for docs/design/2026-08-08-unified-append-only-ledger.md. This PR is
 * DARK: the pure double-entry core below is fully tested (server/tests/
 * ledgerDoubleEntryInvariant.test.ts), but NO production caller writes to the
 * ledger yet — every DB-writing method is gated behind LEDGER_V2_ENABLED (default
 * OFF) and throws until a later, deliberately-staged PR wires it in.
 *
 * The pure functions are the value in this slice: they encode the invariants that
 * kill whole bug classes —
 *   • assertBalanced  → a movement cannot exist unless SUM(debit)==SUM(credit)  (self-mint)
 *   • deriveIdempotencyKey → keys come from booking/payment IDs, never random    (double-pay)
 *   • deriveAccountBalance → balance is COMPUTED from entries, never a stored col (drift/race)
 *   • computeLedgerEntryHash → per-account hash chain                             (tampering)
 */

import { createHash } from 'crypto';

/** One leg of a double-entry movement. Amount is always POSITIVE; the sign is the direction. */
export interface LedgerLeg {
  accountId: string;
  direction: 'debit' | 'credit';
  amountCents: number;
  eventType?: string;
  bookingId?: string;
  paymentRef?: string;
  metadata?: Record<string, unknown>;
}

export interface TransactionTotals {
  totalDebits: number;
  totalCredits: number;
}

export class LedgerImbalanceError extends Error {
  constructor(public totals: TransactionTotals) {
    super(`Ledger movement is not balanced: debits=${totals.totalDebits} credits=${totals.totalCredits}`);
    this.name = 'LedgerImbalanceError';
  }
}

/** Feature flags — ALL default OFF. See SDD §16. */
export const LEDGER_V2_ENABLED = process.env.LEDGER_V2_ENABLED === 'true';
export const LEDGER_V2_DUAL_WRITE = process.env.LEDGER_V2_DUAL_WRITE === 'true';
export const LEDGER_V2_READ_DERIVED = process.env.LEDGER_V2_READ_DERIVED === 'true';

// ───────────────────────── PURE CORE (no DB — fully unit-tested) ─────────────────────────

/** Sum the legs into debit/credit totals. */
export function summarizeTransaction(legs: LedgerLeg[]): TransactionTotals {
  let totalDebits = 0;
  let totalCredits = 0;
  for (const leg of legs) {
    if (!Number.isInteger(leg.amountCents) || leg.amountCents <= 0) {
      throw new Error(`Ledger leg amount must be a positive integer (got ${leg.amountCents} on ${leg.accountId})`);
    }
    if (leg.direction === 'debit') totalDebits += leg.amountCents;
    else if (leg.direction === 'credit') totalCredits += leg.amountCents;
    else throw new Error(`Ledger leg direction must be debit|credit (got ${(leg as { direction: string }).direction})`);
  }
  return { totalDebits, totalCredits };
}

/**
 * THE invariant. A balanced movement has >=2 legs and equal debits/credits.
 * Throws LedgerImbalanceError otherwise — the structural kill for self-mint.
 */
export function assertBalanced(legs: LedgerLeg[]): TransactionTotals {
  if (legs.length < 2) {
    throw new Error(`Double-entry movement needs at least 2 legs (got ${legs.length})`);
  }
  const totals = summarizeTransaction(legs);
  if (totals.totalDebits !== totals.totalCredits) {
    throw new LedgerImbalanceError(totals);
  }
  return totals;
}

/** True iff the movement balances (never throws — for assertions/filters). */
export function isBalanced(legs: LedgerLeg[]): boolean {
  try {
    assertBalanced(legs);
    return true;
  } catch {
    return false;
  }
}

/**
 * Derive an account's balance from its entry stream — NEVER a stored column.
 * Liability/revenue/equity accounts are credit-normal (balance = credits - debits);
 * asset/expense accounts are debit-normal (balance = debits - credits).
 */
export function deriveAccountBalance(
  legs: LedgerLeg[],
  accountId: string,
  normalSide: 'debit' | 'credit',
): number {
  let debits = 0;
  let credits = 0;
  for (const leg of legs) {
    if (leg.accountId !== accountId) continue;
    if (leg.direction === 'debit') debits += leg.amountCents;
    else credits += leg.amountCents;
  }
  return normalSide === 'credit' ? credits - debits : debits - credits;
}

/**
 * Idempotency keys are DERIVED from stable business IDs — never random — so a
 * retried booking/payment maps to the SAME key and the UNIQUE constraint on
 * ledger_transactions rejects the duplicate. This is the anti-double-pay lock.
 */
export function deriveIdempotencyKey(eventType: string, ...ids: Array<string | number | null | undefined>): string {
  const parts = ids.filter((v) => v !== null && v !== undefined && v !== '').map(String);
  if (parts.length === 0) {
    throw new Error(`deriveIdempotencyKey(${eventType}) requires at least one business id — refusing a random key`);
  }
  return `${eventType}:${parts.join(':')}`;
}

/**
 * Per-account hash chain (reuses the wallet-ledger convention):
 * entry_hash = SHA256(previousHash | accountId | direction | amountCents | currency | idempKey | createdAtIso)
 */
export function computeLedgerEntryHash(input: {
  previousHash: string;
  accountId: string;
  direction: string;
  amountCents: number;
  currency: string;
  idempotencyKey: string;
  createdAtIso: string;
}): string {
  const canonical = [
    input.previousHash,
    input.accountId,
    input.direction,
    String(input.amountCents),
    input.currency,
    input.idempotencyKey,
    input.createdAtIso,
  ].join('|');
  return createHash('sha256').update(canonical).digest('hex');
}

// ───────────────────────── DARK DB SKELETON (flag-gated, no callers yet) ─────────────────────────
// Every method below is intentionally unwired. They document the surface the staged
// rollout (SDD §11) will fill: postMovement / openPending / postPending / voidPending /
// reverse / deriveBalance. Until LEDGER_V2_ENABLED they throw, so an accidental early
// caller fails loudly rather than silently half-writing money.

function ensureEnabled(method: string): void {
  if (!LEDGER_V2_ENABLED) {
    throw new Error(`LedgerService.${method} is dark (LEDGER_V2_ENABLED is OFF) — not wired until the staged rollout`);
  }
}

export const LedgerService = {
  summarizeTransaction,
  assertBalanced,
  isBalanced,
  deriveAccountBalance,
  deriveIdempotencyKey,
  computeLedgerEntryHash,

  /** Post a balanced set of legs as ONE transaction. DARK — see SDD §6a/§9. */
  async postMovement(_input: { eventType: string; idempotencyKey: string; legs: LedgerLeg[] }): Promise<never> {
    assertBalanced(_input.legs); // validate even in dark mode so tests of the core still pass
    ensureEnabled('postMovement');
    throw new Error('unreachable');
  },

  /** Open a hold (wallet_hold | j5_authorization | escrow_hold). DARK. */
  async openPending(_input: unknown): Promise<never> {
    ensureEnabled('openPending');
    throw new Error('unreachable');
  },

  /** Resolve-once: post an open hold to its destination. DARK. */
  async postPending(_pendingId: string): Promise<never> {
    ensureEnabled('postPending');
    throw new Error('unreachable');
  },

  /** Resolve-once: void an open hold. DARK. */
  async voidPending(_pendingId: string): Promise<never> {
    ensureEnabled('voidPending');
    throw new Error('unreachable');
  },

  /** Reverse a prior transaction with new reversing entries (never UPDATE/DELETE). DARK. */
  async reverse(_transactionId: string): Promise<never> {
    ensureEnabled('reverse');
    throw new Error('unreachable');
  },

  /** Derive an account's live balance from entries (optionally via the cache). DARK. */
  async deriveBalance(_accountId: string): Promise<never> {
    ensureEnabled('deriveBalance');
    throw new Error('unreachable');
  },
};

export default LedgerService;
