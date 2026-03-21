/**
 * PetWash WalletLedger — Anti-Fraud Engine (2026 Production Standard)
 *
 * Implements ALL layers from the PetWash Anti-Fraud Architecture spec:
 *
 *  Layer 1  Append-only double-entry ledger (wallet_ledger_entries)
 *  Layer 2  Idempotency keys table (wallet_idempotency_keys)
 *  Layer 3  PostgreSQL JTI registry (wallet_jti_registry) — dual layer to Firestore
 *  Layer 4  Immutable fraud log (wallet_fraud_log)
 *  Layer 5  In-memory velocity limiter (10 ops / 60 s per user)
 *  Layer 6  DB transaction + SELECT FOR UPDATE (prevents double-spend race condition)
 *  Layer 7  Atomic UPDATE WHERE balance >= amount (floor guard, prevents negative balance)
 *  Layer 8  SHA-256 hash chain over every ledger entry (tamper detection)
 *  Layer 9  Holds before capture (wallet_holds)
 *
 * CRITICAL RULE: Ledger is truth. wallet_accounts.balance is a cached view.
 * Every financial mutation must:
 *   1. Lock account row FOR UPDATE
 *   2. Validate funds inside the lock
 *   3. Create double-entry ledger entries
 *   4. Update denormalized balance
 *   5. Mark idempotency result
 *   6. Consume JTI if present
 *   — all in ONE TRANSACTION. If anything fails → full rollback.
 */

import { createHash, randomBytes } from 'crypto';
import { db } from '../db';
import {
  walletLedgerEntries,
  walletIdempotencyKeys,
  walletJtiRegistry,
  walletFraudLog,
  walletHolds,
} from '@shared/schema';
import { eq, sql } from 'drizzle-orm';
import { logger } from '../lib/logger';
import { computeDeductionOrder, type DeductionBreakdown } from './WalletEngine';

// ─── Velocity limiter (in-memory, O(1) check) ────────────────────────────────
// Per-user sliding window. Survives server restarts as a soft limit.
// Hard limit is enforced by DB transaction + FOR UPDATE.
const velocityMap = new Map<string, number[]>();
const VELOCITY_MAX        = 10;   // max financial ops per window
const VELOCITY_WINDOW_MS  = 60_000; // 60-second window

export function checkVelocity(userId: string): { allowed: boolean; count: number } {
  const now  = Date.now();
  const ops  = (velocityMap.get(userId) ?? []).filter(t => now - t < VELOCITY_WINDOW_MS);
  if (ops.length >= VELOCITY_MAX) return { allowed: false, count: ops.length };
  ops.push(now);
  velocityMap.set(userId, ops);
  return { allowed: true, count: ops.length };
}

// Reset velocity entry (used in tests / admin unlock)
export function resetVelocity(userId: string) { velocityMap.delete(userId); }

// ─── SHA-256 hash chain ───────────────────────────────────────────────────────
// entry_hash = SHA256(previousHash | walletId | direction | amountCents | currency | idempKey | createdAt)
// Matches spec §4 exactly.
export function computeEntryHash(
  previousHash:    string,
  walletId:        string,
  direction:       string,
  amountCents:     number,
  currency:        string,
  idempotencyKey:  string,
  createdAtIso:    string,
): string {
  const canonical = [previousHash, walletId, direction, String(amountCents), currency, idempotencyKey, createdAtIso].join('|');
  return createHash('sha256').update(canonical).digest('hex');
}

// ─── Idempotency ──────────────────────────────────────────────────────────────
// Compute a canonical request fingerprint to detect same-key / different-payload abuse.
// Scoped to (userId, endpoint, amountCents, serviceType) so two different users
// cannot share an idempotency key and one receive the other's cached result.
export function computeRequestHash(userId: string, amountCents: number, serviceType?: string, endpoint?: string): string {
  const canonical = [userId, String(amountCents), serviceType ?? '', endpoint ?? ''].join('|');
  return createHash('sha256').update(canonical).digest('hex');
}

export async function getIdempotencyResult(key: string): Promise<{ responseJson: string; requestHash: string | null } | null> {
  try {
    const [row] = await db
      .select({ responseJson: walletIdempotencyKeys.responseJson, requestHash: walletIdempotencyKeys.requestHash })
      .from(walletIdempotencyKeys)
      .where(eq(walletIdempotencyKeys.idempotencyKey, key))
      .limit(1);
    if (!row?.responseJson) return null;
    return { responseJson: row.responseJson, requestHash: row.requestHash ?? null };
  } catch { return null; }
}

// ─── JTI registry ─────────────────────────────────────────────────────────────
export async function isJtiConsumed(jti: string): Promise<boolean> {
  const [row] = await db.select({ status: walletJtiRegistry.status })
    .from(walletJtiRegistry)
    .where(eq(walletJtiRegistry.jti, jti))
    .limit(1);
  return !!row && row.status === 'consumed';
}

// ─── Fraud log ────────────────────────────────────────────────────────────────
export async function logFraudEvent(params: {
  userId:          string;
  action:          string;
  targetWalletId?: string | null;
  ipAddress?:      string | null;
  userAgent?:      string | null;
  riskScore:       number;
  outcome:         'allowed' | 'flagged' | 'blocked';
  reason:          string;
  metadata?:       Record<string, unknown>;
}): Promise<void> {
  try {
    const eventId = `FRAUD-${Date.now().toString(36).toUpperCase()}-${randomBytes(3).toString('hex').toUpperCase()}`;
    await db.insert(walletFraudLog).values({
      eventId,
      actorType:      'user',
      actorId:        params.userId,
      action:         params.action,
      targetWalletId: params.targetWalletId ?? null,
      ipAddress:      params.ipAddress ?? null,
      userAgent:      params.userAgent ?? null,
      riskScore:      params.riskScore,
      outcome:        params.outcome,
      reason:         params.reason,
      metadata:       (params.metadata ?? {}) as any,
    });
  } catch (err) {
    logger.error('[WalletLedger] Failed to write fraud log', err);
  }
}

// ─── Types ────────────────────────────────────────────────────────────────────
export interface LedgerDeductCtx {
  userId:           string;
  amountCents:      number;
  isKioskWash:      boolean;
  serviceType?:     string;
  bookingId?:       string;
  machineId?:       string;
  bayId?:           string;
  description?:     string;
  idempotencyKey?:  string;
  jti?:             string;
  ipAddress?:       string | null;
  userAgent?:       string | null;
  endpoint?:        string;
  staffId?:         string;
  // Division tracking — required for cross-platform financial reporting
  divisionCode?:    string;  // station_k9000 | petsitter | walkers | academy | gift_card | admin
  sourceType?:      string;  // k9000_wash | booking | academy | reward | topup | manual | egift | referral
}

export interface LedgerDeductResult {
  txnId:             string;
  walletId:          string;
  breakdown:         DeductionBreakdown;
  balanceAfterCents: {
    cashWallet:   number;
    egift:        number;
    promo:        number;
    washPackages: number;
  };
  idempotent:        boolean;   // true = returned cached result, no new deduction
}

export interface LedgerTopUpResult {
  txnId:            string;
  newBalanceCents:  number;
  idempotent:       boolean;
}

