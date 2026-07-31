/**
 * MFA (2-step login) proof token — the cryptographic bridge between
 * POST /api/auth/login/2fa/verify (a fresh SMS code was matched) and
 * POST /api/auth/session (session minted). For a member who OPTED IN to 2-step
 * login (users.two_factor_enabled = true), /api/auth/session refuses to mint a
 * PASSWORD-login session without this unforgeable proof that a one-time code was
 * just matched — so a stolen password alone can't sign in. Mirrors
 * emailVerifiedToken; the proof is bound to the uid so a code for user A can
 * never authorize user B.
 *
 * Token = base64url( "<uid>:<nonce>:<issuedAtMs>:<hmac>" )
 *   hmac = HMAC-SHA256( "<uid>:<nonce>:<issuedAtMs>", COOKIE_SECRET )
 *
 * Short-lived (5 min). Signature checked with a timing-safe compare.
 * (CEO 2026-07-31 "user can choose one-way or two-way verification".)
 */
import crypto from 'crypto';
import { logger } from './logger';

const TTL_MS = 5 * 60 * 1000; // 5 minutes

const COOKIE_SECRET: string =
  process.env.COOKIE_SECRET ||
  (() => {
    if (process.env.NODE_ENV === 'production') {
      logger.error('[mfaLoginToken] CRITICAL: COOKIE_SECRET not set in production — set it immediately.');
    }
    return crypto.randomBytes(32).toString('hex');
  })();

/** Mint a 2-step-login proof token for a uid whose SMS code was just matched. */
export function mintMfaLoginToken(uid: string): string {
  const nonce = crypto.randomBytes(12).toString('hex');
  const issuedAt = Date.now();
  const payload = `${uid}:${nonce}:${issuedAt}`;
  const hmac = crypto.createHmac('sha256', COOKIE_SECRET).update(payload).digest('hex');
  return Buffer.from(`${payload}:${hmac}`, 'utf8').toString('base64url');
}

/**
 * Validate a proof token. Returns valid:true only if the signature + TTL pass
 * AND the token was minted for exactly `expectedUid`.
 */
export function validateMfaLoginToken(token: string, expectedUid: string): { valid: boolean; reason?: string } {
  if (!token || typeof token !== 'string') return { valid: false, reason: 'missing' };
  if (!expectedUid) return { valid: false, reason: 'no_uid' };
  let decoded: string;
  try {
    decoded = Buffer.from(token, 'base64url').toString('utf8');
  } catch {
    return { valid: false, reason: 'malformed' };
  }
  const parts = decoded.split(':');
  if (parts.length < 4) return { valid: false, reason: 'malformed' };
  // Split from the right so a uid containing unexpected characters can't break parsing.
  const hmac = parts.pop()!;
  const issuedAtStr = parts.pop()!;
  const nonce = parts.pop()!;
  const uid = parts.join(':');
  const issuedAt = Number(issuedAtStr);
  if (!uid || !nonce || !Number.isFinite(issuedAt)) return { valid: false, reason: 'malformed' };

  const expected = crypto.createHmac('sha256', COOKIE_SECRET).update(`${uid}:${nonce}:${issuedAt}`).digest('hex');
  let signatureOk = false;
  try {
    signatureOk = hmac.length === expected.length &&
      crypto.timingSafeEqual(Buffer.from(hmac), Buffer.from(expected));
  } catch {
    signatureOk = false;
  }
  if (!signatureOk) return { valid: false, reason: 'bad_signature' };
  if (Date.now() - issuedAt > TTL_MS) return { valid: false, reason: 'expired' };
  // Bind the proof to the authenticated user — a code matched for one uid must
  // not authorize a session for another.
  let uidOk = false;
  try {
    uidOk = uid.length === expectedUid.length &&
      crypto.timingSafeEqual(Buffer.from(uid), Buffer.from(expectedUid));
  } catch {
    uidOk = false;
  }
  if (!uidOk) return { valid: false, reason: 'uid_mismatch' };

  return { valid: true };
}
