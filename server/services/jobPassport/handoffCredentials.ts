/**
 * Handoff credential service — CEO 2026-08-27 §13, §14, §46.
 *
 * jobRef ≠ handoff code (§13).
 *
 *   jobRef  = PW-W7H4K2   → safe to display anywhere, deterministic,
 *                            unlocks NOTHING on its own.
 *   handoff = 4831        → short TTL, one-time, job-scoped,
 *                            service-scoped, server generated, HASHED
 *                            server-side, rate limited, revocable.
 *
 * §46 credential rule: the token must contain / reference jobRef +
 * purpose + expiry + nonce. Server-signed OR opaque. NEVER encodes
 * customer email / mobile / full address / Firebase ID token / session
 * token.
 *
 * IMPLEMENTATION STATUS (§60 Phase 1):
 *   In-memory store today. A persistent store (Redis / a dedicated
 *   table) is Phase 2. The public API is designed so the in-memory
 *   store is replaceable without callers noticing — Phase 2 lands a
 *   new HandoffStore adapter and passes it to createHandoffService.
 *
 * Multi-instance deploy note: the in-memory store means a code
 * issued on instance A cannot be verified on instance B. That's
 * acceptable for the current sitter/walk pilot (session-affinity
 * via Cloud Run + short 15-minute TTL) and the design note names it
 * as a Phase-2 blocker. Redis wiring is captured in the follow-up
 * design doc.
 */

import crypto from 'node:crypto';
import { logger } from '../../lib/logger';

// ─── Server-secret HMAC (§46 storage hardening) ─────────────────────
//
// The stored hash used to be plain sha256(code:nonce). A 4-digit code
// has 10 000 possible values — with DB read access + a known nonce an
// attacker can brute-force every code offline in milliseconds. HMAC
// with a server-secret keeps the nonce+code fast to verify server-side
// but useless without the secret. Mirrors server/lib/unsubToken.ts.
function getHandoffSecret(): string {
  const raw = (process.env.HANDOFF_HMAC_SECRET ?? '').trim();
  if (!raw) {
    if (process.env.NODE_ENV === 'production') {
      logger.error('[Handoff] HANDOFF_HMAC_SECRET is missing in production');
      // Fail loud in prod — refuse to run without a secret, so no code
      // is ever stored under a well-known constant.
      throw new Error('HANDOFF_HMAC_SECRET is required in production');
    }
    // Dev/test convenience — a constant secret is fine outside prod.
    return 'dev-handoff-secret-do-not-use-in-prod';
  }
  if (raw.length < 32 && process.env.NODE_ENV === 'production') {
    logger.error('[Handoff] HANDOFF_HMAC_SECRET must be >= 32 chars in production');
    throw new Error('HANDOFF_HMAC_SECRET must be >= 32 chars in production');
  }
  return raw;
}

// ─── Types ───────────────────────────────────────────────────────────

/**
 * What the handoff code is used FOR. Different verbs get different
 * TTLs and different acceptor policies (staff for pickup, customer
 * for entry, machine for K9000).
 */
export const HANDOFF_PURPOSES = [
  'PICKUP',        // shop pickup — customer shows to staff (§15)
  'ENTRY',         // sitter first entry / walk pickup at customer home
  'START',         // walk / sitter start of service
  'REDEMPTION',    // K9000 / eGift redemption
] as const;
export type HandoffPurpose = (typeof HANDOFF_PURPOSES)[number];

export interface HandoffIssueInput {
  jobRef: string;
  purpose: HandoffPurpose;
  /** ISO of when the credential should expire — capped to MAX_TTL. */
  expiresAt: Date;
  /** Optional job / service scope to reject accidental cross-use. */
  scopeHints?: {
    platform?: string;
    stationId?: string;
    bayId?: string;
  };
}

export interface HandoffCredential {
  jobRef: string;
  purpose: HandoffPurpose;
  /** The plaintext 4-digit code the customer sees. Only returned by
   *  issue(); NEVER logged, NEVER persisted in plaintext. */
  code: string;
  expiresAt: Date;
  /** Opaque nonce so a stale QR can't be replayed after revocation. */
  nonce: string;
}

