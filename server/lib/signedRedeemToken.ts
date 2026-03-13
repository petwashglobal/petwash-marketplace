/**
 * Signed Redeem Token — K9000 QR pass security
 *
 * Architecture:
 *   token = base64url(JSON payload) . HMAC-SHA256-base64url
 *
 * Payload schema:
 *   { uid, ps, mid, iat, exp, nonce, v }
 *
 * Properties:
 *   - 45-second TTL (configurable)
 *   - Per-token nonce → single-use (replay-safe)
 *   - Constant-time signature comparison
 *   - Fail-closed if PASS_TOKEN_SECRET missing or < 32 chars
 *
 * CRITICAL: inverted-QR friendly — output is pure ASCII (base64url + '.')
 */

import crypto from 'crypto';
import { logger } from './logger';

const SECRET = process.env.PASS_TOKEN_SECRET || process.env.COOKIE_SECRET || '';

if (SECRET.length < 32) {
  logger.warn(
    '[SignedRedeemToken] PASS_TOKEN_SECRET is missing or too short (<32 chars). ' +
    'K9000 QR token generation will be disabled.',
  );
}

export interface RedeemTokenPayload {
  uid: string;
  ps: string;
  mid: string | null;
  iat: number;
  exp: number;
  nonce: string;
  v: number;
}

export interface RedeemTokenResult {
  valid: boolean;
  payload?: RedeemTokenPayload;
  error?: 'MISSING_SECRET' | 'PARSE_ERROR' | 'EXPIRED' | 'INVALID_SIGNATURE' | 'REPLAYED';
}

// ─── Nonce blacklist ─────────────────────────────────────────────────────────
// Lightweight in-process blacklist. Nonces expire naturally after 2 × TTL.
// In multi-instance Cloud Run, replace with a short-TTL Redis SET.
const usedNonces = new Map<string, number>(); // nonce → expiresAtMs

function purgeExpiredNonces() {
  const now = Date.now();
  for (const [nonce, exp] of usedNonces) {
    if (now > exp) usedNonces.delete(nonce);
  }
}

// Purge every 5 minutes to cap memory usage
setInterval(purgeExpiredNonces, 5 * 60 * 1000).unref();

// ─── Generation ──────────────────────────────────────────────────────────────

export interface GenerateRedeemTokenOptions {
  userId: string;
  passSerial: string;
  machineId?: string | null;
  ttlSeconds?: number;
}

export function generateSignedRedeemToken(opts: GenerateRedeemTokenOptions): string | null {
  if (SECRET.length < 32) return null;

  const now = Math.floor(Date.now() / 1000);
  const payload: RedeemTokenPayload = {
    uid: String(opts.userId),
    ps: String(opts.passSerial),
    mid: opts.machineId ? String(opts.machineId) : null,
    iat: now,
    exp: now + (opts.ttlSeconds ?? 45),
    nonce: crypto.randomUUID(),
    v: 1,
  };

  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto
    .createHmac('sha256', SECRET)
    .update(payloadB64)
    .digest('base64url');

  return `${payloadB64}.${sig}`;
}

// ─── Verification ─────────────────────────────────────────────────────────────

export function verifySignedRedeemToken(token: string): RedeemTokenResult {
  if (SECRET.length < 32) {
    return { valid: false, error: 'MISSING_SECRET' };
  }

  try {
    const dotIdx = token.lastIndexOf('.');
    if (dotIdx < 1) return { valid: false, error: 'PARSE_ERROR' };

    const payloadB64 = token.slice(0, dotIdx);
    const sig = token.slice(dotIdx + 1);

    // Constant-time signature check
    const expected = crypto
      .createHmac('sha256', SECRET)
      .update(payloadB64)
      .digest('base64url');

    const expectedBuf = Buffer.from(expected);
    const sigBuf = Buffer.from(sig);
    if (
      expectedBuf.length !== sigBuf.length ||
      !crypto.timingSafeEqual(expectedBuf, sigBuf)
    ) {
      return { valid: false, error: 'INVALID_SIGNATURE' };
    }

    // Decode payload
    const payload: RedeemTokenPayload = JSON.parse(
      Buffer.from(payloadB64, 'base64url').toString('utf8'),
    );

    // Check expiry
    if (Math.floor(Date.now() / 1000) > payload.exp) {
      return { valid: false, error: 'EXPIRED' };
    }

    // Nonce replay check
    purgeExpiredNonces();
    if (usedNonces.has(payload.nonce)) {
      return { valid: false, error: 'REPLAYED' };
    }

    return { valid: true, payload };
  } catch {
    return { valid: false, error: 'PARSE_ERROR' };
  }
}

/**
 * Mark a nonce as consumed. Call this AFTER successfully authorising the wash.
 * ttlMs should be at least 2× the token TTL so the entry outlives any clock skew.
 */
export function consumeNonce(nonce: string, ttlMs = 120_000) {
  usedNonces.set(nonce, Date.now() + ttlMs);
}
