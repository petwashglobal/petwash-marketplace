/**
 * CEO §46 (2026-08-28) — per-section readiness on the applicant's
 * status endpoint.
 *
 * Applicants need to know exactly which section is complete / checking
 * / action-required so they can go straight to what's missing. The
 * per-section rules read the SAME fields the admin surface reads —
 * a section marked "action_required" here matches the "missing"
 * reasons the reviewer sees on their queue.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const SRC = fs.readFileSync(
  path.resolve(__dirname, '..', 'routes', 'provider-onboarding.ts'),
  'utf8',
);

describe('/api/provider-onboarding/application/status returns per-section state (CEO §46)', () => {
  it('exposes sectionStatus alongside applications (existing shape is unchanged)', () => {
    // Existing shape { applications } stays — new field is additive.
    expect(SRC).toMatch(/res\.json\(\{ applications, sectionStatus \}\)/);
  });

  it('projects the six canonical sections (profile / identity / insurance / background / bank / declarations)', () => {
    for (const key of [
      'profile:',
      'identity:',
      'insurance:',
      'background:',
      'bank:',
      'declarations:',
    ]) {
      expect(SRC).toMatch(new RegExp(`sections:\\s*\\{[\\s\\S]{0,600}${key}`));
    }
  });

  it('the status helper distinguishes complete / checking / action_required', () => {
    expect(SRC).toMatch(/'complete' \| 'checking' \| 'action_required'/);
    // action_required is the fail-safe (missing fields ALWAYS trip it,
    // regardless of the row's overall status).
    expect(SRC).toMatch(/if \(!fieldsComplete\) return 'action_required'/);
    // Approved rows with complete fields render "complete" — never
    // "checking" even if the overall status field was stale.
    expect(SRC).toMatch(/if \(app\.status === 'approved'\) return 'complete'/);
  });

  it('reviewing states downgrade to "checking" (the sections are with the reviewer, not the applicant)', () => {
    expect(SRC).toMatch(/const isReviewing = \['pending_review', 'under_review'\]\.includes\(app\.status\)/);
    expect(SRC).toMatch(/if \(isReviewing \|\| app\.status === 'pending'\)\s+return 'checking'/);
  });

  it('bank section keys on bankIban + bankAccountHolder (matches migration 0133 fields)', () => {
    // If a reviewer approved before these landed on the row, the
    // section renders action_required so the applicant knows to fill
    // in the missing payout target.
    expect(SRC).toMatch(/bank:\s*status\(!!\(app\.bankIban && app\.bankAccountHolder\)\)/);
  });

  it('declarations section reads the internal_notes JSON blob — the same one the admin surface parses', () => {
    // A rename that dropped internal_notes would break the parity. Pin
    // that we still parse the blob and count keys off `.declarations`.
    expect(SRC).toMatch(/JSON\.parse\(app\.internalNotes\)/);
    expect(SRC).toMatch(/notes\.declarations/);
    expect(SRC).toMatch(/Object\.keys\(declarations\)\.length > 0/);
  });

  it('overall state distinguishes decided vs reviewing vs action_required', () => {
    // The overall label mirrors the row status when decided,
    // "checking" while reviewing, otherwise "action_required".
    expect(SRC).toMatch(/overall:\s*isDecided \? app\.status : \(isReviewing \? 'checking' : 'action_required'\)/);
  });
});
