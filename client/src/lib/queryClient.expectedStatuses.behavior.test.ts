/**
 * apiRequest expectedStatuses — a status the caller declared normal is
 * returned, not logged as "[API Error]" and not thrown.
 *
 * Live QA 2026-09-09: GET /api/journey/checkpoint/:domain answers 404
 * NO_ACTIVE_CHECKPOINT on every first visit (pinned by server tests + e2e
 * stubs), and the client logged each as an API error.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';

vi.mock('./firebase', () => ({ getAppCheckToken: async () => null, auth: {} }));
// The [API Error] console line is gated on `typeof window !== 'undefined'`.
(globalThis as any).window = (globalThis as any).window ?? {};

import { throwIfResNotOk } from './queryClient';

const res = (status: number, body = '{"error":"NO_ACTIVE_CHECKPOINT"}') =>
  new Response(body, { status, headers: { 'x-trace-id': 't1' } });

describe('throwIfResNotOk with expectedStatuses', () => {
  afterEach(() => vi.restoreAllMocks());

  it('returns quietly for an expected status', async () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    await expect(throwIfResNotOk(res(404), [404])).resolves.toBeUndefined();
    expect(err).not.toHaveBeenCalled();
  });

  it('still logs and throws for an unexpected status', async () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    await expect(throwIfResNotOk(res(404), [])).rejects.toMatchObject({ status: 404 });
    expect(err).toHaveBeenCalledTimes(1);
  });

  it('a 500 is never swallowed by a 404 expectation', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    await expect(throwIfResNotOk(res(500, '{}'), [404])).rejects.toMatchObject({ status: 500 });
  });

  it('the checkpoint hook declares 404 as expected', async () => {
    const fs = await import('node:fs'); const path = await import('node:path');
    const src = fs.readFileSync(path.resolve(__dirname, '../hooks/useJourneyCheckpoint.ts'), 'utf8');
    expect(src).toMatch(/apiRequest\('GET', `\/api\/journey\/checkpoint\/\$\{domain\}`, undefined, \{ expectedStatuses: \[404\] \}\)/);
  });
});
