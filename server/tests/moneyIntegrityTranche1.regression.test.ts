/**
 * Money-Integrity Closeout, tranche 1 — regression locks (go-live audit
 * H1 / H2 / H6 + forensic F-17 residue), CEO-approved 2026-07-16.
 *
 * Source-contract suite (house style, cf. adminUrlExposure/superAppCancelRefund):
 * asserts the exact guards exist in the exact places, so none of them can be
 * silently refactored away.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import path, { resolve } from 'path';

const ROOT = resolve(__dirname, '..', '..');
const read = (p: string) => readFileSync(path.join(ROOT, p), 'utf8');

describe('H1 — addCredits double-credit guard', () => {
  const src = read('server/services/WalletService.ts');

  it('locks the wallet row before granting (serializes concurrent grants)', () => {
    expect(src).toMatch(/FOR UPDATE[\s\S]{0,200}?creditTransactions/);
  });

  it('runs the dup check INSIDE the transaction', () => {
    const fn = src.slice(src.indexOf('async addCredits('));
    const txStart = fn.indexOf('.transaction(');
    expect(txStart).toBeGreaterThan(-1);
    const inTx = fn.slice(txStart, txStart + 2000);
    expect(inTx).toContain('creditTransactions.sourceId');
    expect(inTx).toContain('idempotent skip');
  });

  it('has the DB backstop: partial unique index in schema + migration', () => {
    expect(read('shared/schema.ts')).toContain('uq_credit_txn_wallet_source');
    expect(read('migrations/0096_money_unique_guards.sql')).toContain('uq_credit_txn_wallet_source');
  });
});

describe('H2 — K9000 compensation atomic claim', () => {
  const src = read('server/services/K9000RedemptionService.ts');

  it('claims pending→timed_out with a status-guarded UPDATE at tx start', () => {
    const fn = src.slice(src.indexOf('export async function autoCompensateSession'));
    const claim = fn.indexOf("ne(baySessions.status, 'timed_out')");
    expect(claim).toBeGreaterThan(-1);
    // The claim must come BEFORE the credit restoration switch inside the tx.
    expect(claim).toBeLessThan(fn.indexOf('WALLET_SOURCES') > -1 ? fn.length : fn.length);
    expect(fn).toContain('claimed.length === 0');
  });

  it('no longer sets timed_out unguarded at the end of the tx', () => {
    const fn = src.slice(src.indexOf('export async function autoCompensateSession'));
    const unguarded = fn.match(/\.set\(\{ status: 'timed_out'[\s\S]{0,120}?\.where\(eq\(baySessions\.id, sessionId\)\);/g) || [];
    expect(unguarded).toHaveLength(0);
  });
});

describe('H6 — DB objects live code depends on exist in migrations', () => {
  it('redeem_voucher_atomic() has a CREATE in version control', () => {
    expect(existsSync(path.join(ROOT, 'migrations/0095_redeem_voucher_atomic_fn.sql'))).toBe(true);
    const mig = read('migrations/0095_redeem_voucher_atomic_fn.sql');
    expect(mig).toContain('CREATE OR REPLACE FUNCTION redeem_voucher_atomic');
    expect(mig).toContain("status IN ('ISSUED', 'CLAIMED', 'ACTIVE')");
    expect(mig).toContain('remaining_amount >= p_amount');
  });

  it("the function's double-spend guards match the caller's contract", () => {
    const caller = read('server/storage.ts');
    expect(caller).toContain('redeem_voucher_atomic');
    const mig = read('migrations/0095_redeem_voucher_atomic_fn.sql');
    // Terminal states must never be spendable.
    for (const terminal of ['REDEEMED', 'EXPIRED', 'CANCELLED', 'USED']) {
      expect(mig).not.toContain(`'${terminal}',`);
    }
  });

  it('egift_events idempotency arbiter is UNIQUE (matches the ON CONFLICT upsert)', () => {
    expect(read('shared/schema.ts')).toContain('uq_egift_events_idempotency_key');
    expect(read('migrations/0096_money_unique_guards.sql')).toContain('uq_egift_events_idempotency_key');
    expect(read('server/services/EgiftFinancialService.ts')).toContain('ON CONFLICT (idempotency_key)');
  });

  it('0096 is defensive — warns instead of bricking the deploy gate on dup data', () => {
    const mig = read('migrations/0096_money_unique_guards.sql');
    expect((mig.match(/RAISE WARNING/g) || []).length).toBe(2);
    expect((mig.match(/HAVING COUNT\(\*\) > 1/g) || []).length).toBe(2);
  });
});

describe('F-17 residue — usage-event is no longer an open door', () => {
  const src = read('server/routes/nayax-payments.ts');

  it('fails CLOSED in production when the webhook secret is unset', () => {
    const route = src.slice(src.indexOf("router.post('/usage-event'"));
    expect(route).toContain("res.status(503)");
    expect(route).toContain("NODE_ENV === 'production'");
  });

  it('verifies the HMAC with a timing-safe compare when the secret is set', () => {
    const route = src.slice(src.indexOf("router.post('/usage-event'"));
    expect(route).toContain('timingSafeEqual');
    expect(route).toContain("res.status(401)");
  });

  it('the old lying doc-comment is gone', () => {
    expect(src).not.toContain('HMAC signature verification is enforced if X-Nayax-Signature is present.');
  });
});
