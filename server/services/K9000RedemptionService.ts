/**
 * K9000 Redemption Service — PetWash-side wallet/credit flows (Flow B)
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * PHYSICAL REALITY — K9000 TWIN STATION
 * ─────────────────────────────────────────────────────────────────────────────
 *
 *   Station (1 unit, 1 central cabinet)
 *     ├─ LEFT Bay  — own Nayax card reader + Nayax DOT QR reader + wash tub
 *     └─ RIGHT Bay — own Nayax card reader + Nayax DOT QR reader + wash tub
 *
 * The two bays are COMPLETELY INDEPENDENT.
 * Two different customers can use them simultaneously.
 * There is NO booking, NO reservation, NO time slot.
 * Logic is: real-time bay readiness → instant activation.
 *
 * DOMAIN MODEL:
 *   Station  = physical site unit (kioskMachines table)
 *   Bay      = actual usable wash side (station_bays table)
 *   Session  = per-bay wash event (bay_sessions table)
 *
 * FLOW A — Direct Terminal Sale  → POST /api/k9000/wash/start_cycle
 *   Guest pays by card/NFC at the Nayax terminal of THAT specific bay.
 *   No wallet. Bay status validated → session created → bay marked busy.
 *   k9000_wash_events: { transaction_source:"nayax", redemption_source:"nayax" }
 *
 * FLOW B — PetWash Wallet/Credit → POST /api/k9000/redeem-wash  (THIS FILE)
 *   Authenticated user scans QR on THAT specific bay's Nayax DOT reader.
 *   Server debits credit BEFORE activating.
 *   k9000_wash_events: { transaction_source:"petwash", redemption_source:<type> }
 *
 * REPORTING — redemption_source values
 *   "nayax"           → Flow A: direct card/NFC terminal payment
 *   "wash_package"    → Flow B: prepaid wash-package credit
 *   "wallet_balance"  → Flow B: cash wallet ILS deduction
 *   "gift_credit"     → Flow B: eGift balance
 *   "loyalty_benefit" → Flow B: loyalty-tier free wash
 *   "promo_coupon"    → Flow B: promotional/coupon credit
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * THIS FILE handles ONLY Flow B.  Flow A is in k9000.ts:/wash/start_cycle.
 */

import { db } from '../db';
import {
  walletAccounts,
  creditTransactions,
  k9000WashEvents,
  auditLedger,
  stationBays,
  baySessions,
} from '@shared/schema';
import { eq, and, gt, gte, sql } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { logger } from '../lib/logger';
import crypto from 'crypto';

// ── Redemption type literals ─────────────────────────────────────────────────

export type K9000RedemptionType =
  | 'wash_package'      // prepaid wash-package credit
  | 'wallet_balance'    // cash wallet (ILS) balance
  | 'gift_credit'       // eGift balance
  | 'loyalty_benefit'   // loyalty-tier free or discounted wash
  | 'promo_coupon';     // promotional/coupon credit

// Cost of one wash in agorot (ILS cents)
const WASH_PRICE_ILS_CENTS = 4900;       // ₪49.00 — update if pricing changes
const LOYALTY_BENEFIT_MIN_TIER = 'gold'; // minimum tier for a free wash benefit
const LOYALTY_WASH_COST_POINTS  = 500;  // loyalty points per wash

const VELOCITY_WINDOW_SECONDS   = 3600; // 1-hour sliding window
const VELOCITY_MAX_REDEMPTIONS  = 3;    // max redemptions per user per hour

const SESSION_TIMEOUT_SECONDS   = 900;  // 15 min default — IoT must confirm start

// ── Public interface ─────────────────────────────────────────────────────────

export interface RedemptionInput {
  userId: string;              // verified from signed token — DO NOT TRUST from body
  redemptionType: K9000RedemptionType;
  kioskId: string;             // station kioskId (maps to stationBays.stationId)
  side: 'left' | 'right';     // REQUIRED — which physical bay the QR was scanned on
  washType?: string;           // wash program name
  correlationId: string;       // for tracing across log entries
}

export interface RedemptionResult {
  washId: string;
  sessionId: string;           // bay_sessions.id
  bayId: string;               // station_bays.id
  side: 'left' | 'right';
  redemptionType: K9000RedemptionType;
  remainingBalance: number;    // units for package, cents for monetary types
  remainingUnit: 'washes' | 'cents';
  auditId: string;
}