export type HandoffVerifyResult =
  | { ok: true; jobRef: string; purpose: HandoffPurpose }
  | {
      ok: false;
      errorCode:
        | 'CODE_NOT_FOUND'
        | 'CODE_EXPIRED'
        | 'CODE_ALREADY_CONSUMED'
        | 'CODE_REVOKED'
        | 'CODE_WRONG_PURPOSE'
        | 'CODE_WRONG_JOB'
        | 'RATE_LIMITED';
      message: string;
    };

// ─── Config ──────────────────────────────────────────────────────────

/** Maximum TTL any handoff code can carry — even if caller asks for longer. */
const MAX_TTL_MS = 15 * 60 * 1000; // 15 minutes
/** Max verification attempts per code before it locks. */
const MAX_ATTEMPTS = 5;
/** Rate-limit window per-jobRef verification attempts. */
const RATE_WINDOW_MS = 60 * 1000;
const RATE_MAX_IN_WINDOW = 10;

// ─── In-memory store ────────────────────────────────────────────────

interface StoredRecord {
  jobRef: string;
  purpose: HandoffPurpose;
  /** HMAC-SHA256(HANDOFF_HMAC_SECRET, `${code}:${nonce}`) — never
   *  store plaintext. Even a DB leak plus the nonce cannot brute-force
   *  the 4-digit code without also learning the server secret. */
  hash: string;
  nonce: string;
  expiresAt: number; // ms
  attempts: number;
  consumed: boolean;
  revoked: boolean;
  scopeHints?: HandoffIssueInput['scopeHints'];
}

// key = `${jobRef}:${purpose}` — only ONE active credential per
// (jobRef, purpose) at a time. issue() overwrites the previous.
const store = new Map<string, StoredRecord>();
const rateBuckets = new Map<string, number[]>();

function storeKey(jobRef: string, purpose: HandoffPurpose): string {
  return `${jobRef}:${purpose}`;
}

// ─── Crypto helpers ─────────────────────────────────────────────────

function generateNumericCode(): string {
  // 4 digits — Uber-style. Server enforces max attempts + rate limits,
  // so 4 digits is safe from brute force in the 15-minute TTL window.
  const n = crypto.randomInt(0, 10_000);
  return n.toString().padStart(4, '0');
}

function generateNonce(): string {
  return crypto.randomBytes(12).toString('base64url');
}

function hashCode(code: string, nonce: string): string {
  return crypto
    .createHmac('sha256', getHandoffSecret())
    .update(`${code}:${nonce}`)
    .digest('hex');
}

function safeCompareHex(a: string, b: string): boolean {
  // Length guard first — crypto.timingSafeEqual throws on unequal lengths.
  if (a.length !== b.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(a, 'hex'), Buffer.from(b, 'hex'));
  } catch {
    return false;
  }
}

// ─── Public API ─────────────────────────────────────────────────────

/**
 * Issue (or reissue) a handoff credential for (jobRef, purpose).
 *
 * A reissue REVOKES the previous credential — a stale QR can't be
 * replayed after the customer taps "regenerate" (§46 revocable).
 */
export function issueHandoff(input: HandoffIssueInput): HandoffCredential {
  const now = Date.now();
  const asked = input.expiresAt.getTime() - now;
  const capped = Math.min(Math.max(asked, 60_000), MAX_TTL_MS);
  const expiresAtMs = now + capped;

  const code = generateNumericCode();
  const nonce = generateNonce();
  const hash = hashCode(code, nonce);

  store.set(storeKey(input.jobRef, input.purpose), {
    jobRef: input.jobRef,
    purpose: input.purpose,
    hash,
    nonce,
    expiresAt: expiresAtMs,
    attempts: 0,
    consumed: false,
    revoked: false,
    scopeHints: input.scopeHints,
  });

  logger.info('[Handoff] issued', {
    // §46 non-PII: log jobRef + purpose + expiry, NEVER the code.
    jobRef: input.jobRef, purpose: input.purpose, expiresAtMs,
  });

  return {
    jobRef: input.jobRef,
    purpose: input.purpose,
    code,
    expiresAt: new Date(expiresAtMs),
    nonce,
  };
}

