import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { whoamiRetry } from '../auth/useWhoami';

/**
 * 2026-09-17: the CEO's browser asked /api/session/whoami 13 times in a row.
 * useWhoami retried EVERY failure twice — including a 401, which is the
 * server's answer, not a blip. Only failures that can heal are retried now.
 */
describe('whoamiRetry', () => {
  it('never repeats a 4xx answer', () => {
    for (const status of [400, 401, 403, 404, 429]) {
      expect(whoamiRetry(0, { status })).toBe(false);
    }
  });
  it('retries network errors, 5xx and cold-start 503 — at most twice', () => {
    for (const err of [new TypeError('Failed to fetch'), { status: 500 }, { status: 503 }, null]) {
      expect(whoamiRetry(0, err)).toBe(true);
      expect(whoamiRetry(1, err)).toBe(true);
      expect(whoamiRetry(2, err)).toBe(false);
    }
  });
  it('is the retry rule the hook actually uses', () => {
    const src = readFileSync(resolve(__dirname, '../auth/useWhoami.ts'), 'utf8');
    expect(src).toContain('retry: whoamiRetry,');
    expect(src).not.toMatch(/retry:\s*2,/);
  });
});
