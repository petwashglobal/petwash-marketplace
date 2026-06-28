/**
 * Email-verified proof token — the cryptographic bridge between
 * POST /api/auth/email/verify (code matched) and POST /api/auth/email-session
 * (session minted). Mirrors the phone flow's verificationToken so that
 * email-session can NEVER mint a login from a bare { email } — it requires
 * unforgeable proof that the 6-digit code was actually matched moments earlier.
 *
 * Token = base64url( "<email>:<nonce>:<issuedAtMs>:<hmac>" )
 *   hmac = HMAC-SHA256( "<email>:<nonce>:<issuedAtMs>", COOKIE_SECRET )
 *
 * Short-lived (5 min). Signature checked with a timing-safe compare. Single
 * legitimate use in practice — the underlying OTP challenge is consumed on
 * verify, so a token is only ever minted once per matched code.
 */
import crypto from 'crypto';
import { logger } from './logger';

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

/** Mint a proof token for an email whose 6-digit code was just matched. */
export function mintEmailVerifiedToken(email: string): string {
  const e = normalizeEmail(email);
  const nonce = crypto.randomBytes(12).toString('hex');
  const issuedAt = Date.now();
  const payload = `${e}:${nonce}:${issuedAt}`;
  const hmac = crypto.createHmac('sha256', COOKIE_SECRET).update(payload).digest('hex');
  return Buffer.from(`${payload}:${hmac}`, 'utf8').toString('base64url');
}

/** Validate a proof token. Returns the verified email only if signature + TTL pass. */
export function validateEmailVerifiedToken(token: string): { valid: boolean; email?: string; reason?: string } {
  if (!token || typeof token !== 'string') return { valid: false, reason: 'missing' };
  let decoded: string;
  try {
    decoded = Buffer.from(token, 'base64url').toString('utf8');
  } catch {
    return { valid: false, reason: 'malformed' };
  }
  const parts = decoded.split(':');
  if (parts.length < 4) return { valid: false, reason: 'malformed' };
  // Split from the right so an email containing unexpected characters can't break parsing.
  const hmac = parts.pop()!;
  const issuedAtStr = parts.pop()!;
  const nonce = parts.pop()!;
  const email = parts.join(':');
  const issuedAt = Number(issuedAtStr);
  if (!email || !nonce || !Number.isFinite(issuedAt)) return { valid: false, reason: 'malformed' };

  const expected = crypto.createHmac('sha256', COOKIE_SECRET).update(`${email}:${nonce}:${issuedAt}`).digest('hex');
  let signatureOk = false;
  try {
    signatureOk = hmac.length === expected.length &&
      crypto.timingSafeEqual(Buffer.from(hmac), Buffer.from(expected));
  } catch {
    signatureOk = false;
  }
  if (!signatureOk) return { valid: false, reason: 'bad_signature' };

  if (Date.now() - issuedAt > TTL_MS) return { valid: false, reason: 'expired' };

  return { valid: true, email };
}
