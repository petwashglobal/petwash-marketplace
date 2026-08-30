/**
 * Regression pin — /api/marketplace/journey/:kind/:id wiring.
 *
 * The dispatch endpoint's contract requires:
 *   • Firebase auth in front (via validateFirebaseToken).
 *   • Rate limit (via apiLimiter).
 *   • Mount under /api/marketplace so the client's existing base URL
 *     works.
 *
 * The router file itself is exercised by unit tests; this pin catches
 * an accidental unmount / permission drop.
 */
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const ROUTES = fs.readFileSync(path.join(__dirname, '../routes.ts'), 'utf8');
const ROUTER = fs.readFileSync(path.join(__dirname, '../routes/marketplace-journey.ts'), 'utf8');
const SERVICE = fs.readFileSync(path.join(__dirname, '../services/marketplace/JourneyStateService.ts'), 'utf8');

describe('MarketplaceJourney — mount + service contract', () => {
  it('imports marketplaceJourneyRoutes', () => {
    expect(ROUTES).toMatch(/import\s+marketplaceJourneyRoutes\s+from\s+["']\.\/routes\/marketplace-journey["']/);
  });

  it('mounts marketplaceJourneyRoutes under /api/marketplace with auth + rate limit', () => {
    expect(ROUTES).toMatch(/app\.use\(\s*['"]\/api\/marketplace['"]\s*,\s*validateFirebaseToken\s*,\s*apiLimiter\s*,\s*marketplaceJourneyRoutes\s*\)/);
  });

  it('router defines GET /journey/:kind/:id', () => {
    expect(ROUTER).toMatch(/router\.get\(\s*['"]\/journey\/:kind\/:id['"]/);
  });

  it('router returns 401 when the Firebase token is missing (defense in depth)', () => {
    expect(ROUTER).toMatch(/auth_required/);
    expect(ROUTER).toMatch(/status\(401\)/);
  });

  it('router maps every DispatchOutcome code', () => {
    for (const code of ['OK', 'INVALID_KIND', 'NOT_FOUND', 'NOT_A_PARTY', 'NOT_IMPLEMENTED']) {
      expect(ROUTER).toContain(`'${code}'`);
    }
  });

  it('service whitelist covers every declared JourneyKind', () => {
    for (const kind of [
      'booking', 'shop_order', 'gift', 'wallet_topup', 'refund',
      'support_case', 'provider_application', 'prestige_member',
      'k9000_session', 'pet', 'payout',
    ]) {
      expect(SERVICE).toContain(`'${kind}'`);
    }
  });

  it('service refuses INVALID_KIND before touching loader registry', () => {
    // The switch on kind happens BEFORE loader lookup — ensures a
    // bogus kind cannot exercise loader code paths at all.
    const invalidIdx = SERVICE.indexOf('INVALID_KIND');
    const loaderIdx = SERVICE.indexOf('this.loaders.get(');
    expect(invalidIdx).toBeGreaterThan(-1);
    expect(loaderIdx).toBeGreaterThan(-1);
    expect(invalidIdx).toBeLessThan(loaderIdx);
  });
});
