/**
 * moderationDecisions — FLY MODE III hardening pin.
 *
 * CEO DEEP-LOGIC §4-§8. Locks:
 *   §4 production requires MODERATION_WARN_TOKEN_SECRET (min 32 chars);
 *      dev falls back to a random secret so local runs still work.
 *   §5 signature comparison uses crypto.timingSafeEqual on decoded bytes.
 *   §6 one-time nonce: the token carries a jti; consumeJti(jti) makes
 *      a warning a single-shot pass, not a 15-minute unlimited bypass.
 *   §7 no fabricated category — WarningTokenBindings.category is
 *      PolicyCategory (required), never a fallback string.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect, beforeEach } from 'vitest';

import {
  hashSafeContent,
  issueWarningToken,
  verifyWarningToken,
  consumeJti,
  buildAllowNoticePayload,
  _resetSecretCacheForTests,
  _resetJtiStoreForTests,
  ModerationConfigError,
} from '../services/marketplace/moderationDecisions';

const SRC = fs.readFileSync(
  path.resolve(__dirname, '..', 'services', 'marketplace', 'moderationDecisions.ts'),
  'utf8',
);

beforeEach(() => {
  delete process.env.MODERATION_WARN_TOKEN_SECRET;
  delete process.env.NODE_ENV;
  _resetSecretCacheForTests();
  _resetJtiStoreForTests();
});

describe('CEO §4 — production requires a stable configured secret', () => {
  it('throws ModerationConfigError in production when the env var is missing', () => {
    process.env.NODE_ENV = 'production';
    expect(() => issueWarningToken({
      senderUid: 'a', threadId: 't', safeContentHash: 'h',
      policyVersion: 'v', category: 'CONTACT_EXCHANGE',
    })).toThrow(ModerationConfigError);
  });

  it('accepts a ≥32-char configured secret in production', () => {
    process.env.NODE_ENV = 'production';
    process.env.MODERATION_WARN_TOKEN_SECRET = 'x'.repeat(64);
    expect(() => issueWarningToken({
      senderUid: 'a', threadId: 't', safeContentHash: 'h',
      policyVersion: 'v', category: 'CONTACT_EXCHANGE',
    })).not.toThrow();
  });

  it('development / test may fall back to a random secret (never crashes local runs)', () => {
    process.env.NODE_ENV = 'test';
    expect(() => issueWarningToken({
      senderUid: 'a', threadId: 't', safeContentHash: 'h',
      policyVersion: 'v', category: 'CONTACT_EXCHANGE',
    })).not.toThrow();
  });

  it('code never uses a per-instance randomBytes fallback IN PRODUCTION', () => {
    // The randomBytes call must live behind a NODE_ENV !== 'production'
    // gate; a bare randomBytes() invocation without the gate would
    // send every prod instance into its own secret.
    expect(SRC).toMatch(
      /const isProd = process\.env\.NODE_ENV === 'production'[\s\S]{0,400}throw new ModerationConfigError/,
    );
  });
});

describe('CEO §5 — timing-safe signature comparison', () => {
  it('uses crypto.timingSafeEqual on decoded bytes, not a plain string compare', () => {
    expect(SRC).toMatch(/crypto\.timingSafeEqual\(sigBytes, expected\)/);
    // A bare `sign(body) !== sig` compare is banned.
    const verifyIdx = SRC.indexOf('function verifySignature');
    const end = SRC.indexOf('\n}\n', verifyIdx);
    const body = SRC.slice(verifyIdx, end);
    // A bare `sign(body) !== sig` compare (the old form) is banned.
    expect(body).not.toMatch(/sign\(body\)\s*!==/);
    expect(body).not.toMatch(/return sig[Bb]?\S*\s*!==\s*expected/);
  });
});

describe('CEO §6 — one-time JTI consumption', () => {
  it('every issued token carries a unique jti', () => {
    process.env.MODERATION_WARN_TOKEN_SECRET = 'x'.repeat(64);
    const bindings = {
      senderUid: 'nir', threadId: 't', safeContentHash: hashSafeContent('body'),
      policyVersion: 'v', category: 'CONTACT_EXCHANGE' as const,
    };
    const t1 = issueWarningToken(bindings);
    const t2 = issueWarningToken(bindings);
    const v1 = verifyWarningToken(t1, bindings);
    const v2 = verifyWarningToken(t2, bindings);
    if (!v1.ok || !v2.ok) throw new Error('both should verify');
    expect(v1.jti).not.toBe(v2.jti);
  });

  it('a JTI can be consumed exactly once', () => {
    const jti = 'test_jti_1';
    expect(consumeJti(jti)).toBe(true);
    expect(consumeJti(jti)).toBe(false);
    expect(consumeJti(jti)).toBe(false);
  });

  it('different JTIs are independent', () => {
    expect(consumeJti('a')).toBe(true);
    expect(consumeJti('b')).toBe(true);
    expect(consumeJti('a')).toBe(false);
    expect(consumeJti('b')).toBe(false);
  });
});

describe('CEO §7 — WarningTokenBindings.category is PolicyCategory, never optional', () => {
  it('bindings type requires a category — no fallback slot', () => {
    expect(SRC).toMatch(
      /export interface WarningTokenBindings\s*\{[\s\S]{0,400}category: PolicyCategory;\s*\}/,
    );
  });
});

describe('sign / verify round-trip (bindings + expiry)', () => {
  const bindings = {
    senderUid: 'nir_uid',
    threadId: 'thread_1',
    safeContentHash: hashSafeContent('call me at 050-1234567'),
    policyVersion: 'mpe-2026-08-29',
    category: 'CONTACT_EXCHANGE' as const,
  };

  it('accepts a fresh token; body / sender / thread / policy / category drift all rejected', () => {
    const token = issueWarningToken(bindings);
    expect(verifyWarningToken(token, bindings).ok).toBe(true);
    expect(verifyWarningToken(token, { ...bindings, safeContentHash: hashSafeContent('OTHER') }))
      .toEqual({ ok: false, reason: 'body_mismatch' });
    expect(verifyWarningToken(token, { ...bindings, senderUid: 'someone_else' }))
      .toEqual({ ok: false, reason: 'sender_mismatch' });
    expect(verifyWarningToken(token, { ...bindings, threadId: 'other' }))
      .toEqual({ ok: false, reason: 'thread_mismatch' });
    expect(verifyWarningToken(token, { ...bindings, policyVersion: 'other' }))
      .toEqual({ ok: false, reason: 'policy_version_mismatch' });
    expect(verifyWarningToken(token, { ...bindings, category: 'OFF_PLATFORM_PAYMENT' }))
      .toEqual({ ok: false, reason: 'category_mismatch' });
  });

  it('expired token → expired; missing / malformed / tampered rejected', () => {
    const expired = issueWarningToken(bindings, Date.now() - 30 * 60 * 1000);
    expect(verifyWarningToken(expired, bindings)).toEqual({ ok: false, reason: 'expired' });
    expect(verifyWarningToken(undefined, bindings)).toEqual({ ok: false, reason: 'missing' });
    expect(verifyWarningToken('a', bindings)).toEqual({ ok: false, reason: 'malformed' });
    const token = issueWarningToken(bindings);
    const tampered = token.slice(0, -3) + 'XYZ';
    expect(verifyWarningToken(tampered, bindings)).toEqual({ ok: false, reason: 'bad_signature' });
  });
});

describe('buildAllowNoticePayload (§18)', () => {
  it('returns the ALLOW_WITH_NOTICE code + category', () => {
    expect(buildAllowNoticePayload('OFF_PLATFORM_PAYMENT')).toEqual({
      noticeCode: 'ALLOW_WITH_NOTICE',
      category: 'OFF_PLATFORM_PAYMENT',
    });
  });

  it('missing category → null (never undefined)', () => {
    expect(buildAllowNoticePayload()).toEqual({
      noticeCode: 'ALLOW_WITH_NOTICE',
      category: null,
    });
  });
});
