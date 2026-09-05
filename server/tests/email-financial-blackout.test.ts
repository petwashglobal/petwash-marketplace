/**
 * Financial/legal email blackout guard (audit B-3).
 *
 * EmailService.sendTaxInvoice() and its 6 financial siblings (transaction report,
 * revenue report, VAT declaration, employee expense, blank expense form, sample VAT
 * submission) previously did `return true` when SendGrid was unconfigured — a fake
 * success for legal tax/finance documents. If ever wired to real callers, that is a
 * silent legal-receipt loss.
 *
 * They now funnel through EmailService.unconfiguredEmailResult(), which in
 * production logs loudly + writes ONE critical audit row + returns FALSE, keeping
 * only the dev no-op convenience.
 */

import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const emailSrc = fs.readFileSync(path.resolve(__dirname, '..', 'emailService.ts'), 'utf8');

describe('unconfiguredEmailResult — loud, no fake success in production', () => {
  const start = emailSrc.indexOf('private static unconfiguredEmailResult(');
  const slice = emailSrc.slice(start, start + 1300);

  it('exists as a shared helper', () => {
    expect(start).toBeGreaterThan(-1);
  });

  it('returns FALSE and writes a critical audit row in production', () => {
    expect(slice).toMatch(/process\.env\.NODE_ENV === 'production'/);
    expect(slice).toContain('EMAIL_DISABLED_IN_PRODUCTION');
    expect(slice).toContain('prodBlackoutReported');
    expect(slice).toMatch(/return false;/);
  });

  it('keeps the dev no-op convenience (return true) only outside production', () => {
    // The dev return-true must come AFTER the production return-false branch.
    const prodFalse = slice.indexOf('return false;');
    const devTrue = slice.lastIndexOf('return true;');
    expect(prodFalse).toBeGreaterThan(-1);
    expect(devTrue).toBeGreaterThan(prodFalse);
  });
});

describe('financial email methods route through the guard (no lingering fake success)', () => {
  const methods = [
    { name: 'sendTaxInvoice', kind: 'tax invoice' },
    { name: 'sendTransactionReport', kind: 'transaction report' },
    { name: 'sendRevenueReport', kind: 'revenue report' },
    { name: 'sendVATDeclarationNotification', kind: 'VAT declaration notification' },
    { name: 'sendEmployeeExpenseNotification', kind: 'employee expense notification' },
    { name: 'sendBlankExpenseFormDraft', kind: 'blank expense form draft' },
    { name: 'sendSampleVATSubmissionTaxAuthority', kind: 'sample VAT submission' },
  ];

  for (const m of methods) {
    it(`${m.name}() delegates its unconfigured branch to unconfiguredEmailResult`, () => {
      const start = emailSrc.indexOf(`static async ${m.name}(`);
      expect(start).toBeGreaterThan(-1);
      // Inspect from the method start up to the first try{ (the guard branch).
      const tryIdx = emailSrc.indexOf('try {', start);
      const slice = emailSrc.slice(start, tryIdx > -1 ? tryIdx : start + 1200);
      expect(slice).toContain('unconfiguredEmailResult(');
      expect(slice).toContain(m.kind);
      // The old fake-success comment/return must be gone from this branch.
      expect(slice).not.toContain('Return true for development');
    });
  }
});
