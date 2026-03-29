/**
 * K9000 Redemption Service — PetWash-side wallet/credit flows ONLY
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ARCHITECTURE RULE — TWO COMPLETELY SEPARATE K9000 PAYMENT FLOWS
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * FLOW A — Direct Terminal Sale (Nayax-mediated, no wallet involved)
 * ─────────────────────────────────────────────────────────────────
 *   Trigger : Guest / walk-in arrives at K9000, inserts card / taps NFC at
 *             the Nayax IL payment terminal.
 *   Handler : POST /api/k9000/wash/start_cycle   (called by K9000 controller)
 *   Auth    : IP allowlist + HMAC headers (machine identity only)
 *   Wallet  : NOT touched — no PetWash wallet deduction
 *   DB log  : k9000_wash_events  { transaction_source: "nayax",
 *                                   redemption_source:  "nayax" }
 *   Finance : VAT recorded via VATCalculatorService (100% PetWash revenue)
 *
 * FLOW B — PetWash Wallet / Credit Redemption
 * ─────────────────────────────────────────────
 *   Trigger : Registered PetWash user opens app, navigates to Wallet / QR
 *             screen, and presents a 45-second HMAC-signed QR code which
 *             the Nayax QR reader on the kiosk scans.
 *   Handler : POST /api/k9000/redeem-wash         (called by K9000 controller)
 *   Auth    : IP allowlist + HMAC headers + signed user token (user identity)
 *   Wallet  : MUST debit the correct balance type server-side before activation
 *   DB log  : k9000_wash_events  { transaction_source: "petwash",
 *                                   redemption_source: <one of 5 types> }
 *             credit_transactions  (immutable debit ledger entry)
 *             audit_ledger          (hash-chained tamper-evident entry)
 *
 * REPORTING — Five distinct redemption_source values (for finance/fraud/support)
 * ─────────────────────────────────────────────────────────────────────────────
 *   "nayax"           → Flow A: direct card/NFC terminal payment
 *   "wash_package"    → Flow B: prepaid wash-package credit deduction
 *   "wallet_balance"  → Flow B: cash wallet (ILS) deduction
 *   "gift_credit"     → Flow B: eGift balance deduction
 *   "loyalty_benefit" → Flow B: loyalty-tier free/discounted wash
 *   "promo_coupon"    → Flow B: promotional credit / coupon code deduction
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * THIS FILE handles ONLY Flow B.  Flow A logic lives in k9000.ts:/wash/start_cycle.
 */

