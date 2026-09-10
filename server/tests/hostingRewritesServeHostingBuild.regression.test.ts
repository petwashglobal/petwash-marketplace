/**
 * Firebase Hosting must never hand a public PAGE to Cloud Run.
 *
 * Live QA 2026-09-10: /stations and /pettrek rendered blank. firebase.json
 * rewrote them (and 7 others, from #1714) to the API service, which serves the
 * client index.html baked into ITS image — entry chunk index-CHZvwc87.js —
 * while Hosting's current build is index-C7t2WGiZ.js. /assets/** is Hosting's,
 * so the browser got the SPA fallback HTML for the chunk, a MIME error, and
 * no app. Four of the nine were already dead (prerendered dirs win over
 * rewrites); the other five were broken.
 *
 * Pins: (1) only API-shaped paths are rewritten to Cloud Run; (2) the SPA
 * fallback exists; (3) the pages that used to rely on the server for crawler
 * HTML are in the build-time prerender list; (4) trailingSlash is explicit so
 * sitemap (/academy), canonical (/academy) and served URL agree.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const cfg = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), 'firebase.json'), 'utf8'));
const hosts: any[] = Array.isArray(cfg.hosting) ? cfg.hosting : [cfg.hosting];
const prerender = fs.readFileSync(path.resolve(process.cwd(), 'scripts/prerender.mjs'), 'utf8');

const API_PREFIXES = ['/api/', '/auth/', '/uploads/', '/.well-known/'];
const API_EXACT = ['/apple-app-site-association', '/sitemap.xml', '/robots.txt'];

describe('Hosting rewrites serve the Hosting build', () => {
  it('rewrites only API-shaped sources to Cloud Run', () => {
    for (const h of hosts) {
      for (const r of h.rewrites ?? []) {
        if (!('run' in r)) continue;
        const ok = API_PREFIXES.some((p) => r.source.startsWith(p)) || API_EXACT.includes(r.source);
        expect(ok, `page path rewritten to Cloud Run: ${r.source}`).toBe(true);
      }
    }
  });

  it('keeps the SPA fallback', () => {
    for (const h of hosts) {
      expect((h.rewrites ?? []).some((r: any) => r.source === '**' && r.destination === '/index.html')).toBe(true);
    }
  });

  it('prerenders the pages that used to depend on the server for crawler HTML', () => {
    for (const route of ['/stations', '/pettrek', '/sitter-suite', '/walk-my-pet', '/academy', '/egift']) {
      expect(prerender, `${route} missing from prerender ROUTES`).toMatch(new RegExp(`^\\s*'${route}',`, 'm'));
    }
  });

  it('pins trailingSlash so sitemap, canonical and served URL agree', () => {
    for (const h of hosts) expect(h.trailingSlash).toBe(false);
  });
});
