/**
 * SUMIT financials — raw provider objects must never reach the browser.
 * CEO closure sprint (Agent 7), SUMIT continuation.
 *
 * GET /api/me/sumit/summary returned SUMIT's payment-method and document items
 * verbatim (savedMethods: unknown[]; documents: unknown[]), so every field SUMIT
 * chose to put on an item was forwarded to the customer's browser. That broke
 * the service's own documented contract — its header promises no
 * sumit_customer_id and no CustomerHistoryURL leave the server, which held for
 * the top-level envelope but not for anything nested inside an item.
 *
 * Both arrays are now projected through an explicit allowlist. The field set is
 * exactly what the UI already rendered, so nothing visible changed; the
 * difference is that an unrecognised field is DROPPED rather than forwarded,
 * and adding one becomes a deliberate server-side edit.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const SRC = fs.readFileSync(
  path.resolve(__dirname, '..', 'services', 'SumitFinancialsService.ts'),
  'utf8',
);

describe('getFinancialsSummary projects instead of forwarding', () => {
  it('the returned arrays are typed to the allowlist, not unknown[]', () => {
    expect(SRC).toMatch(/savedMethods: SumitSavedMethod\[\];/);
    expect(SRC).toMatch(/documents: SumitDocumentSummary\[\];/);
    expect(SRC).not.toMatch(/savedMethods: unknown\[\];/);
    expect(SRC).not.toMatch(/documents: unknown\[\];/);
  });

  it('every item goes through a projector on the way out', () => {
    expect(SRC).toMatch(/savedMethods: \(methodsRes\.items \|\| \[\]\)\.map\(projectSavedMethod\)/);
    expect(SRC).toMatch(/documents:\s+\(docsRes\.items\s+\|\| \[\]\)\.map\(projectDocument\)/);
    // The raw passthrough must be gone.
    expect(SRC).not.toMatch(/savedMethods: methodsRes\.items \|\| \[\],/);
    expect(SRC).not.toMatch(/documents: docsRes\.items \|\| \[\],/);
  });

  it('the payment-method allowlist is exactly id/last4/brand/expiry', () => {
    const iface = SRC.slice(
      SRC.indexOf('export interface SumitSavedMethod'),
      SRC.indexOf('/** The ONLY document fields'),
    );
    const fields = [...iface.matchAll(/^\s{2}(\w+)\??:/gm)].map((m) => m[1]);
    expect(fields.sort()).toEqual(['brand', 'expiry', 'id', 'last4']);
  });

  it('the document allowlist is exactly id/number/type/date/amount/url', () => {
    const iface = SRC.slice(
      SRC.indexOf('export interface SumitDocumentSummary'),
      SRC.indexOf('export interface SumitFinancialsSummary'),
    );
    const fields = [...iface.matchAll(/^\s{2}(\w+)\??:/gm)].map((m) => m[1]);
    expect(fields.sort()).toEqual(['amount', 'date', 'id', 'number', 'type', 'url']);
  });

  it('no projector ever copies a customer identifier or history URL', () => {
    // Bound to the two projector bodies only — getFinancialsSummary below them
    // legitimately handles sumitCustomerId server-side.
    const projectors = SRC.slice(
      SRC.indexOf('function projectSavedMethod'),
      SRC.indexOf('export async function getFinancialsSummary'),
    );
    expect(projectors).toContain('function projectDocument');
    expect(projectors).not.toMatch(/CustomerHistoryURL/);
    expect(projectors).not.toMatch(/CustomerID|CustomerId|sumit_customer_id/);
    // No spread of the raw object — that would defeat the allowlist entirely.
    expect(projectors).not.toMatch(/\.\.\.raw/);
  });

  it('the dormant / unsynced early returns still hand back empty arrays', () => {
    // Fail-quiet contract: SUMIT off, mapping missing, or lookup failed must
    // never throw and never leak a reason to the customer as data.
    const empties = SRC.match(/return \{ available: false, savedMethods: \[\], documents: \[\]/g) ?? [];
    expect(empties.length).toBeGreaterThanOrEqual(4);
  });
});
