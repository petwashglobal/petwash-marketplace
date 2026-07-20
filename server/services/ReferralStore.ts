/**
 * REFERRAL STORE — durable replacement for referral.ts's in-process Maps.
 *
 * What was wrong: server/routes/referral.ts kept EVERY piece of referral state in
 * JavaScript Maps — codes, referral records, stats, and `userCredits` holding
 * real ₪25 balances. The router is mounted at /api/referral and a customer-facing
 * ReferralPage reads it, so a member could refer a friend, be shown a balance,
 * and lose it on the next deploy. We deploy several times a day.
 *
 * Those credits were also never spendable: plain numbers on an object, never in
 * walletAccounts, never in the hash-chained ledger. The feature reported success
 * while granting nothing real.
 *
 * This module persists the referral graph to tables that already existed and went
 * unused (users.referral_code, referrals) plus referral_credits for the money.
 *
 * DESIGN CHOICE — record the obligation, do not silently move money.
 * Earning a credit writes a `referral_credits` row with status 'earned'. It does
 * NOT push ₪ into the wallet. Turning an earned credit into spendable balance is
 * a separate, audited issuance step. Same discipline as the refund rail: be
 * truthful about what is owed first, pay second. Auto-crediting wallets from a
 * path that has never once worked correctly would be the wrong way round.
 */
import { db } from '../db';
import { sql } from 'drizzle-orm';
import { logger } from '../lib/logger';

/** Unambiguous alphabet — no O/0, I/1 confusion when read off a screen. */
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function randomCode(len = 8): string {
  let out = '';
  for (let i = 0; i < len; i++) out += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  return out;
}

/**
 * The member's own shareable code, persisted on users.referral_code.
 * Stable across restarts — previously regenerated whenever the Map was empty,
 * so a member's shared link silently stopped matching them after a deploy.
 */
export async function getOrCreateReferralCode(userId: string): Promise<string | null> {
  try {
    const existing: any = await (db as any).execute(sql`
      SELECT referral_code FROM users WHERE id = ${userId} LIMIT 1
    `);
    const row: any = existing?.rows?.[0] ?? existing?.[0];
    if (!row) {
      logger.warn('[ReferralStore] no such user', { userId });
      return null;
    }
    if (row.referral_code) return row.referral_code;

    // Generate and claim, retrying on the UNIQUE collision rather than trusting
    // a pre-check (two signups can race between SELECT and UPDATE).
    for (let attempt = 0; attempt < 5; attempt++) {
      const code = randomCode();
      try {
        const upd: any = await (db as any).execute(sql`
          UPDATE users SET referral_code = ${code}
           WHERE id = ${userId} AND referral_code IS NULL
          RETURNING referral_code
        `);
        const got: any = upd?.rows?.[0] ?? upd?.[0];
        if (got?.referral_code) return got.referral_code;
        // Someone else set it first — read it back.
        const re: any = await (db as any).execute(sql`SELECT referral_code FROM users WHERE id = ${userId}`);
        const reRow: any = re?.rows?.[0] ?? re?.[0];
        if (reRow?.referral_code) return reRow.referral_code;
      } catch {
        // UNIQUE collision on the code itself — try another.
      }
    }
    logger.error('[ReferralStore] could not allocate a referral code', { userId });
    return null;
  } catch (err: any) {
    logger.error('[ReferralStore] getOrCreateReferralCode failed', { error: err?.message, userId });
    return null;
  }
}

/** Resolve a shared code back to its owner. */
export async function findUserByReferralCode(code: string): Promise<string | null> {
  if (!code) return null;
  const r: any = await (db as any).execute(sql`
    SELECT id FROM users WHERE referral_code = ${code.toUpperCase()} LIMIT 1
  `);
  const row: any = r?.rows?.[0] ?? r?.[0];
  return row?.id ?? null;
}

/**
 * Record that an invitee signed up under a code. Also stamps users.referred_by_code,
 * which the booking flow reads but which nothing ever wrote — so referral
 * attribution never actually fired at booking time.
 */