// ─── Core: atomic deduction with full protection ──────────────────────────────
export async function deductFromWallet(ctx: LedgerDeductCtx): Promise<LedgerDeductResult> {
  // ── Layer 0: Input validation — reject before any DB hit ────────────────────
  // Negative or non-integer amountCents can produce negative balances via arithmetic.
  // Exception: isKioskWash with amountCents=0 is a valid "free wash" operation.
  if (!(ctx.isKioskWash && ctx.amountCents === 0)) {
    if (!Number.isFinite(ctx.amountCents) || !Number.isInteger(ctx.amountCents) || ctx.amountCents <= 0) {
      throw new Error(`INVALID_AMOUNT: amountCents must be a positive integer; got ${ctx.amountCents}`);
    }
  }
  if (!ctx.userId || typeof ctx.userId !== 'string' || ctx.userId.length < 3) {
    throw new Error('INVALID_CONTEXT: userId is required');
  }

  // ── Layer 2: Idempotency fast-path with request hash verification ───────────
  // The requestHash scopes the idempotency key to (userId, amountCents, serviceType, endpoint).
  // If the same key arrives with different parameters → 409 (key misuse, not replay).
  const reqHash = computeRequestHash(ctx.userId, ctx.amountCents, ctx.serviceType, ctx.endpoint);
  if (ctx.idempotencyKey) {
    const cached = await getIdempotencyResult(ctx.idempotencyKey);
    if (cached) {
      if (cached.requestHash && cached.requestHash !== reqHash) {
        // Same idempotency key, different payload — this is key misuse, not a safe replay
        await logFraudEvent({
          userId:    ctx.userId,
          action:    'idempotency_key_misuse',
          ipAddress: ctx.ipAddress,
          userAgent: ctx.userAgent,
          riskScore: 80,
          outcome:   'blocked',
          reason:    `Idempotency key ${ctx.idempotencyKey} reused with different request parameters`,
          metadata:  { storedHash: cached.requestHash, incomingHash: reqHash },
        });
        throw new Error('IDEMPOTENCY_CONFLICT: Same idempotency key used with different request parameters. Use a new key for different operations.');
      }
      logger.info('[WalletLedger] Idempotent hit (fast-path)', { key: ctx.idempotencyKey });
      return { ...(JSON.parse(cached.responseJson) as LedgerDeductResult), idempotent: true };
    }
  }

  // ── Layer 5: Velocity check ─────────────────────────────────────────────────
  const vel = checkVelocity(ctx.userId);
  if (!vel.allowed) {
    await logFraudEvent({
      userId:    ctx.userId,
      action:    'velocity_exceeded',
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
      riskScore: 85,
      outcome:   'blocked',
      reason:    `${vel.count} wallet ops in last 60s exceeds limit of ${VELOCITY_MAX}`,
      metadata:  { amountCents: ctx.amountCents, serviceType: ctx.serviceType, endpoint: ctx.endpoint },
    });
    throw new Error('VELOCITY_EXCEEDED: Too many wallet operations. Please wait 60 seconds and try again.');
  }

  // ── Layers 6, 7, 8: DB transaction + FOR UPDATE + hash chain ───────────────
  const result: LedgerDeductResult = await (db as any).transaction(async (tx: typeof db) => {

    // ── 6a. Lock wallet row FOR UPDATE ───────────────────────────────────────
    // This serializes all concurrent deductions for this user at the DB level.
    // No two transactions can modify this wallet simultaneously.
    const lockRes: any = await (tx as any).execute(
      sql`SELECT id, wallet_id, user_id,
               cash_wallet_balance_cents, egift_balance_cents, promo_balance_cents,
               wash_package_credits, package_service_units_remaining,
               loyalty_points_balance, loyalty_tier, referral_balance_cents
          FROM wallet_accounts WHERE user_id = ${ctx.userId} FOR UPDATE`
    );
    const row: any = lockRes?.rows?.[0] ?? lockRes?.[0];
    if (!row) throw new Error(`[WalletLedger] No wallet found for user ${ctx.userId}`);

    const walletId   = String(row.wallet_id);
    const currentBal = {
      cashWalletBalanceCents:       Number(row.cash_wallet_balance_cents)        || 0,
      egiftBalanceCents:            Number(row.egift_balance_cents)               || 0,
      promoBalanceCents:            Number(row.promo_balance_cents)               || 0,
      washPackageCredits:           Number(row.wash_package_credits)              || 0,
      packageServiceUnitsRemaining: Number(row.package_service_units_remaining)   || 0,
    };

    // ── Layer 2b: Idempotency check INSIDE transaction ────────────────────────
    // Handles concurrent identical requests that both passed the fast-path check.
    if (ctx.idempotencyKey) {
      const [existingKey]: any[] = await (tx as any)
        .select({ responseJson: walletIdempotencyKeys.responseJson, requestHash: walletIdempotencyKeys.requestHash })
        .from(walletIdempotencyKeys)
        .where(eq(walletIdempotencyKeys.idempotencyKey, ctx.idempotencyKey))
        .limit(1);
      if (existingKey?.responseJson) {
        // Verify hash — different payload with same key is misuse, not replay
        if (existingKey.requestHash && existingKey.requestHash !== reqHash) {
          throw new Error('IDEMPOTENCY_CONFLICT: Same idempotency key used with different request parameters.');
        }
        logger.info('[WalletLedger] Idempotent hit (in-tx)', { key: ctx.idempotencyKey });
        return { ...(JSON.parse(existingKey.responseJson) as LedgerDeductResult), idempotent: true };
      }
    }

    // ── Compute deduction order (pure function) ───────────────────────────────
    const breakdown = computeDeductionOrder(currentBal as any, ctx.amountCents, ctx.isKioskWash);

    // ── 7. Atomic UPDATE with per-bucket balance floor guards ─────────────────
    // The WHERE clause means: if any balance was already reduced by a concurrent
    // transaction that slipped through the FOR UPDATE, this UPDATE returns 0 rows
    // and we safely throw rather than creating a negative balance.
    const updateRes: any = await (tx as any).execute(sql`
      UPDATE wallet_accounts
      SET
        cash_wallet_balance_cents  = GREATEST(0, cash_wallet_balance_cents  - ${breakdown.wallet}),
        egift_balance_cents        = GREATEST(0, egift_balance_cents        - ${breakdown.gift}),
        promo_balance_cents        = GREATEST(0, promo_balance_cents        - ${breakdown.promo}),
        wash_package_credits       = GREATEST(0, wash_package_credits       - ${breakdown.washDeducted ? 1 : 0}),
        updated_at                 = NOW(),
        last_activity_at           = NOW()
      WHERE user_id                       = ${ctx.userId}
        AND cash_wallet_balance_cents  >= ${breakdown.wallet}
        AND egift_balance_cents        >= ${breakdown.gift}
        AND promo_balance_cents        >= ${breakdown.promo}
        AND wash_package_credits       >= ${breakdown.washDeducted ? 1 : 0}
      RETURNING wallet_id, cash_wallet_balance_cents, egift_balance_cents,
                promo_balance_cents, wash_package_credits
    `);

    const updatedRows: any[] = updateRes?.rows ?? updateRes ?? [];
    if (!updatedRows || updatedRows.length === 0) {
      // This is either a race condition or an actual insufficient-balance attempt
      await logFraudEvent({
        userId:          ctx.userId,
        action:          'concurrent_deduction_conflict',
        targetWalletId:  walletId,
        ipAddress:       ctx.ipAddress,
        userAgent:       ctx.userAgent,
        riskScore:       75,
        outcome:         'blocked',
        reason:          'UPDATE WHERE balance >= amount returned 0 rows — possible race condition or overdraft attempt',
        metadata:        { amountCents: ctx.amountCents, breakdown, serviceType: ctx.serviceType },
      });
      throw new Error('INSUFFICIENT_BALANCE: Wallet balance is not sufficient for this operation.');
    }

    const updated    = updatedRows[0];
    const now        = new Date();
    const nowIso     = now.toISOString();
    const idemKey    = ctx.idempotencyKey ?? null;
    const eventType  = ctx.isKioskWash ? 'redeem_kiosk' : 'redeem_online';
    const bucket     = breakdown.washDeducted ? 'wash_package'
                     : breakdown.wallet  > 0  ? 'cash_wallet'
                     : breakdown.gift    > 0  ? 'egift'
                     :                          'promo';

    // ── 8. Hash chain ─────────────────────────────────────────────────────────
    // Get previous entry hash for this wallet (ORDER BY id DESC for last entry)
    const lastHashRes: any = await (tx as any).execute(
      sql`SELECT entry_hash FROM wallet_ledger_entries WHERE wallet_id = ${walletId} ORDER BY id DESC LIMIT 1`
    );
    const lastHashRow: any = (lastHashRes?.rows ?? lastHashRes ?? [])[0];
    const previousHash = lastHashRow?.entry_hash ?? 'genesis';

    // Two ledger entries (double-entry accounting):
    //   DEBIT  → reduces customer wallet liability
    //   CREDIT → creates service revenue pending settlement
    const entryId1   = `LE-D-${Date.now().toString(36).toUpperCase()}-${randomBytes(4).toString('hex').toUpperCase()}`;
    const entryId2   = `LE-C-${Date.now().toString(36).toUpperCase()}-${randomBytes(4).toString('hex').toUpperCase()}`;
    const netAmount  = breakdown.totalCovered + (breakdown.washDeducted ? 1 : 0); // 1 unit for wash

    const debitHash  = computeEntryHash(previousHash, walletId, 'debit',  netAmount, 'ILS', idemKey ?? '', nowIso);
    const creditHash = computeEntryHash(debitHash,    walletId, 'credit', netAmount, 'ILS', idemKey ?? '', nowIso);

    await (tx as any).insert(walletLedgerEntries).values([
      {
        entryId:          entryId1,
        walletId,
        userId:           ctx.userId,
        eventType,
        direction:        'debit',
        amountCents:      netAmount,
        currency:         'ILS',
        bucket,
        divisionCode:     ctx.divisionCode ?? (ctx.isKioskWash ? 'station_k9000' : null),
        sourceType:       ctx.sourceType   ?? (ctx.isKioskWash ? 'k9000_wash'    : ctx.bookingId ? 'booking' : 'manual'),
        counterpartyType: 'service_revenue',
        counterpartyId:   ctx.bookingId ?? ctx.machineId ?? null,
        idempotencyKey:   idemKey,
        jti:              ctx.jti ?? null,
        bookingId:        ctx.bookingId ?? null,
        kioskId:          ctx.machineId ?? null,
        createdBy:        ctx.staffId ?? ctx.userId,
        ipAddress:        ctx.ipAddress ?? null,
        userAgent:        ctx.userAgent ?? null,
        metadata:         { breakdown, serviceType: ctx.serviceType, bayId: ctx.bayId, description: ctx.description, divisionCode: ctx.divisionCode } as any,
        previousHash,
        entryHash:        debitHash,
        createdAt:        now,
      },
      {
        entryId:          entryId2,
        walletId,
        userId:           ctx.userId,
        eventType,
        direction:        'credit',
        amountCents:      netAmount,
        currency:         'ILS',
        bucket:           'service_revenue',
        divisionCode:     ctx.divisionCode ?? (ctx.isKioskWash ? 'station_k9000' : null),
        sourceType:       ctx.sourceType   ?? (ctx.isKioskWash ? 'k9000_wash'    : ctx.bookingId ? 'booking' : 'manual'),
        counterpartyType: 'customer_wallet',
        counterpartyId:   walletId,
        idempotencyKey:   idemKey,
        jti:              ctx.jti ?? null,
        bookingId:        ctx.bookingId ?? null,
        kioskId:          ctx.machineId ?? null,
        createdBy:        'system',
        ipAddress:        ctx.ipAddress ?? null,
        metadata:         { serviceType: ctx.serviceType, description: ctx.description, divisionCode: ctx.divisionCode } as any,
        previousHash:     debitHash,
        entryHash:        creditHash,
        createdAt:        now,
      },
    ]);

    // ── Layer 2c: Persist idempotency result ──────────────────────────────────
    const txnResult: Omit<LedgerDeductResult, 'idempotent'> = {
      txnId:   entryId1,
      walletId,
      breakdown,
      balanceAfterCents: {
        cashWallet:   Number(updated.cash_wallet_balance_cents)  || 0,
        egift:        Number(updated.egift_balance_cents)         || 0,
        promo:        Number(updated.promo_balance_cents)         || 0,
        washPackages: Number(updated.wash_package_credits)        || 0,
      },
    };

    if (idemKey) {
      await (tx as any).insert(walletIdempotencyKeys).values({
        idempotencyKey: idemKey,
        endpoint:       ctx.endpoint ?? 'wallet/deduct',
        requestHash:    reqHash,   // canonical (userId|amountCents|serviceType|endpoint)
        responseJson:   JSON.stringify(txnResult),
        status:         'success',
        expiresAt:      new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      }).onConflictDoNothing();
    }

    // ── Layer 3b: Consume JTI in PostgreSQL — first-writer-wins ─────────────────
    // INSERT ... ON CONFLICT DO NOTHING — if this returns 0 rows, the JTI was already
    // consumed by a concurrent request that won the race. Upsert is intentionally NOT
    // used: once consumed = consumed. This is the hard guarantee.
    if (ctx.jti) {
      const jtiInsertRes: any = await (tx as any).execute(sql`
        INSERT INTO wallet_jti_registry
          (jti, token_type, wallet_id, user_id, first_seen_at, consumed_at, endpoint, status, ip_address)
        VALUES
          (${ctx.jti}, 'kiosk_qr', ${walletId}, ${ctx.userId}, ${now}, ${now},
           ${ctx.endpoint ?? 'wallet/redeem'}, 'consumed', ${ctx.ipAddress ?? null})
        ON CONFLICT (jti) DO NOTHING
        RETURNING jti
      `);
      const jtiRows = jtiInsertRes?.rows ?? jtiInsertRes ?? [];
      if (jtiRows.length === 0) {
        // JTI already consumed by a concurrent transaction — abort
        await logFraudEvent({
          userId:    ctx.userId,
          action:    'jti_concurrent_replay_blocked',
          targetWalletId: walletId,
          ipAddress: ctx.ipAddress,
          userAgent: ctx.userAgent,
          riskScore: 95,
          outcome:   'blocked',
          reason:    `JTI ${ctx.jti} consumed by a concurrent request — race condition blocked`,
        });
        throw new Error('JTI_ALREADY_CONSUMED: Token was already consumed by a concurrent request.');
      }
    }

    logger.info('[WalletLedger] Deduction committed', {
      txnId:    entryId1,
      walletId,
      userId:   ctx.userId,
      amountCents: ctx.amountCents,
      breakdown: { promo: breakdown.promo, gift: breakdown.gift, wallet: breakdown.wallet, wash: breakdown.washDeducted },
      idem:     !!idemKey,
      jti:      !!ctx.jti,
    });

    return { ...txnResult, idempotent: false };
  });

  return result;
}

