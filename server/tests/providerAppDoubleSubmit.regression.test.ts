/**
 * Task 21 — CEO fire order 101-140.
 *
 * Provider-application POST wires the business-idempotency guard.
 * Pinned so regression cannot silently remove the atomic protection.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const SRC = readFileSync(
  resolve(__dirname, '..', 'routes', 'provider-applications.ts'),
  'utf8',
);

describe('POST /api/provider-applications wires business-idempotency', () => {
  it('imports the canonical helper', () => {
    expect(SRC).toMatch(
      /import \{ claimBusinessOnce, finalizeBusinessClaim \} from '\.\.\/lib\/businessIdempotency'/,
    );
  });

  it('claims BEFORE reading req.body or doing the DB SELECT', () => {
    const submit = SRC.indexOf("router.post('/', uploadFields");
    expect(submit).toBeGreaterThan(-1);
    const region = SRC.slice(submit, submit + 5000);
    const claimAt = region.indexOf('claimBusinessOnce(');
    const selectAt = region.indexOf('db.select()');
    const insertAt = region.indexOf('db.insert(providerApplicants)');
    expect(claimAt).toBeGreaterThan(-1);
    expect(selectAt).toBeGreaterThan(claimAt);
    expect(insertAt).toBeGreaterThan(claimAt);
  });

  it('returns 503 on DB_ERROR (fail-closed)', () => {
    expect(SRC).toMatch(/if \(claim === 'DB_ERROR'\)/);
    expect(SRC).toMatch(/res\.status\(503\)\.json\(\{\s*error:\s*'IDEMPOTENCY_UNAVAILABLE'/);
  });

  it('returns 409 on IN_FLIGHT (blocks concurrent submits)', () => {
    expect(SRC).toMatch(/if \(claim === 'IN_FLIGHT'\)/);
    expect(SRC).toMatch(/'DUPLICATE_SUBMISSION_IN_FLIGHT'/);
  });

  it('returns 409 on DONE (blocks post-success replay)', () => {
    expect(SRC).toMatch(/if \(claim === 'DONE'\)/);
    expect(SRC).toMatch(/'ALREADY_SUBMITTED'/);
  });

  it('finalizes(true) on the 201 success path', () => {
    expect(SRC).toMatch(/finalizeBusinessClaim\(idempKey, true\)/);
  });

  it('releases (finalize=false) on the 500 error path so user can retry', () => {
    // The 500 catch releases the claim ONLY when claimSucceeded — otherwise
    // there is nothing to release.
    const catchIdx = SRC.indexOf("logger.error('[ProviderApplication] Submit error'");
    expect(catchIdx).toBeGreaterThan(-1);
    const region = SRC.slice(catchIdx, catchIdx + 500);
    expect(region).toMatch(/finalizeBusinessClaim\(idempKey, false\)/);
  });

  it('releases (finalize=false) on the 400 validation-failure path so user can fix + retry', () => {
    const region = SRC.slice(SRC.indexOf('Validate form data'), SRC.indexOf('Validate form data') + 800);
    expect(region).toMatch(/finalizeBusinessClaim\(idempKey, false\)/);
    expect(region).toMatch(/'Validation failed'/);
  });

  it('marks 409 (existing pending/approved) as DONE so replays return the same 409', () => {
    const region = SRC.slice(SRC.indexOf('Check for existing application'), SRC.indexOf('Create content hash') || SRC.length);
    // Both existing-row branches finalize(true) — the existing row is
    // authoritative, so the claim should read as DONE forever.
    expect((region.match(/finalizeBusinessClaim\(idempKey, true\)/g) || []).length).toBeGreaterThanOrEqual(2);
  });
});
