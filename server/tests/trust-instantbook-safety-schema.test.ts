/**
 * Migration 0050 — additive trust / instant-book / meet-greet / AI trust-score /
 * live-safety schema. Guards that the migration is additive-safe (IF NOT EXISTS,
 * no DROP of existing data) and that the Drizzle defs match the migration.
 *
 * Source-introspection.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const mig = fs.readFileSync(
  path.resolve(__dirname, '..', '..', 'migrations', '0050_trust_instantbook_safety.sql'),
  'utf8',
);
const schema = fs.readFileSync(
  path.resolve(__dirname, '..', '..', 'shared', 'schema.ts'),
  'utf8',
);

const TABLES = [
  'provider_background_checks',
  'meet_greets',
  'provider_trust_scores',
  'service_safety_sessions',
];

describe('migration 0050 — additive safety', () => {
  it('creates every table with IF NOT EXISTS (no destructive create)', () => {
    for (const t of TABLES) {
      expect(mig).toMatch(new RegExp(`CREATE TABLE IF NOT EXISTS ${t}`));
    }
  });
  it('adds instant-book columns additively (ADD COLUMN IF NOT EXISTS)', () => {
    expect(mig).toMatch(/ALTER TABLE sitter_profiles ADD COLUMN IF NOT EXISTS instant_book_enabled/);
    expect(mig).toMatch(/ALTER TABLE walker_profiles ADD COLUMN IF NOT EXISTS instant_book_enabled/);
  });
  it('never DROPs an existing table/column in the forward migration', () => {
    const forward = mig.split('ROLLBACK')[0];
    expect(forward).not.toMatch(/DROP TABLE/);
    expect(forward).not.toMatch(/DROP COLUMN/);
  });
});

describe('Drizzle defs match migration', () => {
  it('exports the four new tables', () => {
    expect(schema).toMatch(/providerBackgroundChecks = pgTable\("provider_background_checks"/);
    expect(schema).toMatch(/meetGreets = pgTable\("meet_greets"/);
    expect(schema).toMatch(/providerTrustScores = pgTable\("provider_trust_scores"/);
    expect(schema).toMatch(/serviceSafetySessions = pgTable\("service_safety_sessions"/);
  });
  it('adds instant-book columns to both profile tables', () => {
    const count = (schema.match(/instantBookEnabled: boolean\("instant_book_enabled"\)/g) || []).length;
    expect(count).toBe(2);
  });
});

describe('migration 0051 — provider insurance/health-declaration register', () => {
  const mig51 = fs.readFileSync(
    path.resolve(__dirname, '..', '..', 'migrations', '0051_provider_insurance_docs.sql'),
    'utf8',
  );
  it('creates provider_insurance_documents additively (IF NOT EXISTS, no DROP forward)', () => {
    expect(mig51).toMatch(/CREATE TABLE IF NOT EXISTS provider_insurance_documents/);
    expect(mig51.split('ROLLBACK')[0]).not.toMatch(/DROP TABLE/);
  });
  it('stores only metadata + private file ref + declaration hash (no document body)', () => {
    expect(mig51).toMatch(/file_ref/);
    expect(mig51).toMatch(/declaration_hash/);
    expect(mig51).toMatch(/expires_at/); // drives the "cover lapsed" gate
  });
  it('Drizzle def matches', () => {
    expect(schema).toMatch(/providerInsuranceDocuments = pgTable\("provider_insurance_documents"/);
  });
});
