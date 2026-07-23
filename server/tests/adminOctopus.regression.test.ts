/**
 * Octopus Control Panel (CEO 2026-07-23: one admin overview — sales stats,
 * live stations, shop, providers — real data, working edit/save).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const ROOT = resolve(__dirname, '..', '..');
const api = readFileSync(resolve(ROOT, 'server/routes/admin-octopus.ts'), 'utf8');
const routes = readFileSync(resolve(ROOT, 'server/routes.ts'), 'utf8');
const app = readFileSync(resolve(ROOT, 'client/src/App.tsx'), 'utf8');
const panel = readFileSync(resolve(ROOT, 'client/src/pages/AdminOctopus.tsx'), 'utf8');
const shopAdmin = readFileSync(resolve(ROOT, 'client/src/pages/AdminShopProducts.tsx'), 'utf8');

describe('octopus overview endpoint', () => {
  it('is super-admin gated and mounted', () => {
    expect(api).toMatch(/requireSuperAdmin/);
    expect(routes).toMatch(/app\.use\('\/api\/admin\/octopus', apiLimiter, adminOctopusRoutes\)/);
  });

  it('reads REAL tables per source — purchases, nayax events, shop orders, bookings, providers', () => {
    for (const t of ['FROM purchases', 'FROM nayax_transaction_events', 'FROM shop_orders', 'FROM bookings', 'FROM providers', 'FROM shop_products']) {
      expect(api).toContain(t);
    }
    // fail-soft: a broken block returns null, never a fake number
    expect(api).toMatch(/returning null/);
  });
});

describe('octopus panel + shop manager routed behind the admin guard', () => {
  it('routes exist', () => {
    expect(app).toMatch(/path="\/admin\/octopus"/);
    expect(app).toMatch(/path="\/admin\/shop-products"/);
    const oct = app.indexOf('path="/admin/octopus"');
    expect(app.slice(oct, oct + 200)).toMatch(/AdminRouteGuard/);
  });

  it('panel consumes the overview endpoint and renders no hardcoded money numbers', () => {
    expect(panel).toMatch(/\/api\/admin\/octopus\/overview/);
    expect(panel).not.toMatch(/₪\d{2,}/); // no literal shekel amounts baked in
  });

  it('shop manager wires the existing admin CRUD (create/patch/soft-delete)', () => {
    expect(shopAdmin).toMatch(/\/api\/shop\/admin\/products/);
    expect(shopAdmin).toMatch(/'PATCH', `\/api\/shop\/admin\/products\/\$\{id\}`/);
    expect(shopAdmin).toMatch(/'DELETE', `\/api\/shop\/admin\/products\/\$\{id\}`/);
    expect(shopAdmin).toMatch(/window\.confirm/); // destructive action confirmed
  });
});
