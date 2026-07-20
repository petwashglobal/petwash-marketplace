/**
 * MONYX 5+1 PUNCH CARD — PetWash-operated.
 *
 * WHY OURS AND NOT NAYAX'S: Nayax gates the "Campaign" module server-side. It is
 * absent from our operator account and their own documentation says (in three
 * separate articles) that only a Nayax distributor can enable it. Rather than
 * block the launch on a support ticket, we run the identical offer off the Nayax
 * transaction feed we already ingest in nayax-monyx-events.
 *
 * THE RULE (CEO-confirmed 2026-07-18): five paid qualifying washes, the SIXTH is
 * free. So punchesRequired = 5, and the reward is granted when the 5th punch
 * lands — it is redeemed on the next visit.
 *
 * QUALIFYING (must match the Nayax campaign we would otherwise have configured):
 *   • approved/settled transaction at a PetWash machine
 *   • paid through Monyx (not a plain bank-card tap — those earn nothing)
 *   • amount within the standard-wash band (₪54–56), which includes the ₪55 wash
 *     and excludes the discounted municipal price
 *   • a confidently linked PetWash member
 *
 * IDEMPOTENCY IS STRUCTURAL: monyx_punch_events has UNIQUE(external_transaction_id).
 * A replayed webhook hits the constraint and is ignored — we never rely on
 * check-then-insert, which races.
 *
 * REWARD ISSUANCE IS DELIBERATELY GATED. Reaching 5 punches marks the card
 * `earned` and raises an ops alert; it does NOT auto-mint credit unless
 * MONYX_PUNCH_AUTO_ISSUE=true. The Lynx mint has never returned a verified 2xx in
 * production, and auto-spending real money down an unproven rail is how you give
 * away washes you cannot account for. Punches accrue from day one either way, so
 * no member ever loses progress while issuance stays manual.
 */
import { db } from '../db';
import { sql } from 'drizzle-orm';
import { logger } from '../lib/logger';

export const PUNCH_CAMPAIGN_CODE = 'PW_KS_LOYALTY_5PLUS1_2026';
export const PUNCHES_REQUIRED = 5;           // 5 paid → 6th free
export const QUALIFYING_MIN_ILS = 54;
export const QUALIFYING_MAX_ILS = 56;

/** Auto-issue the free wash via Lynx. OFF until a live mint is proven. */
function autoIssueEnabled(): boolean {
  return String(process.env.MONYX_PUNCH_AUTO_ISSUE).toLowerCase().trim() === 'true';
}

export interface PunchResult {
  counted: boolean;
  reason?: 'duplicate' | 'not_qualifying_amount' | 'no_user';
  punches?: number;
  punchesRequired?: number;
  rewardEarned?: boolean;
  cardId?: number;
}

/** Is this wash inside the standard-price band the campaign rewards? */
export function isQualifyingAmount(amountIls: number): boolean {
  return Number.isFinite(amountIls) && amountIls >= QUALIFYING_MIN_ILS && amountIls <= QUALIFYING_MAX_ILS;
}

/**
 * Record one qualifying wash. Safe to call on every Monyx transaction — it
 * filters, dedups and no-ops on anything that doesn't qualify.
 */
