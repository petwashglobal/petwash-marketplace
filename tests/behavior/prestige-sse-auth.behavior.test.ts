/**
 * BEHAVIORAL coverage for the Prestige Pass SSE stream
 * (GET /api/prestige-pass/session/stream) — the live K9000 "wash_started"
 * channel that pushes a member's wallet deduction to their open wallet tab.
 *
 * Why this file exists
 * --------------------
 * SSE is the one realtime transport where it is *tempting* to put the
 * credential in the URL, because `EventSource` cannot set an Authorization
 * header. An abandoned branch (claude/pr-prestige-sse-bearer, commit
 * 886e3944c) did exactly that — `?token=<firebase-jwt>` — before it was
 * reverted on the same branch. Tokens in URLs land in browser history,
 * Referer headers, proxy access logs and Cloud Run request logs. Neither
 * commit ever reached main, and nothing pins that it stays that way.
 *
 * This file boots a real express app with the REAL production middleware
 * chain (optionalFirebaseToken + the real prestige-pass router — only the
 * rate limiter is omitted so the suite is deterministic), makes real HTTP
 * requests, and reads the real SSE byte stream.
 *
 * Only the identity oracle (firebase-admin) is mocked.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import express from 'express';
import cookieParser from 'cookie-parser';
import { createServer, type Server } from 'http';
import type { AddressInfo } from 'net';
import { readFileSync } from 'fs';
import { join } from 'path';

type Decoded = { uid: string; email?: string; email_verified?: boolean };

/** Bearer ID tokens that Firebase would accept. */
const ID_TOKENS = new Map<string, Decoded>();
/** pw_session cookie values that Firebase would accept. */
const SESSION_COOKIES = new Map<string, Decoded>();

const verifyIdToken = vi.fn(async (token: string) => {
  const d = ID_TOKENS.get(token);
  if (!d) throw new Error('auth/id-token-expired');
  return { email_verified: false, ...d } as any;
});

const verifySessionCookie = vi.fn(async (cookie: string) => {
  const d = SESSION_COOKIES.get(cookie);
  if (!d) throw new Error('auth/session-cookie-revoked');
  return { email_verified: false, ...d } as any;
});

