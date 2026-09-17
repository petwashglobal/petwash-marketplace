import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'fs';
import { join, resolve } from 'path';
import { buildPaymentConfirmationEmail } from '../email/templates/payment-confirmation-2026';
import { ISRAELI_TAX_CONFIG } from '../../shared/israeliTax';

const ROOT = resolve(__dirname, '..', '..');

describe('payment confirmation email (the maison letter)', () => {
  const base = {
    amountIls: 56.35, cardLast4: '4935', paidAt: new Date('2026-09-17T09:34:07Z'),
    reference: 'BR-1234', itemDescription: 'Walk My Pet · 60 min', documentUrl: 'https://pay.sumit.co.il/x',
    documentLabel: 'חשבונית מס/קבלה',
  };
  it('Hebrew by default, RTL, with amount, card, reference and the document button', () => {
    const e = buildPaymentConfirmationEmail({ ...base, customerName: 'ניר' });
    expect(e.subject).toBe('התשלום התקבל · ₪56.35');
    expect(e.html).toContain('dir="rtl"');
    expect(e.html).toContain('>56<');
    expect(e.html).toContain('.35<');
    expect(e.html).toContain('•••• 4935');
    expect(e.html).toContain('BR-1234');
    expect(e.html).toContain('לצפייה בחשבונית מס/קבלה');
    expect(e.html).toContain('href="https://pay.sumit.co.il/x"');
    expect(e.text).toContain('**** 4935');
  });
  it('English when asked, LTR', () => {
    const e = buildPaymentConfirmationEmail({ ...base, language: 'en', documentLabel: 'Tax invoice / receipt' });
    expect(e.subject).toBe('Payment received · ₪56.35');
    expect(e.html).toContain('dir="ltr"');
    expect(e.html).toContain('View Tax invoice / receipt');
  });
  it('without a document it says one will follow, and shows no button', () => {
    const e = buildPaymentConfirmationEmail({ ...base, documentUrl: null });
    expect(e.html).not.toContain('pay.sumit.co.il');
    expect(e.html).toContain('המסמך החשבונאי יישלח אליך בנפרד');
  });
  it('escapes customer-provided text', () => {
    const e = buildPaymentConfirmationEmail({ ...base, customerName: '<img src=x onerror=1>', itemDescription: '"><script>' });
    expect(e.html).not.toContain('<img src=x');
    expect(e.html).not.toContain('<script>');
  });
  it('carries the official company identity', () => {
    const e = buildPaymentConfirmationEmail(base);
    expect(e.html).toContain('ח.פ. 517145033');
    expect(e.html).toContain('עוזי חיטמן 8, ראש העין');
    expect(e.html).toContain('פט וואש בע&quot;מ');
  });
});

describe('one company identity everywhere', () => {
  it('the tax config fallback is Pet Wash’s real number', () => {
    const src = readFileSync(join(ROOT, 'shared/israeliTax.ts'), 'utf8');
    expect(src).toContain('process.env.COMPANY_TAX_ID || FINANCE_COMPANY_TAX_ID');
    if (!process.env.COMPANY_TAX_ID) expect(ISRAELI_TAX_CONFIG.COMPANY_TAX_ID).toBe('517145033');
  });

  function walk(dir: string, out: string[] = []): string[] {
    for (const n of readdirSync(dir)) {
      if (n === 'node_modules' || n === 'tests' || n === '__tests__' || n === 'dist') continue;
      const p = join(dir, n);
      if (statSync(p).isDirectory()) walk(p, out);
      else if (/\.(ts|tsx)$/.test(n) && !/\.test\./.test(n)) out.push(p);
    }
    return out;
  }
  it('no source file prints a wrong company number or the "פט ווש" spelling', () => {
    const bad: string[] = [];
    for (const f of [...walk(join(ROOT, 'server')), ...walk(join(ROOT, 'client/src')), ...walk(join(ROOT, 'shared'))]) {
      readFileSync(f, 'utf8').split('\n').forEach((line, i) => {
        if (/^\s*(\/\/|\*)/.test(line) || /\/\/ was /.test(line)) return;
        if (/515895671|516047073|515234567|פט ווש(?!ו)/.test(line)) bad.push(`${f.slice(ROOT.length + 1)}:${i + 1}`);
      });
    }
    expect(bad).toEqual([]);
  });
});
