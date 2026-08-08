import { describe, it, expect } from 'vitest';
import {
  assertBalanced,
  isBalanced,
  summarizeTransaction,
  deriveAccountBalance,
  deriveIdempotencyKey,
  computeLedgerEntryHash,
  LedgerImbalanceError,
  type LedgerLeg,
} from '../services/LedgerService';

/**
 * The double-entry invariant for the unified ledger v2 (SDD §12).
 * This is the CI-blocking self-check: every real money movement in the ledger MUST
 * balance (SUM debit == SUM credit). It pins the structural guarantees that kill the
 * self-mint / double-pay / balance-drift bug classes — before any service writes to
 * the ledger. Pure (no DB) so it runs in the money-safety gate with zero flakiness.
 */

// A representative scenario matrix — the movements the ledger will actually record.
const SCENARIOS: Array<{ name: string; legs: LedgerLeg[] }> = [
  {
    name: 'wallet top-up (SUMIT clearing → customer cash wallet)',
    legs: [
      { accountId: 'payment_clearing:sumit', direction: 'debit', amountCents: 5000 },
      { accountId: 'cust:u1:cash', direction: 'credit', amountCents: 5000 },
    ],
  },
  {
    name: 'K9000 wash paid from wallet, split into commission + VAT + service revenue',
    legs: [
      { accountId: 'cust:u1:cash', direction: 'debit', amountCents: 5500 },
      { accountId: 'platform_commission_revenue', direction: 'credit', amountCents: 4661 },
      { accountId: 'vat_payable', direction: 'credit', amountCents: 839 },
    ],
  },
  {
    name: 'eGift issued (clearing → eGift liability, VAT deferred to redemption)',
    legs: [
      { accountId: 'payment_clearing:sumit', direction: 'debit', amountCents: 15000 },
      { accountId: 'cust:u2:egift', direction: 'credit', amountCents: 15000 },
    ],
  },
  {
    name: 'escrow hold posted to provider payable on completion (three-way)',
    legs: [
      { accountId: 'escrow_holding', direction: 'debit', amountCents: 30000 },
      { accountId: 'prov:p9:payable', direction: 'credit', amountCents: 25500 },
      { accountId: 'platform_commission_revenue', direction: 'credit', amountCents: 4500 },
    ],
  },
  {
    name: 'refund to wallet credit (commission reversed back to customer cash)',
    legs: [
      { accountId: 'platform_commission_revenue', direction: 'debit', amountCents: 2000 },
      { accountId: 'cust:u1:cash', direction: 'credit', amountCents: 2000 },
    ],
  },
];

describe('ledger v2 — double-entry invariant', () => {
  it('every scenario movement balances (SUM debit == SUM credit)', () => {
    for (const s of SCENARIOS) {
      const totals = assertBalanced(s.legs);
      expect(totals.totalDebits, s.name).toBe(totals.totalCredits);
      expect(isBalanced(s.legs), s.name).toBe(true);
    }
  });

  it('an UNBALANCED movement is rejected (self-mint is structurally impossible)', () => {
    const minted: LedgerLeg[] = [
      { accountId: 'payment_clearing:sumit', direction: 'debit', amountCents: 5000 },
      { accountId: 'cust:u1:cash', direction: 'credit', amountCents: 9999 }, // credited more than debited
    ];
    expect(() => assertBalanced(minted)).toThrow(LedgerImbalanceError);
    expect(isBalanced(minted)).toBe(false);
  });

  it('a single-leg movement is rejected (double-entry requires >=2 legs)', () => {
    expect(() => assertBalanced([{ accountId: 'cust:u1:cash', direction: 'credit', amountCents: 100 }])).toThrow();
  });

  it('non-positive / non-integer amounts are rejected', () => {
    expect(() => summarizeTransaction([{ accountId: 'a', direction: 'debit', amountCents: 0 }])).toThrow();
    expect(() => summarizeTransaction([{ accountId: 'a', direction: 'debit', amountCents: -5 }])).toThrow();
    expect(() => summarizeTransaction([{ accountId: 'a', direction: 'debit', amountCents: 1.5 }])).toThrow();
  });

  it('balances are DERIVED from the entry stream, per the account normal side', () => {
    // Replay two movements against u1's cash wallet: +5000 top-up, -5500 would overdraw,
    // so instead top-up 5000 then spend 2000 → derived balance 3000 (credit-normal liability).
    const stream: LedgerLeg[] = [
      { accountId: 'payment_clearing:sumit', direction: 'debit', amountCents: 5000 },
      { accountId: 'cust:u1:cash', direction: 'credit', amountCents: 5000 },
      { accountId: 'cust:u1:cash', direction: 'debit', amountCents: 2000 },
      { accountId: 'platform_commission_revenue', direction: 'credit', amountCents: 2000 },
    ];
    // cash wallet is a liability (credit-normal): 5000 credit - 2000 debit = 3000
    expect(deriveAccountBalance(stream, 'cust:u1:cash', 'credit')).toBe(3000);
    // SUMIT clearing is an asset (debit-normal): 5000 debit - 0 = 5000
    expect(deriveAccountBalance(stream, 'payment_clearing:sumit', 'debit')).toBe(5000);
    // whole stream still balances end-to-end
    const totals = summarizeTransaction(stream);
    expect(totals.totalDebits).toBe(totals.totalCredits);
  });

  it('idempotency keys are derived from business IDs, never random (anti double-pay)', () => {
    const k1 = deriveIdempotencyKey('wallet_topup', 'BOOK-123', 'PAY-abc');
    const k2 = deriveIdempotencyKey('wallet_topup', 'BOOK-123', 'PAY-abc');
    expect(k1).toBe(k2); // a retry maps to the SAME key
    expect(k1).toBe('wallet_topup:BOOK-123:PAY-abc');
    expect(() => deriveIdempotencyKey('wallet_topup')).toThrow(); // refuses a key with no id
  });

  it('the hash chain is deterministic and changes when any field changes (tamper-evident)', () => {
    const base = {
      previousHash: 'genesis',
      accountId: 'cust:u1:cash',
      direction: 'credit',
      amountCents: 5000,
      currency: 'ILS',
      idempotencyKey: 'wallet_topup:BOOK-123',
      createdAtIso: '2026-08-08T00:00:00.000Z',
    };
    const h1 = computeLedgerEntryHash(base);
    expect(h1).toBe(computeLedgerEntryHash(base)); // deterministic
    expect(computeLedgerEntryHash({ ...base, amountCents: 5001 })).not.toBe(h1); // tamper detected
    expect(computeLedgerEntryHash({ ...base, previousHash: h1 })).not.toBe(h1);  // chained
  });
});
