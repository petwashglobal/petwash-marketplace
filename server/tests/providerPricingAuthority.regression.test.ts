/**
 * CEO FLY MODE II §33 (2026-08-29) — provider pricing authority pins.
 *
 * "Provider pricing authority" means: the number a customer commits
 * to is the PROVIDER's published rate, computed by the server, never
 * a client-body value. The booking-request writer already implements
 * this discipline (server/routes/booking-requests.ts). This suite
 * source-anchors the invariants so a refactor cannot silently trust
 * a client total.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const SRC = fs.readFileSync(
  path.resolve(__dirname, '..', 'routes', 'booking-requests.ts'),
  'utf8',
);

const WALK = fs.readFileSync(
  path.resolve(__dirname, '..', 'routes', 'walk-my-pet.ts'),
  'utf8',
);

describe('CEO FLY MODE II §33 — booking-request pricing authority', () => {
  it('ALWAYS recomputes the quote server-side via calculateQuote()', () => {
    // The client-supplied finalQuote MUST NOT be trusted verbatim.
    expect(SRC).toMatch(/const freshQuote = await calculateQuote\(\{/);
    expect(SRC).toMatch(/providerId: data\.providerId/);
    expect(SRC).toMatch(/serviceType: data\.serviceType/);
    // The comment locks the WHY.
    expect(SRC).toMatch(/ALWAYS recompute the quote server-side/);
  });

  it('refuses when server total diverges from client total by more than 1 agora', () => {
    // The 409 divergence check must fire when
    // |server - client| > 1 cent.
    expect(SRC).toMatch(
      /Math\.abs\(freshQuote\.totals\.totalCents - fq\.totals\.totalCents\) > 1/,
    );
    expect(SRC).toMatch(/QUOTE_PRICE_CHANGED/);
  });

  it('quote provider mismatch is refused with QUOTE_PROVIDER_MISMATCH', () => {
    expect(SRC).toMatch(/fq\.providerId !== data\.providerId/);
    expect(SRC).toMatch(/QUOTE_PROVIDER_MISMATCH/);
  });

  it('quote service-type mismatch is refused with QUOTE_SERVICE_MISMATCH', () => {
    expect(SRC).toMatch(/fq\.serviceType !== data\.serviceType/);
    expect(SRC).toMatch(/QUOTE_SERVICE_MISMATCH/);
  });

  it('persisted totalCents is the SERVER value, never the client value', () => {
    // The assignment `totalCents = freshQuote.totals.totalCents` MUST
    // be the source of truth. A regression that reads
    // fq.totals.totalCents into totalCents here defeats the point.
    expect(SRC).toMatch(/totalCents = freshQuote\.totals\.totalCents/);
    expect(SRC).not.toMatch(/totalCents = fq\.totals\.totalCents/);
  });

  it('legacy fallback reads the rate off provider PROFILE, not the request body', () => {
    // Rate hydrated from sitterProfiles / walkerProfiles / trainers
    // by providerId — the provider's own stored rate.
    expect(SRC).toMatch(/sitterProfiles\.userId, data\.providerId/);
    expect(SRC).toMatch(/walkerProfiles\.userId, data\.providerId/);
    expect(SRC).toMatch(/trainers\.userId, data\.providerId/);
    // NEVER read a body-supplied hourlyRate / dailyRate / pricePerDay.
    expect(SRC).not.toMatch(/req\.body\.hourlyRate/);
    expect(SRC).not.toMatch(/req\.body\.dailyRate/);
    expect(SRC).not.toMatch(/req\.body\.pricePerDay/);
    expect(SRC).not.toMatch(/data\.hourlyRate/);
    expect(SRC).not.toMatch(/data\.dailyRate/);
  });

  it('providerProfileId mismatch is refused with PROVIDER_PROFILE_MISMATCH', () => {
    // Old attack: caller sends a cheap sitter's providerProfileId with
    // an expensive sitter's providerId. The server refuses.
    expect(SRC).toMatch(/PROVIDER_PROFILE_MISMATCH/);
    const mismatches = SRC.match(/code: 'PROVIDER_PROFILE_MISMATCH'/g) || [];
    // Guard exists in ALL three provider-type arms (sitter/walker/trainer).
    expect(mismatches.length).toBeGreaterThanOrEqual(3);
  });

  it('when a provider has no published rate, the booking is REFUSED (never invented)', () => {
    // §17a: the price the customer commits to must be the provider's
    // real published rate — never a hardcoded fallback.
    expect(SRC).toMatch(/PROVIDER_RATE_MISSING/);
    expect(SRC).toMatch(/has not published a rate yet/);
  });

  it('serviceFeeCents = 15% of subtotal, computed server-side', () => {
    expect(SRC).toMatch(/const serviceFeePercent = 15;/);
    expect(SRC).toMatch(
      /serviceFeeCents = Math\.round\(subtotalCents \* serviceFeePercent \/ 100\)/,
    );
    expect(SRC).toMatch(/totalCents = subtotalCents \+ serviceFeeCents/);
  });
});

describe('CEO FLY MODE II §33 — walk-my-pet holds pricing FLOOR', () => {
  it('slot-hold rejects amounts below the canonical FLOOR', () => {
    // The FLOOR is server-side; the client cannot request an amount
    // below the minimum published for the walk duration.
    expect(WALK).toMatch(/WALK_BASE_FLOOR_CENTS/);
    expect(WALK).toMatch(/_amountCents < _floorCents/);
    expect(WALK).toMatch(/Amount is below the minimum price for this walk/);
  });

  it('the FLOOR table is the source of truth — client cannot override it', () => {
    // The FLOOR object must be a hard-coded per-duration map. A
    // refactor that reads FLOOR values from the request body would
    // let a client submit any minimum they liked.
    expect(WALK).toMatch(
      /WALK_BASE_FLOOR_CENTS:\s*Record<number, number>\s*=\s*\{[^}]*\};/,
    );
  });
});
