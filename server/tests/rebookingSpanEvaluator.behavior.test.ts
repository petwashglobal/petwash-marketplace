/**
 * RebookingSpanEvaluator — Program 29 companion.
 */
import { describe, it, expect } from 'vitest';
import { buildRebookSpan } from '../services/marketplace/RebookingSpanEvaluator';

describe('RebookingSpanEvaluator', () => {
  it('WEEKLY cadence → 4 candidates 7 days apart, all future', () => {
    const out = buildRebookSpan({
      priorStartAt: '2026-08-01T10:00:00Z',
      cadence: 'WEEKLY',
      now: new Date('2026-08-30T00:00:00Z'),
    });
    expect(out.code).toBe('OK');
    if (out.code !== 'OK') throw new Error();
    expect(out.candidates).toHaveLength(4);
    // First candidate should be Sept 5 (>= now on Aug 30) — 5 weekly steps
    // past 2026-08-01: 08-08, 08-15, 08-22, 08-29, 09-05.
    expect(out.candidates[0]).toBe('2026-09-05T10:00:00.000Z');
    expect(out.candidates[1]).toBe('2026-09-12T10:00:00.000Z');
  });

  it('BIWEEKLY → 14-day increments', () => {
    const out = buildRebookSpan({
      priorStartAt: '2026-09-01T10:00:00Z',
      cadence: 'BIWEEKLY',
      now: new Date('2026-08-30T00:00:00Z'),
      numberOfCandidates: 2,
    });
    if (out.code !== 'OK') throw new Error();
    expect(out.candidates).toEqual([
      '2026-09-15T10:00:00.000Z',
      '2026-09-29T10:00:00.000Z',
    ]);
  });

  it('MONTHLY → month increments', () => {
    const out = buildRebookSpan({
      priorStartAt: '2026-09-01T10:00:00Z',
      cadence: 'MONTHLY',
      now: new Date('2026-08-30T00:00:00Z'),
      numberOfCandidates: 3,
    });
    if (out.code !== 'OK') throw new Error();
    expect(out.candidates[0]).toBe('2026-10-01T10:00:00.000Z');
    expect(out.candidates[1]).toBe('2026-11-01T10:00:00.000Z');
    expect(out.candidates[2]).toBe('2026-12-01T10:00:00.000Z');
  });

  it('CUSTOM_DAYS uses caller-supplied interval', () => {
    const out = buildRebookSpan({
      priorStartAt: '2026-08-30T10:00:00Z',
      cadence: 'CUSTOM_DAYS',
      customIntervalDays: 3,
      now: new Date('2026-08-30T00:00:00Z'),
      numberOfCandidates: 2,
    });
    if (out.code !== 'OK') throw new Error();
    expect(out.candidates).toEqual([
      '2026-09-02T10:00:00.000Z',
      '2026-09-05T10:00:00.000Z',
    ]);
  });

  it('CUSTOM_DAYS without customIntervalDays → INVALID_INPUT', () => {
    const out = buildRebookSpan({
      priorStartAt: '2026-08-30T10:00:00Z',
      cadence: 'CUSTOM_DAYS',
      now: new Date('2026-08-30T00:00:00Z'),
    });
    expect(out.code).toBe('INVALID_INPUT');
    if (out.code !== 'INVALID_INPUT') throw new Error();
    expect(out.reasonCode).toBe('BAD_CUSTOM_DAYS');
  });

  it('bad prior date → INVALID_INPUT(BAD_PRIOR)', () => {
    const out = buildRebookSpan({
      priorStartAt: 'not-a-date',
      cadence: 'WEEKLY',
    });
    expect(out.code).toBe('INVALID_INPUT');
  });

  it('numberOfCandidates clamped to [1, 12]', () => {
    const tooMany = buildRebookSpan({
      priorStartAt: '2026-09-01T10:00:00Z',
      cadence: 'WEEKLY',
      numberOfCandidates: 999,
      now: new Date('2026-08-30T00:00:00Z'),
    });
    if (tooMany.code !== 'OK') throw new Error();
    expect(tooMany.candidates).toHaveLength(12);
  });
});
