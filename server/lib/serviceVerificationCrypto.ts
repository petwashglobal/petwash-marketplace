/**
 * Crypto for service-handoff verification:
 *  - a cryptographically-random 6-digit code (never stored in plaintext — only
 *    its salted SHA-256 hash is persisted, like an OTP),
 *  - a hash-CHAINED check-in/out ledger ("blockchain-style": each event hash
 *    includes the previous hash, so any later edit breaks the chain).
 */
import crypto from 'crypto';
import { VERIFICATION_CODE_LENGTH } from '@shared/service-verification';

/** Cryptographically-random numeric code (leading zeros preserved). */
export function generateVerificationCode(): string {
  // crypto.randomInt is UNBIASED (uses rejection sampling internally) — avoids
  // the modulo bias of `randomBytes % max` that CodeQL js/biased-cryptographic-random flags.
  const n = crypto.randomInt(0, 10 ** VERIFICATION_CODE_LENGTH);
  return n.toString().padStart(VERIFICATION_CODE_LENGTH, '0');
}

export function hashCode(code: string, salt: string): string {
  return crypto.createHash('sha256').update(`${salt}:${code}`).digest('hex');
}

export function newSalt(): string {
  return crypto.randomBytes(16).toString('hex');
}

/** Constant-time compare of a candidate code against the stored hash. */
export function verifyCodeHash(candidate: string, salt: string, storedHash: string): boolean {
  const a = Buffer.from(hashCode(candidate, salt), 'hex');
  const b = Buffer.from(storedHash, 'hex');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// ── Hash-chained check-in/out ledger ─────────────────────────────────────────
export interface ChainEventInput {
  bookingId: string;
  eventType: 'check_in' | 'check_out';
  method: string;
  actorId: string;
  conductAck: boolean;
  at: string; // ISO timestamp (pass in — never generated here so it's deterministic)
}

const GENESIS = '0'.repeat(64);

/** hash = sha256(prevHash || canonical(event)). */
export function chainHash(prevHash: string | null, e: ChainEventInput): string {
  const canonical = JSON.stringify({
    bookingId: e.bookingId, eventType: e.eventType, method: e.method,
    actorId: e.actorId, conductAck: e.conductAck, at: e.at,
  });
  return crypto.createHash('sha256').update(`${prevHash ?? GENESIS}|${canonical}`).digest('hex');
}

export interface ChainRow extends ChainEventInput { prevHash: string | null; hash: string; }

/** Recompute the chain and report the first tampered/broken link, if any. */
export function verifyChain(rows: ChainRow[]): { ok: boolean; brokenAtIndex?: number } {
  let prev: string | null = null;
  for (let i = 0; i < rows.length; i++) {
    const expected = chainHash(prev, rows[i]);
    if (rows[i].prevHash !== prev || rows[i].hash !== expected) return { ok: false, brokenAtIndex: i };
    prev = rows[i].hash;
  }
  return { ok: true };
}

export { GENESIS as CHAIN_GENESIS };
