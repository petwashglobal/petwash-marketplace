/**
 * CEO §21/§22/§23 (2026-08-28) — provider readiness helper contract.
 *
 * Source-pin regression on providerReadiness.ts + provider-availability.ts.
 * The actual DB-level behavior lives in Postgres (the SQL is validated
 * against jsonb shape); this test pins the CONTRACT and the reader-gate
 * wiring so a refactor cannot silently strip the confirmation
 * requirement.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const READINESS = fs.readFileSync(
  path.resolve(__dirname, '..', 'lib', 'providerReadiness.ts'),
  'utf8',
);
const AVAIL_ROUTE = fs.readFileSync(
  path.resolve(__dirname, '..', 'routes', 'provider-availability.ts'),
  'utf8',
);

describe('providerReadiness helper — contract (CEO §21/§22/§23)', () => {
  it('exposes the four core helpers', () => {
    expect(READINESS).toMatch(/export async function isProviderAvailabilityConfirmed/);
    expect(READINESS).toMatch(/export async function isProviderPricingConfirmed/);
    expect(READINESS).toMatch(/export async function getProviderReadiness/);
    expect(READINESS).toMatch(/export async function confirmProviderPricing/);
    expect(READINESS).toMatch(/export async function confirmProviderAvailability/);
  });

  it('bookingEligible is TRUE only when both pricing AND availability are confirmed', () => {
    // No `||` combinator — bookingEligible must be a strict AND.
    expect(READINESS).toMatch(/bookingEligible:\s*pricingConfirmed && availabilityConfirmed/);
  });

  it('fail-safe: any read failure returns false (never true on error)', () => {
    // Both isProvider*Confirmed functions must wrap their DB read
    // in try/catch and return false on error. Otherwise a Postgres
    // hiccup could downgrade a "not confirmed" to "confirmed=true".
    for (const fn of ['isProviderAvailabilityConfirmed', 'isProviderPricingConfirmed']) {
      const start = READINESS.indexOf(`export async function ${fn}`);
      const end   = READINESS.indexOf('\n}\n', start);
      const block = READINESS.slice(start, end);
      expect(block).toMatch(/try \{/);
      expect(block).toMatch(/} catch \{[\s\S]*return false;[\s\S]*\}/);
    }
  });

  it('reads the confirmation flag from the jsonb sub-object (weeklyAvailability.confirmed / pricing_rules.confirmed)', () => {
    // Not a top-level column — the audit fix (7f9ecb5c6) put the flag
    // inside the jsonb blob so callers gate on the sub-object.
    expect(READINESS).toMatch(/wa\.confirmed === true/);
    // pricing_rules.confirmed
    expect(READINESS).toMatch(/\.confirmed === true/);
  });

  it('confirm helpers preserve existing pricing_rules / platform_data keys — no jsonb replace', () => {
    // A jsonb `SET pricing_rules = jsonb_build_object(...)` would WIPE
    // the seeded rate values. Must use `||` merge to preserve.
    expect(READINESS).toMatch(/COALESCE\(pricing_rules, '\{\}'::jsonb\)\s*\n\s*\|\|\s*jsonb_build_object/);
    expect(READINESS).toMatch(/COALESCE\(platform_data, '\{\}'::jsonb\)\s*\n\s*\|\|\s*jsonb_build_object/);
  });

  it('confirm records the source flag transitioning to provider_confirmed', () => {
    // So a later audit can distinguish seeded (`admin_default_...`)
    // from provider-confirmed values.
    expect(READINESS).toMatch(/'provider_confirmed'/);
  });
});

describe('/api/provider/availability confirmation endpoints (CEO §21/§22)', () => {
  it('exposes the three confirmation-flow routes', () => {
    expect(AVAIL_ROUTE).toMatch(/router\.get\('\/readiness\/:platform', requireAuth/);
    expect(AVAIL_ROUTE).toMatch(/router\.post\('\/pricing\/:platform\/confirm', requireAuth/);
    expect(AVAIL_ROUTE).toMatch(/router\.post\('\/schedule\/:platform\/confirm', requireAuth/);
  });

  it('validates platform against an allowlist — no arbitrary string reaches Postgres', () => {
    expect(AVAIL_ROUTE).toMatch(/const PLATFORM_ALLOWLIST = new Set\(\[/);
    for (const p of ['walk_my_pet', 'sitter_suite', 'pet_trek', 'academy', 'k9000']) {
      expect(AVAIL_ROUTE).toContain(`'${p}'`);
    }
    expect(AVAIL_ROUTE).toMatch(/errorCode:\s*'INVALID_PLATFORM'/);
  });

  it('never fabricates a rate card on the provider\'s behalf when one is missing', () => {
    // A row not found on pricing confirm returns 404 NO_RATE_CARD, NOT
    // a silent INSERT. Provider must set rates via the dashboard —
    // this endpoint only flips `confirmed`.
    expect(AVAIL_ROUTE).toMatch(/errorCode:\s*'NO_RATE_CARD'/);
    // Same for the provider row on schedule confirm.
    expect(AVAIL_ROUTE).toMatch(/errorCode:\s*'NO_PROVIDER_ROW'/);
  });

  it('response includes the freshly-computed readiness so clients can render the "you can be booked" state without a second call', () => {
    expect(AVAIL_ROUTE).toMatch(/const readiness = await getProviderReadiness\(userId, platform\)/);
    expect(AVAIL_ROUTE).toMatch(/res\.json\(\{\s*ok:\s*true,\s*platform,\s*\.\.\.readiness\s*\}\)/);
  });
});
