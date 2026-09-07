/**
 * Email-verified proof token — the cryptographic bridge between
 * POST /api/auth/email/verify (code matched) and POST /api/auth/email-session
 * (session minted). Mirrors the phone flow's verificationToken so that
 * email-session can NEVER mint a login from a bare { email } — it requires
 * unforgeable proof that the 6-digit code was actually matched moments earlier.
 *
 * Token = base64url( "<email>:<purpose>:<nonce>:<issuedAtMs>:<hmac>" )
 *   hmac = HMAC-SHA256( "<email>:<purpose>:<nonce>:<issuedAtMs>", COOKIE_SECRET )
 *
 * THE PURPOSE IS PART OF THE SIGNATURE. 2026-09-08: it used to bind only the
 * address, so the proof minted from a `signup` code and the proof minted from
 * a `login` code were byte-interchangeable. Nothing downstream could tell what
 * the customer had actually been asked to confirm. The only thing keeping that
 * from becoming a cross-purpose hole was the route's `z.enum(['signup','login'])`
 * — an allowlist, one line away from someone adding a third purpose and
 * silently making a "confirm your email" code spend as something else.
 *
 * A one-time code means nothing on its own. It is only ever evidence that the
 * holder of THIS address agreed to THIS action at THIS moment, and all three
 * have to survive into whatever the code authorises.
 *
 * Short-lived (5 min). Signature checked with a timing-safe compare.
 *
 * SINGLE-USE. 2026-09-08: the underlying OTP challenge is consumed on verify,
 * so a token is minted once per matched code — but the TOKEN is a bearer
 * credential, and until now it could be presented again and again until the
 * TTL lapsed. A leaked or intercepted proof minted more than one session
 * inside its window. `redeemEmailVerifiedToken` now burns the nonce through
 * the shared one-shot store, so the second presentation is refused even inside
 * the TTL — the property the step-up side already guaranteed, and the auth
 * side did not.
 *
 * Two functions, deliberately:
 *   validateEmailVerifiedToken   inspect only. Never burns. Safe to call twice.
 *   redeemEmailVerifiedToken     inspect AND burn. The one to call at the point
 *                                of use, exactly once, before any side effect.
 */
import crypto from 'crypto';
import { logger } from './logger';
import { consumeOneShotProof } from './oneShotProof';

const TTL_MS = 5 * 60 * 1000; // 5 minutes

const COOKIE_SECRET: string =
  process.env.COOKIE_SECRET ||
  (() => {
    if (process.env.NODE_ENV === 'production') {
      // Never silently use an ephemeral key in prod — that would make tokens
      // un-verifiable across instances/restarts (login would intermittently fail).
      logger.error('[emailVerifiedToken] CRITICAL: COOKIE_SECRET not set in production — set it immediately.');
    }
    return crypto.randomBytes(32).toString('hex');
  })();

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** What the customer was asked to confirm when the code was sent. */
export type EmailVerifiedPurpose = 'signup' | 'login';

/** Mint a proof token for an email whose 6-digit code was just matched. */
export function mintEmailVerifiedToken(email: string, purpose: EmailVerifiedPurpose): string {
  const e = normalizeEmail(email);
  const nonce = crypto.randomBytes(12).toString('hex');
  const issuedAt = Date.now();
  const payload = `${e}:${purpose}:${nonce}:${issuedAt}`;
  const hmac = crypto.createHmac('sha256', COOKIE_SECRET).update(payload).digest('hex');
  return Buffer.from(`${payload}:${hmac}`, 'utf8').toString('base64url');
}

/**
 * Why a refusal happened. Kept distinct on purpose: `already_used` is a REPLAY
 * and `expired` is a TIMEOUT, and support cannot tell a customer which one
 * they hit if both arrive as "invalid". `store_unavailable` is neither — it is
 * us, and it deserves a 503 rather than blaming the customer's code.
 */
export type EmailProofRefusal =
  | 'missing'
  | 'malformed'
  | 'purpose_missing'
  | 'no_accepted_purposes'
  | 'bad_signature'
  | 'expired'
  | 'purpose_mismatch'
  | 'already_used'
  | 'store_unavailable';

export interface ValidatedEmailProof {
  valid: boolean;
  email?: string;
  purpose?: EmailVerifiedPurpose;
  /** The proof's unique id. Present only on a valid proof; this is what gets burnt. */
  nonce?: string;
  /** Epoch ms at which the proof stops being valid. Sizes the one-shot marker. */
  expiresAt?: number;
  reason?: EmailProofRefusal;
}

/**
 * Validate a proof token.
 *
 * `acceptedPurposes` is REQUIRED at every call site, and is a LIST because
 * some consumers legitimately take more than one — /api/auth/email-session
 * mints a session and both `signup` and `login` are honest ways to arrive
 * there. Enumerating them is the point: a consumer that does not know what
 * the code was for cannot decide whether it authorises the thing it is about
 * to do, and "valid signature" is not the same question as "valid for this".
 *
 * INSPECTION ONLY — this does NOT spend the token, so it is safe to call more
 * than once on the same proof. Anything that acts on the answer must call
 * `redeemEmailVerifiedToken` instead, which burns the nonce atomically.
 */
