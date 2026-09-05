/**
 * Canonical loyalty earn engine (Prestige task #13).
 *
 * The bug this fixes: the loyaltyProfiles/pointsTransactions store — the ONE every
 * Prestige surface reads (dashboard, rewards, tier-up emails) — was only ever fed
 * the welcome 100 points at enrollment. Nothing added points for real spend, so a
 * member's balance never grew, tiers never climbed, and the AI "one wash from
 * Gold" nudge had nothing to work with. (The only spend trigger that existed wrote
 * to a DIFFERENT store the Prestige UI doesn't read.)
 *
 * This is the single canonical function to award points into System A. Call it on
 * any confirmed PetWash-owned sale (wash-package purchase, eGift, shop, marketplace
 * booking). Rate is 1 point per ₪1 (repo-wide constant).
 */
import { db } from '../db';
import { loyaltyProfiles, pointsTransactions } from '@shared/schema-loyalty';
import { detectTierUpgrade } from '../email/luxury-email-service';
import { eq, and, sql } from 'drizzle-orm';
import { logger } from '../lib/logger';

/** Repo-wide earn rate: 1 loyalty point per ₪1 of confirmed spend. */
export const POINTS_PER_SHEKEL = 1;

/** Postgres unique-violation SQLSTATE — the DB-level idempotency backstop
 *  (points_txn_source_type_uq) raises this when a racing double-award/reverse
 *  tries to insert a second ledger row for the same (userId, source, sourceId,
 *  type). We treat it as a benign duplicate, never a hard error. */
const PG_UNIQUE_VIOLATION = '23505';
function isUniqueViolation(err: unknown): boolean {
  return !!err && typeof err === 'object' && (err as { code?: string }).code === PG_UNIQUE_VIOLATION;
}

export interface AwardPointsInput {
  userId: string;
  /** Points to award (will be floored). Use pointsForSpend() for ₪→points. */
  amount: number;
  /** e.g. 'wash_package_purchase', 'egift', 'shop', 'marketplace_booking'. */
  source: string;
  /** Idempotency key for this earn event (e.g. washHistoryId). */
  sourceId: string;
  description?: string;
}

export interface AwardPointsResult {
  awarded: boolean;
  skipped?: 'no_profile' | 'duplicate' | 'zero' | 'error';
  points?: number;
  newBalance?: number;
  tierUpgraded?: boolean;
  newTier?: string;
}

/** Convert a ₪ amount to whole loyalty points. */
export function pointsForSpend(shekels: number): number {
  return Math.floor(Math.max(0, Number(shekels) || 0) * POINTS_PER_SHEKEL);
}

/**
 * Award points into the canonical loyaltyProfiles + pointsTransactions store and
 * apply any tier upgrade. Idempotent per (userId, source, sourceId) so a webhook
 * retry can never double-award. Only enrolled members (with a loyaltyProfiles row)
 * earn — everyone else is skipped, not errored. Never throws.
 */
export async function awardLoyaltyPoints(input: AwardPointsInput): Promise<AwardPointsResult> {
  const { userId, source, sourceId, description } = input;
  const amount = Math.floor(input.amount);
  if (!userId || amount <= 0) return { awarded: false, skipped: 'zero' };

  try {
    // Idempotency — already awarded for this exact source event? (fast-path
    // read; the DB unique index below is the race-safe backstop.)
    const existing = await db
      .select({ id: pointsTransactions.id })
      .from(pointsTransactions)
      .where(and(
        eq(pointsTransactions.userId, userId),
        eq(pointsTransactions.source, source),
        eq(pointsTransactions.sourceId, sourceId),
        eq(pointsTransactions.type, 'earned'),
      ))
      .limit(1);
    if (existing.length) return { awarded: false, skipped: 'duplicate' };

    const [profile] = await db
      .select()
      .from(loyaltyProfiles)
      .where(eq(loyaltyProfiles.userId, userId))
      .limit(1);
    if (!profile) return { awarded: false, skipped: 'no_profile' };

    // R8 fix — the profile balance UPDATE and the audit-ledger INSERT run in
    // ONE transaction, so a crash between them can never leave points added
    // with no audit row (nor an audit row with no points). The INSERT is done
    // FIRST so the unique index (points_txn_source_type_uq) trips before the
    // balance moves: a racing double-award hits 23505 and the whole tx rolls
    // back — points are never double-credited. The balance is bumped by a
    // RELATIVE `points + amount` (not a stale-read absolute), so two DISTINCT
    // concurrent awards can't clobber each other into a lost update.
    const tierCheck = detectTierUpgrade(profile.lifetimePoints, profile.lifetimePoints + amount);

    const newBalance = await db.transaction(async (tx) => {
      await tx.insert(pointsTransactions).values({
        userId,
        type: 'earned',
        amount,
        // Recorded balance is post-award; computed from the pre-read profile.
        // The authoritative balance is the RETURNING value below.
        balance: profile.points + amount,
        source,
        sourceId,
        description: description ?? `Earned ${amount} points`,
      });

      const [updated] = await tx
        .update(loyaltyProfiles)
        .set({
          points: sql`${loyaltyProfiles.points} + ${amount}`,
          lifetimePoints: sql`${loyaltyProfiles.lifetimePoints} + ${amount}`,
          updatedAt: new Date(),
          ...(tierCheck.upgraded ? { tier: tierCheck.newTier, tierSince: new Date() } : {}),
        })
        .where(eq(loyaltyProfiles.userId, userId))
        .returning({ points: loyaltyProfiles.points });

      return updated?.points ?? profile.points + amount;
    });

    if (tierCheck.upgraded) {
      logger.info('[LoyaltyEarn] Tier upgrade', { userId, from: tierCheck.previousTier, to: tierCheck.newTier });
    }
    logger.info('[LoyaltyEarn] Awarded points', {
      userId, amount, source, sourceId, newBalance, tierUpgraded: tierCheck.upgraded,
    });
    return {
      awarded: true,
      points: amount,
      newBalance,
      tierUpgraded: tierCheck.upgraded,
      newTier: tierCheck.upgraded ? tierCheck.newTier : undefined,
    };
  } catch (err: any) {
    // A racing double-award loses the unique-index race — that's the guard
    // doing its job, not a failure: report it as the duplicate it is.
    if (isUniqueViolation(err)) {
      logger.info('[LoyaltyEarn] Duplicate award blocked by unique index', { userId, source, sourceId });
      return { awarded: false, skipped: 'duplicate' };
    }
    logger.error('[LoyaltyEarn] Failed to award points', { error: err?.message, userId, source, sourceId });
    return { awarded: false, skipped: 'error' };
  }
}

