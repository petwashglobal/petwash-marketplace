/**
 * PR-W34e — enterprise-finance admin audit_events coverage.
 *
 * 15 admin mutators wired (highest-financial-risk domain):
 *   POST /accounts-payable                AP_CREATE
 *   PATCH /accounts-payable/:id           AP_UPDATE
 *   DELETE /accounts-payable/:id          AP_DELETE
 *   POST /accounts-payable/:id/pay        AP_PAY
 *   POST /accounts-receivable             AR_CREATE
 *   PATCH /accounts-receivable/:id        AR_UPDATE
 *   DELETE /accounts-receivable/:id       AR_DELETE
 *   POST /accounts-receivable/:id/payment AR_RECORD_PAYMENT
 *   POST /general-ledger                  GL_CREATE
 *   POST /general-ledger/:id/reconcile    GL_RECONCILE
 *   POST /tax-returns                     TAX_RETURN_CREATE
 *   PATCH /tax-returns/:id                TAX_RETURN_UPDATE
 *   POST /tax-returns/:id/submit          TAX_RETURN_SUBMIT (or _FAILED)
 *   POST /tax-payments                    TAX_PAYMENT_CREATE
 *   POST /tax-audit-logs                  TAX_AUDIT_LOG_CREATE
 *
 * The existing tax_audit_logs domain rows are PRESERVED — emitFinanceAudit
 * adds the canonical hash-chained audit_events row alongside.
 *
 * Source-pin only.
 */

import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const FILE = path.resolve(__dirname, '..', 'routes', 'enterprise-finance.ts');
const text = fs.readFileSync(FILE, 'utf8');

