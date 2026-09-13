/**
 * WebAuthn challenge store — server-side, single-use, bound.
 *
 * WHY (2026-09-13): challenges used to live in an HMAC-signed `wa_challenge`
 * cookie. Firebase Hosting strips every cookie except `__session` on requests
 * it forwards to Cloud Run, so verify never saw the challenge and passkey
 * sign-in could not have worked in production. A signed cookie was also never
 * single-use: the same cookie could be replayed for its whole lifetime.
 *
 * Now:
 *   - options:  a 256-bit random `challengeId` is minted, the record is written
 *               to Redis under sha256(challengeId) with TTL = challengeExpiry,
 *               and the id is returned to the client in the JSON body.
 *   - verify:   the client sends the id back; the record is fetched AND deleted
 *               in one GETDEL (atomic — two racing verifies cannot both get it),
 *               then expiry and every binding (type, rpId, origin, uid,
 *               discoverable) are checked before any signature work happens.
 *   - store down: FAIL CLOSED. Issue refuses to hand out options; consume
 *               refuses to verify. Both surface as 503, never as a pass.
 *
 * The Redis key is the HASH of the id, so an operator reading keys or logs
 * never sees a usable challengeId.
 */
import crypto from 'crypto';
import { logger } from '../lib/logger';
import { redis } from '../services/redis';
import { webauthnConfig } from './config';

export type CeremonyType = 'registration' | 'authentication';

export interface StoredChallenge {
  challenge: string;
  type: CeremonyType;
  rpId: string;
  origin: string;
  /** Registration + email-scoped login: the account the challenge was issued for. */
  uid: string | null;
  email: string | null;
  /** 'users' | 'employees' — the collection the credentials were read from at issue time. */
  collection: 'users' | 'employees' | null;
  /** Discoverable (usernameless) login — no uid bound at issue time. */
  discoverable: boolean;
  createdAt: number;
  expiresAt: number;
}

export interface ChallengeBackend {
  set(key: string, value: string, ttlSeconds: number): Promise<boolean>;
  getDelStrict(
    key: string,
  ): Promise<{ state: 'VALUE'; value: string } | { state: 'MISSING' } | { state: 'UNAVAILABLE' }>;
}

export const redisChallengeBackend: ChallengeBackend = {
  set: (key, value, ttlSeconds) => redis.setRaw(key, value, ttlSeconds),
  getDelStrict: (key) => redis.getDelStrict(key),
};

let backend: ChallengeBackend = redisChallengeBackend;

/** Test seam only. */
export function __setChallengeBackendForTests(b: ChallengeBackend | null): void {
  backend = b ?? redisChallengeBackend;
}

const KEY_PREFIX = 'webauthn:challenge:';
/** 32 random bytes, base64url, no padding = 43 chars. */
const CHALLENGE_ID_RE = /^[A-Za-z0-9_-]{43}$/;

function keyFor(challengeId: string): string {
  return KEY_PREFIX + crypto.createHash('sha256').update(challengeId).digest('hex');
}

export type IssueResult = { ok: true; challengeId: string } | { ok: false; reason: 'store_unavailable' };

export async function issueChallenge(
  input: Omit<StoredChallenge, 'createdAt' | 'expiresAt'>,
  now: number = Date.now(),
): Promise<IssueResult> {
  const challengeId = crypto.randomBytes(32).toString('base64url');
  const record: StoredChallenge = {
    ...input,
    createdAt: now,
    expiresAt: now + webauthnConfig.challengeExpiry,
  };
  const ttlSeconds = Math.ceil(webauthnConfig.challengeExpiry / 1000);

  let stored = false;
  try {
    stored = await backend.set(keyFor(challengeId), JSON.stringify(record), ttlSeconds);
  } catch {
    stored = false;
  }
  if (!stored) {
    logger.error('[WebAuthn ChallengeStore] could not store challenge — refusing to issue options (fail-closed)', {
      type: input.type,
      rpId: input.rpId,
    });
    return { ok: false, reason: 'store_unavailable' };
  }
  return { ok: true, challengeId };
}

export interface ChallengeExpectation {
  type: CeremonyType;
  rpId: string;
  origin: string;
  /** When set, the stored uid must equal it (registration: the signed-in caller). */
  uid?: string;
  /** When set, the stored discoverable flag must equal it. */
  discoverable?: boolean;
}

export type ConsumeRefusal = 'invalid_id' | 'not_found' | 'expired' | 'mismatch' | 'store_unavailable';

export type ConsumeResult = { ok: true; record: StoredChallenge } | { ok: false; reason: ConsumeRefusal };

export async function consumeChallenge(
  challengeId: unknown,
  expected: ChallengeExpectation,
  now: number = Date.now(),
): Promise<ConsumeResult> {
  if (typeof challengeId !== 'string' || !CHALLENGE_ID_RE.test(challengeId)) {
    return { ok: false, reason: 'invalid_id' };
  }

  let outcome: Awaited<ReturnType<ChallengeBackend['getDelStrict']>>;
  try {
    outcome = await backend.getDelStrict(keyFor(challengeId));
  } catch {
    outcome = { state: 'UNAVAILABLE' };
  }

  if (outcome.state === 'UNAVAILABLE') {
    logger.error('[WebAuthn ChallengeStore] store unreachable — refusing to verify (fail-closed)', {
      type: expected.type,
    });
    return { ok: false, reason: 'store_unavailable' };
  }
  if (outcome.state === 'MISSING') {
    // Never issued, already consumed, or TTL-expired. All the same answer.
    return { ok: false, reason: 'not_found' };
  }

  let record: StoredChallenge;
  try {
    record = JSON.parse(outcome.value) as StoredChallenge;
  } catch {
    return { ok: false, reason: 'not_found' };
  }

  if (typeof record.expiresAt !== 'number' || record.expiresAt <= now) {
    return { ok: false, reason: 'expired' };
  }

  const mismatches: string[] = [];
  if (record.type !== expected.type) mismatches.push('type');
  if (record.rpId !== expected.rpId) mismatches.push('rpId');
  if (record.origin !== expected.origin) mismatches.push('origin');
  if (expected.uid !== undefined && record.uid !== expected.uid) mismatches.push('uid');
  if (expected.discoverable !== undefined && record.discoverable !== expected.discoverable) {
    mismatches.push('discoverable');
  }
  if (typeof record.challenge !== 'string' || !record.challenge) mismatches.push('challenge');

  if (mismatches.length > 0) {
    logger.warn('[WebAuthn ChallengeStore] challenge binding mismatch — refused', {
      mismatches,
      expectedType: expected.type,
      storedType: record.type,
    });
    return { ok: false, reason: 'mismatch' };
  }

  return { ok: true, record };
}