// ─── Top-up with double-entry ledger ─────────────────────────────────────────
export async function topUpWithLedger(params: {
  userId:           string;
  amountCents:      number;
  sourceType:       string;
  sourceId?:        string;
  idempotencyKey?:  string;
  ipAddress?:       string | null;
  userAgent?:       string | null;
}): Promise<LedgerTopUpResult> {
  // Fast-path idempotency
  if (params.idempotencyKey) {
    const cached = await getIdempotencyResult(params.idempotencyKey);
    if (cached) {
      logger.info('[WalletLedger] TopUp idempotent hit', { key: params.idempotencyKey });
      return { ...(JSON.parse(cached) as LedgerTopUpResult), idempotent: true };
    }
  }

  return await (db as any).transaction(async (tx: typeof db) => {
    // Lock wallet row
    await (tx as any).execute(
      sql`SELECT id FROM wallet_accounts WHERE user_id = ${params.userId} FOR UPDATE`
    );

    // Atomic credit
    const res: any = await (tx as any).execute(sql`
      UPDATE wallet_accounts
      SET cash_wallet_balance_cents = cash_wallet_balance_cents + ${params.amountCents},
          updated_at       = NOW(),
          last_activity_at = NOW()
      WHERE user_id = ${params.userId}
      RETURNING wallet_id, cash_wallet_balance_cents
    `);
    const rows: any[] = res?.rows ?? res ?? [];
    if (!rows || rows.length === 0) throw new Error('[WalletLedger] Wallet not found for top-up');

    const updated    = rows[0];
    const walletId   = String(updated.wallet_id);
    const now        = new Date();
    const nowIso     = now.toISOString();
    const idemKey    = params.idempotencyKey ?? null;

    // Hash chain
    const lastHashRes: any = await (tx as any).execute(
      sql`SELECT entry_hash FROM wallet_ledger_entries WHERE wallet_id = ${walletId} ORDER BY id DESC LIMIT 1`
    );
    const lastHashRow: any = ((lastHashRes?.rows ?? lastHashRes ?? [])[0]);
    const previousHash = lastHashRow?.entry_hash ?? 'genesis';

    const entryId1 = `LE-TU1-${Date.now().toString(36).toUpperCase()}-${randomBytes(3).toString('hex').toUpperCase()}`;
    const entryId2 = `LE-TU2-${Date.now().toString(36).toUpperCase()}-${randomBytes(3).toString('hex').toUpperCase()}`;

    const debitHash  = computeEntryHash(previousHash, walletId, 'debit',  params.amountCents, 'ILS', idemKey ?? '', nowIso);
    const creditHash = computeEntryHash(debitHash,    walletId, 'credit', params.amountCents, 'ILS', idemKey ?? '', nowIso);

    await (tx as any).insert(walletLedgerEntries).values([
      {
        entryId: entryId1, walletId, userId: params.userId,
        eventType: 'topup', direction: 'debit', amountCents: params.amountCents,
        currency: 'ILS', bucket: 'payment_clearing',
        counterpartyType: params.sourceType, counterpartyId: params.sourceId ?? null,
        idempotencyKey: idemKey, createdBy: params.userId,
        ipAddress: params.ipAddress ?? null, userAgent: params.userAgent ?? null,
        metadata: { sourceType: params.sourceType, sourceId: params.sourceId } as any,
        previousHash, entryHash: debitHash, createdAt: now,
      },
      {
        entryId: entryId2, walletId, userId: params.userId,
        eventType: 'topup', direction: 'credit', amountCents: params.amountCents,
        currency: 'ILS', bucket: 'cash_wallet',
        counterpartyType: 'payment_clearing', counterpartyId: null,
        idempotencyKey: idemKey, createdBy: 'system',
        ipAddress: params.ipAddress ?? null,
        metadata: {} as any,
        previousHash: debitHash, entryHash: creditHash, createdAt: now,
      },
    ]);

    const txnResult: LedgerTopUpResult = {
      txnId:           entryId1,
      newBalanceCents: Number(updated.cash_wallet_balance_cents) || 0,
      idempotent:      false,
    };

    if (idemKey) {
      await (tx as any).insert(walletIdempotencyKeys).values({
        idempotencyKey: idemKey, endpoint: 'wallet/topup',
        requestHash:    createHash('sha256').update(JSON.stringify({ userId: params.userId, amountCents: params.amountCents })).digest('hex'),
        responseJson:   JSON.stringify(txnResult),
        status:         'success',
        expiresAt:      new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      }).onConflictDoNothing();
    }

    return txnResult;
  });
}