// ── Main entry point ─────────────────────────────────────────────────────────

/**
 * authorizeRedemption — runs all 8 validation steps for a PetWash-side
 * K9000 redemption, debits the appropriate balance, and creates a bay session.
 *
 * Steps:
 *   1. User identity — verified upstream (signed HMAC token), userId passed in
 *   2. Wallet ownership + active status
 *   3. Balance/credit sufficiency for this redemption type
 *   4. Bay eligibility — the specific bay (stationId + side) exists and is registered
 *   5. Bay ready status — status must be "ready" (not busy/fault/maintenance/offline)
 *   6. Anti-fraud velocity check — max 3 redemptions per user per hour
 *   7. Double-redemption prevention — nonce burned upstream before calling here
 *   8. Atomic debit + session creation + bay status update + audit records
 *
 * Throws a typed Error (with .code and .httpStatus) on any failure.
 * Caller MUST NOT activate the bay if this throws.
 */
export async function authorizeRedemption(input: RedemptionInput): Promise<RedemptionResult> {
  const { userId, redemptionType, kioskId, side, correlationId } = input;
  const washType = input.washType || 'standard';

  // ── Step 2: Load wallet ────────────────────────────────────────────────────
  const [wallet] = await db
    .select()
    .from(walletAccounts)
    .where(eq(walletAccounts.userId, userId))
    .limit(1);

  if (!wallet) throw rejectWith('WALLET_NOT_FOUND', 'ארנק לא נמצא.', 404);
  if (!wallet.isActive) throw rejectWith('WALLET_SUSPENDED', 'הארנק מושהה. פנה לתמיכה.', 403);

  // ── Step 3: Balance validation ─────────────────────────────────────────────
  validateBalance(wallet, redemptionType);

  // ── Step 4: Bay lookup — stationId + side uniquely identifies the bay ──────
  const [bay] = await db
    .select()
    .from(stationBays)
    .where(and(
      eq(stationBays.stationId, kioskId),
      eq(stationBays.side, side),
    ))
    .limit(1);

  if (!bay) {
    logger.warn('[K9000Redemption] Bay not found', { kioskId, side, correlationId });
    throw rejectWith(
      'BAY_NOT_FOUND',
      `עמדת השטיפה (צד ${side === 'left' ? 'שמאל' : 'ימין'}) לא נמצאה.`,
      404,
    );
  }

  if (!bay.isActive) {
    throw rejectWith('BAY_INACTIVE', 'עמדת השטיפה אינה פעילה.', 503);
  }

  // ── Step 5: Bay ready check — the bay must not be busy or faulted ──────────
  const BLOCKED_BAY_STATUSES = ['busy', 'fault', 'maintenance', 'offline'];
  if (BLOCKED_BAY_STATUSES.includes(bay.status ?? '')) {
    const statusLabels: Record<string, string> = {
      busy:        'תפוסה — שטיפה בתהליך',
      fault:       'תקלה טכנית',
      maintenance: 'בתחזוקה',
      offline:     'לא מחוברת',
    };
    const label = statusLabels[bay.status ?? ''] ?? bay.status;
    logger.warn('[K9000Redemption] Bay not ready', { bayId: bay.id, status: bay.status, correlationId });
    throw rejectWith(
      'BAY_NOT_READY',
      `עמדת השטיפה אינה פנויה כרגע (${label}). נסה את הצד השני.`,
      503,
    );
  }

  // ── Step 6: Velocity anti-fraud check ─────────────────────────────────────
  await velocityCheck(userId, correlationId);

  // ── Step 8: Atomic debit + session creation + bay status update ──────────
  const washId   = `WASH-${Date.now()}-${nanoid(8).toUpperCase()}`;
  const result   = await debitAndLog({
    wallet,
    bay,
    redemptionType,
    userId,
    kioskId,
    washId,
    washType,
    correlationId,
  });

  logger.info('[K9000Redemption] ✅ Authorisation complete', {
    userId,
    washId,
    sessionId: result.sessionId,
    bayId: bay.id,
    side,
    redemptionType,
    kioskId,
    remaining: result.remainingBalance,
    correlationId,
  });

  return {
    washId,
    sessionId: result.sessionId,
    bayId: bay.id,
    side,
    redemptionType,
    remainingBalance: result.remainingBalance,
    remainingUnit: result.remainingUnit,
    auditId: result.auditId,
  };
}

