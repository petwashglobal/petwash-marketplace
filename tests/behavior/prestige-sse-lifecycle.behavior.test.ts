/**
 * BEHAVIORAL coverage for the Prestige SSE stream registry + lifetime fixes
 * (realtime security lane, 2026-09-05).
 *
 * Two defects this pins:
 *
 * 1. `sseClients` was `Map<string, Response>` — ONE response per user. A
 *    second tab silently replaced the first in the map; the displaced
 *    response was never ended (its 20s keepalive ran forever); and when the
 *    OLD tab eventually closed, its handler ran `sseClients.delete(userId)`
 *    and unregistered the user's CURRENTLY LIVE tab, which then stopped
 *    receiving `wash_started` while still looking connected.
 *
 * 2. An SSE stream authenticates ONCE, at connect, and had no lifetime
 *    bound — so it outlived a logout / token revocation for as long as the
 *    tab stayed open. It now ends on a timer, forcing EventSource to
 *    reconnect through the full auth chain.
 */

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import express from 'express';
import cookieParser from 'cookie-parser';
import { createServer, type Server } from 'http';
import type { AddressInfo } from 'net';
import { readFileSync } from 'fs';
import { join } from 'path';

const SESSIONS = new Map<string, { uid: string; email: string; email_verified: boolean }>();

const verifySessionCookie = vi.fn(async (cookie: string) => {
  const d = SESSIONS.get(cookie);
  if (!d) throw new Error('auth/session-cookie-revoked');
  return d as any;
});

vi.mock('../../server/lib/firebase-admin', () => ({
  auth: {
    verifyIdToken: async () => { throw new Error('auth/argument-error'); },
    verifySessionCookie: (...a: any[]) => (verifySessionCookie as any)(...a),
    getUser: async () => ({ displayName: null }),
  },
  db: {
    collection: () => ({
      doc: () => ({ get: async () => ({ exists: false, data: () => ({}) }), set: async () => undefined, update: async () => undefined }),
      where: () => ({ limit: () => ({ get: async () => ({ empty: true, docs: [] }) }) }),
    }),
  },
  firebaseAdmin: {},
  default: {},
}));

import { optionalFirebaseToken } from '../../server/middleware/firebase-auth';
import prestigePassRoutes from '../../server/routes/prestige-pass';

const COOKIE_A = `sessA.${'y'.repeat(200)}`;
SESSIONS.set(COOKIE_A, { uid: 'uid-A', email: 'a@example.com', email_verified: true });

const STREAM = '/api/prestige-pass/session/stream';
let server: Server;
let base: string;

beforeAll(async () => {
  const app = express();
  app.use(cookieParser());
  app.use(express.json());
  app.use('/api/prestige-pass', optionalFirebaseToken, prestigePassRoutes);
  server = createServer(app);
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
}, 60_000);

afterAll(async () => {
  delete process.env.PRESTIGE_SSE_MAX_STREAM_MS;
  await new Promise<void>((r) => server.close(() => r()));
});

interface Stream {
  status: number;
  /** Resolves true when the server ends the response, false on timeout. */
  endedWithin(ms: number): Promise<boolean>;
  abort(): void;
}

async function openStream(cookie: string): Promise<Stream> {
  const ac = new AbortController();
  const res = await fetch(`${base}${STREAM}`, { headers: { cookie: `pw_session=${cookie}` }, signal: ac.signal });
  if (!res.ok || !res.body) {
    ac.abort();
    return { status: res.status, endedWithin: async () => true, abort: () => ac.abort() };
  }

  const reader = res.body.getReader();
  let done = false;
  // Drain continuously so stream completion is observed as it happens.
  const drain = (async () => {
    try {
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const r = await reader.read();
        if (r.done) { done = true; return; }
      }
    } catch { done = true; }
  })();

  return {
    status: res.status,
    endedWithin: async (ms) => {
      await Promise.race([drain, new Promise((r) => setTimeout(r, ms))]);
      return done;
    },
    abort: () => { try { reader.cancel(); } catch { /* noop */ } ac.abort(); },
  };
}

