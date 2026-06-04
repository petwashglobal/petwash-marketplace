/**
 * PR-NAV-ROUTES-A navigation guards.
 *
 * Pins two production safety rules:
 * - provider detail message CTAs must not navigate to the dead /messages route
 * - PetTrek/pet_taxi deep links must be legally frozen before the generic booking wizard
 */

import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (relativePath: string) =>
  fs.readFileSync(path.resolve(__dirname, relativePath), 'utf8');

describe('platform provider detail navigation', () => {
  it('uses the registered personal inbox route for provider message CTAs', () => {
    const sources = [
      read('groomers/GroomerDetail.tsx'),
      read('walk-my-pet/WalkerDetail.tsx'),
      read('pettrek/DriverDetail.tsx'),
    ];

    for (const source of sources) {
      expect(source).not.toMatch(/\/messages\?to=/);
      expect(source).toMatch(/\/personal-inbox\?to=/);
    }
  });
});

describe('PetTrek legal booking guard', () => {
  it('does not present PetTrek as an active marketplace search tab', () => {
    const marketplaceSource = read('Marketplace.tsx');
    const petTrekConfigIndex = marketplaceSource.indexOf("id: 'pet_trek'");
    const disabledIndex = marketplaceSource.indexOf('disabled: true', petTrekConfigIndex);
    const badgeIndex = marketplaceSource.indexOf("badge: 'Coming Soon'", petTrekConfigIndex);

    expect(petTrekConfigIndex).toBeGreaterThan(-1);
    expect(disabledIndex).toBeGreaterThan(petTrekConfigIndex);
    expect(badgeIndex).toBeGreaterThan(petTrekConfigIndex);
  });

  it('routes pet_taxi deep links to coming soon before the generic booking route', () => {
    const appSource = read('../App.tsx');
    const petTaxiGuardIndex = appSource.indexOf('path="/booking/new/pet_taxi/:providerId"');
    const genericBookingIndex = appSource.indexOf('path="/booking/new/:serviceType/:providerId"');

    expect(petTaxiGuardIndex).toBeGreaterThan(-1);
    expect(genericBookingIndex).toBeGreaterThan(-1);
    expect(petTaxiGuardIndex).toBeLessThan(genericBookingIndex);
  });

  it('routes PetTrek marketplace booking deep links to coming soon before marketplace booking flow', () => {
    const appSource = read('../App.tsx');
    const petTrekMarketGuardIndex = appSource.indexOf('path="/marketplace/book/pet_trek/:id"');
    const genericMarketplaceBookingIndex = appSource.indexOf('path="/marketplace/book/:platform/:id"');

    expect(petTrekMarketGuardIndex).toBeGreaterThan(-1);
    expect(genericMarketplaceBookingIndex).toBeGreaterThan(-1);
    expect(petTrekMarketGuardIndex).toBeLessThan(genericMarketplaceBookingIndex);
  });
});
