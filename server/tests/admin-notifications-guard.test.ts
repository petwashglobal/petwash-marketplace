/**
 * Issue #148 P5 (admin-notifications mount) — regression pin.
 *
 * #148 P5 moved the guard to router level so no future handler could skip it.
 *
 * 2026-09-13 (live, CEO signed in as super admin): that guard was a LOCAL
 * requireAdmin accepting only a Bearer token with claims.role === 'admin', and
 * `router.use(requireAdmin)` on a router mounted at '/api/admin' runs for every
 * /api/admin/* request that reaches it. Every admin router mounted after it —
 * octopus dashboard, paw-finder, adoption and 18 more — answered
 * "Admin access required" to the super admin.
 *
 * Pins: the canonical adminAuth.requireAdmin, scoped to this router's own paths,
 * and a behavioural check that another /api/admin router is never intercepted.
 */

import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import request from 'supertest';
import { describe, it, expect, vi } from 'vitest';

vi.mock('../db', () => ({ db: {}, pool: { query: vi.fn() } }));
vi.mock('../services/NotificationRetryService', () => ({ NotificationRetryService: { runOnce: vi.fn() } }));
vi.mock('../middleware/auditLog', () => ({ logAuditEvent: vi.fn(async () => {}) }));
vi.mock('../adminAuth', () => ({
  requireAdmin: (_req: any, res: any) => res.status(403).json({ error: 'Admin access required' }),
}));

const SRC = fs.readFileSync(
  path.resolve(__dirname, '..', 'routes', 'admin-notifications.ts'),
  'utf8',
);

describe('admin-notifications — Issue #148 P5 regression pin', () => {
  it('uses the canonical requireAdmin, not a local claims-only copy', () => {
    expect(SRC).toMatch(/import\s*\{\s*requireAdmin\s*\}\s*from\s*['"]\.\.\/adminAuth['"]/);
    expect(SRC).not.toMatch(/async function requireAdmin\(/);
  });

  it('guards only its own paths at router level', () => {
    expect(SRC).toContain("export const ADMIN_NOTIFICATION_PATHS = ['/notifications', '/financial-documents', '/event-matrix'];");
    expect(SRC).toContain('router.use(ADMIN_NOTIFICATION_PATHS, requireAdmin);');
    expect(SRC).not.toMatch(/^router\.use\(\s*requireAdmin\s*\)/m);
  });

  it('every handler path is covered by the scoped guard', () => {
    const paths = [...SRC.matchAll(/router\.(?:get|post|put|patch|delete)\(\s*'([^']+)'/g)].map((m) => m[1]);
    expect(paths.length).toBeGreaterThan(0);
    for (const p of paths) {
      expect(['/notifications', '/financial-documents', '/event-matrix'].some((g) => p === g || p.startsWith(g + '/')), p).toBe(true);
    }
  });

  it('does NOT pass requireAdmin per handler (would mean 2x token verifies)', () => {
    expect(SRC).not.toMatch(/router\.(get|post|put|patch|delete)\([^)]+,\s*requireAdmin\s*,/);
  });

  it('emits NOTIFICATION_RETRY_SWEEP audit on the single mutation', () => {
    expect(SRC).toMatch(/actionType:\s*['"]NOTIFICATION_RETRY_SWEEP['"]/);
    expect(SRC).toMatch(/targetType:\s*['"]notification_retry_queue['"]/);
  });

  it('audit emission uses setImmediate fire-and-forget pattern', () => {
    expect(SRC).toMatch(/setImmediate\(\s*\(\)\s*=>\s*\{[\s\S]*logAuditEvent\(/);
  });
});

describe('admin-notifications never blocks another /api/admin router', async () => {
  const router = (await import('../routes/admin-notifications')).default;
  const app = express();
  app.use('/api/admin', router);
  const later = express.Router();
  later.get('/octopus/overview', (_req, res) => res.json({ reached: 'octopus' }));
  later.get('/adoption/queue', (_req, res) => res.json({ reached: 'adoption' }));
  app.use('/api/admin', later);

  it('routers mounted after it are reached', async () => {
    expect((await request(app).get('/api/admin/octopus/overview')).body).toEqual({ reached: 'octopus' });
    expect((await request(app).get('/api/admin/adoption/queue')).body).toEqual({ reached: 'adoption' });
  });

  it('its own paths still require admin', async () => {
    for (const p of ['/api/admin/notifications/stats', '/api/admin/financial-documents/search', '/api/admin/event-matrix']) {
      expect((await request(app).get(p)).status, p).toBe(403);
    }
  });
});
