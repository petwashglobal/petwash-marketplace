/**
 * PR-REVIEWS-DELETE-DEAD-HELPER — regression pin for the removal of the
 * dead updateContractorTrustScore helper from server/routes/reviews.ts.
 *
 * The singular updateContractorTrustScore lived at reviews.ts:625 for
 * ~100 lines but had zero call-sites — all live callers use the
 * PLURAL updateContractorTrustScoreS from server/services/trustScoring.ts.
 * Dead code confused readers and duplicated the trust-score formula.
 */

import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const REVIEWS = fs.readFileSync(
  path.resolve(__dirname, '../routes/reviews.ts'),
  'utf8',
);
const TRUST = fs.readFileSync(
  path.resolve(__dirname, '../services/trustScoring.ts'),
  'utf8',
);

describe('reviews.ts — dead updateContractorTrustScore helper removed', () => {
  it('the singular helper is gone from reviews.ts', () => {
    expect(REVIEWS).not.toMatch(/async function updateContractorTrustScore\s*\(/);
  });

  it('the canonical PLURAL helper still exists in trustScoring.ts', () => {
    expect(TRUST).toMatch(/export async function updateContractorTrustScores\s*\(/);
  });

  it('the trust-score GET handler still works (not accidentally deleted)', () => {
    expect(REVIEWS).toMatch(/router\.get\('\/trust-score\/:contractorId'/);
  });
});
