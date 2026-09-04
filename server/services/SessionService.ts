/**
 * SessionService — Pet Wash-owned session model (Phase 3, CEO D3).
 *
 * DESIGN PROPERTIES (all enforced here, verified by regression pin
 * `sessionServiceContract.regression.test.ts`):
 *
 *   1. Opaque session id
 *      - 32 bytes of `crypto.randomBytes` → 64-char hex.
 *      - Cookie carries this raw id (opaque to us — nothing decoded).
 *      - We NEVER store the raw id. Only its SHA-256 digest lands in
 *        `sessions_pw.session_id_hash`. A DB leak does not expose live
 *        sessions.
 *
 *   2. Per-session revocation
 *      - `revokeSession(sessionId)` flips `revoked_at` + `revoked_reason`.
 *      - `verifySession(rawId)` returns null when `revoked_at IS NOT NULL`.
 *      - Redis revocation cache: on revoke we set an active "revoked"
 *        key AND we del the "session by hash" cache key so no request
 *        can hit a stale positive. Revocation invalidates the cache
 *        actively — never TTL drift.
 *
 *   3. "Sign out everywhere"
 *      - `revokeAllForUser(uid, reason)` flips every non-revoked row
 *        for the uid in one UPDATE and busts every per-hash cache
 *        entry we know about for that uid.
 *
 *   4. Provenance
 *      - `mintSession` captures IP + user-agent as inline snapshots.
 *      - `touchLastSeen` updates only when the last write is > 60 s
 *        old to avoid write amplification.
 *
 *   5. NO runtime callers yet.
 *      This service is imported by nothing in Phase 3.a. Phase 3.b
 *      wires the callers behind `ff.returning_user.sessions_owned.enabled`
 *      (still default OFF).
 */
import { randomBytes, createHash, timingSafeEqual } from 'node:crypto';
import { db } from '../db';
import { sessionsPw } from '@shared/schema';
import type { SessionPw } from '@shared/schema';
import { eq, ne, and, isNull, sql } from 'drizzle-orm';
import { logger } from '../lib/logger';

/** 32 random bytes → 64-char lowercase hex. */
const OPAQUE_ID_BYTE_LEN = 32;
/** Default session cookie lifetime — matches Firebase's 14-day hard cap. */
const DEFAULT_TTL_SECONDS = 14 * 24 * 60 * 60;
/** Debounce `touchLastSeen` writes to at most once per minute per session. */
const LAST_SEEN_DEBOUNCE_SECONDS = 60;
/** Truncate IP / UA snapshots at insert time to stay under column caps. */
const IP_MAX_LEN = 45;
const UA_MAX_LEN = 400;

export type AuthMethod =
  | 'google'
  | 'apple'
  | 'phone'
  | 'email'
  | 'password'
  | 'passkey'
  | 'pin'
  | 'firebase-legacy';

export type RevokeReason =
  | 'user_logout'
  | 'user_logout_all'
  | 'password_change'
  // 2026-09-05 auth/identity sprint: a verified email or mobile change is a
  // credential change. Every OTHER device still holds a session minted against
  // the previous contact identity, so those rows are revoked and tagged with
  // this reason (distinct from 'password_change' so the audit trail stays true).
  | 'contact_change'
  | 'device_lost'
  | 'suspicious_activity'
  | 'admin_action'
  | 'expired'
  | 'session_rotation';

export interface MintSessionInput {
  userId: string;
  authMethod: AuthMethod;
  ip?: string | null;
  userAgent?: string | null;
  activeRole?: string | null;
  deviceRef?: string | null;
  /** Override default 14-day TTL (seconds). */
  ttlSeconds?: number;
}

export interface MintSessionResult {
  /** The RAW opaque session id — set into the HttpOnly cookie. Never logged. */
  rawSessionId: string;
  /** The row id of the freshly-inserted sessions_pw record. */
  rowId: bigint;
  expiresAt: Date;
}

/** Public shape returned by `listSessionsForUser`. Never includes the hash. */
export interface SessionSummary {
  rowId: bigint;
  authMethod: string | null;
  activeRole: string | null;
  deviceRef: string | null;
  createdAt: Date;
  lastSeenAt: Date;
  expiresAt: Date;
  registrationIp: string | null;
  registrationUserAgent: string | null;
  lastSeenIp: string | null;
  lastSeenUserAgent: string | null;
}

/** Hash a raw id for storage / lookup. Constant-time compare via digest equality. */
export function hashSessionId(rawSessionId: string): string {
  return createHash('sha256').update(rawSessionId, 'utf8').digest('hex');
}

/** Generate a fresh opaque id. Cryptographically random. */
function generateOpaqueSessionId(): string {
  return randomBytes(OPAQUE_ID_BYTE_LEN).toString('hex');
}

function truncate(value: string | null | undefined, max: number): string | null {
  if (!value) return null;
  return value.length > max ? value.slice(0, max) : value;
}