export async function linkSignup(params: {
  code: string;
  inviteeUserId: string;
  inviteeEmail?: string | null;
}): Promise<{ ok: boolean; referralId?: number; reason?: string }> {
  const { code, inviteeUserId, inviteeEmail } = params;
  const inviterUserId = await findUserByReferralCode(code);
  if (!inviterUserId) return { ok: false, reason: 'UNKNOWN_CODE' };
  if (inviterUserId === inviteeUserId) return { ok: false, reason: 'SELF_REFERRAL' };

  try {
    const ins: any = await (db as any).execute(sql`
      INSERT INTO referrals (inviter_user_id, invitee_user_id, invitee_email, code, status)
      VALUES (${inviterUserId}, ${inviteeUserId}, ${inviteeEmail ?? null}, ${code.toUpperCase()}, 'signed_up')
      RETURNING id
    `);
    const referralId = (ins?.rows?.[0] ?? ins?.[0])?.id;

    await (db as any).execute(sql`
      UPDATE users SET referred_by_code = ${code.toUpperCase()}
       WHERE id = ${inviteeUserId} AND referred_by_code IS NULL
    `);

    logger.info('[ReferralStore] signup linked', { referralId, inviterUserId, inviteeUserId });
    return { ok: true, referralId };
  } catch (err: any) {
    logger.error('[ReferralStore] linkSignup failed', { error: err?.message, code, inviteeUserId });
    return { ok: false, reason: 'DB_ERROR' };
  }
}

/** The referral awaiting completion for this invitee, if any. */
export async function findPendingReferralForInvitee(inviteeUserId: string): Promise<any | null> {
  const r: any = await (db as any).execute(sql`
    SELECT id, inviter_user_id, invitee_user_id, code, status
      FROM referrals
     WHERE invitee_user_id = ${inviteeUserId}
       AND status IN ('pending', 'signed_up')
     ORDER BY created_at ASC
     LIMIT 1
  `);
  return r?.rows?.[0] ?? r?.[0] ?? null;
}

/** Total ₪ this member has ever earned — used for the lifetime cap. */
export async function totalEarnedIls(userId: string): Promise<number> {
  const r: any = await (db as any).execute(sql`
    SELECT COALESCE(SUM(amount_ils), 0) AS total
      FROM referral_credits
     WHERE user_id = ${userId} AND status <> 'void'
  `);
  const row: any = r?.rows?.[0] ?? r?.[0];
  return Number(row?.total ?? 0);
}

/** Earned but not yet issued into the wallet — what we honestly owe them. */
export async function outstandingCreditIls(userId: string): Promise<number> {
  const r: any = await (db as any).execute(sql`
    SELECT COALESCE(SUM(amount_ils), 0) AS total
      FROM referral_credits
     WHERE user_id = ${userId} AND status = 'earned'
  `);
  const row: any = r?.rows?.[0] ?? r?.[0];
  return Number(row?.total ?? 0);
}

/**
 * Complete a referral and record both credits.
 *
 * Idempotent by construction: referral_credits has UNIQUE(referral_id, role), so
 * a retried /complete cannot double-credit. Enforced by the database, not by a
 * check-then-write that races.
 */
