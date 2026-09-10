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
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { repoGrep } from './helpers/repoGrep';

/*
 * WHOLE-TREE SCAN BUDGET (2026-09-10). These pins walk every .ts (and for some,
 * .tsx) under server/, shared/ and client/ in-process. They used to shell out
 * to ripgrep — a purpose-built parallel scanner — but ripgrep is not a
 * dependency of this repo and is often a shell function rather than a binary,
 * so `execSync` could never find it and NONE of these tests could run.
 *
 * In-process, a single file finishes in well under a second. But `test:money`
 * runs these files in PARALLEL workers that each fill their own cache and
 * contend for I/O, and that is enough to blow vitest's 5s default. A timeout
 * presents identically to a real regression, so the budget is explicit and
 * generous rather than left to chance.
 */
vi.setConfig({ testTimeout: 60_000 });


const ROOT = join(__dirname, '..', '..');

/**
 * Search the tree for `pattern`. This used to shell out to ripgrep with a
 * POSIX-grep fallback; both are gone in favour of an in-process walk, so the
 * pin no longer depends on which binaries happen to exist on the machine.
 */
function grepRepo(pattern: string): string[] {
  // Was `execSync("rg ...")`. ripgrep is not a dependency of this repo and
  // is frequently a shell function rather than a binary, so /bin/sh could not
  // find it and every test in this file died before asserting. See
  // server/tests/helpers/repoGrep.ts.
  return repoGrep(ROOT, pattern, {
    includeExt: ['ts'],
  });
}

describe('prestige-pass admin gate — must never reintroduce broken pattern (AUDIT-AUTH-7 / #240)', () => {
  const PATTERN = String.raw`session\?\.user\?\.isAdmin`;

  // 30s: ripgrep finishes in well under a second, but the POSIX-grep fallback
  // (machines without rg) walks the tree serially and needs more than vitest's
  // 5s default.
  it('the broken admin-gate pattern must not appear ANYWHERE in the repo', () => {
    const hits = grepRepo(PATTERN);
    expect(
      hits,
      `session?.user?.isAdmin is a phantom field that fails CLOSED — use isSuperAdminVerified(req) instead. Offenders:\n${hits.join('\n')}`,
    ).toEqual([]);
  }, 30_000);
});
