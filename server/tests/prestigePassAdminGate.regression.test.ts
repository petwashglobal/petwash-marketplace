/**
 * Regression pin — prestige-pass session.user.isAdmin gate (AUDIT-AUTH-7).
 *
 * server/routes/prestige-pass.ts uses the pattern:
 *   if (!session?.user?.isAdmin) return res.status(403).json(...)
 *
 * on ~160 endpoints. `session.user.isAdmin` is never set anywhere in
 * the code base — the field simply doesn't exist on the session shape.
 * The gate therefore fails CLOSED for every request, making these
 * admin endpoints effectively unreachable.
 *
 * That is a SAFETY problem masquerading as a security fix: the intent
 * was "admins only", but the effect is "nobody, ever". Any admin who
 * needs to hit these endpoints today gets a 403 they cannot resolve,
 * so a well-meaning operator will "fix" it by grafting on a
 * misconfigured shortcut and open the barn door instead.
 *
 * PROPER FIX (out of scope for this pin — requires cross-file
 * middleware wire):
 *   Replace the inline `session?.user?.isAdmin` check with the
 *   canonical `isSuperAdminVerified(req)` helper (or the shared
 *   admin middleware in server/middleware/rbac.ts). That helper
 *   reads the Firebase custom claims + email allowlist and CANNOT be
 *   silently unset by refactor.
 *
 * THIS PIN:
 *   1. Establishes a hard ceiling at TODAY'S count (160). The count
 *      MUST decrement as endpoints get migrated to the canonical
 *      admin middleware — never grow. Any new endpoint that adds
 *      the broken pattern fails this test.
 *   2. Forbids the pattern from spreading to OTHER files. If another
 *      route file starts using `session?.user?.isAdmin`, this test
 *      surfaces it immediately.
 */
import { readFileSync } from 'node:fs';
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

describe('prestige-pass admin gate ceiling (AUDIT-AUTH-7)', () => {
  const PATTERN = String.raw`session\?\.user\?\.isAdmin`;

  it('the broken admin-gate pattern must not spread beyond prestige-pass.ts', () => {
    const hits = grepRepo(PATTERN);
    const files = new Set(
      hits.map((line) => line.split(':')[0].replace(ROOT + '/', '')),
    );
    const strays = [...files].filter((f) => f !== 'server/routes/prestige-pass.ts');
    expect(
      strays,
      `session?.user?.isAdmin pattern must ONLY appear in prestige-pass.ts; strays: ${strays.join(', ')}`,
    ).toEqual([]);
  });

  it('occurrence count in prestige-pass.ts must never GROW above the ceiling', () => {
    const src = readFileSync(
      join(ROOT, 'server/routes/prestige-pass.ts'),
      'utf8',
    );
    const matches = src.match(/session\?\.user\?\.isAdmin/g) || [];
    // Ceiling: today's count. Decrement as endpoints migrate to the
    // canonical isSuperAdminVerified() middleware. When the count
    // reaches 0, delete this pin.
    const CEILING = 160;
    expect(matches.length).toBeLessThanOrEqual(CEILING);
  });
});
