/**
 * Task 19 — CEO fire order 101-140.
 *
 * EmailSpendGuard grew a per-recipient rate limit. Bounds the
 * "one user spammed" case (repeated verify-email / password-reset /
 * notification retries) that the existing global counter does not
 * catch until much later.
 *
 * Env knobs:
 *   EMAIL_GUARD_PER_RECIPIENT_WINDOW_MS  (default 300000 — 5 min)
 *   EMAIL_GUARD_PER_RECIPIENT_LIMIT      (default 5)
 *   EMAIL_GUARD_PER_RECIPIENT_MAX_MAP    (default 5000)
 *
 * Behavior: after LIMIT sends within WINDOW to the same recipient
 * (case-insensitive, whitespace-trimmed), further check() returns
 * { allowed: false, reason: 'Per-recipient rate limit …' } until at
 * least one prior timestamp scrolls outside the window.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const SRC = readFileSync(
  resolve(__dirname, '..', 'services', 'EmailSpendGuard.ts'),
  'utf8',
);

describe('EmailSpendGuard per-recipient rate limit (source pin)', () => {
  it('declares the three tunable env knobs', () => {
    expect(SRC).toMatch(/EMAIL_GUARD_PER_RECIPIENT_WINDOW_MS/);
    expect(SRC).toMatch(/EMAIL_GUARD_PER_RECIPIENT_LIMIT/);
    expect(SRC).toMatch(/EMAIL_GUARD_PER_RECIPIENT_MAX_MAP/);
  });

  it('defaults are sensible (5 in 5 min, 5000 recipients cap)', () => {
    expect(SRC).toMatch(/PER_RECIPIENT_WINDOW_MS[^\n]*'300000'/);
    expect(SRC).toMatch(/PER_RECIPIENT_LIMIT[^\n]*'5'/);
    expect(SRC).toMatch(/PER_RECIPIENT_MAX_MAP[^\n]*'5000'/);
  });

  it('perRecipient map is defined on the guard', () => {
    expect(SRC).toMatch(/private perRecipient:\s*Map<string,\s*number\[\]>/);
  });

  it('check() rejects sends over the per-recipient limit', () => {
    expect(SRC).toContain('PER-RECIPIENT LIMIT');
    expect(SRC).toContain("reason: `Per-recipient rate limit (${timestamps.length}/${PER_RECIPIENT_LIMIT} in ${PER_RECIPIENT_WINDOW_MS}ms)`");
  });

  it('record() maintains the sliding window and evicts to stay under the cap', () => {
    expect(SRC).toContain('this.perRecipient.set(recip, timestamps)');
    expect(SRC).toContain('this.perRecipient.size > PER_RECIPIENT_MAX_MAP');
    expect(SRC).toContain('this.perRecipient.delete(oldestKey)');
  });

  it('recipient key is normalised (lowercase + trim)', () => {
    expect(SRC).toMatch(/\(recipient\s*\|\|\s*''\)\.toLowerCase\(\)\.trim\(\)/);
  });

  it('existing global hourly + daily circuit still intact', () => {
    // Not disturbed by the additive per-recipient dimension.
    expect(SRC).toMatch(/HOURLY_BLOCK/);
    expect(SRC).toMatch(/DAILY_BLOCK/);
    expect(SRC).toContain('CIRCUIT OPEN — hourly block');
    expect(SRC).toContain('CIRCUIT OPEN — daily block');
  });
});

describe('EmailSpendGuard per-recipient rate limit (runtime behaviour)', () => {
  let guard: any;
  beforeAll(async () => {
    // Set very small knobs before the singleton constructs (module reads env at import).
    process.env.EMAIL_GUARD_PER_RECIPIENT_WINDOW_MS = '60000';   // 1 min
    process.env.EMAIL_GUARD_PER_RECIPIENT_LIMIT     = '3';
    process.env.EMAIL_GUARD_PER_RECIPIENT_MAX_MAP   = '10';
    // Wide global limits so we test the per-recipient dimension alone.
    process.env.EMAIL_GUARD_HOURLY_BLOCK = '10000';
    process.env.EMAIL_GUARD_DAILY_BLOCK  = '10000';
    process.env.EMAIL_GUARD_HOURLY_WARN  = '9999';
    process.env.EMAIL_GUARD_DAILY_WARN   = '9999';
    // Fresh import to pick up the env vars in module-level const assignments.
    const mod = await import('../services/EmailSpendGuard?rt=' + Date.now());
    guard = mod.default ?? mod.emailSpendGuard;
  });

  it('allows the first N sends per recipient', async () => {
    const RECIP = 'test-user@example.com';
    for (let i = 0; i < 3; i++) {
      const r = guard.check('unit-test', RECIP);
      expect(r.allowed, `send ${i + 1} should be allowed`).toBe(true);
      await guard.record('unit-test', RECIP, `subject ${i + 1}`);
    }
  });

  it('blocks the N+1th send per recipient', () => {
    const RECIP = 'test-user@example.com';
    const r = guard.check('unit-test', RECIP);
    expect(r.allowed).toBe(false);
    expect(r.reason).toMatch(/Per-recipient rate limit/);
  });

  it('a different recipient is unaffected', () => {
    const OTHER = 'other-user@example.com';
    const r = guard.check('unit-test', OTHER);
    expect(r.allowed).toBe(true);
  });

  it('case + whitespace variants of the same recipient share the counter', () => {
    const r = guard.check('unit-test', '  TEST-User@Example.COM  ');
    expect(r.allowed).toBe(false);
    expect(r.reason).toMatch(/Per-recipient rate limit/);
  });
});