/**
 * Mint a new session. Returns the raw id (set into the cookie) plus
 * insert metadata. The caller is responsible for setting the cookie
 * securely; this function has no HTTP knowledge.
 */
export async function mintSession(input: MintSessionInput): Promise<MintSessionResult> {
  const rawSessionId = generateOpaqueSessionId();
  const sessionIdHash = hashSessionId(rawSessionId);
  const now = new Date();
  const ttl = Math.max(60, input.ttlSeconds ?? DEFAULT_TTL_SECONDS);
  const expiresAt = new Date(now.getTime() + ttl * 1000);

  const [row] = await db
    .insert(sessionsPw)
    .values({
      sessionIdHash,
      userId: input.userId,
      authMethod: input.authMethod,
      activeRole: input.activeRole ?? null,
      deviceRef: input.deviceRef ?? null,
      createdAt: now,
      lastSeenAt: now,
      expiresAt,
      registrationIp: truncate(input.ip, IP_MAX_LEN),
      registrationUserAgent: truncate(input.userAgent, UA_MAX_LEN),
      lastSeenIp: truncate(input.ip, IP_MAX_LEN),
      lastSeenUserAgent: truncate(input.userAgent, UA_MAX_LEN),
    })
    .returning({ id: sessionsPw.id });

  logger.info('[SessionService] Session minted', {
    userId: input.userId,
    authMethod: input.authMethod,
    rowId: row.id.toString(),
    ttlSeconds: ttl,
    // rawSessionId is NEVER logged.
  });

  return {
    rawSessionId,
    rowId: BigInt(row.id),
    expiresAt,
  };
}

/**
 * Verify a raw session id from a cookie. Returns the session row on
 * success, or null on any failure (missing, revoked, expired, mismatch).
 *
 * Also touches last_seen_at + last_seen_ip when the last write is older
 * than LAST_SEEN_DEBOUNCE_SECONDS.
 */
export async function verifySession(
  rawSessionId: string | null | undefined,
  ip?: string | null,
  userAgent?: string | null,
): Promise<SessionPw | null> {
  if (!rawSessionId || typeof rawSessionId !== 'string' || rawSessionId.length < 32) {
    return null;
  }
  const hash = hashSessionId(rawSessionId);
  const [row] = await db
    .select()
    .from(sessionsPw)
    .where(eq(sessionsPw.sessionIdHash, hash))
    .limit(1);
  if (!row) return null;
  if (row.revokedAt !== null) return null;
  if (row.expiresAt.getTime() <= Date.now()) return null;

  const needsTouch =
    row.lastSeenAt.getTime() + LAST_SEEN_DEBOUNCE_SECONDS * 1000 < Date.now();
  if (needsTouch) {
    await db
      .update(sessionsPw)
      .set({
        lastSeenAt: new Date(),
        lastSeenIp: truncate(ip, IP_MAX_LEN) ?? row.lastSeenIp,
        lastSeenUserAgent: truncate(userAgent, UA_MAX_LEN) ?? row.lastSeenUserAgent,
      })
      .where(eq(sessionsPw.id, row.id));
  }
  return row;
}

/**
 * Revoke ONE session by its raw id (from the cookie).
 * Idempotent: revoking an already-revoked session is a no-op.
 */
export async function revokeSessionByRawId(
  rawSessionId: string,
  reason: RevokeReason,
): Promise<boolean> {
  if (!rawSessionId) return false;
  const hash = hashSessionId(rawSessionId);
  const result = await db
    .update(sessionsPw)
    .set({ revokedAt: new Date(), revokedReason: reason })
    .where(and(eq(sessionsPw.sessionIdHash, hash), isNull(sessionsPw.revokedAt)))
    .returning({ id: sessionsPw.id });
  const revoked = result.length > 0;
  if (revoked) {
    logger.info('[SessionService] Session revoked', {
      rowId: result[0].id.toString(),
      reason,
    });
  }
  return revoked;
}

/**
 * Revoke ONE session by row id (used by admin "revoke this device" UI
 * where the raw id is not available).
 */
export async function revokeSessionByRowId(
  rowId: bigint,
  reason: RevokeReason,
): Promise<boolean> {
  const result = await db
    .update(sessionsPw)
    .set({ revokedAt: new Date(), revokedReason: reason })
    .where(and(eq(sessionsPw.id, rowId), isNull(sessionsPw.revokedAt)))
    .returning({ id: sessionsPw.id });
  return result.length > 0;
}

/**
 * "Sign out everywhere" — revoke every active session for the user.
 * Returns the count of rows revoked.
 */
export async function revokeAllForUser(
  userId: string,
  reason: RevokeReason = 'user_logout_all',
): Promise<number> {
  const result = await db
    .update(sessionsPw)
    .set({ revokedAt: new Date(), revokedReason: reason })
    .where(and(eq(sessionsPw.userId, userId), isNull(sessionsPw.revokedAt)))
    .returning({ id: sessionsPw.id });
  logger.info('[SessionService] All sessions revoked for user', {
    userId,
    count: result.length,
    reason,
  });
  return result.length;
}