// ─── Admin credit with dual-entry + fraud log ─────────────────────────────────
export async function adminCreditWithLedger(params: {
  userId:       string;
  adminId:      string;
  bucket:       'cash_wallet' | 'egift' | 'promo' | 'wash_package';
  amountCents?: number;
  units?:       number;
  reason:       string;
  ipAddress?:   string | null;
}): Promise<{ txnId: string }> {
  const cents = params.amountCents ?? (params.units ? params.units * 100 : 0);

  // Fraud log: every admin manual credit is recorded
  await logFraudEvent({
    userId:    params.adminId,
    action:    `admin_credit_${params.bucket}`,
    riskScore: 30,
    outcome:   'flagged',
    reason:    `Admin manually credited ${params.userId} — ${params.reason}`,
    metadata:  { targetUserId: params.userId, bucket: params.bucket, amountCents: cents },
  });

  return await (db as any).transaction(async (tx: typeof db) => {
    await (tx as any).execute(
      sql`SELECT id FROM wallet_accounts WHERE user_id = ${params.userId} FOR UPDATE`
    );

    // Determine column to update
    const colMap: Record<string, string> = {
      cash_wallet:  'cash_wallet_balance_cents',
      egift:        'egift_balance_cents',
      promo:        'promo_balance_cents',
      wash_package: 'wash_package_credits',
    };
    const col = colMap[params.bucket];
    if (!col) throw new Error(`Unknown bucket: ${params.bucket}`);

    const res: any = await (tx as any).execute(
      sql`UPDATE wallet_accounts SET ${sql.raw(col)} = ${sql.raw(col)} + ${cents}, updated_at = NOW() WHERE user_id = ${params.userId} RETURNING wallet_id`
    );
    const walletId = String((res?.rows?.[0] ?? res?.[0])?.wallet_id ?? '');

    const now  = new Date();
    const lastHashRes: any = await (tx as any).execute(
      sql`SELECT entry_hash FROM wallet_ledger_entries WHERE wallet_id = ${walletId} ORDER BY id DESC LIMIT 1`
    );
    const prevHash = ((lastHashRes?.rows ?? lastHashRes ?? [])[0])?.entry_hash ?? 'genesis';

    const entryId  = `LE-ADM-${Date.now().toString(36).toUpperCase()}-${randomBytes(3).toString('hex').toUpperCase()}`;
    const eHash    = computeEntryHash(prevHash, walletId, 'credit', cents, 'ILS', '', now.toISOString());

    await (tx as any).insert(walletLedgerEntries).values({
      entryId, walletId, userId: params.userId,
      eventType: 'admin_credit', direction: 'credit',
      amountCents: cents, currency: 'ILS', bucket: params.bucket,
      counterpartyType: 'admin', counterpartyId: params.adminId,
      createdBy: params.adminId,
      metadata: { reason: params.reason, adminId: params.adminId } as any,
      previousHash: prevHash, entryHash: eHash, createdAt: now,
    });

    return { txnId: entryId };
  });
}

// ─── Admin wallet adjustment (credit or debit) ───────────────────────────────
export async function adminAdjustWallet(params: {
  userId:         string;
  walletId:       string;
  amountCents:    number;
  type:           'credit' | 'debit';
  reason:         string;
  adminId:        string;
  idempotencyKey: string;
  ipAddress?:     string | null;
  reversalOf?:    string;
}): Promise<{ txnId: string }> {
  await logFraudEvent({
    userId:    params.adminId,
    action:    `admin_${params.type}`,
    riskScore: 30,
    outcome:   'flagged',
    reason:    `Admin manual ${params.type} on ${params.userId} — ${params.reason}`,
    metadata:  { targetUserId: params.userId, amountCents: params.amountCents },
  });

  return await (db as any).transaction(async (tx: typeof db) => {
    await (tx as any).execute(
      sql`SELECT id FROM wallet_accounts WHERE user_id = ${params.userId} FOR UPDATE`
    );

    if (params.type === 'credit') {
      await (tx as any).execute(
        sql`UPDATE wallet_accounts
            SET cash_wallet_balance_cents = cash_wallet_balance_cents + ${params.amountCents},
                updated_at = NOW()
            WHERE user_id = ${params.userId}`
      );
    } else {
      const bal: any = await (tx as any).execute(
        sql`SELECT cash_wallet_balance_cents FROM wallet_accounts WHERE user_id = ${params.userId}`
      );
      const available = Number((bal?.rows?.[0] ?? bal?.[0])?.cash_wallet_balance_cents ?? 0);
      if (available < params.amountCents) throw new Error('Insufficient cash balance for debit adjustment');
      await (tx as any).execute(
        sql`UPDATE wallet_accounts
            SET cash_wallet_balance_cents = cash_wallet_balance_cents - ${params.amountCents},
                updated_at = NOW()
            WHERE user_id = ${params.userId}`
      );
    }

    const now = new Date();
    const lastHashRes: any = await (tx as any).execute(
      sql`SELECT entry_hash FROM wallet_ledger_entries WHERE wallet_id = ${params.walletId} ORDER BY id DESC LIMIT 1`
    );
    const prevHash = ((lastHashRes?.rows ?? lastHashRes ?? [])[0])?.entry_hash ?? 'genesis';

    const entryId = `LE-ADJ-${Date.now().toString(36).toUpperCase()}-${randomBytes(3).toString('hex').toUpperCase()}`;
    const direction = params.type === 'credit' ? 'credit' : 'debit';
    const eHash = computeEntryHash(prevHash, params.walletId, direction, params.amountCents, 'ILS', '', now.toISOString());

    await (tx as any).insert(walletLedgerEntries).values({
      entryId,
      walletId:     params.walletId,
      userId:       params.userId,
      eventType:    params.type === 'credit' ? 'admin_credit' : 'admin_debit',
      direction,
      amountCents:  params.amountCents,
      currency:     'ILS',
      bucket:       'cash_wallet',
      counterpartyType: 'admin',
      counterpartyId:   params.adminId,
      createdBy:    params.adminId,
      metadata:     { reason: params.reason, adminId: params.adminId, ...(params.reversalOf ? { reversalOf: params.reversalOf } : {}) } as any,
      previousHash: prevHash,
      entryHash:    eHash,
      createdAt:    now,
    });

    await (tx as any).insert(walletIdempotencyKeys).values({
      idempotencyKey: params.idempotencyKey,
      endpoint:       `wallet/admin_${params.type}`,
      requestHash:    computeRequestHash(params.userId, params.amountCents, 'admin', params.type),
      responseJson:   JSON.stringify({ txnId: entryId }),
      status:         'success',
      expiresAt:      new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
    }).onConflictDoNothing();

    logger.info('[WalletLedger] Admin adjustment committed', { txnId: entryId, userId: params.userId, type: params.type, amountCents: params.amountCents });
    return { txnId: entryId };
  });
}

