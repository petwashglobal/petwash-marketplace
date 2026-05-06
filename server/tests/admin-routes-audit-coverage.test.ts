/**
 * PR-W34f — admin.ts admin audit_events coverage.
 *
 * 14 mutators wired:
 *   POST   /broadcast/users                  BROADCAST_USERS
 *   POST   /broadcast/franchises             BROADCAST_FRANCHISES
 *   POST   /campaigns                        CAMPAIGN_CREATE
 *   POST   /campaigns/:id/start              CAMPAIGN_START
 *   POST   /campaigns/:id/stop               CAMPAIGN_STOP
 *   PATCH  /campaigns/:id/metrics            CAMPAIGN_METRICS_UPDATE
 *   POST   /marketing/assets                 MARKETING_ASSET_UPLOAD
 *   POST   /test/vaccine-reminder            TEST_VACCINE_REMINDER
 *   POST   /ceo/request-voucher              CEO_REQUEST_VOUCHER
 *   POST   /ceo/issue-free-voucher           CEO_ISSUE_FREE_VOUCHER
 *   POST   /security/platform-monitor/scan   SECURITY_PLATFORM_SCAN_FORCE
 *   POST   /sms/kill-switch/clear            SMS_KILL_SWITCH_CLEAR
 *   POST   /financial-check                  FINANCIAL_CHECK_RUN
 *   POST   /sms/kill-switch/activate         SMS_KILL_SWITCH_ACTIVATE
 *
 * Source-pin only.
 */

import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const FILE = path.resolve(__dirname, '..', 'routes', 'admin.ts');
const text = fs.readFileSync(FILE, 'utf8');