describe('PR-W34e — enterprise-finance admin audit coverage', () => {
  it('imports logAuditEvent', () => {
    expect(text).toMatch(/import\s*\{\s*logAuditEvent\s*\}\s*from\s*['"]\.\.\/middleware\/auditLog['"]/);
  });

  it('declares emitFinanceAudit wrapper with setImmediate (fire-and-forget)', () => {
    const idx = text.indexOf('function emitFinanceAudit');
    expect(idx).toBeGreaterThan(0);
    const block = text.slice(idx, idx + 2000);
    expect(block).toMatch(/setImmediate\s*\(/);
    expect(block).toMatch(/actorRole:\s*['"]admin['"]/);
    expect(block).toMatch(/targetType: params\.targetType/);
  });

  describe('15 mutators each emit an audit event', () => {
    function sliceHandler(method: 'post' | 'patch' | 'delete', routePath: string): string {
      const idx = text.indexOf(`router.${method}("${routePath}"`);
      if (idx < 0) throw new Error(`router.${method} ${routePath} not found`);
      const next = text.indexOf('\nrouter.', idx + 10);
      return next > 0 ? text.slice(idx, next) : text.slice(idx, idx + 5000);
    }

    function assertAudit(handler: string, action: string, target: string) {
      expect(handler, `emitFinanceAudit missing for ${action}`).toMatch(/emitFinanceAudit\s*\(/);
      expect(handler, `actionType ${action} missing`).toMatch(
        new RegExp(`actionType:\\s*['"]${action}['"]`),
      );
      expect(handler, `targetType ${target} missing for ${action}`).toMatch(
        new RegExp(`targetType:\\s*['"]${target}['"]`),
      );
    }

    it('POST /accounts-payable → AP_CREATE', () => {
      assertAudit(sliceHandler('post', '/accounts-payable'), 'AP_CREATE', 'accounts_payable');
    });
    it('PATCH /accounts-payable/:id → AP_UPDATE', () => {
      assertAudit(sliceHandler('patch', '/accounts-payable/:id'), 'AP_UPDATE', 'accounts_payable');
    });
    it('DELETE /accounts-payable/:id → AP_DELETE', () => {
      assertAudit(sliceHandler('delete', '/accounts-payable/:id'), 'AP_DELETE', 'accounts_payable');
    });
    it('POST /accounts-payable/:id/pay → AP_PAY', () => {
      assertAudit(sliceHandler('post', '/accounts-payable/:id/pay'), 'AP_PAY', 'accounts_payable');
    });

    it('POST /accounts-receivable → AR_CREATE', () => {
      assertAudit(sliceHandler('post', '/accounts-receivable'), 'AR_CREATE', 'accounts_receivable');
    });
    it('PATCH /accounts-receivable/:id → AR_UPDATE', () => {
      assertAudit(sliceHandler('patch', '/accounts-receivable/:id'), 'AR_UPDATE', 'accounts_receivable');
    });
    it('DELETE /accounts-receivable/:id → AR_DELETE', () => {
      assertAudit(sliceHandler('delete', '/accounts-receivable/:id'), 'AR_DELETE', 'accounts_receivable');
    });
    it('POST /accounts-receivable/:id/payment → AR_RECORD_PAYMENT', () => {
      assertAudit(sliceHandler('post', '/accounts-receivable/:id/payment'), 'AR_RECORD_PAYMENT', 'accounts_receivable');
    });

    it('POST /general-ledger → GL_CREATE', () => {
      assertAudit(sliceHandler('post', '/general-ledger'), 'GL_CREATE', 'general_ledger');
    });
    it('POST /general-ledger/:id/reconcile → GL_RECONCILE', () => {
      assertAudit(sliceHandler('post', '/general-ledger/:id/reconcile'), 'GL_RECONCILE', 'general_ledger');
    });

    it('POST /tax-returns → TAX_RETURN_CREATE', () => {
      assertAudit(sliceHandler('post', '/tax-returns'), 'TAX_RETURN_CREATE', 'tax_return');
    });
    it('PATCH /tax-returns/:id → TAX_RETURN_UPDATE', () => {
      assertAudit(sliceHandler('patch', '/tax-returns/:id'), 'TAX_RETURN_UPDATE', 'tax_return');
    });
    it('POST /tax-returns/:id/submit → TAX_RETURN_SUBMIT (with _FAILED variant)', () => {
      const block = sliceHandler('post', '/tax-returns/:id/submit');
      expect(block).toMatch(/emitFinanceAudit\s*\(/);
      expect(block).toMatch(/TAX_RETURN_SUBMIT/);
      expect(block).toMatch(/TAX_RETURN_SUBMIT_FAILED/);
      expect(block).toMatch(/targetType:\s*['"]tax_return['"]/);
    });

    it('POST /tax-payments → TAX_PAYMENT_CREATE', () => {
      assertAudit(sliceHandler('post', '/tax-payments'), 'TAX_PAYMENT_CREATE', 'tax_payment');
    });
    it('POST /tax-audit-logs → TAX_AUDIT_LOG_CREATE', () => {
      assertAudit(sliceHandler('post', '/tax-audit-logs'), 'TAX_AUDIT_LOG_CREATE', 'tax_audit_log');
    });
  });

  describe('domain tax_audit_logs writes preserved (operational record kept)', () => {
    it('storage.createTaxAuditLog still called from /tax-returns POST', () => {
      const idx = text.indexOf('router.post("/tax-returns"');
      const next = text.indexOf('\nrouter.', idx + 10);
      const block = text.slice(idx, next);
      expect(block).toMatch(/storage\.createTaxAuditLog/);
    });
    it('storage.createTaxAuditLog still called from /tax-payments POST', () => {
      const idx = text.indexOf('router.post("/tax-payments"');
      const next = text.indexOf('\nrouter.', idx + 10);
      const block = text.slice(idx, next);
      expect(block).toMatch(/storage\.createTaxAuditLog/);
    });
  });

  describe('read-only endpoints emit no audit events', () => {
    it('GET /accounts-payable list has no emitFinanceAudit', () => {
      const idx = text.indexOf('router.get("/accounts-payable"');
      const next = text.indexOf('\nrouter.', idx + 10);
      const block = text.slice(idx, next);
      expect(block).not.toMatch(/emitFinanceAudit\s*\(/);
    });
    it('GET /tax-audit-logs list has no emitFinanceAudit', () => {
      const idx = text.indexOf('router.get("/tax-audit-logs"');
      const next = text.indexOf('\nrouter.', idx + 10);
      const block = text.slice(idx, next);
      expect(block).not.toMatch(/emitFinanceAudit\s*\(/);
    });
  });

  describe('requireAdmin gate preserved (router-level)', () => {
    it('router.use(requireAdmin) still applied to entire enterprise-finance router', () => {
      expect(text).toMatch(/router\.use\(requireAdmin\)/);
    });
  });
});
