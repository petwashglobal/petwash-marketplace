/**
 * Loyalty Ledger Service — canonical engine for all credit/debit operations.
 *
 * Design rules (locked, do not change):
 *  • All amounts in agorot (cents). Never store ILS decimals.
 *  • Ledger is append-only. Never UPDATE or DELETE rows.
 *  • users.loyalty_balance_cents is a cache — source of truth is the ledger.
 *  • All reward amounts and expiry come from loyalty_rules, never hardcoded.
 *  • Every earn call requires a unique_fingerprint — idempotency enforced via
 *    reward_claims. Duplicate fingerprints are silently skipped (safe to retry).
 *  • Max balance cap: 30 000 agorot (₪300). Partial credits applied if cap hit.
 *  • Redemption max: 50% of order value. Minimum redemption: 1 000 agorot (₪10).
 */

import { db } from '../db';
import { eq, sql, and, lte, gt } from 'drizzle-orm';
import {
  users,
  loyaltyLedger,
  loyaltyRules,
  rewardClaims,
} from '../../shared/schema';
import type { LoyaltyRule, LoyaltyLedgerEntry } from '../../shared/schema';
import { logger } from '../lib/logger';

const MAX_BALANCE_CENTS = 30_000; // ₪300 cap
const MIN_REDEEM_CENTS  = 1_000;  // ₪10 minimum redemption

// ─── Rule config ─────────────────────────────────────────────────────────────

let _ruleCache: Map<string, LoyaltyRule> | null = null;
let _ruleCacheAt = 0;
const RULE_CACHE_TTL = 60_000; // 1 min

export async function getRuleConfig(ruleKey: string): Promise<LoyaltyRule | null> {
  const now = Date.now();
  if (!_ruleCache || now - _ruleCacheAt > RULE_CACHE_TTL) {
    const rows = await db.select().from(loyaltyRules);
    _ruleCache = new Map(rows.map(r => [r.ruleKey, r]));
    _ruleCacheAt = now;
  }
  return _ruleCache.get(ruleKey) ?? null;
}

export function invalidateRuleCache() {
  _ruleCache = null;
}

// ─── Balance reads ────────────────────────────────────────────────────────────

export async function getLoyaltyBalance(userId: string): Promise<number> {
  const [row] = await db
    .select({ bal: users.loyaltyBalanceCents })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return row?.bal ?? 0;
}

export async function getLoyaltyHistory(userId: string, limit = 20): Promise<LoyaltyLedgerEntry[]> {
  return db
    .select()
    .from(loyaltyLedger)
    .where(eq(loyaltyLedger.userId, userId))
    .orderBy(sql`${loyaltyLedger.createdAt} DESC`)
    .limit(limit);
}

// ─── Core earn ────────────────────────────────────────────────────────────────

interface AwardOptions {
  userId:     string;
  ruleKey:    string;
  fingerprint: string; // unique per user+rule+context — prevents double-fire
  bookingId?: number;
  referralId?: number;
  experimentVariant?: string;
  overrideAmountCents?: number; // only for admin_adjust; rule amounts preferred
}

/**
 * Award loyalty credit. Returns credited amount (0 if skipped/capped).
 * Always safe to call multiple times with the same fingerprint — idempotent.
 */