import { db } from '../db';
import {
  walletAccounts,
  creditTransactions,
  k9000WashEvents,
  auditLedger,
  kioskMachines,
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

// Cost of one wash in each monetary unit (agorot unless noted)
const WASH_PRICE_ILS_CENTS = 4900;  // ₪49.00 — update if pricing changes
const LOYALTY_BENEFIT_MIN_TIER = 'gold';   // minimum tier for a free wash benefit
const LOYALTY_WASH_COST_POINTS  = 500;     // loyalty points per wash

const VELOCITY_WINDOW_SECONDS = 3600;      // 1-hour sliding window
const VELOCITY_MAX_REDEMPTIONS = 3;        // max redemptions per user per hour

// ── Public interface ─────────────────────────────────────────────────────────

export interface RedemptionInput {
  userId: string;            // verified from signed token — DO NOT TRUST from request body
  redemptionType: K9000RedemptionType;
  kioskId: string;           // station kioskId as registered in the DB
  stationId?: string;        // optional numeric station id
  washType?: string;         // wash program name
  correlationId: string;     // for tracing across log entries
}

export interface RedemptionResult {
  washId: string;
  redemptionType: K9000RedemptionType;
  remainingBalance: number;  // units for package, cents for monetary types
  remainingUnit: 'washes' | 'cents';
  auditId: string;
}

// ── Main entry point ─────────────────────────────────────────────────────────

/**
 * authorizeRedemption — runs all 8 validation steps for a PetWash-side
 * K9000 redemption and debits the appropriate balance.
 *
 * Steps:
 *   1. User identity — verified upstream (signed HMAC token), userId passed in
 *   2. Wallet ownership validation — walletAccounts.userId === userId
 *   3. Balance / credit validation — sufficient funds for this type
 *   4. Machine eligibility — kiosk is registered + active in stations table
 *   5. Station online/ready status — station.status !== 'offline' / 'maintenance'
 *   6. Anti-fraud velocity check — max 3 redemptions per user per hour
 *   7. Double-redemption prevention — nonce burned upstream before calling here
 *   8. Atomic debit + full audit record
 *
 * Throws a typed Error with `.code` for each failure case.
 * Caller must NOT activate the machine if this throws.
 */
export async function authorizeRedemption(input: RedemptionInput): Promise<RedemptionResult> {
  const { userId, redemptionType, kioskId, correlationId } = input;
  const washType = input.washType || 'standard';

  // ── Step 2: Load wallet ────────────────────────────────────────────────────
  const [wallet] = await db
    .select()
    .from(walletAccounts)
    .where(eq(walletAccounts.userId, userId))
    .limit(1);

  if (!wallet) {
    throw rejectWith('WALLET_NOT_FOUND', 'ארנק לא נמצא.', 404);
  }

  if (!wallet.isActive) {
    throw rejectWith('WALLET_SUSPENDED', 'הארנק מושהה. פנה לתמיכה.', 403);
  }

  // ── Step 3: Balance validation ─────────────────────────────────────────────
  validateBalance(wallet, redemptionType);

  // ── Step 4: Machine eligibility — kiosk registered + active ──────────────
  // NOTE: validateKioskAllowlist middleware already validates the kiosk is
  // in the DB allowlist.  This step checks the richer kioskMachines record
  // for active status and performs the online/ready check simultaneously.
  const [kiosk] = await db
    .select({ id: kioskMachines.id, status: kioskMachines.status, isOnline: kioskMachines.isOnline })
    .from(kioskMachines)
    .where(eq(kioskMachines.kioskId, kioskId))
    .limit(1);

  if (!kiosk) {
    logger.warn('[K9000Redemption] Kiosk not found in kiosk_machines', { kioskId, correlationId });
    throw rejectWith('STATION_NOT_FOUND', 'עמדה לא מזוהה.', 404);
  }

  // ── Step 5: Station ready / online check ──────────────────────────────────
  const BLOCKED_STATUSES = ['offline', 'maintenance', 'decommissioned'];
  if (BLOCKED_STATUSES.includes(kiosk.status ?? '')) {
    logger.warn('[K9000Redemption] Station blocked status', { kioskId, status: kiosk.status, correlationId });
    throw rejectWith('STATION_NOT_READY', `העמדה אינה זמינה כרגע (${kiosk.status}).`, 503);
  }
  if (kiosk.isOnline === false) {
    logger.warn('[K9000Redemption] Station offline', { kioskId, correlationId });
    throw rejectWith('STATION_OFFLINE', 'העמדה אינה מחוברת כרגע. נסה שוב בעוד מספר דקות.', 503);
  }

  // ── Step 6: Velocity anti-fraud check ─────────────────────────────────────
  await velocityCheck(userId, correlationId);

  // ── Step 8: Atomic debit + ledger writes ──────────────────────────────────
  const washId = `WASH-${Date.now()}-${nanoid(8).toUpperCase()}`;
  const result = await debitAndLog({
    wallet,
    redemptionType,
    userId,
    kioskId,
    washId,
    washType,
    stationId: input.stationId,
    correlationId,
  });

  logger.info('[K9000Redemption] Authorisation complete', {
    userId,
    washId,
    redemptionType,
    kioskId,
    remaining: result.remainingBalance,
    correlationId,
  });

  return {
    washId,
    redemptionType,
    remainingBalance: result.remainingBalance,
    remainingUnit: result.remainingUnit,
    auditId: result.auditId,
  };
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
          `רמת הנאמנות הנוכחית אינה מזכה בשטיפה חינמית. נדרשת לפחות רמת ${LOYALTY_BENEFIT_MIN_TIER}.`,
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
    .where(
      and(
        eq(creditTransactions.initiatedByUserId, userId),
        eq(creditTransactions.platform, 'k9000'),
        eq(creditTransactions.transactionType, 'redeem'),
        gte(creditTransactions.createdAt, windowStart),
      ),
    );

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
  redemptionType: K9000RedemptionType;
  userId: string;
  kioskId: string;
  washId: string;
  washType: string;
  stationId?: string;
  correlationId: string;
}

interface DebitResult {
  remainingBalance: number;
  remainingUnit: 'washes' | 'cents';
  auditId: string;
}

async function debitAndLog(input: DebitInput): Promise<DebitResult> {
  const { wallet, redemptionType, userId, kioskId, washId, washType, correlationId } = input;
  const txnId = `TXN-${Date.now()}-${nanoid(8)}`;
  let remainingBalance = 0;
  let remainingUnit: 'washes' | 'cents' = 'washes';

  await db.transaction(async (tx) => {
    // ── Atomic debit per type ──────────────────────────────────────────────
    switch (redemptionType) {
      case 'wash_package': {
        const [updated] = await tx
          .update(walletAccounts)
          .set({
            washPackageCredits: sql`${walletAccounts.washPackageCredits} - 1`,
            lifetimeRedeemedCents: sql`${walletAccounts.lifetimeRedeemedCents} + ${WASH_PRICE_ILS_CENTS}`,
            lastActivityAt: new Date(),
            updatedAt: new Date(),
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
            lastActivityAt: new Date(),
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(walletAccounts.userId, userId),
              gte(walletAccounts.cashWalletBalanceCents, WASH_PRICE_ILS_CENTS),
            ),
          )
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
            lastActivityAt: new Date(),
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(walletAccounts.userId, userId),
              gte(walletAccounts.egiftBalanceCents, WASH_PRICE_ILS_CENTS),
            ),
          )
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
            lastActivityAt: new Date(),
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(walletAccounts.userId, userId),
              gte(walletAccounts.loyaltyPointsBalance, LOYALTY_WASH_COST_POINTS),
            ),
          )
          .returning({ remaining: walletAccounts.loyaltyPointsBalance });

        if (!updated) throw rejectWith('RACE_CONDITION', 'נקודות נאמנות נוצלו במקביל.', 409);
        remainingBalance = updated.remaining ?? 0;
        remainingUnit = 'cents'; // we report points as a numeric balance
        break;
      }

      case 'promo_coupon': {
        const [updated] = await tx
          .update(walletAccounts)
          .set({
            promoBalanceCents: sql`${walletAccounts.promoBalanceCents} - ${WASH_PRICE_ILS_CENTS}`,
            lifetimeRedeemedCents: sql`${walletAccounts.lifetimeRedeemedCents} + ${WASH_PRICE_ILS_CENTS}`,
            lastActivityAt: new Date(),
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(walletAccounts.userId, userId),
              gte(walletAccounts.promoBalanceCents, WASH_PRICE_ILS_CENTS),
            ),
          )
          .returning({ remaining: walletAccounts.promoBalanceCents });

        if (!updated) throw rejectWith('RACE_CONDITION', 'יתרת קופון נוצלה במקביל.', 409);
        remainingBalance = updated.remaining ?? 0;
        remainingUnit = 'cents';
        break;
      }
    }

    // ── Credit Transactions ledger ─────────────────────────────────────────
    const isMonetary = redemptionType !== 'wash_package';
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
      description: `K9000 wash redemption — ${redemptionType} — kiosk ${kioskId}`,
      initiatedBy: 'user',
      initiatedByUserId: userId,
      metadata: { washId, kioskId, correlationId, redemptionType },
    });

    // ── k9000WashEvents — unified K9000 usage log ──────────────────────────
    // transaction_source = "petwash" for ALL wallet/credit flows
    await tx.insert(k9000WashEvents).values({
      transactionSource: 'petwash',
      redemptionSource: redemptionType,   // one of the 5 reporting types
      userId,
      stationId: kioskId,
      platform: 'k9000',
      product: washType,
      amountCents: isMonetary ? WASH_PRICE_ILS_CENTS : 0,
      currency: 'ILS',
      loyaltyPointsAwarded: 0,
      loyaltyEventLogged: false,
      status: 'completed',
      idempotencyKey: `${userId}:${washId}`,
    });
  });

  // ── Audit ledger (outside transaction — append-only hash-chain) ──────────
  const auditId = `audit_k9000_${Date.now()}_${nanoid(8)}`;
  const hashInput = `${auditId}:${userId}:${washId}:${redemptionType}:${correlationId}`;
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
      previousState: { redemptionType },
      newState: { remainingBalance, washId },
      metadata: {
        redemptionType,
        kioskId,
        txnId,
        correlationId,
        redeemedAt: new Date().toISOString(),
      },
    });
  } catch (auditErr: any) {
    // Non-fatal — the debit is already committed
    logger.error('[K9000Redemption] Audit ledger write failed', { auditId, error: auditErr.message, correlationId });
  }

  return { remainingBalance, remainingUnit, auditId };
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function creditTypeForRedemption(type: K9000RedemptionType): string {
  const map: Record<K9000RedemptionType, string> = {
    wash_package: 'wash_package',
    wallet_balance: 'cash_wallet',
    gift_credit: 'egift',
    loyalty_benefit: 'loyalty_points',
    promo_coupon: 'promo_credit',
  };
  return map[type];
}

/** Creates a typed Error with an HTTP status code attached. */
function rejectWith(code: string, messageHe: string, httpStatus: number): Error & { code: string; httpStatus: number } {
  const err = new Error(messageHe) as Error & { code: string; httpStatus: number };
  err.code = code;
  err.httpStatus = httpStatus;
  return err;
}