// ── Bay session lifecycle helpers (called by Flow A route as well) ────────────

/**
 * Looks up a bay by stationId + side. Used by both flows.
 */
export async function findBay(stationId: string, side: 'left' | 'right') {
  const [bay] = await db
    .select()
    .from(stationBays)
    .where(and(eq(stationBays.stationId, stationId), eq(stationBays.side, side)))
    .limit(1);
  return bay ?? null;
}

/**
 * Creates a bay session and marks the bay as busy.
 * Used by Flow A (terminal card) after payment verification.
 */
export async function openBaySession(params: {
  bay: typeof stationBays.$inferSelect;
  source: string;
  userId?: string;
  nayaxTransactionId?: string;
  nayaxTerminalId?: string;
  washProgram?: string;
  amountCents?: number;
  correlationId?: string;
  washEventId?: string;
}): Promise<{ sessionId: string }> {
  const sessionId = `SESSION-${Date.now()}-${nanoid(8)}`;

  await db.transaction(async (tx) => {
    // Create the session row
    await tx.insert(baySessions).values({
      id: sessionId,
      bayId: params.bay.id,
      stationId: params.bay.stationId,
      side: params.bay.side,
      userId: params.userId ?? null,
      isAnonymous: !params.userId,
      source: params.source,
      amountCents: params.amountCents ?? 0,
      currency: 'ILS',
      nayaxTransactionId: params.nayaxTransactionId ?? null,
      nayaxTerminalId: params.nayaxTerminalId ?? null,
      washProgram: params.washProgram ?? 'standard',
      status: 'active',
      activatedAt: new Date(),
      expectedDurationSeconds: SESSION_TIMEOUT_SECONDS,
      washEventId: params.washEventId ?? null,
      correlationId: params.correlationId ?? null,
    });

    // Mark bay as busy, record current session
    await tx
      .update(stationBays)
      .set({
        status: 'busy',
        currentSessionId: sessionId,
        lastSessionAt: new Date(),
        totalSessions: sql`${stationBays.totalSessions} + 1`,
        totalRevenueCents: sql`${stationBays.totalRevenueCents} + ${params.amountCents ?? 0}`,
        updatedAt: new Date(),
      })
      .where(eq(stationBays.id, params.bay.id));
  });

  return { sessionId };
}

/**
 * Closes a bay session and resets the bay to ready.
 * Called by the IoT webhook when a wash completes, or on timeout.
 */
export async function closeBaySession(
  sessionId: string,
  outcome: 'completed' | 'timed_out' | 'aborted' | 'fault',
  actualDurationSeconds?: number,
) {
  const now = new Date();

  await db.transaction(async (tx) => {
    // Find the session
    const [session] = await tx
      .select({ bayId: baySessions.bayId, startedAt: baySessions.startedAt })
      .from(baySessions)
      .where(eq(baySessions.id, sessionId))
      .limit(1);

    if (!session) throw new Error(`Session not found: ${sessionId}`);

    const durationSecs = actualDurationSeconds ??
      Math.round((now.getTime() - (session.startedAt?.getTime() ?? now.getTime())) / 1000);

    // Close the session
    await tx
      .update(baySessions)
      .set({
        status: outcome,
        endedAt: now,
        actualDurationSeconds: durationSecs,
        updatedAt: now,
      })
      .where(eq(baySessions.id, sessionId));

    // Reset the bay back to ready
    await tx
      .update(stationBays)
      .set({
        status: 'ready',
        currentSessionId: null,
        updatedAt: now,
      })
      .where(and(
        eq(stationBays.id, session.bayId),
        eq(stationBays.currentSessionId, sessionId),
      ));
  });
}

// ── Balance validation per type ──────────────────────────────────────────────

