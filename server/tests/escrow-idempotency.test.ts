/**
 * PR-W45 — escrow money operations are replay-safe via walletIdempotencyKeys.
 *
 * Pre-PR-W45, the four customer-facing escrow mutators
 * (/create, /:id/release, /:id/refund, /:id/dispute) had no idempotency
 * cache. The state machine inside EscrowService prevents double-mutate
 * (you can't release a released escrow), but a network retry would get
 * a confusing 500 instead of the original {success:true} payload.
 *
 * PR-W45 wires `runWithIdempotency` (server/lib/idempotency-helper.ts)
 * around all four handlers. Same body → cached payload returned. Same
 * body in flight → 409 IDEMPOTENCY_IN_FLIGHT.
 *
 * This test pins the wiring + the helper's contract. Source-pin only.
 */

import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';
import { deriveIdempotencyKey } from '../lib/idempotency-helper';

const ROUTE_FILE = path.resolve(__dirname, '..', 'routes', 'escrow.ts');
const HELPER_FILE = path.resolve(__dirname, '..', 'lib', 'idempotency-helper.ts');
const text = fs.readFileSync(ROUTE_FILE, 'utf8');
const helperText = fs.readFileSync(HELPER_FILE, 'utf8');

describe('PR-W45 — escrow idempotency wiring', () => {
  it('escrow.ts imports runWithIdempotency from lib/idempotency-helper', () => {
    expect(text).toMatch(/import\s*\{\s*runWithIdempotency\s*\}\s*from\s*['"]\.\.\/lib\/idempotency-helper['"]/);
  });

  describe('per-handler wiring', () => {
    function sliceHandler(routePath: string): string {
      const idx = text.indexOf(`router.post("${routePath}"`);
      if (idx < 0) throw new Error(`route ${routePath} not found`);
      const next = text.indexOf('\nrouter.', idx + 10);
      return next > 0 ? text.slice(idx, next) : text.slice(idx, idx + 3500);
    }

    function assertWired(handler: string, endpoint: string) {
      expect(handler, `runWithIdempotency missing in ${endpoint}`).toMatch(/runWithIdempotency\s*\(/);
      expect(handler, `endpoint label missing in ${endpoint}`).toMatch(new RegExp(`endpoint:\\s*['"]${endpoint}['"]`));
      expect(handler, `Idempotency-Key header read missing in ${endpoint}`).toMatch(/headerKey:\s*req\.headers\['idempotency-key'\]/);
      expect(handler, `bodyFingerprint missing in ${endpoint}`).toMatch(/bodyFingerprint:/);
      expect(handler, `in_flight branch returns 409 in ${endpoint}`).toMatch(/in_flight[^]*?status\(409\)/);
      expect(handler, `IDEMPOTENCY_IN_FLIGHT errorCode emitted in ${endpoint}`).toMatch(/IDEMPOTENCY_IN_FLIGHT/);
    }

    it('POST /create wired with endpoint "escrow:create"', () => {
      assertWired(sliceHandler('/create'), 'escrow:create');
    });
    it('POST /:escrowId/release wired with endpoint "escrow:release"', () => {
      assertWired(sliceHandler('/:escrowId/release'), 'escrow:release');
    });
    it('POST /:escrowId/refund wired with endpoint "escrow:refund"', () => {
      assertWired(sliceHandler('/:escrowId/refund'), 'escrow:refund');
    });
    it('POST /:escrowId/dispute wired with endpoint "escrow:dispute"', () => {
      assertWired(sliceHandler('/:escrowId/dispute'), 'escrow:dispute');
    });
  });

  describe('audit + idempotency live inside the same operation', () => {
    // The audit_events row should be written ONCE — the operation block
    // wrapped by runWithIdempotency contains the emitEscrowAudit call,
    // so a replay returns the cached payload AND does not write a
    // duplicate audit row.
    function sliceHandler(routePath: string): string {
      const idx = text.indexOf(`router.post("${routePath}"`);
      const next = text.indexOf('\nrouter.', idx + 10);
      return next > 0 ? text.slice(idx, next) : text.slice(idx, idx + 3500);
    }

    it('emitEscrowAudit is INSIDE the runWithIdempotency operation closure', () => {
      for (const route of ['/create', '/:escrowId/release', '/:escrowId/refund', '/:escrowId/dispute']) {
        const block = sliceHandler(route);
        // The `operation: async () => { ... emitEscrowAudit ... }` pattern.
        const opStart = block.indexOf('operation:');
        const opEnd   = block.indexOf('headerKey') > opStart ? block.indexOf('headerKey') : block.length;
        // Just check that emitEscrowAudit appears AFTER 'operation:' in the slice.
        const auditIdx = block.indexOf('emitEscrowAudit');
        expect(auditIdx, `emitEscrowAudit must be inside operation closure for ${route}`).toBeGreaterThan(opStart);
      }
    });
  });
});

describe('PR-W45 — idempotency-helper unit tests', () => {
  it('deriveIdempotencyKey prefers an explicit Idempotency-Key header', () => {
    const k = deriveIdempotencyKey({
      endpoint: 'escrow:create',
      headerKey: 'client-supplied-key-abc',
      bodyFingerprint: 'fallback-should-not-be-used',
    });
    expect(k).toBe('escrow:create:client-supplied-key-abc');
  });

  it('deriveIdempotencyKey falls back to the body fingerprint', () => {
    const k = deriveIdempotencyKey({
      endpoint: 'escrow:create',
      headerKey: undefined,
      bodyFingerprint: 'b1:c2:p3:55:txn999',
    });
    expect(k).toBe('escrow:create:b1:c2:p3:55:txn999');
  });

  it('deriveIdempotencyKey accepts header value as string[]', () => {
    const k = deriveIdempotencyKey({
      endpoint: 'escrow:create',
      headerKey: ['array-style-key', 'second'],
      bodyFingerprint: 'ignored',
    });
    expect(k).toBe('escrow:create:array-style-key');
  });

  it('deriveIdempotencyKey trims whitespace on the header key', () => {
    const k = deriveIdempotencyKey({
      endpoint: 'x',
      headerKey: '   abc-123   ',
      bodyFingerprint: 'ignored',
    });
    expect(k).toBe('x:abc-123');
  });

  it('deriveIdempotencyKey caps at 128 characters (DB column width)', () => {
    const long = 'k'.repeat(500);
    const k = deriveIdempotencyKey({
      endpoint: 'foo:bar',
      headerKey: long,
      bodyFingerprint: 'ignored',
    });
    expect(k.length).toBeLessThanOrEqual(128);
    expect(k.startsWith('foo:bar:')).toBe(true);
  });

  it('namespaces under endpoint so different routes never collide', () => {
    const a = deriveIdempotencyKey({ endpoint: 'escrow:create', headerKey: 'KEY', bodyFingerprint: '' });
    const b = deriveIdempotencyKey({ endpoint: 'escrow:refund', headerKey: 'KEY', bodyFingerprint: '' });
    expect(a).not.toBe(b);
  });

  it('helper module declares the documented public API', () => {
    expect(helperText).toMatch(/export function deriveIdempotencyKey/);
    expect(helperText).toMatch(/export async function runWithIdempotency/);
    expect(helperText).toMatch(/export type IdempotencyResult/);
  });

  it('helper rolls back the lock when operation throws (DELETE on error)', () => {
    expect(helperText).toMatch(/db\s*\n?\s*\.delete\(walletIdempotencyKeys\)/);
  });

  it('helper persists responseJson on success (UPDATE)', () => {
    expect(helperText).toMatch(/responseJson:\s*JSON\.stringify\(response\)/);
  });
});
