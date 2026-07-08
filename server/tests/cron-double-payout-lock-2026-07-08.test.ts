/**
 * Cron double-payout instance-lock — regression pins (2026-07-08).
 *
 * CRITICAL finding: the auto-approve-completions and monthly-settlements crons
 * are scheduled directly (cron.schedule) OUTSIDE BackgroundJobProcessor's own
 * leader-elected schedule, so they ran on EVERY Cloud Run replica. Two replicas
 * on the same tick both processed the same booking / period and could
 * double-create a provider earning / partner settlement (the SELECT-then-INSERT
 * idempotency in createEarningRecord is lockless).
 *
 * Fix: a PUBLIC BackgroundJobProcessor.runWithLock(jobName, fn) wraps both crons
 * — Redis leader election means exactly one replica runs each tick. It is
 * fail-safe: acquireLock falls back to the in-process Map (returns true) when
 * Redis is down, so a single instance still runs — the lock can only
 * de-duplicate across replicas, never STOP payouts. The lock is always released
 * (finally).
 *
 * NOT covered here (flagged): the cross-path race (cron vs the confirm-completion
 * route vs the Nayax webhook all calling createEarningRecord) still wants a
 * backing unique index on contractor_earnings — that is a live money-ledger
 * migration needing a prod duplicate-scan first.
 *
 * Source-level pins (same style as credit-wallet-confirm-idor.test.ts).
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const BG = fs.readFileSync(path.resolve(__dirname, '..', 'backgroundJobs.ts'), 'utf8');
const AUTO = fs.readFileSync(path.resolve(__dirname, '..', 'cron', 'auto-approve-completions.ts'), 'utf8');
const SETTLE = fs.readFileSync(path.resolve(__dirname, '..', 'cron', 'monthly-settlements.ts'), 'utf8');

describe('cron double-payout instance-lock (2026-07-08)', () => {
  it('runWithLock is a public leader-elected wrapper that acquires then always releases', () => {
    expect(BG).toMatch(/static async runWithLock\(jobName: string, fn: \(\) => Promise<unknown>\)/);
    expect(BG).toMatch(/if \(!\(await this\.acquireLock\(jobName\)\)\) return/);
    expect(BG).toMatch(/finally \{\s*\n\s*this\.releaseLock\(jobName\)/);
  });

  it('auto-approve cron runs BOTH its tick and startup scan under the lock', () => {
    const wraps = AUTO.match(/runWithLock\('autoApproveCompletions',\s*autoApproveExpiredCompletions\)/g) ?? [];
    expect(wraps.length).toBe(2);
  });

  it('monthly-settlements cron runs under the lock', () => {
    expect(SETTLE).toMatch(/runWithLock\('monthlySettlements',\s*generateMonthlySettlements\)/);
  });

  it('both crons resolve the processor via dynamic import (no top-level import cycle)', () => {
    expect(AUTO).toMatch(/const \{ BackgroundJobProcessor \} = await import\('\.\.\/backgroundJobs'\)/);
    expect(SETTLE).toMatch(/const \{ BackgroundJobProcessor \} = await import\('\.\.\/backgroundJobs'\)/);
  });
});
