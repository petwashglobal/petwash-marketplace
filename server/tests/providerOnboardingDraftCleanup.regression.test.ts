/**
 * CEO §36 (2026-08-28) — provider onboarding lives across TWO tables:
 *   • drafts    → provider_applicants  (POST /api/provider-applications/draft)
 *   • submitted → provider_applications (POST /api/provider-onboarding/apply)
 *
 * Until this commit /apply inserted the row into provider_applications and
 * left the draft row alive in provider_applicants forever. Two consequences:
 *   1. A second visit to /become-provider re-hydrated the wizard with the
 *      already-submitted data — the applicant thought the app was still
 *      unfinished, and could accidentally submit twice.
 *   2. Admins reviewing the app saw two conflicting records for one person
 *      because the draft was still queryable.
 *
 * Pin: the /apply handler MUST delete the draft row (keyed on the verified
 * Firebase UID) once the submission is safely written and the response has
 * been sent. Fire-and-forget with a code-guarded catch so a missing table
 * on an older deploy never surfaces as an error.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const SRC = fs.readFileSync(
  path.resolve(__dirname, '..', 'routes', 'provider-onboarding.ts'),
  'utf8',
);

describe('provider-onboarding /apply cleans up the draft row (CEO §36)', () => {
  it('imports providerApplicants from the enterprise schema (the draft table)', () => {
    // provider_applicants lives in schema-enterprise, provider_applications
    // lives in the primary schema. Mixing them up would delete the wrong
    // table. Pin the import path.
    expect(SRC).toMatch(
      /import\s*\{\s*providerApplicants\s*\}\s*from\s*['"]@shared\/schema-enterprise['"]/,
    );
  });

  it('deletes the draft row after res.json — keyed on the authenticated Firebase UID', () => {
    expect(SRC).toMatch(/db\.delete\(providerApplicants\)/);
    expect(SRC).toMatch(/\.where\(eq\(providerApplicants\.userId,\s*authenticatedUser\.uid\)\)/);
  });

  it('the cleanup runs AFTER the success response (res.json before delete)', () => {
    // Ordering matters: if we delete first and the DB call throws, we'd
    // fail an otherwise-successful submit and the applicant would think
    // /apply broke. Response goes out first; cleanup is fire-and-forget.
    const successResJson = SRC.indexOf('Application submitted. Your documents are being reviewed');
    const draftDelete    = SRC.indexOf('db.delete(providerApplicants)');
    expect(successResJson).toBeGreaterThan(0);
    expect(draftDelete).toBeGreaterThan(0);
    expect(successResJson).toBeLessThan(draftDelete);
  });

  it('missing-table code (42P01) is downgraded to a warn — never bubbles as an error', () => {
    // Old deploys of the draft route may predate provider_applicants.
    // A missing-table error on cleanup MUST NOT poison logs / alerts —
    // it's the expected state during the rolling migration window.
    expect(SRC).toMatch(/cleanupErr\?\.code === '42P01'/);
    expect(SRC).toMatch(/Draft cleanup skipped/);
  });

  it('any OTHER cleanup error is logged at ERROR (so real bugs are not silently swallowed)', () => {
    // Rule mirrors the sealed-declaration + identity-hardening blocks
    // above: 42P01 / 42703 = expected migration-window skip, anything
    // else = raise to ERROR level for monitoring.
    expect(SRC).toMatch(/Draft cleanup failed after submit/);
  });
});
