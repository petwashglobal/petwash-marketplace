/**
 * Regression pin — prestige-pass admin gate (AUDIT-AUTH-7 / #240).
 *
 * server/routes/prestige-pass.ts previously used the pattern:
 *   if (!session?.user?.isAdmin) return res.status(403).json(...)
 *
 * on ~160 endpoints. `session.user.isAdmin` is never set anywhere in
 * the code base — the field simply doesn't exist on the session shape.
 * The gate therefore failed CLOSED for every request, making these
 * admin endpoints effectively unreachable — a SAFETY problem
 * masquerading as a security fix: the intent was "admins only", but
 * the effect was "nobody, ever". A well-meaning operator would then
 * "fix" it by grafting on a misconfigured shortcut and open the barn
 * door instead.
 *
 * FIX: every occurrence was migrated to `isSuperAdminVerified(req)`
 * from server/middleware/rbac.ts — that helper reads the Firebase
 * custom claims + email allowlist and CANNOT be silently unset by
 * refactor.
 *
 * This pin refuses ANY reintroduction of the broken
 * `session?.user?.isAdmin` pattern anywhere in the repo. Zero
 * occurrences allowed.
 */
import { execSync } from 'node:child_process';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = join(__dirname, '..', '..');

function grepRepo(pattern: string): string[] {
  try {
    const out = execSync(
      `rg --no-heading -n -g '*.ts' -g '!server/tests/**' -g '!**/node_modules/**' ${JSON.stringify(pattern)} ${ROOT}`,
      { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] },
    );
    return out.split('\n').filter(Boolean);
  } catch (err: any) {
    if (err?.status === 1) return [];
    throw err;
  }
}

describe('prestige-pass admin gate — must never reintroduce broken pattern (AUDIT-AUTH-7 / #240)', () => {
  const PATTERN = String.raw`session\?\.user\?\.isAdmin`;

  it('the broken admin-gate pattern must not appear ANYWHERE in the repo', () => {
    const hits = grepRepo(PATTERN);
    expect(
      hits,
      `session?.user?.isAdmin is a phantom field that fails CLOSED — use isSuperAdminVerified(req) instead. Offenders:\n${hits.join('\n')}`,
    ).toEqual([]);
  });
});
