/**
 * SUMIT BILLS EVERY API CALL PAST THE QUOTA (2026-09-17).
 *
 * SUMIT emailed Pet Wash on 2026-09-04 ("quota fully used — every further call
 * is charged") and 2026-09-09 ("80% used"). The admin Brain dashboard polls its
 * summary every 60 s, and every poll made a live SUMIT getvatrate call just to
 * confirm the key still works: up to 1,440 billed calls a day per open tab.
 *
 * The probe answer is now reused for 6 hours (10 minutes when it failed, so an
 * outage still surfaces), and simultaneous polls share one call.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const connectionTest = vi.fn();
vi.mock('../services/SumitClient', () => ({ sumitClient: { connectionTest: () => connectionTest(), isWired: () => true } }));
vi.mock('../db', () => ({ db: {} }));
vi.mock('../lib/logger', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }));
vi.mock('../middleware/requireBrainAccess', () => ({ requireBrainAccess: (_r: any, _s: any, n: any) => n() }));

import {
  cachedSumitProbe, _resetSumitProbeCache, SUMIT_PROBE_TTL_MS, SUMIT_PROBE_FAILED_TTL_MS,
} from '../routes/admin-brain';

let clock = Date.parse('2026-09-17T08:00:00Z');
const now = () => clock;

beforeEach(() => {
  _resetSumitProbeCache();
  connectionTest.mockReset();
  clock = Date.parse('2026-09-17T08:00:00Z');
});

describe('a healthy key is checked at most every 6 hours', () => {
  it('a full day of 60-second dashboard polling costs 4 SUMIT calls, not 1,440', async () => {
    connectionTest.mockResolvedValue({ ok: true, reachable: true, authRejected: false });
    for (let minute = 0; minute < 24 * 60; minute++) {
      const r = await cachedSumitProbe(now);
      expect(r.ok).toBe(true);
      clock += 60_000;
    }
    expect(connectionTest).toHaveBeenCalledTimes(4);
  });

  it('the answer says when it was checked', async () => {
    connectionTest.mockResolvedValue({ ok: true, reachable: true });
    const r = await cachedSumitProbe(now);
    expect(r.checkedAt).toBe('2026-09-17T08:00:00.000Z');
    clock += SUMIT_PROBE_TTL_MS - 1;
    expect((await cachedSumitProbe(now)).checkedAt).toBe('2026-09-17T08:00:00.000Z');
  });
});

describe('a failing key is re-checked soon, so an outage is not hidden for 6 hours', () => {
  it('retries after 10 minutes', async () => {
    connectionTest.mockResolvedValueOnce({ ok: false, reachable: true, authRejected: true, reason: '401' });
    connectionTest.mockResolvedValueOnce({ ok: true, reachable: true });
    expect((await cachedSumitProbe(now)).ok).toBe(false);
    clock += SUMIT_PROBE_FAILED_TTL_MS - 1;
    expect((await cachedSumitProbe(now)).ok).toBe(false);
    expect(connectionTest).toHaveBeenCalledTimes(1);
    clock += 2;
    expect((await cachedSumitProbe(now)).ok).toBe(true);
    expect(connectionTest).toHaveBeenCalledTimes(2);
  });

  it('a thrown error is a failure, not a crash', async () => {
    connectionTest.mockRejectedValueOnce(new Error('network down'));
    const r = await cachedSumitProbe(now);
    expect(r).toMatchObject({ ran: true, ok: false });
  });
});

describe('several admins polling at the same moment share one call', () => {
  it('10 simultaneous polls → 1 SUMIT call', async () => {
    let release!: (v: any) => void;
    connectionTest.mockImplementation(() => new Promise((r) => { release = r; }));
    const polls = Array.from({ length: 10 }, () => cachedSumitProbe(now));
    release({ ok: true, reachable: true });
    const results = await Promise.all(polls);
    expect(results.every((x) => x.ok)).toBe(true);
    expect(connectionTest).toHaveBeenCalledTimes(1);
  });
});

describe('wiring', () => {
  it('the summary uses the cache; only the manual test button calls SUMIT live', () => {
    const brain = readFileSync(join(__dirname, '../routes/admin-brain.ts'), 'utf8');
    const i = brain.indexOf('async function loadPayments()');
    const body = brain.slice(i, i + 3000);
    expect(body).toContain('liveProbe = await cachedSumitProbe();');
    expect(body).not.toContain('sumitClient.connectionTest()');
    expect(readFileSync(join(__dirname, '../routes/admin-sumit.ts'), 'utf8')).toContain('sumitClient.connectionTest()');
  });
});
