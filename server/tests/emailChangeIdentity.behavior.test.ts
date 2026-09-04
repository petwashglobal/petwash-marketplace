/**
 * Behavioral tests for the pure identity-change helpers exported by
 * server/routes/profile-settings.ts.
 *
 * These are the units that decide whether an email change is SAFE. They are
 * exported precisely so they can be driven directly instead of being pinned by
 * a grep — a grep would still pass if the logic inverted.
 */
import { describe, it, expect, vi } from 'vitest';

vi.mock('../db', () => ({ db: {} }));
vi.mock('../lib/firebase-admin', () => ({ default: { auth: () => ({}), firestore: () => ({}) } }));
vi.mock('../services/AuthService', () => ({ authService: {} }));
vi.mock('../services/VerificationEmailDelivery', () => ({ sendVerificationEmailCode: vi.fn() }));
vi.mock('../services/UnifiedVerificationService', () => ({
  UnifiedVerificationError: class extends Error {},
  unifiedVerificationService: {},
}));
vi.mock('../services/SessionService', () => ({ revokeAllForUser: vi.fn() }));

import {
  normalizeEmail,
  maskEmail,
  hasRecentAuth,
  sanitizeFirebaseAuthError,
} from '../routes/profile-settings';

describe('normalizeEmail', () => {
  it('collapses casing and whitespace so users.email UNIQUE actually dedupes', () => {
    expect(normalizeEmail('  Nir@Example.COM ')).toBe('nir@example.com');
    expect(normalizeEmail('NIR@EXAMPLE.COM')).toBe(normalizeEmail('nir@example.com'));
  });
});

describe('hasRecentAuth', () => {
  const now = 1_700_000_000;

  it('accepts a sign-in inside the 5-minute window', () => {
    expect(hasRecentAuth({ auth_time: now - 60 }, now)).toBe(true);
    expect(hasRecentAuth({ auth_time: now }, now)).toBe(true);
    expect(hasRecentAuth({ auth_time: now - 300 }, now)).toBe(true);
  });

  it('denies a stale sign-in', () => {
    expect(hasRecentAuth({ auth_time: now - 301 }, now)).toBe(false);
    expect(hasRecentAuth({ auth_time: now - 86_400 }, now)).toBe(false);
  });

  it('FAILS CLOSED when auth_time is absent (the old `undefined < n` bug)', () => {
    // The previous inline gate was `if (authTime < fiveMinutesAgo) deny`.
    // `undefined < number` is false, so a token with no auth_time SILENTLY
    // PASSED the re-authentication requirement. It must now deny.
    expect(hasRecentAuth({})).toBe(false);
    expect(hasRecentAuth(undefined)).toBe(false);
    expect(hasRecentAuth(null)).toBe(false);
    expect(hasRecentAuth({ auth_time: NaN }, now)).toBe(false);
    expect(hasRecentAuth({ auth_time: 'recent' as any }, now)).toBe(false);
  });
});

describe('maskEmail', () => {
  it('never echoes back a full address', () => {
    const masked = maskEmail('nirhadad@example.com');
    expect(masked).toContain('@example.com');
    expect(masked.startsWith('ni')).toBe(true);
    expect(masked).not.toContain('nirhadad');
  });

  it('handles short locals and rubbish without throwing or leaking', () => {
    expect(maskEmail('a@b.com')).toBe('a•@b.com');
    expect(maskEmail('')).toBe('');
    expect(maskEmail('not-an-email')).toBe('');
  });
});

describe('sanitizeFirebaseAuthError', () => {
  it('maps a duplicate address to 409 with a stable client code, not a raw 500', () => {
    expect(sanitizeFirebaseAuthError({ code: 'auth/email-already-exists' })).toEqual({
      status: 409,
      code: 'EMAIL_ALREADY_IN_USE',
      message: 'Email already in use',
    });
  });

  it('maps rate limiting to 429 and bad input to 400', () => {
    expect(sanitizeFirebaseAuthError({ code: 'auth/too-many-requests' }).status).toBe(429);
    expect(sanitizeFirebaseAuthError({ code: 'auth/invalid-email' }).status).toBe(400);
  });

  it('never forwards an unknown raw Firebase message to the client', () => {
    const out = sanitizeFirebaseAuthError({
      code: 'auth/internal-error',
      message: 'FIREBASE INTERNAL: projects/petwash-xyz service account blah',
    });
    expect(out.status).toBe(500);
    expect(out.message).toBe('Failed to update identity');
    expect(out.message).not.toContain('petwash-xyz');
  });
});
