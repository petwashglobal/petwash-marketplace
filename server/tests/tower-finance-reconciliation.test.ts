/**
 * Tower Control — finance reconciliation endpoint (2026-07-09).
 *
 * PetWash Tower Control is the business cockpit ABOVE SUMIT (SUMIT stays the
 * official finance/tax engine). This is the first data spine of the cockpit's
 * SUMIT-document reconciliation tile: how many receipts SUMIT is issuer-of-record
 * for vs self-issued PW-, SUMIT-doc coverage, voids, and gross/VAT for a window.
 * Read-only + admin-gated; builds on issuer_of_record (#1358).
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const ROUTES = fs.readFileSync(path.resolve(__dirname, '..', 'routes.ts'), 'utf8');

describe('Tower Control finance reconciliation (2026-07-09)', () => {
  it('exposes an admin-gated read endpoint', () => {
    expect(ROUTES).toMatch(/app\.get\('\/api\/admin\/tower\/finance-reconciliation', requireAdmin/);
  });

  it('reconciles issuer_of_record (SUMIT vs self) + SUMIT doc coverage', () => {
    expect(ROUTES).toMatch(/issuer_of_record = 'sumit'/);
    expect(ROUTES).toMatch(/issuer_of_record IS DISTINCT FROM 'sumit'/);
    expect(ROUTES).toMatch(/sumit_document_id IS NOT NULL/);
  });

  it('excludes voided rows from the money totals', () => {
    expect(ROUTES).toMatch(/FILTER \(WHERE is_voided = false\)/);
  });
});
