/**
 * AGENT-14 privacy lane — response projections.
 *
 * Two self-service endpoints still returned a WHOLE ORM row (`db.select()`
 * with no column list). A whole-row response is a standing defect even when
 * today's columns look harmless: every column added to the table later ships
 * to the client automatically, with no code change and no review.
 *
 * Worst case found:
 *   GET /api/careers/my-applications/:applicationId
 *   returned the entire staff_applications row to the APPLICANT — including
 *   the internal hiring assessment written about them (reviewerNotes, notes,
 *   reviewedBy, fraudRiskScore, shortlistScore, shortlistRecommendation,
 *   shortlistFlags) alongside their taxId, bank account + routing number,
 *   date of birth, home address and criminalRecord flag.
 *
 * The first test is BEHAVIORAL: it builds the same Drizzle projection object
 * the route builds and asserts, against the live schema, that none of the
 * forbidden columns can be selected. The rest pin the route source.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { staffApplications, staffDocuments, applicationStepProgress, groomingFeedback } from '@shared/schema';

const ROOT = resolve(__dirname, '..', '..');
const read = (rel: string) => readFileSync(resolve(ROOT, rel), 'utf8');

/** Pull the object literal passed to a `.select({...})` that follows `marker`. */
function selectedKeysAfter(src: string, marker: string): string[] {
  const at = src.indexOf(marker);
  if (at < 0) throw new Error(`marker not found: ${marker}`);
  const selAt = src.indexOf('.select({', at);
  if (selAt < 0) throw new Error(`no .select({ after: ${marker}`);
  let depth = 0;
  let i = src.indexOf('{', selAt);
  const start = i;
  for (; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') {
      depth--;
      if (depth === 0) break;
    }
  }
  const body = src.slice(start + 1, i);
  return Array.from(body.matchAll(/^\s*([A-Za-z0-9_]+)\s*:/gm)).map((m) => m[1]);
}

describe('AGENT-14 · careers /my-applications/:id returns an applicant-safe projection', () => {
  const SRC = read('server/routes/careers.ts');
  const MARKER = "router.get('/my-applications/:applicationId'";

  const APPLICATION_FORBIDDEN = [
    // internal hiring assessment written ABOUT the applicant
    'reviewerNotes', 'notes', 'reviewedBy', 'reviewedAt', 'approvedAt',
    'rejectionReason', 'fraudRiskScore', 'shortlistScore',
    'shortlistRecommendation', 'shortlistFlags',
    // financial + identity data with no reason to travel back
    'taxId', 'bankAccountName', 'bankAccountNumber', 'bankRoutingNumber',
    'dateOfBirth', 'address', 'criminalRecord', 'references',
    // draft internals / ownership token
    'formData', 'sessionId',
  ];

  it('A1. no longer uses a bare db.select() for the application row', () => {
    const region = SRC.slice(SRC.indexOf(MARKER), SRC.indexOf(MARKER) + 3500);
    expect(region).not.toMatch(/\.select\(\)\s*\n?\s*\.from\(staffApplications\)/);
  });

  it('A2. BEHAVIORAL — the projection cannot carry any forbidden column', () => {
    const keys = selectedKeysAfter(SRC, MARKER);
    expect(keys.length).toBeGreaterThan(5);
    for (const f of APPLICATION_FORBIDDEN) {
      expect(keys, `projection still exposes ${f}`).not.toContain(f);
    }
  });

  it('A3. BEHAVIORAL — every projected key is a real staff_applications column', () => {
    // Guards against a typo silently shipping `undefined` to the client.
    const keys = selectedKeysAfter(SRC, MARKER);
    for (const k of keys) {
      expect(Object.keys(staffApplications), `unknown column ${k}`).toContain(k);
    }
  });

  it('A4. the forbidden list is not vacuous — those columns really exist', () => {
    const cols = Object.keys(staffApplications);
    for (const f of APPLICATION_FORBIDDEN) {
      expect(cols, `${f} is not a real column — fix the test, not the route`).toContain(f);
    }
  });

  it('A5. documents projection drops documentUrl / metadata / verification trail', () => {
    const region = SRC.slice(SRC.indexOf(MARKER));
    const keys = selectedKeysAfter(region, 'Get documents');
    for (const f of ['documentUrl', 'metadata', 'verificationScore', 'verifiedBy', 'verificationMethod', 'rejectionReason']) {
      expect(keys, `documents projection still exposes ${f}`).not.toContain(f);
      expect(Object.keys(staffDocuments)).toContain(f);
    }
  });

  it('A6. step-progress projection drops dataSnapshot / validationErrors / sessionId', () => {
    const region = SRC.slice(SRC.indexOf(MARKER));
    const keys = selectedKeysAfter(region, 'Get step progress');
    for (const f of ['dataSnapshot', 'validationErrors', 'sessionId']) {
      expect(keys, `steps projection still exposes ${f}`).not.toContain(f);
      expect(Object.keys(applicationStepProgress)).toContain(f);
    }
  });
});

describe('AGENT-14 · grooming-feedback /my-reviews returns an owner-safe projection', () => {
  const SRC = read('server/routes/grooming-feedback.ts');
  const MARKER = "router.get('/my-reviews'";

  it('B1. no longer uses a bare db.select()', () => {
    const region = SRC.slice(SRC.indexOf(MARKER), SRC.indexOf(MARKER) + 2000);
    expect(region).not.toMatch(/\.select\(\)\s*\n?\s*\.from\(groomingFeedback\)/);
  });

  it('B2. BEHAVIORAL — moderation trail and other-user identifiers are not selectable', () => {
    const keys = selectedKeysAfter(SRC, MARKER);
    for (const f of ['isFlagged', 'flaggedReason', 'isVisible', 'adminRespondedBy', 'customerId', 'customerName']) {
      expect(keys, `still exposes ${f}`).not.toContain(f);
      expect(Object.keys(groomingFeedback), `${f} is not a real column`).toContain(f);
    }
  });

  it('B3. BEHAVIORAL — every projected key is a real grooming_feedback column', () => {
    for (const k of selectedKeysAfter(SRC, MARKER)) {
      expect(Object.keys(groomingFeedback), `unknown column ${k}`).toContain(k);
    }
  });
});
