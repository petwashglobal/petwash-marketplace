/**
 * Regression pins for the SUMIT Phase 2 wire-up (CEO 2026-08-16).
 *
 * These tests fire on grep — cheap, no DB/HTTP needed. Guards against a
 * regression that would:
 *  - remove the fire-and-forget SUMIT customer sync from activation
 *  - accept a browser-supplied uid in the /api/me/invoices/portal-url route
 *  - remove SearchMode:"Automatic" (SUMIT-side dedup)
 *  - drop --commit safety on the backfill script
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const readSrc = (p: string) => readFileSync(resolve(__dirname, p), 'utf8');

describe('SUMIT wire-up — activation hook', () => {
  const ACT = readSrc('../services/ActivationService.ts');

  it('_onFullActivation dispatches fireAndForgetSync', () => {
    // The call MUST live inside _onFullActivation and MUST use the
    // fire-and-forget wrapper (not the plain syncForUser), because
    // signup must never slow down or fail on SUMIT hiccup.
    const start = ACT.indexOf('async function _onFullActivation');
    expect(start).toBeGreaterThan(-1);
    const block = ACT.slice(start, start + 6000);
    expect(block).toContain('fireAndForgetSync');
    expect(block).toContain("'signup'");
  });

  it('does NOT await the SUMIT call inside the activation function', () => {
    const start = ACT.indexOf('async function _onFullActivation');
    const block = ACT.slice(start, start + 6000);
    // fireAndForgetSync is a void-returning function, so should NOT be
    // preceded by `await` — otherwise we could re-block the activation.
    expect(block).not.toMatch(/await\s+fireAndForgetSync/);
  });

  it('never sends national-id / bank / tax fields to SUMIT from activation', () => {
    const start = ACT.indexOf('async function _onFullActivation');
    const block = ACT.slice(start, start + 6000);
    for (const forbidden of ['idNumber', 'nationalId', 'teudatZehut', 'bankAccount', 'iban']) {
      expect(block).not.toContain(forbidden);
    }
  });
});

describe('SUMIT wire-up — GET /api/me/invoices/portal-url', () => {
  const ROUTES = readSrc('../../server/routes.ts');

  it('the route is mounted', () => {
    expect(ROUTES).toContain("app.get('/api/me/invoices/portal-url'");
  });

  it('the route resolves uid from cookie or Bearer — NEVER from request body/query', () => {
    const idx = ROUTES.indexOf("app.get('/api/me/invoices/portal-url'");
    expect(idx).toBeGreaterThan(-1);
    const block = ROUTES.slice(idx, idx + 2500);
    expect(block).toContain('verifySessionCookie');
    expect(block).toContain('verifyIdToken');
    // Must NOT read uid from request body/query — that would allow
    // User A to pass in User B's uid and see B's portal URL.
    expect(block).not.toMatch(/req\.query\.uid/);
    expect(block).not.toMatch(/req\.body\.uid/);
    expect(block).not.toMatch(/req\.body\?\.uid/);
    expect(block).not.toMatch(/req\.query\?\.uid/);
  });

  it('the route calls getCustomerHistoryUrl (server-resolved read helper)', () => {
    const idx = ROUTES.indexOf("app.get('/api/me/invoices/portal-url'");
    const block = ROUTES.slice(idx, idx + 2500);
    expect(block).toContain('getCustomerHistoryUrl');
  });
});

describe('SUMIT wire-up — backfill safety', () => {
  const SCRIPT = readSrc('../../scripts/backfill-sumit-customers.ts');

  it('defaults commit to false (DRY RUN)', () => {
    expect(SCRIPT).toContain('commit: false');
    // Must NOT default to commit:true; the CEO's explicit instruction
    // is "First DRY RUN".
    expect(SCRIPT).not.toContain('commit: true,');
  });

  it('requires --commit flag before performing writes', () => {
    expect(SCRIPT).toContain("if (a === '--commit') args.commit = true");
  });

  it('uses the syncForUser service (which uses SearchMode:"Automatic" server-side)', () => {
    // Backfill MUST reuse the same service the runtime path uses.
    // That service passes SearchMode:"Automatic" — dedup on SUMIT side.
    expect(SCRIPT).toContain("syncForUser");
    expect(SCRIPT).toContain("'backfill'");
  });
});
