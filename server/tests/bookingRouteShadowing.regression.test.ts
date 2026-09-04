/**
 * REGRESSION PIN — no booking-journey route may be shadowed by an earlier
 * `:param` route on the same router.
 *
 * Express matches in registration order, so a static path registered AFTER a
 * same-shape `:param` path is UNREACHABLE — the param handler swallows it and
 * treats the literal segment as an id.
 *
 * Four live traps were found and fixed:
 *   walk-my-pet.ts          GET   /walks/mine        <- GET   /walks/:bookingId
 *   walk-my-pet.ts          GET   /walkers/search    <- GET   /walkers/:walkerId
 *   sitter-suite.ts         PATCH /sitters/location  <- PATCH /sitters/:id
 *   provider-availability.ts GET  /slots             <- GET   /:providerId
 *
 * `/walks/mine` was the worst: CustomerBookings.tsx and
 * walk-my-pet/OwnerDashboard.tsx both GET it for the customer's walk list, and
 * BookingConfirmation.tsx invalidates it in three places. Every one of those
 * calls hit `/walks/:bookingId` with bookingId="mine" and got
 * 404 "Booking not found" — the customer's walk bookings never listed.
 * (There was even a comment calling it the "canonical safe alias"; the alias
 * was registered 700 lines too late to ever run.)
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

const FILES = [
  'server/routes/walk-my-pet.ts',
  'server/routes/sitter-suite.ts',
  'server/routes/provider-availability.ts',
  'server/routes/bookings.ts',
];

type Route = { line: number; method: string; path: string };

function routesOf(rel: string): Route[] {
  const src = readFileSync(join(__dirname, '..', '..', rel), 'utf8');
  const out: Route[] = [];
  let inBlockComment = false;
  src.split('\n').forEach((raw, i) => {
    const s = raw.trim();
    if (inBlockComment) { if (s.includes('*/')) inBlockComment = false; return; }
    if (s.startsWith('/*')) { if (!s.includes('*/')) inBlockComment = true; return; }
    if (s.startsWith('//') || s.startsWith('*')) return;
    const m = /^router\.(get|post|patch|put|delete)\(\s*['"]([^'"]+)['"]/.exec(s);
    if (m) out.push({ line: i + 1, method: m[1].toUpperCase(), path: m[2] });
  });
  return out;
}

/** Would `earlier` swallow a request for `later`? */
function shadows(earlier: Route, later: Route): boolean {
  if (earlier.method !== later.method) return false;
  const a = earlier.path.replace(/^\//, '').split('/');
  const b = later.path.replace(/^\//, '').split('/');
  if (a.length !== b.length) return false;
  let usesParam = false;
  for (let i = 0; i < a.length; i++) {
    if (a[i].startsWith(':')) {
      if (b[i].startsWith(':')) return false; // param vs param — not a trap
      usesParam = true;
    } else if (a[i] !== b[i]) return false;
  }
  return usesParam;
}

describe('booking routers — static routes are registered before :param routes', () => {
  for (const file of FILES) {
    it(`${file} has no shadowed route`, () => {
      const routes = routesOf(file);
      expect(routes.length).toBeGreaterThan(0);
      const bad: string[] = [];
      routes.forEach((later, idx) => {
        for (const earlier of routes.slice(0, idx)) {
          if (shadows(earlier, later)) {
            bad.push(
              `${later.method} ${later.path} (line ${later.line}) is UNREACHABLE — ` +
              `shadowed by ${earlier.method} ${earlier.path} (line ${earlier.line}). ` +
              `Register the static path ABOVE the :param path.`,
            );
            break;
          }
        }
      });
      expect(bad).toEqual([]);
    });
  }

  it('the /walks/mine alias really is registered before /walks/:bookingId', () => {
    const r = routesOf('server/routes/walk-my-pet.ts');
    const mine = r.find((x) => x.method === 'GET' && x.path === '/walks/mine');
    const byId = r.find((x) => x.method === 'GET' && x.path === '/walks/:bookingId');
    expect(mine, '/walks/mine must exist — CustomerBookings.tsx depends on it').toBeDefined();
    expect(byId).toBeDefined();
    expect(mine!.line).toBeLessThan(byId!.line);
  });
});