export interface ReversePointsInput {
  userId: string;
  /** Must match the source used at award time (e.g. 'nayax_kiosk'). */
  source: string;
  /** Must match the sourceId used at award time (e.g. external_transaction_id). */
  sourceId: string;
  description?: string;
}

export interface ReversePointsResult {
  reversed: boolean;
  skipped?: 'not_found' | 'already_reversed' | 'no_profile' | 'error';
  points?: number;
}

/**
 * Reverse a prior canonical award (refund/cancellation) from loyaltyProfiles.
 * Deducts the originally-earned amount from the spendable `points` balance and
 * writes an audit `reversed` row, idempotent per (userId, source, sourceId).
 *
 * lifetimePoints is intentionally NOT decremented — the schema treats it as
 * monotonic ("never decreases") and tier is derived from it, so a refund lowers
 * the spendable balance without demoting the member.
 */
export async function reverseLoyaltyPoints(input: ReversePointsInput): Promise<ReversePointsResult> {
  const { userId, source, sourceId, description } = input;
  if (!userId) return { reversed: false, skipped: 'error' };

  try {
    // The original earn must exist…
    const [earned] = await db
      .select({ amount: pointsTransactions.amount })
      .from(pointsTransactions)
      .where(and(
        eq(pointsTransactions.userId, userId),
        eq(pointsTransactions.source, source),
        eq(pointsTransactions.sourceId, sourceId),
        eq(pointsTransactions.type, 'earned'),
      ))
      .limit(1);
    if (!earned) return { reversed: false, skipped: 'not_found' };

    // …and must not already be reversed (idempotency).
    const [priorReversal] = await db
      .select({ id: pointsTransactions.id })
      .from(pointsTransactions)
      .where(and(
        eq(pointsTransactions.userId, userId),
        eq(pointsTransactions.source, source),
        eq(pointsTransactions.sourceId, sourceId),
        eq(pointsTransactions.type, 'reversed'),
      ))
      .limit(1);
    if (priorReversal) return { reversed: false, skipped: 'already_reversed' };

    const amount = Math.floor(earned.amount);

    const [profile] = await db
      .select()
      .from(loyaltyProfiles)
      .where(eq(loyaltyProfiles.userId, userId))
      .limit(1);
    if (!profile) return { reversed: false, skipped: 'no_profile' };

    // R8 fix — audit INSERT + balance UPDATE in ONE transaction (crash between
    // them can't deduct points with no audit row), INSERT first so the unique
    // index blocks a racing double-reversal, and a RELATIVE `points - amount`
    // (floored at 0) instead of a stale-read absolute. The unique index is
    // type-aware (…, type) so this 'reversed' row does NOT collide with the
    // original 'earned' row that shares (userId, source, sourceId).
    const newBalance = await db.transaction(async (tx) => {
      await tx.insert(pointsTransactions).values({
        userId,
        type: 'reversed',
        amount: -amount,
        balance: Math.max(0, profile.points - amount),
        source,
        sourceId,
        description: description ?? `Reversed ${amount} points (refund)`,
      });

      const [updated] = await tx
        .update(loyaltyProfiles)
        .set({ points: sql`GREATEST(0, ${loyaltyProfiles.points} - ${amount})`, updatedAt: new Date() })
        .where(eq(loyaltyProfiles.userId, userId))
        .returning({ points: loyaltyProfiles.points });

      return updated?.points ?? Math.max(0, profile.points - amount);
    });

    logger.info('[LoyaltyEarn] Reversed points', { userId, amount, source, sourceId, newBalance });
    return { reversed: true, points: amount };
  } catch (err: any) {
    // A racing double-reversal loses the unique-index race — the guard working.
    if (isUniqueViolation(err)) {
      logger.info('[LoyaltyEarn] Duplicate reversal blocked by unique index', { userId, source, sourceId });
      return { reversed: false, skipped: 'already_reversed' };
    }
    logger.error('[LoyaltyEarn] Failed to reverse points', { error: err?.message, userId, source, sourceId });
    return { reversed: false, skipped: 'error' };
  }
}
