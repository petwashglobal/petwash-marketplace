#!/usr/bin/env node
/**
 * CEO FLY MODE II §8 (2026-08-29) — production-build leak gate.
 *
 * Fails the build if the client bundle (dist/public/**\/*.{js,mjs,html})
 * contains ANY marker of the Firebase test adapter or its synthetic
 * ID token. The adapter is a dev-only surface (import.meta.env.DEV
 * plus a runtime shim); Vite MUST tree-shake every reference away in
 * a production build. This script is the last line of defense: if a
 * refactor accidentally makes the shim statically reachable from a
 * production entrypoint, this fails CI before deployment.
 *
 * The server bundle intentionally CONTAINS `SYNTHETIC_TEST_TOKEN_REFUSED`
 * (server/routes.ts refuses the marker token at /api/auth/session for
 * defense-in-depth). This scanner is scoped to the browser bundle only.
 *
 * Usage:
 *   node scripts/check-no-test-adapter-leak.mjs
 *
 * Exits 0 when clean, 1 when a marker is found (with a report of every
 * offending file + snippet).
 *
 * Wire this into the build pipeline AFTER `vite build` and BEFORE
 * `serve`/`deploy` — package.json:
 *   "build": "vite build && node scripts/check-no-test-adapter-leak.mjs"
 */
import { readdir, readFile, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const CLIENT_DIST = path.resolve(ROOT, 'dist', 'public');

/**
 * Markers that must NEVER appear in a production client bundle. Any
 * match is a leak of the E2E Firebase test adapter into the shipped
 * app.
 */
const FORBIDDEN_MARKERS = [
  '__FIREBASE_TEST_ADAPTER__',
  'synthetic-id-token::',
  'FirebaseTestAdapterShim',
  'getFirebaseTestAdapter',
  'isFirebaseTestAdapterActive',
  'installFirebaseTestAdapter',
];

/** File extensions to scan — the shipped client surfaces. */
const SCAN_EXTENSIONS = new Set(['.js', '.mjs', '.cjs', '.html', '.map']);

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const results = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...(await walk(full)));
    } else if (SCAN_EXTENSIONS.has(path.extname(entry.name))) {
      results.push(full);
    }
  }
  return results;
}

async function main() {
  if (!existsSync(CLIENT_DIST)) {
    console.error(
      `[leak-gate] dist/public not found at ${CLIENT_DIST}. ` +
        `Run \`vite build\` before this scanner.`,
    );
    process.exit(2);
  }

  const st = await stat(CLIENT_DIST);
  if (!st.isDirectory()) {
    console.error(`[leak-gate] ${CLIENT_DIST} is not a directory.`);
    process.exit(2);
  }

  const files = await walk(CLIENT_DIST);
  const offences = [];
  for (const file of files) {
    const contents = await readFile(file, 'utf8').catch(() => null);
    if (contents == null) continue;
    for (const marker of FORBIDDEN_MARKERS) {
      if (contents.includes(marker)) {
        const idx = contents.indexOf(marker);
        const snippet = contents.slice(Math.max(0, idx - 40), idx + marker.length + 40);
        offences.push({
          file: path.relative(ROOT, file),
          marker,
          snippet,
        });
      }
    }
  }

  if (offences.length > 0) {
    console.error(
      '\n============================================================\n' +
        '[leak-gate] E2E test-adapter markers leaked into the production\n' +
        '[leak-gate] client bundle. This is a SEV-1 build gate — every\n' +
        '[leak-gate] marker below must be tree-shaken out (DEV-only guard\n' +
        '[leak-gate] and dynamic-import discipline) before deployment.\n' +
        '============================================================\n',
    );
    for (const o of offences) {
      console.error(`  ✗ ${o.file}`);
      console.error(`      marker : ${o.marker}`);
      console.error(`      context: …${o.snippet.replace(/\s+/g, ' ')}…`);
    }
    console.error(
      `\n[leak-gate] ${offences.length} offence(s) across ${new Set(offences.map((o) => o.file)).size} file(s).\n`,
    );
    process.exit(1);
  }

  console.log(
    `[leak-gate] clean — scanned ${files.length} client bundle file(s), ` +
      `${FORBIDDEN_MARKERS.length} forbidden marker(s), 0 hits.`,
  );
}

main().catch((err) => {
  console.error('[leak-gate] scanner crashed:', err);
  process.exit(2);
});
