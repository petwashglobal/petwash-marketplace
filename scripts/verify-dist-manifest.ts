#!/usr/bin/env node
/**
 * verify-dist-manifest — CEO MASTER 2026-08-28 P0 runbook §10 §20.
 *
 * Post-build integrity gate. Parses the built dist/public/index.html
 * and confirms every JS / CSS / preload asset it references EXISTS on
 * disk before the deployer publishes anything. A missing hashed asset
 * is the exact condition that produced the /signin lazy-module crash:
 *
 *   index.html points at   /assets/vendor-react-CkymgGNU.js
 *   the CDN answered       404 (or worse: an HTML SPA rewrite)
 *   React.lazy received    { default: undefined }  → crash.
 *
 * Run this at the END of every build. If it fails, DO NOT DEPLOY.
 *
 *   Usage:
 *     npx tsx scripts/verify-dist-manifest.ts
 *     # or
 *     node --loader tsx scripts/verify-dist-manifest.ts
 *
 * Exits 0 on success (with a summary), 1 on any missing asset.
 */
import fs from 'node:fs';
import path from 'node:path';

const REPO_ROOT = path.resolve(__dirname, '..');
const DIST_DIR = path.join(REPO_ROOT, 'dist', 'public');
const INDEX_HTML = path.join(DIST_DIR, 'index.html');

interface Ref {
  role: 'script' | 'stylesheet' | 'modulepreload' | 'preload' | 'other';
  url: string;
  raw: string;
}

/** Rough HTML parser — good enough for a Vite index.html. Never runs
 *  on user-generated HTML, so a full parser is overkill. */
function extractAssetRefs(html: string): Ref[] {
  const refs: Ref[] = [];
  const scriptRe = /<script[^>]*\bsrc="([^"]+)"[^>]*>/gi;
  const linkRe = /<link[^>]*\brel="([^"]+)"[^>]*\bhref="([^"]+)"[^>]*>/gi;
  const linkRe2 = /<link[^>]*\bhref="([^"]+)"[^>]*\brel="([^"]+)"[^>]*>/gi;
  let m: RegExpExecArray | null;
  while ((m = scriptRe.exec(html)) !== null) {
    refs.push({ role: 'script', url: m[1], raw: m[0] });
  }
  const pushLink = (rel: string, url: string, raw: string) => {
    const role: Ref['role'] =
      rel === 'stylesheet'    ? 'stylesheet' :
      rel === 'modulepreload' ? 'modulepreload' :
      rel === 'preload'       ? 'preload' : 'other';
    refs.push({ role, url, raw });
  };
  while ((m = linkRe.exec(html)) !== null) pushLink(m[1], m[2], m[0]);
  while ((m = linkRe2.exec(html)) !== null) pushLink(m[2], m[1], m[0]);
  return refs;
}

function isLocal(url: string): boolean {
  return url.startsWith('/') && !url.startsWith('//');
}

function resolveOnDisk(url: string): string {
  // Strip leading slash + any query string / fragment.
  const clean = url.replace(/^\/+/, '').split(/[?#]/)[0];
  return path.join(DIST_DIR, clean);
}

interface Result {
  ref: Ref;
  ok: boolean;
  onDisk: string;
  sizeBytes?: number;
}

function verify(): Result[] {
  if (!fs.existsSync(INDEX_HTML)) {
    console.error(`[verify-dist-manifest] MISSING dist/public/index.html — did the build finish?`);
    process.exit(1);
  }
  const html = fs.readFileSync(INDEX_HTML, 'utf8');
  const refs = extractAssetRefs(html);
  const results: Result[] = [];
  for (const ref of refs) {
    if (!isLocal(ref.url)) {
      // External CDN reference (fonts.googleapis, apis.google, etc.)
      // — not our problem, mark ok and continue.
      results.push({ ref, ok: true, onDisk: '(external)' });
      continue;
    }
    const onDisk = resolveOnDisk(ref.url);
    const exists = fs.existsSync(onDisk);
    let size: number | undefined;
    if (exists) {
      try { size = fs.statSync(onDisk).size; } catch { /* ignore */ }
    }
    results.push({ ref, ok: exists, onDisk, sizeBytes: size });
  }
  return results;
}

function main(): void {
  const results = verify();
  const missing = results.filter(r => !r.ok);
  const external = results.filter(r => r.onDisk === '(external)').length;
  const local = results.length - external;

  console.log(`[verify-dist-manifest] index.html → ${results.length} refs (${local} local, ${external} external)`);
  for (const r of results) {
    if (r.onDisk === '(external)') continue;
    const status = r.ok ? '✓' : '✗ MISSING';
    const size = r.sizeBytes != null ? `${(r.sizeBytes / 1024).toFixed(1)}kB` : '—';
    console.log(`  ${status}  ${r.ref.role.padEnd(14)}  ${r.ref.url}  (${size})`);
  }
  if (missing.length > 0) {
    console.error(`\n[verify-dist-manifest] FAIL — ${missing.length} asset(s) referenced by index.html do NOT exist on disk:`);
    for (const r of missing) {
      console.error(`  ${r.ref.url}  →  expected at ${r.onDisk}`);
    }
    console.error('\nDO NOT DEPLOY. Investigate the build (Vite chunk manifest, custom manualChunks, missing plugin).');
    process.exit(1);
  }
  console.log(`\n[verify-dist-manifest] PASS — every asset referenced by index.html exists on disk.`);
}

main();
