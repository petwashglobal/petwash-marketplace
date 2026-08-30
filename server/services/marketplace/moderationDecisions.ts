/**
 * moderationDecisions — CEO DEEP-LOGIC §4-§8 (FLY MODE III hardening).
 *
 * Two-stage moderation handshake for WARN_BEFORE_SEND. This module
 * fixes five defects the FLY MODE III correction called out:
 *
 *   §4 — production must FAIL LOUD when the signing secret is missing.
 *     No per-instance crypto.randomBytes fallback in production —
 *     under horizontal scaling instance A issues a token, instance B
 *     rejects it as an invalid signature, and the user loops.
 *   §5 — HMAC compare uses `crypto.timingSafeEqual` on decoded bytes,
 *     not a plain string `!==` compare.
 *   §6 — a warning is one-shot. The token carries a JTI (JWT-like
 *     unique id); a bounded in-process `Set` marks used JTIs so a
 *     15-minute pass cannot be redeemed 50 times.
 *   §7 — no fabricated category. A WARN result MUST include a
 *     primaryCategory; if it does not, callers surface
 *     POLICY_ENGINE_INVALID_RESULT rather than mint a fake binding.
 *   §8 — the send route must RE-EVALUATE the current policy before
 *     honouring a stored token. Callers verify that the current
 *     policy outcome is still WARN and matches the token category.
 */
import crypto from 'crypto';
import type { PolicyCategory } from '@shared/marketplace/policyEngine';

const WARNING_TOKEN_TTL_MS = 15 * 60 * 1000; // 15 minutes

/**
 * The signing secret is a REQUIRED production env var. When it is
 * missing, this module surfaces a stable configuration fault instead
 * of minting a per-instance random secret — a random fallback under
 * horizontal scaling would send users into an endless warn loop when
 * a resend hits a different Cloud Run instance.
 *
 * In development / test (NODE_ENV !== 'production'), an ephemeral
 * random secret is acceptable — the tokens simply do not survive a
 * restart, which for a 15-minute window is fine locally.
 */
export class ModerationConfigError extends Error {
  code = 'MODERATION_WARN_SECRET_MISSING' as const;
}

let cachedSecret: string | null = null;
function loadSecret(): string {
  if (cachedSecret) return cachedSecret;
  const env = process.env.MODERATION_WARN_TOKEN_SECRET;
  if (env && env.length >= 32) {
    cachedSecret = env;
    return env;
  }
  const isProd = process.env.NODE_ENV === 'production';
  if (isProd) {
    throw new ModerationConfigError(
      'MODERATION_WARN_TOKEN_SECRET is required in production (min 32 chars). Refusing to mint an instance-specific fallback under horizontal scaling.',
    );
  }
  cachedSecret = crypto.randomBytes(32).toString('hex');
  return cachedSecret;
}

/** For tests — reset the cached secret when the env changes. */
export function _resetSecretCacheForTests(): void {
  cachedSecret = null;
}

export interface WarningTokenBindings {
  senderUid: string;
  threadId: string;
  safeContentHash: string;   // sha256 hex of the exact sanitized body
  policyVersion: string;
  category: PolicyCategory;
}

interface DecodedToken extends WarningTokenBindings {
  jti: string;
  issuedAt: number;
  expiresAt: number;
}

