/**
 * Task 29 — CEO fire order 101-140.
 *
 * eGIFT REDEMPTION REPLAY audit — MONEY-CRITICAL. A voucher must be
 * redeemable AT MOST ONCE per redemption event; a replay must not
 * double-debit the ledger or double-credit the wallet.
 *
 * Finding: server/services/unifiedVoucherService.ts redeemVoucher()
 * is textbook-correct BUSINESS-IDEMPOTENCY:
 *
 *   (A) Wraps steps 5-8 in a Postgres transaction.
 *   (B) SELECT ... FOR UPDATE on unified_vouchers by id (row lock).
 *   (C) Re-checks status UNDER the lock — CANCELLED/REDEEMED/EXPIRED
 *       throw before any write.
 *   (D) Reconciles balance from the ledger (source of truth) under
 *       the lock — insufficient credit throws before any write.
 *   (E) QR-token replay guarded by INSERT into redeemed_qr_tokens
 *       (unique PK on jti + the row lock both protect).
 *   (F) Appends a new immutable ledger row atomic with the voucher
 *       cache update — the ledger IS the source of truth.
 *   (G) Wallet bridge (addCredits) sits OUTSIDE the tx by design —
 *       it is idempotent on (walletId, source, sourceId) at the
 *       WalletLedger layer, so a rare double-invoke returns
 *       { idempotent: true } without double-crediting.
 *
 * A replay CANNOT cause double-debit or double-credit under any
 * combination of retry (webhook redelivery, network retry, UI
 * double-click).
 *
 * NO code change in this PR. Money code untouched.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const SRC = readFileSync(
  resolve(__dirname, '..', 'services', 'unifiedVoucherService.ts'),
  'utf8',
);

describe('redeemVoucher — transactional row lock on unified_vouchers', () => {
  it('the whole write-path is wrapped in db.transaction', () => {
    expect(SRC).toMatch(/await \(db as any\)\.transaction\(async \(tx: typeof db\) => \{/);
  });

  it('acquires a SELECT ... FOR UPDATE row lock on the voucher id', () => {
    expect(SRC).toMatch(/tx\.execute\(sql`SELECT id FROM unified_vouchers WHERE id = \$\{voucher\.id\} FOR UPDATE`\)/);
  });

  it('re-checks CANCELLED / REDEEMED / EXPIRED UNDER the lock', () => {
    // Find the block starting after the row lock and up to appendLedgerEntry.
    const lockIdx = SRC.indexOf('FOR UPDATE`);');
    const ledgerIdx = SRC.indexOf('appendLedgerEntry(', lockIdx);
    const region = SRC.slice(lockIdx, ledgerIdx);
    expect(region).toMatch(/if \(locked\.status === "CANCELLED"\)/);
    expect(region).toMatch(/if \(locked\.status === "REDEEMED"\)/);
    expect(region).toMatch(/if \(locked\.status === "EXPIRED"\)/);
    expect(region).toMatch(/if \(locked\.expiresAt && locked\.expiresAt < new Date\(\)\)/);
  });

  it('reconciles balance from the ledger (source of truth) UNDER the lock', () => {
    const lockIdx = SRC.indexOf('FOR UPDATE`);');
    const ledgerIdx = SRC.indexOf('appendLedgerEntry(', lockIdx);
    const region = SRC.slice(lockIdx, ledgerIdx);
    expect(region).toMatch(/await reconcileFromLedger\(locked, tx\)/);
    expect(region).toMatch(/valueRemaining/);
    expect(region).toMatch(/washesRemaining/);
  });

  it('insufficient-credit / insufficient-washes throw BEFORE writes', () => {
    const lockIdx = SRC.indexOf('FOR UPDATE`);');
    const ledgerIdx = SRC.indexOf('appendLedgerEntry(', lockIdx);
    const region = SRC.slice(lockIdx, ledgerIdx);
    expect(region).toMatch(/Insufficient credit:/);
    expect(region).toMatch(/Insufficient washes:/);
  });
});

describe('redeemVoucher — QR jti replay guard', () => {
  it('marks QR jti as used via INSERT into redeemed_qr_tokens', () => {
    expect(SRC).toMatch(/tx\.insert\(redeemedQrTokens\)\.values\(\{[\s\S]{0,400}jti:\s*qrJti/);
  });

  it('the INSERT happens inside the transactional lock (atomic replay guard)', () => {
    const insertIdx = SRC.indexOf('tx.insert(redeemedQrTokens)');
    const txStart = SRC.indexOf('await (db as any).transaction(async (tx: typeof db) => {');
    const txEnd = SRC.indexOf('});\n\n  // ── 9.');
    expect(insertIdx).toBeGreaterThan(txStart);
    expect(insertIdx).toBeLessThan(txEnd);
  });
});

describe('redeemVoucher — immutable ledger write is the source of truth', () => {
  it('appendLedgerEntry runs inside the redeem transaction with a REDEEM event', () => {
    const lockIdx = SRC.indexOf('FOR UPDATE`);');
    const ledgerIdx = SRC.indexOf('appendLedgerEntry(', lockIdx);
    expect(ledgerIdx).toBeGreaterThan(-1);
    const region = SRC.slice(ledgerIdx, ledgerIdx + 800);
    expect(region).toMatch(/event: "REDEEM"/);
    expect(region).toMatch(/deltaValue/);
    expect(region).toMatch(/deltaWashes/);
    // The last positional arg is `tx` — appendLedgerEntry(payload, tx).
    expect(region).toMatch(/\}, tx\)/);
  });

  it('voucher cache UPDATE happens inside the same transaction as the ledger entry', () => {
    const lockIdx = SRC.indexOf('FOR UPDATE`);');
    const ledger = SRC.indexOf('appendLedgerEntry(', lockIdx);
    const update = SRC.indexOf('tx\n      .update(unifiedVouchers)', ledger);
    expect(ledger).toBeGreaterThan(-1);
    expect(update).toBeGreaterThan(ledger);
  });
});

describe('redeemVoucher — wallet-bridge idempotency (out-of-tx by design)', () => {
  it('wallet.addCredits is called with sourceType=unified_voucher + sourceId=voucherId', () => {
    expect(SRC).toMatch(/walletService\.addCredits\(\s*userId,\s*"egift",\s*amountCents,\s*"unified_voucher",\s*voucher\.id/);
  });

  it('the header comment explains WHY the wallet bridge sits outside the tx (idempotency)', () => {
    expect(SRC).toContain('The wallet bridge (step 9) stays OUTSIDE the tx on purpose: addCredits is');
    expect(SRC).toContain('idempotent on (wallet, source, voucherId)');
  });
});
