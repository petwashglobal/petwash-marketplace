/**
 * Redeem-path audit — regression pins for R2, R5, R8 (2026-08-01).
 *
 * Three verified money bugs on the redeem rails, each fixed to be atomic +
 * fail-closed. These pins fail loudly if a refactor reintroduces the split
 * commit, drops an idempotency key, or loosens a uniqueness guard.
 *
 *  R2 — coupon "confirmed but not redeemed" split-commit. The token/reservation
 *       flip to 'confirmed' and CouponService.redeemAtomic ran in SEPARATE
 *       transactions; if redeemAtomic threw, the token stayed 'confirmed' with
 *       no redemption and a retry returned a false success (redemptionId:0).
 *  R5 — loyalty reward redeem had no idempotency key, so a double-submit minted
 *       two REWARD-* vouchers and debited points twice.
 *  R8 — loyalty earn/reverse deduped with a lockless SELECT and split the
 *       balance UPDATE from the ledger INSERT; parallel retries could
 *       double-award and a mid-way crash left points with no audit row.
 *
 * Executable unit tests cover the pure idempotency-key helper; the rest are
 * source-pins (no DB needed), matching the money-suite convention.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';
import { deriveLoyaltyRedeemIdempotencyKey, LOYALTY_REDEEM_KEY_MAXLEN } from '../lib/loyalty-redeem-idempotency';

const root = path.resolve(__dirname, '..', '..');
const read = (rel: string) => fs.readFileSync(path.resolve(root, rel), 'utf8');

const COUPON_SVC = read('server/services/CouponService.ts');
const KIOSK_SVC = read('server/services/KioskCouponService.ts');
const PRICING_SVC = read('server/services/UnifiedPricingService.ts');
const LOYALTY_ROUTE = read('server/routes/loyalty.ts');
const LOYALTY_EARN = read('server/services/loyaltyEarn.ts');
const SCHEMA_LOYALTY = read('shared/schema-loyalty.ts');
const MIG_0114 = read('migrations/0114_loyalty_points_txn_type_unique.sql');
const MIG_0115 = read('migrations/0115_user_redemptions_idempotency.sql');

// ───────────────────────── R2 ─────────────────────────
describe('R2 — coupon confirm consumes the coupon in the SAME transaction', () => {
  it('CouponService exposes redeemAtomicInTx(client, …) for caller-owned transactions', () => {
    expect(COUPON_SVC).toMatch(/async redeemAtomicInTx\(\s*client: PoolClient,/);
    // The public redeemAtomic is now a thin wrapper that delegates to it.
    expect(COUPON_SVC).toContain('await this.redeemAtomicInTx(client, input)');
  });

  it('redeemAtomicInTx does its own NO transaction management (caller owns BEGIN/COMMIT)', () => {
    const start = COUPON_SVC.indexOf('async redeemAtomicInTx(');
    const end = COUPON_SVC.indexOf('async redeemAtomic(', start);
    const body = COUPON_SVC.slice(start, end);
    // A throw here must bubble to the caller's rollback — no local BEGIN/COMMIT,
    // and the idempotency short-circuit must NOT roll back the caller's tx.
    expect(body).not.toMatch(/BEGIN/);
    expect(body).not.toMatch(/COMMIT/);
    expect(body).not.toMatch(/ROLLBACK/);
  });

  it('KioskCouponService.confirmToken flips → redeems → guards → COMMITs, all in one tx', () => {
    // Old split-commit shape (object-literal redeemAtomic call) must be gone.
    expect(KIOSK_SVC).not.toMatch(/redeemAtomic\(\{/);
    expect(KIOSK_SVC).toContain('couponService.redeemAtomicInTx(client, {');

    const idxFlip = KIOSK_SVC.indexOf("status = 'confirmed', confirmed_at = NOW(), session_id");
    const idxRedeem = KIOSK_SVC.indexOf('redeemAtomicInTx(client', idxFlip);
    const idxGuard = KIOSK_SVC.indexOf('if (!result.redemptionId)', idxRedeem);
    const idxCommit = KIOSK_SVC.indexOf("client.query('COMMIT')", idxFlip);

    expect(idxFlip).toBeGreaterThan(-1);
    // flip → redeem → fail-closed guard → COMMIT (no COMMIT between flip & redeem)
    expect(idxFlip).toBeLessThan(idxRedeem);
    expect(idxRedeem).toBeLessThan(idxGuard);
    expect(idxGuard).toBeLessThan(idxCommit);
  });

  it('UnifiedPricingService.confirmReservation flips → redeems → guards → COMMITs, all in one tx', () => {
    expect(PRICING_SVC).not.toMatch(/redeemAtomic\(\{/);
    expect(PRICING_SVC).toContain('couponService.redeemAtomicInTx(client, {');

    const idxFlip = PRICING_SVC.indexOf("status = 'confirmed', confirmed_at = NOW(), order_id");
    const idxRedeem = PRICING_SVC.indexOf('redeemAtomicInTx(client', idxFlip);
    const idxGuard = PRICING_SVC.indexOf('if (!result.redemptionId)', idxRedeem);
    const idxCommit = PRICING_SVC.indexOf("client.query('COMMIT')", idxFlip);

    expect(idxFlip).toBeGreaterThan(-1);
    expect(idxFlip).toBeLessThan(idxRedeem);
    expect(idxRedeem).toBeLessThan(idxGuard);
    expect(idxGuard).toBeLessThan(idxCommit);
  });
});

// ───────────────────────── R5 ─────────────────────────
describe('R5 — loyalty redeem idempotency key (pure helper)', () => {
  it('namespaces under loyalty:redeem:{userId}:{rewardId}:{clientReqId}', () => {
    expect(deriveLoyaltyRedeemIdempotencyKey('u1', 42, 'req-abc')).toBe('loyalty:redeem:u1:42:req-abc');
  });

  it('returns null when the client supplied no stable request id', () => {
    expect(deriveLoyaltyRedeemIdempotencyKey('u1', 42, null)).toBeNull();
    expect(deriveLoyaltyRedeemIdempotencyKey('u1', 42, undefined)).toBeNull();
    expect(deriveLoyaltyRedeemIdempotencyKey('u1', 42, '')).toBeNull();
    expect(deriveLoyaltyRedeemIdempotencyKey('u1', 42, '   ')).toBeNull();
  });

  it('trims surrounding whitespace on the client id', () => {
    expect(deriveLoyaltyRedeemIdempotencyKey('u1', 42, '  req-abc  ')).toBe('loyalty:redeem:u1:42:req-abc');
  });

  it('is bound to (user, reward) — same id under a different user/reward is a DIFFERENT key', () => {
    const a = deriveLoyaltyRedeemIdempotencyKey('u1', 42, 'same');
    const b = deriveLoyaltyRedeemIdempotencyKey('u2', 42, 'same');
    const c = deriveLoyaltyRedeemIdempotencyKey('u1', 99, 'same');
    expect(a).not.toEqual(b);
    expect(a).not.toEqual(c);
  });

  it('is deterministic — identical inputs produce identical keys (so a retry de-dupes)', () => {
    expect(deriveLoyaltyRedeemIdempotencyKey('u1', 42, 'req-abc'))
      .toEqual(deriveLoyaltyRedeemIdempotencyKey('u1', 42, 'req-abc'));
  });

  it('never exceeds the idempotency_key column width', () => {
    const key = deriveLoyaltyRedeemIdempotencyKey('u'.repeat(300), 42, 'r'.repeat(300));
    expect(key!.length).toBeLessThanOrEqual(LOYALTY_REDEEM_KEY_MAXLEN);
  });
});

describe('R5 — loyalty redeem route wires the idempotency guard', () => {
  it('derives the key from the client request id (header or body)', () => {
    expect(LOYALTY_ROUTE).toContain("req.get('Idempotency-Key')");
    expect(LOYALTY_ROUTE).toContain('deriveLoyaltyRedeemIdempotencyKey(userId, rewardId, clientReqId)');
  });

  it('short-circuits to the prior redemption instead of re-minting', () => {
    expect(LOYALTY_ROUTE).toMatch(/idempotent: true/);
    expect(LOYALTY_ROUTE).toContain('eq(userRedemptions.idempotencyKey, idempotencyKey)');
  });

  it('persists the key on the voucher and treats a 23505 race as an idempotent replay', () => {
    expect(LOYALTY_ROUTE).toContain('idempotencyKey: idempotencyKey ?? undefined');
    expect(LOYALTY_ROUTE).toContain("txErr?.code === '23505'");
  });

  it('debits points with a RELATIVE decrement (no stale-read absolute) and logs the redemption id', () => {
    expect(LOYALTY_ROUTE).toContain('points: sql`${loyaltyProfiles.points} - ${reward.pointsCost}`');
    // ledger sourceId is the unique redemption id, so the points_transactions
    // uniqueness guard never blocks a legitimate repeat redeem of one reward.
    expect(LOYALTY_ROUTE).toContain('sourceId: inserted.id.toString()');
  });

  it('migration 0115 adds the column and a partial unique index', () => {
    expect(MIG_0115).toMatch(/ADD COLUMN IF NOT EXISTS idempotency_key/);
    expect(MIG_0115).toMatch(/CREATE UNIQUE INDEX IF NOT EXISTS user_redemptions_idempotency_key_uq/);
    expect(MIG_0115).toMatch(/WHERE idempotency_key IS NOT NULL/);
  });

  it('schema declares the column + unique index', () => {
    expect(SCHEMA_LOYALTY).toMatch(/idempotencyKey: varchar\('idempotency_key'/);
    expect(SCHEMA_LOYALTY).toContain("uniqueIndex('user_redemptions_idempotency_key_uq')");
  });
});

// ───────────────────────── R8 ─────────────────────────
describe('R8 — loyalty earn/reverse are one transaction with a type-aware unique index', () => {
  it('award writes the ledger row BEFORE moving the balance, inside one transaction', () => {
    const start = LOYALTY_EARN.indexOf('export async function awardLoyaltyPoints');
    const end = LOYALTY_EARN.indexOf('export interface ReversePointsInput');
    const body = LOYALTY_EARN.slice(start, end);

    expect(body).toContain('await db.transaction(async (tx) => {');
    const idxInsert = body.indexOf('tx.insert(pointsTransactions)');
    const idxUpdate = body.indexOf('tx\n        .update(loyaltyProfiles)') >= 0
      ? body.indexOf('tx\n        .update(loyaltyProfiles)')
      : body.indexOf('.update(loyaltyProfiles)');
    expect(idxInsert).toBeGreaterThan(-1);
    expect(idxUpdate).toBeGreaterThan(-1);
    expect(idxInsert).toBeLessThan(idxUpdate); // insert-first: index trips before points move
    // relative increment, not a stale-read absolute
    expect(body).toContain('points: sql`${loyaltyProfiles.points} + ${amount}`');
  });

  it('award treats a 23505 unique-violation as a duplicate, never a hard error', () => {
    expect(LOYALTY_EARN).toContain("const PG_UNIQUE_VIOLATION = '23505'");
    expect(LOYALTY_EARN).toMatch(/if \(isUniqueViolation\(err\)\) \{[\s\S]*?skipped: 'duplicate'/);
  });

  it('reverse is one transaction, floors at 0, and reports already_reversed on a race', () => {
    const start = LOYALTY_EARN.indexOf('export async function reverseLoyaltyPoints');
    const body = LOYALTY_EARN.slice(start);
    expect(body).toContain('await db.transaction(async (tx) => {');
    expect(body).toContain('GREATEST(0, ${loyaltyProfiles.points} - ${amount})');
    expect(body).toMatch(/if \(isUniqueViolation\(err\)\) \{[\s\S]*?skipped: 'already_reversed'/);
  });

  it('the fast-path dedup select is scoped to type=earned (so a reversal is not mistaken for the earn)', () => {
    expect(LOYALTY_EARN).toContain("eq(pointsTransactions.type, 'earned')");
  });

  it('migration 0114 makes the ledger uniqueness TYPE-aware and retires the 3-column index', () => {
    expect(MIG_0114).toMatch(
      /CREATE UNIQUE INDEX IF NOT EXISTS points_txn_source_type_uq\s+ON points_transactions \(user_id, source, source_id, type\)/,
    );
    expect(MIG_0114).toMatch(/WHERE source_id IS NOT NULL/);
    // the old too-broad index (which collided earned vs reversed) is dropped
    expect(MIG_0114).toMatch(/DROP INDEX IF EXISTS points_txn_source_uq/);
  });
});