export function validateEmailVerifiedToken(
  token: string,
  acceptedPurposes: readonly EmailVerifiedPurpose[],
): ValidatedEmailProof {
  if (!Array.isArray(acceptedPurposes) || acceptedPurposes.length === 0) {
    // Refuse to answer "is this valid?" without being told valid FOR WHAT.
    return { valid: false, reason: 'no_accepted_purposes' };
  }
  if (!token || typeof token !== 'string') return { valid: false, reason: 'missing' };
  let decoded: string;
  try {
    decoded = Buffer.from(token, 'base64url').toString('utf8');
  } catch {
    return { valid: false, reason: 'malformed' };
  }
  const parts = decoded.split(':');
  // email : purpose : nonce : issuedAt : hmac  -> at least 5 once the address
  // is allowed to contain ':' itself (it is rejected below, but parse safely).
  if (parts.length < 5) {
    // A 4-part token is the pre-2026-09-08 format, which carried no purpose.
    // Refused rather than accepted-and-assumed: an unbound proof is exactly
    // what this change exists to stop. Tokens live 5 minutes, so the only
    // people affected are mid-flow across the deploy, and a resend fixes it.
    return { valid: false, reason: parts.length === 4 ? 'purpose_missing' : 'malformed' };
  }
  // Split from the right so an email containing unexpected characters can't break parsing.
  const hmac = parts.pop()!;
  const issuedAtStr = parts.pop()!;
  const nonce = parts.pop()!;
  const purpose = parts.pop()! as EmailVerifiedPurpose;
  const email = parts.join(':');
  const issuedAt = Number(issuedAtStr);
  if (!email || !nonce || !purpose || !Number.isFinite(issuedAt)) return { valid: false, reason: 'malformed' };

  const expected = crypto.createHmac('sha256', COOKIE_SECRET).update(`${email}:${purpose}:${nonce}:${issuedAt}`).digest('hex');
  let signatureOk = false;
  try {
    signatureOk = hmac.length === expected.length &&
      crypto.timingSafeEqual(Buffer.from(hmac), Buffer.from(expected));
  } catch {
    signatureOk = false;
  }
  if (!signatureOk) return { valid: false, reason: 'bad_signature' };

  if (Date.now() - issuedAt > TTL_MS) return { valid: false, reason: 'expired' };

  // Signature verified, so `purpose` is now trustworthy — check it says what
  // the caller needs. A signup proof must not settle a login, or vice versa.
  if (!acceptedPurposes.includes(purpose)) {
    return { valid: false, reason: 'purpose_mismatch' };
  }

  return { valid: true, email, purpose, nonce, expiresAt: issuedAt + TTL_MS };
}

/**
 * Redeem a proof: validate it, then SPEND it. Returns valid:true at most once
 * per minted token, no matter how many callers race for it.
 *
 * This is the call every consumer that ACTS on a proof must make — minting a
 * session, attaching a verified address. `validateEmailVerifiedToken` answers
 * "is this genuine?"; only this one answers "and is it still unspent, and it
 * is now mine".
 *
 * ORDER MATTERS. The burn happens BEFORE the caller's side effect, not after.
 * Burning afterwards leaves exactly the window this closes: two concurrent
 * requests both validate, both act, and only then does one of them lose the
 * race. The cost of burning first is that a proof spent on a request that then
 * fails downstream is gone — which is the correct behaviour for a one-use
 * credential, and the customer's remedy is the one they already have: request
 * a new code.
 *
 * FAIL-CLOSED. If the one-shot store cannot be reached the proof is refused
 * (`store_unavailable`), never accepted. Same trade StepUpService makes on the
 * money path. It is a real availability dependency for email sign-in and it is
 * stated plainly rather than hidden: a proof whose replay status cannot be
 * established is not a proof.
 */
export async function redeemEmailVerifiedToken(
  token: string,
  acceptedPurposes: readonly EmailVerifiedPurpose[],
): Promise<ValidatedEmailProof> {
  const checked = validateEmailVerifiedToken(token, acceptedPurposes);
  if (!checked.valid || !checked.nonce || !checked.expiresAt) return checked;

  const remainingSeconds = Math.ceil((checked.expiresAt - Date.now()) / 1000);
  const burn = await consumeOneShotProof({
    scope: 'emailproof',
    id: checked.nonce,
    ttlSeconds: remainingSeconds,
    // Purpose only. The address is NOT copied into the log line — the
    // challenge row is its one authoritative home.
    context: { purpose: checked.purpose },
  });

  if (!burn.ok) {
    const reason: EmailProofRefusal =
      burn.reason === 'store_unavailable' ? 'store_unavailable'
      : burn.reason === 'expired' ? 'expired'
      : 'already_used';
    logger.warn('[emailVerifiedToken] proof refused at redemption', { reason, purpose: checked.purpose });
    return { valid: false, reason };
  }

  return checked;
}
