/**
 * PR-W34d — loyalty admin audit_events coverage.
 *
 * 4 admin-only mutators wired:
 *   POST /points/add           LOYALTY_POINTS_ADD
 *   POST /badges/unlock        LOYALTY_BADGE_UNLOCK
 *   POST /membership/renew     LOYALTY_MEMBERSHIP_RENEW
 *   POST /membership/cancel    LOYALTY_MEMBERSHIP_CANCEL
 *
 * Customer-facing mutators (auto-enroll, /profile, /challenges/claim,
 * /rewards/redeem, /ai-rewards-message) are NOT in scope — they're
 * not admin actions. Their money side is captured by pointsTransactions
 * and userRedemptions; their audit needs are covered by a separate
 * customer-action log if any.
 *
 * Source-pin only.
 */

import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const FILE = path.resolve(__dirname, '..', 'routes', 'loyalty.ts');
const text = fs.readFileSync(FILE, 'utf8');

describe('PR-W34d — loyalty admin audit coverage', () => {
  it('imports logAuditEvent', () => {
    expect(text).toMatch(/import\s*\{\s*logAuditEvent\s*\}\s*from\s*['"]\.\.\/middleware\/auditLog['"]/);
  });

  it('declares emitLoyaltyAdminAudit wrapper with targetType="loyalty_user" and setImmediate', () => {
    const idx = text.indexOf('function emitLoyaltyAdminAudit');
    expect(idx).toBeGreaterThan(0);
    const block = text.slice(idx, idx + 1600);
    expect(block).toMatch(/setImmediate\s*\(/);
    expect(block).toMatch(/targetType:\s*['"]loyalty_user['"]/);
    expect(block).toMatch(/actorRole:\s*['"]admin['"]/);
  });

  describe('the 4 admin handlers each emit an audit event', () => {
    function sliceHandler(routePath: string): string {
      const idx = text.indexOf(`router.post('${routePath}'`);
      if (idx < 0) throw new Error(`route ${routePath} not found`);
      const next = text.indexOf('\nrouter.', idx + 10);
      return next > 0 ? text.slice(idx, next) : text.slice(idx);
    }

    it('POST /points/add → LOYALTY_POINTS_ADD (with amount + tier-upgrade metadata)', () => {
      const block = sliceHandler('/points/add');
      expect(block).toMatch(/emitLoyaltyAdminAudit\s*\(/);
      expect(block).toMatch(/actionType:\s*['"]LOYALTY_POINTS_ADD['"]/);
      expect(block).toMatch(/amount,/);
      expect(block).toMatch(/tierUpgraded:/);
    });

    it('POST /badges/unlock → LOYALTY_BADGE_UNLOCK (with badgeId + rewards)', () => {
      const block = sliceHandler('/badges/unlock');
      expect(block).toMatch(/emitLoyaltyAdminAudit\s*\(/);
      expect(block).toMatch(/actionType:\s*['"]LOYALTY_BADGE_UNLOCK['"]/);
      expect(block).toMatch(/badgeId,/);
      expect(block).toMatch(/pointsReward:/);
    });

    it('POST /membership/renew → LOYALTY_MEMBERSHIP_RENEW (with renewedUntil)', () => {
      const block = sliceHandler('/membership/renew');
      expect(block).toMatch(/emitLoyaltyAdminAudit\s*\(/);
      expect(block).toMatch(/actionType:\s*['"]LOYALTY_MEMBERSHIP_RENEW['"]/);
      expect(block).toMatch(/renewedUntil:/);
    });

    it('POST /membership/cancel → LOYALTY_MEMBERSHIP_CANCEL (with effectiveDate)', () => {
      const block = sliceHandler('/membership/cancel');
      expect(block).toMatch(/emitLoyaltyAdminAudit\s*\(/);
      expect(block).toMatch(/actionType:\s*['"]LOYALTY_MEMBERSHIP_CANCEL['"]/);
      expect(block).toMatch(/effectiveDate:/);
    });
  });

  describe('customer-facing mutators are NOT admin-audited (out of scope)', () => {
    function sliceHandler(routePath: string): string {
      const idx = text.indexOf(`router.post('${routePath}'`);
      if (idx < 0) return '';
      const next = text.indexOf('\nrouter.', idx + 10);
      return next > 0 ? text.slice(idx, next) : text.slice(idx, idx + 4000);
    }

    it('POST /auto-enroll has no emitLoyaltyAdminAudit', () => {
      const block = sliceHandler('/auto-enroll');
      expect(block).not.toMatch(/emitLoyaltyAdminAudit\s*\(/);
    });

    it('POST /challenges/claim has no emitLoyaltyAdminAudit', () => {
      const block = sliceHandler('/challenges/claim');
      expect(block).not.toMatch(/emitLoyaltyAdminAudit\s*\(/);
    });

    it('POST /rewards/redeem has no emitLoyaltyAdminAudit', () => {
      const block = sliceHandler('/rewards/redeem');
      expect(block).not.toMatch(/emitLoyaltyAdminAudit\s*\(/);
    });
  });

  describe('all 4 admin handlers retain requireAdmin gate', () => {
    it('POST /points/add still has requireAdmin', () => {
      expect(text).toMatch(/router\.post\('\/points\/add',\s*requireAdmin/);
    });
    it('POST /badges/unlock still has requireAdmin', () => {
      expect(text).toMatch(/router\.post\('\/badges\/unlock',\s*requireAdmin/);
    });
    it('POST /membership/renew still has requireAdmin', () => {
      expect(text).toMatch(/router\.post\('\/membership\/renew',\s*requireAdmin/);
    });
    it('POST /membership/cancel still has requireAdmin', () => {
      expect(text).toMatch(/router\.post\('\/membership\/cancel',\s*requireAdmin/);
    });
  });
});
