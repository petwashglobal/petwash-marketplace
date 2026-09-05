/**
 * K9000 dashboard hardware control — auth regression pin (2026-09-06 sweep).
 *
 * THE BUG: server/routes.ts mounts this router with `optionalFirebaseToken`,
 * so authentication is OPTIONAL and each handler must gate itself. Two
 * handlers that drive PHYSICAL hardware at the live Kfar Saba bays did not:
 *
 *   POST /api/k9000/dashboard/stop   — emergency-stops a station
 *   POST /api/k9000/dashboard/start  — starts a wash cycle, and reads
 *                                      `userId` and `amount` straight from
 *                                      the anonymous request body with
 *                                      `const washAmount = amount || 0`
 *
 * So an anonymous caller could stop the bays (denial of service on real
 * equipment) or start a wash attributed to any userId at any amount,
 * defaulting to free. The only identity reference in either handler was for
 * LOGGING and fell back to the literal 'admin' — the same anti-pattern found
 * in prestige-pass's adminWalletAuditMiddleware — so the audit trail would
 * have recorded an anonymous caller as an administrator.
 *
 * /bay/:bayId/health in this same file already used requireAdmin, so the
 * guard was imported and in use two hundred lines above the hole.
 *
 * These tests drive requireAdmin's contract through a real Express app and
 * pin that both hardware routes sit behind it.
 */
import express from 'express';
import request from 'supertest';
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect, vi, beforeEach } from 'vitest';

let adminAllowed = false;

// Stand-in with requireAdmin's contract: reject unless the caller is a
// verified admin. The source pin below proves the real routes use the real one.
function requireAdminStub(req: any, res: any, next: any) {
  if (adminAllowed) return next();
  return res.status(403).json({ error: 'Admin access required' });
}

function buildApp() {
  const app = express();
  app.use(express.json());
  app.post('/dashboard/stop', requireAdminStub, (_req, res) => res.json({ reached: true }));
  app.post('/dashboard/start', requireAdminStub, (_req, res) => res.json({ reached: true }));
  return app;
}

describe('K9000 hardware routes reject anonymous callers', () => {
  beforeEach(() => { adminAllowed = false; });

  it('THE PIN: anonymous emergency-stop cannot reach the handler', async () => {
    const res = await request(buildApp())
      .post('/dashboard/stop')
      .send({ stationId: 'IL-KS-001', reason: 'anon' });
    expect(res.status).toBe(403);
    expect(res.body.reached).toBeUndefined();
  });

  it('THE PIN: anonymous free-wash start cannot reach the handler', async () => {
    // The exact shape the old handler would have honoured: someone else's
    // userId, amount omitted so `amount || 0` makes it free.
    const res = await request(buildApp())
      .post('/dashboard/start')
      .send({ stationId: 'IL-KS-001', washProgram: 'premium', userId: 'victim-uid' });
    expect(res.status).toBe(403);
    expect(res.body.reached).toBeUndefined();
  });

  it('an admin still gets through both', async () => {
    adminAllowed = true;
    const app = buildApp();
    for (const url of ['/dashboard/stop', '/dashboard/start']) {
      const res = await request(app).post(url).send({ stationId: 'IL-KS-001' });
      expect(res.status, url).toBe(200);
      expect(res.body.reached, url).toBe(true);
    }
  });
});

describe('both hardware routes are wired to requireAdmin — source pin', () => {
  const SRC = fs.readFileSync(
    path.resolve(__dirname, '..', 'routes', 'k9000Dashboard.ts'),
    'utf8',
  );

  it('stop and start both mount requireAdmin', () => {
    expect(SRC).toMatch(/router\.post\('\/dashboard\/stop',\s*requireAdmin,/);
    expect(SRC).toMatch(/router\.post\('\/dashboard\/start',\s*requireAdmin,/);
  });

  it('requireAdmin is the real canonical guard, imported from adminAuth', () => {
    expect(SRC).toMatch(/import \{ requireAdmin \} from '\.\.\/adminAuth'/);
  });

  it('no ungated POST remains in this router', () => {
    // Any future `router.post('/x', async` with no middleware argument fails
    // here — the shape that caused this bug in the first place. The retired
    // 410 stub is the one allowed exception.
    const ungated = [...SRC.matchAll(/router\.post\('([^']+)',\s*(?:async\s*)?\(/g)]
      .map((m) => m[1])
      .filter((p) => p !== '/dashboard/apply-discount'); // retired: returns 410
    expect(ungated).toEqual([]);
  });
});
