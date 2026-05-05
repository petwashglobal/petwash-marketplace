/**
 * Tests for the admin-credit idempotency-key derivation helper.
 *
 * Mirrors the pattern proven in PR-W4 / topup-idempotency.test.ts.
 * The derivation must be deterministic so two identical clicks
 * produce the same key (and the second one hits the cached
 * response in walletIdempotencyKeys instead of double-crediting).
 */

import { describe, it, expect } from 'vitest';
import { deriveAdminCreditIdempotencyKey } from '../lib/admin-credit-idempotency';

describe('deriveAdminCreditIdempotencyKey', () => {
  it('namespaces under admincred:<route>:', () => {
    const k = deriveAdminCreditIdempotencyKey('credits-add', undefined, 'u1|egift|100');
    expect(k.startsWith('admincred:credits-add:')).toBe(true);
  });

  it('uses different namespaces for the two endpoints', () => {
    const a = deriveAdminCreditIdempotencyKey('credits-add', undefined, 'X');
    const b = deriveAdminCreditIdempotencyKey('admin-inject', undefined, 'X');
    expect(a).not.toEqual(b);
    expect(a.startsWith('admincred:credits-add:')).toBe(true);
    expect(b.startsWith('admincred:admin-inject:')).toBe(true);
  });

  it('prefers an explicit Idempotency-Key header over the body fingerprint', () => {
    const k = deriveAdminCreditIdempotencyKey(
      'credits-add',
      'client-uuid-abc',
      'u1|egift|100',
    );
    expect(k).toBe('admincred:credits-add:client-uuid-abc');
  });

  it('falls back to the body fingerprint when the header is missing', () => {
    const k = deriveAdminCreditIdempotencyKey('credits-add', undefined, 'u1|egift|100');
    expect(k).toBe('admincred:credits-add:u1|egift|100');
  });

  it('treats empty / whitespace-only header as absent', () => {
    expect(
      deriveAdminCreditIdempotencyKey('credits-add', '', 'fp'),
    ).toBe('admincred:credits-add:fp');
    expect(
      deriveAdminCreditIdempotencyKey('credits-add', '   ', 'fp'),
    ).toBe('admincred:credits-add:fp');
  });

  it('trims whitespace around a non-empty header value', () => {
    expect(
      deriveAdminCreditIdempotencyKey('admin-inject', '  abc  ', 'fp'),
    ).toBe('admincred:admin-inject:abc');
  });

  it('is deterministic — identical inputs produce identical keys', () => {
    const a = deriveAdminCreditIdempotencyKey('credits-add', undefined, 'u1|egift|100');
    const b = deriveAdminCreditIdempotencyKey('credits-add', undefined, 'u1|egift|100');
    expect(a).toEqual(b);
  });

  it('truncates oversized payloads to fit the 128-char column', () => {
    const big = 'x'.repeat(500);
    const k = deriveAdminCreditIdempotencyKey('credits-add', undefined, big);
    expect(k.length).toBeLessThanOrEqual(128);
    expect(k.startsWith('admincred:credits-add:')).toBe(true);
  });

  it('uses the header for truncation when both are present (header wins)', () => {
    const big = 'h'.repeat(500);
    const k = deriveAdminCreditIdempotencyKey('admin-inject', big, 'fp');
    expect(k.length).toBeLessThanOrEqual(128);
    expect(k.startsWith('admincred:admin-inject:')).toBe(true);
    // The fingerprint must NOT appear when a header is given
    expect(k.endsWith(':fp')).toBe(false);
  });

  it('returns the prefix even when both inputs are empty', () => {
    const k = deriveAdminCreditIdempotencyKey('credits-add', undefined, '');
    expect(k).toBe('admincred:credits-add:');
  });

  it('different body fingerprints → different keys (no false-positive de-dup)', () => {
    const a = deriveAdminCreditIdempotencyKey('credits-add', undefined, 'u1|egift|100');
    const b = deriveAdminCreditIdempotencyKey('credits-add', undefined, 'u1|egift|200');
    const c = deriveAdminCreditIdempotencyKey('credits-add', undefined, 'u2|egift|100');
    expect(new Set([a, b, c]).size).toBe(3);
  });
});