export async function completeReferral(params: {
  referralId: number;
  inviterUserId: string;
  inviteeUserId: string;
  creditIls: number;
  lifetimeCapIls: number;
}): Promise<{ ok: boolean; reason?: string; credited?: string[] }> {
  const { referralId, inviterUserId, inviteeUserId, creditIls, lifetimeCapIls } = params;

  const [inviterEarned, inviteeEarned] = await Promise.all([
    totalEarnedIls(inviterUserId),
    totalEarnedIls(inviteeUserId),
  ]);
  if (inviterEarned + creditIls > lifetimeCapIls) return { ok: false, reason: 'INVITER_CAP_REACHED' };
  if (inviteeEarned + creditIls > lifetimeCapIls) return { ok: false, reason: 'INVITEE_CAP_REACHED' };

  try {
    return await (db as any).transaction(async (tx: typeof db) => {
      const credited: string[] = [];
      for (const [role, userId] of [['inviter', inviterUserId], ['invitee', inviteeUserId]] as const) {
        const ins: any = await (tx as any).execute(sql`
          INSERT INTO referral_credits (user_id, referral_id, role, amount_ils, status, reason)
          VALUES (${userId}, ${referralId}, ${role}, ${String(creditIls)}, 'earned',
                  ${'Referral completed (' + role + ')'})
          ON CONFLICT (referral_id, role) DO NOTHING
          RETURNING id
        `);
        if (ins?.rows?.[0] ?? ins?.[0]) credited.push(role);
      }

      await (tx as any).execute(sql`
        UPDATE referrals
           SET status = 'completed',
               completed_at = now(),
               inviter_credited_at = COALESCE(inviter_credited_at, now()),
               invitee_credited_at = COALESCE(invitee_credited_at, now())
         WHERE id = ${referralId}
      `);

      logger.info('[ReferralStore] referral completed', { referralId, credited, creditIls });
      return { ok: true, credited };
    });
  } catch (err: any) {
    logger.error('[ReferralStore] completeReferral failed', { error: err?.message, referralId });
    return { ok: false, reason: 'DB_ERROR' };
  }
}

/** Successful referrals, for the level/stats display. */
export async function successfulReferralCount(userId: string): Promise<number> {
  const r: any = await (db as any).execute(sql`
    SELECT COUNT(*)::int AS n FROM referrals
     WHERE inviter_user_id = ${userId} AND status = 'completed'
  `);
  const row: any = r?.rows?.[0] ?? r?.[0];
  return Number(row?.n ?? 0);
}

/** Referral history for the member's page. */
export async function listReferrals(inviterUserId: string, limit = 100): Promise<any[]> {
  const r: any = await (db as any).execute(sql`
    SELECT id, invitee_user_id, invitee_email, code, status, created_at, completed_at
      FROM referrals
     WHERE inviter_user_id = ${inviterUserId}
     ORDER BY created_at DESC
     LIMIT ${limit}
  `);
  return r?.rows ?? r ?? [];
}

/** Aggregate stats for the member's referral page, computed from the DB. */
export async function getStats(userId: string): Promise<{
  totalInvites: number;
  successfulInvites: number;
  pendingInvites: number;
  totalCreditsGrantedILS: number;
}> {
  const r: any = await (db as any).execute(sql`
    SELECT
      COUNT(*)::int                                                   AS total,
      COUNT(*) FILTER (WHERE status = 'completed')::int               AS successful,
      COUNT(*) FILTER (WHERE status IN ('pending','signed_up'))::int  AS pending
    FROM referrals
    WHERE inviter_user_id = ${userId}
  `);
  const row: any = r?.rows?.[0] ?? r?.[0] ?? {};
  return {
    totalInvites: Number(row.total ?? 0),
    successfulInvites: Number(row.successful ?? 0),
    pendingInvites: Number(row.pending ?? 0),
    totalCreditsGrantedILS: await totalEarnedIls(userId),
  };
}

/** Record a link click. Kept lightweight — a click is not a referral. */
export async function recordClick(code: string, inviteeEmail?: string | null): Promise<{ ok: boolean; inviterUserId?: string }> {
  const inviterUserId = await findUserByReferralCode(code);
  if (!inviterUserId) return { ok: false };
  try {
    await (db as any).execute(sql`
      INSERT INTO referrals (inviter_user_id, invitee_email, code, status)
      VALUES (${inviterUserId}, ${inviteeEmail ?? null}, ${code.toUpperCase()}, 'pending')
    `);
  } catch (err: any) {
    logger.warn('[ReferralStore] click not recorded', { error: err?.message, code });
  }
  return { ok: true, inviterUserId };
}
