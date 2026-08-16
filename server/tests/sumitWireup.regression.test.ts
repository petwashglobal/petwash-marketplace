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
    expect(SCRIPT).not.toContain('commit: true,');
  });

  it('requires --commit flag before performing writes', () => {
    expect(SCRIPT).toContain("if (a === '--commit') args.commit = true");
  });

  it('uses the syncForUser service (which uses SearchMode:"Automatic" server-side)', () => {
    expect(SCRIPT).toContain("syncForUser");
    expect(SCRIPT).toContain("'backfill'");
  });

  it('never prints raw uid / name / email / phone (CEO 2026-08-16 PII rule)', () => {
    // MUST use the mask helpers, NOT interpolate raw values into logs.
    expect(SCRIPT).toContain('maskUid');
    expect(SCRIPT).toContain('maskName');
    expect(SCRIPT).toContain('maskEmail');
    expect(SCRIPT).toContain('maskPhone');
    // No template that dumps the raw uid, email, or phone verbatim.
    expect(SCRIPT).not.toMatch(/\$\{u\.email\s*\?\?\s*['"]/);
    expect(SCRIPT).not.toMatch(/\$\{u\.phone\s*\?\?\s*['"]/);
    expect(SCRIPT).not.toMatch(/name="\$\{displayName\}"/);
    expect(SCRIPT).not.toMatch(/uid=\$\{u\.id\}/);
  });
});

describe('PII mask helpers', () => {
  it('maskUid / maskName / maskEmail / maskPhone exist and never return the raw value', async () => {
    const { maskUid, maskName, maskEmail, maskPhone } = await import('../lib/piiMask');
    const uid = 'abcdef123456xyz';
    const name = 'Alice Middle Cohen';
    const email = 'alice.cohen@petwash.co.il';
    const phone = '+972501234567';
    const maskedUid = maskUid(uid);
    const maskedName = maskName(name);
    const maskedEmail = maskEmail(email);
    const maskedPhone = maskPhone(phone);
    expect(maskedUid).not.toBe(uid);
    expect(maskedUid).not.toContain('bcdef');
    expect(maskedName).not.toContain('Cohen');
    expect(maskedEmail).not.toContain('alice');
    expect(maskedEmail).not.toContain('petwash');
    expect(maskedPhone).not.toContain('50123');
  });
});

describe('SUMIT wire-up — CustomerHistoryURL is refreshed via getdetailsurl', () => {
  const SVC = readSrc('../services/SumitCustomerService.ts');
  const CLIENT = readSrc('../services/SumitClient.ts');

  it('SumitClient exposes getCustomerDetailsUrl', () => {
    expect(CLIENT).toContain('async getCustomerDetailsUrl(');
    expect(CLIENT).toContain('/accounting/customers/getdetailsurl/');
  });

  it('getCustomerHistoryUrl refreshes via getCustomerDetailsUrl (CustomerID is canonical)', () => {
    const start = SVC.indexOf('export async function getCustomerHistoryUrl');
    expect(start).toBeGreaterThan(-1);
    const block = SVC.slice(start, start + 3000);
    expect(block).toContain('client.getCustomerDetailsUrl');
    // Falls back to cache when the refresh call fails (SUMIT down, etc.).
    expect(block).toContain('cachedUrl');
  });

  it('getSumitCustomerId helper exists (canonical mapping identity)', () => {
    expect(SVC).toContain('export async function getSumitCustomerId');
  });
});

describe('SUMIT wire-up — MyInvoicesLink is mounted in the real Account UI', () => {
  const MYACC = readSrc('../../client/src/pages/MyAccount.tsx');

  it('imports MyInvoicesLink', () => {
    expect(MYACC).toContain("import MyInvoicesLink from '@/components/account/MyInvoicesLink'");
  });

  it('renders MyInvoicesLink inside the documents tab', () => {
    const docsIdx = MYACC.indexOf('<TabsContent value="documents"');
    const nextTabIdx = MYACC.indexOf('<TabsContent value=', docsIdx + 1);
    expect(docsIdx).toBeGreaterThan(-1);
    const block = MYACC.slice(docsIdx, nextTabIdx > 0 ? nextTabIdx : docsIdx + 20000);
    expect(block).toContain('<MyInvoicesLink');
  });
});