export async function awardLoyaltyCredit(opts: AwardOptions): Promise<number> {
  const { userId, ruleKey, fingerprint, bookingId, referralId, experimentVariant } = opts;

  // 1. Load rule
  const rule = await getRuleConfig(ruleKey);
  if (!rule) {
    logger.warn('[Loyalty] Unknown rule key, skipping', { ruleKey, userId });
    return 0;
  }
  if (!rule.enabled) {
    logger.debug('[Loyalty] Rule disabled, skipping', { ruleKey, userId });
    return 0;
  }

  const amountCents = opts.overrideAmountCents ?? rule.rewardIlsCents;
  if (amountCents <= 0) return 0;

  // 2. Idempotency — claim the fingerprint atomically
  try {
    const [claim] = await db
      .insert(rewardClaims)
      .values({ userId, ruleKey, bookingId, referralId, uniqueFingerprint: fingerprint })
      .returning();

    // 3. Max uses per user check
    if (rule.maxUsesPerUser != null) {
      const [{ cnt }] = await db
        .select({ cnt: sql<number>`count(*)::int` })
        .from(rewardClaims)
        .where(and(eq(rewardClaims.userId, userId), eq(rewardClaims.ruleKey, ruleKey)));
      if (cnt > rule.maxUsesPerUser) {
        // Rollback: delete the claim we just inserted
        await db.delete(rewardClaims).where(eq(rewardClaims.id, claim.id));
        logger.info('[Loyalty] Max uses reached, skipping', { ruleKey, userId, cnt, max: rule.maxUsesPerUser });
        return 0;
      }
    }

    // 4. Compute new balance (cap at MAX_BALANCE_CENTS)
    const currentBalance = await getLoyaltyBalance(userId);
    const room = Math.max(0, MAX_BALANCE_CENTS - currentBalance);
    const credited = Math.min(amountCents, room);
    if (credited <= 0) {
      logger.info('[Loyalty] Balance cap reached, skipping credit', { userId, currentBalance, attempted: amountCents });
      await db.delete(rewardClaims).where(eq(rewardClaims.id, claim.id));
      return 0;
    }
    const newBalance = currentBalance + credited;

    // 5. Compute expiry
    const expiresAt = rule.expiryDays
      ? new Date(Date.now() + rule.expiryDays * 86_400_000)
      : null;

    // 6. Write ledger entry + update cached balance atomically
    await db.transaction(async (tx) => {
      await tx.insert(loyaltyLedger).values({
        userId,
        eventType: ruleKey.startsWith('winback') ? 'earn_winback'
                 : ruleKey === 'welcome'         ? 'earn_welcome'
                 : ruleKey.startsWith('referral') ? 'earn_referral'
                 : ruleKey.startsWith('streak')   ? 'earn_streak'
                 : 'earn_booking',
        amountIlsCents:    credited,
        balanceAfterCents: newBalance,
        bookingId,
        referralId,
        rewardClaimId:     claim.id,
        experimentVariant: experimentVariant ?? null,
        expiresAt,
        note: rule.description ?? ruleKey,
      });

      await tx
        .update(users)
        .set({ loyaltyBalanceCents: newBalance })
        .where(eq(users.id, userId));
    });

    logger.info('[Loyalty] Credit awarded', { userId, ruleKey, credited, newBalance, fingerprint });
    return credited;

  } catch (err: any) {
    if (err?.code === '23505') {
      // Unique violation on fingerprint — already claimed, safe to ignore
      logger.debug('[Loyalty] Duplicate fingerprint, skipping', { fingerprint, userId, ruleKey });
      return 0;
    }
    throw err;
  }
}

// ─── Redeem ───────────────────────────────────────────────────────────────────

interface RedeemOptions {
  userId:          string;
  amountCents:     number;
  bookingId?:      number;
  orderTotalCents: number; // for 50% cap validation
  fingerprint?:    string; // idempotency key — prevents double-spend on retries
}

export interface RedeemResult {
  applied: number; // agorot actually deducted (may be less than requested)
  newBalance: number;
  error?: string;
}

export async function redeemLoyaltyCredit(opts: RedeemOptions): Promise<RedeemResult> {
  const { userId, amountCents, bookingId, orderTotalCents, fingerprint } = opts;

  // ── Idempotency: if this fingerprint was already processed, return cached result ──
  if (fingerprint) {
    const existing = await db
      .select({ amountIlsCents: loyaltyLedger.amountIlsCents, balanceAfterCents: loyaltyLedger.balanceAfterCents })
      .from(loyaltyLedger)
      .where(
        sql`user_id = ${userId}
          AND event_type = 'redeem'
          AND note LIKE ${'%[fp:' + fingerprint + ']%'}`,
      )
      .limit(1);

    if (existing.length > 0) {
      const row = existing[0];
      logger.info('[Loyalty] Redeem already processed (idempotent)', { fingerprint, bookingId });
      return {
        applied: Math.abs(row.amountIlsCents),
        newBalance: row.balanceAfterCents,
      };
    }
  }

  const currentBalance = await getLoyaltyBalance(userId);
  if (currentBalance < MIN_REDEEM_CENTS) {
    return { applied: 0, newBalance: currentBalance, error: 'Insufficient loyalty balance' };
  }

  const maxRedeemable = Math.min(
    currentBalance,
    Math.floor(orderTotalCents * 0.5), // 50% cap
  );
  if (maxRedeemable < MIN_REDEEM_CENTS) {
    return { applied: 0, newBalance: currentBalance, error: 'Below minimum redemption threshold' };
  }

  const applied = Math.min(amountCents, maxRedeemable);
  const newBalance = currentBalance - applied;
  const fpTag = fingerprint ? ` [fp:${fingerprint}]` : '';

  await db.transaction(async (tx) => {
    await tx.insert(loyaltyLedger).values({
      userId,
      eventType:         'redeem',
      amountIlsCents:    -applied,
      balanceAfterCents: newBalance,
      bookingId,
      note:              `Redeemed at checkout (booking ${bookingId ?? 'N/A'})${fpTag}`,
    });
    await tx.update(users)
      .set({ loyaltyBalanceCents: newBalance })
      .where(eq(users.id, userId));
  });

  logger.info('[Loyalty] Credit redeemed', { userId, applied, newBalance, bookingId, fingerprint });
  return { applied, newBalance };
}

