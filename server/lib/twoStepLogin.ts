/**
 * 2-STEP LOGIN — the one place that decides whether a member's opt-in applies.
 *
 * `users.two_factor_enabled` records a CHOICE ("one-way verification is not
 * enough for me"). It does not, on its own, say that a second factor can be
 * PRODUCED. Two routes used to answer that question independently and reach
 * opposite conclusions for the same member:
 *
 *   POST /api/auth/session          — flag alone → 428 MFA_REQUIRED
 *   POST /api/auth/login/2fa/start  — no phone   → { needed: false } (fail open)
 *
 * A member enrolled with no phone in either store therefore got a demand for an
 * SMS proof that no route could ever issue: the gate asked for a code, the start
 * route declined to send one, and the client — told only `needed:false` — showed
 * "please try again" behind a retry that answered 428 again. Password sign-in was
 * permanently blocked, and the reason was never stated.
 *
 * The gate and the start route now share these primitives, so they cannot
 * disagree about whether 2FA applies to an account.
 *
 * THREE outcomes, not two. "No phone on file" is a claim about BOTH stores —
 * Postgres holds what the platform reads, the Firebase auth record owns phone
 * IDENTITY (/api/auth/phone-session resolves accounts through
 * getUserByPhoneNumber), and a member may hold one without the other. Concluding
 * `none` from Postgres alone would silently strip 2FA from a member who has a
 * verified number on their Firebase record. So a lookup that cannot establish
 * the answer returns `unresolved` and is never read as "no second factor".
 */
import { pool } from '../db';
import { auth as fbAdminAuth } from './firebase-admin';
import { validateMfaLoginToken } from './mfaLoginToken';
import { logger } from './logger';

/** Machine-readable refusals. The client localises on these, not on the text. */
export const MFA_NO_FACTOR_CODE = 'MFA_NO_FACTOR' as const;
export const TWO_FACTOR_UNAVAILABLE_CODE = 'TWO_FACTOR_UNAVAILABLE' as const;

/**
 * Said when an account requires a second factor and has none to challenge.
 * English only, deliberately: the client owns the Hebrew/English copy and keys
 * it off the code above. This is the fallback for any caller that does not.
 *
 * The second sentence names a remedy that is REACHABLE, and that was checked
 * rather than assumed. My Account renders a Phone Number section whose button
 * reads "Verify" when none is set; it runs the Firebase SMS OTP and confirms
 * through POST /api/user/settings/phone/confirm-verification, which carries no
 * feature flag and is mounted at /api/user in production.
 *
 * NOT the same thing as /api/user/settings/phone/request-change — that is a
 * second, server-driven mechanism, and it is genuinely unreachable (no client
 * screen calls it, and production never sets
 * UNIFIED_VERIFICATION_CHANGE_PHONE_ENABLED, so it answers 503). Checking only
 * that pair and concluding "phone-add is impossible" is a mistake already made
 * once here; the wired path is the Firebase one.
 */
export const MFA_NO_FACTOR_MESSAGE =
  'Two-step login is on for this account, but there is no mobile number to send a code to. '
  + 'Sign in with a one-time code, then add a mobile number under Phone Number in My Account.';

export const TWO_FACTOR_UNAVAILABLE_MESSAGE =
  'Two-step verification is temporarily unavailable — please try again.';

/** Where a member's challengeable number stands, across both stores. */
export type TwoFactorPhone =
  /** A number exists and may be challenged. */
  | { status: 'ok'; phone: string }
  /** ESTABLISHED that neither store holds one. Only this licenses "no factor". */
  | { status: 'none' }
  /** Could not be established. Never treated as `none`. */
  | { status: 'unresolved'; reason: string };

export type TwoStepLoginRow =
  /** The users row could not be read — enrolment itself is unknown. */
  | { status: 'unknown'; reason: string }
  | { status: 'not_enrolled' }
  | { status: 'enrolled'; pgPhone: string | null };

/**
 * Read the enrolment flag and the Postgres phone in one query.
 *
 * A read failure is reported as `unknown` rather than thrown, because the two
 * callers answer it differently: the session gate keeps its long-standing
 * fail-safe (a database blip must not lock every password login out), while the
 * start route refuses visibly, having nothing to send a code to.
 */
export async function readTwoStepLoginRow(uid: string): Promise<TwoStepLoginRow> {
  try {
    const { rows } = await pool.query(
      'SELECT phone, two_factor_enabled FROM users WHERE id = $1 LIMIT 1',
      [uid],
    );
    const row = rows[0];
    if (!row || row.two_factor_enabled !== true) return { status: 'not_enrolled' };
    const pgPhone = typeof row.phone === 'string' && row.phone.trim() ? row.phone : null;
    return { status: 'enrolled', pgPhone };
  } catch (e: any) {
    logger.warn('[TwoStepLogin] could not read enrolment row', { uid, error: e?.message });
    return { status: 'unknown', reason: e?.message || 'query_failed' };
  }
}