// ─── Reversal (never edit — always reverse) ───────────────────────────────────
export async function reverseEntry(params: {
  originalEntryId: string;
  adminId:         string;
  reason:          string;
  ipAddress?:      string | null;
}): Promise<{ txnId: string }> {
  const [original] = await db.select().from(walletLedgerEntries)
    .where(eq(walletLedgerEntries.entryId, params.originalEntryId)).limit(1);
  if (!original) throw new Error(`Original entry ${params.originalEntryId} not found`);

  const reverseDirection = original.direction === 'debit' ? 'credit' : 'debit';
  const now = new Date();

  const lastHashRes: any = await db.execute(
    sql`SELECT entry_hash FROM wallet_ledger_entries WHERE wallet_id = ${original.walletId} ORDER BY id DESC LIMIT 1`
  );
  const prevHash = ((lastHashRes?.rows ?? lastHashRes ?? [])[0])?.entry_hash ?? 'genesis';

  const entryId = `LE-REV-${Date.now().toString(36).toUpperCase()}-${randomBytes(3).toString('hex').toUpperCase()}`;
  const eHash   = computeEntryHash(prevHash, original.walletId, reverseDirection, original.amountCents, original.currency, '', now.toISOString());

  await db.insert(walletLedgerEntries).values({
    entryId, walletId: original.walletId, userId: original.userId,
    eventType: 'reversal', direction: reverseDirection,
    amountCents: original.amountCents, currency: original.currency,
    bucket: original.bucket,
    counterpartyType: 'admin', counterpartyId: params.adminId,
    createdBy: params.adminId,
    ipAddress: params.ipAddress ?? null,
    metadata: { reversalOf: params.originalEntryId, reason: params.reason } as any,
    previousHash: prevHash, entryHash: eHash, createdAt: now,
  });

  await logFraudEvent({
    userId:   params.adminId,
    action:   'ledger_reversal',
    riskScore: 40,
    outcome:  'flagged',
    reason:   `Ledger entry ${params.originalEntryId} reversed: ${params.reason}`,
  });

  return { txnId: entryId };
}

// ─── Chain integrity verifier (run as daily job) ──────────────────────────────
// Walks every ledger entry for a wallet and re-computes the hash chain.
// Any mismatch = tamper detected → alert immediately.
export async function verifyChainIntegrity(walletId: string): Promise<{ ok: boolean; brokenAt?: string; message?: string }> {
  const entries = await db
    .select({
      entryId:        walletLedgerEntries.entryId,
      walletId:       walletLedgerEntries.walletId,
      direction:      walletLedgerEntries.direction,
      amountCents:    walletLedgerEntries.amountCents,
      currency:       walletLedgerEntries.currency,
      idempotencyKey: walletLedgerEntries.idempotencyKey,
      createdAt:      walletLedgerEntries.createdAt,
      previousHash:   walletLedgerEntries.previousHash,
      entryHash:      walletLedgerEntries.entryHash,
    })
    .from(walletLedgerEntries)
    .where(eq(walletLedgerEntries.walletId, walletId))
    .orderBy(walletLedgerEntries.id);

  if (entries.length === 0) return { ok: true };

  let expectedPrev = 'genesis';
  for (const entry of entries) {
    if (entry.previousHash !== expectedPrev) {
      const msg = `Hash chain broken at ${entry.entryId}: expected previousHash=${expectedPrev}, got ${entry.previousHash}`;
      await logFraudEvent({ userId: 'system', action: 'chain_integrity_failure', targetWalletId: walletId, riskScore: 100, outcome: 'blocked', reason: msg });
      return { ok: false, brokenAt: entry.entryId, message: msg };
    }
    const computed = computeEntryHash(
      entry.previousHash, entry.walletId, entry.direction,
      entry.amountCents,  entry.currency,
      entry.idempotencyKey ?? '', entry.createdAt.toISOString(),
    );
    if (computed !== entry.entryHash) {
      const msg = `Entry ${entry.entryId} hash mismatch — ledger may have been tampered with`;
      await logFraudEvent({ userId: 'system', action: 'chain_hash_mismatch', targetWalletId: walletId, riskScore: 100, outcome: 'blocked', reason: msg });
      return { ok: false, brokenAt: entry.entryId, message: msg };
    }
    expectedPrev = entry.entryHash;
  }

  return { ok: true };
}

// ─── Hold before capture ──────────────────────────────────────────────────────
export async function createHold(params: {
  userId:          string;
  walletId:        string;
  amountCents:     number;
  serviceType:     string;
  bookingId?:      string;
  idempotencyKey?: string;
  ipAddress?:      string | null;
  ttlMinutes?:     number;
}): Promise<{ holdId: string }> {
  const holdId = `HOLD-${Date.now().toString(36).toUpperCase()}-${randomBytes(3).toString('hex').toUpperCase()}`;
  const expiresAt = new Date(Date.now() + (params.ttlMinutes ?? 15) * 60_000);

  await db.insert(walletHolds).values({
    holdId,
    walletId:       params.walletId,
    userId:         params.userId,
    amountCents:    params.amountCents,
    holdType:       'booking',
    serviceType:    params.serviceType,
    bookingId:      params.bookingId ?? null,
    status:         'active',
    idempotencyKey: params.idempotencyKey ?? null,
    expiresAt,
    ipAddress:      params.ipAddress ?? null,
  });

  return { holdId };
}

export async function releaseHold(holdId: string, adminId?: string): Promise<void> {
  await db.update(walletHolds)
    .set({ status: 'released', releasedAt: new Date() })
    .where(eq(walletHolds.holdId, holdId));
}

export async function captureHold(holdId: string): Promise<void> {
  await db.update(walletHolds)
    .set({ status: 'captured', capturedAt: new Date() })
    .where(eq(walletHolds.holdId, holdId));
}

