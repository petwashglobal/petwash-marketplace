/**
 * BEHAVIORAL coverage for the /ws/match realtime authorization gates.
 *
 * Why this file exists
 * --------------------
 * The 2026-08-20 evil-hunt found that /ws/match accepted `SUBSCRIBE_ADMIN`
 * and `SUBSCRIBE_BOOKING` with NO authentication at all: any anonymous
 * socket could stream every marketplace live event (owner IDs, provider IDs,
 * service types) or tap any booking's status stream by iterating requestIds.
 *
 * The fix shipped with only a STATIC source pin
 * (tests/behavior/matching-ws-unauth-subscribe.test.ts) — a regex over the
 * source file. A regex cannot prove that a denied socket actually receives
 * nothing when an event is broadcast. This file boots the real
 * WebSocketServer over a real http.Server, connects real `ws` clients, and
 * asserts on the frames that actually cross the wire — including negative
 * proof that denied sockets stay silent while an authorized socket is fed.
 *
 * Everything external to the auth decision is mocked so the test is
 * hermetic (no Firebase, no Postgres): the identity oracle
 * (firebase-admin verifyIdToken), the membership oracle (pool.query), and
 * the super-admin allowlist (rbac.getSuperAdmins).
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { createServer, type Server } from 'http';
import type { AddressInfo } from 'net';
import WebSocket from 'ws';

// ── Controllable oracles ────────────────────────────────────────────────
type Decoded = { uid: string; email?: string; email_verified?: boolean };

/** token string → decoded claims. Anything absent is an invalid token. */
const TOKENS = new Map<string, Decoded>();
/** requestId → set of uids that are owner/provider on that booking. */
const BOOKING_MEMBERS = new Map<string, Set<string>>();
const SUPER_ADMINS: string[] = ['ceo@petwash.co.il'];

const verifyIdToken = vi.fn(async (token: string, checkRevoked?: boolean) => {
  const decoded = TOKENS.get(token);
  if (!decoded) throw new Error('auth/argument-error');
  return { email_verified: false, ...decoded } as any;
});

const poolQuery = vi.fn(async (_sql: string, params: any[]) => {
  const [requestId, uid] = params as [string, string];
  const members = BOOKING_MEMBERS.get(requestId);
  return { rows: members?.has(uid) ? [{ '?column?': 1 }] : [] };
});

vi.mock('../../server/lib/firebase-admin', () => ({
  auth: { verifyIdToken: (...a: any[]) => (verifyIdToken as any)(...a) },
  firebaseAdmin: {},
  db: {},
}));

vi.mock('../../server/db', () => ({
  pool: { query: (...a: any[]) => (poolQuery as any)(...a) },
  // EventBus.publish() persists every event before emitting it; give it a
  // no-op chainable so the in-process fan-out under test still runs.
  db: { insert: () => ({ values: async () => undefined }) },
  isDatabaseAvailable: false,
}));

vi.mock('../../server/middleware/rbac', () => ({
  getSuperAdmins: () => SUPER_ADMINS,
}));

// Imported AFTER the mocks are declared (vi.mock is hoisted, so this is safe).
import { setupMatchingWebSocket } from '../../server/routes/matching-ws';
import { eventBus } from '../../server/services/EventBus';

// A Firebase ID token is a JWT; the server rejects anything shorter than 100
// chars before it ever calls Firebase. Keep fixtures above that bar so we are
// exercising the real verification path, not the cheap length pre-filter.
const tok = (name: string) => `${name}.${'x'.repeat(120)}`;

const TOK_OWNER      = tok('owner');
const TOK_PROVIDER   = tok('provider');
const TOK_STRANGER   = tok('stranger');
const TOK_ADMIN      = tok('admin');
const TOK_ADMIN_UNV  = tok('adminUnverified');

TOKENS.set(TOK_OWNER,     { uid: 'uid-owner',    email: 'owner@example.com',  email_verified: true });
TOKENS.set(TOK_PROVIDER,  { uid: 'uid-provider', email: 'walker@example.com', email_verified: true });
TOKENS.set(TOK_STRANGER,  { uid: 'uid-stranger', email: 'eve@example.com',    email_verified: true });
TOKENS.set(TOK_ADMIN,     { uid: 'uid-admin',    email: 'ceo@petwash.co.il',  email_verified: true });
// Same allowlisted email — but the address was never verified. Must be DENIED:
// otherwise anyone who can register the display value of an admin email at an
// unverified provider inherits the admin live feed.
TOKENS.set(TOK_ADMIN_UNV, { uid: 'uid-admin-unv', email: 'ceo@petwash.co.il', email_verified: false });

