/**
 * Tests for fetchWithRetry — covers the cold-start 503 retry budget.
 *
 * P0 production blocker fix. The server gates /api/* with a
 * startup-readiness middleware that returns 503 until routes finish
 * mounting on a Cloud Run cold start. The client must absorb this
 * with bounded retries instead of surfacing the raw 503 immediately.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fetchWithRetry, FETCH_RETRY_503_DELAYS_MS } from './fetchWithRetry';

describe('fetchWithRetry', () => {
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
    vi.useFakeTimers();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.useRealTimers();
  });

  it('retry budget is 5 attempts with bounded exponential backoff', () => {
    expect(FETCH_RETRY_503_DELAYS_MS).toEqual([800, 1600, 3200, 6400, 10000]);
  });

  it('total retry budget is under 25 seconds', () => {
    const total = FETCH_RETRY_503_DELAYS_MS.reduce((s, d) => s + d, 0);
    expect(total).toBeLessThanOrEqual(25000);
  });

  it('returns immediately on a 200 response (no retries)', async () => {
    const fetchSpy = vi.fn().mockResolvedValue(new Response('ok', { status: 200 }));
    globalThis.fetch = fetchSpy as any;
    const res = await fetchWithRetry('/api/test', {});
    expect(res.status).toBe(200);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('does not retry on a 4xx response', async () => {
    const fetchSpy = vi.fn().mockResolvedValue(new Response('nope', { status: 404 }));
    globalThis.fetch = fetchSpy as any;
    const res = await fetchWithRetry('/api/test', {});
    expect(res.status).toBe(404);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('does not retry on a non-503 5xx response', async () => {
    const fetchSpy = vi.fn().mockResolvedValue(new Response('boom', { status: 500 }));
    globalThis.fetch = fetchSpy as any;
    const res = await fetchWithRetry('/api/test', {});
    expect(res.status).toBe(500);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('retries up to 5 times on persistent 503 then surfaces the 503', async () => {
    const fetchSpy = vi
      .fn()
      .mockResolvedValue(new Response('starting', { status: 503 }));
    globalThis.fetch = fetchSpy as any;

    const promise = fetchWithRetry('/api/test', {});
    // Advance through every delay in the budget plus a generous tail.
    for (const d of FETCH_RETRY_503_DELAYS_MS) {
      await vi.advanceTimersByTimeAsync(d);
    }
    const res = await promise;

    expect(res.status).toBe(503);
    // 1 initial + configured retries
    expect(fetchSpy).toHaveBeenCalledTimes(1 + FETCH_RETRY_503_DELAYS_MS.length);
  });

  it('returns the first 200 if a 503 then 200 is observed', async () => {
    const fetchSpy = vi
      .fn()
      .mockResolvedValueOnce(new Response('starting', { status: 503 }))
      .mockResolvedValueOnce(new Response('ok', { status: 200 }));
    globalThis.fetch = fetchSpy as any;

    const promise = fetchWithRetry('/api/test', {});
    await vi.advanceTimersByTimeAsync(FETCH_RETRY_503_DELAYS_MS[0]);
    const res = await promise;

    expect(res.status).toBe(200);
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it('rejects cross-origin absolute URLs (SSRF guard preserved)', async () => {
    if (typeof window === 'undefined') {
      return; // SSRF guard is window-scoped; skip in pure-node mode
    }
    const fetchSpy = vi.fn();
    globalThis.fetch = fetchSpy as any;
    await expect(
      fetchWithRetry('https://evil.example.com/api/test', {}),
    ).rejects.toThrow(/Blocked request/);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
  // 2026-09-13 — native apps: page origin is capacitor://localhost, API is
  // https://petwash.co.il. The guard blocked every call in TestFlight build 15.
  it('allows our own API origin from a native (capacitor://localhost) page', async () => {
    const fetchSpy = vi.fn().mockResolvedValue(new Response('ok', { status: 200 }));
    globalThis.fetch = fetchSpy as any;
    const prevWindow = (globalThis as any).window;
    (globalThis as any).window = { location: { origin: 'capacitor://localhost' } };
    try {
      const res = await fetchWithRetry('https://petwash.co.il/api/prestige-pass/me', {});
      expect(res.status).toBe(200);
      await expect(fetchWithRetry('https://evil.example.com/api/x', {})).rejects.toThrow(/Blocked request/);
    } finally {
      (globalThis as any).window = prevWindow;
    }
  });

  it('does NOT replay a deliberate 503 on a POST (e.g. ONLINE_CARD_NOT_LIVE)', async () => {
    const fetchSpy = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ errorCode: 'ONLINE_CARD_NOT_LIVE' }), { status: 503 }),
    );
    globalThis.fetch = fetchSpy as any;
    const res = await fetchWithRetry('/api/booking-requests/x/pay', { method: 'POST' });
    expect(res.status).toBe(503);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('still retries a POST that hit the cold-start SERVICE_STARTING 503', async () => {
    const fetchSpy = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: 'SERVICE_STARTING' }), { status: 503 }))
      .mockResolvedValueOnce(new Response('ok', { status: 200 }));
    globalThis.fetch = fetchSpy as any;
    const p = fetchWithRetry('/api/x', { method: 'POST' });
    await vi.advanceTimersByTimeAsync(FETCH_RETRY_503_DELAYS_MS[0]);
    const res = await p;
    expect(res.status).toBe(200);
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });
});
