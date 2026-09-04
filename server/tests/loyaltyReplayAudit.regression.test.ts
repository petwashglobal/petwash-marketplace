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

describe('race window is CLOSED at the storage layer (was audit-only flag)', () => {
  // History: this block used to ASSERT THE ABSENCE of a unique constraint and
  // said "if a future PR adds one, this test breaks and the audit comment can
  // be updated to remove the race caveat". Item 222 (2026-08-18, MONEY-CODE)
  // added it, so the caveat is retired and the pin is inverted: the guard must
  // now stay present.
  //
  // Callers dedupe with SELECT-then-INSERT on (userId, source, sourceId), which
  // races under concurrent webhook retries. The partial unique index makes
  // exactly-once a DB-enforced property rather than a caller convention.
  it('pointsTransactions HAS a partial unique index on (userId, source, sourceId)', () => {
    const schema = R('../shared/schema-loyalty.ts');
    const start = schema.indexOf("pointsTransactions = pgTable('points_transactions'");
    expect(start).toBeGreaterThan(-1);
    const end   = schema.indexOf('}));', start);
    const region = schema.slice(start, end);
    expect(region).toMatch(/uniqueIndex\('points_transactions_user_source_ref_uniq_idx'\)/);
    expect(region).toMatch(/\.on\(table\.userId, table\.source, table\.sourceId\)/);
    // Partial: bonus events with no stable ref (NULL source_id) stay unconstrained,
    // otherwise a second ref-less bonus for the same user would be rejected.
    expect(region).toMatch(/IS NOT NULL/);
  });
});
