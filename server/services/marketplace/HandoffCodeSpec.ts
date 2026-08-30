/**
 * HandoffCodeSpec — CEO PROGRAM 26 (Handoff / Return).
 *
 * Pure spec / evaluator wrappers around the doctrine's handoff code
 * shape. The existing HandoffService owns the stateful issue +
 * verify pipeline; this file exposes the pure predicates so both
 * the client and the tests can validate code shape identically
 * without touching the stateful service.
 */
import crypto from 'crypto';

export type HandoffPhase = 'PICKUP' | 'RETURN';

const RE_CODE = /^\d{6}$/;

/** Doctrine: 6 decimal digits, zero-padded. */
export function isValidCodeShape(code: string): boolean {
  return typeof code === 'string' && RE_CODE.test(code);
}

/** SHA-256 hex hash of the plaintext code. */
export function hashCode(code: string): string {
  return crypto.createHash('sha256').update(code, 'utf8').digest('hex');
}

/**
 * Timing-safe comparison between the caller's proposed code hash
 * and the persisted hash. Both inputs must be equal-length hex.
 */
export function verifyCode(candidate: string, storedHex: string): boolean {
  if (!isValidCodeShape(candidate)) return false;
  const candidateHex = hashCode(candidate);
  if (candidateHex.length !== storedHex.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(candidateHex, 'hex'), Buffer.from(storedHex, 'hex'));
  } catch {
    return false;
  }
}

/** Key for keying a (bookingId, phase) pair in a store. */
export function handoffKey(bookingId: string, phase: HandoffPhase): string {
  return `${bookingId}:${phase}`;
}

/** Doctrine default TTL (§ Program 26). */
export const HANDOFF_TTL_MS = 15 * 60 * 1000;

export function isExpired(issuedAtMs: number, nowMs: number = Date.now(), ttlMs: number = HANDOFF_TTL_MS): boolean {
  return nowMs - issuedAtMs > ttlMs;
}
