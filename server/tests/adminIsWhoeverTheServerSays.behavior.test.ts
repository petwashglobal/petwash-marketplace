import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

/**
 * THE SERVER DECIDES WHO IS AN ADMIN.
 *
 * 2026-09-17, live: the CEO signed in, every admin API answered 200
 * (/api/admin/auth/me, /api/admin/octopus/overview, both review queues) — and
 * the page still showed "your account has no admin access yet".
 *
 * auth-guardian-2025 answered from the ID token's `admin` custom claim OR
 * VITE_ADMIN_EMAILS. Production writes NEITHER: admin comes from the
 * super-admin allowlist + verified email + the admin_users row, and the `admin`
 * custom claim was deliberately removed as an escalation surface (#2353).
 * So the browser accused every real admin of not being one.
 */
const SRC = readFileSync(resolve(__dirname, '..', '..', 'client/src/lib/auth-guardian-2025.ts'), 'utf8');

describe('client admin verdict', () => {
  it('asks the server, and only the server', () => {
    expect(SRC).toContain("const r = await fetch('/api/session/whoami', { credentials: 'include' });");
    expect(SRC).toContain("return Boolean(who?.isSuperAdmin) || (who?.dashboardsAllowed ?? []).includes('admin');");
  });

  it('no longer guesses from a custom claim or a build-time email list', () => {
    expect(SRC).not.toMatch(/tokenResult\.claims\?\.admin/);
    expect(SRC).not.toMatch(/EXPECTED\.adminEmails\.includes/);
  });

  it('a network failure is not a refusal — only the server\'s own "no" shows the banner', () => {
    expect(SRC).toContain('if (path.includes(\'/admin\') && verdict === false) {');
    expect(SRC).toContain('return null;                                  // offline: never accuse the user');
  });

  it('the admin-only route guard uses the same verdict', () => {
    expect(SRC).toContain('const isAdmin = (await serverSaysAdmin()) === true;');
  });
});
