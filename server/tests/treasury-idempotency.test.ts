/**
 * PR-W46 — treasury idempotency wiring.
 *
 * Wraps all 8 treasury mutators with `runWithIdempotency`. The state
 * machines inside payout_batches already prevent double-mutate, but
 * adding the cache means a network retry returns the original payload
 * instead of an "invalid state" 400 / 500.
 *
 * Endpoints:
 *   POST /api/treasury/batches              → treasury:batches:create
 *   POST /api/treasury/batches/:id/submit   → treasury:batches:submit
 *   POST /api/treasury/batches/:id/mark-paid → treasury:batches:mark-paid
 *   POST /api/treasury/import-bank-transactions → treasury:import-bank-transactions
 *   POST /api/treasury/reconcile/:batchId   → treasury:reconcile:batch
 *   POST /api/treasury/reconcile-sweep      → treasury:reconcile:sweep
 *   POST /api/treasury/failures/:id/retry   → treasury:failures:retry
 *   POST /api/treasury/failures/:id/resolve → treasury:failures:resolve
 *
 * Source-pin only.
 */

import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const FILE = path.resolve(__dirname, '..', 'routes', 'treasury.ts');
const text = fs.readFileSync(FILE, 'utf8');

describe('PR-W46 — treasury idempotency wiring', () => {
  it('imports runWithIdempotency from lib/idempotency-helper', () => {
    expect(text).toMatch(
      /import\s*\{\s*runWithIdempotency\s*\}\s*from\s*['"]\.\.\/lib\/idempotency-helper['"]/,
    );
  });

  it('declares a shared inFlightResponse helper', () => {
    expect(text).toMatch(/function inFlightResponse\s*\(/);
    expect(text).toMatch(/IDEMPOTENCY_IN_FLIGHT/);
    expect(text).toMatch(/status\(409\)/);
  });

  describe('per-handler wiring', () => {
    function sliceHandler(routePath: string): string {
      const idx = text.indexOf(`router.post('${routePath}'`);
      if (idx < 0) throw new Error(`route ${routePath} not found`);
      const next = text.indexOf('\nrouter.', idx + 10);
      return next > 0 ? text.slice(idx, next) : text.slice(idx, idx + 4500);
    }

    function assertWired(handler: string, endpoint: string) {
      expect(handler, `runWithIdempotency missing in ${endpoint}`).toMatch(/runWithIdempotency\s*\(/);
      expect(handler, `endpoint label missing in ${endpoint}`).toMatch(
        new RegExp(`endpoint:\\s*['"]${endpoint.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}['"]`),
      );
      expect(handler, `Idempotency-Key header read missing in ${endpoint}`).toMatch(
        /headerKey:\s*req\.headers\['idempotency-key'\]/,
      );
      expect(handler, `bodyFingerprint missing in ${endpoint}`).toMatch(/bodyFingerprint:/);
      expect(handler, `in_flight branch returns 409 in ${endpoint}`).toMatch(
        /in_flight[^]{0,80}inFlightResponse|in_flight[^]{0,80}status\(409\)/,
      );
    }

    it('POST /batches → treasury:batches:create', () => {
      assertWired(sliceHandler('/batches'), 'treasury:batches:create');
    });
    it('POST /batches/:id/submit → treasury:batches:submit', () => {
      assertWired(sliceHandler('/batches/:id/submit'), 'treasury:batches:submit');
    });
    it('POST /batches/:id/mark-paid → treasury:batches:mark-paid', () => {
      assertWired(sliceHandler('/batches/:id/mark-paid'), 'treasury:batches:mark-paid');
    });
    it('POST /import-bank-transactions → treasury:import-bank-transactions', () => {
      assertWired(sliceHandler('/import-bank-transactions'), 'treasury:import-bank-transactions');
    });
    it('POST /reconcile/:batchId → treasury:reconcile:batch', () => {
      assertWired(sliceHandler('/reconcile/:batchId'), 'treasury:reconcile:batch');
    });
    it('POST /reconcile-sweep → treasury:reconcile:sweep', () => {
      assertWired(sliceHandler('/reconcile-sweep'), 'treasury:reconcile:sweep');
    });
    it('POST /failures/:id/retry → treasury:failures:retry', () => {
      assertWired(sliceHandler('/failures/:id/retry'), 'treasury:failures:retry');
    });
    it('POST /failures/:id/resolve → treasury:failures:resolve', () => {
      assertWired(sliceHandler('/failures/:id/resolve'), 'treasury:failures:resolve');
    });
  });

  describe('TTL overrides for short-lived operations', () => {
    function sliceHandler(routePath: string): string {
      const idx = text.indexOf(`router.post('${routePath}'`);
      const next = text.indexOf('\nrouter.', idx + 10);
      return next > 0 ? text.slice(idx, next) : text.slice(idx, idx + 4500);
    }

    it('reconcile-sweep uses a short TTL (≤5 min) — operators may legitimately re-sweep', () => {
      const block = sliceHandler('/reconcile-sweep');
      expect(block).toMatch(/ttlMs:\s*5\s*\*\s*60\s*\*\s*1000/);
    });

    it('failures/:id/retry uses 30s TTL — retries are intentional, not replays', () => {
      const block = sliceHandler('/failures/:id/retry');
      expect(block).toMatch(/ttlMs:\s*30\s*\*\s*1000/);
    });
  });

  describe('error mapping preserved', () => {
    function sliceHandler(routePath: string): string {
      const idx = text.indexOf(`router.post('${routePath}'`);
      const next = text.indexOf('\nrouter.', idx + 10);
      return next > 0 ? text.slice(idx, next) : text.slice(idx, idx + 4500);
    }

    it('batches/:id/submit still returns 400 on invalid state', () => {
      const block = sliceHandler('/batches/:id/submit');
      expect(block).toMatch(/statusCode:\s*400/);
      expect(block).toMatch(/'Batch not found or not in approved state'/);
    });

    it('batches/:id/mark-paid still returns 400 on invalid state', () => {
      const block = sliceHandler('/batches/:id/mark-paid');
      expect(block).toMatch(/statusCode:\s*400/);
      expect(block).toMatch(/'Batch not found or not in submitted state'/);
    });

    it('failures/:id/retry still returns 404 when failure not found', () => {
      const block = sliceHandler('/failures/:id/retry');
      expect(block).toMatch(/statusCode:\s*404/);
      expect(block).toMatch(/'Failure not found'/);
    });
  });
});
