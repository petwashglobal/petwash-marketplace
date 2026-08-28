/**
 * CEO MASTER DIRECTIVE 2026-08-28 §7 §9 §10 (Journey Brain Phase 3) —
 * saved-search + favourite-provider service invariants.
 *
 * The wizard uses saved_searches for "still looking for a walk on
 * Tuesday?" and favourite_providers for "book Maya again". Both are
 * OWNER-scoped by Firebase UID. Neither is a source of truth for
 * money / pricing / eligibility — canonical marketplace tables retain
 * that authority.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const MIG = fs.readFileSync(
  path.resolve(__dirname, '..', '..', 'migrations', '0135_saved_searches_favourites_2026_08_28.sql'),
  'utf8',
);
const SCHEMA = fs.readFileSync(
  path.resolve(__dirname, '..', '..', 'shared', 'schema.ts'),
  'utf8',
);
const SS = fs.readFileSync(
  path.resolve(__dirname, '..', 'services', 'savedSearches.ts'),
  'utf8',
);
const FP = fs.readFileSync(
  path.resolve(__dirname, '..', 'services', 'favouriteProviders.ts'),
  'utf8',
);
const FEED = fs.readFileSync(
  path.resolve(__dirname, '..', 'services', 'attentionFeed.ts'),
  'utf8',
);

describe('saved_searches + favourite_providers migration (CEO §7 §9)', () => {
  it('migration 0135 creates both tables with the required columns', () => {
    expect(MIG).toMatch(/CREATE TABLE IF NOT EXISTS saved_searches/);
    expect(MIG).toMatch(/CREATE TABLE IF NOT EXISTS favourite_providers/);
    for (const col of ['user_uid', 'domain', 'filters', 'last_used_at', 'expires_at']) {
      expect(MIG).toContain(col);
    }
    for (const col of ['user_uid', 'provider_id', 'domain', 'added_at']) {
      expect(MIG).toContain(col);
    }
  });

  it('saved_searches is UNIQUE on (user_uid, domain) so a new query overwrites the older one', () => {
    // Prevents unbounded row growth per user / domain.
    expect(MIG).toMatch(/CREATE UNIQUE INDEX IF NOT EXISTS saved_searches_user_domain_uniq\s*\n\s*ON saved_searches \(user_uid, domain\);/);
  });

  it('favourite_providers is UNIQUE on (user_uid, provider_id, domain)', () => {
    // Starring twice is a no-op, not a stack.
    expect(MIG).toMatch(/CREATE UNIQUE INDEX IF NOT EXISTS favourite_providers_user_provider_domain_uniq\s*\n\s*ON favourite_providers \(user_uid, provider_id, domain\);/);
  });

  it('drizzle schema mirrors both tables', () => {
    expect(SCHEMA).toMatch(/export const savedSearches = pgTable\("saved_searches",/);
    expect(SCHEMA).toMatch(/export const favouriteProviders = pgTable\("favourite_providers",/);
  });
});

describe('savedSearches service (CEO §7)', () => {
  it('saveSearch UPSERTs on (user_uid, domain)', () => {
    expect(SS).toMatch(/\.onConflictDoUpdate\(\{[\s\S]*?target: \[savedSearches\.userUid, savedSearches\.domain\]/);
  });

  it('save REFUSES an empty userUid or domain (defence-in-depth)', () => {
    expect(SS).toMatch(/if \(!input\.userUid\) throw new Error\('savedSearches: userUid required'\);/);
    expect(SS).toMatch(/if \(!input\.domain\)  throw new Error\('savedSearches: domain required'\);/);
  });

  it('getActive treats NULL expires_at as unexpired but blocks past-expiry rows', () => {
    // A saved search without a TTL counts as a long-lived preference;
    // one with a past TTL must NOT re-hydrate.
    expect(SS).toMatch(/or\(\s*\n\s*isNull\(savedSearches\.expiresAt\),\s*\n\s*gt\(savedSearches\.expiresAt, now\),\s*\n\s*\)/);
  });

  it('default TTL is 30 days', () => {
    expect(SS).toMatch(/DEFAULT_SAVED_SEARCH_TTL_MS = 30 \* 24 \* 60 \* 60 \* 1000/);
  });
});

describe('favouriteProviders service (CEO §9 §10)', () => {
  it('add REFUSES empty userUid / providerId / domain', () => {
    expect(FP).toMatch(/if \(!input\.userUid\)   throw new Error\('favouriteProviders: userUid required'\);/);
    expect(FP).toMatch(/if \(!input\.providerId\) throw new Error\('favouriteProviders: providerId required'\);/);
    expect(FP).toMatch(/if \(!input\.domain\)    throw new Error\('favouriteProviders: domain required'\);/);
  });

  it('add uses onConflictDoNothing so the ORIGINAL addedAt is preserved on repeat star', () => {
    // Loyalty analytics can measure "starred since" — that number
    // must not reset on every re-click.
    expect(FP).toMatch(/\.onConflictDoNothing\(\{[\s\S]*?target: \[\s*\n\s*favouriteProviders\.userUid,\s*\n\s*favouriteProviders\.providerId,\s*\n\s*favouriteProviders\.domain,\s*\n\s*\]/);
  });

  it('exposes the four surface functions the wizard / recommender need', () => {
    expect(FP).toMatch(/export async function addFavouriteProvider\(/);
    expect(FP).toMatch(/export async function removeFavouriteProvider\(/);
    expect(FP).toMatch(/export async function listFavouriteProviders\(/);
    expect(FP).toMatch(/export async function isFavouriteProvider\(/);
  });
});

describe('attention feed — saved-search "still looking?" probe (CEO §7)', () => {
  it('composer wires the saved-search probe between resume and refund', () => {
    expect(FEED).toMatch(/\.\.\.await petParentJourneyResumeItems\(userId, he\),\s*\n\s*\.\.\.await petParentSavedSearchItems\(userId, he\),\s*\n\s*\.\.\.await petParentRefundItems\(userId, he\),/);
  });

  it('probe lazy-imports the service (no circular import)', () => {
    expect(FEED).toMatch(/await import\('\.\/savedSearches'\)/);
    expect(FEED).toMatch(/listActiveSavedSearches\(userId\)/);
  });

  it('probe maps only KNOWN saved-search domains to a mounted route', () => {
    // Unknown domains fall through the destination guard (same
    // pattern as the resume probe).
    expect(FEED).toMatch(/const dest = journeyResumeDestination\(searchDomainToJourneyDomain\(s\.domain\), null\);/);
    expect(FEED).toMatch(/if \(!dest\) continue;/);
  });
});
