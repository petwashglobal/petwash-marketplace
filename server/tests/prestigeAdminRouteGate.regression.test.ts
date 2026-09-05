/**
 * Prestige-pass /admin gate — behavioural regression pin (2026-09-06 sweep).
 *
 * THE BUG: server/routes.ts mounts this router with `optionalFirebaseToken`,
 * so authentication is OPTIONAL and every handler must check for itself.
 * 369 routes live under /admin. The finance surface calls requireFinanceRole()
 * (→ isSuperAdminVerified → 403), but a later-added block of ~45
 * governance/system routes shipped with NO check at all, e.g.
 *
 *     router.post('/admin/wallet/kill-switches/:key/toggle', async (req,res) => {
 *       const current = await pool.query(...);            // no auth anywhere
 *       await pool.query(`UPDATE system_kill_switches SET enabled = ...`);
 *
 * `router.use('/admin/wallet', adminWalletAuditMiddleware)` LOOKS like a gate
 * but only writes audit rows and calls next() — it even labels the
 * unauthenticated caller 'admin'.
 *
 * Proven against production 2026-09-06: an anonymous POST to
 * /api/prestige-pass/admin/wallet/kill-switches/<nonexistent>/toggle returned
 * 404 "Kill switch not found" — i.e. it reached the handler body. With a real
 * key it would have flipped a money kill switch. CSRF is no barrier (a Bearer
 * header skips it; a token is publicly fetchable from GET /api/csrf-token).
 *
 * The fix is a single router.use('/admin', ...) gate in front of the whole
 * surface, so the next route appended to this 17k-line file cannot miss it.
 * These tests drive that gate through a real Express app.
 */
import express from 'express';
import request from 'supertest';
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const ADMIN_SECRET = 'test-admin-secret-value-not-real';
let superAdmin = false;

