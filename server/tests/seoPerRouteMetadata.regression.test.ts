/**
 * PR-SEO-PER-ROUTE-METADATA — fire-order items 23 + 24 + 25 + 26 + 27 + 28.
 *
 * The SPA catchall (server/index.ts) served the same homepage <title> /
 * meta description for /privacy, /terms, /walk-my-pet/explore.
 * Non-JS crawlers indexed the homepage wording on the wrong URL.
 * Stale "Premium Organic Pet Care" copy still lived in manifest.json.
 * The noscript block used mixed-case Support@PetWash.co.il — canonical
 * is lowercase support@petwash.co.il.
 *
 * Fix in one focused PR (shared infrastructure — the CEO explicitly
 * allowed this for items 23 + 24):
 *   server/index.ts    — ROUTE_META table + per-route replacement of
 *                        title / description / og:title / og:description /
 *                        og:url / canonical + root-div summary
 *   client/index.html  — noscript block: current brand, no stale
 *                        "Organic Pet Care", canonical lowercase support
 *                        email
 *   client/public/manifest.json — description now current brand
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const ROOT = resolve(__dirname, '..', '..');
const SERVER = 'server/index.ts';
const INDEX  = 'client/index.html';
const MANIFEST = 'client/public/manifest.json';

function read(rel: string): string { return readFileSync(resolve(ROOT, rel), 'utf8'); }

describe('PR-SEO-PER-ROUTE-METADATA', () => {
  const server = read(SERVER);
  const indexHtml = read(INDEX);
  const manifestRaw = read(MANIFEST);

  it('A1. server ROUTE_META table exists with /privacy, /terms, /walk-my-pet/explore', () => {
    expect(/const\s+ROUTE_META\s*:\s*Record<string,\s*RouteMeta>/.test(server)).toBe(true);
    expect(server.includes("'/privacy'")).toBe(true);
    expect(server.includes("'/terms'")).toBe(true);
    expect(server.includes("'/walk-my-pet/explore'")).toBe(true);
  });

  it('A2. server replaces title / description / og:title / og:description / og:url / canonical when routeMeta is set', () => {
    // Pin each replacement site so no future refactor can silently drop
    // one and leave (say) the wrong og:url on Twitter cards.
    expect(/replace\(\/<title>\[\\s\\S\]\*\?<\\\/title>\/i,/.test(server)).toBe(true);
    expect(/replace\(\/<meta name="description"[^)]+\/i,/.test(server)).toBe(true);
    expect(/replace\(\/<meta property="og:title"[^)]+\/i,/.test(server)).toBe(true);
    expect(/replace\(\/<meta property="og:description"[^)]+\/i,/.test(server)).toBe(true);
    expect(/replace\(\/<meta property="og:url"[^)]+\/i,/.test(server)).toBe(true);
    expect(/replace\(\/<link rel="canonical"[^)]+\/i,/.test(server)).toBe(true);
  });

  it('A3. server injects a summary <main> paragraph into #root for non-JS crawlers', () => {
    // React clobbers #root on hydrate, so this only shows to non-JS clients.
    // Pin that the replacement targets the empty root, includes an <h1>, and
    // pipes routeMeta.summary in.
    expect(server.includes('<div id="root"></div>')).toBe(true);
    expect(/<main[\s\S]*?><h1>\$\{esc\(routeMeta\.title\.split\(' \| '\)\[0\]\)\}<\/h1><p>\$\{esc\(routeMeta\.summary\)\}<\/p><\/main>/.test(server)).toBe(true);
  });

  it('A4. server escapes injected values (no HTML injection through routeMeta)', () => {
    // The esc helper protects against a future author sneaking a
    // caller-controlled value into ROUTE_META. Pin its presence.
    expect(/const\s+esc\s*=\s*\(s:\s*string\)\s*=>[\s\S]{0,200}replace\(\/</.test(server)).toBe(true);
  });

  it('B1. noscript brand is current (no "Premium Organic Pet Care" or "JavaScript Required" title)', () => {
    // The old title was "JavaScript Required" — misleads crawlers into
    // thinking that IS the page name. New title puts the brand first.
    const noscriptBlock = indexHtml.match(/<noscript>[\s\S]*?<\/noscript>/g)?.join('\n') || '';
    expect(noscriptBlock.includes('JavaScript Required |')).toBe(false);
    expect(noscriptBlock.includes('Premium Organic Pet Care')).toBe(false);
    expect(noscriptBlock.includes('PetWash™ — Premium self-service dog wash')).toBe(true);
  });

  it('B2. noscript support email is canonical lowercase support@petwash.co.il', () => {
    const noscriptBlock = indexHtml.match(/<noscript>[\s\S]*?<\/noscript>/g)?.join('\n') || '';
    expect(noscriptBlock.includes('Support@PetWash.co.il')).toBe(false);
    expect(noscriptBlock.includes('support@petwash.co.il')).toBe(true);
    // And it's a mailto link so crawlers can extract it cleanly.
    expect(noscriptBlock.includes('href="mailto:support@petwash.co.il"')).toBe(true);
  });

  it('C1. manifest.json description no longer says "Premium Organic Pet Care"', () => {
    expect(manifestRaw.includes('Premium Organic Pet Care')).toBe(false);
    const manifest = JSON.parse(manifestRaw);
    expect(typeof manifest.description).toBe('string');
    expect(manifest.description).toMatch(/self-service dog wash/i);
  });
});