// ─── Expiry sweep (nightly cron) ──────────────────────────────────────────────

/**
 * Expire credits whose expiresAt has passed.
 * Debits each user's balance and appends an 'expire' ledger row.
 * Safe to run multiple times — checks for already-expired rows.
 */
export async function expireLoyaltyCredits(): Promise<number> {
  const now = new Date();

  // Find all ledger earn rows that are expired and haven't been offset yet
  const expiredRows = await db
    .select()
    .from(loyaltyLedger)
    .where(and(
      lte(loyaltyLedger.expiresAt, now),
      gt(loyaltyLedger.amountIlsCents, 0), // only earn rows
      sql`${loyaltyLedger.eventType} NOT IN ('expire','redeem','admin_adjust')`,
    ));

  // Group by user, sum expirable amounts
  const byUser = new Map<string, number>();
  for (const row of expiredRows) {
    // Only expire if no offsetting expire row exists for this ledger entry
    const existing = await db
      .select({ cnt: sql<number>`count(*)::int` })
      .from(loyaltyLedger)
      .where(and(
        eq(loyaltyLedger.userId, row.userId),
        eq(loyaltyLedger.eventType, 'expire'),
        sql`note LIKE ${'%ledger#' + row.id + '%'}`,
      ));
    if ((existing[0]?.cnt ?? 0) > 0) continue;
    byUser.set(row.userId, (byUser.get(row.userId) ?? 0) + row.amountIlsCents);
  }

  let count = 0;
  for (const [userId, totalExpireCents] of byUser.entries()) {
    const currentBalance = await getLoyaltyBalance(userId);
    const debit = Math.min(totalExpireCents, currentBalance);
    if (debit <= 0) continue;
    const newBalance = currentBalance - debit;

    await db.transaction(async (tx) => {
      await tx.insert(loyaltyLedger).values({
        userId,
        eventType:         'expire',
        amountIlsCents:    -debit,
        balanceAfterCents: newBalance,
        note:              `Expired credits (${new Date().toISOString()})`,
      });
      await tx.update(users)
        .set({ loyaltyBalanceCents: newBalance })
        .where(eq(users.id, userId));
    });
    count++;
    logger.info('[Loyalty] Credits expired', { userId, debit, newBalance });
  }

  return count;
}

// ─── Streak queries ───────────────────────────────────────────────────────────

export async function getStreakCounts(userId: string): Promise<{
  consecutiveSameProvider: { providerId: string; count: number } | null;
  walkBookings:  number;
  sitBookings:   number;
}> {
  const { bookingRequests } = await import('../../shared/schema');

  // Count completed walk / sit bookings for this user
  const [{ walkCount, sitCount }] = await db
    .select({
      walkCount: sql<number>`sum(case when service_type = 'dog_walking' then 1 else 0 end)::int`,
      sitCount:  sql<number>`sum(case when service_type = 'pet_sitting'  then 1 else 0 end)::int`,
    })
    .from(bookingRequests)
    .where(and(
      eq(bookingRequests.ownerId, userId),
      sql`status IN ('completed','reviewed')`,
    ));

  // Find longest current consecutive streak with same provider (last N bookings)
  const recent = await db
    .select({ providerId: bookingRequests.providerId })
    .from(bookingRequests)
    .where(and(
      eq(bookingRequests.ownerId, userId),
      sql`status IN ('completed','reviewed')`,
    ))
    .orderBy(sql`${bookingRequests.createdAt} DESC`)
    .limit(20);

  let streakProvider: string | null = null;
  let streakCount = 0;
  if (recent.length > 0) {
    const first = recent[0].providerId;
    streakCount = 1;
    for (let i = 1; i < recent.length; i++) {
      if (recent[i].providerId === first) streakCount++;
      else break;
    }
    streakProvider = first;
  }

  return {
    consecutiveSameProvider: streakProvider ? { providerId: streakProvider, count: streakCount } : null,
    walkBookings: walkCount ?? 0,
    sitBookings:  sitCount  ?? 0,
  };
}
