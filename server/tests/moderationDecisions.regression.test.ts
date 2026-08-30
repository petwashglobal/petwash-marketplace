/**
 * moderationDecisions — regression pin (source-anchored).
 *
 * CEO DEEP-LOGIC §16, §17, §18.
 *
 * These pins lock the shape of the WARN_BEFORE_SEND handshake so it
 * can't drift back into the prior fail-hidden pattern where WARN
 * silently sent. They also test the sign/verify round-trip end-to-
 * end since the module is pure of DB — the tests can exercise the
 * actual runtime, not just the source.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

import {
  hashSafeContent,
  issueWarningToken,
  verifyWarningToken,
  buildAllowNoticePayload,
} from '../services/marketplace/moderationDecisions';

const SRC = fs.readFileSync(
  path.resolve(__dirname, '..', 'services', 'marketplace', 'moderationDecisions.ts'),
  'utf8',
);

describe('handshake contract shape', () => {
  it('exports the handshake API', () => {
    expect(SRC).toMatch(/export function issueWarningToken/);
    expect(SRC).toMatch(/export function verifyWarningToken/);
    expect(SRC).toMatch(/export function hashSafeContent/);
    expect(SRC).toMatch(/export function buildAllowNoticePayload/);
  });

  it('bindings include sender, thread, body hash, policy version, category', () => {
    expect(SRC).toMatch(/export interface WarningTokenBindings\s*\{[\s\S]{0,400}senderUid: string;[\s\S]{0,400}threadId: string;[\s\S]{0,400}safeContentHash: string;[\s\S]{0,400}policyVersion: string;[\s\S]{0,400}category: PolicyCategory;/);
  });

  it('the raw body is NOT stored in the token — only its hash (§20 retention discipline)', () => {
    // The token payload should NEVER carry the message body; only the
    // sha256 hash of the sanitized body. Verify by inspecting the
    // DecodedToken shape.
    const idx = SRC.indexOf('interface DecodedToken');
    const end = SRC.indexOf('}', idx);
    const body = SRC.slice(idx, end);
    expect(body).not.toMatch(/\bbody\b|\braw\b|safeContent\b/);
  });
});

describe('sign / verify round-trip', () => {
  const bindings = {
    senderUid: 'nir_uid',
    threadId: 'thread_1',
    safeContentHash: hashSafeContent('call me at 050-1234567'),
    policyVersion: 'mpe-2026-08-29',
    category: 'CONTACT_EXCHANGE' as const,
  };

  it('a fresh token verifies against its own bindings', () => {
    const token = issueWarningToken(bindings);
    const verdict = verifyWarningToken(token, bindings);
    expect(verdict).toEqual({ ok: true });
  });

  it('body drift → body_mismatch (client can\'t reuse token for a different message)', () => {
    const token = issueWarningToken(bindings);
    const drifted = { ...bindings, safeContentHash: hashSafeContent('DIFFERENT MESSAGE') };
    const verdict = verifyWarningToken(token, drifted);
    expect(verdict).toEqual({ ok: false, reason: 'body_mismatch' });
  });

  it('sender drift → sender_mismatch (Nir cannot ride Sarah\'s token)', () => {
    const token = issueWarningToken(bindings);
    const drifted = { ...bindings, senderUid: 'sarah_uid' };
    const verdict = verifyWarningToken(token, drifted);
    expect(verdict).toEqual({ ok: false, reason: 'sender_mismatch' });
  });

  it('thread drift → thread_mismatch', () => {
    const token = issueWarningToken(bindings);
    const verdict = verifyWarningToken(token, { ...bindings, threadId: 'other_thread' });
    expect(verdict).toEqual({ ok: false, reason: 'thread_mismatch' });
  });

  it('policy version drift → policy_version_mismatch', () => {
    const token = issueWarningToken(bindings);
    const verdict = verifyWarningToken(token, { ...bindings, policyVersion: 'mpe-2025-01-01' });
    expect(verdict).toEqual({ ok: false, reason: 'policy_version_mismatch' });
  });

  it('category drift → category_mismatch (can\'t reuse a warning for a different category)', () => {
    const token = issueWarningToken(bindings);
    const verdict = verifyWarningToken(token, { ...bindings, category: 'OFF_PLATFORM_PAYMENT' });
    expect(verdict).toEqual({ ok: false, reason: 'category_mismatch' });
  });

  it('expired token → expired', () => {
    const past = Date.now() - 30 * 60 * 1000; // 30 min ago (TTL is 15 min)
    const token = issueWarningToken(bindings, past);
    const verdict = verifyWarningToken(token, bindings);
    expect(verdict).toEqual({ ok: false, reason: 'expired' });
  });

  it('missing / malformed token → missing / malformed (client must request one first)', () => {
    expect(verifyWarningToken(undefined, bindings)).toEqual({ ok: false, reason: 'missing' });
    expect(verifyWarningToken('', bindings)).toEqual({ ok: false, reason: 'missing' });
    expect(verifyWarningToken('not_a_token', bindings)).toEqual({ ok: false, reason: 'malformed' });
  });

  it('tampered signature → bad_signature', () => {
    const token = issueWarningToken(bindings);
    const tampered = token.slice(0, -3) + 'XYZ';
    const verdict = verifyWarningToken(tampered, bindings);
    expect(verdict).toEqual({ ok: false, reason: 'bad_signature' });
  });
});

describe('buildAllowNoticePayload (§18)', () => {
  it('returns the ALLOW_WITH_NOTICE code + category', () => {
    expect(buildAllowNoticePayload('OFF_PLATFORM_PAYMENT')).toEqual({
      noticeCode: 'ALLOW_WITH_NOTICE',
      category: 'OFF_PLATFORM_PAYMENT',
    });
  });

  it('missing category → null (never undefined — client can rely on the field)', () => {
    expect(buildAllowNoticePayload()).toEqual({
      noticeCode: 'ALLOW_WITH_NOTICE',
      category: null,
    });
  });
});
