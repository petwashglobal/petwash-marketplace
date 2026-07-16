/**
 * Reward-redemption fulfillment (Prestige task #15, slice 3).
 *
 * The gap this closes: POST /api/loyalty/rewards/redeem deducts points and mints
 * a REWARD-* voucher into user_redemptions (status 'pending'), but nothing ever
 * consumed it — the code was checked nowhere, admins had no view over pending
 * redemptions and no way to mark one fulfilled or cancel it. Points → code → void.
 *
 * Fulfillment is a HUMAN rail by design (prestige-loyalty skill: AI/automation
 * never moves member value on its own). An admin verifies the member/partner
 * interaction actually happened, then clicks Fulfill; Cancel refunds the points
 * back to the member's balance as an audited admin adjustment. Both transitions
 * are status-guarded UPDATEs so a double-click or concurrent admin can never
 * fulfill twice or refund twice.
 */
import { db } from '../db';
import { userRedemptions, loyaltyProfiles, pointsTransactions } from '@shared/schema-loyalty';
import { and, eq, sql } from 'drizzle-orm';
import { logger } from '../lib/logger';

export type RedemptionRow = typeof userRedemptions.$inferSelect;

/** Status a client should display — 'expired' is computed, never stored. */
export function redemptionEffectiveStatus(
  r: Pick<RedemptionRow, 'status' | 'expiresAt'>,
  now: Date = new Date(),
): string {
  if (r.status === 'pending' && r.expiresAt && r.expiresAt <= now) return 'expired';
  return r.status;
}

export type FulfillResult =
  | { ok: true; redemption: RedemptionRow }
  | { ok: false; reason: 'not_found' | 'not_pending' | 'expired' };

/**
 * pending → fulfilled. The WHERE clause is the guard: only a pending,
 * non-expired row transitions, atomically. Anything else reports why.
 */
export async function fulfillRedemption(id: number, adminNote?: string): Promise<FulfillResult> {
  const now = new Date();
  const [row] = await db
    .update(userRedemptions)
    .set({
      status: 'fulfilled',
      fulfilledAt: now,
      updatedAt: now,
      // Append, never overwrite — a "GIFT → …" line written at redeem time
      // must survive the admin's fulfillment note.
      ...(adminNote ? { notes: sql`COALESCE(${userRedemptions.notes} || ' | ', '') || ${adminNote}` } : {}),
    })
    .where(and(
      eq(userRedemptions.id, id),
      eq(userRedemptions.status, 'pending'),
      sql`(${userRedemptions.expiresAt} IS NULL OR ${userRedemptions.expiresAt} > ${now})`,
    ))
    .returning();
  if (row) return { ok: true, redemption: row };

  const [existing] = await db
    .select()
    .from(userRedemptions)
    .where(eq(userRedemptions.id, id))
    .limit(1);
  if (!existing) return { ok: false, reason: 'not_found' };
  if (redemptionEffectiveStatus(existing, now) === 'expired') return { ok: false, reason: 'expired' };
  return { ok: false, reason: 'not_pending' };
}

export type CancelResult =
  | { ok: true; redemption: RedemptionRow; refundedPoints: number; newBalance: number | null }
  | { ok: false; reason: 'not_found' | 'not_pending' };

/**
 * pending → cancelled, refunding the points the member spent.
 *
 * Refund semantics: balance only — the original redeem never touched
 * lifetimePoints, so the refund must not either (tier progress is unchanged
 * either way). Refund happens exactly once because only the status-guarded
 * UPDATE that wins the transition reaches the refund step, and everything is
 * in one transaction. An expired-but-pending row may still be cancelled —
 * expiry blocks fulfillment, not the member getting their points back.
 *
 * Edge: member has no loyaltyProfiles row (deleted account) — the cancel still
 * lands but there is nothing to refund into; we report refundedPoints 0 and
 * newBalance null rather than inventing a ledger row for a missing profile.
 */
export async function cancelRedemptionWithRefund(id: number, reason: string): Promise<CancelResult> {
  const now = new Date();
  return await db.transaction(async (tx) => {
    const [row] = await tx
      .update(userRedemptions)
      .set({ status: 'cancelled', updatedAt: now, notes: sql`COALESCE(${userRedemptions.notes} || ' | ', '') || ${'CANCELLED: ' + reason}` })
      .where(and(
        eq(userRedemptions.id, id),
        eq(userRedemptions.status, 'pending'),
      ))
      .returning();

    if (!row) {
      const [existing] = await tx
        .select()
        .from(userRedemptions)
        .where(eq(userRedemptions.id, id))
        .limit(1);
      return { ok: false as const, reason: existing ? ('not_pending' as const) : ('not_found' as const) };
    }

    const [profile] = await tx
      .update(loyaltyProfiles)
      .set({
        points: sql`${loyaltyProfiles.points} + ${row.pointsCost}`,
        updatedAt: now,
      })
      .where(eq(loyaltyProfiles.userId, row.userId))
      .returning({ points: loyaltyProfiles.points });

    if (!profile) {
      logger.warn('[RewardFulfillment] Cancelled redemption but member has no loyalty profile — nothing to refund into', {
        redemptionId: row.id, userId: row.userId,
      });
      return { ok: true as const, redemption: row, refundedPoints: 0, newBalance: null };
    }

    await tx.insert(pointsTransactions).values({
      userId: row.userId,
      type: 'refund',
      amount: row.pointsCost,
      balance: profile.points,
      source: 'reward_redemption_cancelled',
      sourceId: String(row.id),
      description: `Redemption #${row.id} cancelled: ${reason}`,
    });

    return { ok: true as const, redemption: row, refundedPoints: row.pointsCost, newBalance: profile.points };
  });
}
