import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'fs';
import { resolve, join } from 'path';

/**
 * Live crawl 2026-09-17: /flash-deals rendered the 404 page. The route is
 * registered only when VITE_FLASH_DEALS_ENABLED === 'true' (off in production),
 * but DaycareCalculator linked to it unconditionally — a guaranteed dead end.
 *
 * Rule pinned here: a route that exists ONLY behind a build flag may only be
 * linked behind that same flag.
 */
const ROOT = resolve(__dirname, '..', '..');
const R = (p: string) => readFileSync(join(ROOT, p), 'utf8');

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(join(ROOT, dir))) {
    const rel = `${dir}/${name}`;
    if (statSync(join(ROOT, rel)).isDirectory()) walk(rel, out);
    else if (/\.(tsx|ts)$/.test(name) && !/\.test\./.test(name)) out.push(rel);
  }
  return out;
}

/** Routes in App.tsx that only exist when a VITE_ flag is 'true'. */
function flagGatedRoutes(app: string): Array<{ path: string; flag: string }> {
  const out: Array<{ path: string; flag: string }> = [];
  const re = /\{import\.meta\.env\.(VITE_[A-Z0-9_]+) === 'true' && \(\s*<Route path="([^"]+)"/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(app)) !== null) out.push({ flag: m[1], path: m[2] });
  return out;
}

describe('a flag-gated route is never linked unconditionally', () => {
  const app = R('client/src/App.tsx');
  const gated = flagGatedRoutes(app);

  it('finds the flag-gated routes (the pin is not vacuous)', () => {
    expect(gated.length).toBeGreaterThan(0);
    expect(gated.some((g) => g.path === '/flash-deals' && g.flag === 'VITE_FLASH_DEALS_ENABLED')).toBe(true);
  });

  it('every link to one sits behind the same flag', () => {
    const files = walk('client/src').filter((f) => !f.endsWith('App.tsx'));
    const offenders: string[] = [];
    for (const { path, flag } of gated) {
      for (const f of files) {
        const src = R(f);
        const idx = src.indexOf(`"${path}"`);
        if (idx === -1) continue;
        // the flag must be referenced in the same file, before the link
        const guarded = src.slice(0, idx).includes(`import.meta.env.${flag} === 'true'`);
        if (!guarded) offenders.push(`${f} links ${path} without ${flag}`);
      }
    }
    expect(offenders).toEqual([]);
  });
});
