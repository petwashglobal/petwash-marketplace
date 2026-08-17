/**
 * Lane B (2026-08-17): pure-logic tests for the booking-mutation lock
 * helper. Verifies the key-derivation contract and error shape without
 * requiring a Postgres instance. The atomicity of pg_advisory_lock
 * itself is enforced by Postgres and does not need to be re-tested in
 * JS — see `server/tests/marketplaceSlotLock.test.ts` for the same
 * pattern applied to the EXCLUDE-constraint slot lock.
 */
import { describe, it, expect } from 'vitest';
import {
  BookingMutationLockTimeoutError,
  _lockKeyForTest,
} from '../../server/lib/bookingMutationLock';

describe('BookingMutationLockTimeoutError', () => {
  it('carries namespace + key + a deterministic message', () => {
    const err = new BookingMutationLockTimeoutError('sitter-provider-respond', 'BK-123');
    expect(err.namespace).toBe('sitter-provider-respond');
    expect(err.key).toBe('BK-123');
    expect(err.name).toBe('BookingMutationLockTimeoutError');
    expect(err.message).toContain('sitter-provider-respond');
    expect(err.message).toContain('BK-123');
  });

  it('is instanceof Error so existing try/catch chains catch it', () => {
    const err = new BookingMutationLockTimeoutError('x', 'y');
    expect(err).toBeInstanceOf(Error);
  });
});

describe('lock-key derivation', () => {
  it('produces a stable 32-bit signed integer for the same input', () => {
    const a = _lockKeyForTest('sitter-provider-respond', 'BK-123');
    const b = _lockKeyForTest('sitter-provider-respond', 'BK-123');
    expect(a).toBe(b);
    expect(Number.isInteger(a)).toBe(true);
    expect(a).toBeGreaterThanOrEqual(-0x80000000);
    expect(a).toBeLessThanOrEqual(0x7fffffff);
  });

  it('namespaces prevent collisions across surfaces', () => {
    // The same booking id used by two different surfaces MUST NOT share
    // a lock — a sitter-accept in flight should not block a walk-accept
    // that happens to have an identically-named row.
    const sitterKey = _lockKeyForTest('sitter-provider-respond', 'SAME');
    const walkKey = _lockKeyForTest('walk-provider-respond', 'SAME');
    expect(sitterKey).not.toBe(walkKey);
  });

  it('different bookings under the same surface produce different keys', () => {
    // If two admins refund two DIFFERENT bookings at once, they must
    // not serialize on each other — that would make the admin panel
    // feel broken.
    const a = _lockKeyForTest('admin-wallet-refund', 'BK-A');
    const b = _lockKeyForTest('admin-wallet-refund', 'BK-B');
    expect(a).not.toBe(b);
  });
});
