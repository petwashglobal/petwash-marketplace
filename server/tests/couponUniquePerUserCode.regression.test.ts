/**
 * Coupon engine integrity + unique-per-user codes (CEO-approved 2026-06-24).
 *
 * Builds on the CANONICAL CouponService (never the dead ShopService/globalPromotions
 * duplicates). Guards: the migration that makes the phantom tables real + adds the
 * unique per-user code, and the anti-spread enforcement in validateCoupon.
 * Source-introspection (DB/runtime-bound), per repo convention.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

const ROOT = resolve(__dirname, '..', '..');
const svc = readFileSync(resolve(ROOT, 'server/services/CouponService.ts'), 'utf8');
const mig = resolve(ROOT, 'migrations/0075_coupon_engine_integrity.sql');

describe('coupon engine integrity + unique-per-user code', () => {
  it('migration 0075 exists and is idempotent (IF NOT EXISTS)', () => {
    expect(existsSync(mig)).toBe(true);
    const sql = readFileSync(mig, 'utf8');
    expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS coupon_issuances/);
    expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS coupon_validation_attempts/);
    expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS coupon_audit_log/);
    expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS kiosk_coupon_tokens/);
  });

  it('migration adds the unique per-user code column + unique index', () => {
    const sql = readFileSync(mig, 'utf8');
    expect(sql).toMatch(/ALTER TABLE coupon_issuances ADD COLUMN IF NOT EXISTS code/);
    expect(sql).toMatch(/CREATE UNIQUE INDEX IF NOT EXISTS uq_coupon_issuances_code/);
  });

  it('issueToUser mints a unique per-user code and returns it', () => {
    expect(svc).toMatch(/genIssuanceCode\(/);
    expect(svc).toMatch(/INSERT INTO coupon_issuances \(coupon_id, user_id, issued_by_admin, expires_at, code\)/);
    expect(svc).toMatch(/Promise<\{ issuanceId: number; code: string \| null \}>/);
  });

  it('validateCoupon resolves a per-user code AND blocks a shared/stolen one (anti-spread + fraud log)', () => {
    expect(svc).toMatch(/SELECT \* FROM coupon_issuances WHERE code = \$1/);
    expect(svc).toMatch(/String\(iss\.user_id\) !== String\(userId\)/);
    expect(svc).toMatch(/errorCode: 'CODE_NOT_YOURS'/);
    expect(svc).toMatch(/result: 'blocked', errorCode: 'CODE_NOT_YOURS'/); // fraud-logged
  });

  it('a resolved per-user issuance binds the redemption (no re-lookup needed)', () => {
    expect(svc).toMatch(/let issuanceId: number \| undefined = boundIssuanceId/);
    expect(svc).toMatch(/couponType === 'issued' && !issuanceId/);
  });
});
