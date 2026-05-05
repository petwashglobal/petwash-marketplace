/**
 * PR-W34a — escrow route audit-events coverage.
 *
 * Pre-PR-W34a, every escrow money-mutation handler logged to console
 * (logger.info) and to Google Sheets, but wrote ZERO `audit_events`
 * rows. The hash-chained audit table (PR-W1) is the legal record;
 * console + sheets are operational, not legal.
 *
 * This test pins:
 *   1. Every mutating escrow handler imports logAuditEvent.
 *   2. Each of the 5 mutating handlers calls emitEscrowAudit (the local
 *      wrapper) before responding, with the correct ACTION_TYPE.
 *   3. The wrapper sets targetType='escrow' and targetId.
 *   4. Read-only escrow routes do NOT write audit events.
 *
 * Source-pin assertions only — no DB.
 */

import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const FILE = path.resolve(__dirname, '..', 'routes', 'escrow.ts');
const text = fs.readFileSync(FILE, 'utf8');

describe('PR-W34a — escrow audit coverage', () => {
  it('imports logAuditEvent from middleware/auditLog', () => {
    expect(text).toMatch(/import\s*\{\s*logAuditEvent\s*\}\s*from\s*['"]\.\.\/middleware\/auditLog['"]/);
  });

  it('defines a local emitEscrowAudit wrapper', () => {
    expect(text).toMatch(/function emitEscrowAudit\s*\(/);
  });

  it('emitEscrowAudit sets targetType to "escrow"', () => {
    const idx = text.indexOf('function emitEscrowAudit');
    const block = text.slice(idx, idx + 1500);
    expect(block).toMatch(/targetType:\s*['"]escrow['"]/);
  });

  it('emitEscrowAudit fires fire-and-forget via setImmediate (no client blocking)', () => {
    const idx = text.indexOf('function emitEscrowAudit');
    const block = text.slice(idx, idx + 1500);
    expect(block).toMatch(/setImmediate\s*\(/);
  });

  describe('every mutating handler emits an audit event', () => {
    function sliceHandler(routePath: string): string {
      const idx = text.indexOf(`router.post("${routePath}"`);
      if (idx < 0) throw new Error(`route ${routePath} not found`);
      // 2k chars covers the longest handler
      return text.slice(idx, idx + 2500);
    }

    it('POST /create → ESCROW_CREATE', () => {
      const block = sliceHandler('/create');
      expect(block).toMatch(/emitEscrowAudit\s*\(/);
      expect(block).toMatch(/actionType:\s*['"]ESCROW_CREATE['"]/);
    });

    it('POST /:escrowId/release → ESCROW_RELEASE', () => {
      const block = sliceHandler('/:escrowId/release');
      expect(block).toMatch(/emitEscrowAudit\s*\(/);
      expect(block).toMatch(/actionType:\s*['"]ESCROW_RELEASE['"]/);
    });

    it('POST /:escrowId/refund → ESCROW_REFUND', () => {
      const block = sliceHandler('/:escrowId/refund');
      expect(block).toMatch(/emitEscrowAudit\s*\(/);
      expect(block).toMatch(/actionType:\s*['"]ESCROW_REFUND['"]/);
    });

    it('POST /:escrowId/dispute → ESCROW_DISPUTE', () => {
      const block = sliceHandler('/:escrowId/dispute');
      expect(block).toMatch(/emitEscrowAudit\s*\(/);
      expect(block).toMatch(/actionType:\s*['"]ESCROW_DISPUTE['"]/);
    });

    it('POST /admin/auto-release → ESCROW_AUTO_RELEASE', () => {
      const block = sliceHandler('/admin/auto-release');
      expect(block).toMatch(/emitEscrowAudit\s*\(/);
      expect(block).toMatch(/actionType:\s*['"]ESCROW_AUTO_RELEASE['"]/);
    });
  });

  describe('read-only handlers do NOT emit audit events', () => {
    /**
     * Slice from `router.get("path", ...)` up to the NEXT `router.` line so
     * we only inspect this one handler — not any neighbouring POST.
     */
    function sliceHandler(method: 'get', routePath: string): string {
      const start = text.indexOf(`router.${method}("${routePath}"`);
      if (start < 0) return '';
      const next = text.indexOf('\nrouter.', start + 10);
      return next > 0 ? text.slice(start, next) : text.slice(start, start + 800);
    }

    it('GET /payments has no emitEscrowAudit', () => {
      const block = sliceHandler('get', '/payments');
      expect(block).not.toMatch(/emitEscrowAudit\s*\(/);
    });

    it('GET /:escrowId has no emitEscrowAudit', () => {
      const block = sliceHandler('get', '/:escrowId');
      expect(block).not.toMatch(/emitEscrowAudit\s*\(/);
    });

    it('GET /booking/:bookingId has no emitEscrowAudit', () => {
      const block = sliceHandler('get', '/booking/:bookingId');
      expect(block).not.toMatch(/emitEscrowAudit\s*\(/);
    });
  });
});
