/**
 * Regression pin — K9000 bay-claim atomicity (X-ray P2, 2026-07-25).
 *
 * Both bay-claim UPDATEs (openBaySession + debitAndLog) matched only on bay id,
 * with no status guard and no rowcount check — two simultaneous redemptions on
 * one bay both flipped it busy and the second orphaned the first session. The
 * claim is now conditional on the bay not being blocked, and asserts exactly one
 * row changed, throwing (→ rollback) otherwise.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const src = readFileSync(join(__dirname, '..', 'services', 'K9000RedemptionService.ts'), 'utf8');

describe('K9000 bay claim is atomic (P2)', () => {
  it('both bay claims guard on the not-blocked status list', () => {
    const guards = src.match(/notInArray\(stationBays\.status, CLAIM_BLOCKED_BAY_STATUSES\)/g) || [];
    expect(guards.length).toBe(2);
  });
  it('both claims assert exactly one row changed', () => {
    const checks = src.match(/claimed\.length\s*!==\s*1/g) || [];
    expect(checks.length).toBe(2);
  });
  it('the blocked-status list matches assessBayReadiness', () => {
    expect(src).toMatch(/CLAIM_BLOCKED_BAY_STATUSES = \['busy', 'cleanup', 'fault', 'maintenance', 'offline'\]/);
  });
});
