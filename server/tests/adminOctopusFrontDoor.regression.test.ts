/**
 * CEO 2026-07-24 "logged in to backend, it's shocking": admin login dumped
 * users into the old sprawling AdminDashboard + 107-route maze. The clean
 * canon Octopus panel is now the front door.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const R = (p: string) => readFileSync(resolve(__dirname, '..', '..', p), 'utf8');

describe('octopus is the admin front door', () => {
  it('AdminLoginV2 lands on /admin/octopus (not the old dashboard)', () => {
    const login = R('client/src/pages/admin/AdminLoginV2.tsx');
    expect(login).not.toContain('setLocation("/admin/dashboard")');
    expect(login).toContain('setLocation("/admin/octopus")');
  });

  it('/admin root redirects to octopus', () => {
    const app = R('client/src/App.tsx');
    const at = app.indexOf('path="/admin">');
    expect(app.slice(at, at + 120)).toMatch(/Redirect to="\/admin\/octopus"/);
  });

  it('classic dashboard still reachable from the panel (nothing lost)', () => {
    expect(R('client/src/pages/AdminOctopus.tsx')).toContain("to: '/admin/dashboard'");
  });
});
