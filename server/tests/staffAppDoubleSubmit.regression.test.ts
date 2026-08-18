/**
 * Task 22 — CEO fire order 101-140.
 *
 * POST /api/staff/applications wires the atomic business-idempotency
 * guard. Two simultaneous submits with the same (normalised) email
 * cannot both create a staff_applications row.
 *
 * Because the endpoint is UNAUTHENTICATED, the key uses the
 * normalised email — the natural uniqueness handle for a submission.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const SRC = readFileSync(
  resolve(__dirname, '..', 'routes', 'staff-onboarding.ts'),
  'utf8',
);

describe('POST /api/staff/applications wires business-idempotency', () => {
  it('claims on `staff_app_submit:{email}` (normalised)', () => {
    expect(SRC).toContain("`staff_app_submit:${normalisedEmail}`");
    expect(SRC).toContain('rawEmail.trim().toLowerCase()');
  });

  it('the claim happens BEFORE Zod .parse + createApplication', () => {
    const post = SRC.indexOf("app.post('/api/staff/applications'");
    const region = SRC.slice(post, post + 4000);
    const claimAt = region.indexOf('claimBusinessOnce(');
    const parseAt = region.indexOf('insertStaffApplicationSchema.parse(');
    const createAt = region.indexOf('staffOnboardingService.createApplication(');
    expect(claimAt).toBeGreaterThan(-1);
    expect(parseAt).toBeGreaterThan(claimAt);
    expect(createAt).toBeGreaterThan(claimAt);
  });

  it('returns 503 on DB_ERROR (fail-closed)', () => {
    expect(SRC).toMatch(/if \(claim === 'DB_ERROR'\)/);
    expect(SRC).toMatch(/res\.status\(503\)\.json\(\{[^)]*'IDEMPOTENCY_UNAVAILABLE'/);
  });

  it('returns 409 on IN_FLIGHT (blocks concurrent submits)', () => {
    expect(SRC).toMatch(/if \(claim === 'IN_FLIGHT'\)/);
    expect(SRC).toMatch(/'DUPLICATE_SUBMISSION_IN_FLIGHT'/);
  });

  it('returns 409 on DONE (blocks post-success replay)', () => {
    expect(SRC).toMatch(/if \(claim === 'DONE'\)/);
    expect(SRC).toMatch(/'ALREADY_SUBMITTED'/);
  });

  it('finalize(true) on success', () => {
    // Success branch precedes res.json({ success:true, application, ...}).
    const okIdx = SRC.indexOf("'Application submitted successfully! Check your email for next steps.'");
    expect(okIdx).toBeGreaterThan(-1);
    const region = SRC.slice(okIdx - 400, okIdx);
    expect(region).toMatch(/finalizeBusinessClaim\(idempKey, true\)/);
  });

  it('finalize(false) on Zod/validation error so the user can fix + retry', () => {
    const catchIdx = SRC.indexOf("logger.error('[API] Failed to create application'");
    expect(catchIdx).toBeGreaterThan(-1);
    const region = SRC.slice(catchIdx, catchIdx + 400);
    expect(region).toMatch(/finalizeBusinessClaim\(idempKey, false\)/);
  });

  it('hiring surface unchanged', () => {
    expect(SRC).toContain('insertStaffApplicationSchema.parse');
    expect(SRC).toContain('staffOnboardingService.createApplication');
    expect(SRC).toContain("logStaffApplication");
  });
});
