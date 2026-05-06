/**
 * PR-W34g — provider-onboarding admin audit_events coverage.
 *
 * 7 admin/support decision mutators wired (the customer-facing
 * mutators /apply, /validate-invite-code, /my/messages are NOT admin
 * actions and are out of scope for PR-W34):
 *
 *   POST /admin/invite-codes/generate                PROVIDER_INVITE_CODE_GENERATE
 *   POST /admin/applications/approve                 PROVIDER_APPLICATION_APPROVE
 *   POST /admin/applications/reject                  PROVIDER_APPLICATION_REJECT
 *   POST /admin/applications/:id/promote-trainee     PROVIDER_TRAINEE_PROMOTE
 *   POST /admin/applications/:id/assign              PROVIDER_APPLICATION_ASSIGN
 *   POST /admin/applications/:id/resubmit-request    PROVIDER_RESUBMIT_REQUEST
 *   POST /admin/applications/:id/message             PROVIDER_ADMIN_MESSAGE
 *
 * Existing writeProviderAudit domain entries are preserved alongside.
 *
 * Source-pin only.
 */

import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const FILE = path.resolve(__dirname, '..', 'routes', 'provider-onboarding.ts');
const text = fs.readFileSync(FILE, 'utf8');

describe('PR-W34g — provider-onboarding admin audit coverage', () => {
  it('imports logAuditEvent', () => {
    expect(text).toMatch(/import\s*\{\s*logAuditEvent\s*\}\s*from\s*['"]\.\.\/middleware\/auditLog['"]/);
  });

  it('declares emitProviderOnboardingAudit wrapper with setImmediate', () => {
    const idx = text.indexOf('function emitProviderOnboardingAudit');
    expect(idx).toBeGreaterThan(0);
    const block = text.slice(idx, idx + 1500);
    expect(block).toMatch(/setImmediate\s*\(/);
    expect(block).toMatch(/targetType:\s*['"]provider_application['"]/);
    expect(block).toMatch(/actorRole:\s*['"]admin['"]/);
  });

  describe('7 admin mutators each emit an audit event', () => {
    function sliceHandler(routePath: string): string {
      const idx = text.indexOf(`router.post('${routePath}'`);
      if (idx < 0) throw new Error(`route ${routePath} not found`);
      const next = text.indexOf('\nrouter.', idx + 10);
      return next > 0 ? text.slice(idx, next) : text.slice(idx, idx + 8000);
    }

    function assertAudit(handler: string, action: string) {
      expect(handler, `${action}: emitProviderOnboardingAudit missing`).toMatch(/emitProviderOnboardingAudit\s*\(/);
      expect(handler, `${action}: actionType missing`).toMatch(
        new RegExp(`actionType:\\s*['"]${action}['"]`),
      );
    }

    it('POST /admin/invite-codes/generate → PROVIDER_INVITE_CODE_GENERATE', () => {
      assertAudit(sliceHandler('/admin/invite-codes/generate'), 'PROVIDER_INVITE_CODE_GENERATE');
    });
    it('POST /admin/applications/approve → PROVIDER_APPLICATION_APPROVE', () => {
      assertAudit(sliceHandler('/admin/applications/approve'), 'PROVIDER_APPLICATION_APPROVE');
    });
    it('POST /admin/applications/reject → PROVIDER_APPLICATION_REJECT (with rejectionReason)', () => {
      const block = sliceHandler('/admin/applications/reject');
      assertAudit(block, 'PROVIDER_APPLICATION_REJECT');
      expect(block).toMatch(/rejectionReason/);
    });
    it('POST /admin/applications/:id/promote-trainee → PROVIDER_TRAINEE_PROMOTE', () => {
      assertAudit(sliceHandler('/admin/applications/:numericId/promote-trainee'), 'PROVIDER_TRAINEE_PROMOTE');
    });
    it('POST /admin/applications/:id/assign → PROVIDER_APPLICATION_ASSIGN (with assignedTo)', () => {
      const block = sliceHandler('/admin/applications/:numericId/assign');
      assertAudit(block, 'PROVIDER_APPLICATION_ASSIGN');
      expect(block).toMatch(/assignedTo/);
    });
    it('POST /admin/applications/:id/resubmit-request → PROVIDER_RESUBMIT_REQUEST', () => {
      const block = sliceHandler('/admin/applications/:numericId/resubmit-request');
      assertAudit(block, 'PROVIDER_RESUBMIT_REQUEST');
      expect(block).toMatch(/reasons,/);
    });
    it('POST /admin/applications/:id/message → PROVIDER_ADMIN_MESSAGE', () => {
      assertAudit(sliceHandler('/admin/applications/:numericId/message'), 'PROVIDER_ADMIN_MESSAGE');
    });
  });

  describe('secrets / PII never enter audit metadata', () => {
    it('invite-code generate logs only codeLast4, not the full code', () => {
      const idx = text.indexOf("router.post('/admin/invite-codes/generate'");
      const next = text.indexOf('\nrouter.', idx + 10);
      const block = text.slice(idx, next);
      const auditIdx = block.indexOf('emitProviderOnboardingAudit');
      const auditBlock = block.slice(auditIdx, auditIdx + 1200);
      expect(auditBlock).toMatch(/codeLast4:/);
      // The full code must not appear in metadata. We check that the
      // metadata block does NOT bind `code` directly.
      expect(auditBlock).not.toMatch(/\binviteCode:\s*inviteCode\b/);
    });

    it('resubmit-request logs only token PREFIX (8 chars), not the full token', () => {
      const idx = text.indexOf("router.post('/admin/applications/:numericId/resubmit-request'");
      const next = text.indexOf('\nrouter.', idx + 10);
      const block = text.slice(idx, next);
      const auditIdx = block.indexOf('emitProviderOnboardingAudit');
      const auditBlock = block.slice(auditIdx, auditIdx + 1200);
      expect(auditBlock).toMatch(/tokenPrefix:/);
      expect(auditBlock).not.toMatch(/\btoken:\s*token\b/);
    });

    it('admin message logs bodyLength, not the message body itself', () => {
      const idx = text.indexOf("router.post('/admin/applications/:numericId/message'");
      const next = text.indexOf('\nrouter.', idx + 10);
      const block = text.slice(idx, next);
      const auditIdx = block.indexOf('emitProviderOnboardingAudit');
      const auditBlock = block.slice(auditIdx, auditIdx + 1200);
      expect(auditBlock).toMatch(/bodyLength:/);
      // The metadata block should NOT bind `body` directly.
      expect(auditBlock).not.toMatch(/\bbody:\s*body\b/);
    });
  });

  describe('customer-facing mutators emit no admin-audit events', () => {
    function sliceHandler(routePath: string): string {
      const idx = text.indexOf(`router.post('${routePath}'`);
      if (idx < 0) return '';
      const next = text.indexOf('\nrouter.', idx + 10);
      return next > 0 ? text.slice(idx, next) : text.slice(idx, idx + 4000);
    }

    it('POST /validate-invite-code has no emitProviderOnboardingAudit', () => {
      const block = sliceHandler('/validate-invite-code');
      expect(block).not.toMatch(/emitProviderOnboardingAudit\s*\(/);
    });

    it('POST /my/messages has no emitProviderOnboardingAudit', () => {
      const block = sliceHandler('/my/messages');
      expect(block).not.toMatch(/emitProviderOnboardingAudit\s*\(/);
    });
  });

  describe('domain writeProviderAudit calls preserved', () => {
    it('writeProviderAudit still called from approve handler', () => {
      const idx = text.indexOf("router.post('/admin/applications/approve'");
      const next = text.indexOf('\nrouter.', idx + 10);
      const block = text.slice(idx, next);
      expect(block).toMatch(/writeProviderAudit\s*\(/);
    });
  });
});