BOOKING_MEMBERS.set('req-A', new Set(['uid-owner', 'uid-provider']));
BOOKING_MEMBERS.set('req-B', new Set(['uid-someone-else']));

// ── Harness ─────────────────────────────────────────────────────────────
let server: Server;
let port: number;
const open: WebSocket[] = [];

beforeAll(async () => {
  server = createServer();
  setupMatchingWebSocket(server);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  port = (server.address() as AddressInfo).port;
}, 60_000);

afterAll(async () => {
  for (const ws of open) { try { ws.close(); } catch { /* noop */ } }
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

beforeEach(() => {
  verifyIdToken.mockClear();
  poolQuery.mockClear();
});

interface Client {
  ws: WebSocket;
  frames: any[];
  send(msg: object): void;
  /** Resolve with the first frame matching `match`, or reject on timeout. */
  waitFor(match: (f: any) => boolean, ms?: number): Promise<any>;
  /** Resolve after `ms` with everything received so far (silence assertions). */
  quiet(ms?: number): Promise<any[]>;
  close(): void;
}

async function connect(): Promise<Client> {
  const ws = new WebSocket(`ws://127.0.0.1:${port}/ws/match`);
  open.push(ws);
  const frames: any[] = [];
  const listeners: Array<(f: any) => void> = [];

  ws.on('message', (raw) => {
    let parsed: any;
    try { parsed = JSON.parse(raw.toString()); } catch { parsed = { raw: raw.toString() }; }
    frames.push(parsed);
    for (const l of [...listeners]) l(parsed);
  });

  await new Promise<void>((resolve, reject) => {
    ws.once('open', resolve);
    ws.once('error', reject);
  });

  return {
    ws,
    frames,
    send: (msg) => ws.send(JSON.stringify(msg)),
    waitFor: (match, ms = 3000) =>
      new Promise((resolve, reject) => {
        const hit = frames.find(match);
        if (hit) return resolve(hit);
        const timer = setTimeout(() => {
          const idx = listeners.indexOf(onFrame);
          if (idx >= 0) listeners.splice(idx, 1);
          reject(new Error(`timeout waiting for frame; got: ${JSON.stringify(frames)}`));
        }, ms);
        function onFrame(f: any) {
          if (!match(f)) return;
          clearTimeout(timer);
          const idx = listeners.indexOf(onFrame);
          if (idx >= 0) listeners.splice(idx, 1);
          resolve(f);
        }
        listeners.push(onFrame);
      }),
    quiet: (ms = 400) => new Promise((resolve) => setTimeout(() => resolve([...frames]), ms)),
    close: () => ws.close(),
  };
}

const isError = (code: string, scope?: string) => (f: any) =>
  f.type === 'ERROR' && f.code === code && (scope === undefined || f.scope === scope);

// ── SUBSCRIBE_ADMIN ─────────────────────────────────────────────────────
describe('/ws/match · SUBSCRIBE_ADMIN', () => {
  it('DENIES an unauthenticated socket (no idToken at all)', async () => {
    const c = await connect();
    c.send({ type: 'SUBSCRIBE_ADMIN' });
    const err = await c.waitFor(isError('UNAUTHORIZED', 'SUBSCRIBE_ADMIN'));
    expect(err.code).toBe('UNAUTHORIZED');
    expect(c.frames.some((f) => f.type === 'SUBSCRIBED')).toBe(false);
    c.close();
  });

  it('DENIES a garbage/short token without even consulting Firebase', async () => {
    const c = await connect();
    c.send({ type: 'SUBSCRIBE_ADMIN', idToken: 'not-a-jwt' });
    await c.waitFor(isError('UNAUTHORIZED', 'SUBSCRIBE_ADMIN'));
    expect(verifyIdToken).not.toHaveBeenCalled();
    c.close();
  });

  it('DENIES a well-formed but invalid/expired token', async () => {
    const c = await connect();
    c.send({ type: 'SUBSCRIBE_ADMIN', idToken: tok('forged') });
    await c.waitFor(isError('UNAUTHORIZED', 'SUBSCRIBE_ADMIN'));
    expect(verifyIdToken).toHaveBeenCalled();
    c.close();
  });

  it('DENIES a normal signed-in user (not on the super-admin allowlist)', async () => {
    const c = await connect();
    c.send({ type: 'SUBSCRIBE_ADMIN', idToken: TOK_OWNER });
    const err = await c.waitFor(isError('FORBIDDEN', 'SUBSCRIBE_ADMIN'));
    expect(err.code).toBe('FORBIDDEN');
    expect(c.frames.some((f) => f.type === 'SUBSCRIBED')).toBe(false);
    c.close();
  });

  it('DENIES an allowlisted admin email whose address is NOT email_verified', async () => {
    const c = await connect();
    c.send({ type: 'SUBSCRIBE_ADMIN', idToken: TOK_ADMIN_UNV });
    const err = await c.waitFor(isError('FORBIDDEN', 'SUBSCRIBE_ADMIN'));
    expect(err.code).toBe('FORBIDDEN');
    expect(c.frames.some((f) => f.type === 'SUBSCRIBED')).toBe(false);
    c.close();
  });

  it('ALLOWS a verified super-admin', async () => {
    const c = await connect();
    c.send({ type: 'SUBSCRIBE_ADMIN', idToken: TOK_ADMIN });
    const ok = await c.waitFor((f) => f.type === 'SUBSCRIBED' && f.scope === 'admin');
    expect(ok.scope).toBe('admin');
    c.close();
  });

  it('verifies the ID token with checkRevoked = true (revoked sessions cannot subscribe)', async () => {
    const c = await connect();
    c.send({ type: 'SUBSCRIBE_ADMIN', idToken: TOK_ADMIN });
    await c.waitFor((f) => f.type === 'SUBSCRIBED');
    expect(verifyIdToken).toHaveBeenCalledWith(TOK_ADMIN, true);
    c.close();
  });

  it('feeds the marketplace live event ONLY to the admin — denied sockets stay silent', async () => {
    const admin   = await connect();
    const anon    = await connect();
    const regular = await connect();

    admin.send({ type: 'SUBSCRIBE_ADMIN', idToken: TOK_ADMIN });
    await admin.waitFor((f) => f.type === 'SUBSCRIBED');

    anon.send({ type: 'SUBSCRIBE_ADMIN' });
    await anon.waitFor(isError('UNAUTHORIZED'));

    regular.send({ type: 'SUBSCRIBE_ADMIN', idToken: TOK_STRANGER });
    await regular.waitFor(isError('FORBIDDEN'));

    eventBus.publish({
      eventType: 'provider.accepted',
      timestamp: new Date().toISOString(),
      platform:  'test',
      data: { requestId: 'req-A', providerId: 'uid-provider', ownerId: 'uid-owner', newStatus: 'accepted', serviceType: 'walking' },
    } as any);

    const got = await admin.waitFor((f) => f.type === 'PROVIDER_ACCEPTED');
    expect(got.ownerId).toBe('uid-owner');

    // Negative proof: the two denied sockets must never see marketplace data.
    expect((await anon.quiet()).some((f) => f.type === 'PROVIDER_ACCEPTED')).toBe(false);
    expect((await regular.quiet()).some((f) => f.type === 'PROVIDER_ACCEPTED')).toBe(false);

    admin.close(); anon.close(); regular.close();
  });
});

// ── SUBSCRIBE_BOOKING ───────────────────────────────────────────────────
describe('/ws/match · SUBSCRIBE_BOOKING', () => {
  it('DENIES an unauthenticated socket', async () => {
    const c = await connect();
    c.send({ type: 'SUBSCRIBE_BOOKING', requestId: 'req-A' });
    const err = await c.waitFor(isError('UNAUTHORIZED', 'SUBSCRIBE_BOOKING'));
    expect(err.code).toBe('UNAUTHORIZED');
    expect(poolQuery).not.toHaveBeenCalled();
    c.close();
  });

  it('ALLOWS the booking owner', async () => {
    const c = await connect();
    c.send({ type: 'SUBSCRIBE_BOOKING', requestId: 'req-A', idToken: TOK_OWNER });
    const ok = await c.waitFor((f) => f.type === 'SUBSCRIBED' && f.requestId === 'req-A');
    expect(ok.requestId).toBe('req-A');
    c.close();
  });

  it('ALLOWS the assigned provider', async () => {
    const c = await connect();
    c.send({ type: 'SUBSCRIBE_BOOKING', requestId: 'req-A', idToken: TOK_PROVIDER });
    await c.waitFor((f) => f.type === 'SUBSCRIBED' && f.requestId === 'req-A');
    c.close();
  });

  it('DENIES an unrelated signed-in user (cross-tenant booking walk)', async () => {
    const c = await connect();
    c.send({ type: 'SUBSCRIBE_BOOKING', requestId: 'req-A', idToken: TOK_STRANGER });
    const err = await c.waitFor(isError('FORBIDDEN', 'SUBSCRIBE_BOOKING'));
    expect(err.requestId).toBe('req-A');
    expect(c.frames.some((f) => f.type === 'SUBSCRIBED')).toBe(false);
    c.close();
  });

  it('DENIES a user who owns a DIFFERENT booking (requestId is not caller-chosen scope)', async () => {
    const c = await connect();
    // uid-owner is a participant on req-A only; asking for req-B must fail.
    c.send({ type: 'SUBSCRIBE_BOOKING', requestId: 'req-B', idToken: TOK_OWNER });
    await c.waitFor(isError('FORBIDDEN', 'SUBSCRIBE_BOOKING'));
    c.close();
  });

  it('scopes membership to the caller uid derived from the token, not from the payload', async () => {
    const c = await connect();
    // Attacker supplies their own (valid) token but claims to be the owner.
    c.send({ type: 'SUBSCRIBE_BOOKING', requestId: 'req-A', idToken: TOK_STRANGER, uid: 'uid-owner', ownerId: 'uid-owner' });
    await c.waitFor(isError('FORBIDDEN', 'SUBSCRIBE_BOOKING'));
    // The DB check must have run with the TOKEN's uid, never the payload's.
    expect(poolQuery).toHaveBeenCalledWith(expect.any(String), ['req-A', 'uid-stranger']);
    c.close();
  });

  it('delivers booking events ONLY to participants — the denied stranger stays silent', async () => {
    const owner    = await connect();
    const stranger = await connect();

    owner.send({ type: 'SUBSCRIBE_BOOKING', requestId: 'req-A', idToken: TOK_OWNER });
    await owner.waitFor((f) => f.type === 'SUBSCRIBED');

    stranger.send({ type: 'SUBSCRIBE_BOOKING', requestId: 'req-A', idToken: TOK_STRANGER });
    await stranger.waitFor(isError('FORBIDDEN'));

    eventBus.publish({
      eventType: 'provider.arriving',
      timestamp: new Date().toISOString(),
      platform:  'test',
      data: { requestId: 'req-A', providerId: 'uid-provider', ownerId: 'uid-owner', eta: 7, serviceType: 'walking' },
    } as any);

    const got = await owner.waitFor((f) => f.type === 'PROVIDER_ARRIVING');
    expect(got.requestId).toBe('req-A');
    expect((await stranger.quiet()).some((f) => f.type === 'PROVIDER_ARRIVING')).toBe(false);

    owner.close(); stranger.close();
  });

  it('stops delivering after UNSUBSCRIBE_BOOKING', async () => {
    const owner = await connect();
    owner.send({ type: 'SUBSCRIBE_BOOKING', requestId: 'req-A', idToken: TOK_OWNER });
    await owner.waitFor((f) => f.type === 'SUBSCRIBED');
    owner.send({ type: 'UNSUBSCRIBE_BOOKING', requestId: 'req-A' });
    await new Promise((r) => setTimeout(r, 150));

    eventBus.publish({
      eventType: 'provider.accepted',
      timestamp: new Date().toISOString(),
      platform:  'test',
      data: { requestId: 'req-A', providerId: 'uid-provider', ownerId: 'uid-owner', newStatus: 'accepted', serviceType: 'walking' },
    } as any);

    expect((await owner.quiet()).some((f) => f.type === 'PROVIDER_ACCEPTED')).toBe(false);
    owner.close();
  });
});