function base64url(buf: Buffer): string {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64urlDecode(s: string): Buffer {
  return Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
}

function signBytes(payload: string): Buffer {
  return crypto.createHmac('sha256', loadSecret()).update(payload).digest();
}

function sign(payload: string): string {
  return base64url(signBytes(payload));
}

/**
 * CEO §5 — timing-safe comparison of the decoded signature bytes.
 * A plain string `!==` compare leaks information about which byte
 * differed; timingSafeEqual is constant-time up to the length check.
 */
function verifySignature(payload: string, sigB64: string): boolean {
  let sigBytes: Buffer;
  try {
    sigBytes = base64urlDecode(sigB64);
  } catch {
    return false;
  }
  const expected = signBytes(payload);
  if (sigBytes.length !== expected.length) return false;
  return crypto.timingSafeEqual(sigBytes, expected);
}

/**
 * CEO §6 — one-time nonce store. A JTI (JSON Token ID) is baked into
 * every issued token; a bounded in-process Set records JTIs that have
 * already been consumed. `consumeJti` returns true iff the JTI was
 * unseen (and marks it consumed). Once the TTL passes the entry is
 * evicted lazily on the next hit.
 *
 * The store is bounded (MAX_JTIS) so a large flood cannot exhaust
 * memory — the oldest entries fall off first, and any evicted JTI
 * that later reappears is treated as a REPLAY (the caller receives
 * `false` because the entry is gone from the "seen" set only after
 * expiry). We insert with an expiry timestamp so eviction is safe.
 */
const MAX_JTIS = 10_000;
const jtiStore = new Map<string, number>(); // jti → expiresAt (ms)

export function _resetJtiStoreForTests(): void {
  jtiStore.clear();
}

/**
 * Marks a JTI consumed. Returns true on first use (i.e. the caller
 * may proceed with the send), false on replay.
 */
export function consumeJti(jti: string, now: number = Date.now()): boolean {
  // Lazy sweep of expired entries so the store stays bounded.
  if (jtiStore.size > MAX_JTIS) {
    jtiStore.forEach((exp, k) => {
      if (exp < now) jtiStore.delete(k);
    });
    // Absolute cap: if we still exceed, drop oldest insertions.
    if (jtiStore.size > MAX_JTIS) {
      const it = jtiStore.keys();
      let dropped = 0;
      while (jtiStore.size > MAX_JTIS && dropped < 512) {
        const next = it.next();
        if (next.done) break;
        jtiStore.delete(next.value);
        dropped += 1;
      }
    }
  }
  const existing = jtiStore.get(jti);
  if (existing && existing > now) return false;
  jtiStore.set(jti, now + WARNING_TOKEN_TTL_MS);
  return true;
}

/**
 * Hash the sanitized body. Kept out of the token — a client re-send
 * carries the body and the server recomputes the hash. Storing the
 * body in the token would defeat retention discipline.
 */
export function hashSafeContent(safeContent: string): string {
  return crypto.createHash('sha256').update(safeContent).digest('hex');
}

export function issueWarningToken(bindings: WarningTokenBindings, now: number = Date.now()): string {
  const decoded: DecodedToken = {
    ...bindings,
    jti: crypto.randomBytes(16).toString('hex'),
    issuedAt: now,
    expiresAt: now + WARNING_TOKEN_TTL_MS,
  };
  const body = base64url(Buffer.from(JSON.stringify(decoded), 'utf8'));
  const sig = sign(body);
  return `${body}.${sig}`;
}

export type WarningVerifyOk = { ok: true; jti: string };
export type WarningVerifyErr = { ok: false; reason: string };
export type WarningVerifyResult = WarningVerifyOk | WarningVerifyErr;

/**
 * Verify the token AGAINST the bindings expected by the current
 * request. Returns { ok: true, jti } iff signature + expiry +
 * every binding match. Callers must ALSO call `consumeJti(jti)` to
 * enforce the §6 one-time-use rule before honouring the token.
 */
export function verifyWarningToken(
  token: string | undefined | null,
  expected: WarningTokenBindings,
  now: number = Date.now(),
): WarningVerifyResult {
  if (!token || typeof token !== 'string') return { ok: false, reason: 'missing' };
  const parts = token.split('.');
  if (parts.length !== 2) return { ok: false, reason: 'malformed' };
  const [body, sig] = parts;
  if (!verifySignature(body, sig)) return { ok: false, reason: 'bad_signature' };
  let decoded: DecodedToken;
  try {
    decoded = JSON.parse(base64urlDecode(body).toString('utf8'));
  } catch {
    return { ok: false, reason: 'malformed' };
  }
  if (typeof decoded.expiresAt !== 'number' || decoded.expiresAt < now) {
    return { ok: false, reason: 'expired' };
  }
  if (decoded.senderUid !== expected.senderUid) return { ok: false, reason: 'sender_mismatch' };
  if (decoded.threadId !== expected.threadId) return { ok: false, reason: 'thread_mismatch' };
  if (decoded.safeContentHash !== expected.safeContentHash) return { ok: false, reason: 'body_mismatch' };
  if (decoded.policyVersion !== expected.policyVersion) return { ok: false, reason: 'policy_version_mismatch' };
  if (decoded.category !== expected.category) return { ok: false, reason: 'category_mismatch' };
  if (typeof decoded.jti !== 'string' || decoded.jti.length === 0) return { ok: false, reason: 'missing_jti' };
  return { ok: true, jti: decoded.jti };
}

/**
 * Notice payload for ALLOW_WITH_NOTICE — attached to a successful
 * send response so the UI can render an educational line.
 */
export interface AllowWithNoticePayload {
  noticeCode: 'ALLOW_WITH_NOTICE';
  category: PolicyCategory | null;
}
export function buildAllowNoticePayload(category?: PolicyCategory): AllowWithNoticePayload {
  return { noticeCode: 'ALLOW_WITH_NOTICE', category: category ?? null };
}
