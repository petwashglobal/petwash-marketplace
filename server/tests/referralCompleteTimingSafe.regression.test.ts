/**
 * Referral /complete secret compare — timing-safety pin (2026-09-06 sweep).
 *
 * POST /api/referral/complete MINTS REFERRAL CREDIT and is guarded by the
 * shared PETWASH_ADMIN_SECRET. It compared with plain `!==`:
 *
 *     if (!process.env.PETWASH_ADMIN_SECRET || adminSecret !== process.env.PETWASH_ADMIN_SECRET)
 *
 * which is the exact timing oracle lib/admin-secret.ts was extracted to
 * remove ("P1-FIX: Every call site used === which leaks secret length and
 * prefix information via timing. An attacker can binary-search the secret.").
 * A money-minting route should not be the one place still using it.
 *
 * Lower severity than the rest of the sweep — the route was authenticated,
 * just weakly compared — so it is pinned rather than left as a comment.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { isValidAdminSecret } from '../lib/admin-secret';

const SRC = fs.readFileSync(
  path.resolve(__dirname, '..', 'routes', 'referral.ts'),
  'utf8',
);

describe('referral /complete uses the canonical constant-time compare', () => {
  it('no plain !== comparison against the secret remains', () => {
    expect(SRC).not.toMatch(/adminSecret !== process\.env\.PETWASH_ADMIN_SECRET/);
  });

  it('delegates to isValidAdminSecret with the right env var', () => {
    expect(SRC).toMatch(/isValidAdminSecret\(req, "PETWASH_ADMIN_SECRET"\)/);
    expect(SRC).toContain('import { isValidAdminSecret } from "../lib/admin-secret"');
  });
});

describe('isValidAdminSecret honours a custom env var and fails closed', () => {
  const ORIG = process.env.PETWASH_ADMIN_SECRET;
  const SECRET = 'referral-admin-secret-under-test';
  const reqWith = (h: Record<string, any>): any => ({ headers: h });

  beforeEach(() => { process.env.PETWASH_ADMIN_SECRET = SECRET; });
  afterEach(() => {
    if (ORIG === undefined) delete process.env.PETWASH_ADMIN_SECRET;
    else process.env.PETWASH_ADMIN_SECRET = ORIG;
  });

  it('accepts the genuine secret', () => {
    expect(isValidAdminSecret(reqWith({ 'x-admin-secret': SECRET }), 'PETWASH_ADMIN_SECRET')).toBe(true);
  });

  it('rejects wrong, near-miss, prefix and superstring values', () => {
    const bad = [
      'anything',
      SECRET.slice(0, -1) + 'X',   // right length, one char off
      SECRET.slice(0, 10),          // prefix
      SECRET + 'x',                 // superstring
      '',
    ];
    for (const v of bad) {
      expect(isValidAdminSecret(reqWith({ 'x-admin-secret': v }), 'PETWASH_ADMIN_SECRET'), v).toBe(false);
    }
  });

  it('rejects a missing header', () => {
    expect(isValidAdminSecret(reqWith({}), 'PETWASH_ADMIN_SECRET')).toBe(false);
  });

  it('fails closed when the env var is unset', () => {
    delete process.env.PETWASH_ADMIN_SECRET;
    expect(isValidAdminSecret(reqWith({ 'x-admin-secret': 'anything' }), 'PETWASH_ADMIN_SECRET')).toBe(false);
  });
});
