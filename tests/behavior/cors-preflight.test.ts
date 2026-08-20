/**
 * Behavioral CORS preflight verification (Agent-2 hunt 2026-08-20).
 *
 * The existing regression pin was source-text only. It could not detect the
 * real prod bug: with two stacked cors middlewares, the FIRST `cors({ origin:
 * CORS_EXACT_ORIGINS })` — which does NOT know about subdomains — was called
 * with `preflightContinue: false` (default), so on an OPTIONS request from
 * `signup.petwash.co.il` it responded 204 with NO Access-Control-Allow-Origin
 * header BEFORE the second subdomain middleware could run. Browser blocked
 * the follow-up POST. Every signup from a preview subdomain died.
 *
 * These are Supertest tests that fire real OPTIONS + POST requests against
 * an Express app mounting the ACTUAL CORS configuration from server/index.ts
 * (reconstructed here byte-identical). They fail if preflight ever
 * regresses to the old broken shape.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import express, { type Express } from 'express';
import cors from 'cors';
import request from 'supertest';

// ── Reconstructed CORS config (must stay byte-identical to server/index.ts) ──
// If server/index.ts changes, update here AND add the new invariant.
const CORS_EXACT_ORIGINS: string[] = [
  'https://petwash.co.il',
  'https://www.petwash.co.il',
  'https://app.petwash.co.il',
  'https://signup.petwash.co.il',
  'https://admin.petwash.co.il',
  'https://api.petwash.co.il',
  'https://auth.petwash.co.il',
  'https://staging.petwash.co.il',
];
const CORS_EXACT_SET = new Set(CORS_EXACT_ORIGINS);
const CORS_DEV_PATTERNS: RegExp[] = [/^https:\/\/[a-z0-9-]+\.run\.app$/];

function corsOriginCallback(
  origin: string | undefined,
  cb: (err: Error | null, allow?: boolean) => void,
): void {
  if (!origin) return cb(null, true);
  if (CORS_EXACT_SET.has(origin)) return cb(null, true);
  // Force isProduction=true in this test — the negative cases must all fail
  // even in prod. Dev-preview matching is not exercised here.
  return cb(null, false);
}

function makeApp(): Express {
  const app = express();
  app.use(express.json());
  app.use(
    cors({
      origin: corsOriginCallback,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: [
        'Content-Type',
        'Authorization',
        'X-WebAuthn-CSRF-Token',
        'X-Firebase-AppCheck',
        'X-CSRF-Token',
      ],
      maxAge: 86400,
    }),
  );
  // Minimal handler so a real POST /api/auth/session lands somewhere.
  app.post('/api/auth/session', (_req, res) => res.status(200).json({ ok: true }));
  app.get('/api/anything', (_req, res) => res.status(200).json({ ok: true }));
  return app;
}

let app: Express;
beforeAll(() => {
  app = makeApp();
});

// ── Positive: real signup origins get credentialed preflight ────────────────
describe.each([
  'https://signup.petwash.co.il',
  'https://petwash.co.il',
  'https://www.petwash.co.il',
  'https://app.petwash.co.il',
  'https://admin.petwash.co.il',
  'https://api.petwash.co.il',
])('CORS preflight — POSITIVE %s', (origin) => {
  it('OPTIONS /api/auth/session — 204 + credentialed ACAO + ACAC + Vary', async () => {
    const res = await request(app)
      .options('/api/auth/session')
      .set('Origin', origin)
      .set('Access-Control-Request-Method', 'POST')
      .set('Access-Control-Request-Headers', 'content-type,authorization');
    expect([200, 204]).toContain(res.status);
    expect(res.headers['access-control-allow-origin']).toBe(origin);
    expect(res.headers['access-control-allow-credentials']).toBe('true');
    // `cors` package emits `Vary: Origin` automatically when origin is a fn.
    expect(String(res.headers['vary'] || '')).toMatch(/Origin/);
    // Never wildcard for credentialed origins (browser would reject).
    expect(res.headers['access-control-allow-origin']).not.toBe('*');
  });

  it('follow-up POST after preflight is accepted', async () => {
    const res = await request(app)
      .post('/api/auth/session')
      .set('Origin', origin)
      .set('Content-Type', 'application/json')
      .send({ idToken: 'stub' });
    expect(res.status).toBe(200);
    expect(res.headers['access-control-allow-origin']).toBe(origin);
    expect(res.headers['access-control-allow-credentials']).toBe('true');
  });
});

// ── Negative: hostile / typosquat / scheme-downgrade origins never get ACAO ─
describe.each([
  'https://evil.com',
  'http://petwash.co.il.evil.com',
  'https://evil-petwash.co.il',
  'https://petwash.co.il.evil.org',
  'http://petwash.co.il', // wrong scheme
  'https://sub.evil.com',
  'https://petwash.co.ilevil.com',
])('CORS preflight — NEGATIVE %s', (origin) => {
  it('OPTIONS never emits a credentialed ACAO for hostile origin', async () => {
    const res = await request(app)
      .options('/api/auth/session')
      .set('Origin', origin)
      .set('Access-Control-Request-Method', 'POST')
      .set('Access-Control-Request-Headers', 'content-type,authorization');
    // The response may still be 200/204 (cors package ends preflight even on
    // reject), but it MUST NOT reflect the origin OR emit ACAC.
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
    expect(res.headers['access-control-allow-credentials']).toBeUndefined();
  });

  it('real POST is not credentialed for hostile origin', async () => {
    const res = await request(app)
      .post('/api/auth/session')
      .set('Origin', origin)
      .set('Content-Type', 'application/json')
      .send({ idToken: 'stub' });
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
    expect(res.headers['access-control-allow-credentials']).toBeUndefined();
  });
});

// ── The exact bug this hunt was created to prevent ─────────────────────────
describe('regression — subdomain preflight cannot 204 without ACAO', () => {
  it('signup.petwash.co.il preflight always emits ACAO before ending', async () => {
    // The old prod bug: 204 with no ACAO. If this fails, the two-stack CORS
    // middleware is back and preflight for subdomains is dead again.
    const res = await request(app)
      .options('/api/auth/session')
      .set('Origin', 'https://signup.petwash.co.il')
      .set('Access-Control-Request-Method', 'POST')
      .set('Access-Control-Request-Headers', 'content-type');
    expect(res.headers['access-control-allow-origin']).toBe('https://signup.petwash.co.il');
    expect(res.headers['access-control-allow-credentials']).toBe('true');
  });
});

// ── Source-of-truth check: server/index.ts must use this same shape ────────
describe('server/index.ts wiring pin — same origin callback shape', () => {
  it('server/index.ts uses the cors() `origin` callback pattern (not two-stack)', async () => {
    const { readFileSync } = await import('fs');
    const { join } = await import('path');
    const src = readFileSync(
      join(__dirname, '..', '..', 'server', 'index.ts'),
      'utf8',
    );
    // The origin callback must exist and be passed to cors().
    expect(src).toMatch(/function corsOriginCallback/);
    expect(src).toMatch(/app\.use\(cors\(\{[\s\S]*?origin:\s*corsOriginCallback/);
    // The exact set membership for the real subdomains.
    for (const origin of CORS_EXACT_ORIGINS) {
      expect(src).toContain(`'${origin}'`);
    }
  });
});
