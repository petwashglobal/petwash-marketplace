import { pool } from '../db';
import { logger } from './logger';

/**
 * Turn a Prestige membership from 'pending_verification' into 'active' — only
 * on verified data (CEO rule 2026-09-13: "only real data verified").
 *
 * prestige-join writes every new membership as 'pending_verification', and
 * nothing ever moved it on, so members who joined never became active and
 * never received a tier benefit. There was no rule for WHEN a membership is
 * real. The rule is the platform's own contact contract (ActivationService,
 * PR-AUTH-IDENTITY-1): both contacts proven.
 *
 * A membership becomes active only when ALL of these hold on the account row:
 *   - the mobile was verified by SMS code: users.phone_verified = true AND
 *     users.mobile_verified_at IS NOT NULL (written only by ActivationService
 *     after an OTP check);
 *   - the email is verified: users.email_verified, users.email_verified_at, or
 *     the current sign-in token says email_verified for that same address;
 *   - the membership email IS the account email (nothing typed into a form is
 *     trusted);
 *   - the membership is bound to this account (firebase_uid = uid) and is
 *     currently 'pending_verification'. Suspended, cancelled or already-active
 *     rows are never touched.
 *
 * One conditional UPDATE, so it is idempotent and safe to call from every
 * place a verification completes. Never throws: a failure leaves the row
 * pending, which grants nothing.
 */
export async function activateVerifiedPrivilegeMember(
  uid: string | null | undefined,
  token?: { email?: string | null; emailVerified?: boolean | null },
): Promise<boolean> {
  if (!uid) return false;
  const tokenEmail = String(token?.email ?? '').trim().toLowerCase();
  const tokenEmailVerified = token?.emailVerified === true && tokenEmail !== '';
  try {
    const r = await pool.query(
      `UPDATE privilege_members pm
          SET status = 'active', updated_at = NOW()
         FROM users u
        WHERE u.id = $1
          AND pm.firebase_uid = $1
          AND pm.status = 'pending_verification'
          AND u.phone_verified = true
          AND u.mobile_verified_at IS NOT NULL
          AND u.email IS NOT NULL
          AND lower(u.email) = lower(pm.email)
          AND (u.email_verified = true
               OR u.email_verified_at IS NOT NULL
               OR ($2::boolean AND lower(u.email) = $3))
       RETURNING pm.member_id`,
      [uid, tokenEmailVerified, tokenEmail],
    );
    const activated = (r.rowCount ?? 0) > 0;
    if (activated) {
      logger.info('[PrestigeActivation] membership activated on verified contacts', {
        uid, memberId: r.rows?.[0]?.member_id,
      });
    }
    return activated;
  } catch (err: any) {
    logger.warn('[PrestigeActivation] activation check failed — membership stays pending', {
      uid, error: err?.message,
    });
    return false;
  }
}
