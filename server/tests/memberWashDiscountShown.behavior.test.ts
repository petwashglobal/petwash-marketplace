/**
 * /begin takes the member wash discount off K9000 wash SKUs server-side, but
 * the checkout page and the packages page only ever rendered the catalog's
 * gross price: a Prestige Basic member saw ₪450 on the button and was charged
 * ₪427.50 — in their favour, yet the page never said so and the receipt did
 * not match the page.
 */
import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

vi.mock('../db', () => ({ db: {}, pool: {} }));
vi.mock('../lib/logger', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }));
vi.mock('./loyalty', () => ({ getLoyaltyStatus: vi.fn() }));

import { applyWashDiscountCents } from '../services/memberDiscount';

const ROOT = join(__dirname, '..', '..');
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8');

describe('the page shows the same discount /begin applies', () => {
  it('there is a read-only endpoint for the member\'s own discount', () => {
    const src = read('server/routes/payments-sumit.ts');
    expect(src).toContain("router.get('/my-wash-discount', validateFirebaseToken,");
    const handler = src.slice(src.indexOf("router.get('/my-wash-discount'"), src.indexOf("router.post('/begin'"));
    expect(handler).toContain('const uid = req.firebaseUser?.uid;');
    expect(handler).toContain('await resolveWashDiscount(uid)');
    expect(handler).not.toMatch(/req\.(body|query|params)\.(uid|userId)/);
  });

  it('checkout subtracts it from the total it displays', () => {
    const src = read('client/src/pages/CheckoutCanon.tsx');
    expect(src).toContain("'/api/payments/sumit/my-wash-discount'");
    expect(src).toContain('const memberDiscountCents = memberPercent > 0');
    expect(src).toContain('Math.max(0, (product?.amountCents ?? 0) - memberDiscountCents)');
    expect(src).toContain('data-testid="member-wash-discount"');
  });

  it('the packages page says a further % comes off at payment', () => {
    const src = read('client/src/pages/Packages.tsx');
    expect(src).toContain('data-testid="member-wash-discount-note"');
    expect(src).toContain('memberPercent > 0');
  });

  it('₪450 package at 5% → ₪427.50, the amount /begin charges', () => {
    expect(applyWashDiscountCents(450_00, 5)).toEqual({ netCents: 427_50, discountCents: 22_50, percent: 5 });
    expect(Math.round((450_00 * 5) / 100)).toBe(22_50); // the screen's own arithmetic
  });

  it('a non-member changes nothing', () => {
    expect(applyWashDiscountCents(450_00, 0).netCents).toBe(450_00);
  });
});
