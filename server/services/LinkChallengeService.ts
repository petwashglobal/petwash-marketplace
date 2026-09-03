/**
 * LinkChallengeService — auth-rebuild Phase 6.c
 *
 * Issues + verifies short-lived HMAC-signed challenge tokens for the
 * account-linking two-step handshake (D6):
 *
 *   1. POST /api/identity/link/initiate
 *      Server verifies the OTHER-provider Firebase ID token, then
 *      issues a challenge token bound to (uid, provider,
 *      providerAccountId, email).
 *
 *   2. POST /api/identity/link/confirm
 *      Client returns the challenge token unchanged. Server verifies
 *      HMAC + TTL, then writes identity_accounts via
 *      linkAdditionalProvider() (never loginOrLink from an authenticated
 *      context).
 *
 * Model matches StepUpService: opaque token; stateless verification;
 * MAC bound to (uid, provider, providerAccountId, email) so it can't
 * be reused across identities. TTL 5 min.
 *
 * Secret: reads LINK_CHALLENGE_HMAC_SECRET. Falls back to
 * STEP_UP_HMAC_SECRET so single-secret deployments still work in
 * dev; production MUST set both distinct.
 *
 * Fail CLOSED if neither secret is set.
 */
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { logger } from '../lib/logger';

const DEFAULT_TTL_SECONDS = 5 * 60;
const TOKEN_VERSION = 'v1';

export interface LinkChallenge {
  uid: string;
  provider: string;
  providerAccountId: string;
  email: string | null;
  emailVerified: boolean;
}

interface DecodedChallenge extends LinkChallenge {
  version: string;
  issuedAt: number;
  expiresAt: number;
  nonce: string;
}

function loadSecret(): string {
  const raw = process.env.LINK_CHALLENGE_HMAC_SECRET || process.env.STEP_UP_HMAC_SECRET || '';
  if (!raw || raw.length < 32) {
    logger.error('[LinkChallengeService] no valid HMAC secret — service is CLOSED');
    return '';
  }
  return raw;
}

function b64url(buf: Buffer): string {
  return buf.toString('base64url');
}
function fromB64url(s: string): Buffer {
  return Buffer.from(s, 'base64url');
}
function sign(payload: string, secret: string): string {
  return b64url(createHmac('sha256', secret).update(payload, 'utf8').digest());
}

// Encode a nullable string as an empty-marker so the payload columns
// are always positional.
function enc(v: string | null): string {
  return v == null ? '' : encodeURIComponent(v);
}
function dec(v: string): string | null {
  if (v === '') return null;
  return decodeURIComponent(v);
}

/**
 * Issue a challenge token binding the signed-in user's uid to the
 * OTHER-provider identity they proved control of. TTL 5 min.
 * Returns null when the service is misconfigured (no secret) — the
 * caller must fail-CLOSED.
 */
export function issueLinkChallenge(
  challenge: LinkChallenge,
  ttlSeconds: number = DEFAULT_TTL_SECONDS,
): { token: string; expiresAt: Date } | null {
  const secret = loadSecret();
  if (!secret) return null;
  if (!challenge.uid || !challenge.provider || !challenge.providerAccountId) return null;

  const now = Math.floor(Date.now() / 1000);
  const ttl = Math.max(30, Math.min(15 * 60, ttlSeconds));
  const expiresAt = now + ttl;
  const nonce = b64url(randomBytes(12));

  const payload = [
    TOKEN_VERSION,
    challenge.uid,
    challenge.provider,
    challenge.providerAccountId,
    enc(challenge.email),
    challenge.emailVerified ? '1' : '0',
    String(now),
    String(expiresAt),
    nonce,
  ].join('.');
  const mac = sign(payload, secret);
  const token = `${b64url(Buffer.from(payload, 'utf8'))}.${mac}`;

  logger.info('[LinkChallengeService] challenge issued', {
    uid: challenge.uid,
    provider: challenge.provider,
    expiresAt: new Date(expiresAt * 1000).toISOString(),
  });

  return { token, expiresAt: new Date(expiresAt * 1000) };
}

export type VerifyLinkResult =
  | { ok: true; challenge: LinkChallenge }
  | { ok: false; reason: 'NO_SECRET' | 'MALFORMED' | 'MAC_MISMATCH' | 'UID_MISMATCH' | 'EXPIRED' };

/**
 * Verify a challenge token issued by issueLinkChallenge. Also
 * enforces that the token was issued to the currently-signed-in
 * `callerUid` — a challenge minted for user A cannot be used by
 * user B even if leaked.
 */
export function verifyLinkChallenge(
  token: string | null | undefined,
  callerUid: string,
): VerifyLinkResult {
  const secret = loadSecret();
  if (!secret) return { ok: false, reason: 'NO_SECRET' };
  if (!token || typeof token !== 'string' || !callerUid) return { ok: false, reason: 'MALFORMED' };

  try {
    const parts = token.split('.');
    if (parts.length !== 2) return { ok: false, reason: 'MALFORMED' };
    const [payloadB64, macB64] = parts;
    const payload = fromB64url(payloadB64).toString('utf8');
    const expectedMac = sign(payload, secret);
    const provided = Buffer.from(macB64, 'utf8');
    const expected = Buffer.from(expectedMac, 'utf8');
    if (provided.length !== expected.length) return { ok: false, reason: 'MAC_MISMATCH' };
    if (!timingSafeEqual(provided, expected)) return { ok: false, reason: 'MAC_MISMATCH' };

    const fields = payload.split('.');
    if (fields.length !== 9) return { ok: false, reason: 'MALFORMED' };
    const decoded: DecodedChallenge = {
      version: fields[0],
      uid: fields[1],
      provider: fields[2],
      providerAccountId: fields[3],
      email: dec(fields[4]),
      emailVerified: fields[5] === '1',
      issuedAt: Number(fields[6]),
      expiresAt: Number(fields[7]),
      nonce: fields[8],
    };
    if (decoded.version !== TOKEN_VERSION) return { ok: false, reason: 'MALFORMED' };
    if (!Number.isFinite(decoded.expiresAt)) return { ok: false, reason: 'MALFORMED' };
    if (decoded.uid !== callerUid) return { ok: false, reason: 'UID_MISMATCH' };
    if (Math.floor(Date.now() / 1000) >= decoded.expiresAt) return { ok: false, reason: 'EXPIRED' };

    return {
      ok: true,
      challenge: {
        uid: decoded.uid,
        provider: decoded.provider,
        providerAccountId: decoded.providerAccountId,
        email: decoded.email,
        emailVerified: decoded.emailVerified,
      },
    };
  } catch {
    return { ok: false, reason: 'MALFORMED' };
  }
}