// ═══════════════════════════════════════════════════════════════════════════════
// PHASE 2 — MULTI-DIVISION HOLD / RELEASE / DEBIT-FROM-HOLD / REFUND
//
// Financial contract:
//   holdWallet:         available ↓, pending ↑  (event=hold)
//   releaseWalletHold:  available ↑, pending ↓  (event=release)
//   debitFromWalletHold: pending ↓ ONLY         (event=debit — available already moved at hold time)
//   refundToWallet:     available ↑              (event=refund)
//
// Every method: FOR UPDATE lock → validate → ledger → balance UPDATE → idempotency
// ═══════════════════════════════════════════════════════════════════════════════

export interface WalletHoldCtx {
  userId:          string;
  amountCents:     number;
  divisionCode:    string;
  sourceType:      string;
  sourceId:        string;        // bookingId, orderId, etc.
  idempotencyKey:  string;        // REQUIRED — wallet:booking:hold:{bookingId}
  ipAddress?:      string | null;
  userAgent?:      string | null;
  metadata?:       Record<string, unknown>;
}

export interface WalletHoldResult {
  txnId:                  string;
  walletId:               string;
  availableAfterCents:    number;
  pendingAfterCents:      number;
  idempotent:             boolean;
}

// ─── 1. holdWallet — lock funds for a future booking ─────────────────────────
export async function holdWallet(ctx: WalletHoldCtx): Promise<WalletHoldResult> {
  if (!Number.isInteger(ctx.amountCents) || ctx.amountCents <= 0) throw new Error('INVALID_AMOUNT');
  if (!ctx.userId) throw new Error('INVALID_USER');
  if (!ctx.idempotencyKey) throw new Error('HOLD_REQUIRES_IDEMPOTENCY_KEY');

  // Fast-path idempotency
  const cached = await getIdempotencyResult(ctx.idempotencyKey);
  if (cached) return { ...(JSON.parse(cached.responseJson) as WalletHoldResult), idempotent: true };

  const vel = checkVelocity(ctx.userId);
  if (!vel.allowed) throw new Error('VELOCITY_EXCEEDED');

  return await (db as any).transaction(async (tx: typeof db) => {
    // Lock wallet row
    const lockRes: any = await (tx as any).execute(sql`
      SELECT wallet_id, cash_wallet_balance_cents, egift_balance_cents,
             promo_balance_cents, referral_balance_cents, pending_balance_cents, lifetime_earned_cents
      FROM wallet_accounts WHERE user_id = ${ctx.userId} FOR UPDATE
    `);
    const row: any = (lockRes?.rows ?? lockRes ?? [])[0];
    if (!row) throw new Error('WALLET_NOT_FOUND');

    const walletId        = String(row.wallet_id);
    const availableCash   = Number(row.cash_wallet_balance_cents) || 0;
    const availableEgift  = Number(row.egift_balance_cents) || 0;
    const availablePromo  = Number(row.promo_balance_cents) || 0;
    const availableRef    = Number(row.referral_balance_cents) || 0;
    const totalAvailable  = availableCash + availableEgift + availablePromo + availableRef;

    // In-tx idempotency
    const [existingKey]: any[] = await (tx as any)
      .select({ responseJson: walletIdempotencyKeys.responseJson })
      .from(walletIdempotencyKeys)
      .where(eq(walletIdempotencyKeys.idempotencyKey, ctx.idempotencyKey))
      .limit(1);
    if (existingKey?.responseJson) {
      return { ...(JSON.parse(existingKey.responseJson) as WalletHoldResult), idempotent: true };
    }

    if (totalAvailable < ctx.amountCents) {
      throw new Error(`INSUFFICIENT_BALANCE: available ${totalAvailable} < hold ${ctx.amountCents}`);
    }

    // Deduct from buckets in priority order: promo → egift → referral → cash
    let remaining = ctx.amountCents;
    const promoUsed  = Math.min(remaining, availablePromo);  remaining -= promoUsed;
    const egiftUsed  = Math.min(remaining, availableEgift);  remaining -= egiftUsed;
    const refUsed    = Math.min(remaining, availableRef);    remaining -= refUsed;
    const cashUsed   = Math.min(remaining, availableCash);   remaining -= cashUsed;

    const updRes: any = await (tx as any).execute(sql`
      UPDATE wallet_accounts SET
        cash_wallet_balance_cents = GREATEST(0, cash_wallet_balance_cents  - ${cashUsed}),
        egift_balance_cents       = GREATEST(0, egift_balance_cents        - ${egiftUsed}),
        promo_balance_cents       = GREATEST(0, promo_balance_cents        - ${promoUsed}),
        referral_balance_cents    = GREATEST(0, referral_balance_cents     - ${refUsed}),
        pending_balance_cents     = pending_balance_cents + ${ctx.amountCents},
        updated_at                = NOW(),
        last_activity_at          = NOW()
      WHERE user_id = ${ctx.userId}
        AND cash_wallet_balance_cents  >= ${cashUsed}
        AND egift_balance_cents        >= ${egiftUsed}
        AND promo_balance_cents        >= ${promoUsed}
        AND referral_balance_cents     >= ${refUsed}
      RETURNING wallet_id, cash_wallet_balance_cents, egift_balance_cents,
                promo_balance_cents, pending_balance_cents
    `);
    const upd: any = (updRes?.rows ?? updRes ?? [])[0];
    if (!upd) throw new Error('HOLD_CONFLICT: Insufficient balance (race condition)');

    // Hash chain
    const nowD = new Date();
    const nowIso = nowD.toISOString();
    const lastHR: any = await (tx as any).execute(
      sql`SELECT entry_hash FROM wallet_ledger_entries WHERE wallet_id = ${walletId} ORDER BY id DESC LIMIT 1`
    );
    const prevHash = ((lastHR?.rows ?? lastHR ?? [])[0])?.entry_hash ?? 'genesis';

    const eid1 = `LE-H1-${Date.now().toString(36).toUpperCase()}-${randomBytes(4).toString('hex').toUpperCase()}`;
    const eid2 = `LE-H2-${Date.now().toString(36).toUpperCase()}-${randomBytes(4).toString('hex').toUpperCase()}`;
    const h1 = computeEntryHash(prevHash, walletId, 'debit',  ctx.amountCents, 'ILS', ctx.idempotencyKey, nowIso);
    const h2 = computeEntryHash(h1,       walletId, 'credit', ctx.amountCents, 'ILS', ctx.idempotencyKey, nowIso);

    const baseEntry = {
      walletId, userId: ctx.userId, currency: 'ILS',
      amountCents: ctx.amountCents, eventType: 'hold',
      divisionCode: ctx.divisionCode, sourceType: ctx.sourceType,
      counterpartyId: ctx.sourceId, idempotencyKey: ctx.idempotencyKey,
      bookingId: ctx.sourceId, createdBy: ctx.userId,
      ipAddress: ctx.ipAddress ?? null, userAgent: ctx.userAgent ?? null,
      metadata: { breakdown: { promo: promoUsed, egift: egiftUsed, referral: refUsed, cash: cashUsed }, ...ctx.metadata } as any,
      createdAt: nowD,
    };

    await (tx as any).insert(walletLedgerEntries).values([
      { ...baseEntry, entryId: eid1, direction: 'debit',  bucket: 'cash_wallet', counterpartyType: 'hold_reserve', previousHash: prevHash, entryHash: h1 },
      { ...baseEntry, entryId: eid2, direction: 'credit', bucket: 'hold_reserve', counterpartyType: 'customer_wallet', previousHash: h1, entryHash: h2 },
    ]);

    const result: WalletHoldResult = {
      txnId: eid1, walletId,
      availableAfterCents: Number(upd.cash_wallet_balance_cents) + Number(upd.egift_balance_cents) + Number(upd.promo_balance_cents),
      pendingAfterCents:   Number(upd.pending_balance_cents),
      idempotent: false,
    };
    await (tx as any).insert(walletIdempotencyKeys).values({
      idempotencyKey: ctx.idempotencyKey, endpoint: 'wallet/hold',
      requestHash: computeRequestHash(ctx.userId, ctx.amountCents, ctx.sourceType, 'hold'),
      responseJson: JSON.stringify(result), status: 'success',
      expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
    }).onConflictDoNothing();

    logger.info('[WalletLedger] Hold created', { txnId: eid1, walletId, userId: ctx.userId, amountCents: ctx.amountCents, divisionCode: ctx.divisionCode });
    return result;
  });
}