describe('PR-W34f — admin.ts admin audit coverage', () => {
  it('imports logAuditEvent', () => {
    expect(text).toMatch(/import\s*\{\s*logAuditEvent\s*\}\s*from\s*['"]\.\.\/middleware\/auditLog['"]/);
  });

  it('declares emitAdminAudit wrapper with setImmediate', () => {
    const idx = text.indexOf('function emitAdminAudit');
    expect(idx).toBeGreaterThan(0);
    const block = text.slice(idx, idx + 1500);
    expect(block).toMatch(/setImmediate\s*\(/);
    expect(block).toMatch(/actorRole:\s*['"]admin['"]/);
  });

  describe('14 mutators emit audit events', () => {
    function sliceHandler(method: 'post' | 'patch', routePath: string): string {
      const idx = text.indexOf(`router.${method}('${routePath}'`);
      if (idx < 0) throw new Error(`router.${method} ${routePath} not found`);
      const next = text.indexOf('\nrouter.', idx + 10);
      return next > 0 ? text.slice(idx, next) : text.slice(idx, idx + 8000);
    }

    function assertAudit(handler: string, action: string) {
      expect(handler, `${action}: emitAdminAudit missing`).toMatch(/emitAdminAudit\s*\(/);
      expect(handler, `${action}: actionType missing`).toMatch(
        new RegExp(`actionType:\\s*['"]${action}['"]`),
      );
    }

    it('POST /broadcast/users → BROADCAST_USERS', () => {
      assertAudit(sliceHandler('post', '/broadcast/users'), 'BROADCAST_USERS');
    });
    it('POST /broadcast/franchises → BROADCAST_FRANCHISES', () => {
      assertAudit(sliceHandler('post', '/broadcast/franchises'), 'BROADCAST_FRANCHISES');
    });
    it('POST /campaigns → CAMPAIGN_CREATE', () => {
      assertAudit(sliceHandler('post', '/campaigns'), 'CAMPAIGN_CREATE');
    });
    it('POST /campaigns/:id/start → CAMPAIGN_START', () => {
      assertAudit(sliceHandler('post', '/campaigns/:campaignId/start'), 'CAMPAIGN_START');
    });
    it('POST /campaigns/:id/stop → CAMPAIGN_STOP', () => {
      assertAudit(sliceHandler('post', '/campaigns/:campaignId/stop'), 'CAMPAIGN_STOP');
    });
    it('PATCH /campaigns/:id/metrics → CAMPAIGN_METRICS_UPDATE', () => {
      assertAudit(sliceHandler('patch', '/campaigns/:campaignId/metrics'), 'CAMPAIGN_METRICS_UPDATE');
    });
    it('POST /marketing/assets → MARKETING_ASSET_UPLOAD', () => {
      assertAudit(sliceHandler('post', '/marketing/assets'), 'MARKETING_ASSET_UPLOAD');
    });
    it('POST /test/vaccine-reminder → TEST_VACCINE_REMINDER', () => {
      assertAudit(sliceHandler('post', '/test/vaccine-reminder'), 'TEST_VACCINE_REMINDER');
    });
    it('POST /ceo/request-voucher → CEO_REQUEST_VOUCHER', () => {
      assertAudit(sliceHandler('post', '/ceo/request-voucher'), 'CEO_REQUEST_VOUCHER');
    });
    it('POST /ceo/issue-free-voucher → CEO_ISSUE_FREE_VOUCHER', () => {
      assertAudit(sliceHandler('post', '/ceo/issue-free-voucher'), 'CEO_ISSUE_FREE_VOUCHER');
    });
    it('POST /security/platform-monitor/scan → SECURITY_PLATFORM_SCAN_FORCE', () => {
      assertAudit(sliceHandler('post', '/security/platform-monitor/scan'), 'SECURITY_PLATFORM_SCAN_FORCE');
    });
    it('POST /sms/kill-switch/clear → SMS_KILL_SWITCH_CLEAR', () => {
      assertAudit(sliceHandler('post', '/sms/kill-switch/clear'), 'SMS_KILL_SWITCH_CLEAR');
    });
    it('POST /financial-check → FINANCIAL_CHECK_RUN', () => {
      assertAudit(sliceHandler('post', '/financial-check'), 'FINANCIAL_CHECK_RUN');
    });
    it('POST /sms/kill-switch/activate → SMS_KILL_SWITCH_ACTIVATE', () => {
      assertAudit(sliceHandler('post', '/sms/kill-switch/activate'), 'SMS_KILL_SWITCH_ACTIVATE');
    });
  });

  describe('CEO endpoints never log secrets', () => {
    function sliceHandler(routePath: string): string {
      const idx = text.indexOf(`router.post('${routePath}'`);
      const next = text.indexOf('\nrouter.', idx + 10);
      return text.slice(idx, next);
    }

    it('CEO_REQUEST_VOUCHER does NOT include verificationCode in metadata', () => {
      const block = sliceHandler('/ceo/request-voucher');
      const auditIdx = block.indexOf('emitAdminAudit');
      expect(auditIdx).toBeGreaterThan(0);
      // The emitAdminAudit metadata must omit the verification code.
      // We grep the metadata block for the word.
      const auditBlock = block.slice(auditIdx, auditIdx + 1200);
      expect(auditBlock).not.toMatch(/verificationCode:/);
    });

    it('CEO_ISSUE_FREE_VOUCHER includes only codeLast4, not full code', () => {
      const block = sliceHandler('/ceo/issue-free-voucher');
      const auditIdx = block.indexOf('emitAdminAudit');
      const auditBlock = block.slice(auditIdx, auditIdx + 1500);
      expect(auditBlock).toMatch(/codeLast4:/);
      // Full voucher code in metadata would be a leak. Make sure the
      // unqualified `code:` key isn't in the metadata block.
      expect(auditBlock).not.toMatch(/\bcode:\s*code\b/);
    });
  });

  describe('read-only endpoints emit no audit events', () => {
    function sliceHandler(method: 'get', routePath: string): string {
      const idx = text.indexOf(`router.${method}('${routePath}'`);
      if (idx < 0) return '';
      const next = text.indexOf('\nrouter.', idx + 10);
      return next > 0 ? text.slice(idx, next) : text.slice(idx, idx + 1500);
    }

    it('GET /campaigns has no emitAdminAudit', () => {
      const block = sliceHandler('get', '/campaigns');
      expect(block).not.toMatch(/emitAdminAudit\s*\(/);
    });
    it('GET /security/email-guard has no emitAdminAudit', () => {
      const block = sliceHandler('get', '/security/email-guard');
      expect(block).not.toMatch(/emitAdminAudit\s*\(/);
    });
    it('GET /wallet/orphan-egift-customers has no emitAdminAudit (PR-W12 read-only)', () => {
      const block = sliceHandler('get', '/wallet/orphan-egift-customers');
      expect(block).not.toMatch(/emitAdminAudit\s*\(/);
    });
  });
});