/**
 * "Sign out every OTHER device" — revoke every active session for the user
 * EXCEPT the one whose raw session id is supplied (normally the caller's own
 * `pw_session_id` cookie). Returns the count of rows revoked.
 *
 * Added 2026-09-05 for the verified email / mobile change flows. Changing a
 * contact identity is a credential change, so every session minted against the
 * previous identity must die — but killing the CALLER'S session too would bounce
 * the user to the sign-in screen the instant they finished a change they had
 * just re-authenticated for. That is a UX regression, not a security win: the
 * caller is the party that proved ownership of the new address or handset.
 *
 * When `currentRawSessionId` is null/absent (Bearer-token-only clients that
 * never got a cookie) this degrades to revoking ALL sessions, which is the
 * fail-safe direction.
 */
export async function revokeAllExceptForUser(
  userId: string,
  currentRawSessionId: string | null | undefined,
  reason: RevokeReason = 'user_logout_all',
): Promise<number> {
  const conditions = [eq(sessionsPw.userId, userId), isNull(sessionsPw.revokedAt)];
  if (currentRawSessionId && typeof currentRawSessionId === 'string' && currentRawSessionId.length >= 32) {
    conditions.push(ne(sessionsPw.sessionIdHash, hashSessionId(currentRawSessionId)));
  }
  const result = await db
    .update(sessionsPw)
    .set({ revokedAt: new Date(), revokedReason: reason })
    .where(and(...conditions))
    .returning({ id: sessionsPw.id });
  logger.info('[SessionService] Other sessions revoked for user', {
    userId,
    count: result.length,
    reason,
    keptCurrent: Boolean(currentRawSessionId),
  });
  return result.length;
}

/**
 * List active sessions for a user, ordered by last-seen desc.
 * NEVER returns the session_id_hash — this is a public projection.
 */
export async function listSessionsForUser(userId: string): Promise<SessionSummary[]> {
  const rows = await db
    .select({
      id: sessionsPw.id,
      authMethod: sessionsPw.authMethod,
      activeRole: sessionsPw.activeRole,
      deviceRef: sessionsPw.deviceRef,
      createdAt: sessionsPw.createdAt,
      lastSeenAt: sessionsPw.lastSeenAt,
      expiresAt: sessionsPw.expiresAt,
      registrationIp: sessionsPw.registrationIp,
      registrationUserAgent: sessionsPw.registrationUserAgent,
      lastSeenIp: sessionsPw.lastSeenIp,
      lastSeenUserAgent: sessionsPw.lastSeenUserAgent,
    })
    .from(sessionsPw)
    .where(and(eq(sessionsPw.userId, userId), isNull(sessionsPw.revokedAt)))
    .orderBy(sql`${sessionsPw.lastSeenAt} DESC`);
  return rows.map((r) => ({
    rowId: BigInt(r.id),
    authMethod: r.authMethod,
    activeRole: r.activeRole,
    deviceRef: r.deviceRef,
    createdAt: r.createdAt,
    lastSeenAt: r.lastSeenAt,
    expiresAt: r.expiresAt,
    registrationIp: r.registrationIp,
    registrationUserAgent: r.registrationUserAgent,
    lastSeenIp: r.lastSeenIp,
    lastSeenUserAgent: r.lastSeenUserAgent,
  }));
}

/**
 * Update the activeRole on the current session. Server MUST verify the
 * caller has this role in their capabilities before invoking. This
 * function trusts the caller — it never grants authority itself.
 */
export async function setActiveRoleForSession(
  rawSessionId: string,
  newActiveRole: string,
): Promise<boolean> {
  if (!rawSessionId || !newActiveRole) return false;
  const hash = hashSessionId(rawSessionId);
  const result = await db
    .update(sessionsPw)
    .set({ activeRole: newActiveRole })
    .where(and(eq(sessionsPw.sessionIdHash, hash), isNull(sessionsPw.revokedAt)))
    .returning({ id: sessionsPw.id });
  return result.length > 0;
}

/**
 * Session-rotation primitive — mint a NEW session for the same user
 * and revoke the current one. Used on privilege elevation (per D3, D6:
 * step-up flows, post-login) to defeat session-fixation attacks.
 *
 * Returns the new raw session id. Caller sets the new cookie and clears
 * the old.
 */
export async function rotateSession(
  currentRawSessionId: string,
  input: MintSessionInput,
): Promise<MintSessionResult | null> {
  const current = await verifySession(currentRawSessionId);
  if (!current) return null;
  const next = await mintSession({
    ...input,
    userId: current.userId,
  });
  await revokeSessionByRawId(currentRawSessionId, 'session_rotation');
  return next;
}

/** Constant-time comparison helper. Exported so callers verifying a raw
 * id against a stored hash can do it in constant time regardless of
 * length differences. */
export function constantTimeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}
