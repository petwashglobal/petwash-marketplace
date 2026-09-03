/**
 * Post-release 2026-09-03 (backlog P1): dist-manifest verifier.
 *
 * Reclaimed from closed PR #2169 (deploy-hardening lane). Ran as
 * part of the pre-deploy gate to catch the specific class of failure
 * that killed /signin on 2026-08-29:
 *
 *   • index.html references /assets/App-<hash>.js
 *   • App-<hash>.js references a lazy chunk /assets/SignUpLuxury-<hash>.js
 *   • the chunk was pruned by a previous deploy's cleanup step
 *   • the browser fetches App, resolves the import, gets 404, and the
 *     tree crashes on `Cannot read properties of undefined (reading
 *     'default')`
 *
 * The verifier reads every <script src> / <link href> in every HTML
 * file under `dist/public`, plus every static asset referenced by any
 * JS chunk via `/assets/…-.js"` string literals, and asserts that
 * every one of them exists on disk.
 *
 * Zero external deps. Exit code 1 on any missing file. Safe to run
 * against any build output; not tied to a specific bundler.
 *
 * Usage:
 *   npx tsx scripts/verify-dist-manifest.ts             # defaults: dist/public
 *   npx tsx scripts/verify-dist-manifest.ts dist/public
 */

import { existsSync, readFileSync, statSync, readdirSync } from 'fs';
import { extname, join, resolve } from 'path';

const DIST = resolve(process.cwd(), process.argv[2] || 'dist/public');

function* walk(dir: string): Generator<string> {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    let s;
    try {
      s = statSync(p);
    } catch {
      continue;
    }
    if (s.isDirectory()) {
      yield* walk(p);
    } else {
      yield p;
    }
  }
}

const HTML_REFS = /<(?:script|link|img)[^>]+(?:src|href)=["']([^"']+\.(?:js|css|mjs|png|jpg|svg|webp|ico|json))["']/gi;
const JS_ASSET_REFS = /["'](\/assets\/[A-Za-z0-9_.\-]+\.(?:js|css|mjs|png|jpg|svg|webp|ico|json))["']/g;

function collectReferences(files: string[]): Set<string> {
  const refs = new Set<string>();
  for (const f of files) {
    const ext = extname(f).toLowerCase();
    if (ext !== '.html' && ext !== '.js' && ext !== '.mjs') continue;
    const src = readFileSync(f, 'utf8');
    const rx = ext === '.html' ? HTML_REFS : JS_ASSET_REFS;
    for (const m of src.matchAll(rx)) {
      const ref = m[1];
      if (/^https?:/i.test(ref)) continue;
      refs.add(ref);
    }
  }
  return refs;
}

function resolveRef(ref: string): string {
  if (ref.startsWith('/')) return join(DIST, ref.slice(1));
  return join(DIST, 'assets', ref.replace(/^\.\.\//, ''));
}

function main(): void {
  if (!existsSync(DIST)) {
    console.error(`[verify-dist-manifest] dist dir not found: ${DIST}`);
    process.exit(2);
  }

  const start = Date.now();
  const files = Array.from(walk(DIST));
  const refs = collectReferences(files);

  let checked = 0;
  const missing: Array<{ ref: string; resolved: string }> = [];
  for (const ref of refs) {
    if (ref.startsWith('data:')) continue;
    const [pathPart] = ref.split(/[?#]/);
    if (!pathPart) continue;
    const resolved = resolveRef(pathPart);
    checked += 1;
    if (!existsSync(resolved)) {
      missing.push({ ref, resolved });
    }
  }

  const elapsedMs = Date.now() - start;
  console.log(
    `[verify-dist-manifest] scanned ${files.length} files, checked ${checked} refs (${elapsedMs}ms)`,
  );

  if (missing.length) {
    console.error(`[verify-dist-manifest] ❌ ${missing.length} missing asset(s):`);
    for (const m of missing) {
      console.error(`  - ${m.ref}  → ${m.resolved}`);
    }
    console.error(
      '[verify-dist-manifest] A pre-deploy prune or stale index.html is the usual cause. ' +
        'Rebuild + redeploy before promoting traffic.',
    );
    process.exit(1);
  }

  console.log('[verify-dist-manifest] ✅ every referenced asset exists on disk.');
}

main();
