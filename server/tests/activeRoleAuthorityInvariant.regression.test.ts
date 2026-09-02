/**
 * Regression pin — activeRole is UX preference, never authority
 * (CEO D5 auth-rebuild directive 2026-09-01).
 *
 * The CEO invariant is: `activeRole` (the mode the user picked in
 * the mode-switcher) selects which surface renders and which nav
 * items show, and NOTHING more. Every real gate — "can this user
 * write to prestige-pass?", "can this user hit the admin console?",
 * "can this session release escrow?" — MUST derive from the
 * server-computed capabilities set (`getUserCapabilities(uid)`),
 * NEVER from `activeRole` or its persisted mirror
 * `users.last_active_role`.
 *
 * The most common way that invariant erodes is a well-meaning
 * refactor that grafts a shortcut of the shape:
 *
 *   if (user.activeRole === 'admin') { … let them in … }
 *   if (session.activeRole === 'provider') { … skip requireProvider … }
 *
 * — both of which turn a client-controlled preference into an
 * authority signal, exactly the D5 anti-pattern.
 *
 * This pin refuses any such shortcut anywhere in the repo, with
 * two carve-outs:
 *
 *   1. server/routes/me-active-role.ts — the endpoint that reads
 *      and writes the preference itself. It uses activeRole as
 *      DATA (the value being stored), never as an authority check.
 *
 *   2. server/services/SessionService.ts + sessionShadowVerify — the
 *      canonical write path that persists activeRole on a session
 *      row. Also DATA, not authority.
 */
import { execSync } from 'node:child_process';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = join(__dirname, '..', '..');

const ALLOWED = new Set<string>([
  'server/routes/me-active-role.ts',
  'server/services/SessionService.ts',
  'server/middleware/sessionShadowVerify.ts',
  // Client capability aggregator reads users.last_active_role only to
  // ECHO it back to the /api/me/capabilities response — never to gate.
  'server/routes/me-capabilities.ts',
  'server/lib/userCapabilities.ts',
]);

function grepRepo(pattern: string): string[] {
  try {
    const out = execSync(
      `rg --no-heading -n -g '*.ts' -g '!server/tests/**' -g '!**/node_modules/**' -g '!client/**' ${JSON.stringify(pattern)} ${ROOT}`,
      { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'], timeout: 30_000 },
    );
    return out.split('\n').filter(Boolean);
  } catch (err: any) {
    if (err?.status === 1) return [];
    throw err;
  }
}

function stray(hits: string[]): string[] {
  return hits
    .map((l) => l.split(':')[0].replace(ROOT + '/', ''))
    .filter((f) => !ALLOWED.has(f));
}

describe('CEO D5 — activeRole is UX preference, never authority', () => {
  it('no server code branches on `.activeRole === <role>` as an authority check', () => {
    // Pattern: `.activeRole === '<any-role>'` or `.activeRole == "<any-role>"`.
    // A comparison of activeRole to a role literal is the D5 anti-pattern
    // regardless of which role — the check treats the preference as authority.
    const hits = grepRepo(String.raw`\.activeRole\s*={2,3}\s*['"][a-z_]+['"]`);
    const strays = stray(hits);
    expect(
      strays,
      `activeRole must never be compared to a role literal — that turns a UX preference into an authority check. Offenders:\n${strays.join('\n')}`,
    ).toEqual([]);
  });

  it('no server code branches on `.lastActiveRole === <role>` as an authority check', () => {
    const hits = grepRepo(String.raw`\.lastActiveRole\s*={2,3}\s*['"][a-z_]+['"]`);
    const strays = stray(hits);
    expect(
      strays,
      `users.last_active_role must never be compared to a role literal for authority. Offenders:\n${strays.join('\n')}`,
    ).toEqual([]);
  });

  it('no server code uses activeRole inside a role-array `.includes()` or `.indexOf()` authority check', () => {
    // `[…].includes(user.activeRole)` and friends turn the preference into
    // an authority signal. The correct path is
    // `rolesFromCapabilities(caps).includes(<role>)`.
    const hits = grepRepo(String.raw`\.includes\([a-zA-Z_.]*\.activeRole\)`);
    const strays = stray(hits);
    expect(strays).toEqual([]);
  });

  it('me-active-role endpoint reads capabilities via the server aggregator, not from activeRole', () => {
    const src = require('node:fs').readFileSync(
      join(ROOT, 'server/routes/me-active-role.ts'),
      'utf8',
    ) as string;
    // The endpoint must compute authorizedRoles from getUserCapabilities,
    // then reject when the requested role is not in that set. If someone
    // ever rewrites the guard to trust the request body or the client's
    // stored preference, this assertion fails.
    expect(src).toMatch(/getUserCapabilities\(uid,\s*\{\s*superAdminVerified:\s*isSuperAdminVerified\(req\)/);
    expect(src).toMatch(/if\s*\(\s*!\s*authorizedRoles\.includes\(requested\)\s*\)/);
    expect(src).toMatch(/ROLE_NOT_AUTHORIZED/);
  });

  it('me-active-role accepts a FIXED closed allowlist — never a free-form role name', () => {
    const src = require('node:fs').readFileSync(
      join(ROOT, 'server/routes/me-active-role.ts'),
      'utf8',
    ) as string;
    // The allowlist is `customer, provider, staff, admin` — super_admin
    // must NOT be switchable via this preference endpoint.
    expect(src).toMatch(/const ACCEPTED_ROLES\s*=\s*\[\s*['"]customer['"]\s*,\s*['"]provider['"]\s*,\s*['"]staff['"]\s*,\s*['"]admin['"]\s*\]\s*as const/);
    expect(src).not.toMatch(/['"]super_admin['"]/);
  });
});
