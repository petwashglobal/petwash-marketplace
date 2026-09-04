/**
 * Provider journey — ownership + self-read privacy pins.
 *
 * Three defects in the "beyond pending" surface, all found by tracing
 * BUTTON → … → SERVER ROUTE → OWNERSHIP → RESPONSE:
 *
 *  1. POST /api/provider-intake/submit-documents flipped the intake row
 *     named by a CLIENT-SUPPLIED `intakeId` to 'reviewing' with NO
 *     ownership predicate — any authenticated user could move any other
 *     applicant's KYC row. A cross-user WRITE.
 *
 *  2. GET /api/provider-onboarding/application/status returned the raw
 *     `SELECT *` rows to the applicant, including internal_notes
 *     ("Only visible to admins"), reviewed_by, trust_score_internal,
 *     israeli_id_encrypted, bank_iban and the KYC vault storage paths.
 *
 *  3. POST /api/provider-onboarding/apply — THE live submit endpoint —
 *     had no idempotency at all, only a SELECT-then-INSERT check. Two
 *     concurrent submits both pass the SELECT and both INSERT, and
 *     provider_applications has no unique index on user_id. The legacy
 *     sibling endpoint had the atomic guard; the one people use did not.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const read = (...p: string[]) => readFileSync(resolve(__dirname, '..', ...p), 'utf8');
const INTAKE = read('routes', 'provider-intake.ts');
const ONBOARDING = read('routes', 'provider-onboarding.ts');

/** Body of the handler that starts at `marker`, up to the next router.<verb>. */
function handler(src: string, marker: string): string {
  const start = src.indexOf(marker);
  if (start === -1) throw new Error(`handler not found: ${marker}`);
  const next = src.slice(start + marker.length).search(/\nrouter\.(get|post|put|patch|delete)\(/);
  return src.slice(start, next === -1 ? src.length : start + marker.length + next);
}

describe('POST /api/provider-intake/submit-documents — cross-user write IDOR', () => {
  const H = handler(INTAKE, "router.post('/submit-documents'");

  it('scopes the intake status UPDATE by the caller, not by the body id alone', () => {
    // The bug: .where(eq(providerIntakeQueue.intakeId, data.intakeId)) — full stop.
    expect(H).toMatch(/\.update\(providerIntakeQueue\)/);
    const update = H.slice(H.indexOf('.update(providerIntakeQueue)'));
    expect(update).toMatch(/\.where\(and\(/);
    expect(update).toMatch(/eq\(providerIntakeQueue\.intakeId, data\.intakeId\)/);
    expect(
      update,
      'the UPDATE must also match on the caller-owned column (email) — otherwise any signed-in user can move anyone else\'s intake row',
    ).toMatch(/eq\(providerIntakeQueue\.email, callerEmail\)/);
  });

  it('takes the owning email from the verified session, never from the body', () => {
    expect(H).toMatch(/const callerEmail = \(\(req as any\)\.user\?\.email \|\| ''\)/);
    expect(H).not.toMatch(/data\.email/);
    // The schema still accepts a legacy firebaseUid but the handler must
    // never read it.
    expect(H).not.toMatch(/data\.firebaseUid/);
  });

  it('denies (403) instead of silently reporting success when nothing was owned', () => {
    const update = H.slice(H.indexOf('.update(providerIntakeQueue)'));
    expect(update).toMatch(/\.returning\(/);
    expect(update).toMatch(/updated\.length === 0/);
    expect(update).toMatch(/res\.status\(403\)/);
    expect(update).toMatch(/INTAKE_NOT_OWNED/);
  });

  it('does not become an existence oracle — same answer for missing and not-yours', () => {
    const update = H.slice(H.indexOf('.update(providerIntakeQueue)'));
    expect(update).not.toMatch(/404/);
  });
});

describe('GET /api/provider-onboarding/application/status — applicant self-read', () => {
  const H = handler(ONBOARDING, "router.get('/application/status'");

  it('is scoped to the caller', () => {
    expect(H).toMatch(/eq\(providerApplications\.userId, decodedToken\.uid\)/);
  });

  it('responds with an explicit allow-list, not the raw rows', () => {
    expect(H).toMatch(/const safeApplications = applications\.map/);
    expect(H).toMatch(/res\.json\(\{ applications: safeApplications, sectionStatus \}\)/);
    expect(H, 'the raw rows must never be the response body').not.toMatch(
      /res\.json\(\{ applications, sectionStatus \}\)/,
    );
  });

  it('never ships admin-only or vault columns to the applicant', () => {
    const projection = H.slice(H.indexOf('const safeApplications'));
    for (const forbidden of [
      'internalNotes',
      'backgroundCheckNotes',
      'reviewedBy',
      'trustScoreInternal',
      'israeliIdEncrypted',
      'bankIban',
      'bankAccountHolder',
      'bankBranchCode',
      'governmentIdUrl',
      'selfiePhotoUrl',
      'insuranceCertUrl',
      'businessLicenseUrl',
      'criminalCheckReportId',
      'drivingRecordUrl',
      'petFirstAidCertUrl',
    ]) {
      expect(
        projection.includes(`${forbidden}:`),
        `${forbidden} must not be in the applicant-facing projection`,
      ).toBe(false);
    }
  });

  it('still returns what the applicant is entitled to', () => {
    const projection = H.slice(H.indexOf('const safeApplications'));
    for (const field of [
      'applicationId', 'status', 'providerType', 'rejectionReason',
      'kycIdLastFour', 'submittedAt', 'reviewedAt',
    ]) {
      expect(projection.includes(`${field}:`), `${field} should be returned`).toBe(true);
    }
  });
});

describe('POST /api/provider-onboarding/apply — double-submit is atomic', () => {
  const H = handler(ONBOARDING, "router.post('/apply'");

  it('imports the canonical business-idempotency helper', () => {
    expect(ONBOARDING).toMatch(
      /import \{ claimBusinessOnce, finalizeBusinessClaim \} from '\.\.\/lib\/businessIdempotency'/,
    );
  });

  it('claims BEFORE the existing-application SELECT and BEFORE the INSERT', () => {
    const claimAt = H.indexOf('claimBusinessOnce(');
    const selectAt = H.indexOf('.from(providerApplications)');
    const insertAt = H.indexOf('db.insert(providerApplications)');
    expect(claimAt, 'no idempotency claim on the live submit endpoint').toBeGreaterThan(-1);
    expect(selectAt).toBeGreaterThan(claimAt);
    expect(insertAt).toBeGreaterThan(claimAt);
  });

  it('keys the claim on the authenticated uid', () => {
    expect(H).toMatch(/provider_onboarding_apply:\$\{authenticatedUser\.uid\}/);
  });

  it('fails CLOSED (503) when the guard itself is unavailable', () => {
    expect(H).toMatch(/claim === 'DB_ERROR'/);
    expect(H).toMatch(/IDEMPOTENCY_UNAVAILABLE/);
    const idx = H.indexOf("claim === 'DB_ERROR'");
    expect(H.slice(idx, idx + 300)).toMatch(/res\.status\(503\)/);
  });

  it('409s a concurrent submit and a post-success replay', () => {
    expect(H).toMatch(/claim === 'IN_FLIGHT'/);
    expect(H).toMatch(/DUPLICATE_SUBMISSION_IN_FLIGHT/);
    expect(H).toMatch(/claim === 'DONE'/);
    expect(H).toMatch(/ALREADY_SUBMITTED/);
  });

  it('finalizes on EVERY exit path via a finish hook, not per-return calls', () => {
    // ~20 early returns live below the claim; a hook cannot drift out of
    // sync with that list the way scattered finalize() calls do.
    expect(H).toMatch(/res\.on\('finish'/);
    expect(H).toMatch(/finalizeBusinessClaim\(idempKey, ok\)/);
    expect(H).toMatch(/res\.statusCode >= 200 && res\.statusCode < 300/);
  });

  it('blocks re-apply for an already-APPROVED provider (would demote them)', () => {
    const guard = H.slice(H.indexOf('const existingApp'), H.indexOf('const existingApp') + 1400);
    expect(guard).toMatch(/'on_hold'/);
    expect(guard).toMatch(/'approved'/);
    expect(guard).toMatch(/ALREADY_APPROVED/);
    // …but a rejected or withdrawn applicant may still re-apply.
    expect(guard).not.toMatch(/'rejected'/);
    expect(guard.includes("inArray(providerApplications.status, ['pending'")).toBe(true);
  });
});
