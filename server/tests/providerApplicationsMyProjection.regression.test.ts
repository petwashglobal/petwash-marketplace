/**
 * PR-PROVIDER-APPLICATIONS-MY-PROJECTION — fire-order item 102.
 *
 * GET /api/provider-applications/my previously fetched
 * provider_onboarding_tasks via bare db.select(). That table carries
 *   verifiedBy — admin uid that ticked the task
 *   notes      — internal admin note on the applicant's task
 * Neither belongs on a self-service /my response.
 *
 * Fix: explicit allow-list projection on the tasks query. The
 * primary `application` response was ALREADY manually projected in
 * the res.json({...}) call (only 8 safe fields), and `documents.map`
 * + `backgroundChecks` were already using explicit projections. This
 * PR closes the remaining gap.
 *
 * Ownership: identity source is `req.firebaseUser?.uid` (from the
 * upstream firebase-auth middleware) — never req.query/params/body.
 * WHERE clause is scoped to providerApplicants.userId = uid, with a
 * fallback to providerApplications.userId in the same equality (no
 * email fallback; no verified-email decision needed).
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const ROOT = resolve(__dirname, '..', '..');
const ROUTE = 'server/routes/provider-applications.ts';

function read(rel: string): string { return readFileSync(resolve(ROOT, rel), 'utf8'); }

describe('PR-PROVIDER-APPLICATIONS-MY-PROJECTION', () => {
  const src = read(ROUTE);
  const myBlock = src.match(/router\.get\(\s*['"]\/my['"][\s\S]*?^\}\s*\)\s*;/m)?.[0] || '';

  it('A1. /my handler located (source pins that follow are meaningful)', () => {
    expect(myBlock.length).toBeGreaterThan(0);
  });

  it('A2. tasks query uses explicit projection (no bare db.select() on providerOnboardingTasks)', () => {
    // Pre-fix: `db.select().from(providerOnboardingTasks)` — bare row.
    expect(/db\.select\(\)\s*\n?\s*\.from\(\s*providerOnboardingTasks\s*\)/.test(myBlock)).toBe(false);
    // Post-fix: `db.select({...}).from(providerOnboardingTasks)`.
    expect(/db\.select\(\{[\s\S]*?providerOnboardingTasks\.id[\s\S]*?\}\)\s*\n?\s*\.from\(\s*providerOnboardingTasks\s*\)/.test(myBlock)).toBe(true);
  });

  it('A3. tasks projection is exactly the 11 allow-listed fields', () => {
    const shape = myBlock.match(/db\.select\(\s*(\{[\s\S]*?\})\s*\)\s*\n?\s*\.from\(\s*providerOnboardingTasks\s*\)/)?.[1] || '';
    expect(shape.length).toBeGreaterThan(0);
    const keys = Array.from(shape.matchAll(/^\s*(\w+)\s*:\s*providerOnboardingTasks\./gm)).map(m => m[1]);
    const allowed = new Set([
      'id', 'taskKey', 'taskName', 'taskNameHe', 'description', 'descriptionHe',
      'stage', 'sortOrder', 'isRequired', 'status', 'completedAt',
    ]);
    expect(new Set(keys)).toEqual(allowed);
  });

  it('A4. forbidden task fields (verifiedBy, notes) NOT in the tasks projection', () => {
    const shape = myBlock.match(/db\.select\(\s*(\{[\s\S]*?\})\s*\)\s*\n?\s*\.from\(\s*providerOnboardingTasks\s*\)/)?.[1] || '';
    expect(shape.includes('verifiedBy')).toBe(false);
    expect(shape.includes('providerOnboardingTasks.notes')).toBe(false);
  });

  it('A5. caller identity comes only from req.firebaseUser?.uid, never req.query/params/body', () => {
    // Pre-fix already had this shape but pin it explicitly.
    expect(/const\s+userId\s*=\s*\(req\s+as\s+any\)\.firebaseUser\?\.uid/.test(myBlock)).toBe(true);
    expect(myBlock.includes('req.query')).toBe(false);
    expect(myBlock.includes('req.params')).toBe(false);
    expect(myBlock.includes('req.body')).toBe(false);
    expect(/return\s+res\.status\(\s*401\s*\)/.test(myBlock)).toBe(true);
  });

  it('A6. primary application response projection unchanged (8 safe fields on the res.json)', () => {
    // The pre-existing manual projection at res.json({ application: {…} })
    // is what stops the top-level provider_applicants row (with
    // nationalId, reviewerNotes, invitationToken, etc.) from leaking.
    // Pin the invariant so a future refactor cannot silently widen it.
    expect(/application:\s*\{\s*id:\s*application\.id,\s*stage:\s*application\.stage,\s*status:\s*application\.status,\s*rejectionReason:\s*application\.rejectionReason,\s*submittedAt:\s*application\.submittedAt,\s*lastUpdatedAt:\s*application\.lastUpdatedAt,\s*invitationSentAt:\s*application\.invitationSentAt,\s*onboardingCompletedAt:\s*application\.onboardingCompletedAt\s*\}/.test(myBlock)).toBe(true);
    // Explicit anti-leak: nationalId, reviewerNotes, invitationToken,
    // interviewNotes, interviewScore, riskScore, assignedReviewerId
    // must NOT appear in the handler's response construction.
    // (application.serviceTypes IS used — but only passed to
    // getRequiredDocuments internally, not echoed to the client.)
    for (const forbidden of ['application.nationalId', 'application.reviewerNotes', 'application.invitationToken', 'application.interviewNotes', 'application.interviewScore', 'application.riskScore', 'application.assignedReviewerId', 'application.privacyConsentIp']) {
      expect(myBlock.includes(forbidden)).toBe(false);
    }
  });

  it('A7. documents.map projection stays customer-safe (no fileUrl / verifiedBy / metadata / uploadedBy)', () => {
    // documents.map already projects 6 safe fields. Keep the invariant
    // pinned so a future author can't accidentally add fileUrl (signed
    // storage URL) or verifiedBy (admin uid).
    const docsBlock = myBlock.match(/documents:\s*documents\.map\(\s*d\s*=>\s*\(\s*\{[\s\S]*?\}\s*\)\s*\)/)?.[0] || '';
    expect(docsBlock.length).toBeGreaterThan(0);
    for (const forbidden of ['d.fileUrl', 'd.verifiedBy', 'd.metadata', 'd.uploadedBy']) {
      expect(docsBlock.includes(forbidden)).toBe(false);
    }
  });
});
