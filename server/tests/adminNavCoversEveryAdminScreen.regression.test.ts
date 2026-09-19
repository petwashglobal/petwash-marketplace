import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

/**
 * A SCREEN NOBODY CAN FIND IS A SCREEN NOBODY USES.
 *
 * 2026-09-17, live: 103 routes under /admin existed in App.tsx; the back-office
 * menu (executive-nav.ts) listed 42. The other 61 — including the Adopt a Pet
 * and PawFinder review queues, membership cards, coupons, customers, treasury —
 * could only be reached by typing the URL. The CEO's words: "missing company
 * options".
 *
 * Rule: every /admin route is either in the menu, or listed in
 * client/src/components/dashboard/admin-routes-not-in-nav.txt with a reason.
 */
const ROOT = resolve(__dirname, '..', '..');
const R = (p: string) => readFileSync(resolve(ROOT, p), 'utf8');

const routes = Array.from(R('client/src/App.tsx').matchAll(/<Route path="(\/admin[a-z0-9/:-]*)"/g)).map((m) => m[1]);
const nav = Array.from(R('client/src/components/dashboard/executive-nav.ts').matchAll(/path: '([^']+)'/g)).map((m) => m[1]);
const allowed = R('client/src/components/dashboard/admin-routes-not-in-nav.txt')
  .split('\n').map((l) => l.replace(/#.*/, '').trim()).filter(Boolean);

describe('the back-office menu covers every admin screen', () => {
  it('the scan itself works', () => {
    expect(routes.length).toBeGreaterThan(80);
    expect(nav.length).toBeGreaterThan(50);
  });

  it('every /admin route is in the menu or explicitly excluded with a reason', () => {
    const missing = routes
      .filter((r) => !r.includes(':'))          // parameterised detail screens are opened from a list
      .filter((r) => !nav.includes(r) && !allowed.includes(r));
    expect(missing).toEqual([]);
  });

  it('the menu never points at a route that does not exist', () => {
    const dead = nav.filter((p) => p.startsWith('/admin') && !routes.includes(p));
    expect(dead).toEqual([]);
  });

  /**
   * 2026-09-19: the scan above only looked at routes whose path starts with
   * /admin. Ten admin-guarded screens live outside that prefix — /crm/leads
   * (where EVERY provider application from /apply and the Google Form lands),
   * /crm/communications, /team/inbox, /ops/today, /documents and the mobile
   * hubs. None of them were in the menu, and this guard could not see them.
   * An admin screen is defined by its guard, not by its URL prefix.
   */
  it('every admin-guarded screen outside /admin is in the menu or explicitly excluded', () => {
    const app = R('client/src/App.tsx');
    const guarded = Array.from(app.matchAll(/<Route path="([^"]+)">([\s\S]*?)<\/Route>/g))
      .filter(([, path, body]) => body.includes('AdminRouteGuard') && !path.startsWith('/admin') && !path.includes(':'))
      .map(([, path]) => path);

    expect(guarded.length).toBeGreaterThan(0); // the scan itself works

    const missing = guarded.filter((r) => !nav.includes(r) && !allowed.includes(r));
    expect(missing, `admin screens nobody can find: ${missing.join(', ')}`).toEqual([]);
  });

  it('the two free member services are reachable from the menu', () => {
    expect(nav).toContain('/admin/adoption');
    expect(nav).toContain('/admin/paw-finder');
  });
});
