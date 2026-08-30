/**
 * HandoffCodeSpec — Program 26 pure predicates.
 */
import { describe, it, expect } from 'vitest';
import crypto from 'crypto';
import {
  isValidCodeShape,
  hashCode,
  verifyCode,
  handoffKey,
  isExpired,
  HANDOFF_TTL_MS,
} from '../services/marketplace/HandoffCodeSpec';

describe('HandoffCodeSpec', () => {
  it('isValidCodeShape accepts 6 digits and nothing else', () => {
    expect(isValidCodeShape('123456')).toBe(true);
    expect(isValidCodeShape('000000')).toBe(true);
    expect(isValidCodeShape('12345')).toBe(false);
    expect(isValidCodeShape('1234567')).toBe(false);
    expect(isValidCodeShape('12345a')).toBe(false);
    expect(isValidCodeShape('')).toBe(false);
  });

  it('hashCode returns the SHA-256 hex of the input', () => {
    const expected = crypto.createHash('sha256').update('123456', 'utf8').digest('hex');
    expect(hashCode('123456')).toBe(expected);
  });

  it('verifyCode returns true when the candidate matches the stored hex', () => {
    const stored = hashCode('123456');
    expect(verifyCode('123456', stored)).toBe(true);
  });

  it('verifyCode returns false on mismatched code', () => {
    const stored = hashCode('123456');
    expect(verifyCode('654321', stored)).toBe(false);
  });

  it('verifyCode returns false on invalid shape (short-circuits before any crypto)', () => {
    const stored = hashCode('123456');
    expect(verifyCode('bad-shape', stored)).toBe(false);
  });

  it('handoffKey composes bookingId + phase safely', () => {
    expect(handoffKey('B-1', 'PICKUP')).toBe('B-1:PICKUP');
    expect(handoffKey('B-1', 'RETURN')).toBe('B-1:RETURN');
    expect(handoffKey('B-1', 'PICKUP')).not.toBe(handoffKey('B-1', 'RETURN'));
  });

  it('isExpired 16 minutes past issuance → true (default 15 min TTL)', () => {
    const now = Date.now();
    expect(isExpired(now - 16 * 60 * 1000, now)).toBe(true);
    expect(isExpired(now - 14 * 60 * 1000, now)).toBe(false);
  });

  it('HANDOFF_TTL_MS = 15 minutes (doctrine default)', () => {
    expect(HANDOFF_TTL_MS).toBe(15 * 60 * 1000);
  });
});
