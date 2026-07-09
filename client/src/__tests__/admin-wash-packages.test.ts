/**
 * Admin wash-packages manager — regression pins (2026-07-09).
 *
 * Prod /api/packages was empty (homepage section blank) and the only source was a
 * STALE hardcoded seed (₪39 vs the live ₪48). This adds an admin-gated CRUD so the
 * CEO sets the real packages + prices himself — no code deploy, no guessing — and
 * the homepage populates the moment a package is active.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const repo = path.resolve(__dirname, '..', '..', '..');
const ROUTES = fs.readFileSync(path.join(repo, 'server', 'routes.ts'), 'utf8');
const STORAGE = fs.readFileSync(path.join(repo, 'server', 'storage.ts'), 'utf8');
const APP = fs.readFileSync(path.join(repo, 'client', 'src', 'App.tsx'), 'utf8');
const PAGE = path.join(repo, 'client', 'src', 'pages', 'AdminWashPackages.tsx');

describe('admin wash-packages management (2026-07-09)', () => {
  it('storage exposes list-all + update', () => {
    expect(STORAGE).toMatch(/getAllWashPackages\(\): Promise/);
    expect(STORAGE).toMatch(/updateWashPackage\(id: number, patch: Partial/);
  });

  it('server has admin-gated CRUD routes', () => {
    expect(ROUTES).toMatch(/app\.get\('\/api\/admin\/wash-packages', requireAdmin/);
    expect(ROUTES).toMatch(/app\.post\('\/api\/admin\/wash-packages', requireAdmin/);
    expect(ROUTES).toMatch(/app\.patch\('\/api\/admin\/wash-packages\/:id', requireAdmin/);
  });

  it('client page exists and is routed behind the admin guard', () => {
    expect(fs.existsSync(PAGE)).toBe(true);
    expect(APP).toMatch(/const AdminWashPackages = lazy/);
    expect(APP).toMatch(/path="\/admin\/wash-packages"/);
    // it must invalidate the public homepage query so the section refreshes
    expect(fs.readFileSync(PAGE, 'utf8')).toMatch(/queryKey: \['\/api\/packages'\]/);
  });
});
