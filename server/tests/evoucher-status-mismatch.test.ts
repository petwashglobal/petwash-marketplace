/**
 * PR-W11 — eVoucher status mismatch fix.
 *
 * Pre-PR-W11, the Nayax payment-approval handler created vouchers with
 * status='ACTIVE', but the activate-wallet (and K9000 redeem) routes
 * atomically updated rows where status='ISSUED'. The mismatch meant
 * every freshly-purchased voucher was stuck — the "activate to wallet"
 * button rejected with 400 "expired or invalid".
 *
 * The schema documents the canonical lifecycle as:
 *   ISSUED → CLAIMED/ACTIVE → REDEEMED → EXPIRED/CANCELLED
 * with .default('ISSUED'). PR-W11 aligns the writer to that default,
 * AND broadens the activate-wallet WHERE to accept BOTH 'ISSUED' and
 * 'ACTIVE' so any in-flight legacy voucher remains redeemable.
 *
 * This test pins both halves of the fix in source.
 */

import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const SERVER = path.resolve(__dirname, '..');
const NAYAX_SVC = path.join(SERVER, 'nayaxService.ts');
const GIFT_CARDS = path.join(SERVER, 'routes', 'gift-cards.ts');

const nayaxText = fs.readFileSync(NAYAX_SVC, 'utf8');
const giftCardsText = fs.readFileSync(GIFT_CARDS, 'utf8');

/** Slice the body of `handlePaymentApproved` so we only inspect that flow. */
function sliceHandlePaymentApproved(src: string): string {
  // Anchor on the method declaration, not the call-site, so we land on
  // the function body and not the first occurrence of the identifier.
  const start = src.indexOf('private static async handlePaymentApproved');
  if (start < 0) throw new Error('handlePaymentApproved declaration not found');
  return src.slice(start, start + 5000);
}

/** Slice the body of `POST /:voucherId/activate-wallet`. */
function sliceActivateWalletHandler(src: string): string {
  const start = src.indexOf("'/:voucherId/activate-wallet'");
  if (start < 0) throw new Error('activate-wallet route not found');
  return src.slice(start, start + 4000);
}

describe('PR-W11 — writer side (nayaxService.handlePaymentApproved)', () => {
  const block = sliceHandlePaymentApproved(nayaxText);

  it('inserts new voucher with status: \'ISSUED\' (canonical schema default)', () => {
    // Look for the eVouchers insert object.
    const insertIdx = block.indexOf('db.insert(eVouchers)');
    expect(insertIdx).toBeGreaterThan(0);
    const insertBlock = block.slice(insertIdx, insertIdx + 1500);
    expect(insertBlock).toMatch(/status\s*:\s*['"]ISSUED['"]/);
  });

  it('does NOT write status: \'ACTIVE\' on voucher creation', () => {
    const insertIdx = block.indexOf('db.insert(eVouchers)');
    const insertBlock = block.slice(insertIdx, insertIdx + 1500);
    expect(insertBlock).not.toMatch(/status\s*:\s*['"]ACTIVE['"]/);
  });
});

describe('PR-W11 — reader side (activate-wallet route)', () => {
  const handler = sliceActivateWalletHandler(giftCardsText);

  it('atomic UPDATE accepts BOTH \'ISSUED\' and \'ACTIVE\' (forward + legacy)', () => {
    // The fix uses inArray(eVouchers.status, ['ISSUED', 'ACTIVE']).
    // Any equivalent expression must reference both literals together.
    expect(handler).toMatch(/inArray\s*\(\s*eVouchers\.status\s*,\s*\[\s*['"]ISSUED['"]\s*,\s*['"]ACTIVE['"]\s*\]\s*\)/);
  });

  it('does NOT use the brittle eq(status, \'ISSUED\') check that orphaned ACTIVE vouchers', () => {
    // The legacy single-status check is the bug. Make sure it is gone.
    expect(handler).not.toMatch(/eq\s*\(\s*eVouchers\.status\s*,\s*['"]ISSUED['"]\s*\)/);
  });

  it('on success, transitions voucher to \'REDEEMED\' (terminal)', () => {
    expect(handler).toMatch(/status\s*:\s*['"]REDEEMED['"]/);
  });

  it('still credits the recipient wallet via walletService.addCredits', () => {
    expect(handler).toMatch(/walletService\.addCredits\s*\(/);
    expect(handler).toMatch(/['"]egift['"]/);
  });
});

describe('PR-W11 — drizzle import is updated', () => {
  it('imports `inArray` from drizzle-orm', () => {
    expect(giftCardsText).toMatch(/import\s*\{[^}]*\binArray\b[^}]*\}\s*from\s*['"]drizzle-orm['"]/);
  });
});

describe('PR-W11 — replay safety (atomic UPDATE → returning())', () => {
  const handler = sliceActivateWalletHandler(giftCardsText);

  it('uses .returning() so a second activate call sees zero rows and rejects', () => {
    // The atomic UPDATE WHERE status IN (ISSUED, ACTIVE) flips to
    // REDEEMED — a replay sees status='REDEEMED' which is NOT in the
    // allowed set, so .returning() yields []. The handler then enters
    // the failure branch.
    expect(handler).toMatch(/\.returning\s*\(/);
    expect(handler).toMatch(/already been activated/);
  });
});
