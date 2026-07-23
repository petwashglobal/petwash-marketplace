/**
 * Terms page canon (CEO mockup #4): sidebar section nav + a REAL "I Accept"
 * gate that stamps users.accepted_terms_at exactly once (first acceptance is
 * the legally meaningful moment — never overwritten).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const ROOT = resolve(__dirname, '..', '..');
const shell = readFileSync(resolve(ROOT, 'client/src/pages/legal/LegalPage.tsx'), 'utf8');
const terms = readFileSync(resolve(ROOT, 'client/src/pages/legal/CustomerTerms.tsx'), 'utf8');
const api = readFileSync(resolve(ROOT, 'server/routes/legal-consent.ts'), 'utf8');
const routes = readFileSync(resolve(ROOT, 'server/routes.ts'), 'utf8');

describe('terms canon', () => {
  it('/legal/terms renders the CANONICAL CustomerTerms — the old Terms layer is gone', () => {
    const appSrc = readFileSync(resolve(ROOT, 'client/src/App.tsx'), 'utf8');
    const at = appSrc.indexOf('path="/legal/terms"');
    expect(appSrc.slice(at, at + 120)).toMatch(/LegalCustomerTerms/);
    expect(appSrc).not.toMatch(/pages\/legal\/Terms"/);
  });

  it('server endpoints exist, mounted, auth-gated, idempotent on first acceptance', () => {
    expect(api).toMatch(/router\.get\('\/terms-acceptance', validateFirebaseToken/);
    expect(api).toMatch(/router\.post\('\/accept-terms', validateFirebaseToken/);
    expect(api).toMatch(/alreadyAccepted: true/);
    expect(routes).toMatch(/app\.use\('\/api\/legal', apiLimiter, legalConsentRoutes\)/);
  });

  it('shell renders sidebar + mobile chips from toc and the accept gate', () => {
    expect(shell).toMatch(/legal-toc-sidebar/);
    expect(shell).toMatch(/legal-toc-mobile/);
    expect(shell).toMatch(/terms-accept-button/);
    expect(shell).toMatch(/\/api\/legal\/accept-terms/);
  });

  it('CustomerTerms wires all 15 sections into the toc with matching ids', () => {
    expect(terms).toMatch(/toc=\{TERMS_TOC\}/);
    expect(terms).toMatch(/acceptGate/);
    for (let i = 1; i <= 15; i++) {
      expect(terms).toContain(`id: "t${i}"`);
      expect(terms).toContain(`<LegalSection id="t${i}"`);
    }
  });

  it('guests are routed to signup, never a dead button', () => {
    expect(shell).toMatch(/setLocation\("\/signup\?next=/);
  });
});
