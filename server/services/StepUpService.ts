/**
 * StepUpService — short-lived, purpose-bound re-auth proof (Phase 7, CEO
 * auth-rebuild directive 2026-09-01 §10).
 *
 * Sensitive operations (change mobile / email / bank / payout, delete
 * account, important admin actions, password changes) require FRESH
 * proof of identity — not just the presence of a valid long-lived
 * session cookie. This service issues and verifies that proof.
 *
 * Design:
 *   - After the caller re-authenticates via passkey / password / OTP,
 *     server calls issueStepUpProof(uid, purpose) → returns an HMAC-
 *     signed opaque token with TTL 5 min (configurable).
 *   - Client includes the token as `X-StepUp-Proof: <token>` on the
 *     sensitive request.
 *   - Server verifies via verifyStepUpProof(uid, purpose, token). No
 *     DB write, no Redis round-trip — verification is a pure HMAC
 *     equality + TTL check.
 *   - The token is BOUND to (uid, purpose) — a proof issued for
 *     'change_mobile' cannot be reused for 'delete_account'.
 *
 * Why HMAC (not a DB row):
 *   - Zero storage. No Redis dependency.
 *   - Server can be horizontally scaled without a shared session store
 *     for the step-up proof itself (the base session cookie already
 *     handles horizontal scale).
 *   - Revocation is TTL-only — that's a deliberate simplification: the
 *     proof lives 5 minutes; a stolen proof buys the attacker 5 minutes
 *     of one sensitive action. If shorter-window revocation becomes a
 *     requirement, add a small "revoked proof jti" Redis set later.
 *
 * Secret:
 *   Reads STEP_UP_HMAC_SECRET from env. In production this MUST be
 *   distinct from any other HMAC secret. Fail-CLOSED if missing.
 *
 * This module has ZERO runtime callers today. Phase 7.b wires the
 * middleware into the first sensitive-change route.
 */
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import type { Request, Response, NextFunction } from 'express';
import { logger } from '../lib/logger';

/** Closed set of sensitive operations. Extend deliberately. */
export const STEP_UP_PURPOSES = [
  'change_email',
  'change_mobile',
  'change_password',
  'change_payout',
  'delete_account',
  'link_provider',
  'unlink_provider',
  'admin_dangerous_action',
] as const;
export type StepUpPurpose = (typeof STEP_UP_PURPOSES)[number];

const DEFAULT_TTL_SECONDS = 5 * 60; // 5 minutes
const TOKEN_VERSION = 'v1';

interface DecodedProof {
  version: string;
  uid: string;
  purpose: string;
  issuedAt: number;
  expiresAt: number;
  nonce: string;
}

function loadSecret(): string {
  const raw = process.env.STEP_UP_HMAC_SECRET || '';
  if (!raw || raw.length < 32) {
    // Fail CLOSED — the caller receives false from verifyStepUpProof
    // and cannot issue via issueStepUpProof. We log the misconfig
    // once so ops sees it in the boot line.
    logger.error('[StepUpService] STEP_UP_HMAC_SECRET missing or < 32 chars — step-up service is CLOSED');
    return '';
  }
  return raw;
}

function b64url(input: Buffer): string {
  return input.toString('base64url');
}

function fromB64url(input: string): Buffer {
  return Buffer.from(input, 'base64url');
}

function sign(payload: string, secret: string): string {
  return b64url(createHmac('sha256', secret).update(payload, 'utf8').digest());
}

/**
 * Issue a step-up proof for (uid, purpose). Returns null when the
 * service is misconfigured (no secret) — callers must fail-CLOSED.
 */
