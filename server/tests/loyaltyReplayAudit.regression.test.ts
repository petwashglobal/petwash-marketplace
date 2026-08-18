/**
 * Task 27 — CEO fire order 101-140.
 *
 * LOYALTY POINT REPLAY audit — money-adjacent (points have redemption
 * value in wash-package purchases + Prestige rewards).
 *
 * Finding: `awardLoyaltyPoints` (server/services/loyaltyEarn.ts:55)
 * has an explicit idempotency guard:
 *
 *   SELECT id FROM points_transactions
 *   WHERE userId=? AND source=? AND sourceId=?
 *   LIMIT 1
 *   if (existing.length) return { awarded: false, skipped: 'duplicate' }
 *
 * A SEQUENTIAL replay of the same (userId, source, sourceId) is
 * correctly deduped. Points balance + tier upgrade + pointsTransactions
 * insert all skip when a prior award exists.
 *
 * Race-window note (flagged for CEO):
 *   points_transactions has NO unique constraint on (userId, source,
 *   sourceId), so two truly-simultaneous webhook retries could each
 *   pass the SELECT and each INSERT. Sequential replay (the common
 *   Nayax retry pattern) is safe. Concurrent replay is not. A future
 *   PR could add a partial unique index; NOT modified here — money-
 *   adjacent, requires explicit CEO approval.
 *
 * NO code change in this PR.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const R = (p: string) => readFileSync(resolve(__dirname, '..', p), 'utf8');

describe('awardLoyaltyPoints has an explicit idempotency guard', () => {
  const SRC = R('services/loyaltyEarn.ts');

  it('SELECTs pointsTransactions by (userId, source, sourceId) BEFORE inserting', () => {
    expect(SRC).toMatch(/from\(pointsTransactions\)/);
    expect(SRC).toMatch(/eq\(pointsTransactions\.userId, userId\)/);
    expect(SRC).toMatch(/eq\(pointsTransactions\.source, source\)/);
    expect(SRC).toMatch(/eq\(pointsTransactions\.sourceId, sourceId\)/);
  });

  it("returns { awarded: false, skipped: 'duplicate' } on hit", () => {
    expect(SRC).toMatch(/skipped:\s*'duplicate'/);
  });

  it('SELECT precedes the profile mutation + pointsTransactions insert', () => {
    const selectAt = SRC.indexOf('.from(pointsTransactions)');
    const updateAt = SRC.indexOf('.update(loyaltyProfiles)');
    const insertAt = SRC.indexOf('.insert(pointsTransactions)');
    expect(selectAt).toBeGreaterThan(-1);
    expect(updateAt).toBeGreaterThan(selectAt);
    expect(insertAt).toBeGreaterThan(selectAt);
  });

  it('the idempotency intent is documented in the function docstring', () => {
    expect(SRC).toContain('Idempotent per (userId, source, sourceId) so a webhook');
    expect(SRC).toContain('never double-award');
  });

  it('zero-amount and missing-userId short-circuit before touching the DB', () => {
    expect(SRC).toMatch(/if \(!userId \|\| amount <= 0\)/);
    expect(SRC).toMatch(/skipped:\s*'zero'/);
  });

  it('missing-profile short-circuit (only enrolled members earn)', () => {
    expect(SRC).toMatch(/if \(!profile\)/);
    expect(SRC).toMatch(/skipped:\s*'no_profile'/);
  });
});

describe('awardLoyaltyPoints — surface stability (money-adjacent)', () => {
  const SRC = R('services/loyaltyEarn.ts');

  it('POINTS_PER_SHEKEL is the repo-wide 1 point per shekel', () => {
    expect(SRC).toMatch(/POINTS_PER_SHEKEL = 1;/);
    expect(SRC).toMatch(/1 point per ₪1/);
  });

  it('pointsForSpend floors and clamps to non-negative', () => {
    expect(SRC).toMatch(/Math\.floor\(Math\.max\(0, Number\(shekels\) \|\| 0\) \* POINTS_PER_SHEKEL\)/);
  });

  it('tier upgrade calls detectTierUpgrade with old vs new lifetime totals', () => {
    expect(SRC).toMatch(/detectTierUpgrade\(profile\.lifetimePoints, newLifetime\)/);
  });
});

describe('race-window flag (audit-only)', () => {
  it('pointsTransactions has NO unique constraint on (userId, source, sourceId)', () => {
    const schema = R('../shared/schema-loyalty.ts');
    // The current declaration has no `.unique()` on sourceId + no composite
    // index. If a future PR adds one, this test breaks and the audit
    // comment above can be updated to remove the race caveat.
    const start = schema.indexOf("pointsTransactions = pgTable('points_transactions'");
    const end   = schema.indexOf('});', start);
    const region = schema.slice(start, end);
    expect(region).not.toMatch(/\.unique\(\)/);
    expect(region).not.toMatch(/uniqueIndex/);
  });
});
