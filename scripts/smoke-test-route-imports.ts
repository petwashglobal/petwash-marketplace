/**
 * smoke-test-route-imports.ts — boot-landmine sweep.
 *
 * WHY THIS EXISTS (deploys #669/#670, 2026-06-10/11): server/routes.ts loads
 * many routers via `await import(...)` at registration time. Those modules are
 * NOT exercised by smoke-test-routes-load.ts (which only imports routes.ts
 * itself), are partially OUTSIDE tsc coverage, and resolve under tsx's strict
 * ESM resolver in production. A broken import inside any of them (directory
 * import with no index, missing named export, …) boots-loops the container —
 * found one bug per 25-minute deploy cycle until this sweep existed.
 *
 * This script extracts every dynamic-import specifier from server/routes.ts
 * and imports each module under the SAME resolver production uses, reporting
 * ALL failures at once (not just the first).
 *
 * Run locally before push:  npx tsx scripts/smoke-test-route-imports.ts
 * CI: part of gate-smoke-test-startup (petwash-ci.yml).
 */
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const ROUTES_FILE = resolve(process.cwd(), 'server/routes.ts');

const src = readFileSync(ROUTES_FILE, 'utf8');
// Match: await import('./routes/x') | await import("./services/y") — any relative specifier.
const specs = Array.from(src.matchAll(/await\s+import\(\s*['"](\.[^'"]+)['"]\s*\)/g), m => m[1]);
const unique = Array.from(new Set(specs)).sort();

if (unique.length === 0) {
  console.error('❌ No dynamic imports found in server/routes.ts — pattern drift? Update this script.');
  process.exit(1);
}

// ── STATIC-import landmine check (added 2026-06-14) ──────────────────────────
// A deleted `./routes/spotify` left a STATIC `import x from "./routes/spotify"`
// in routes.ts → the server could not boot → a prod deploy froze. The dynamic
// sweep below never caught it (static imports aren't `await import(...)`). This
// verifies every relative STATIC import in routes.ts resolves to a real file.
function staticImportResolves(absNoExt: string): boolean {
  return ['.ts', '.tsx', '.js', '.mjs', '.json'].some(ext => existsSync(absNoExt + ext))
    || existsSync(resolve(absNoExt, 'index.ts'))
    || existsSync(resolve(absNoExt, 'index.tsx'));
}
const staticMissing: string[] = [];
for (const line of src.split('\n')) {
  const t = line.trim();
  if (t.startsWith('//') || t.startsWith('*') || t.startsWith('/*')) continue; // skip comments
  const m = t.match(/^import\s+[^'"]*\s+from\s+['"](\.[^'"]+)['"]/);
  if (!m) continue;
  const abs = resolve(process.cwd(), 'server', m[1]);
  if (!staticImportResolves(abs)) staticMissing.push(m[1]);
}
if (staticMissing.length) {
  console.error(`\n❌ ${staticMissing.length} BROKEN STATIC IMPORT(S) in server/routes.ts — the server CANNOT boot:\n`);
  for (const s of staticMissing) console.error(`   import … from "${s}"  → no file resolves`);
  process.exit(1);
}
console.log(`✅ static imports in routes.ts all resolve`);

console.log(`🧨 Boot-landmine sweep: importing ${unique.length} dynamically-loaded modules under the production resolver…\n`);

const failures: { spec: string; error: string }[] = [];
let ok = 0;

for (const spec of unique) {
  const abs = resolve(process.cwd(), 'server', spec);
  try {
    await import(pathToFileURL(abs).href);
    ok++;
  } catch (e: any) {
    failures.push({ spec, error: String(e?.message || e).split('\n')[0] });
  }
}

console.log(`\n✅ ${ok}/${unique.length} modules import cleanly`);
if (failures.length) {
  console.error(`\n❌ ${failures.length} BOOT LANDMINE(S) — these crash the container at route registration:\n`);
  for (const f of failures) console.error(`   ${f.spec}\n      ↳ ${f.error}\n`);
  process.exit(1);
}
console.log('🟢 Route-import sweep PASSED');
// Imported modules start intervals/cron timers as side effects — without an
// explicit exit the process lives forever and the CI step hangs on SUCCESS.
process.exit(0);
