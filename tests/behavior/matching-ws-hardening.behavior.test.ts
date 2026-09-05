/**
 * BEHAVIORAL coverage for the /ws/match upgrade-level abuse controls added
 * 2026-09-05 (realtime security lane).
 *
 * /ws/match was created as a bare `new WebSocketServer({ server, path })`:
 * no origin allowlist, no connection cap, no message rate limit, no payload
 * cap — while its sibling /realtime (server/websocket.ts) has had all four
 * since day one. `START_SEARCH` needs no authentication and runs a Neon
 * query per message, so any page on the open internet could hold unlimited
 * sockets and drive unlimited production queries.
 *
 * Limits are read from env at module load, so this file sets tiny values and
 * imports the module dynamically (a static import would hoist above the env
 * assignment).
 */

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { createServer, type Server } from 'http';
import type { AddressInfo } from 'net';
import WebSocket from 'ws';

vi.mock('../../server/lib/firebase-admin', () => ({
  auth: { verifyIdToken: async () => { throw new Error('auth/argument-error'); } },
  db: {},
}));
vi.mock('../../server/db', () => ({
  pool: { query: async () => ({ rows: [] }) },
  db: { insert: () => ({ values: async () => undefined }) },
  isDatabaseAvailable: false,
}));
vi.mock('../../server/middleware/rbac', () => ({ getSuperAdmins: () => [] }));

const MAX_CONN = 2;
const MAX_MSGS = 3;

let server: Server;
let port: number;
let liveConnections: () => number;
const origNodeEnv = process.env.NODE_ENV;

beforeAll(async () => {
  process.env.MATCH_WS_MAX_CONN = String(MAX_CONN);
  process.env.MATCH_WS_MAX_MSGS_PER_MIN = String(MAX_MSGS);

  const mod = await import('../../server/routes/matching-ws');
  liveConnections = mod.__matchWsLiveConnections;

  server = createServer();
  mod.setupMatchingWebSocket(server);
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  port = (server.address() as AddressInfo).port;
}, 60_000);

afterAll(async () => {
  process.env.NODE_ENV = origNodeEnv;
  delete process.env.MATCH_WS_MAX_CONN;
  delete process.env.MATCH_WS_MAX_MSGS_PER_MIN;
  await new Promise<void>((r) => server.close(() => r()));
});

/** Resolve 'open' or 'rejected' — never throws. */
function tryConnect(headers: Record<string, string> = {}): Promise<{ outcome: 'open' | 'rejected'; ws: WebSocket }> {
  return new Promise((resolve) => {
    const ws = new WebSocket(`ws://127.0.0.1:${port}/ws/match`, { headers });
    ws.once('open',  () => resolve({ outcome: 'open', ws }));
    ws.once('error', () => resolve({ outcome: 'rejected', ws }));
  });
}

function closed(ws: WebSocket): Promise<number> {
  return new Promise((resolve) => {
    if (ws.readyState === WebSocket.CLOSED) return resolve(0);
    ws.once('close', (code) => resolve(code));
  });
}

async function settle(ms = 120) { await new Promise((r) => setTimeout(r, ms)); }

// ── Origin allowlist (production posture) ───────────────────────────────
describe('/ws/match · origin allowlist', () => {
  it('REJECTS an upgrade with no Origin header in production', async () => {
    process.env.NODE_ENV = 'production';
    try {
      const { outcome, ws } = await tryConnect();
      expect(outcome).toBe('rejected');
      ws.terminate();
    } finally { process.env.NODE_ENV = origNodeEnv; }
  });

  it('REJECTS an upgrade from an attacker origin in production', async () => {
    process.env.NODE_ENV = 'production';
    try {
      const { outcome, ws } = await tryConnect({ origin: 'https://evil.example.com' });
      expect(outcome).toBe('rejected');
      ws.terminate();
    } finally { process.env.NODE_ENV = origNodeEnv; }
  });

  it('REJECTS a look-alike suffix origin (no prefix matching)', async () => {
    process.env.NODE_ENV = 'production';
    try {
      const { outcome, ws } = await tryConnect({ origin: 'https://petwash.co.il.evil.com' });
      expect(outcome).toBe('rejected');
      ws.terminate();
    } finally { process.env.NODE_ENV = origNodeEnv; }
  });

  it('ACCEPTS the real site origin in production', async () => {
    process.env.NODE_ENV = 'production';
    try {
      const { outcome, ws } = await tryConnect({ origin: 'https://petwash.co.il' });
      expect(outcome).toBe('open');
      ws.close();
      await closed(ws);
    } finally { process.env.NODE_ENV = origNodeEnv; }
    await settle();
  });
});

// ── Connection cap ──────────────────────────────────────────────────────
describe('/ws/match · connection cap', () => {
  it('REJECTS upgrades past the cap and frees the slot again on disconnect', async () => {
    expect(liveConnections()).toBe(0);

    const a = await tryConnect();
    const b = await tryConnect();
    expect(a.outcome).toBe('open');
    expect(b.outcome).toBe('open');
    await settle();
    expect(liveConnections()).toBe(MAX_CONN);

    const c = await tryConnect();
    expect(c.outcome, 'third socket must be refused at the cap').toBe('rejected');
    c.ws.terminate();

    a.ws.close();
    await closed(a.ws);
    await settle();
    expect(liveConnections()).toBe(MAX_CONN - 1);

    const d = await tryConnect();
    expect(d.outcome, 'slot freed by the disconnect must be reusable').toBe('open');

    b.ws.close(); d.ws.close();
    await closed(b.ws); await closed(d.ws);
    await settle();
    expect(liveConnections()).toBe(0);
  });
});

// ── Per-connection message rate limit ───────────────────────────────────
describe('/ws/match · message rate limit', () => {
  it('RATE_LIMITS a socket that floods messages (unauthenticated DB amplification)', async () => {
    const { outcome, ws } = await tryConnect();
    expect(outcome).toBe('open');

    const frames: any[] = [];
    ws.on('message', (raw) => { try { frames.push(JSON.parse(raw.toString())); } catch { /* noop */ } });

    for (let i = 0; i < MAX_MSGS + 3; i++) ws.send(JSON.stringify({ type: 'CANCEL' }));
    await settle(300);

    const limited = frames.filter((f) => f.type === 'ERROR' && f.code === 'RATE_LIMITED');
    expect(limited.length).toBeGreaterThan(0);
    expect(limited[0].limitPerMinute).toBe(MAX_MSGS);

    ws.close();
    await closed(ws);
    await settle();
  });
});

// ── Payload cap ─────────────────────────────────────────────────────────
describe('/ws/match · payload cap', () => {
  it('CLOSES the socket on an oversized frame instead of parsing 100 MB (ws default)', async () => {
    const { outcome, ws } = await tryConnect();
    expect(outcome).toBe('open');
    ws.on('error', () => { /* expected on abrupt close */ });

    ws.send(JSON.stringify({ type: 'CANCEL', pad: 'A'.repeat(64 * 1024) }));
    const code = await Promise.race([
      closed(ws),
      new Promise<number>((r) => setTimeout(() => r(-1), 2000)),
    ]);
    // 1009 = Message Too Big. Some stacks report 1006 on abrupt teardown.
    expect([1009, 1006]).toContain(code);
    await settle();
  });
});
