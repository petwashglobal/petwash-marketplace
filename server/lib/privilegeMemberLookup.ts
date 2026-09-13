import { pool } from '../db';

/**
 * Find the Prestige (privilege_members) row that belongs to a signed-in account.
 *
 * 2026-09-13: three readers — the member tier discount in routes.ts, /api/me/status
 * and the home attention feed — all looked the member up by
 * `privilege_members.firebase_uid = uid`. Neither join route ever wrote that
 * column (prestige-join.ts and privilege-loyalty.ts both insert without it), so
 * every enrolled member read as NOT a member: no tier discount, "NOT_JOINED" on
 * the status endpoint, and no Prestige item on the home screen. No error
 * anywhere, because "no row" is a legitimate answer.
 *
 * Resolution order:
 *   1. firebase_uid = uid — the binding prestige-join now writes.
 *   2. Otherwise, the row whose email is this account's own email in `users`,
 *      and only if that row is not already bound to a different account
 *      (`firebase_uid IS NULL`). This is the same enrollment-by-email rule the
 *      wallet/pass surfaces use, and it recovers every member who joined before
 *      the uid was written. The email is read from the users row, never from a
 *      request body, so a caller cannot claim someone else's membership.
 *
 * Read-only. Returns null when there is no row or when the lookup fails — a
 * lookup failure must never grant a benefit.
 */
export interface PrivilegeMemberRecord {
  memberId: string;
  tier: string;
  status: string;
  points: number;
}

export async function findPrivilegeMemberForUser(uid: string | null | undefined): Promise<PrivilegeMemberRecord | null> {
  if (!uid) return null;
  const r = await pool.query(
    `SELECT pm.member_id, pm.tier, pm.status, pm.points, (pm.firebase_uid = $1) AS bound
       FROM privilege_members pm
      WHERE pm.firebase_uid = $1
         OR (pm.firebase_uid IS NULL
             AND lower(pm.email) = (SELECT lower(u.email) FROM users u
                                     WHERE u.id = $1 AND u.email IS NOT NULL AND u.email <> ''
                                     LIMIT 1))
      ORDER BY bound DESC NULLS LAST
      LIMIT 1`,
    [uid],
  );
  const row = r.rows?.[0];
  if (!row) return null;
  return {
    memberId: String(row.member_id),
    tier: String(row.tier ?? 'bronze'),
    status: String(row.status ?? '').toLowerCase(),
    points: Number(row.points ?? 0),
  };
}
