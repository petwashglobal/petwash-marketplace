/**
 * CEO MASTER DIRECTIVE 2026-08-28 §11 §12 §13 §28 §34 §70 —
 * Journey Brain Phase 2 checkpoint invariants.
 *
 * The wizard writes a checkpoint at each SAFE step; a resume endpoint
 * reads the newest non-expired checkpoint per (userUid, domain) and
 * re-hydrates. This test pins the invariants that must survive any
 * refactor.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const SVC = fs.readFileSync(
  path.resolve(__dirname, '..', 'services', 'journeyCheckpoints.ts'),
  'utf8',
);
const MIG = fs.readFileSync(
  path.resolve(__dirname, '..', '..', 'migrations', '0134_journey_checkpoints_2026_08_28.sql'),
  'utf8',
);
const SCHEMA = fs.readFileSync(
  path.resolve(__dirname, '..', '..', 'shared', 'schema.ts'),
  'utf8',
);
const FEED = fs.readFileSync(
  path.resolve(__dirname, '..', 'services', 'attentionFeed.ts'),
  'utf8',
);

describe('journeyCheckpoints service invariants (CEO §11 §12 §13)', () => {
  it('migration 0134 creates the journey_checkpoints table with the required columns', () => {
    expect(MIG).toMatch(/CREATE TABLE IF NOT EXISTS journey_checkpoints/);
    for (const col of [
      'journey_id',
      'user_uid',
      'domain',
      'entity_ref',
      'state',
      'last_safe_step',
      'snapshot',
      'created_at',
      'updated_at',
      'expires_at',
    ]) {
      expect(MIG).toContain(col);
    }
  });

  it('UNIQUE index on (user_uid, domain) — one active checkpoint per journey', () => {
    // A fresh flow supersedes the older one via ON CONFLICT DO UPDATE.
    // Losing this UNIQUE lets an attacker (or a runaway wizard) write
    // an unbounded number of checkpoints per user.
    expect(MIG).toMatch(/CREATE UNIQUE INDEX IF NOT EXISTS journey_checkpoints_user_domain_uniq\s*\n\s*ON journey_checkpoints \(user_uid, domain\);/);
  });

  it('drizzle schema mirrors the migration column-for-column', () => {
    expect(SCHEMA).toMatch(/export const journeyCheckpoints = pgTable\("journey_checkpoints",/);
    for (const field of [
      'journeyId',
      'userUid',
      'domain',
      'entityRef',
      'state',
      'lastSafeStep',
      'snapshot',
      'createdAt',
      'updatedAt',
      'expiresAt',
    ]) {
      expect(SCHEMA).toContain(field);
    }
  });

  it('service exposes save + get + list + clear — the wizard-owned surface', () => {
    expect(SVC).toMatch(/export async function saveCheckpoint\(/);
    expect(SVC).toMatch(/export async function getActiveCheckpoint\(/);
    expect(SVC).toMatch(/export async function listActiveCheckpoints\(/);
    expect(SVC).toMatch(/export async function clearCheckpoint\(/);
  });

  it('save UPSERTs on (user_uid, domain) so a fresh flow supersedes the older one', () => {
    // Drop the ON CONFLICT clause and every stale checkpoint sticks
    // around indefinitely.
    expect(SVC).toMatch(/\.onConflictDoUpdate\(\{[\s\S]*?target: \[journeyCheckpoints\.userUid, journeyCheckpoints\.domain\]/);
  });

  it('getActive REFUSES to return an expired checkpoint (expires_at > now)', () => {
    // CEO §11: default TTL is a long weekend; a checkpoint past that
    // must NOT resume — the wizard treats it as forgotten. Losing the
    // gt() lets a stale flow re-hydrate against a possibly-stale
    // world (deleted provider, stale price).
    expect(SVC).toMatch(/gt\(journeyCheckpoints\.expiresAt, new Date\(\)\)/);
  });

  it('save is CALLER-AUTHENTICATED — throws if userUid or domain is empty', () => {
    // Defence-in-depth. The route MUST derive userUid from the
    // Firebase token, but if that ever slips, the service refuses to
    // record an anonymous checkpoint.
    expect(SVC).toMatch(/if \(!input\.userUid\) throw new Error\('journeyCheckpoints: userUid required'\);/);
    expect(SVC).toMatch(/if \(!input\.domain\)  throw new Error\('journeyCheckpoints: domain required'\);/);
  });

  it('default TTL is 72 hours', () => {
    expect(SVC).toMatch(/DEFAULT_CHECKPOINT_TTL_MS = 72 \* 60 \* 60 \* 1000/);
  });

  it('attention feed wires the journey-resume probe (checkpoint-driven)', () => {
    expect(FEED).toMatch(/\.\.\.await petParentJourneyResumeItems\(userId, he\),/);
    // Import is lazy (avoids a circular import between service +
    // composer) but must call listActiveCheckpoints.
    expect(FEED).toMatch(/await import\('\.\/journeyCheckpoints'\)/);
    expect(FEED).toMatch(/listActiveCheckpoints\(userId\)/);
  });

  it('unknown journey domain does NOT emit — safe destination map only', () => {
    // A rogue domain in the DB must not silently route the customer
    // to a page that could side-effect on load.
    expect(FEED).toMatch(/if \(!dest\) continue; \/\/ Unknown domain — refuse to route\./);
  });
});
