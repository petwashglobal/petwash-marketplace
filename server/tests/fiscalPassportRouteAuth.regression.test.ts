/**
 * Fiscal passport route discipline pins — §44/§65/§71/§74 + §94.20-24.
 *
 * Structural pins on:
 *   server/routes/fiscal-passport.ts
 *   server/services/fiscalPassport/customerLister.ts
 *
 * Both must:
 *   • be READ-ONLY (no POST/PATCH/DELETE);
 *   • derive viewer from validateFirebaseToken — never req.body;
 *   • use parameterised SQL on every pool.query;
 *   • enforce the admin route with isSuperAdmin BEFORE reading data;
 *   • use privacy-404 (§34) instead of 403 leaks on non-participants.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const ROUTE = fs.readFileSync(
  path.resolve(__dirname, '..', 'routes', 'fiscal-passport.ts'),
  'utf8',
);
const LISTER = fs.readFileSync(
  path.resolve(__dirname, '..', 'services', 'fiscalPassport', 'customerLister.ts'),
  'utf8',
);

describe('routes/fiscal-passport.ts — READ-ONLY + auth (§65, §71, §94.20-24)', () => {
  it('no POST/PATCH/DELETE routes anywhere', () => {
    expect(ROUTE).not.toMatch(/router\.post\(/);
    expect(ROUTE).not.toMatch(/router\.patch\(/);
    expect(ROUTE).not.toMatch(/router\.delete\(/);
    expect(ROUTE).not.toMatch(/router\.put\(/);
    expect(ROUTE).toMatch(/router\.get\(/);
  });

  it('resolveViewer reads only from validateFirebaseToken (never req.body)', () => {
    expect(ROUTE).toMatch(/function\s+resolveViewer[\s\S]*?firebaseUser\?\.uid/);
    expect(ROUTE).not.toMatch(/uid\s*=\s*req\.body\./);
    expect(ROUTE).not.toMatch(/uid\s*=\s*req\.query\./);
    expect(ROUTE).not.toMatch(/kind\s*=\s*req\.body\./);
  });

  it('actor kind derives from isSuperAdmin — customer default (§74)', () => {
    expect(ROUTE).toMatch(/isSuperAdmin\(email\)\s*\?\s*['"]PETWASH_STAFF['"]\s*:\s*['"]CUSTOMER['"]/);
  });

  it('unknown-source guard is a whitelist, not a wildcard', () => {
    expect(ROUTE).toMatch(/KNOWN_SOURCES\.includes\(source\)/);
    expect(ROUTE).toMatch(/UNKNOWN_SOURCE/);
  });

  it('customer detail path uses privacy-404 on non-participant, never 403', () => {
    // The customer /by-source/... route must return 404 when the
    // composer refuses. Ban 403 in the customer-facing route section.
    const customerRoute = ROUTE.slice(
      ROUTE.indexOf("router.get('/transactions/by-source"),
      ROUTE.indexOf("router.get('/admin/by-source"),
    );
    expect(customerRoute).toMatch(/return\s+res\.status\(404\)/);
    expect(customerRoute).not.toMatch(/return\s+res\.status\(403\)/);
  });

  it('admin route asserts PETWASH_STAFF BEFORE reading data (§59, §71)', () => {
    const adminRoute = ROUTE.slice(ROUTE.indexOf("router.get('/admin/by-source"));
    expect(adminRoute).toMatch(/viewer\.kind\s*!==\s*['"]PETWASH_STAFF['"]/);
    // 403 admin-only — read never happens for non-admins.
    expect(adminRoute).toMatch(/return\s+res\.status\(403\)/);
    // The composeFiscalPassport call sits AFTER the 403.
    const gateIdx = adminRoute.indexOf("res.status(403)");
    const composerIdx = adminRoute.indexOf("composeFiscalPassport");
    expect(gateIdx).toBeGreaterThan(-1);
    expect(composerIdx).toBeGreaterThan(-1);
    expect(gateIdx).toBeLessThan(composerIdx);
  });
});

describe('services/fiscalPassport/customerLister.ts — §71 uid-scoping', () => {
  it('every pool.query is parameterised — customerUid or email flows through $1/$2', () => {
    // Each query must contain a $1 placeholder AND pass customerUid
    // (or customerEmail) as the first arg. Ban any template
    // interpolation of the uid into the SQL string.
    const templateReads = [...LISTER.matchAll(/pool\.query\(\s*`([^`]+)`\s*,\s*\[[^\]]+\]/g)];
    expect(templateReads.length).toBeGreaterThanOrEqual(3);
    for (const m of templateReads) {
      const sql = m[1];
      expect(sql).toMatch(/\$1/);
    }
    // Ban ${input.customerUid} anywhere in a raw SQL literal.
    expect(LISTER).not.toMatch(/`[^`]*WHERE[^`]*\$\{input\.customerUid\}/);
    expect(LISTER).not.toMatch(/`[^`]*WHERE[^`]*\$\{input\.customerEmail\}/);
  });

  it('42P01 (missing table) is swallowed — fresh envs never 500 the list', () => {
    // The swallow() helper drops PostgreSQL error 42P01 (undefined_table)
    // so the customer sees the sources that DO exist instead of a 500.
    expect(LISTER).toMatch(/if\s*\(code\s*===\s*['"]42P01['"]\)\s*return/);
  });

  it('label + documentType come from the CPA mapping — never invented at the row level', () => {
    // The docTypeFor helper calls getSumitDocumentMapping via
    // paymentClassForEvent — the single tax authority.
    expect(LISTER).toMatch(/paymentClassForEvent\(event\)/);
    expect(LISTER).toMatch(/getSumitDocumentMapping\(cls\)/);
    // Ban a hand-typed documentType literal outside docTypeFor.
    const beforeHelper = LISTER.slice(0, LISTER.indexOf('function docTypeFor'));
    expect(beforeHelper).not.toMatch(/documentType:\s*['"](InvoiceAndReceipt|Receipt|Invoice|CreditInvoice)['"]/);
  });

  it('walk transactions are honestly reported as NOT_REQUIRED (§24)', () => {
    // A regression that flipped walks to PAID without a rail would
    // manufacture receipts. Anchor on the walkRows fetch so the type
    // union at the top of the file doesn't false-match "PAID".
    const walkStart = LISTER.indexOf('const walkRows');
    const walkEnd = LISTER.indexOf('const academyRows');
    expect(walkStart).toBeGreaterThan(-1);
    expect(walkEnd).toBeGreaterThan(walkStart);
    const walkBlock = LISTER.slice(walkStart, walkEnd);
    expect(walkBlock).toMatch(/paymentState:\s*['"]NOT_REQUIRED['"]/);
    expect(walkBlock).not.toMatch(/paymentState:\s*['"]PAID['"]/);
  });
});