describe('SSE · per-user stream registry', () => {
  it('holds MULTIPLE concurrent streams for one account and evicts the oldest past the cap', async () => {
    const CAP = 4; // SSE_MAX_STREAMS_PER_USER
    const opened: Stream[] = [];
    for (let i = 0; i < CAP; i++) {
      const s = await openStream(COOKIE_A);
      expect(s.status, `stream ${i} should be accepted`).toBe(200);
      opened.push(s);
    }

    // All CAP streams are still open — the old Map<uid, Response> could only
    // ever hold one, so this is the regression that matters.
    for (const [i, s] of opened.entries()) {
      expect(await s.endedWithin(150), `stream ${i} must still be open`).toBe(false);
    }

    // One more → the oldest is ended, not silently orphaned.
    const extra = await openStream(COOKIE_A);
    expect(extra.status).toBe(200);
    expect(await opened[0].endedWithin(1500), 'oldest stream must be ended on eviction').toBe(true);
    expect(await opened[CAP - 1].endedWithin(150), 'newest stream must survive eviction').toBe(false);

    for (const s of opened) s.abort();
    extra.abort();
  }, 30_000);
});

describe('SSE · bounded lifetime forces re-authentication', () => {
  it('ENDS an open stream after the configured maximum lifetime', async () => {
    process.env.PRESTIGE_SSE_MAX_STREAM_MS = '600';
    try {
      const s = await openStream(COOKIE_A);
      expect(s.status).toBe(200);
      expect(await s.endedWithin(150), 'must not end immediately').toBe(false);
      expect(await s.endedWithin(3000), 'must end once the lifetime elapses').toBe(true);
      s.abort();
    } finally {
      delete process.env.PRESTIGE_SSE_MAX_STREAM_MS;
    }
  }, 20_000);

  it('a stream re-opened after logout is refused (the reconnect re-runs auth)', async () => {
    process.env.PRESTIGE_SSE_MAX_STREAM_MS = '600';
    const COOKIE_TMP = `sessTmp.${'y'.repeat(200)}`;
    SESSIONS.set(COOKIE_TMP, { uid: 'uid-tmp', email: 't@example.com', email_verified: true });
    try {
      const s = await openStream(COOKIE_TMP);
      expect(s.status).toBe(200);

      SESSIONS.delete(COOKIE_TMP);                       // user logs out
      expect(await s.endedWithin(3000)).toBe(true);      // server ends the stream
      s.abort();

      const retry = await openStream(COOKIE_TMP);        // EventSource reconnects
      expect(retry.status).toBe(401);                    // and is refused
      retry.abort();
    } finally {
      delete process.env.PRESTIGE_SSE_MAX_STREAM_MS;
      SESSIONS.delete(COOKIE_TMP);
    }
  }, 20_000);
});

describe('SSE · source invariants', () => {
  const src = readFileSync(join(__dirname, '..', '..', 'server/routes/prestige-pass.ts'), 'utf8');

  it('the registry maps a uid to a SET of responses, not a single response', () => {
    expect(src).toMatch(/const sseClients = new Map<string,\s*Set<Response>>\(\)/);
    expect(src).not.toMatch(/const sseClients = new Map<string,\s*Response>\(\)/);
  });

  it('the close handler removes only its OWN response, never the whole uid entry', () => {
    const handler = src.match(/router\.get\('\/session\/stream'[\s\S]{0,3200}/)?.[0] ?? '';
    expect(handler).not.toBe('');
    expect(handler).toMatch(/set\.delete\(res\)/);
    // The old bug: unconditionally dropping the user's whole entry on any close.
    expect(handler).not.toMatch(/clearInterval\(ping\);\s*sseClients\.delete\(userId\);/);
  });

  it('the wash_started fan-out goes through pushSse, keyed by the token-derived uid', () => {
    expect(src).toMatch(/function pushSse\(userId: string/);
    expect(src).toMatch(/pushSse\(userId,\s*\{\s*\n\s*type:\s*'wash_started'/);
  });
});
