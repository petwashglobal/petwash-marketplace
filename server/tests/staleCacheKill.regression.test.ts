/**
 * "Old power" kill (CEO 2026-07-23): only 8 named routes had no-store — every
 * OTHER SPA deep link (checkout, locations, egift, legal, admin…) fell through
 * to CDN default caching and served the OLD site for up to an hour after each
 * deploy. Firebase matches headers by REQUEST path, not the rewritten file, so
 * the fix is a FIRST catch-all no-store rule, with real static assets
 * overriding later (last matching rule wins per header key).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const cfg = JSON.parse(readFileSync(resolve(__dirname, '..', '..', 'firebase.json'), 'utf8'));
const rules: Array<{ source: string; headers: Array<{ key: string; value: string }> }> = cfg.hosting[0].headers;

const cc = (r: any) => r.headers.find((h: any) => h.key === 'Cache-Control')?.value ?? null;

describe('stale-cache kill', () => {
  it('the FIRST rule is a catch-all no-store (every SPA route covered)', () => {
    expect(rules[0].source).toBe('**');
    expect(cc(rules[0])).toMatch(/no-store/);
  });

  it('hashed bundles override to immutable AFTER the generic js/css rule', () => {
    const js = rules.findIndex((r) => r.source.includes('js|css'));
    const assets = rules.findIndex((r) => r.source === '/assets/**');
    expect(js).toBeGreaterThan(0);
    expect(assets).toBeGreaterThan(js);
    expect(cc(rules[assets])).toMatch(/immutable/);
  });

  it('service-worker scripts stay no-store and come after the immutable rule', () => {
    const assets = rules.findIndex((r) => r.source === '/assets/**');
    const sw = rules.findIndex((r) => r.source === '/sw.js');
    expect(sw).toBeGreaterThan(assets);
    expect(cc(rules[sw])).toMatch(/no-store/);
  });

  it('the final security rule sets NO Cache-Control (must not override no-store)', () => {
    const last = rules[rules.length - 1];
    expect(last.source).toBe('**');
    expect(cc(last)).toBeNull();
  });
});
