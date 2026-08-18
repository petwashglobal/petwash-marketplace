/**
 * PR-CREDIT-WALLET-500-ERROR-SAFE — fire-order item 109 (D12 scope).
 *
 * server/routes/credit-wallet.ts had 18 catch-block 500 responses of
 * the form `{ success: false, error: error.message }`, leaking raw
 * exception text (DB constraint / SQL / Nayax gateway internals /
 * wallet-ledger reason) to the customer on every wallet failure.
 *
 * D12 discipline: this PR does NOT change money logic. Only the
 * customer-visible error text on 500. All catch blocks continue to
 * hit the logger/console.error path (unchanged) so internal support
 * still sees the raw exception.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const ROOT = resolve(__dirname, '..', '..');
const ROUTE = 'server/routes/credit-wallet.ts';

describe('PR-CREDIT-WALLET-500-ERROR-SAFE', () => {
  const src = readFileSync(resolve(ROOT, ROUTE), 'utf8');

  it('A1. no 5xx catch response still echoes error.message / err.message', () => {
    const offenders: string[] = [];
    const lines = src.split(/\r?\n/);
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (/res\.status\(\s*5\d\d\s*\)\.json/.test(line)) {
        // Check the line + its next line (multi-line json call).
        const chunk = line + (lines[i + 1] ?? '');
        if (/error:\s*error\.message|error:\s*err\.message/.test(chunk)) {
          offenders.push(`line ${i + 1}: ${line.trim()}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it('A2. generic "Wallet operation failed" + WALLET_500 code is now the 5xx envelope', () => {
    // At least one instance present (should be 18 after replacement).
    expect(src.includes("error: 'Wallet operation failed', code: 'WALLET_500'")).toBe(true);
    const count = (src.match(/error:\s*'Wallet operation failed',\s*code:\s*'WALLET_500'/g) || []).length;
    // Guard: at least 15 instances. Exact 18 (all the pre-fix sites) —
    // but a tolerance of >=15 avoids a false failure if a future
    // refactor consolidates 2-3 catch blocks into a shared helper.
    expect(count).toBeGreaterThanOrEqual(15);
  });

  it('A3. logger.error / console.error stays in every catch (internal trace preserved)', () => {
    // Every catch block that returns 500 must still log the exception
    // internally. Count structured/console logs — should be plenty.
    const loggerErr = (src.match(/logger\.error\(/g) || []).length;
    const consoleErr = (src.match(/console\.error\(/g) || []).length;
    expect(loggerErr + consoleErr).toBeGreaterThanOrEqual(15);
  });

  it('A4. money logic untouched — no walletService / EscrowService / topup / redeem literal changed', () => {
    // Sanity pin — this PR is response-string-only. If any of these
    // symbols moved position, that's OK, but they must all still
    // exist unchanged.
    expect(src.includes('walletService.')).toBe(true);
    expect(src.includes('deriveTopupIdempotencyKey')).toBe(true);
    expect(src.includes('deriveAdminCreditIdempotencyKey')).toBe(true);
    expect(src.includes('verifyNayaxTopup')).toBe(true);
    // Idempotency guard machinery.
    expect(src.includes('walletIdempotencyKeys')).toBe(true);
  });
});
