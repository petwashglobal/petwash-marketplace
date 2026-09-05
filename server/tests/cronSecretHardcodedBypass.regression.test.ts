/**
 * Hardcoded-literal-as-secret bypass — regression pin (2026-09-06 sweep).
 *
 * THE BUG: POST /api/prestige-pass/admin/wallet/disputes/auto-escalate gated on
 *
 *     if (!isSuperAdminVerified(req) && req.headers['x-internal-job'] !== 'petwash-cron')
 *
 * `'petwash-cron'` is a constant published in the source tree — it is not a
 * secret. Sending `x-internal-job: petwash-cron` bypassed the super-admin
 * check outright. The router mounts with optionalFirebaseToken (routes.ts),
 * so no login was required either, and CSRF is no barrier (a Bearer header
 * skips it and a token is publicly fetchable from GET /api/csrf-token).
 * The handler mutates dispute_cases (status → 'escalated') and inserts
 * 'critical' rows into finance_alerts — i.e. an anonymous caller could
 * force-escalate every SLA-breached dispute and flood finance alerting.
 *
 * Nothing in the repo ever sent that header, so it was pure attack surface.
 *
 * Pinned here: (a) the literal is gone and the canonical timing-safe
 * CRON_SECRET check is in its place, (b) the helper itself is genuinely
 * fail-closed and constant-time-shaped.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { isValidCronSecret } from '../lib/cron-secret';

const ROUTE_SRC = fs.readFileSync(
  path.resolve(__dirname, '..', 'routes', 'prestige-pass.ts'),
  'utf8',
);

function reqWith(headers: Record<string, any>): any {
  return { headers };
}

describe('auto-escalate no longer accepts a hardcoded literal — source pin', () => {
  it('the published constant is gone from the guard', () => {
    // If this fails, someone re-introduced a source-visible "secret".
    expect(ROUTE_SRC).not.toContain("req.headers['x-internal-job']");
    expect(ROUTE_SRC).not.toContain("'petwash-cron'");
  });

  it('the guard now pairs super-admin with the timing-safe cron secret', () => {
    expect(ROUTE_SRC).toMatch(
      /if \(!isSuperAdminVerified\(req\) && !isValidCronSecret\(req\)\) \{/,
    );
    expect(ROUTE_SRC).toContain("import { isValidCronSecret } from '../lib/cron-secret'");
  });
});

describe('isValidCronSecret — fails closed', () => {
  const ORIGINAL = process.env.CRON_SECRET;

  beforeEach(() => {
    process.env.CRON_SECRET = 'a-real-strong-cron-secret-value';
  });
  afterEach(() => {
    if (ORIGINAL === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = ORIGINAL;
  });

  it('rejects when no header is sent', () => {
    expect(isValidCronSecret(reqWith({}))).toBe(false);
  });

  it('THE PIN: rejects a NON-EMPTY but wrong header value', () => {
    for (const forged of ['petwash-cron', 'anything', 'true', '1', 'cron']) {
      expect(isValidCronSecret(reqWith({ 'x-cron-secret': forged })), forged).toBe(false);
    }
  });

  it('rejects a near-miss: right length, one character off', () => {
    const almost = 'a-real-strong-cron-secret-valuX';
    expect(almost.length).toBe(process.env.CRON_SECRET!.length);
    expect(isValidCronSecret(reqWith({ 'x-cron-secret': almost }))).toBe(false);
  });

  it('rejects a prefix and a superstring (no length oracle, no throw)', () => {
    expect(isValidCronSecret(reqWith({ 'x-cron-secret': 'a-real-strong' }))).toBe(false);
    expect(isValidCronSecret(reqWith({ 'x-cron-secret': process.env.CRON_SECRET + 'x' }))).toBe(false);
  });

  it('rejects everything when CRON_SECRET is unset — fail-closed, not open', () => {
    delete process.env.CRON_SECRET;
    expect(isValidCronSecret(reqWith({ 'x-cron-secret': 'anything' }))).toBe(false);
    expect(isValidCronSecret(reqWith({ 'x-cron-secret': '' }))).toBe(false);
  });

  it('accepts the genuine secret', () => {
    expect(isValidCronSecret(reqWith({ 'x-cron-secret': process.env.CRON_SECRET }))).toBe(true);
  });

  it('handles a duplicated header without throwing', () => {
    expect(isValidCronSecret(reqWith({ 'x-cron-secret': ['wrong', 'alsowrong'] }))).toBe(false);
    expect(isValidCronSecret(reqWith({ 'x-cron-secret': [process.env.CRON_SECRET!] }))).toBe(true);
  });
});
