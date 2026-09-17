/**
 * Refunds that could pay twice, and a wallet debit that paid for nothing
 * (2026-09-17 money audit).
 *
 *  1. WalletService.refundRedemption (K9000 / credit-wallet redemption refund)
 *     checked `status === 'completed'` on a snapshot, restored every credit,
 *     and only then flipped the status with no WHERE on the old one. Two
 *     concurrent refunds both passed and both restored. The flip is now the
 *     claim, first, in one transaction with the restores.
 *
 *  2. POST /api/prestige-pass/admin/wallet/refund keyed its ledger entry on
 *     Date.now(), so a double-click credited twice. Now keyed on the stage
 *     (amount already refunded); a replay returns 409 and writes nothing.
 *
 *  3. POST /api/prestige-pass/redeem-online debited a client-chosen amount
 *     against a placeholder booking id and nothing marked the booking paid —
 *     the customer then paid the same booking by card. Closed server-side and
 *     the three booking screens no longer render the option.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── in-memory fake of the few drizzle calls refundRedemption makes ──────────
const state = vi.hoisted(() => ({
  session: null as any,
  wallet: null as any,
  inserted: [] as any[],
  txQueue: Promise.resolve() as Promise<unknown>,
}));

vi.mock('../db', async () => {
  const schema: any = await import('@shared/schema');
  const selectChain = (table: any) => {
    const rows = () =>
      table === schema.redemptionSessions ? [{ ...state.session }]
      : table === schema.walletAccounts ? [{ ...state.wallet }]
      : [];
    const chain: any = {
      where: () => chain,
      limit: async () => rows(),
    };
    return chain;
  };
  const updateChain = (table: any) => {
    let values: any = {};
    const chain: any = {
      set: (v: any) => { values = v; return chain; },
      where: () => chain,
      returning: async () => {
        if (table === schema.redemptionSessions) {
          // Emulates `WHERE session_id = ? AND status = 'completed'`.
          if (state.session.status !== 'completed') return [];
          state.session.status = values.status;
          return [{ sessionId: state.session.sessionId }];
        }
        if (table === schema.walletAccounts) {
          if ('egiftBalanceCents' in values) state.wallet.egiftBalanceCents += state.session.egiftAppliedCents;
          if ('promoBalanceCents' in values) state.wallet.promoBalanceCents += state.session.promoAppliedCents;
          return [{ ...state.wallet }];
        }
        return [];
      },
    };
    return chain;
  };
  const insertChain = () => ({ values: async (rows: any) => { state.inserted.push(...[].concat(rows)); } });
  const tx = { update: updateChain, insert: insertChain, select: () => ({ from: selectChain }) };
  const db = {
    select: () => ({ from: selectChain }),
    update: updateChain,
    insert: insertChain,
    // Postgres serializes the two conflicting UPDATEs; model that with a queue.
    transaction: (fn: (t: typeof tx) => Promise<unknown>) => {
      const run = state.txQueue.then(() => fn(tx));
      state.txQueue = run.catch(() => undefined);
      return run;
    },
  };
  return { db };
});
vi.mock('../services/walletPassSync', () => ({ schedulePassSync: vi.fn() }));

import { walletService } from '../services/WalletService';

const read = (...p: string[]) => fs.readFileSync(path.resolve(__dirname, '..', '..', ...p), 'utf8');

describe('refundRedemption — one refund per redemption, even under a double-click', () => {
  beforeEach(() => {
    state.session = {
      sessionId: 'RS-1', walletId: 'W-1', status: 'completed', platform: 'k9000', bookingId: null,
      egiftAppliedCents: 4800, washPackagesApplied: 0, loyaltyPointsApplied: 0, promoAppliedCents: 700,
    };
    state.wallet = { walletId: 'W-1', userId: 'U-1', egiftBalanceCents: 0, promoBalanceCents: 0 };
    state.inserted = [];
    state.txQueue = Promise.resolve();
  });

  it('two concurrent refunds restore the credits exactly once', async () => {
    const results = await Promise.allSettled([
      walletService.refundRedemption('RS-1', 'bay fault', 'admin@a'),
      walletService.refundRedemption('RS-1', 'bay fault', 'admin@b'),
    ]);
    expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter(r => r.status === 'rejected')).toHaveLength(1);
    expect(state.wallet.egiftBalanceCents).toBe(4800);
    expect(state.wallet.promoBalanceCents).toBe(700);
    expect(state.inserted).toHaveLength(2); // one egift row + one promo row
    expect(state.session.status).toBe('refunded');
  });

  it('a refund of an already-refunded session restores nothing', async () => {
    state.session.status = 'refunded';
    await expect(walletService.refundRedemption('RS-1', 'again')).rejects.toThrow();
    expect(state.wallet.egiftBalanceCents).toBe(0);
    expect(state.inserted).toHaveLength(0);
  });

  it('the claim runs before any restore', () => {
    const src = read('server', 'services', 'WalletService.ts');
    const fn = src.slice(src.indexOf('async refundRedemption('), src.indexOf('async cancelSession('));
    expect(fn).toMatch(/eq\(redemptionSessions\.status, 'completed' as any\)/);
    expect(fn.indexOf("eq(redemptionSessions.status, 'completed'")).toBeLessThan(fn.indexOf('// Restore e-gift'));
    expect(fn).not.toMatch(/await db\.update\(walletAccounts\)/);
  });
});

describe('admin wallet refund — a double-click is one refund', () => {
  const src = read('server', 'routes', 'prestige-pass.ts');
  const handler = src.slice(src.indexOf("router.post('/admin/wallet/refund',"));
  const body = handler.slice(0, handler.indexOf('\n});'));

  it('keys the ledger entry on the refund stage, not the clock', () => {
    expect(body).toContain('`wallet:booking:refund:admin:${bookingId}:${alreadyRefunded}`');
    expect(body).not.toMatch(/refund:admin:\$\{bookingId\}:\$\{Date\.now\(\)\}/);
  });

  it('a replay answers 409 and never rewrites the booking', () => {
    expect(body).toMatch(/if \(result\.idempotent\) \{[\s\S]*?status\(409\)[\s\S]*?REFUND_ALREADY_ISSUED/);
    expect(body.indexOf('result.idempotent')).toBeLessThan(body.indexOf('UPDATE booking_requests'));
    expect(body.match(/AND COALESCE\(wallet_refunded_cents, 0\) = \$\{alreadyRefunded\}/g)).toHaveLength(2);
  });
});

describe('Pay with Prestige Pass — no debit that pays for nothing', () => {
  const src = read('server', 'routes', 'prestige-pass.ts');

  it('the server refuses before touching the wallet', () => {
    expect(src).toMatch(/const PRESTIGE_ONLINE_REDEMPTION_WIRED = false as boolean;/);
    const handler = src.slice(src.indexOf("router.post('/redeem-online',"));
    const gate = handler.indexOf('if (!PRESTIGE_ONLINE_REDEMPTION_WIRED)');
    expect(gate).toBeGreaterThan(0);
    expect(gate).toBeLessThan(handler.indexOf('applyDeduction('));
    expect(gate).toBeLessThan(handler.indexOf('getWalletBalances('));
    expect(handler).toContain("code: 'PRESTIGE_ONLINE_REDEMPTION_NOT_WIRED'");
  });

  it.each([
    'client/src/pages/walk-my-pet/BookingFlow.tsx',
    'client/src/pages/sitter-suite/BookingFlow.tsx',
    'client/src/pages/academy/BookingFlow.tsx',
  ])('%s does not render the option', (file) => {
    const page = read(...file.split('/'));
    const at = page.indexOf('<PrestigePassPaymentOption');
    expect(at).toBeGreaterThan(0);
    const guard = page.slice(page.lastIndexOf('{', page.lastIndexOf('&& (', at)), at);
    expect(guard).toMatch(/^\{false && user && /);
  });
});