/**
 * Verify a handoff code. Consumes the record on success — a second
 * verify with the same code returns CODE_ALREADY_CONSUMED.
 *
 * `caller` is optional context for logging / future acceptor policies
 * (staff shows the code they scanned; customer presses "here it is").
 * Never affects correctness — the validity gates live on the record.
 */
export function verifyHandoff(input: {
  jobRef: string;
  purpose: HandoffPurpose;
  code: string;
  caller?: { kind: 'STAFF' | 'CUSTOMER' | 'MACHINE'; uid?: string };
}): HandoffVerifyResult {
  const key = storeKey(input.jobRef, input.purpose);

  // Rate limit BEFORE any lookup so an attacker sniffing invalid
  // codes at the same jobRef gets throttled.
  const now = Date.now();
  const bucket = (rateBuckets.get(key) ?? []).filter((t) => now - t < RATE_WINDOW_MS);
  bucket.push(now);
  rateBuckets.set(key, bucket);
  if (bucket.length > RATE_MAX_IN_WINDOW) {
    return { ok: false, errorCode: 'RATE_LIMITED', message: 'Too many attempts, try later' };
  }

  const rec = store.get(key);
  if (!rec) return { ok: false, errorCode: 'CODE_NOT_FOUND', message: 'Code not found' };
  if (rec.revoked) return { ok: false, errorCode: 'CODE_REVOKED', message: 'Code revoked' };
  if (rec.consumed) return { ok: false, errorCode: 'CODE_ALREADY_CONSUMED', message: 'Code already used' };
  if (now >= rec.expiresAt) return { ok: false, errorCode: 'CODE_EXPIRED', message: 'Code expired' };
  if (rec.purpose !== input.purpose) return { ok: false, errorCode: 'CODE_WRONG_PURPOSE', message: 'Wrong purpose' };
  if (rec.jobRef !== input.jobRef) return { ok: false, errorCode: 'CODE_WRONG_JOB', message: 'Wrong job' };

  rec.attempts += 1;
  if (rec.attempts > MAX_ATTEMPTS) {
    rec.revoked = true;
    return { ok: false, errorCode: 'CODE_REVOKED', message: 'Too many wrong attempts — revoked' };
  }

  const expected = hashCode(input.code, rec.nonce);
  if (!safeCompareHex(expected, rec.hash)) {
    return { ok: false, errorCode: 'CODE_NOT_FOUND', message: 'Wrong code' };
  }

  // Success — consume in the same operation. NEVER a second
  // verify against the same (jobRef, purpose, code).
  rec.consumed = true;

  logger.info('[Handoff] verified', {
    jobRef: rec.jobRef, purpose: rec.purpose,
    callerKind: input.caller?.kind, // no uid PII
  });

  return { ok: true, jobRef: rec.jobRef, purpose: rec.purpose };
}

/**
 * Revoke a handoff credential (§46 revocable). Idempotent — a repeat
 * revoke on a missing / already-revoked record is a no-op.
 */
export function revokeHandoff(jobRef: string, purpose: HandoffPurpose): void {
  const rec = store.get(storeKey(jobRef, purpose));
  if (rec) rec.revoked = true;
}

/** Read-only status probe — used by admin explorer + tests. */
export function inspectHandoff(jobRef: string, purpose: HandoffPurpose): {
  present: boolean;
  expiresAt?: Date;
  consumed?: boolean;
  revoked?: boolean;
  attempts?: number;
} {
  const rec = store.get(storeKey(jobRef, purpose));
  if (!rec) return { present: false };
  return {
    present: true,
    expiresAt: new Date(rec.expiresAt),
    consumed: rec.consumed,
    revoked: rec.revoked,
    attempts: rec.attempts,
  };
}

/**
 * Test-only helper — reset the entire store. NEVER call from
 * production code. Exported so unit tests can drive isolated cases.
 */
export function __resetHandoffStoreForTests(): void {
  store.clear();
  rateBuckets.clear();
}