export function issueStepUpProof(
  uid: string,
  purpose: StepUpPurpose,
  ttlSeconds: number = DEFAULT_TTL_SECONDS,
): { token: string; expiresAt: Date } | null {
  const secret = loadSecret();
  if (!secret) return null;
  if (!uid || !STEP_UP_PURPOSES.includes(purpose)) return null;

  const now = Math.floor(Date.now() / 1000);
  const ttl = Math.max(30, Math.min(30 * 60, ttlSeconds)); // clamp 30s..30min
  const expiresAt = now + ttl;
  const nonce = b64url(randomBytes(12));

  const payload = [TOKEN_VERSION, uid, purpose, String(now), String(expiresAt), nonce].join('.');
  const mac = sign(payload, secret);
  const token = `${b64url(Buffer.from(payload, 'utf8'))}.${mac}`;

  logger.info('[StepUpService] Step-up proof issued', {
    uid,
    purpose,
    expiresAt: new Date(expiresAt * 1000).toISOString(),
  });

  return { token, expiresAt: new Date(expiresAt * 1000) };
}

/**
 * Verify a step-up proof. Returns true only when:
 *   - service is configured (secret present)
 *   - token is well-formed
 *   - MAC verifies in constant time
 *   - decoded uid matches the passed uid
 *   - decoded purpose matches the passed purpose
 *   - now < expiresAt
 * Any other case returns false. Never throws.
 */
export function verifyStepUpProof(
  uid: string,
  purpose: StepUpPurpose,
  token: string | null | undefined,
): boolean {
  const secret = loadSecret();
  if (!secret) return false;
  if (!token || !uid || !STEP_UP_PURPOSES.includes(purpose)) return false;

  try {
    const parts = token.split('.');
    if (parts.length !== 2) return false;
    const [payloadB64, macB64] = parts;
    const payload = fromB64url(payloadB64).toString('utf8');
    const expectedMac = sign(payload, secret);
    // Constant-time compare — reject on length mismatch first.
    const providedMac = Buffer.from(macB64, 'utf8');
    const expected = Buffer.from(expectedMac, 'utf8');
    if (providedMac.length !== expected.length) return false;
    if (!timingSafeEqual(providedMac, expected)) return false;

    // MAC verified — now decode + check claims.
    const fields = payload.split('.');
    if (fields.length !== 6) return false;
    const decoded: DecodedProof = {
      version: fields[0],
      uid: fields[1],
      purpose: fields[2],
      issuedAt: Number(fields[3]),
      expiresAt: Number(fields[4]),
      nonce: fields[5],
    };
    if (decoded.version !== TOKEN_VERSION) return false;
    if (decoded.uid !== uid) return false;
    if (decoded.purpose !== purpose) return false;
    if (!Number.isFinite(decoded.expiresAt)) return false;
    if (Math.floor(Date.now() / 1000) >= decoded.expiresAt) return false;

    return true;
  } catch {
    return false;
  }
}

/**
 * Express middleware that requires a valid step-up proof for the given
 * purpose. Reads the token from `X-StepUp-Proof`. Requires req.firebaseUser.
 * On failure returns 401 { error: 'STEP_UP_REQUIRED', purpose }.
 *
 * Usage: mount BEFORE the sensitive handler.
 *
 *   router.post('/api/me/change-mobile',
 *     validateFirebaseToken,
 *     requireStepUp('change_mobile'),
 *     changeMobileHandler,
 *   );
 */
export function requireStepUp(purpose: StepUpPurpose) {
  return function stepUpMiddleware(req: Request, res: Response, next: NextFunction) {
    const uid = req.firebaseUser?.uid;
    if (!uid) return res.status(401).json({ error: 'AUTH_REQUIRED' });
    const token = (req.headers['x-stepup-proof'] as string) || undefined;
    if (!verifyStepUpProof(uid, purpose, token || null)) {
      logger.warn('[StepUpService] Step-up denied', { uid, purpose, hasToken: !!token });
      return res.status(401).json({
        error: 'STEP_UP_REQUIRED',
        purpose,
        hint: 'Re-authenticate with your passkey or password, then include the returned X-StepUp-Proof header.',
      });
    }
    return next();
  };
}
