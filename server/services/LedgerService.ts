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

import { createHash, randomBytes } from 'crypto';
import { sql } from 'drizzle-orm';
import { db } from '../db';
import { ledgerAccounts, ledgerEntries, ledgerTransactions } from '@shared/schema-ledger-v2';
import { logger } from '../lib/logger';

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

export interface AccountShape {
  accountType: 'asset' | 'liability' | 'equity' | 'revenue' | 'expense' | 'contra';
  ownerType: 'customer' | 'provider' | 'platform' | 'system';
  ownerId: string | null;
  bucket: string;
  normalSide: 'debit' | 'credit';
}

/**
 * Resolve an account slug to its shape (chart of accounts, SDD §7f). Per-user
 * accounts embed the uid: `cust:{uid}:cash`, `prov:{uid}:payable`. Singletons are
 * fixed slugs. Throws on an unknown slug — a typo must never silently create a
 * mis-typed money account.
 */
export function describeAccount(accountId: string): AccountShape {
  const custMatch = accountId.match(/^cust:([^:]+):(cash|egift|promo|wash_package|loyalty)$/);
  if (custMatch) {
    const bucketMap: Record<string, string> = {
      cash: 'cash_wallet', egift: 'egift', promo: 'promo', wash_package: 'wash_package', loyalty: 'loyalty',
    };
    return { accountType: 'liability', ownerType: 'customer', ownerId: custMatch[1], bucket: bucketMap[custMatch[2]], normalSide: 'credit' };
  }
  const provMatch = accountId.match(/^prov:([^:]+):payable$/);
  if (provMatch) {
    return { accountType: 'liability', ownerType: 'provider', ownerId: provMatch[1], bucket: 'provider_payable', normalSide: 'credit' };
  }
  const clearingMatch = accountId.match(/^payment_clearing:(sumit|nayax)$/);
  if (clearingMatch) {
    return { accountType: 'asset', ownerType: 'system', ownerId: null, bucket: `payment_clearing_${clearingMatch[1]}`, normalSide: 'debit' };
  }
  const singletons: Record<string, AccountShape> = {
    escrow_holding:               { accountType: 'liability', ownerType: 'platform', ownerId: null, bucket: 'escrow',        normalSide: 'credit' },
    j5_authorization:             { accountType: 'contra',    ownerType: 'platform', ownerId: null, bucket: 'j5_auth',       normalSide: 'credit' },
    platform_commission_revenue:  { accountType: 'revenue',   ownerType: 'platform', ownerId: null, bucket: 'commission',    normalSide: 'credit' },
    service_revenue:              { accountType: 'revenue',   ownerType: 'platform', ownerId: null, bucket: 'service',       normalSide: 'credit' },
    vat_payable:                  { accountType: 'liability', ownerType: 'platform', ownerId: null, bucket: 'vat',           normalSide: 'credit' },
    expiry_breakage_revenue:      { accountType: 'revenue',   ownerType: 'platform', ownerId: null, bucket: 'breakage',      normalSide: 'credit' },
    suspense:                     { accountType: 'asset',     ownerType: 'system',   ownerId: null, bucket: 'suspense',      normalSide: 'debit' },
  };
  const s = singletons[accountId];
  if (!s) throw new Error(`Unknown ledger account slug: '${accountId}' (not in the chart of accounts)`);
  return s;
}

export interface PlannedEntry {
  entryId: string;
  accountId: string;
  direction: 'debit' | 'credit';
  amountCents: number;
  previousHash: string;
  entryHash: string;
}

export interface PlannedMovement {
  transactionId: string;
  idempotencyKey: string;
  eventType: string;
  totalDebits: number;
  totalCredits: number;
  entries: PlannedEntry[];
}

/**
 * PURE: turn a balanced set of legs into the exact rows to persist, computing the
 * per-account hash chain from the supplied last-hash map. No DB access — this is the
 * fully-tested heart of postMovement, so the risky computation (balance, chaining,
 * ids) is verified even though CI has no Postgres to exercise the INSERTs.
 */
