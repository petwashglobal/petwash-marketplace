import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

/**
 * THE WASH-PACKAGES ADMIN SCREEN IS REACHABLE (2026-09-11)
 *
 * GET /api/packages returns only ACTIVE wash packages. In production it
 * returned `[]`, so the customer-facing /packages page had nothing to sell.
 *
 * The cause was not the query. AdminWashPackages.tsx exists and is ROUTED at
 * /admin/wash-packages, and its route comment says it was built so the CEO can
 * set real packages and prices "himself — no code deploy, no guessing". But
 * NOTHING linked to it: the HQ portal listed seven /admin/* destinations and
 * this was not one of them. The only way in was to type the URL.
 *
 * Same failure shape as the Pet Passport screen: built, routed, unreachable.
 * A route existing is not reachability.
 */
const portal = readFileSync(
  resolve(__dirname, '../../client/src/pages/HQManagementPortal.tsx'),
  'utf8',
);
const app = readFileSync(resolve(__dirname, '../../client/src/App.tsx'), 'utf8');

describe('an admin can find the wash packages screen', () => {
  it('the HQ portal links to /admin/wash-packages', () => {
    // Match a LINK shape, not the bare path — the bare string also appears in
    // the comment that explains this very fix, and comments do not route users.
    expect(portal).toMatch(/href:\s*["'`]\/admin\/wash-packages["'`]/);
  });

  it('the route still exists and renders AdminWashPackages', () => {
    expect(app).toMatch(/path="\/admin\/wash-packages"/);
    expect(app).toMatch(/AdminWashPackages/);
  });

  it('it sits in the stations module, next to Station Control', () => {
    // Wash packages are the K9000 wash product. Filing them anywhere else is
    // how a screen gets lost again.
    const stations = portal.match(/stations:\s*\[([\s\S]*?)\n\s*\],/);
    expect(stations).not.toBeNull();
    // Again: a LINK shape, not the bare path. The explanatory comment inside
    // this very block contains the path, and an earlier version of this test
    // passed on that comment after the link had been deleted.
    expect(stations![1]).toMatch(/href:\s*["'`]\/admin\/wash-packages["'`]/);
  });
});
