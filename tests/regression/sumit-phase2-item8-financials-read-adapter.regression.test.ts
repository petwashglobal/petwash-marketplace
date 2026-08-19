import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

// Regression pin for CEO 2026-08-19 SUMIT Phase 2 Item 8 — the customer
// payments/documents READ adapter. Locks in:
//   (a) SumitClient exposes getForCustomer / listDocumentsForCustomer / removeSavedMethod
//       hitting the three CONFIRMED SUMIT endpoints (audit doc §3.3).
//   (b) SumitFinancialsService is the "one place" resolver: uid → sumit_customers →
//       parallel client reads → aggregated summary.
//   (c) GET /api/me/sumit/summary is mounted, Firebase-derived, and NEVER
//       accepts a userId from the client. Fail-quiet on SUMIT dormant.

const CLIENT_SRC = readFileSync(
  join(__dirname, '..', '..', 'server', 'services', 'SumitClient.ts'),
  'utf8',
);
const SERVICE_SRC = readFileSync(
  join(__dirname, '..', '..', 'server', 'services', 'SumitFinancialsService.ts'),
  'utf8',
);
const ROUTES_SRC = readFileSync(
  join(__dirname, '..', '..', 'server', 'routes.ts'),
  'utf8',
);

describe('SUMIT Phase 2 Item 8 — customer financials read adapter', () => {
  it('SumitClient.getForCustomer hits /billing/paymentmethods/getforcustomer/', () => {
    expect(CLIENT_SRC).toMatch(/async\s+getForCustomer\s*\(/);
    expect(CLIENT_SRC).toMatch(/\/billing\/paymentmethods\/getforcustomer\//);
  });

  it('SumitClient.listDocumentsForCustomer hits /accounting/documents/search/', () => {
    expect(CLIENT_SRC).toMatch(/async\s+listDocumentsForCustomer\s*\(/);
    expect(CLIENT_SRC).toMatch(/\/accounting\/documents\/search\//);
  });

  it('both new client reads are wired-guarded (no-op when SUMIT dormant)', () => {
    // Both must consult isWired() and short-circuit with an empty-items shape
    // rather than throwing when SUMIT_ENABLED is unset.
    const getForCustomerBlock = CLIENT_SRC.slice(
      CLIENT_SRC.indexOf('async getForCustomer'),
      CLIENT_SRC.indexOf('async listDocumentsForCustomer'),
    );
    const listDocsBlock = CLIENT_SRC.slice(
      CLIENT_SRC.indexOf('async listDocumentsForCustomer'),
      CLIENT_SRC.indexOf('async removeSavedMethod'),
    );
    expect(getForCustomerBlock).toMatch(/if\s*\(!isWired\(\)\)/);
    expect(getForCustomerBlock).toMatch(/items:\s*\[\]/);
    expect(listDocsBlock).toMatch(/if\s*\(!isWired\(\)\)/);
    expect(listDocsBlock).toMatch(/items:\s*\[\]/);
  });

  it('SumitFinancialsService.getFinancialsSummary exists and derives via uid → mapping', () => {
    expect(SERVICE_SRC).toMatch(/export\s+async\s+function\s+getFinancialsSummary\s*\(\s*uid:\s*string/);
    expect(SERVICE_SRC).toMatch(/getSumitCustomerId\s*\(\s*uid\s*\)/);
  });

  it('service fires both reads in parallel and never throws', () => {
    expect(SERVICE_SRC).toMatch(/Promise\.all\s*\(/);
    // Both individual promises defensively catch so one failing slice does
    // not empty the other.
    expect(SERVICE_SRC).toMatch(/\.catch\(/);
  });

  it('service returns empty arrays (not 500) when uid has no sumit_customers row', () => {
    expect(SERVICE_SRC).toMatch(/not_synced/);
    // 'available: false, savedMethods: [], documents: []' should appear as the
    // fail-quiet shape at least once for the not-synced path.
    expect(SERVICE_SRC).toMatch(/available:\s*false[\s\S]*savedMethods:\s*\[\][\s\S]*documents:\s*\[\]/);
  });

  it('GET /api/me/sumit/summary is mounted', () => {
    expect(ROUTES_SRC).toMatch(/app\.get\(['"]\/api\/me\/sumit\/summary['"]/);
  });

  it('summary route resolves uid from Firebase session/token — never from client input', () => {
    // Find the actual app.get() call (skip past the leading comment block).
    const routeStart = ROUTES_SRC.indexOf("app.get('/api/me/sumit/summary'");
    expect(routeStart).toBeGreaterThan(0);
    const routeBlock = ROUTES_SRC.slice(routeStart, routeStart + 1200);
    // Uses the shared helper which reads verifySessionCookie / verifyIdToken.
    expect(routeBlock).toMatch(/resolveAuthenticatedUid\s*\(\s*req\s*\)/);
    // Must NOT read a userId from body/query/params.
    expect(routeBlock).not.toMatch(/req\.body\.userId|req\.query\.userId|req\.params\.userId/);
  });

  it('shared uid helper uses verifySessionCookie OR verifyIdToken', () => {
    expect(ROUTES_SRC).toMatch(/async\s+function\s+resolveAuthenticatedUid/);
    const helperStart = ROUTES_SRC.indexOf('function resolveAuthenticatedUid');
    const helperBlock = ROUTES_SRC.slice(helperStart, helperStart + 1200);
    expect(helperBlock).toMatch(/verifySessionCookie/);
    expect(helperBlock).toMatch(/verifyIdToken/);
  });
});
