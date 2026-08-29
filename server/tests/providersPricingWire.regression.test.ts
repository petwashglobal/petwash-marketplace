/**
 * providers.ts (Firestore) — pricing wire regression pins.
 *
 * Third wave of the ProviderServiceOffer adapter wire. providers.ts is
 * Firestore-backed (walker_profiles / sitter_profiles), a different data
 * spine from the SQL walker_profiles/sitter_profiles routes. Both the
 * list + single-doc responses now carry `pricing:` alongside the
 * pickPublic() allowlisted legacy fields.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const SRC = fs.readFileSync(
  path.resolve(__dirname, '..', 'routes', 'providers.ts'),
  'utf8',
);

describe('providers.ts — pricing wire (business doctrine §6, §18.2)', () => {
  it('imports projectPricing from the marketplace adapter', () => {
    expect(SRC).toMatch(
      /projectPricing[\s\S]{0,200}from ["']\.\.\/services\/marketplace\/ProviderServiceOfferService["']/,
    );
  });

  it('exposes doc-shaped helpers so the Firestore projection stays isolated', () => {
    expect(SRC).toMatch(/function pricingForWalkerDoc/);
    expect(SRC).toMatch(/function pricingForSitterDoc/);
  });

  it('walker list AND single-doc responses carry `pricing:`', () => {
    const walkerHits = SRC.match(/pricing: pricingForWalkerDoc\(data\)/g) ?? [];
    expect(walkerHits.length).toBeGreaterThanOrEqual(2); // list + detail
  });

  it('sitter list AND single-doc responses carry `pricing:`', () => {
    const sitterHits = SRC.match(/pricing: pricingForSitterDoc\(data\)/g) ?? [];
    expect(sitterHits.length).toBeGreaterThanOrEqual(2);
  });

  it('legacy hourlyRate / nightlyRate / dailyRate stay in the pickPublic allowlists (no destructive rewire)', () => {
    // Doctrine §20 non-goals: no mass rewrite until Round 2 clears
    // client callers migrated to `pricing.*`.
    expect(SRC).toMatch(/WALKER_PUBLIC_FIELDS[\s\S]{0,300}'hourlyRate'/);
    expect(SRC).toMatch(/SITTER_PUBLIC_FIELDS[\s\S]{0,300}'dailyRate', 'nightlyRate'/);
  });

  it('sitter doc helper converts Firestore ILS decimals → cents before hitting the adapter (§6 unit discipline)', () => {
    expect(SRC).toMatch(/nightly \* 100/);
    expect(SRC).toMatch(/daily \* 100/);
  });
});
