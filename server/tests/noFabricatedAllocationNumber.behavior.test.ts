/**
 * A מספר הקצאה (ITA allocation number) is issued by the Israeli Tax Authority
 * and by NOBODY ELSE. This pins that no path in this codebase invents one.
 *
 * Three different behaviours lived here at once (2026-09-18):
 *
 *   BillingEngine          honest — returns null and warns that a tax invoice
 *                          cannot be issued without an allocation number.
 *   enterprise/israeliTax  MINTED `MOCK-<timestamp>`, wrote it onto the invoice
 *                          as rasaAllocationNumber, stamped the invoice
 *                          'APPROVED_SIMULATION' and answered HTTP 200
 *                          { success: true }. RASA_SUPPLIER_API_KEY is not
 *                          bound in production, so that WAS the live branch.
 *   EgiftFinancialService  wrote the eGift's own id into
 *                          octopus_invoices.allocation_number.
 *
 * Contradictory models in one system is how a made-up government number ends
 * up on a document. These assert the one rule: if the ITA was not asked, there
 * is no number and nothing is approved.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const R = (p: string) => readFileSync(resolve(__dirname, '..', p), 'utf8');

/**
 * Code with the comments stripped.
 *
 * The first version of this test matched its own explanation: the fix's comment
 * quotes the very string it forbids, so a plain grep failed a file for
 * documenting the bug it had removed. Same trap fixed in the SendGrid pin
 * earlier today — a pin that fires on prose teaches people to ignore it.
 */
const code = (src: string): string =>
  src
    .split('\n')
    .filter((l) => {
      const t = l.trim();
      return !t.startsWith('//') && !t.startsWith('*') && !t.startsWith('/*');
    })
    .join('\n');

describe('nothing invents an ITA allocation number', () => {
  const tax = R('enterprise/israeliTax.ts');

  it('the missing-credential branch mints NOTHING', () => {
    const src = code(tax);
    expect(src).not.toMatch(/MOCK-\$\{Date\.now\(\)\}/);
    expect(src).not.toContain('mockAllocationNumber');
    // and never calls the outcome a simulated approval
    expect(src).not.toContain('APPROVED_SIMULATION');
  });

  it('it refuses instead of reporting success', () => {
    // Scope to generateTaxInvoice ONLY. checkInvoiceStatus further down has its
    // own !SUPPLIER_API_KEY branch that legitimately answers 200 — it reports a
    // status and invents nothing. A fixed-size window swallowed it.
    const fnStart = tax.indexOf('export async function generateTaxInvoice');
    const fnEnd = tax.indexOf('export async function checkInvoiceStatus');
    expect(fnStart).toBeGreaterThan(-1);
    expect(fnEnd).toBeGreaterThan(fnStart);
    const fn = tax.slice(fnStart, fnEnd);
    const at = fn.indexOf('if (!SUPPLIER_API_KEY)');
    expect(at).toBeGreaterThan(-1);
    // End at the branch's OWN early return — everything after it is the real
    // ITA path, whose 200s are legitimate successes.
    const endsAt = fn.indexOf('return;', at);
    expect(endsAt).toBeGreaterThan(at);
    const branch = code(fn.slice(at, endsAt));
    expect(branch).toMatch(/res\.status\(503\)/);
    expect(branch).toMatch(/success: false/);
    expect(branch).toMatch(/ITA_NOT_CONFIGURED/);
    // The invoice is marked blocked, not approved, and carries no number.
    expect(branch).toMatch(/status: 'BLOCKED_NO_ITA_CREDENTIAL'/);
    expect(branch).toMatch(/rasaAllocationNumber: null/);
    // A 200 anywhere in this branch would be the old bug returning.
    expect(branch).not.toMatch(/res\.status\(200\)/);
  });

  it('a real allocation number is still required from the real response', () => {
    // The live path must keep throwing when the ITA answers without one.
    expect(tax).toMatch(/const allocationNumber = response\.data\.Allocation_Number/);
    expect(tax).toMatch(/No allocation number received from RASA/);
  });
});

describe('the allocation_number column holds only real ones', () => {
  it('eGift purchases do not put their own id in it', () => {
    const egift = R('services/EgiftFinancialService.ts');
    expect(egift).not.toMatch(/allocationNumber:\s*input\.egiftId/);
    expect(egift).toMatch(/allocationNumber:\s*null/);
  });

  it('the billing stub still refuses to issue a tax invoice without one', () => {
    const be = R('services/BillingEngine.ts');
    expect(be).toMatch(/allocation number required but NOT obtained/i);
    expect(be).toMatch(/return \{ invoiceNumber: null, allocationNumber: null \}/);
  });
});