/** The row's phone alone, for a uid that is not enrolled. `undefined` = unreadable. */
async function readPgPhoneOnly(uid: string): Promise<string | null | undefined> {
  try {
    const { rows } = await pool.query('SELECT phone FROM users WHERE id = $1 LIMIT 1', [uid]);
    const phone = rows[0]?.phone;
    return typeof phone === 'string' && phone.trim() ? phone : null;
  } catch (e: any) {
    logger.warn('[TwoStepLogin] could not read phone', { uid, error: e?.message });
    return undefined;
  }
}

/**
 * Resolve the number a challenge would be sent to, asking Postgres first and the
 * Firebase auth record second.
 *
 * `pgPhone` is an optimisation for a caller that has already read the row, and
 * the two empty values mean DIFFERENT things: `null` is "Postgres was read and
 * holds nothing", `undefined` is "not read yet" and makes this function read it.
 * Defaulting `undefined` to "holds nothing" would skip Postgres for any caller
 * without the row in hand and answer `none` for a member whose number is sitting
 * in it — the same false claim in a new place.
 *
 * A store that cannot be read is `unresolved`, not `none`: the caller verified an
 * ID token for this uid moments earlier, so a record that fails or is missing
 * outright is an anomaly, and answering `none` on an anomaly is exactly the
 * silent downgrade this module exists to prevent.
 */
export async function resolveTwoFactorPhone(
  uid: string,
  pgPhone?: string | null,
): Promise<TwoFactorPhone> {
  if (pgPhone === undefined) {
    const row = await readTwoStepLoginRow(uid);
    if (row.status === 'unknown') return { status: 'unresolved', reason: row.reason };
    // A not-enrolled row still has a phone worth reporting; re-read it rather
    // than inventing an absence the row does not support.
    pgPhone = row.status === 'enrolled' ? row.pgPhone : await readPgPhoneOnly(uid);
    if (pgPhone === undefined) return { status: 'unresolved', reason: 'phone_read_failed' };
  }
  if (typeof pgPhone === 'string' && pgPhone.trim()) return { status: 'ok', phone: pgPhone };
  try {
    const record = await fbAdminAuth.getUser(uid);
    const fbPhone = record?.phoneNumber;
    if (typeof fbPhone === 'string' && fbPhone.trim()) return { status: 'ok', phone: fbPhone };
    return { status: 'none' };
  } catch (e: any) {
    logger.warn('[TwoStepLogin] Firebase phone lookup failed', { uid, code: e?.code, error: e?.message });
    return { status: 'unresolved', reason: e?.code || e?.message || 'firebase_lookup_failed' };
  }
}

export type TwoStepLoginDecision =
  /** Mint the session. `reason` says why no challenge was owed. */
  | { action: 'allow'; reason: 'not_enrolled' | 'proof_accepted' | 'state_unreadable' }
  /** 428 — a code can be sent; produce the proof. */
  | { action: 'challenge'; reason: string }
  /** 403 — enrolled, and it is established there is nothing to challenge. */
  | { action: 'no_factor' };

/**
 * The whole 2-step question for a PASSWORD sign-in, in one call.
 *
 * The proof is checked BEFORE the phone is resolved: a member returning with a
 * valid code needs no lookup, and the distinction between "can be challenged"
 * and "cannot" only matters when there is no proof to accept.
 *
 * `unresolved` yields `challenge` — the same 428 the member has always seen. It
 * withholds a session it cannot justify granting without ever claiming the
 * member has no second factor.
 */
export async function decidePasswordLoginTwoStep(
  uid: string,
  mfaToken: unknown,
): Promise<TwoStepLoginDecision> {
  const row = await readTwoStepLoginRow(uid);
  if (row.status === 'unknown') return { action: 'allow', reason: 'state_unreadable' };
  if (row.status === 'not_enrolled') return { action: 'allow', reason: 'not_enrolled' };

  const proof = validateMfaLoginToken(typeof mfaToken === 'string' ? mfaToken : '', uid);
  if (proof.valid) return { action: 'allow', reason: 'proof_accepted' };

  const phone = await resolveTwoFactorPhone(uid, row.pgPhone);
  if (phone.status === 'none') return { action: 'no_factor' };
  return { action: 'challenge', reason: proof.reason || 'missing' };
}
