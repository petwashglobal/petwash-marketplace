/**
 * CEO §73 #13 + #14 (2026-08-28) — starter pricing + weekly availability at approval.
 *
 * Before this commit, admin approve inserted a `providers` row (making
 * the provider searchable) but the `provider_rate_cards` table stayed
 * EMPTY — customer search returned the provider with no pricing, the
 * quote engine had nothing to charge against, and providers had to
 * fill each rate by hand on their dashboard before their first booking
 * could quote.
 *
 * Also: the `providers.is_available = true` flag alone didn't tell
 * readers WHICH DAYS the provider works — every calendar surface fell
 * back to "always", and customers booked at 3am.
 *
 * Fix (both stashed inside the multi-service approval loop):
 *   • Insert a per-platform starter row into provider_rate_cards with
 *     marketplace-floor ILS rates. WHERE NOT EXISTS is used instead of
 *     ON CONFLICT because the table has no unique constraint on
 *     (provider_id, platform, service_type) — idempotent on re-approve.
 *   • Include a weeklyAvailability template inside providers.platform_data
 *     — permissive Sun-Thu 09:00-19:00, Fri morning only, Sat closed
 *     (Israel convention). Providers refine via the dashboard.
 *
 * Rename or drop either half and CI fails.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const SRC = fs.readFileSync(
  path.resolve(__dirname, '..', 'routes', 'provider-onboarding.ts'),
  'utf8',
);

describe('provider approve seeds starter rate card + weekly availability (CEO §73 #13/#14)', () => {
  describe('starter rate card per approved service', () => {
    it('declares one default per platformId (walker/sitter/driver/trainer/station_operator)', () => {
      expect(SRC).toMatch(/const rateCardDefaults:\s*Record<string,/);
      expect(SRC).toMatch(/walk_my_pet:\s*\{\s*serviceType: 'dog_walking'/);
      expect(SRC).toMatch(/sitter_suite:\{\s*serviceType: 'pet_sitting'/);
      expect(SRC).toMatch(/pet_trek:\s*\{\s*serviceType: 'pet_taxi'/);
      expect(SRC).toMatch(/academy:\s*\{\s*serviceType: 'training'/);
      expect(SRC).toMatch(/k9000:\s*\{\s*serviceType: 'k9000_wash'/);
    });

    it('rates are in cents/agorot (positive integers, never a decimal)', () => {
      // Anchor to the defaults block; every rate should be an integer.
      const start = SRC.indexOf('const rateCardDefaults');
      const end   = SRC.indexOf('const defaults = rateCardDefaults', start);
      expect(start).toBeGreaterThan(0);
      expect(end).toBeGreaterThan(start);
      const block = SRC.slice(start, end);
      // No decimals — a decimal cents value is a bug (ILS agorot are integer).
      expect(block).not.toMatch(/baseRatePer\w+Cents:\s*\d+\.\d+/);
      // Rates must be present (a null everywhere would mean no default at all).
      expect(block).toMatch(/baseRatePer\w+Cents:\s*\d+/);
    });

    it('uses WHERE NOT EXISTS (not ON CONFLICT) — the table has no unique constraint on (provider_id, platform, service_type)', () => {
      expect(SRC).toMatch(/INSERT INTO provider_rate_cards/);
      expect(SRC).toMatch(/WHERE NOT EXISTS \(\s*\n?\s*SELECT 1 FROM provider_rate_cards\s*\n?\s*WHERE provider_id = \$2 AND platform = \$3 AND service_type = \$4/);
      // A bare ON CONFLICT on the rate_cards insert would silently drop
      // rows without a matching constraint. Assert it isn't there.
      const rateInsertIdx = SRC.indexOf('INSERT INTO provider_rate_cards');
      expect(rateInsertIdx).toBeGreaterThan(0);
      const window = SRC.slice(rateInsertIdx, rateInsertIdx + 1200);
      expect(window).not.toMatch(/ON CONFLICT/);
    });

    it('42P01 (missing table) is a warn; anything else is an ERROR', () => {
      expect(SRC).toMatch(/code === '42P01'/);
      expect(SRC).toMatch(/rate-card insert skipped — provider_rate_cards absent/);
      expect(SRC).toMatch(/rate-card INSERT failed — approved provider is searchable but NOT quotable/);
    });

    it('the starter rate is written with pricing_rules.confirmed=false so downstream readers can gate', () => {
      // CEO audit 2026-08-28: search / quote engines must not treat
      // the seeded rate as authoritative until the provider confirms
      // on the dashboard.
      expect(SRC).toMatch(/const pricingRulesFlag = JSON\.stringify\(\{/);
      expect(SRC).toMatch(/confirmed:\s*false/);
      expect(SRC).toMatch(/source:\s*'admin_default_pending_provider_confirmation'/);
      // The INSERT actually writes it into pricing_rules.
      expect(SRC).toMatch(/pricing_rules,\s*\n\s*created_at, updated_at/);
      expect(SRC).toMatch(/\$8::jsonb/);
    });
  });

  describe('weekly availability template on providers.platform_data', () => {
    it('declares a 7-day template with morning/afternoon/evening + startHour/endHour', () => {
      expect(SRC).toMatch(/const weeklyAvailabilityDefault =/);
      for (const d of ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']) {
        expect(SRC).toMatch(new RegExp(`${d}:\\s*\\{\\s*morning:`));
      }
      // Startup + close hours present on each row (not just booleans).
      expect(SRC).toMatch(/startHour:\s*9,\s*endHour:\s*19/);
    });

    it('the template is marked confirmed:false with source explaining it is not authoritative', () => {
      // CEO audit 2026-08-28: seeded values must be a SUGGESTION until
      // the provider confirms. Otherwise search advertises schedules
      // the provider never chose.
      expect(SRC).toMatch(/confirmed:\s*false/);
      expect(SRC).toMatch(/source:\s*'admin_default_pending_provider_confirmation'/);
    });

    it('Sat is closed by default (Israel convention: Shabbat)', () => {
      // Whole-day off, not just some slots.
      expect(SRC).toMatch(/sat:\s*\{\s*morning: false,\s*afternoon: false,\s*evening: false,\s*startHour: 0,\s*endHour: 0/);
    });

    it('Fri is partial (morning only) — matches half-day Israeli convention', () => {
      expect(SRC).toMatch(/fri:\s*\{\s*morning: true,\s*afternoon: false,\s*evening: false/);
    });

    it('providers INSERT writes platform_data with the template', () => {
      // Anchor to the providers INSERT and confirm platform_data column
      // + a JSON.stringify(providerPlatformData) parameter binding are
      // in the same block.
      const insertIdx = SRC.indexOf('INSERT INTO providers (');
      expect(insertIdx).toBeGreaterThan(0);
      const window = SRC.slice(insertIdx, insertIdx + 2000);
      expect(window).toMatch(/platform_data/);
      expect(window).toMatch(/JSON\.stringify\(providerPlatformData\)/);
    });
  });
});