vi.mock('../middleware/rbac', () => ({
  isSuperAdminVerified: () => superAdmin,
}));
vi.mock('../lib/logger', () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

const { isValidAdminSecret } = await import('../lib/admin-secret');
const { isSuperAdminVerified } = await import('../middleware/rbac');

/**
 * The gate exactly as mounted in prestige-pass.ts. Kept in lockstep with the
 * route file by the source pin at the bottom of this file.
 */
function buildApp() {
  const app = express();
  app.use(express.json());
  const MACHINE_CREDENTIAL_ROUTES = new Set([
    '/manual-credit', '/reissue', '/send-founder-pass', '/send-demo-receipts',
  ]);
  app.use('/admin', (req: any, res: any, next: any) => {
    if (isSuperAdminVerified(req)) return next();
    const relPath = (req.path || '/').replace(/\/+$/, '') || '/';
    if (MACHINE_CREDENTIAL_ROUTES.has(relPath) && isValidAdminSecret(req)) return next();
    return res.status(403).json({ error: 'Admin only', code: 'ADMIN_REQUIRED' });
  });
  // Stand-ins for the real unauthenticated handlers.
  app.post('/admin/wallet/kill-switches/:key/toggle', (_req, res) => res.json({ reached: true }));
  app.post('/admin/system/e2e/run', (_req, res) => res.json({ reached: true }));
  app.patch('/admin/wallet/remediation-plans/:id', (_req, res) => res.json({ reached: true }));
  app.get('/admin/wallet/alerts', (_req, res) => res.json({ reached: true }));
  app.post('/admin/manual-credit', (_req, res) => res.json({ reached: true }));
  return app;
}

describe('prestige-pass /admin gate — anonymous callers cannot reach handlers', () => {
  const ORIGINAL = process.env.ADMIN_SECRET;
  beforeEach(() => {
    superAdmin = false;
    process.env.ADMIN_SECRET = ADMIN_SECRET;
  });
  afterEach(() => {
    if (ORIGINAL === undefined) delete process.env.ADMIN_SECRET;
    else process.env.ADMIN_SECRET = ORIGINAL;
  });

  it('THE PIN: anonymous kill-switch toggle is blocked (was reaching the handler in prod)', async () => {
    const res = await request(buildApp())
      .post('/admin/wallet/kill-switches/PAYOUTS_ENABLED/toggle')
      .send({});
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('ADMIN_REQUIRED');
    expect(res.body.reached).toBeUndefined();
  });

  it('blocks every other previously-open governance/system route', async () => {
    const app = buildApp();
    const cases: Array<[string, string]> = [
      ['post', '/admin/system/e2e/run'],
      ['patch', '/admin/wallet/remediation-plans/7'],
      ['get', '/admin/wallet/alerts'],
    ];
    for (const [method, url] of cases) {
      const res = await (request(app) as any)[method](url).send({});
      expect(res.status, `${method.toUpperCase()} ${url}`).toBe(403);
      expect(res.body.reached, `${method.toUpperCase()} ${url}`).toBeUndefined();
    }
  });

  it('a forged admin secret does not open the gate', async () => {
    for (const forged of ['anything', 'admin', 'true', ADMIN_SECRET.slice(0, -1), `${ADMIN_SECRET}x`]) {
      const res = await request(buildApp())
        .post('/admin/manual-credit')
        .set('x-admin-secret', forged)
        .send({});
      expect(res.status, forged).toBe(403);
    }
  });

  it('a verified super-admin still gets through', async () => {
    superAdmin = true;
    const res = await request(buildApp()).post('/admin/system/e2e/run').send({});
    expect(res.status).toBe(200);
    expect(res.body.reached).toBe(true);
  });

  // ── AUTHORITY SCOPING — the property that matters most here ──────────────
  // Closing anonymous access must NOT convert 45 open routes into 45 routes
  // that one shared secret can drive. The machine credential opens only the
  // four legacy routes explicitly built for it.

  it('THE SCOPING PIN: a GENUINE ADMIN_SECRET does NOT open the governance routes', async () => {
    const app = buildApp();
    for (const url of [
      '/admin/system/e2e/run',
      '/admin/wallet/kill-switches/PAYOUTS_ENABLED/toggle',
    ]) {
      const res = await request(app).post(url).set('x-admin-secret', ADMIN_SECRET).send({});
      expect(res.status, url).toBe(403);
      expect(res.body.reached, url).toBeUndefined();
    }
  });

  it('the genuine ADMIN_SECRET still works on its four intended legacy routes', async () => {
    const res = await request(buildApp())
      .post('/admin/manual-credit')
      .set('x-admin-secret', ADMIN_SECRET)
      .send({});
    expect(res.status).toBe(200);
  });

  it('a trailing slash cannot smuggle a route past the machine allowlist', async () => {
    const res = await request(buildApp())
      .post('/admin/system/e2e/run/')
      .set('x-admin-secret', ADMIN_SECRET)
      .send({});
    expect(res.status).toBe(403);
  });

  it('fails closed when ADMIN_SECRET is unset', async () => {
    delete process.env.ADMIN_SECRET;
    const res = await request(buildApp())
      .post('/admin/manual-credit')
      .set('x-admin-secret', 'anything')
      .send({});
    expect(res.status).toBe(403);
  });
});

describe('the gate is actually mounted in prestige-pass.ts — source pin', () => {
  const SRC = fs.readFileSync(
    path.resolve(__dirname, '..', 'routes', 'prestige-pass.ts'),
    'utf8',
  );

  it("mounts router.use('/admin', ...) with both accepted identities", () => {
    expect(SRC).toMatch(/router\.use\('\/admin',/);
    expect(SRC).toContain("code: 'ADMIN_REQUIRED'");
    expect(SRC).toMatch(/if \(isSuperAdminVerified\(req as any\)\) return next\(\);/);
    // The machine credential must be gated behind the explicit allowlist —
    // never a bare `if (isValidAdminSecret(req)) return next();` bypass.
    expect(SRC).toMatch(/MACHINE_CREDENTIAL_ROUTES\.has\(relPath\) && isValidAdminSecret\(req\)/);
    expect(SRC).not.toMatch(/^\s*if \(isValidAdminSecret\(req\)\) return next\(\);/m);
  });

  it('the gate is registered BEFORE the first /admin route definition', () => {
    const gateIdx = SRC.indexOf("router.use('/admin',");
    const firstAdminRoute = SRC.search(/router\.(get|post|put|patch|delete)\(\s*['"]\/admin/);
    expect(gateIdx).toBeGreaterThan(-1);
    expect(firstAdminRoute).toBeGreaterThan(-1);
    // Express matches middleware in registration order — a gate declared after
    // the routes would protect nothing.
    expect(gateIdx).toBeLessThan(firstAdminRoute);
  });
});
