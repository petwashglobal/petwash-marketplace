import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

/**
 * A ROUTER MOUNTED AT '/api/admin' MUST NOT GUARD EVERYTHING.
 *
 * 2026-09-13, live: the CEO signed in as super admin and every admin screen
 * said "no admin access". admin-notifications.ts was mounted with
 * `app.use('/api/admin', …, router)` and did `router.use(requireAdmin)` with a
 * claims-only check. Express runs a router-level `router.use(fn)` for EVERY
 * request that enters the router — i.e. every /api/admin/* URL — so the 21
 * admin routers mounted after it (octopus, paw-finder, adoption, …) were never
 * reached. admin-deadlines.ts did the same with a super-admin-only guard.
 *
 * Rule: for a router mounted at exactly '/api/admin', every router.use() must
 * name the paths it guards.
 */
const ROOT = resolve(__dirname, '..', '..');
const routes = readFileSync(resolve(ROOT, 'server/routes.ts'), 'utf8');

function sharedPrefixRouterFiles(): string[] {
  const vars = [...routes.matchAll(/app\.use\(\s*'\/api\/admin'\s*,[^;]*?\b([A-Za-z0-9_]+)(?:\.default)?\s*\)\s*;/g)].map((m) => m[1]);
  const files = new Set<string>();
  for (const v of vars) {
    const imp = routes.match(new RegExp(`(?:import\\s+${v}\\s+from|const\\s+${v}\\s*=\\s*await\\s+import\\()\\s*['"](\\.\\/[^'"]+)['"]`));
    if (!imp) continue;
    const file = resolve(ROOT, 'server', imp[1].replace(/^\.\//, '') + '.ts');
    if (existsSync(file)) files.add(file);
  }
  return [...files];
}

describe('routers on the shared /api/admin prefix scope their guards', () => {
  const files = sharedPrefixRouterFiles();

  it('finds the shared-prefix routers (the scan itself works)', () => {
    expect(files.some((f) => f.endsWith('admin-notifications.ts'))).toBe(true);
    expect(files.some((f) => f.endsWith('admin-deadlines.ts'))).toBe(true);
  });

  it('no router.use(fn) without a path', () => {
    const offenders: string[] = [];
    for (const f of files) {
      const src = readFileSync(f, 'utf8');
      for (const m of src.matchAll(/^router\.use\(\s*([^'"\[\s][^,)]*)\s*\)/gm)) {
        offenders.push(`${f.replace(ROOT + '/', '')}: router.use(${m[1]})`);
      }
    }
    expect(offenders).toEqual([]);
  });
});
