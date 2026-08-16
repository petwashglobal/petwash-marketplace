/**
 * Task 23 — CEO fire order 101-140.
 *
 * POST /api/privilege/register wires the atomic business-idempotency
 * guard so two simultaneous submits with the same email cannot both
 * create a privilege_members row (or fire the /joined side-effects
 * twice — Gemini registration counter, HubSpot event, FCM push).
 *
 * D12 firewall: RESPONSE-ONLY dedup. No accounting / balance /
 * membership-benefit change. Same helper the provider + staff
 * application POSTs use.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const SRC = readFileSync(
  resolve(__dirname, '..', 'routes', 'privilege-loyalty.ts'),
  'utf8',
);

describe('POST /api/privilege/register wires business-idempotency', () => {
  it('imports the canonical helper', () => {
    expect(SRC).toMatch(
      /import \{ claimBusinessOnce, finalizeBusinessClaim \} from '\.\.\/lib\/businessIdempotency'/,
    );
  });

  it('claims on `prestige_join:{normalised email}` BEFORE Zod / INSERT', () => {
    const post = SRC.indexOf("router.post('/register'");
    expect(post).toBeGreaterThan(-1);
    // Widen the region — the INSERT is ~150 lines below the claim.
    const region = SRC.slice(post, post + 12000);
    expect(region).toContain('`prestige_join:${normalisedEmail}`');
    expect(region).toContain('rawEmail.trim().toLowerCase()');
    const claimAt = region.indexOf('claimBusinessOnce(');
    const insertAt = region.indexOf('INSERT INTO privilege_members');
    expect(claimAt).toBeGreaterThan(-1);
    expect(insertAt).toBeGreaterThan(claimAt);
  });

  it('returns 503 on DB_ERROR (fail-closed)', () => {
    expect(SRC).toMatch(/if \(claim === 'DB_ERROR'\)/);
    expect(SRC).toMatch(/'IDEMPOTENCY_UNAVAILABLE'/);
  });

  it('returns 409 on IN_FLIGHT', () => {
    expect(SRC).toMatch(/if \(claim === 'IN_FLIGHT'\)/);
    expect(SRC).toMatch(/'DUPLICATE_REGISTRATION_IN_FLIGHT'/);
  });

  it('returns 409 on DONE', () => {
    expect(SRC).toMatch(/if \(claim === 'DONE'\)/);
    expect(SRC).toMatch(/'ALREADY_REGISTERED'/);
  });

  it('finalize(true) on 201 success', () => {
    const okIdx = SRC.indexOf("'Welcome to PetWash Privilege!'");
    expect(okIdx).toBeGreaterThan(-1);
    const region = SRC.slice(okIdx - 300, okIdx);
    expect(region).toMatch(/finalizeBusinessClaim\(idempKey, true\)/);
  });

  it('finalize(true) on DB-unique-violation 409 (existing member is authoritative)', () => {
    const dupIdx = SRC.indexOf("errMsg?.includes('duplicate key')");
    expect(dupIdx).toBeGreaterThan(-1);
    const region = SRC.slice(dupIdx, dupIdx + 600);
    expect(region).toMatch(/finalizeBusinessClaim\(idempKey, true\)/);
    expect(region).toMatch(/'ALREADY_REGISTERED'/);
  });

  it('finalize(false) on 500 unknown-error path so user can retry', () => {
    const genericIdx = SRC.indexOf("'REGISTRATION_FAILED'");
    expect(genericIdx).toBeGreaterThan(-1);
    const region = SRC.slice(genericIdx - 300, genericIdx);
    expect(region).toMatch(/finalizeBusinessClaim\(idempKey, false\)/);
  });

  it('finalize(false) on missing-required-fields 400 path', () => {
    const missingIdx = SRC.indexOf("'MISSING_FIELDS'");
    expect(missingIdx).toBeGreaterThan(-1);
    const region = SRC.slice(missingIdx - 300, missingIdx);
    expect(region).toMatch(/finalizeBusinessClaim\(idempKey, false\)/);
  });

  it('D12 firewall: business surface untouched (INSERT INTO privilege_members intact + HubSpot + FCM)', () => {
    expect(SRC).toMatch(/INSERT INTO privilege_members/);
    expect(SRC).toContain('syncUserToHubSpot');
    expect(SRC).toContain('trackHubSpotEvent');
    expect(SRC).toContain('FCMService');
    expect(SRC).toContain('encryptField');
  });
});
