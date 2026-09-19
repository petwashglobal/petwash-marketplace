import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

/**
 * CEO, 2026-09-19: "transaction id user id".
 *
 * The digital receipt already printed three references — receipt number
 * (מספר אסמכתא), booking number (מספר הזמנה) and transaction number
 * (מספר עסקה) — but nothing tying the document to the customer's ACCOUNT.
 * A support question therefore needed a database lookup to answer.
 *
 * customerId follows the serviceAddress pattern exactly: display-only,
 * attached to the receipt object in memory, never a DB column. (sendReceiptEmail
 * receives the stored row and has no access to `params` — the 2026-07-29 hotfix
 * note in that file explains what happens when you forget that.)
 */
const ROOT = path.resolve(__dirname, '..', '..');
const R = (p: string) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const receipt = R('server/services/IsraeliDigitalReceiptService.ts');

describe('the receipt ties the document to the customer account', () => {
  it('accepts a customerId on the params', () => {
    expect(receipt).toMatch(/customerId\?: string;/);
  });

  it('attaches it in memory beside serviceAddress, not as a DB column', () => {
    expect(receipt).toContain('(receipt as any).customerReference = params.customerId ?? null;');
    // if it ever became a column this test should be revisited deliberately
    expect(receipt).not.toMatch(/customerReference:\s*varchar\(/);
  });

  it('prints it with the other reference numbers', () => {
    expect(receipt).toContain('מספר לקוח');
    // and only when present — a blank line must not appear on the document
    const line = receipt.slice(receipt.indexOf('מספר לקוח') - 120, receipt.indexOf('מספר לקוח'));
    expect(line).toContain('receipt.customerReference ?');
  });

  it.each([
    ['server/routes/walk-my-pet.ts', 'booking.ownerId'],
    ['server/routes/academy.ts', 'booking.userId'],
  ])('%s passes the customer account id', (rel, field) => {
    const src = R(rel);
    const block = src.slice(src.indexOf('customerId:'), src.indexOf('customerId:') + 80);
    expect(block).toContain(field);
  });
});