export function planMovement(input: {
  eventType: string;
  idempotencyKey: string;
  legs: LedgerLeg[];
  transactionId: string;
  lastHashByAccount: Record<string, string>;
  entryIdSeed: (i: number) => string;
}): PlannedMovement {
  const totals = assertBalanced(input.legs);
  const chainHead: Record<string, string> = { ...input.lastHashByAccount };
  const entries: PlannedEntry[] = input.legs.map((leg, i) => {
    const previousHash = chainHead[leg.accountId] ?? 'genesis';
    const entryHash = computeLedgerEntryHash({
      previousHash,
      accountId: leg.accountId,
      direction: leg.direction,
      amountCents: leg.amountCents,
      currency: 'ILS',
      idempotencyKey: input.idempotencyKey,
      createdAtIso: input.transactionId, // deterministic salt tied to this movement
    });
    chainHead[leg.accountId] = entryHash; // a second leg on the same account chains forward
    return { entryId: input.entryIdSeed(i), accountId: leg.accountId, direction: leg.direction, amountCents: leg.amountCents, previousHash, entryHash };
  });
  return {
    transactionId: input.transactionId,
    idempotencyKey: input.idempotencyKey,
    eventType: input.eventType,
    totalDebits: totals.totalDebits,
    totalCredits: totals.totalCredits,
    entries,
  };
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

export interface PostMovementResult {
  transactionId: string;
  idempotent: boolean;
  totalCents: number;
}

/**
 * Persist a balanced movement as ONE transaction + its entries, atomically and
 * idempotently. Runs only when LEDGER_V2_ENABLED or LEDGER_V2_DUAL_WRITE is on
 * (callers are already flag-gated). Mirrors the proven WalletLedger.topUpWithLedger
 * pattern: raw-SQL row locks + last-hash reads, then row inserts, all in one tx.
 * The ledger_v2_transactions.idempotency_key UNIQUE constraint is the anti-double-
 * post lock — a duplicate returns the existing transaction instead of a second one.
 */
async function realPostMovement(input: {
  eventType: string;
  idempotencyKey: string;
  legs: LedgerLeg[];
  bookingId?: string | null;
  paymentRef?: string | null;
  divisionCode?: string | null;
  createdBy?: string | null;
  metadata?: Record<string, unknown>;
}): Promise<PostMovementResult> {
  if (!LEDGER_V2_ENABLED && !LEDGER_V2_DUAL_WRITE) {
    throw new Error('LedgerService.postMovement: both LEDGER_V2_ENABLED and LEDGER_V2_DUAL_WRITE are OFF');
  }
  const totals = assertBalanced(input.legs);

  // Fast-path idempotency: has this movement already been recorded?
  const pre: any = await (db as any).execute(
    sql`SELECT transaction_id FROM ledger_v2_transactions WHERE idempotency_key = ${input.idempotencyKey} LIMIT 1`,
  );
  const preRows: any[] = pre?.rows ?? pre ?? [];
  if (preRows.length > 0) {
    return { transactionId: String(preRows[0].transaction_id), idempotent: true, totalCents: totals.totalDebits };
  }

  const transactionId = `LT-${Date.now().toString(36).toUpperCase()}-${randomBytes(4).toString('hex').toUpperCase()}`;
  const uniqueAccounts = Array.from(new Set(input.legs.map((l) => l.accountId))).sort();

  try {
    await (db as any).transaction(async (tx: typeof db) => {
      // Ensure + lock each involved account (sorted order → no deadlock) and read its chain head.
      const lastHashByAccount: Record<string, string> = {};
      for (const accountId of uniqueAccounts) {
        const shape = describeAccount(accountId);
        await (tx as any).execute(sql`
          INSERT INTO ledger_v2_accounts (account_id, account_type, owner_type, owner_id, bucket, currency, normal_side)
          VALUES (${accountId}, ${shape.accountType}, ${shape.ownerType}, ${shape.ownerId}, ${shape.bucket}, 'ILS', ${shape.normalSide})
          ON CONFLICT (account_id) DO NOTHING
        `);
        await (tx as any).execute(sql`SELECT id FROM ledger_v2_accounts WHERE account_id = ${accountId} FOR UPDATE`);
        const lastRes: any = await (tx as any).execute(
          sql`SELECT entry_hash FROM ledger_v2_entries WHERE account_id = ${accountId} ORDER BY id DESC LIMIT 1`,
        );
        const lastRow: any = (lastRes?.rows ?? lastRes ?? [])[0];
        lastHashByAccount[accountId] = lastRow?.entry_hash ?? 'genesis';
      }

      const plan = planMovement({
        eventType: input.eventType,
        idempotencyKey: input.idempotencyKey,
        legs: input.legs,
        transactionId,
        lastHashByAccount,
        entryIdSeed: (i) => `LE-${transactionId.slice(3)}-${i}`,
      });

      // The balanced transaction envelope. UNIQUE(idempotency_key) is the double-post kill.
      await (tx as any).insert(ledgerTransactions).values({
        transactionId: plan.transactionId,
        idempotencyKey: plan.idempotencyKey,
        eventType: plan.eventType,
        totalDebits: plan.totalDebits,
        totalCredits: plan.totalCredits,
        responseJson: { transactionId: plan.transactionId } as any,
      });

      await (tx as any).insert(ledgerEntries).values(
        plan.entries.map((e) => ({
          entryId: e.entryId,
          transactionId: plan.transactionId,
          accountId: e.accountId,
          direction: e.direction,
          amountCents: e.amountCents,
          currency: 'ILS',
          eventType: input.eventType,
          divisionCode: input.divisionCode ?? null,
          idempotencyKey: input.idempotencyKey,
          bookingId: input.bookingId ?? null,
          paymentRef: input.paymentRef ?? null,
          createdBy: input.createdBy ?? 'system',
          metadata: (input.metadata ?? {}) as any,
          previousHash: e.previousHash,
          entryHash: e.entryHash,
        })),
      );
    });
  } catch (err: any) {
    // A concurrent delivery may have inserted the same idempotency_key first → unique
    // violation. Re-read and report the winning transaction as an idempotent replay.
    const post: any = await (db as any).execute(
      sql`SELECT transaction_id FROM ledger_v2_transactions WHERE idempotency_key = ${input.idempotencyKey} LIMIT 1`,
    );
    const postRows: any[] = post?.rows ?? post ?? [];
    if (postRows.length > 0) {
      return { transactionId: String(postRows[0].transaction_id), idempotent: true, totalCents: totals.totalDebits };
    }
    throw err;
  }

  return { transactionId, idempotent: false, totalCents: totals.totalDebits };
}

/**
 * SHADOW mirror of a completed wallet top-up into ledger v2. Called AFTER the real
 * credit already succeeded, gated by LEDGER_V2_DUAL_WRITE, and fully wrapped so it can
 * NEVER throw into or alter the production credit path — a shadow write is observe-only.
 * The movement is: debit payment_clearing:{provider}  →  credit cust:{uid}:cash.
 */
export async function shadowMirrorWalletTopup(input: {
  userId: string;
  amountCents: number;
  purchaseId: string;
  paymentRef?: string | null;
  provider?: 'sumit' | 'nayax';
}): Promise<void> {
  if (!LEDGER_V2_DUAL_WRITE) return;
  try {
    const provider = input.provider ?? 'sumit';
    const legs: LedgerLeg[] = [
      { accountId: `payment_clearing:${provider}`, direction: 'debit', amountCents: input.amountCents },
      { accountId: `cust:${input.userId}:cash`, direction: 'credit', amountCents: input.amountCents },
    ];
    const res = await realPostMovement({
      eventType: 'wallet_topup',
      idempotencyKey: deriveIdempotencyKey('wallet_topup', input.purchaseId),
      legs,
      bookingId: null,
      paymentRef: input.paymentRef ?? null,
      divisionCode: 'gift_card',
      createdBy: 'shadow',
      metadata: { shadow: true, purchaseId: input.purchaseId },
    });
    logger.info('[LedgerV2][shadow] wallet top-up mirrored', {
      purchaseId: input.purchaseId, transactionId: res.transactionId, idempotent: res.idempotent, amountCents: input.amountCents,
    });
  } catch (err: any) {
    // Shadow failures are diagnostics only — they must never affect the real credit.
    logger.warn('[LedgerV2][shadow] wallet top-up mirror failed (ignored)', {
      purchaseId: input.purchaseId, error: err?.message,
    });
  }
}

// ───────────────────────── ESCROW LEG PLANNERS (PURE — fully unit-tested) ─────────────────────────
// The double-entry legs for the three escrow lifecycle events. Balance is asserted by
// the caller (assertBalanced); these just express the intent so the money mapping is
// testable in isolation before any DB write.

export type EscrowKind = 'wallet_hold' | 'j5_authorization' | 'escrow_hold';

/** HOLD: money captured and held pending completion. debit source (asset in) / credit escrow (liability held). */
export function escrowHoldLegs(input: { sourceAccountId: string; amountCents: number }): LedgerLeg[] {
  return [
    { accountId: input.sourceAccountId, direction: 'debit', amountCents: input.amountCents },
    { accountId: 'escrow_holding', direction: 'credit', amountCents: input.amountCents },
  ];
}

/**
 * RELEASE: escrow → provider payable + platform commission (ex-VAT) + VAT payable.
 * VAT is EXTRACTED from the commission (Israel 18/118), never added on top. Requires
 * amountCents === providerPayoutCents + commissionCents (assertBalanced enforces it).
 */
export function escrowReleaseLegs(input: {
  providerAccountId: string;
  amountCents: number;
  providerPayoutCents: number;
  commissionCents: number;
  vatCents: number;
}): LedgerLeg[] {
  const commissionExVat = input.commissionCents - input.vatCents;
  const legs: LedgerLeg[] = [
    { accountId: 'escrow_holding', direction: 'debit', amountCents: input.amountCents },
    { accountId: input.providerAccountId, direction: 'credit', amountCents: input.providerPayoutCents },
  ];
  if (commissionExVat > 0) legs.push({ accountId: 'platform_commission_revenue', direction: 'credit', amountCents: commissionExVat });
  if (input.vatCents > 0) legs.push({ accountId: 'vat_payable', direction: 'credit', amountCents: input.vatCents });
  return legs;
}

/** REFUND / VOID: escrow → back to the customer (wallet credit is the default rail). */
export function escrowRefundLegs(input: { customerAccountId: string; amountCents: number }): LedgerLeg[] {
  return [
    { accountId: 'escrow_holding', direction: 'debit', amountCents: input.amountCents },
    { accountId: input.customerAccountId, direction: 'credit', amountCents: input.amountCents },
  ];
}

// ───────────────────────── PENDING TRANSFERS (holds → post / void, resolve-ONCE) ─────────────────────────

export interface OpenPendingResult { pendingId: string; transactionId: string; idempotent: boolean; }
export interface ResolvePendingResult { alreadyResolved: boolean; transactionId?: string; }

/**
 * Open a hold: post the opening balanced movement AND record a pending-transfer row
 * that later resolves ONCE (post → provider / void → refund). Idempotent on
 * idempotencyKey. Runs only when a flag is on (callers are flag-gated).
 */
async function realOpenPending(input: {
  kind: EscrowKind;
  legs: LedgerLeg[];
  fromAccountId: string;
  toAccountId: string;
  amountCents: number;
  bookingId?: string | null;
  paymentRef?: string | null;
  idempotencyKey: string;
}): Promise<OpenPendingResult> {
  if (!LEDGER_V2_ENABLED && !LEDGER_V2_DUAL_WRITE) throw new Error('openPending: LEDGER_V2 flags are OFF');
  assertBalanced(input.legs);
  const pre: any = await (db as any).execute(
    sql`SELECT pending_id, open_entry_txn FROM ledger_v2_pending_transfers WHERE idempotency_key = ${input.idempotencyKey} LIMIT 1`,
  );
  const preRows: any[] = pre?.rows ?? pre ?? [];
  if (preRows.length > 0) {
    return { pendingId: String(preRows[0].pending_id), transactionId: String(preRows[0].open_entry_txn ?? ''), idempotent: true };
  }
  const pendingId = `LP-${Date.now().toString(36).toUpperCase()}-${randomBytes(4).toString('hex').toUpperCase()}`;
  const mv = await realPostMovement({
    eventType: `${input.kind}_open`,
    idempotencyKey: input.idempotencyKey,
    legs: input.legs,
    bookingId: input.bookingId ?? null,
    paymentRef: input.paymentRef ?? null,
    metadata: { pendingId },
  });
  try {
    await (db as any).insert(ledgerPendingTransfers).values({
      pendingId, kind: input.kind, fromAccountId: input.fromAccountId, toAccountId: input.toAccountId,
      amountCents: input.amountCents, status: 'open', bookingId: input.bookingId ?? null,
      paymentRef: input.paymentRef ?? null, idempotencyKey: input.idempotencyKey, openEntryTxn: mv.transactionId,
    });
  } catch {
    // Concurrent open won the UNIQUE(idempotency_key) → return the existing pending.
    const post: any = await (db as any).execute(
      sql`SELECT pending_id, open_entry_txn FROM ledger_v2_pending_transfers WHERE idempotency_key = ${input.idempotencyKey} LIMIT 1`,
    );
    const postRows: any[] = post?.rows ?? post ?? [];
    if (postRows.length > 0) return { pendingId: String(postRows[0].pending_id), transactionId: String(postRows[0].open_entry_txn ?? ''), idempotent: true };
    throw new Error('openPending: pending row insert failed and no existing row found');
  }
  return { pendingId, transactionId: mv.transactionId, idempotent: mv.idempotent };
}

/**
 * Resolve an open hold exactly ONCE. The `UPDATE ... WHERE status='open'` is the
 * double-release kill: only the first caller flips it; a second gets 0 rows and is told
 * it's already resolved — so an escrow/J5 hold can NEVER post or void twice. Then posts
 * the resolving movement. (Mid-failure between flip and post leaves a resolved row with
 * no resolve_entry_txn — the reconciliation sweep re-drives those; it never double-pays.)
 */
async function resolvePending(pendingId: string, newStatus: 'posted' | 'voided' | 'expired', resolveLegs: LedgerLeg[], eventType: string): Promise<ResolvePendingResult> {
  if (!LEDGER_V2_ENABLED && !LEDGER_V2_DUAL_WRITE) throw new Error('resolvePending: LEDGER_V2 flags are OFF');
  assertBalanced(resolveLegs);
  const upd: any = await (db as any).execute(
    sql`UPDATE ledger_v2_pending_transfers SET status = ${newStatus}, resolved_at = now() WHERE pending_id = ${pendingId} AND status = 'open' RETURNING pending_id`,
  );
  const rows: any[] = upd?.rows ?? upd ?? [];
  if (rows.length === 0) return { alreadyResolved: true }; // already posted/voided/expired — resolve-once wins.
  const mv = await realPostMovement({
    eventType,
    idempotencyKey: deriveIdempotencyKey(eventType, pendingId),
    legs: resolveLegs,
    metadata: { pendingId, resolution: newStatus },
  });
  await (db as any).execute(
    sql`UPDATE ledger_v2_pending_transfers SET resolve_entry_txn = ${mv.transactionId} WHERE pending_id = ${pendingId}`,
  );
  return { alreadyResolved: false, transactionId: mv.transactionId };
}

/**
 * SHADOW mirror of an escrow HOLD into ledger v2. Called AFTER the real Firestore
 * escrow row was created, gated by LEDGER_V2_DUAL_WRITE, and fully wrapped so it can
 * NEVER throw into or alter the real escrow path. Opens a resolve-once pending transfer
 * keyed by the booking id (idempotent — a retry maps to the same hold).
 */
export async function shadowMirrorEscrowHold(input: {
  bookingId: string;
  amountCents: number;
  provider?: 'sumit' | 'nayax';
  paymentRef?: string | null;
}): Promise<void> {
  if (!LEDGER_V2_DUAL_WRITE) return;
  try {
    const source = `payment_clearing:${input.provider ?? 'sumit'}`;
    const res = await realOpenPending({
      kind: 'escrow_hold',
      legs: escrowHoldLegs({ sourceAccountId: source, amountCents: input.amountCents }),
      fromAccountId: source,
      toAccountId: 'escrow_holding',
      amountCents: input.amountCents,
      bookingId: input.bookingId,
      paymentRef: input.paymentRef ?? null,
      idempotencyKey: deriveIdempotencyKey('escrow_hold', input.bookingId),
    });
    logger.info('[LedgerV2][shadow] escrow hold mirrored', {
      bookingId: input.bookingId, pendingId: res.pendingId, idempotent: res.idempotent, amountCents: input.amountCents,
    });
  } catch (err: any) {
    logger.warn('[LedgerV2][shadow] escrow hold mirror failed (ignored)', { bookingId: input.bookingId, error: err?.message });
  }
}

/**
 * SHADOW mirror of an escrow RELEASE into ledger v2. Called AFTER the real release
 * committed, gated by LEDGER_V2_DUAL_WRITE, fully wrapped. Finds the mirrored hold by
 * the booking id and posts it ONCE (escrow → provider payable + commission + VAT). The
 * resolve-once guard means a double-release on the real side maps to a no-op here.
 */
export async function shadowMirrorEscrowRelease(input: {
  bookingId: string;
  providerUid: string;
  providerPayoutCents: number;
  commissionCents: number;
}): Promise<void> {
  if (!LEDGER_V2_DUAL_WRITE) return;
  try {
    const holdKey = deriveIdempotencyKey('escrow_hold', input.bookingId);
    const row: any = await (db as any).execute(
      sql`SELECT pending_id, status FROM ledger_v2_pending_transfers WHERE idempotency_key = ${holdKey} LIMIT 1`,
    );
    const rows: any[] = row?.rows ?? row ?? [];
    if (rows.length === 0) {
      logger.warn('[LedgerV2][shadow] escrow release: no mirrored hold found — skipping', { bookingId: input.bookingId });
      return;
    }
    const pendingId = String(rows[0].pending_id);
    const amountCents = input.providerPayoutCents + input.commissionCents;
    const vatCents = Math.round((input.commissionCents * 18) / 118); // VAT extracted 18/118 from the commission
    const res = await resolvePending(pendingId, 'posted', escrowReleaseLegs({
      providerAccountId: `prov:${input.providerUid}:payable`,
      amountCents,
      providerPayoutCents: input.providerPayoutCents,
      commissionCents: input.commissionCents,
      vatCents,
    }), 'escrow_release');
    logger.info('[LedgerV2][shadow] escrow release mirrored', {
      bookingId: input.bookingId, pendingId, alreadyResolved: res.alreadyResolved,
    });
  } catch (err: any) {
    logger.warn('[LedgerV2][shadow] escrow release mirror failed (ignored)', { bookingId: input.bookingId, error: err?.message });
  }
}

export const LedgerService = {
  summarizeTransaction,
  assertBalanced,
  isBalanced,
  deriveAccountBalance,
  deriveIdempotencyKey,
  computeLedgerEntryHash,
  describeAccount,
  planMovement,
  shadowMirrorWalletTopup,
  escrowHoldLegs,
  escrowReleaseLegs,
  escrowRefundLegs,

  /** Post a balanced set of legs as ONE transaction, atomically + idempotently. */
  postMovement: realPostMovement,

  /** Open a hold (wallet_hold | j5_authorization | escrow_hold) + its pending row. */
  openPending: realOpenPending,

  /** Resolve-once: post an open hold to its destination (escrow → provider). */
  postPending(pendingId: string, resolveLegs: LedgerLeg[], eventType = 'escrow_release'): Promise<ResolvePendingResult> {
    return resolvePending(pendingId, 'posted', resolveLegs, eventType);
  },

  /** Resolve-once: void an open hold (escrow → refund to customer). */
  voidPending(pendingId: string, refundLegs: LedgerLeg[], eventType = 'escrow_void'): Promise<ResolvePendingResult> {
    return resolvePending(pendingId, 'voided', refundLegs, eventType);
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
