/**
 * Only SUMIT issues Pet Wash's tax documents. Found 2026-09-17 (after the fake
 * job-complete invoice, #2540): more live places presenting a local document
 * as an official one, and a wrong company number on customer emails.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { execSync } from 'node:child_process';

const ROOT = join(__dirname, '..', '..');
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8');

describe('company number', () => {
  it('516458396 (not Pet Wash) appears nowhere in server/client/shared', () => {
    const hits = execSync('git grep -l 516458396 -- server client shared || true', { cwd: ROOT, encoding: 'utf8' })
      .split('\n').filter((f) => f && !f.includes('fiscalHonestyBatch'));
    expect(hits).toEqual([]);
  });
});

describe('the local receipt email is a payment confirmation', () => {
  const src = read('server/services/IsraeliDigitalReceiptService.ts');
  const body = src.slice(src.indexOf('static async sendReceiptEmail'), src.indexOf('Email sent successfully'));

  it('no legal-receipt claim, says it is not a tax document', () => {
    expect(body).not.toContain('legally valid digital receipt');
    expect(body).not.toContain('מסמך זה מהווה קבלה דיגיטלית');
    expect(body).not.toContain('>קבלה דיגיטלית<');
    expect(body).toContain('This is a payment confirmation, not a tax document.');
    expect(body).toContain('subject: `אישור תשלום ${receipt.receiptNumber}');
  });
});

describe('marketplace booking email', () => {
  const src = read('server/emailService.ts');
  const body = src.slice(src.indexOf('static async sendBookingConfirmation'), src.indexOf('static async sendBookingConfirmation') + 16000);
  it('labels its number a reference, not an invoice', () => {
    expect(body).not.toContain("'מספר חשבונית' : 'Invoice No.'");
    expect(body).not.toContain("'חשבונית' : 'Invoice'");
    expect(body).toContain("'מספר אסמכתא' : 'Reference No.'");
    expect(body).not.toContain("'Service Fee (excl. VAT)'");
  });
});

describe('provider commission PDF', () => {
  const src = read('server/services/IsraeliInvoiceGenerator.ts');
  it('is a statement, not a tax invoice', () => {
    expect(src).not.toContain('"חשבונית מס - Pet Wash Ltd"');
    expect(src).not.toContain('"TAX INVOICE - Pet Wash Ltd"');
    expect(src).not.toContain('This invoice was issued in accordance with Value Added Tax Regulations');
    expect(src).toContain('COMMISSION STATEMENT (not a tax document)');
  });
});

describe('My Account', () => {
  it('does not call the payment list official tax invoices', () => {
    const src = read('client/src/pages/MyAccount.tsx');
    expect(src).not.toContain('All invoices in official Israeli format');
    expect(src).not.toContain("'Full Tax Invoice'");
  });
});