function validateBalance(
  wallet: typeof walletAccounts.$inferSelect,
  type: K9000RedemptionType,
): void {
  switch (type) {
    case 'wash_package':
      if ((wallet.washPackageCredits ?? 0) < 1)
        throw rejectWith('INSUFFICIENT_CREDITS', 'אין שטיפות בחבילה. ניתן לרכוש באפליקציה.', 402);
      break;
    case 'wallet_balance':
      if ((wallet.cashWalletBalanceCents ?? 0) < WASH_PRICE_ILS_CENTS)
        throw rejectWith(
          'INSUFFICIENT_BALANCE',
          `יתרת ארנק לא מספיקה. נדרש לפחות ₪${(WASH_PRICE_ILS_CENTS / 100).toFixed(2)}.`,
          402,
        );
      break;
    case 'gift_credit':
      if ((wallet.egiftBalanceCents ?? 0) < WASH_PRICE_ILS_CENTS)
        throw rejectWith('INSUFFICIENT_GIFT_BALANCE', 'יתרת כרטיס מתנה לא מספיקה.', 402);
      break;
    case 'loyalty_benefit': {
      const qualifyingTiers = ['gold', 'platinum', 'diamond', 'elite', 'vip'];
      if (!qualifyingTiers.includes(wallet.loyaltyTier ?? ''))
        throw rejectWith(
          'LOYALTY_TIER_INELIGIBLE',
          `רמת הנאמנות הנוכחית אינה מזכה בשטיפה חינמית. נדרשת רמת ${LOYALTY_BENEFIT_MIN_TIER} לפחות.`,
          403,
        );
      if ((wallet.loyaltyPointsBalance ?? 0) < LOYALTY_WASH_COST_POINTS)
        throw rejectWith('INSUFFICIENT_LOYALTY_POINTS', `נדרשים לפחות ${LOYALTY_WASH_COST_POINTS} נקודות.`, 402);
      break;
    }
    case 'promo_coupon':
      if ((wallet.promoBalanceCents ?? 0) < WASH_PRICE_ILS_CENTS)
        throw rejectWith('INSUFFICIENT_PROMO_BALANCE', 'יתרת קופון/מבצע לא מספיקה.', 402);
      break;
  }
}

// ── Velocity check ───────────────────────────────────────────────────────────

async function velocityCheck(userId: string, correlationId: string): Promise<void> {
  const windowStart = new Date(Date.now() - VELOCITY_WINDOW_SECONDS * 1000);

  const [countRow] = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(creditTransactions)
    .where(and(
      eq(creditTransactions.initiatedByUserId, userId),
      eq(creditTransactions.platform, 'k9000'),
      eq(creditTransactions.transactionType, 'redeem'),
      gte(creditTransactions.createdAt, windowStart),
    ));

  const recentCount = Number(countRow?.count ?? 0);
  if (recentCount >= VELOCITY_MAX_REDEMPTIONS) {
    logger.warn('[K9000Redemption] Velocity limit hit', { userId, recentCount, correlationId });
    throw rejectWith(
      'VELOCITY_LIMIT',
      `יותר מדי ניסיונות מימוש בשעה האחרונה (${recentCount}/${VELOCITY_MAX_REDEMPTIONS}). נסה מאוחר יותר.`,
      429,
    );
  }
}

// ── Atomic debit + ledger writes ─────────────────────────────────────────────

interface DebitInput {
  wallet: typeof walletAccounts.$inferSelect;
  bay: typeof stationBays.$inferSelect;
  redemptionType: K9000RedemptionType;
  userId: string;
  kioskId: string;
  washId: string;
  washType: string;
  correlationId: string;
}

interface DebitResult {
  sessionId: string;
  remainingBalance: number;
  remainingUnit: 'washes' | 'cents';
  auditId: string;
}

