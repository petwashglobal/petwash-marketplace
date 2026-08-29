/**
 * P0 2026-08-28 (CEO §14 §23) — static lazy-import contract.
 *
 * For every `React.lazy(() => import("X"))` in App.tsx, prove that
 * the imported module RESOLVES on disk and exports a valid `default`.
 * A regression that dropped an `export default` (or introduced a
 * `.catch(() => undefined)` around the import) can now reach
 * production only by tripping CI here first.
 *
 * This is a STATIC test — it does not build or run the app. It scans
 * App.tsx for the lazy patterns, resolves the aliased path
 * ("@/pages/…" → client/src/pages/…), reads the file, and asserts
 * an `export default` marker is present. The vitest suite covers the
 * fingerprint we need before the deployment gate.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const APP = fs.readFileSync(path.join(REPO_ROOT, 'client', 'src', 'App.tsx'), 'utf8');

/** Extract every `lazy(() => import("X"))` from App.tsx. */
function extractLazyImports(source: string): string[] {
  const out = new Set<string>();
  const re = /lazy\(\(\)\s*=>\s*import\(\s*["']([^"']+)["']\s*\)\s*\)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(source)) !== null) {
    out.add(m[1]);
  }
  return [...out];
}

/** Turn "@/pages/SignUpLuxury" into an absolute filesystem path. */
function resolveAlias(spec: string): string | null {
  if (spec.startsWith('@/')) {
    return path.join(REPO_ROOT, 'client', 'src', spec.slice(2));
  }
  if (spec.startsWith('@shared/')) {
    return path.join(REPO_ROOT, 'shared', spec.slice('@shared/'.length));
  }
  if (spec.startsWith('.')) {
    return path.join(REPO_ROOT, 'client', 'src', spec);
  }
  return null;
}

/** Try common extensions until one resolves. */
function readModuleFile(base: string): { file: string; content: string } | null {
  const candidates = [
    base + '.tsx',
    base + '.ts',
    path.join(base, 'index.tsx'),
    path.join(base, 'index.ts'),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) {
      return { file: p, content: fs.readFileSync(p, 'utf8') };
    }
  }
  return null;
}

const LAZY_SPECS = extractLazyImports(APP);

describe('App.tsx lazy() contract (P0 2026-08-28 CEO §14)', () => {
  it('found at least one lazy() import — guards against a regex miss', () => {
    expect(LAZY_SPECS.length).toBeGreaterThan(0);
  });

  it('EVERY lazy import path resolves to an existing module file', () => {
    const missing: string[] = [];
    for (const spec of LAZY_SPECS) {
      const abs = resolveAlias(spec);
      if (!abs) { missing.push(`${spec} (unrecognised alias)`); continue; }
      const found = readModuleFile(abs);
      if (!found) missing.push(spec);
    }
    expect(missing, `lazy() imports without a resolvable module:\n  ${missing.join('\n  ')}`).toEqual([]);
  });

  it('EVERY resolved module carries an `export default` marker', () => {
    const noDefault: string[] = [];
    for (const spec of LAZY_SPECS) {
      const abs = resolveAlias(spec);
      if (!abs) continue;
      const found = readModuleFile(abs);
      if (!found) continue;
      // Accept: `export default …`, `export default function …`,
      // `export default class …`, `export { X as default }`,
      // `export default connect(…)`.
      const hasDefault =
        /export\s+default\s+/m.test(found.content)
        || /export\s*\{\s*[A-Za-z0-9_]+\s+as\s+default\s*\}/m.test(found.content);
      if (!hasDefault) noDefault.push(spec);
    }
    expect(noDefault, `lazy() targets missing an "export default":\n  ${noDefault.join('\n  ')}`).toEqual([]);
  });

  it('NO lazy import wraps its dynamic import in `.catch(() => undefined)` — CEO §23 danger pattern', () => {
    // A `.catch(() => undefined)` around import() feeds React.lazy a
    // resolved value of `undefined`, which reads `.default` on
    // undefined at render time — exactly the production crash the
    // incident is about.
    const banned = /lazy\(\(\)\s*=>\s*import\([^)]+\)\.catch\([^)]*=>\s*(?:undefined|null|\{\s*\})\s*\)\s*\)/;
    expect(APP.match(banned)).toBeNull();
  });

  it('SignUpLuxury is EAGER on the auth path (P0 CEO §12)', () => {
    // The canonical authentication entry route MUST NOT rely on a
    // lazy chunk. A refactor that moved SignUpLuxury back behind
    // React.lazy re-introduces the P0 failure mode.
    expect(APP).toMatch(/import\s+SignUpLuxuryEager\s+from\s+["']@\/pages\/SignUpLuxury["'];?/);
    expect(APP).not.toMatch(/const\s+SignUpLuxury\s*=\s*lazy\(\(\)\s*=>\s*import\(\s*["']@\/pages\/SignUpLuxury["']\s*\)\s*\)/);
  });

  it('EVERY auth route is wrapped in AuthRouteErrorBoundary (CEO §16)', () => {
    // /signin, /sign-in, /login, /signup, /signin-advanced — a
    // rare module error still renders the branded safe screen
    // instead of a blank page.
    for (const p of ['/signin', '/sign-in', '/login', '/signup', '/signin-advanced']) {
      expect(APP, `route ${p} missing AuthRouteErrorBoundary`).toMatch(new RegExp(`Route path="${p}"[\\s\\S]{0,400}<AuthRouteErrorBoundary`));
    }
  });
});