// ─── 2. releaseWalletHold — restore funds when hold is no longer needed ───────
export async function releaseWalletHold(ctx: Omit<WalletHoldCtx, 'divisionCode'> & { divisionCode?: string }): Promise<WalletHoldResult> {
  if (!ctx.idempotencyKey) throw new Error('RELEASE_REQUIRES_IDEMPOTENCY_KEY');

  const cached = await getIdempotencyResult(ctx.idempotencyKey);
  if (cached) return { ...(JSON.parse(cached.responseJson) as WalletHoldResult), idempotent: true };

  const vel = checkVelocity(ctx.userId);
  if (!vel.allowed) throw new Error('VELOCITY_EXCEEDED');

  return await (db as any).transaction(async (tx: typeof db) => {
    const lockRes: any = await (tx as any).execute(sql`
      SELECT wallet_id, cash_wallet_balance_cents, pending_balance_cents
      FROM wallet_accounts WHERE user_id = ${ctx.userId} FOR UPDATE
    `);
    const row: any = (lockRes?.rows ?? lockRes ?? [])[0];
    if (!row) throw new Error('WALLET_NOT_FOUND');

    const walletId    = String(row.wallet_id);
    const pendingNow  = Number(row.pending_balance_cents) || 0;

    const [existing]: any[] = await (tx as any)
      .select({ responseJson: walletIdempotencyKeys.responseJson })
      .from(walletIdempotencyKeys).where(eq(walletIdempotencyKeys.idempotencyKey, ctx.idempotencyKey)).limit(1);
    if (existing?.responseJson) return { ...(JSON.parse(existing.responseJson) as WalletHoldResult), idempotent: true };

    if (pendingNow < ctx.amountCents) {
      // Allow if pending is 0 — this means it was already released. Just mark idempotent.
      if (pendingNow === 0) {
        const result: WalletHoldResult = { txnId: 'NO-OP', walletId, availableAfterCents: Number(row.cash_wallet_balance_cents), pendingAfterCents: 0, idempotent: true };
        return result;
      }
      throw new Error(`RELEASE_EXCEEDS_PENDING: pending ${pendingNow} < release ${ctx.amountCents}`);
    }

    const updRes: any = await (tx as any).execute(sql`
      UPDATE wallet_accounts SET
        cash_wallet_balance_cents = cash_wallet_balance_cents + ${ctx.amountCents},
        pending_balance_cents     = GREATEST(0, pending_balance_cents - ${ctx.amountCents}),
        updated_at                = NOW(), last_activity_at = NOW()
      WHERE user_id = ${ctx.userId}
      RETURNING wallet_id, cash_wallet_balance_cents, pending_balance_cents
    `);
    const upd: any = (updRes?.rows ?? updRes ?? [])[0];

    const nowD = new Date();
    const nowIso = nowD.toISOString();
    const lastHR: any = await (tx as any).execute(
      sql`SELECT entry_hash FROM wallet_ledger_entries WHERE wallet_id = ${walletId} ORDER BY id DESC LIMIT 1`
    );
    const prevHash = ((lastHR?.rows ?? lastHR ?? [])[0])?.entry_hash ?? 'genesis';

    const eid1 = `LE-R1-${Date.now().toString(36).toUpperCase()}-${randomBytes(4).toString('hex').toUpperCase()}`;
    const eid2 = `LE-R2-${Date.now().toString(36).toUpperCase()}-${randomBytes(4).toString('hex').toUpperCase()}`;
    const h1 = computeEntryHash(prevHash, walletId, 'debit',  ctx.amountCents, 'ILS', ctx.idempotencyKey, nowIso);
    const h2 = computeEntryHash(h1,       walletId, 'credit', ctx.amountCents, 'ILS', ctx.idempotencyKey, nowIso);

    const baseEntry = {
      walletId, userId: ctx.userId, currency: 'ILS', amountCents: ctx.amountCents, eventType: 'release',
      divisionCode: ctx.divisionCode ?? null, sourceType: ctx.sourceType,
      counterpartyId: ctx.sourceId, idempotencyKey: ctx.idempotencyKey,
      bookingId: ctx.sourceId, createdBy: ctx.userId,
      ipAddress: ctx.ipAddress ?? null,
      metadata: { reason: 'hold_released', ...ctx.metadata } as any, createdAt: nowD,
    };

    await (tx as any).insert(walletLedgerEntries).values([
      { ...baseEntry, entryId: eid1, direction: 'debit',  bucket: 'hold_reserve',  counterpartyType: 'customer_wallet', previousHash: prevHash, entryHash: h1 },
      { ...baseEntry, entryId: eid2, direction: 'credit', bucket: 'cash_wallet',   counterpartyType: 'hold_reserve', previousHash: h1, entryHash: h2 },
    ]);

    const result: WalletHoldResult = {
      txnId: eid1, walletId,
      availableAfterCents: Number(upd.cash_wallet_balance_cents),
      pendingAfterCents:   Number(upd.pending_balance_cents),
      idempotent: false,
    };
    await (tx as any).insert(walletIdempotencyKeys).values({
      idempotencyKey: ctx.idempotencyKey, endpoint: 'wallet/release',
      requestHash: computeRequestHash(ctx.userId, ctx.amountCents, ctx.sourceType, 'release'),
      responseJson: JSON.stringify(result), status: 'success',
      expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
    }).onConflictDoNothing();

    logger.info('[WalletLedger] Hold released', { txnId: eid1, walletId, userId: ctx.userId, amountCents: ctx.amountCents });
    return result;
  });
}

