/**
 * SupportCaseAutoCloseEvaluator — Program 13 auto-close timing.
 */
import { describe, it, expect } from 'vitest';
import { evaluateAutoClose } from '../services/marketplace/SupportCaseAutoCloseEvaluator';

const now = new Date('2026-09-15T00:00:00Z');
const resolvedNDaysAgo = (n: number) => new Date(now.getTime() - n * 24 * 60 * 60 * 1000).toISOString();

describe('SupportCaseAutoCloseEvaluator', () => {
  it('RESOLVED 20 days ago + 14-day policy → AUTO_CLOSE', () => {
    const out = evaluateAutoClose({
      status: 'RESOLVED',
      resolvedAt: resolvedNDaysAgo(20),
      now,
      autoCloseAfterDays: 14,
    });
    expect(out.code).toBe('AUTO_CLOSE');
  });

  it('RESOLVED 5 days ago + 14-day policy → STAY_OPEN(WINDOW_NOT_ELAPSED)', () => {
    const out = evaluateAutoClose({
      status: 'RESOLVED',
      resolvedAt: resolvedNDaysAgo(5),
      now,
      autoCloseAfterDays: 14,
    });
    expect(out.code).toBe('STAY_OPEN');
    if (out.code !== 'STAY_OPEN') throw new Error();
    expect(out.reasonCode).toBe('WINDOW_NOT_ELAPSED');
  });

  it('opener reopened → STAY_OPEN(REOPENED)', () => {
    const out = evaluateAutoClose({
      status: 'RESOLVED',
      resolvedAt: resolvedNDaysAgo(30),
      now,
      autoCloseAfterDays: 14,
      hasOpenerReopened: true,
    });
    expect(out.code).toBe('STAY_OPEN');
    if (out.code !== 'STAY_OPEN') throw new Error();
    expect(out.reasonCode).toBe('REOPENED');
  });

  it('policy undecided → STAY_OPEN(POLICY_NOT_CONFIGURED) (§21-§22)', () => {
    const out = evaluateAutoClose({
      status: 'RESOLVED',
      resolvedAt: resolvedNDaysAgo(30),
      now,
    });
    if (out.code !== 'STAY_OPEN') throw new Error();
    expect(out.reasonCode).toBe('POLICY_NOT_CONFIGURED');
  });

  it('already CLOSED → STAY_OPEN(ALREADY_CLOSED)', () => {
    const out = evaluateAutoClose({ status: 'CLOSED', autoCloseAfterDays: 14, now });
    if (out.code !== 'STAY_OPEN') throw new Error();
    expect(out.reasonCode).toBe('ALREADY_CLOSED');
  });

  it('not yet RESOLVED (OPEN / ADMIN_ASSIGNED / PENDING_ACTOR) → NOT_RESOLVED', () => {
    for (const status of ['OPEN', 'ADMIN_ASSIGNED', 'PENDING_ACTOR'] as const) {
      const out = evaluateAutoClose({ status, autoCloseAfterDays: 14, now });
      if (out.code !== 'STAY_OPEN') throw new Error();
      expect(out.reasonCode).toBe('NOT_RESOLVED');
    }
  });

  it('RESOLVED without resolvedAt → NOT_RESOLVED', () => {
    const out = evaluateAutoClose({ status: 'RESOLVED', autoCloseAfterDays: 14, now });
    if (out.code !== 'STAY_OPEN') throw new Error();
    expect(out.reasonCode).toBe('NOT_RESOLVED');
  });
});
