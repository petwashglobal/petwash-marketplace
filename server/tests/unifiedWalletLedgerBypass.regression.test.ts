/**
 * Money-integrity pin — UnifiedWalletService must never bypass the wallet ledger.
 *
 * Board item "Swallowed writes set" / H5-class hole (master-leftbehind-board):
 * `POST /api/unified/wallet/deduct-funds` is a LIVE authenticated route that moved
 * real money out of a user's wallet with a raw `db.update(walletAccounts)` —
 * decrementing promo then cash — and wrote NOTHING to wallet_ledger_entries.
 *
 * Consequences of the old code:
 *   - real funds left the wallet with no audit row and no hash-chain link,
 *   - the ledger drift-detector would trip permanently on the gap,
 *   - the returned txId (`UNI-DEB-…`) existed only in the HTTP response —
 *     it was never persisted anywhere,
 *   - no idempotency: a retried request debited twice,
 *   - no velocity / fraud checks.
 *
 * The fix routes the deduction through `WalletLedger.deductFromWallet`, which owns
 * the row lock, multi-bucket deduction, idempotency, fraud checks and the hash
 * chain. Critically the raw UPDATE had to be REMOVED — running both would
 * double-debit the customer.
 *
 * Source-pin test (no DB): asserts the bypass cannot silently return.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const ROOT = resolve(__dirname, '..', '..');
const svc = readFileSync(resolve(ROOT, 'server/services/UnifiedWalletService.ts'), 'utf8');
const route = readFileSync(resolve(ROOT, 'server/routes/unified-platform.ts'), 'utf8');

/** Body of UnifiedWalletService.deductFunds, comments stripped. */
function deductFundsBody(): string {
  const start = svc.indexOf('async deductFunds(');
  expect(start, 'deductFunds must exist in UnifiedWalletService').toBeGreaterThan(-1);
  // Next method begins at the following `\n  async ` — good enough to bound the body.
  const rest = svc.slice(start + 10);
  const nextMethod = rest.indexOf('\n  async ');
  const body = nextMethod === -1 ? rest : rest.slice(0, nextMethod);
  return body.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

describe('UnifiedWalletService.deductFunds — must go through the hash-chained ledger', () => {
  it('delegates to WalletLedger.deductFromWallet', () => {
    expect(deductFundsBody()).toMatch(/deductFromWallet\s*\(/);
  });

  it('does NOT decrement wallet_accounts directly (that bypassed the ledger)', () => {
    const body = deductFundsBody();
    // The old bypass: db.update(walletAccounts).set({ ...balance cents... })
    expect(body).not.toMatch(/db\s*\.\s*update\s*\(\s*walletAccounts\s*\)/);
    expect(body).not.toMatch(/cashWalletBalanceCents\s*:/);
    expect(body).not.toMatch(/promoBalanceCents\s*:/);
  });

  it('does not mint a fake un-persisted transaction id', () => {
    // `UNI-DEB-<nanoid>` was returned to the caller but never stored anywhere.
    expect(deductFundsBody()).not.toMatch(/UNI-DEB-/);
  });

  it('route maps the ledger error codes to honest status codes', () => {
    // The old check compared against 'Insufficient balance' — never thrown — so a
    // broke wallet produced a 500 instead of a 400.
    expect(route).not.toMatch(/error\.message === 'Insufficient balance'/);
    expect(route).toMatch(/INSUFFICIENT_BALANCE/);
    expect(route).toMatch(/VELOCITY_EXCEEDED/);
  });
});
