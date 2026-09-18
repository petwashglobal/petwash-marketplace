/**
 * Two things a live customer hit on 2026-09-18 (anonymous iPhone walkthrough):
 *
 * 1. /marketplace/search — pressing Search POSTed /api/booking-search and got
 *    403 EBADCSRFTOKEN, because Firebase Hosting strips the pw.csrf cookie and
 *    a signed-out visitor carries no Bearer. The screen blamed the customer:
 *    "Search failed. Check your connection and try again." No result ever
 *    rendered. Same defect already fixed for /api/marketplace/search.
 * 2. /groomers — three of the six tiles (Favourites, Pricing & Add-ons, Help)
 *    pointed at routes that were never built, so the parametric /groomers/:id
 *    caught them and the customer landed on "מטפח לא נמצא" with a 404 behind.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(__dirname, '..', '..');
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8');

describe('a signed-out visitor can search', () => {
  const idx = read('server/index.ts');
  const exempt = idx.slice(idx.indexOf('const AUTH_CSRF_EXEMPT = new Set(['), idx.indexOf(']);', idx.indexOf('const AUTH_CSRF_EXEMPT = new Set([')));

  it('/api/booking-search is CSRF-exempt, like the marketplace search', () => {
    expect(exempt).toContain("'/api/booking-search'");
    expect(exempt).toContain("'/api/marketplace/search'");
  });

  it('and it is a read-only query — nothing is written', () => {
    const route = read('server/routes/booking-search.ts');
    const handler = route.slice(route.indexOf("router.post('/'"), route.indexOf("router.post('/'") + 4000);
    expect(handler).not.toMatch(/\.insert\(|\.update\(|\.delete\(|INSERT |UPDATE |DELETE /);
  });
});

describe('no grooming tile leads to "groomer not found"', () => {
  const overview = read('client/src/pages/groomers/Overview.tsx');

  it('the three unbuilt destinations are gone', () => {
    expect(overview).not.toContain('/groomers/favorites');
    expect(overview).not.toContain('/groomers/pricing');
    expect(overview).not.toContain('/groomers/help');
  });

  it('every remaining tile points at a route that exists', () => {
    const app = read('client/src/App.tsx');
    const links = Array.from(overview.matchAll(/link: "([^"]+)"/g)).map((m) => m[1]);
    expect(links.length).toBeGreaterThan(0);
    for (const link of links) {
      const exact = app.includes(`<Route path="${link}">`) || app.includes(`<Route path="${link}"`);
      expect(exact, `${link} has no route in App.tsx`).toBe(true);
    }
  });

  it('help goes to the real support page', () => {
    expect(overview).toContain('link: "/contact"');
  });
});
