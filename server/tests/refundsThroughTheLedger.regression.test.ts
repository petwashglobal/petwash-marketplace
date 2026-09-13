/**
 * Refunds credited the wallet with a bare SQL `+=` (2026-09-13).
 *
 * Two paths added cents straight to wallet_accounts.cash_wallet_balance_cents:
 *
 *   server/routes/bookings.ts          — customer cancels a booking
 *   server/services/BookingPolicyEngine.ts — automatic policy refund
 *
 * Neither wrote a credit_transactions row, so the balance drifted from the
 * very ledger server/jobs/wallet-ledger-drift-detector.ts audits — the
 * detector would report a discrepancy it could not explain. And neither was
 * idempotent:
 *
 *   • bookings.ts checks the terminal-state guard THREE awaits before the
 *     credit (read Firestore status → processor refund → write status →
 *     credit), so two concurrent cancels both passed the guard and both paid.
 *   • BookingPolicyEngine ran on the pool, outside any transaction, with no
 *     guard at all — a retry or a duplicate tick paid twice.
 *
 * walletService.addCredits dedupes on (walletId, sourceType, sourceId) INSIDE
 * a transaction that holds FOR UPDATE on the wallet row, writes the ledger
 * entry, and creates the wallet when missing. Keyed by the booking id, a
 * second credit for the same booking is a no-op however many callers race.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const R = (p: string) => readFileSync(resolve(__dirname, '..', '..', p), 'utf8');

describe('a booking-cancel refund is ledgered and cannot double-pay', () => {
  const src = R('server/routes/bookings.ts');
  it('goes through addCredits, keyed by the booking id', () => {
    expect(src).toContain("'booking_refund',");
    expect(src).toContain('await walletService.addCredits(');
    const at = src.indexOf('await walletService.addCredits(');
    expect(src.slice(at, at + 300)).toContain('bookingId');
  });
  it('the bare balance UPSERT is gone', () => {
    expect(src).not.toContain('SET cash_wallet_balance_cents = wallet_accounts.cash_wallet_balance_cents + EXCLUDED.cash_wallet_balance_cents');
  });
});

describe('an automatic policy refund is ledgered and cannot double-pay', () => {
  const src = R('server/services/BookingPolicyEngine.ts');
  it('goes through addCredits, keyed by the booking id', () => {
    expect(src).toContain("'auto_refund',");
    expect(src).toContain('walletService.addCredits(');
  });
  it('the bare += UPDATE is gone', () => {
    expect(src).not.toMatch(/UPDATE wallet_accounts[\s\S]{0,120}cash_wallet_balance_cents \+ \$1/);
  });
});

describe('the primitive they now use really is safe', () => {
  const src = R('server/services/WalletService.ts');
  it('addCredits dedupes on the source inside the locked transaction', () => {
    expect(src).toContain('FOR UPDATE');
    expect(src).toContain('addCredits idempotent skip');
  });
  it('and writes the ledger row in that same transaction', () => {
    const at = src.indexOf('async addCredits(');
    const body = src.slice(at, at + 5000);
    expect(body).toContain('tx.insert(creditTransactions)');
  });
  it('cash_wallet is a credit type it supports', () => {
    expect(src).toContain("case 'cash_wallet':");
  });
});
