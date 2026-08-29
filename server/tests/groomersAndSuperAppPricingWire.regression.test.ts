/**
 * groomers.ts + super-app-bookings.ts — pricing wire regression pins.
 *
 * Second wave of the ProviderServiceOffer adapter wire (business doctrine
 * §6 + §18.2). Each file gets the canonical `pricing:` field alongside
 * its legacy rate representation.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const GROOMERS = fs.readFileSync(
  path.resolve(__dirname, '..', 'routes', 'groomers.ts'),
  'utf8',
);
const SUPER = fs.readFileSync(
  path.resolve(__dirname, '..', 'routes', 'super-app-bookings.ts'),
  'utf8',
);

describe('groomers.ts — pricing wire', () => {
  it('imports projectPricing from the marketplace adapter', () => {
    expect(GROOMERS).toMatch(
      /projectPricing[\s\S]{0,200}from '\.\.\/services\/marketplace\/ProviderServiceOfferService'/,
    );
  });

  it('emits canonical `pricing:` via TRAINING projection alongside legacy priceRangeMin/Max', () => {
    expect(GROOMERS).toMatch(
      /pricing: projectPricing\(\{[\s\S]{0,200}service: 'TRAINING'[\s\S]{0,200}trainer:[\s\S]{0,100}hourlyRate/,
    );
    expect(GROOMERS).toMatch(/priceRangeMin: hourly/);
    expect(GROOMERS).toMatch(/priceRangeMax: hourly/);
  });
});

describe('super-app-bookings.ts — pricing wire', () => {
  it('imports projectPricing from the marketplace adapter', () => {
    expect(SUPER).toMatch(
      /projectPricing[\s\S]{0,200}from '\.\.\/services\/marketplace\/ProviderServiceOfferService'/,
    );
  });

  it('walker mapper carries canonical `pricing:` alongside the legacy hourlyRate fallback', () => {
    expect(SUPER).toMatch(
      /hourlyRate: w\.baseHourlyRate \? parseFloat\(w\.baseHourlyRate\) : 60,[\s\S]{0,400}pricing: projectPricing\(\{[\s\S]{0,200}service: 'DOG_WALKING'/,
    );
  });
});
