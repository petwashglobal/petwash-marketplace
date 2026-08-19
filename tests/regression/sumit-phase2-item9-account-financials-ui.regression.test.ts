import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

// Regression pin for CEO 2026-08-19 SUMIT Phase 2 Item 9 — the Account >
// Documents / Payments UI. Locks in:
//   (a) client/src/pages/AccountFinancials.tsx exists and mounts the
//       /api/me/sumit/summary query (never fabricates data).
//   (b) Two sections rendered: Documents/Invoices + Saved Payment Methods.
//   (c) Bilingual HE + EN via useLanguage().
//   (d) Honest loading, empty, error states (no fake data).
//   (e) Routed in App.tsx behind RequireAuth at /account/financials.
//   (f) data-testids present.

const PAGE_SRC = readFileSync(
  join(__dirname, '..', '..', 'client', 'src', 'pages', 'AccountFinancials.tsx'),
  'utf8',
);
const APP_SRC = readFileSync(
  join(__dirname, '..', '..', 'client', 'src', 'App.tsx'),
  'utf8',
);

describe('SUMIT Phase 2 Item 9 — Account > Documents / Payments UI', () => {
  it('page consumes GET /api/me/sumit/summary via useQuery', () => {
    expect(PAGE_SRC).toMatch(/useQuery/);
    expect(PAGE_SRC).toMatch(/['"]\/api\/me\/sumit\/summary['"]/);
  });

  it('renders two sections: Documents and Saved Payment Methods', () => {
    expect(PAGE_SRC).toMatch(/data-testid="financials-documents-card"/);
    expect(PAGE_SRC).toMatch(/data-testid="financials-methods-card"/);
  });

  it('bilingual — uses useLanguage() with HE + EN branches', () => {
    expect(PAGE_SRC).toMatch(/useLanguage/);
    // Presence of the Hebrew title AND its English pair is the pin.
    expect(PAGE_SRC).toMatch(/'תשלומים ומסמכים'/);
    expect(PAGE_SRC).toMatch(/'Payments & Documents'/);
  });

  it('honest states — loading skeleton, empty, and error blocks all present', () => {
    expect(PAGE_SRC).toMatch(/Skeleton/);
    expect(PAGE_SRC).toMatch(/data-testid="documents-empty"/);
    expect(PAGE_SRC).toMatch(/data-testid="methods-empty"/);
    expect(PAGE_SRC).toMatch(/data-testid="financials-error"/);
  });

  it('imports card + badge + skeleton from @/components/ui/*', () => {
    expect(PAGE_SRC).toMatch(/from\s+['"]@\/components\/ui\/card['"]/);
    expect(PAGE_SRC).toMatch(/from\s+['"]@\/components\/ui\/badge['"]/);
    expect(PAGE_SRC).toMatch(/from\s+['"]@\/components\/ui\/skeleton['"]/);
  });

  it('does not fabricate data — no hardcoded card brand / invoice number', () => {
    // Sanity: the page must not carry a demo Visa/Mastercard number or a
    // sample document number that could ship as fake data.
    expect(PAGE_SRC).not.toMatch(/4111\s?1111\s?1111\s?1111/);
    expect(PAGE_SRC).not.toMatch(/const\s+demoDocuments\s*=/);
    expect(PAGE_SRC).not.toMatch(/const\s+demoMethods\s*=/);
  });

  it('mounted in App.tsx behind RequireAuth at /account/financials', () => {
    expect(APP_SRC).toMatch(/lazy\(\(\)\s*=>\s*import\(['"]@\/pages\/AccountFinancials['"]\)\)/);
    expect(APP_SRC).toMatch(/<Route\s+path="\/account\/financials">/);
    // Sanity: the AccountFinancials route block must wrap in RequireAuth so
    // the summary query never fires without a signed-in Firebase session.
    const start = APP_SRC.indexOf('<Route path="/account/financials">');
    const end = APP_SRC.indexOf('</Route>', start);
    expect(start).toBeGreaterThan(0);
    expect(end).toBeGreaterThan(start);
    const routeBlock = APP_SRC.slice(start, end);
    expect(routeBlock).toMatch(/RequireAuth/);
    expect(routeBlock).toMatch(/AccountFinancials/);
  });
});
