/**
 * PR-W34b — coupons admin audit_events coverage.
 *
 * Pre-PR-W34b, coupon admin mutators wrote a domain-specific
 * `coupon_audit_log` row but ZERO `audit_events` rows. The hash-
 * chained `audit_events` table is the canonical legal record;
 * coupon_audit_log is operational. Both must be written for admin
 * forensics to be complete.
 *
 * This test pins the wiring on all 6 admin coupon mutators.
 *
 * Source-pin only.
 */

import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const FILE = path.resolve(__dirname, '..', 'routes', 'coupons.ts');
const text = fs.readFileSync(FILE, 'utf8');

describe('PR-W34b — coupons admin audit coverage', () => {
  it('imports logAuditEvent from middleware/auditLog', () => {
    expect(text).toMatch(/import\s*\{\s*logAuditEvent\s*\}\s*from\s*['"]\.\.\/middleware\/auditLog['"]/);
  });

  it('defines a local emitCouponAudit wrapper', () => {
    expect(text).toMatch(/function emitCouponAudit\s*\(/);
  });

  it('emitCouponAudit fires fire-and-forget via setImmediate', () => {
    const idx = text.indexOf('function emitCouponAudit');
    const block = text.slice(idx, idx + 1500);
    expect(block).toMatch(/setImmediate\s*\(/);
    expect(block).toMatch(/targetType:\s*['"]coupon['"]/);
    expect(block).toMatch(/actorRole:\s*['"]admin['"]/);
  });

  describe('every admin mutating handler emits an audit event', () => {
    function sliceHandler(method: 'post' | 'patch', routePath: string): string {
      const idx = text.indexOf(`adminCouponRouter.${method}('${routePath}'`);
      if (idx < 0) throw new Error(`adminCouponRouter.${method} ${routePath} not found`);
      const next = text.indexOf('\nadminCouponRouter.', idx + 10);
      return next > 0 ? text.slice(idx, next) : text.slice(idx, idx + 3000);
    }

    it('POST / → COUPON_CREATE', () => {
      const block = sliceHandler('post', '/');
      expect(block).toMatch(/emitCouponAudit\s*\(/);
      expect(block).toMatch(/actionType:\s*['"]COUPON_CREATE['"]/);
    });

    it('PATCH /:id → COUPON_UPDATE', () => {
      const block = sliceHandler('patch', '/:id');
      expect(block).toMatch(/emitCouponAudit\s*\(/);
      expect(block).toMatch(/actionType:\s*['"]COUPON_UPDATE['"]/);
    });

    it('POST /:id/deactivate → COUPON_DEACTIVATE (with reason)', () => {
      const block = sliceHandler('post', '/:id/deactivate');
      expect(block).toMatch(/emitCouponAudit\s*\(/);
      expect(block).toMatch(/actionType:\s*['"]COUPON_DEACTIVATE['"]/);
      expect(block).toMatch(/reason:/);
    });

    it('POST /:id/clone → COUPON_CLONE (with sourceCouponId)', () => {
      const block = sliceHandler('post', '/:id/clone');
      expect(block).toMatch(/emitCouponAudit\s*\(/);
      expect(block).toMatch(/actionType:\s*['"]COUPON_CLONE['"]/);
      expect(block).toMatch(/sourceCouponId/);
    });

    it('POST /:id/issue-to-user → COUPON_ISSUE_TO_USER (with targetUserId)', () => {
      const block = sliceHandler('post', '/:id/issue-to-user');
      expect(block).toMatch(/emitCouponAudit\s*\(/);
      expect(block).toMatch(/actionType:\s*['"]COUPON_ISSUE_TO_USER['"]/);
      expect(block).toMatch(/targetUserId/);
    });

    it('POST /restore/:id → COUPON_RESTORE_REDEMPTION', () => {
      const block = sliceHandler('post', '/restore/:id');
      expect(block).toMatch(/emitCouponAudit\s*\(/);
      expect(block).toMatch(/actionType:\s*['"]COUPON_RESTORE_REDEMPTION['"]/);
    });
  });

  describe('domain coupon_audit_log writes preserved (operational)', () => {
    // PR-W34b adds canonical audit_events on top of coupon_audit_log.
    // The domain log MUST stay so existing per-coupon audit-log readers
    // keep working.
    it('coupon_audit_log INSERT still happens on create', () => {
      expect(text).toMatch(/INSERT INTO coupon_audit_log[\s\S]*?'created'/);
    });
    it('coupon_audit_log INSERT still happens on update', () => {
      expect(text).toMatch(/INSERT INTO coupon_audit_log[\s\S]*?'updated'/);
    });
  });

  describe('read-only endpoints do NOT emit audit events', () => {
    it('GET /audit-log has no emitCouponAudit', () => {
      const idx = text.indexOf("adminCouponRouter.get('/audit-log'");
      const next = text.indexOf('\nadminCouponRouter.', idx + 10);
      const block = next > 0 ? text.slice(idx, next) : text.slice(idx, idx + 1500);
      expect(block).not.toMatch(/emitCouponAudit\s*\(/);
    });

    it('GET / (list) has no emitCouponAudit', () => {
      const idx = text.indexOf("adminCouponRouter.get('/'");
      const next = text.indexOf('\nadminCouponRouter.', idx + 10);
      const block = text.slice(idx, next);
      expect(block).not.toMatch(/emitCouponAudit\s*\(/);
    });
  });
});
