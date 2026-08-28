/**
 * NEXTACTION cross-check validator (CEO 2026-08-26 §23).
 *
 * Every attention-feed destination MUST resolve to a client route
 * that is actually mounted in App.tsx. A dead-end tap is a
 * silent contract failure: the card promises an action, the tap
 * loads a 404. This validator reads both files and asserts every
 * destination pattern the composer emits corresponds to at least
 * one mounted route.
 *
 * The check is structural — it does not exercise wouter's matcher
 * for real, only that a route pattern with a compatible shape
 * exists in App.tsx. A tighter check (mount an app + navigate) is
 * a future integration test.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const COMPOSER = fs.readFileSync(
  path.resolve(__dirname, '..', 'services', 'attentionFeed.ts'),
  'utf8',
);
const APP = fs.readFileSync(
  path.resolve(__dirname, '..', '..', 'client', 'src', 'App.tsx'),
  'utf8',
);

/** Extract literal destination string patterns from the composer. */
function extractComposerDestinations(): string[] {
  const results = new Set<string>();
  // Match template literals like `/bookings/${...}` — take everything
  // up to the first `${` as the pattern (drop the interpolation).
  const templateRe = /destination:\s*`([^`$]+)/g;
  let m: RegExpExecArray | null;
  while ((m = templateRe.exec(COMPOSER)) !== null) {
    // Trim trailing / if we lost the interp.
    const raw = m[1].endsWith('/') ? m[1].slice(0, -1) : m[1];
    if (raw.startsWith('/')) results.add(raw);
  }
  // Also match plain string literals.
  const literalRe = /destination:\s*['"]([^'"]+)['"]/g;
  while ((m = literalRe.exec(COMPOSER)) !== null) {
    if (m[1].startsWith('/')) results.add(m[1]);
  }
  return [...results];
}

/** Extract every `<Route path="...">` prefix from App.tsx. */
function extractMountedRoutePrefixes(): string[] {
  const results = new Set<string>();
  const re = /<Route\s+path="([^"]+)"/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(APP)) !== null) {
    // Strip parameter suffixes like /:requestId so the pattern reads
    // as a prefix — matching is prefix-based on purpose (a mounted
    // /booking/confirmation/:requestId satisfies a /booking/confirmation
    // destination prefix).
    const stripped = m[1].replace(/\/:[a-zA-Z_][a-zA-Z0-9_]*/g, '');
    if (stripped.startsWith('/')) results.add(stripped);
  }
  return [...results];
}

const composerDestinations = extractComposerDestinations();
const mountedRoutes = extractMountedRoutePrefixes();

describe('attentionFeed destinations resolve to mounted routes (§23)', () => {
  it('composer emits at least one destination (guards against a silent regex miss)', () => {
    expect(composerDestinations.length).toBeGreaterThan(0);
  });

  it('every emitted destination is covered by a mounted route prefix', () => {
    // For each destination, either it exactly matches a mounted route
    // prefix OR it starts with one. `/bookings?requestId=…` is treated
    // as the `/bookings` prefix.
    const dead: string[] = [];
    for (const dest of composerDestinations) {
      const path = dest.split('?')[0].replace(/\/$/, '');
      const ok = mountedRoutes.some((r) => path === r || path.startsWith(r + '/') || path === r);
      if (!ok) dead.push(dest);
    }
    // Include the offending list in the error so a regression is
    // immediately actionable — the developer sees the exact bad URL.
    expect(dead, `Attention-feed destinations without a mounted client route: ${dead.join(', ')}`).toEqual([]);
  });

  it('no destination uses the historic `/bookings/:id` pattern (never mounted)', () => {
    // The old placeholder path was never wired. A PR that reintroduces
    // it should fail here rather than in prod support tickets.
    const badPattern = composerDestinations.filter((d) => /^\/bookings\/[A-Za-z0-9$_-]/.test(d));
    expect(badPattern, `Do not route the customer feed to /bookings/<id>; that route is not mounted. Use /booking/confirmation/<id>, /marketplace/review/<id>, or /bookings?requestId=<id>.`).toEqual([]);
  });
});
