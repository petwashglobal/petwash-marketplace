/**
 * booking-search.ts — canonical `pricing` field wired.
 *
 * Locks that every provider mapper (walker × 2, sitter × 2, trainer × 2)
 * emits the canonical `pricing:` field alongside the legacy
 * `pricePerHour` / `pricePerNight`. Regression = a mapper reintroduces
 * the drift the doctrine audit found (§18.4 rate-unit shape).
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const SRC = fs.readFileSync(
  path.resolve(__dirname, '..', 'routes', 'booking-search.ts'),
  'utf8',
);

describe('booking-search.ts — pricing wire (business doctrine §6, §18.2)', () => {
  it('imports projectPricing from the marketplace adapter', () => {
    expect(SRC).toMatch(
      /projectPricing[\s\S]{0,200}from '\.\.\/services\/marketplace\/ProviderServiceOfferService'/,
    );
  });

  it('exposes per-provider-type helpers that keep the row-shape isolated', () => {
    expect(SRC).toMatch(/pricingForSitterRow/);
    expect(SRC).toMatch(/pricingForWalkerRow/);
    expect(SRC).toMatch(/pricingForTrainerRow/);
  });

  it('every walker mapper carries `pricing:` alongside `pricePerHour`', () => {
    const walkerMappers = SRC.match(/pricing: pricingForWalkerRow\(walker\)/g) ?? [];
    expect(walkerMappers.length).toBeGreaterThanOrEqual(2); // proximity + text
  });

  it('every sitter mapper carries `pricing:` alongside `pricePerNight`', () => {
    const sitterMappers = SRC.match(/pricing: pricingForSitterRow\(sitter\)/g) ?? [];
    expect(sitterMappers.length).toBeGreaterThanOrEqual(2);
  });

  it('every trainer mapper carries `pricing:` alongside `pricePerHour`', () => {
    const trainerMappers = SRC.match(/pricing: pricingForTrainerRow\(trainer\)/g) ?? [];
    expect(trainerMappers.length).toBeGreaterThanOrEqual(2);
  });

  it('legacy `pricePerHour` / `pricePerNight` fields still surface (no destructive rewire)', () => {
    // Doctrine §20 non-goals: no mass rewrite. The legacy fields stay
    // until Round 2 confirms every client-side caller migrated to
    // reading pricing.*.
    expect(SRC).toMatch(/pricePerHour: walker\.baseHourlyRate/);
    expect(SRC).toMatch(/pricePerNight: sitter\.pricePerDayCents/);
    expect(SRC).toMatch(/pricePerHour: trainer\.hourlyRate/);
  });
});
