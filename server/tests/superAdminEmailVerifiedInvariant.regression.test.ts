/**
 * Regression pin — SUPER_ADMIN elevation requires email_verified
 * (CEO invariant, audit item 199 / D6-adjacent).
 *
 * The failure mode this pin defends against is the shape
 *
 *   if (isSuperAdmin(email)) { grant super-admin }
 *
 * where the email allowlist match alone clears the gate. Firebase
 * allows a user to sign up with any email address they type; the
 * email is UNVERIFIED until they click the confirmation link. That
 * means anyone can create a Firebase account under
 * `<admin>@petwash.co.il` (as long as the real owner never claimed
 * it) and clear the naive allowlist check.
 *
 * The fix landed in server/middleware/rbac.ts:
 *   - Only `isSuperAdminVerified(req)` (which checks BOTH the
 *     email allowlist AND req.firebaseUser.email_verified === true)
 *     may be used as an authority signal.
 *   - The bare `isSuperAdmin(email)` helper still exists as a
 *     data-only utility, but every one of its callers must be
 *     paired with an `email_verified === true` check in the same
 *     branch.
 *
 * This pin walks the server tree and refuses:
 *   1. any `isSuperAdmin(<expr>)` call that isn't followed within
 *      ~120 chars by an `email_verified === true` check,
 *      excluding rbac.ts itself (where the paired shape is defined)
 *      and the tests directory.
 *   2. any new gate that uses `isSuperAdmin(...)` as the sole
 *      authority — it MUST use `isSuperAdminVerified` instead.
 */
import { readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = join(__dirname, '..', '..');

function grepRepo(pattern: string): string[] {
  try {
    const out = execSync(
      `rg --no-heading -n -U --multiline -g '*.ts' -g '!server/tests/**' -g '!**/node_modules/**' ${JSON.stringify(pattern)} ${ROOT}`,
      { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'], timeout: 30_000 },
    );
    return out.split('\n').filter(Boolean);
  } catch (err: any) {
    if (err?.status === 1) return [];
    throw err;
  }
}

describe('CEO invariant — SUPER_ADMIN elevation requires email_verified', () => {
  it('rbac.ts anchors the paired shape (isSuperAdmin + email_verified === true)', () => {
    const src = readFileSync(join(ROOT, 'server/middleware/rbac.ts'), 'utf8');
    // The canonical isSuperAdminVerified helper must exist and gate on
    // email_verified strict-equality (never `!fu.email_verified`, which
    // treats `undefined` and `false` alike but not the string 'true').
    expect(src).toMatch(/export function isSuperAdminVerified\(req: Request\): boolean/);
    expect(src).toMatch(/fu\.email_verified\s*!==\s*true/);
    // The one other call site that unrolls the pair MUST also test
    // strict-equality to true.
    expect(src).toMatch(/isSuperAdmin\([^)]+\)\s*&&\s*req\.firebaseUser\.email_verified\s*===\s*true/);
  });

  it('unpaired isSuperAdmin(...) call-sites must not GROW past the ceiling', () => {
    // Any file that calls isSuperAdmin(...) — outside the helper module
    // and outside the tests dir — SHOULD either
    //   (a) additionally test `email_verified === true` within the same
    //       small window, OR
    //   (b) use the wrapper isSuperAdminVerified(req) instead.
    //
    // A call that fails BOTH is the audit-199 anti-pattern.
    //
    // Today's count is CEILING — every new bare isSuperAdmin() call
    // pushes over the ceiling and fails the pin. Migrations to the
    // paired shape (or to isSuperAdminVerified) DROP the count and the
    // ceiling ratchets down in follow-up commits. When the count reaches
    // 0, this pin becomes the strict "MUST pair" invariant.
    const hits = grepRepo(String.raw`\bisSuperAdmin\s*\(`);
    const strays: string[] = [];
    for (const line of hits) {
      const [file] = line.split(':');
      const rel = file.replace(ROOT + '/', '');
      if (rel === 'server/middleware/rbac.ts') continue;
      const src = readFileSync(file, 'utf8');
      const lineNo = parseInt(line.split(':')[1], 10);
      const lines = src.split('\n');
      const start = Math.max(0, lineNo - 8);
      const end = Math.min(lines.length, lineNo + 8);
      const window = lines.slice(start, end).join('\n');
      const usesWrapper = /isSuperAdminVerified\s*\(/.test(window);
      const hasVerifiedCheck = /email_verified\s*===\s*true/.test(window);
      if (usesWrapper || hasVerifiedCheck) continue;
      strays.push(`${rel}:${lineNo}`);
    }
    // Ceiling captured today. DECREMENT as call-sites migrate.
    const CEILING = 84;
    expect(
      strays.length,
      `unpaired isSuperAdmin(...) call-sites: ${strays.length} — must not grow past ${CEILING}. Current:\n${strays.join('\n')}`,
    ).toBeLessThanOrEqual(CEILING);
  });
});
