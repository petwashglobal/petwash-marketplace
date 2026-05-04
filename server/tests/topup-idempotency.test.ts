/**
 * PR-W4 — Idempotency-key derivation tests for /topup.
 *
 * The route handler proper depends on a real Postgres connection; here we
 * lock in the behaviour of the small pure function `deriveTopupIdempotencyKey`
 * which decides what key (if any) gets used to insert into
 * `walletIdempotencyKeys`. Getting this wrong means either:
 *   - false collisions (two unrelated users → same key → bad caching), or
 *   - false misses (legitimate duplicate request → second credit issued).
 */
import { describe, it, expect } from 'vitest';
import { deriveTopupIdempotencyKey } from '../lib/topup-idempotency';

describe('deriveTopupIdempotencyKey', () => {
  it('returns null when neither nayaxTxId nor header is provided', () => {
    expect(deriveTopupIdempotencyKey(undefined, undefined)).toBeNull();
  });

  it('returns null for empty strings', () => {
    expect(deriveTopupIdempotencyKey('', '')).toBeNull();
  });

  it('returns null for whitespace-only strings', () => {
    expect(deriveTopupIdempotencyKey('   ', '\t\n')).toBeNull();
  });

  it('prefers nayaxTxId over header when both are present', () => {
    const key = deriveTopupIdempotencyKey('nayax-tx-123', 'header-key-xyz');
    expect(key).toBe('topup:nayax-tx-123');
  });

  it('falls back to header when nayaxTxId is missing', () => {
    expect(deriveTopupIdempotencyKey(undefined, 'idem-abc')).toBe('topup:idem-abc');
  });

  it('falls back to header when nayaxTxId is empty', () => {
    expect(deriveTopupIdempotencyKey('', 'idem-abc')).toBe('topup:idem-abc');
  });

  it('namespaces the key with "topup:" prefix', () => {
    const key = deriveTopupIdempotencyKey('abc-123', undefined);
    expect(key).toBe('topup:abc-123');
  });

  it('trims whitespace from the chosen value', () => {
    const key = deriveTopupIdempotencyKey('  abc  ', undefined);
    expect(key).toBe('topup:abc');
  });

  it('truncates long keys to fit a 128-char column with the prefix', () => {
    const long = 'x'.repeat(200);
    const key = deriveTopupIdempotencyKey(long, undefined)!;
    expect(key.length).toBeLessThanOrEqual(128);
    expect(key.startsWith('topup:')).toBe(true);
    // 110-char body + 6-char prefix = 116
    expect(key.length).toBe(116);
  });

  it('keeps the same nayaxTxId mapping stable across calls', () => {
    const a = deriveTopupIdempotencyKey('NAYAX-99', undefined);
    const b = deriveTopupIdempotencyKey('NAYAX-99', undefined);
    expect(a).toBe(b);
  });

  it('produces different keys for different nayaxTxIds', () => {
    const a = deriveTopupIdempotencyKey('A', undefined);
    const b = deriveTopupIdempotencyKey('B', undefined);
    expect(a).not.toBe(b);
  });

  it('handles header-only case (admin manual topup with explicit Idempotency-Key)', () => {
    expect(deriveTopupIdempotencyKey(undefined, 'manual-2026-05-04-001')).toBe(
      'topup:manual-2026-05-04-001',
    );
  });
});