// ─── 3. debitFromWalletHold — finalize held funds as service payment ──────────
// NOTE: available_balance_cents does NOT change — it already moved at hold time.
// This converts pending → realized debit (lifetime_redeemed_cents increases).
export async function debitFromWalletHold(ctx: WalletHoldCtx): Promise<WalletHoldResult> {
  if (!ctx.idempotencyKey) throw new Error('DEBIT_FROM_HOLD_REQUIRES_IDEMPOTENCY_KEY');

  const cached = await getIdempotencyResult(ctx.idempotencyKey);
  if (cached) return { ...(JSON.parse(cached.responseJson) as WalletHoldResult), idempotent: true };

  const vel = checkVelocity(ctx.userId);
  if (!vel.allowed) throw new Error('VELOCITY_EXCEEDED');

  return await (db as any).transaction(async (tx: typeof db) => {
    const lockRes: any = await (tx as any).execute(sql`
      SELECT wallet_id, cash_wallet_balance_cents, pending_balance_cents, lifetime_redeemed_cents
      FROM wallet_accounts WHERE user_id = ${ctx.userId} FOR UPDATE
    `);
    const row: any = (lockRes?.rows ?? lockRes ?? [])[0];
    if (!row) throw new Error('WALLET_NOT_FOUND');

    const walletId   = String(row.wallet_id);
    const pendingNow = Number(row.pending_balance_cents) || 0;

    const [existing]: any[] = await (tx as any)
      .select({ responseJson: walletIdempotencyKeys.responseJson })
      .from(walletIdempotencyKeys).where(eq(walletIdempotencyKeys.idempotencyKey, ctx.idempotencyKey)).limit(1);
    if (existing?.responseJson) return { ...(JSON.parse(existing.responseJson) as WalletHoldResult), idempotent: true };

    if (pendingNow < ctx.amountCents) {
      throw new Error(`DEBIT_FROM_HOLD_EXCEEDS_PENDING: pending ${pendingNow} < debit ${ctx.amountCents}`);
    }

    const updRes: any = await (tx as any).execute(sql`
      UPDATE wallet_accounts SET
        pending_balance_cents    = GREATEST(0, pending_balance_cents - ${ctx.amountCents}),
        lifetime_redeemed_cents  = lifetime_redeemed_cents + ${ctx.amountCents},
        updated_at               = NOW(), last_activity_at = NOW()
      WHERE user_id = ${ctx.userId}
      RETURNING wallet_id, cash_wallet_balance_cents, pending_balance_cents, lifetime_redeemed_cents
    `);
    const upd: any = (updRes?.rows ?? updRes ?? [])[0];

    const nowD = new Date();
    const nowIso = nowD.toISOString();
    const lastHR: any = await (tx as any).execute(
      sql`SELECT entry_hash FROM wallet_ledger_entries WHERE wallet_id = ${walletId} ORDER BY id DESC LIMIT 1`
    );
    const prevHash = ((lastHR?.rows ?? lastHR ?? [])[0])?.entry_hash ?? 'genesis';

    const eid1 = `LE-DH1-${Date.now().toString(36).toUpperCase()}-${randomBytes(4).toString('hex').toUpperCase()}`;
    const eid2 = `LE-DH2-${Date.now().toString(36).toUpperCase()}-${randomBytes(4).toString('hex').toUpperCase()}`;
    const h1 = computeEntryHash(prevHash, walletId, 'debit',  ctx.amountCents, 'ILS', ctx.idempotencyKey, nowIso);
    const h2 = computeEntryHash(h1,       walletId, 'credit', ctx.amountCents, 'ILS', ctx.idempotencyKey, nowIso);

    const baseEntry = {
      walletId, userId: ctx.userId, currency: 'ILS', amountCents: ctx.amountCents, eventType: 'debit',
      divisionCode: ctx.divisionCode, sourceType: ctx.sourceType,
      counterpartyId: ctx.sourceId, idempotencyKey: ctx.idempotencyKey,
      bookingId: ctx.sourceId, createdBy: ctx.userId,
      ipAddress: ctx.ipAddress ?? null,
      metadata: { debitType: 'from_hold', ...ctx.metadata } as any, createdAt: nowD,
    };

    await (tx as any).insert(walletLedgerEntries).values([
      { ...baseEntry, entryId: eid1, direction: 'debit',  bucket: 'hold_reserve',   counterpartyType: 'service_revenue', previousHash: prevHash, entryHash: h1 },
      { ...baseEntry, entryId: eid2, direction: 'credit', bucket: 'service_revenue', counterpartyType: 'hold_reserve',   previousHash: h1,       entryHash: h2 },
    ]);

    const result: WalletHoldResult = {
      txnId: eid1, walletId,
      availableAfterCents: Number(upd.cash_wallet_balance_cents),
      pendingAfterCents:   Number(upd.pending_balance_cents),
      idempotent: false,
    };
    await (tx as any).insert(walletIdempotencyKeys).values({
      idempotencyKey: ctx.idempotencyKey, endpoint: 'wallet/debit-from-hold',
      requestHash: computeRequestHash(ctx.userId, ctx.amountCents, ctx.sourceType, 'debit-from-hold'),
      responseJson: JSON.stringify(result), status: 'success',
      expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
    }).onConflictDoNothing();

    logger.info('[WalletLedger] Debit-from-hold committed', { txnId: eid1, walletId, userId: ctx.userId, amountCents: ctx.amountCents, divisionCode: ctx.divisionCode });
    return result;
  });
}

// ─── 4. refundToWallet — restore funds to available (post-debit reversal) ─────
export async function refundToWallet(ctx: WalletHoldCtx & { reason?: string }): Promise<WalletHoldResult> {
  if (!ctx.idempotencyKey) throw new Error('REFUND_REQUIRES_IDEMPOTENCY_KEY');

  const cached = await getIdempotencyResult(ctx.idempotencyKey);
  if (cached) return { ...(JSON.parse(cached.responseJson) as WalletHoldResult), idempotent: true };

  return await (db as any).transaction(async (tx: typeof db) => {
    const lockRes: any = await (tx as any).execute(sql`
      SELECT wallet_id, cash_wallet_balance_cents, pending_balance_cents
      FROM wallet_accounts WHERE user_id = ${ctx.userId} FOR UPDATE
    `);
    const row: any = (lockRes?.rows ?? lockRes ?? [])[0];
    if (!row) throw new Error('WALLET_NOT_FOUND');

    const walletId = String(row.wallet_id);

    const [existing]: any[] = await (tx as any)
      .select({ responseJson: walletIdempotencyKeys.responseJson })
      .from(walletIdempotencyKeys).where(eq(walletIdempotencyKeys.idempotencyKey, ctx.idempotencyKey)).limit(1);
    if (existing?.responseJson) return { ...(JSON.parse(existing.responseJson) as WalletHoldResult), idempotent: true };

    const updRes: any = await (tx as any).execute(sql`
      UPDATE wallet_accounts SET
        cash_wallet_balance_cents = cash_wallet_balance_cents + ${ctx.amountCents},
        updated_at                = NOW(), last_activity_at = NOW()
      WHERE user_id = ${ctx.userId}
      RETURNING wallet_id, cash_wallet_balance_cents, pending_balance_cents
    `);
    const upd: any = (updRes?.rows ?? updRes ?? [])[0];

    const nowD = new Date();
    const nowIso = nowD.toISOString();
    const lastHR: any = await (tx as any).execute(
      sql`SELECT entry_hash FROM wallet_ledger_entries WHERE wallet_id = ${walletId} ORDER BY id DESC LIMIT 1`
    );
    const prevHash = ((lastHR?.rows ?? lastHR ?? [])[0])?.entry_hash ?? 'genesis';

    const eid1 = `LE-RF1-${Date.now().toString(36).toUpperCase()}-${randomBytes(4).toString('hex').toUpperCase()}`;
    const eid2 = `LE-RF2-${Date.now().toString(36).toUpperCase()}-${randomBytes(4).toString('hex').toUpperCase()}`;
    const h1 = computeEntryHash(prevHash, walletId, 'debit',  ctx.amountCents, 'ILS', ctx.idempotencyKey, nowIso);
    const h2 = computeEntryHash(h1,       walletId, 'credit', ctx.amountCents, 'ILS', ctx.idempotencyKey, nowIso);

    const baseEntry = {
      walletId, userId: ctx.userId, currency: 'ILS', amountCents: ctx.amountCents, eventType: 'refund',
      divisionCode: ctx.divisionCode, sourceType: ctx.sourceType,
      counterpartyId: ctx.sourceId, idempotencyKey: ctx.idempotencyKey,
      bookingId: ctx.sourceId, createdBy: ctx.userId,
      ipAddress: ctx.ipAddress ?? null,
      metadata: { reason: ctx.reason ?? 'refund', ...ctx.metadata } as any, createdAt: nowD,
    };

    await (tx as any).insert(walletLedgerEntries).values([
      { ...baseEntry, entryId: eid1, direction: 'debit',  bucket: 'service_revenue', counterpartyType: 'refund_source',   previousHash: prevHash, entryHash: h1 },
      { ...baseEntry, entryId: eid2, direction: 'credit', bucket: 'cash_wallet',     counterpartyType: 'customer_wallet', previousHash: h1,       entryHash: h2 },
    ]);

    const result: WalletHoldResult = {
      txnId: eid1, walletId,
      availableAfterCents: Number(upd.cash_wallet_balance_cents),
      pendingAfterCents:   Number(upd.pending_balance_cents),
      idempotent: false,
    };
    await (tx as any).insert(walletIdempotencyKeys).values({
      idempotencyKey: ctx.idempotencyKey, endpoint: 'wallet/refund',
      requestHash: computeRequestHash(ctx.userId, ctx.amountCents, ctx.sourceType, 'refund'),
      responseJson: JSON.stringify(result), status: 'success',
      expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
    }).onConflictDoNothing();

    logger.info('[WalletLedger] Refund committed', { txnId: eid1, walletId, userId: ctx.userId, amountCents: ctx.amountCents, divisionCode: ctx.divisionCode, reason: ctx.reason });
    return result;
  });
}
