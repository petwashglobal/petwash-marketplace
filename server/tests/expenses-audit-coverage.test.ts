/**
 * PR-W34c — expenses admin audit_events coverage.
 *
 * 4 mutating handlers wired:
 *   POST /                     EXPENSE_CREATE
 *   PATCH /:id/approve         EXPENSE_APPROVE
 *   PATCH /:id/reject          EXPENSE_REJECT
 *   POST /seed-tax-rates       EXPENSE_SEED_TAX_RATES
 *
 * Note: POST /ocr-receipt does NOT persist — it returns OCR'd text from
 * the image and writes nothing. Therefore no audit emission required.
 *
 * Source-pin only.
 */

import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const FILE = path.resolve(__dirname, '..', 'routes', 'expenses.ts');
const text = fs.readFileSync(FILE, 'utf8');

describe('PR-W34c — expenses admin audit coverage', () => {
  it('imports logAuditEvent', () => {
    expect(text).toMatch(/import\s*\{\s*logAuditEvent\s*\}\s*from\s*['"]\.\.\/middleware\/auditLog['"]/);
  });

  it('declares emitExpenseAudit wrapper with targetType="expense" and setImmediate', () => {
    const idx = text.indexOf('function emitExpenseAudit');
    expect(idx).toBeGreaterThan(0);
    const block = text.slice(idx, idx + 1500);
    expect(block).toMatch(/setImmediate\s*\(/);
    expect(block).toMatch(/targetType:\s*['"]expense['"]/);
    expect(block).toMatch(/actorRole:\s*['"]admin['"]/);
  });

  describe('mutating handlers emit audit events', () => {
    function sliceHandler(method: 'post' | 'patch', routePath: string): string {
      const idx = text.indexOf(`router.${method}("${routePath}"`);
      if (idx < 0) throw new Error(`router.${method} ${routePath} not found`);
      const next = text.indexOf('\nrouter.', idx + 10);
      return next > 0 ? text.slice(idx, next) : text.slice(idx, idx + 4000);
    }

    it('POST / → EXPENSE_CREATE (with category + totalAmountILS metadata)', () => {
      const block = sliceHandler('post', '/');
      expect(block).toMatch(/emitExpenseAudit\s*\(/);
      expect(block).toMatch(/actionType:\s*['"]EXPENSE_CREATE['"]/);
      expect(block).toMatch(/category:/);
      expect(block).toMatch(/totalAmountILS:/);
    });

    it('PATCH /:id/approve → EXPENSE_APPROVE', () => {
      const block = sliceHandler('patch', '/:id/approve');
      expect(block).toMatch(/emitExpenseAudit\s*\(/);
      expect(block).toMatch(/actionType:\s*['"]EXPENSE_APPROVE['"]/);
    });

    it('PATCH /:id/reject → EXPENSE_REJECT (with rejectionReason)', () => {
      const block = sliceHandler('patch', '/:id/reject');
      expect(block).toMatch(/emitExpenseAudit\s*\(/);
      expect(block).toMatch(/actionType:\s*['"]EXPENSE_REJECT['"]/);
      expect(block).toMatch(/rejectionReason/);
    });

    it('POST /seed-tax-rates → EXPENSE_SEED_TAX_RATES', () => {
      const block = sliceHandler('post', '/seed-tax-rates');
      expect(block).toMatch(/emitExpenseAudit\s*\(/);
      expect(block).toMatch(/actionType:\s*['"]EXPENSE_SEED_TAX_RATES['"]/);
    });
  });

  describe('read-only handlers do NOT emit audit events', () => {
    it('POST /ocr-receipt has NO emitExpenseAudit (no persistence)', () => {
      const idx = text.indexOf('router.post("/ocr-receipt"');
      const next = text.indexOf('\nrouter.', idx + 10);
      const block = next > 0 ? text.slice(idx, next) : text.slice(idx, idx + 2500);
      expect(block).not.toMatch(/emitExpenseAudit\s*\(/);
    });
  });
});