export async function recordQualifyingWash(params: {
  userId: string;
  externalTransactionId: string;
  amountIls: number;
  machineId?: string | null;
}): Promise<PunchResult> {
  const { userId, externalTransactionId, amountIls, machineId } = params;
  if (!userId) return { counted: false, reason: 'no_user' };
  if (!isQualifyingAmount(amountIls)) return { counted: false, reason: 'not_qualifying_amount' };

  try {
    return await (db as any).transaction(async (tx: typeof db) => {
      // Open card for this member (or start one). Lock it so two concurrent
      // webhooks for the same member can't both read punches=4 and both award.
      const openCard: any = await (tx as any).execute(sql`
        SELECT id, punches, punches_required, reward_status, cycle
          FROM monyx_punch_cards
         WHERE user_id = ${userId}
           AND campaign_code = ${PUNCH_CAMPAIGN_CODE}
           AND reward_status = 'accruing'
         ORDER BY cycle DESC
         LIMIT 1
           FOR UPDATE
      `);
      let card: any = openCard?.rows?.[0] ?? openCard?.[0];

      if (!card) {
        // Next cycle number for this member (they may have completed cards before).
        const created: any = await (tx as any).execute(sql`
          INSERT INTO monyx_punch_cards (user_id, campaign_code, cycle, punches_required)
          VALUES (
            ${userId},
            ${PUNCH_CAMPAIGN_CODE},
            COALESCE((SELECT MAX(cycle) FROM monyx_punch_cards
                       WHERE user_id = ${userId} AND campaign_code = ${PUNCH_CAMPAIGN_CODE}), 0) + 1,
            ${PUNCHES_REQUIRED}
          )
          RETURNING id, punches, punches_required, reward_status, cycle
        `);
        card = created?.rows?.[0] ?? created?.[0];
      }

      // Structural dedup: UNIQUE(external_transaction_id). A replay does nothing.
      const inserted: any = await (tx as any).execute(sql`
        INSERT INTO monyx_punch_events
          (punch_card_id, user_id, external_transaction_id, amount_ils, machine_id)
        VALUES
          (${card.id}, ${userId}, ${externalTransactionId}, ${String(amountIls)}, ${machineId ?? null})
        ON CONFLICT (external_transaction_id) DO NOTHING
        RETURNING id
      `);
      const didInsert = Boolean(inserted?.rows?.[0] ?? inserted?.[0]);
      if (!didInsert) {
        return { counted: false, reason: 'duplicate' as const, cardId: card.id };
      }

      const punches = Number(card.punches) + 1;
      const required = Number(card.punches_required) || PUNCHES_REQUIRED;
      const earned = punches >= required;

      await (tx as any).execute(sql`
        UPDATE monyx_punch_cards
           SET punches = ${punches},
               reward_status = ${earned ? 'earned' : 'accruing'},
               completed_at = ${earned ? sql`now()` : sql`completed_at`},
               updated_at = now()
         WHERE id = ${card.id}
      `);

      logger.info('[MonyxPunch] wash counted', {
        userId, cardId: card.id, punches, required, earned, txnTail: externalTransactionId.slice(-6),
      });

      return { counted: true, punches, punchesRequired: required, rewardEarned: earned, cardId: card.id };
    });
  } catch (err: any) {
    // Never let loyalty bookkeeping break the transaction webhook.
    logger.error('[MonyxPunch] failed to record wash', {
      error: err?.message, userId, txnTail: externalTransactionId.slice(-6),
    });
    return { counted: false };
  }
}

/**
 * Undo a punch when its wash is refunded/cancelled. Idempotent: a second call for
 * the same transaction is a no-op because the event is already flagged reversed.
 * A card that has already been completed is left alone — the reward was earned in
 * good faith and clawing it back mid-cycle would be worse than absorbing one wash.
 */
export async function reverseWash(externalTransactionId: string): Promise<{ reversed: boolean }> {
  try {
    return await (db as any).transaction(async (tx: typeof db) => {
      const found: any = await (tx as any).execute(sql`
        SELECT e.id, e.punch_card_id, e.reversed, c.punches, c.reward_status
          FROM monyx_punch_events e
          JOIN monyx_punch_cards c ON c.id = e.punch_card_id
         WHERE e.external_transaction_id = ${externalTransactionId}
           FOR UPDATE OF e, c
      `);
      const row: any = found?.rows?.[0] ?? found?.[0];
      if (!row || row.reversed) return { reversed: false };

      await (tx as any).execute(sql`
        UPDATE monyx_punch_events SET reversed = true, reversed_at = now() WHERE id = ${row.id}
      `);

      // Only claw back from a card still accruing.
      if (row.reward_status === 'accruing') {
        await (tx as any).execute(sql`
          UPDATE monyx_punch_cards
             SET punches = GREATEST(0, punches - 1), updated_at = now()
           WHERE id = ${row.punch_card_id}
        `);
      }

      logger.info('[MonyxPunch] wash reversed', {
        cardId: row.punch_card_id, wasStatus: row.reward_status, txnTail: externalTransactionId.slice(-6),
      });
      return { reversed: true };
    });
  } catch (err: any) {
    logger.error('[MonyxPunch] reversal failed', { error: err?.message, txnTail: externalTransactionId.slice(-6) });
    return { reversed: false };
  }
}

/** Cards sitting at `earned` and awaiting a free wash — the ops queue. */
export async function listEarnedAwaitingIssue(limit = 100): Promise<any[]> {
  const r: any = await (db as any).execute(sql`
    SELECT id, user_id, cycle, punches, completed_at
      FROM monyx_punch_cards
     WHERE campaign_code = ${PUNCH_CAMPAIGN_CODE}
       AND reward_status = 'earned'
     ORDER BY completed_at ASC
     LIMIT ${limit}
  `);
  return r?.rows ?? r ?? [];
}

export const __testing = { autoIssueEnabled };
