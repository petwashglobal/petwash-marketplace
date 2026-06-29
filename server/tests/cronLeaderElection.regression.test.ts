/**
 * All ~40 background crons share acquireLock/releaseLock. On Cloud Run (many
 * instances) the in-process Map can't coordinate, so the lock must be Redis-backed
 * (atomic SET NX EX) — exactly one instance runs each cron tick — with graceful
 * in-process fallback when Redis is down. One change here covers every job.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
const SRC = readFileSync(resolve(__dirname, '..', 'backgroundJobs.ts'), 'utf8');

describe('cron leader election (cross-instance lock)', () => {
  it('acquireLock uses Redis SET NX with a TTL safety net', () => {
    expect(SRC).toMatch(/redis\.setNx\(`cron:lock:\$\{jobName\}`/);
    expect(SRC).toMatch(/LOCK_TTL_SECONDS = 600/);
    expect(SRC).toMatch(/if \(redis\.isConnected\(\)\)/);
  });
  it('falls back to the in-process Map when Redis is down', () => {
    expect(SRC).toMatch(/falling back to in-process|falling back/i);
    expect(SRC).toMatch(/this\.jobLocks\.set\(jobName, true\)/);
  });
  it('releaseLock clears the Redis lock', () => {
    expect(SRC).toMatch(/redis\.del\(`cron:lock:\$\{jobName\}`\)/);
  });
});
