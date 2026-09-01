/**
 * Regression pin — GET /api/config/public.
 *
 * The one endpoint that returns SystemConfig values to unauthenticated
 * callers. Because a growing endpoint here is a growing attack surface,
 * the invariants are strict:
 *
 *   1. NO validateFirebaseToken — this is deliberately public. Adding
 *      auth would break the client's ability to fetch the cohort
 *      config BEFORE the user signs in (the whole point).
 *
 *   2. PUBLIC_KEYS is a fixed allowlist of exactly two keys — the
 *      two returning-user door flags. If a future rollout needs
 *      another public flag, edit this pin AND the allowlist. Both.
 *
 *   3. The handler NEVER calls getFeatureFlag with a key not in
 *      PUBLIC_KEYS — checked by literal-scan.
 *
 *   4. Failure of the underlying flag read fails SAFE — returns
 *      { enabled: false, percent: 0 } rather than surfacing the
 *      internal error.
 *
 *   5. Percent value is clamped to [0, 100] in the response, so a
 *      misconfigured SystemConfig value cannot break client bucket
 *      arithmetic.
 *
 *   6. Response is cacheable (Cache-Control: public) so the client
 *      only pays the round-trip once per page load.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = join(__dirname, '..', '..');
const route = readFileSync(join(ROOT, 'server/routes/config-public.ts'), 'utf8');
const routes = readFileSync(join(ROOT, 'server/routes.ts'), 'utf8');

describe('GET /api/config/public contract', () => {
  it('handler is deliberately UN-authed (no validateFirebaseToken)', () => {
    // Look at the actual router.get call — it must NOT list
    // validateFirebaseToken as middleware.
    const handler = route.match(/router\.get\(\s*['"]\/public['"][\s\S]*?\}\);/);
    expect(handler, 'GET /public handler must exist').toBeTruthy();
    expect(handler![0].includes('validateFirebaseToken')).toBe(false);
  });

  it('PUBLIC_KEYS allowlist has EXACTLY the two returning-user-door keys', () => {
    // Fixed literal — a growing allowlist is a growing surface. Any
    // new key must be added deliberately (pin + allowlist together).
    const list = route.match(/const PUBLIC_KEYS = \[([\s\S]*?)\]\s*as const;/);
    expect(list, 'PUBLIC_KEYS constant must exist').toBeTruthy();
    const body = list![1];
    const keys = [...body.matchAll(/'([^']+)'/g)].map((m) => m[1]);
    expect(keys.sort()).toEqual([
      'ff.returning_user.new_door.enabled',
      'ff.returning_user.new_door.percent',
    ].sort());
  });

  it('handler only reads keys that are in PUBLIC_KEYS', () => {
    // Find every getFeatureFlag('…') string literal and require each
    // to be one of the allowlisted keys.
    const calls = [...route.matchAll(/getFeatureFlag\(\s*['"]([^'"]+)['"]\s*\)/g)].map(
      (m) => m[1],
    );
    expect(calls.length).toBeGreaterThan(0);
    const allowed = new Set([
      'ff.returning_user.new_door.enabled',
      'ff.returning_user.new_door.percent',
    ]);
    for (const k of calls) {
      expect(allowed.has(k), `getFeatureFlag('${k}') not in PUBLIC_KEYS allowlist`).toBe(true);
    }
  });

  it('fails SAFE on error — returns { enabled: false, percent: 0 }', () => {
    // The catch branch MUST return the same safe shape as the happy
    // path, not surface the internal error.
    const catchBranch = route.match(/catch \(err:\s*any\)\s*\{[\s\S]*?\}\s*\}\);/);
    expect(catchBranch, 'catch branch must exist').toBeTruthy();
    expect(catchBranch![0]).toMatch(/enabled:\s*false/);
    expect(catchBranch![0]).toMatch(/percent:\s*0/);
    // Response must NOT be 500 (fail-safe returns 200 with the safe shape).
    expect(catchBranch![0].includes('res.status(500)')).toBe(false);
    // No `res.` line in the catch block may reference err — only the
    // logger may (server-side only, never emitted to the caller).
    const resLines = catchBranch![0]
      .split('\n')
      .filter((l) => /\bres\./.test(l));
    for (const l of resLines) {
      expect(/\berr\b/.test(l), `response line must not reference err: ${l}`).toBe(false);
    }
  });

  it('percent is clamped 0..100 in the happy-path response', () => {
    expect(route).toMatch(/Math\.max\(\s*0\s*,\s*Math\.min\(\s*100/);
  });

  it('response is cacheable (Cache-Control: public)', () => {
    expect(route).toMatch(/Cache-Control['"]\s*,\s*['"]public/);
  });

  it('router is mounted at /api/config in server/routes.ts', () => {
    expect(routes).toMatch(/import configPublicRoutes from ["']\.\/routes\/config-public["']/);
    expect(routes).toMatch(/app\.use\(\s*['"]\/api\/config['"][^)]*configPublicRoutes\s*\)/);
  });
});