vi.mock('../../server/lib/firebase-admin', () => ({
  auth: {
    verifyIdToken:      (...a: any[]) => (verifyIdToken as any)(...a),
    verifySessionCookie: (...a: any[]) => (verifySessionCookie as any)(...a),
    getUser: async () => ({ displayName: null }),
    revokeRefreshTokens: async () => undefined,
  },
  // Firestore stub — inlined because vi.mock factories are hoisted above
  // any top-level const in this file.
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

const JWT_A = `a.${'x'.repeat(200)}`;
const JWT_B = `b.${'x'.repeat(200)}`;
const COOKIE_A = `sessA.${'y'.repeat(200)}`;
const COOKIE_B = `sessB.${'y'.repeat(200)}`;
const COOKIE_REVOKED = `sessRevoked.${'y'.repeat(200)}`;

ID_TOKENS.set(JWT_A, { uid: 'uid-A', email: 'a@example.com', email_verified: true });
ID_TOKENS.set(JWT_B, { uid: 'uid-B', email: 'b@example.com', email_verified: true });
SESSION_COOKIES.set(COOKIE_A, { uid: 'uid-A', email: 'a@example.com', email_verified: true });
SESSION_COOKIES.set(COOKIE_B, { uid: 'uid-B', email: 'b@example.com', email_verified: true });
// COOKIE_REVOKED is deliberately absent → Firebase rejects it (logged-out / revoked).

let server: Server;
let base: string;

beforeAll(async () => {
  // Production mount (server/routes.ts):
  //   app.use('/api/prestige-pass', apiLimiter, optionalFirebaseToken, prestigePassRoutes)
  // apiLimiter is omitted here only so repeated requests in the suite are
  // deterministic; the auth chain under test is identical.
  const app = express();
  app.use(cookieParser());
  app.use(express.json());
  app.use('/api/prestige-pass', optionalFirebaseToken, prestigePassRoutes);

  server = createServer(app);
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
}, 60_000);

afterAll(async () => {
  await new Promise<void>((r) => server.close(() => r()));
});

beforeEach(() => {
  verifyIdToken.mockClear();
  verifySessionCookie.mockClear();
});

const STREAM = '/api/prestige-pass/session/stream';

/** Open the stream and read the first chunk (or give up). Always aborts. */
async function openStream(path: string, headers: Record<string, string> = {}) {
  const ac = new AbortController();
  const res = await fetch(`${base}${path}`, { headers, signal: ac.signal });
  const contentType = res.headers.get('content-type') || '';

  if (!res.ok || !res.body) {
    ac.abort();
    return { status: res.status, contentType, firstChunk: '', abort: () => ac.abort() };
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  const firstChunk = await Promise.race([
    reader.read().then((r) => decoder.decode(r.value ?? new Uint8Array())),
    new Promise<string>((r) => setTimeout(() => r(''), 2500)),
  ]);

  return {
    status: res.status,
    contentType,
    firstChunk,
    abort: () => { try { reader.cancel(); } catch { /* noop */ } ac.abort(); },
  };
}

describe('SSE /api/prestige-pass/session/stream · authentication', () => {
  it('DENIES an unauthenticated request with 401 and never opens an event stream', async () => {
    const s = await openStream(STREAM);
    expect(s.status).toBe(401);
    expect(s.contentType).not.toContain('text/event-stream');
    s.abort();
  });

  it('ALLOWS a valid pw_session HttpOnly cookie and emits the SSE preamble', async () => {
    const s = await openStream(STREAM, { cookie: `pw_session=${COOKIE_A}` });
    expect(s.status).toBe(200);
    expect(s.contentType).toContain('text/event-stream');
    expect(s.firstChunk).toContain(': connected');
    expect(verifySessionCookie).toHaveBeenCalled();
    s.abort();
  });

  it('ALLOWS a Firebase Bearer ID token in the Authorization header (native app clients)', async () => {
    const s = await openStream(STREAM, { authorization: `Bearer ${JWT_A}` });
    expect(s.status).toBe(200);
    expect(s.contentType).toContain('text/event-stream');
    s.abort();
  });

  it('DENIES an invalid / expired session cookie', async () => {
    const s = await openStream(STREAM, { cookie: `pw_session=${COOKIE_REVOKED}` });
    expect(s.status).toBe(401);
    expect(s.contentType).not.toContain('text/event-stream');
    s.abort();
  });

  it('DENIES an invalid / expired Bearer token', async () => {
    const s = await openStream(STREAM, { authorization: `Bearer ${'z'.repeat(200)}` });
    expect(s.status).toBe(401);
    s.abort();
  });
});

describe('SSE · the ID token must NEVER travel in the URL', () => {
  // Regression guard for claude/pr-prestige-sse-bearer@886e3944c, which added
  // `?token=<jwt>` before being reverted. Tokens in URLs leak through browser
  // history, Referer, proxy logs and Cloud Run request logs.
  it('REFUSES a Firebase ID token supplied as ?token= (query string is not a credential channel)', async () => {
    const s = await openStream(`${STREAM}?token=${encodeURIComponent(JWT_A)}`);
    expect(s.status).toBe(401);
    expect(s.contentType).not.toContain('text/event-stream');
    s.abort();
  });

  it('REFUSES the other common URL-credential spellings (?idToken=, ?access_token=, ?uid=)', async () => {
    for (const q of [`idToken=${JWT_A}`, `access_token=${JWT_A}`, `uid=uid-A`, `userId=uid-A`]) {
      const s = await openStream(`${STREAM}?${q}`);
      expect(s.status, `query ${q} must not authenticate`).toBe(401);
      s.abort();
    }
  });

  it('does not let a query parameter override the cookie-derived identity', async () => {
    // Authenticated as A but claiming to be B in the URL — must still be A's
    // stream (the handler keys on the server-derived uid, never the URL).
    const s = await openStream(`${STREAM}?uid=uid-B&userId=uid-B`, { cookie: `pw_session=${COOKIE_A}` });
    expect(s.status).toBe(200);
    // The cookie oracle — not the query string — is what Firebase was asked about.
    expect(verifySessionCookie).toHaveBeenCalledWith(COOKIE_A, true);
    s.abort();
  });

  it('the client opens EventSource with no credential in the URL', () => {
    const wallet = readFileSync(join(__dirname, '..', '..', 'client/src/pages/PrestigePassWallet.tsx'), 'utf8');
    const call = wallet.match(/new EventSource\([^)]*\)/)?.[0] ?? '';
    expect(call, 'EventSource call not found').not.toBe('');
    expect(call).not.toMatch(/token|idToken|access_token|jwt|uid=/i);
    expect(call).toContain('/api/prestige-pass/session/stream');
  });

  it('the SSE handler reads no credential from req.query at all', () => {
    const src = readFileSync(join(__dirname, '..', '..', 'server/routes/prestige-pass.ts'), 'utf8');
    const handler = src.match(/router\.get\('\/session\/stream'[\s\S]{0,1800}/)?.[0] ?? '';
    expect(handler, 'SSE handler not found').not.toBe('');
    expect(handler).not.toMatch(/req\.query/);
    expect(handler).toMatch(/resolveUid\(req\)/);
  });
});

describe('SSE · logout and account switching', () => {
  it('a stream cannot be re-established once the session is revoked (logout)', async () => {
    const live = await openStream(STREAM, { cookie: `pw_session=${COOKIE_A}` });
    expect(live.status).toBe(200);
    live.abort();

    // User logs out → Firebase stops honouring that session cookie.
    SESSION_COOKIES.delete(COOKIE_A);
    try {
      const after = await openStream(STREAM, { cookie: `pw_session=${COOKIE_A}` });
      expect(after.status).toBe(401);
      expect(after.contentType).not.toContain('text/event-stream');
      after.abort();
    } finally {
      SESSION_COOKIES.set(COOKIE_A, { uid: 'uid-A', email: 'a@example.com', email_verified: true });
    }
  });

  it('switching accounts re-authenticates from scratch — B never inherits A\'s stream', async () => {
    const a = await openStream(STREAM, { cookie: `pw_session=${COOKIE_A}` });
    expect(a.status).toBe(200);
    a.abort();

    verifySessionCookie.mockClear();
    const b = await openStream(STREAM, { cookie: `pw_session=${COOKIE_B}` });
    expect(b.status).toBe(200);
    // B's stream was resolved from B's cookie only.
    expect(verifySessionCookie).toHaveBeenCalledWith(COOKIE_B, true);
    expect(verifySessionCookie).not.toHaveBeenCalledWith(COOKIE_A, true);
    b.abort();
  });

  it('a signed-out browser that still has a stale cookie value gets 401, not a stream', async () => {
    const s = await openStream(STREAM, { cookie: `pw_session=` });
    expect(s.status).toBe(401);
    s.abort();
  });
});