async function debitAndLog(input: DebitInput): Promise<DebitResult> {
  const { wallet, bay, redemptionType, userId, kioskId, washId, washType, correlationId } = input;
  const txnId    = `TXN-${Date.now()}-${nanoid(8)}`;
  const sessionId = `SESSION-${Date.now()}-${nanoid(8)}`;
  let remainingBalance = 0;
  let remainingUnit: 'washes' | 'cents' = 'washes';

  await db.transaction(async (tx) => {
    // ── Atomic debit per type ────────────────────────────────────────────────
    switch (redemptionType) {
      case 'wash_package': {
        const [updated] = await tx
          .update(walletAccounts)
          .set({
            washPackageCredits: sql`${walletAccounts.washPackageCredits} - 1`,
            lifetimeRedeemedCents: sql`${walletAccounts.lifetimeRedeemedCents} + ${WASH_PRICE_ILS_CENTS}`,
            lastActivityAt: new Date(), updatedAt: new Date(),
          })
          .where(and(eq(walletAccounts.userId, userId), gt(walletAccounts.washPackageCredits, 0)))
          .returning({ remaining: walletAccounts.washPackageCredits });
        if (!updated) throw rejectWith('RACE_CONDITION', 'שטיפות נוצלו במקביל.', 409);
        remainingBalance = updated.remaining ?? 0;
        remainingUnit = 'washes';
        break;
      }
      case 'wallet_balance': {
        const [updated] = await tx
          .update(walletAccounts)
          .set({
            cashWalletBalanceCents: sql`${walletAccounts.cashWalletBalanceCents} - ${WASH_PRICE_ILS_CENTS}`,
            lifetimeRedeemedCents: sql`${walletAccounts.lifetimeRedeemedCents} + ${WASH_PRICE_ILS_CENTS}`,
            lastActivityAt: new Date(), updatedAt: new Date(),
          })
          .where(and(eq(walletAccounts.userId, userId), gte(walletAccounts.cashWalletBalanceCents, WASH_PRICE_ILS_CENTS)))
          .returning({ remaining: walletAccounts.cashWalletBalanceCents });
        if (!updated) throw rejectWith('RACE_CONDITION', 'יתרת ארנק נוצלה במקביל.', 409);
        remainingBalance = updated.remaining ?? 0;
        remainingUnit = 'cents';
        break;
      }
      case 'gift_credit': {
        const [updated] = await tx
          .update(walletAccounts)
          .set({
            egiftBalanceCents: sql`${walletAccounts.egiftBalanceCents} - ${WASH_PRICE_ILS_CENTS}`,
            lifetimeRedeemedCents: sql`${walletAccounts.lifetimeRedeemedCents} + ${WASH_PRICE_ILS_CENTS}`,
            lastActivityAt: new Date(), updatedAt: new Date(),
          })
          .where(and(eq(walletAccounts.userId, userId), gte(walletAccounts.egiftBalanceCents, WASH_PRICE_ILS_CENTS)))
          .returning({ remaining: walletAccounts.egiftBalanceCents });
        if (!updated) throw rejectWith('RACE_CONDITION', 'יתרת כרטיס מתנה נוצלה במקביל.', 409);
        remainingBalance = updated.remaining ?? 0;
        remainingUnit = 'cents';
        break;
      }
      case 'loyalty_benefit': {
        const [updated] = await tx
          .update(walletAccounts)
          .set({
            loyaltyPointsBalance: sql`${walletAccounts.loyaltyPointsBalance} - ${LOYALTY_WASH_COST_POINTS}`,
            lastActivityAt: new Date(), updatedAt: new Date(),
          })
          .where(and(eq(walletAccounts.userId, userId), gte(walletAccounts.loyaltyPointsBalance, LOYALTY_WASH_COST_POINTS)))
          .returning({ remaining: walletAccounts.loyaltyPointsBalance });
        if (!updated) throw rejectWith('RACE_CONDITION', 'נקודות נאמנות נוצלו במקביל.', 409);
        remainingBalance = updated.remaining ?? 0;
        remainingUnit = 'cents';
        break;
      }
      case 'promo_coupon': {
        const [updated] = await tx
          .update(walletAccounts)
          .set({
            promoBalanceCents: sql`${walletAccounts.promoBalanceCents} - ${WASH_PRICE_ILS_CENTS}`,
            lifetimeRedeemedCents: sql`${walletAccounts.lifetimeRedeemedCents} + ${WASH_PRICE_ILS_CENTS}`,
            lastActivityAt: new Date(), updatedAt: new Date(),
          })
          .where(and(eq(walletAccounts.userId, userId), gte(walletAccounts.promoBalanceCents, WASH_PRICE_ILS_CENTS)))
          .returning({ remaining: walletAccounts.promoBalanceCents });
        if (!updated) throw rejectWith('RACE_CONDITION', 'יתרת קופון נוצלה במקביל.', 409);
        remainingBalance = updated.remaining ?? 0;
        remainingUnit = 'cents';
        break;
      }
    }

    const isMonetary = redemptionType !== 'wash_package';

    // ── Credit Transactions ledger ─────────────────────────────────────────
    await tx.insert(creditTransactions).values({
      transactionId: txnId,
      walletId: wallet.walletId,
      creditType: creditTypeForRedemption(redemptionType),
      transactionType: 'redeem',
      amountCents: isMonetary ? WASH_PRICE_ILS_CENTS : null,
      amountUnits: !isMonetary ? 1 : null,
      balanceAfterCents: isMonetary ? remainingBalance : null,
      balanceAfterUnits: !isMonetary ? remainingBalance : null,
      sourceType: 'k9000_wash',
      platform: 'k9000',
      serviceType: washType,
      description: `K9000 wash — ${redemptionType} — station ${kioskId} ${bay.side} bay`,
      initiatedBy: 'user',
      initiatedByUserId: userId,
      metadata: { washId, kioskId, bayId: bay.id, side: bay.side, correlationId, redemptionType },
    });

    // ── k9000WashEvents — unified K9000 usage log ──────────────────────────
    await tx.insert(k9000WashEvents).values({
      transactionSource: 'petwash',
      redemptionSource: redemptionType,
      userId,
      stationId: kioskId,
      baySide: bay.side,
      platform: 'k9000',
      product: washType,
      amountCents: isMonetary ? WASH_PRICE_ILS_CENTS : 0,
      currency: 'ILS',
      loyaltyPointsAwarded: 0,
      loyaltyEventLogged: false,
      status: 'completed',
      idempotencyKey: `${userId}:${washId}`,
    });

    // ── bay_sessions — create session, mark bay busy ───────────────────────
    await tx.insert(baySessions).values({
      id: sessionId,
      bayId: bay.id,
      stationId: kioskId,
      side: bay.side,
      userId,
      isAnonymous: false,
      source: redemptionType,
      amountCents: isMonetary ? WASH_PRICE_ILS_CENTS : 0,
      currency: 'ILS',
      washProgram: washType,
      status: 'active',
      activatedAt: new Date(),
      expectedDurationSeconds: 900,
      correlationId,
    });

    await tx
      .update(stationBays)
      .set({
        status: 'busy',
        currentSessionId: sessionId,
        lastSessionAt: new Date(),
        totalSessions: sql`${stationBays.totalSessions} + 1`,
        totalRevenueCents: sql`${stationBays.totalRevenueCents} + ${isMonetary ? WASH_PRICE_ILS_CENTS : 0}`,
        updatedAt: new Date(),
      })
      .where(eq(stationBays.id, bay.id));
  });

  // ── Audit ledger (append-only hash-chain, outside main tx) ──────────────
  const auditId   = `audit_k9000_${Date.now()}_${nanoid(8)}`;
  const hashInput = `${auditId}:${userId}:${washId}:${redemptionType}:${bay.side}:${correlationId}`;
  const currentHash = crypto.createHash('sha256').update(hashInput).digest('hex');

  try {
    await db.insert(auditLedger).values({
      id: auditId,
      eventType: 'k9000_wallet_redemption',
      userId,
      entityType: 'wash_credit',
      entityId: washId,
      action: 'redeemed',
      currentHash,
      previousHash: null,
      previousState: { redemptionType, bayId: bay.id, side: bay.side },
      newState: { remainingBalance, washId, sessionId },
      metadata: {
        redemptionType,
        kioskId,
        bayId: bay.id,
        side: bay.side,
        sessionId,
        txnId,
        correlationId,
        redeemedAt: new Date().toISOString(),
      },
    });
  } catch (auditErr: any) {
    logger.error('[K9000Redemption] Audit ledger write failed (non-fatal)', {
      auditId, error: auditErr.message, correlationId,
    });
  }

  return { sessionId, remainingBalance, remainingUnit, auditId };
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function creditTypeForRedemption(type: K9000RedemptionType): string {
  const map: Record<K9000RedemptionType, string> = {
    wash_package:    'wash_package',
    wallet_balance:  'cash_wallet',
    gift_credit:     'egift',
    loyalty_benefit: 'loyalty_points',
    promo_coupon:    'promo_credit',
  };
  return map[type];
}

/** Creates a typed Error with an HTTP status code and a machine-readable code. */
function rejectWith(code: string, messageHe: string, httpStatus: number): Error & { code: string; httpStatus: number } {
  const err = new Error(messageHe) as Error & { code: string; httpStatus: number };
  err.code = code;
  err.httpStatus = httpStatus;
  return err;
}
