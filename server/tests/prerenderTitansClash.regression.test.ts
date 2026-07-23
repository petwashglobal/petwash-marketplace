/**
 * "Clash of the titans, silent" (CEO 2026-07-23): the prerender serialized the
 * live DOM INCLUDING every runtime-injected <script> (GTM/analytics/pixels).
 * Visitors executed the baked copy AND the live app's fresh injection — every
 * tracker double-booted silently (the ×4 InteractionTracker inits, duplicate
 * /api/track POSTs). The snapshot may keep ONLY the static index.html script
 * set + id'd JSON-LD.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const src = readFileSync(resolve(__dirname, '..', '..', 'scripts/prerender.mjs'), 'utf8');

describe('prerender strips runtime-injected scripts', () => {
  it('builds the allowlist from the BUILT index.html', () => {
    expect(src).toMatch(/allowedScriptSrcs/);
    expect(src).toMatch(/allowedInlineHeads/);
    expect(src).toMatch(/readFile\(join\(DIST, 'index\.html'\)/);
  });

  it('removes every non-allowlisted script inside the page, keeping JSON-LD', () => {
    expect(src).toMatch(/removed runtime script/);
    expect(src).toMatch(/application\/ld\+json/);
    // the filter must run BEFORE serialization
    const filterAt = src.indexOf('removed runtime script');
    const serializeAt = src.indexOf("'<!DOCTYPE html>\\n' + document.documentElement.outerHTML");
    expect(filterAt).toBeGreaterThan(-1);
    expect(serializeAt).toBeGreaterThan(filterAt);
  });

  it('the allowlist is passed into evaluate (not referenced from node scope)', () => {
    expect(src).toMatch(/\}, \{ allowedScriptSrcs, allowedInlineHeads \}\);/);
  });
});
