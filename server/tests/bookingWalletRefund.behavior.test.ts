/**
 * refundDebitedBookingToWallet — one refund per stage, never more than was
 * debited, and a failed or repeated credit gives the claim back (2026-09-17).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const row = vi.hoisted(() => ({
  finance_state: 'debited', wallet_refunded_cents: 0, wallet_refund_key: null as string | null,
  credits: [] as Array<{ key: string; cents: number }>,
  seenKeys: new Set<string>(),
  failNext: false,
}));

// The helper only runs three statements; recognise each by its text and apply
// it to one in-memory booking row, the way Postgres would.
function sqlText(q: any): { text: string; params: unknown[] } {
  const params: unknown[] = [];
  const text = (q.queryChunks as any[]).map((c) => {
    if (c && typeof c === 'object' && 'value' in c && Array.isArray(c.value)) return c.value.join('');
    if (c && typeof c === 'object' && 'queryChunks' in c) return sqlText(c).text;
    params.push(c);
    return '$';
  }).join('');
  return { text, params };
}

vi.mock('../db', () => ({
  db: {
    execute: async (q: any) => {
      const { text, params } = sqlText(q);
      if (/RETURNING 1 AS claimed/.test(text)) {
        const [newState, newRefunded, , already] = params as any[];
        if (row.finance_state !== 'debited' || row.wallet_refunded_cents !== already) return { rows: [] };
        row.finance_state = newState; row.wallet_refunded_cents = newRefunded;
        return { rows: [{ claimed: 1 }] };
      }
      if (/SET finance_state = 'debited'/.test(text)) {
        const [already, , newRefunded] = params as any[];
        if (row.wallet_refunded_cents === newRefunded) { row.finance_state = 'debited'; row.wallet_refunded_cents = already as number; }
        return { rows: [] };
      }
      if (/SET wallet_refund_key/.test(text)) { row.wallet_refund_key = params[0] as string; return { rows: [] }; }
      throw new Error('unexpected SQL: ' + text);
    },
  },
}));

vi.mock('../services/WalletService', () => ({
  walletService: {
    refundBookingWallet: async (p: any) => {
      if (row.failNext) { row.failNext = false; throw new Error('ledger down'); }
      const key = `wallet:booking:refund:${p.bookingId}:${p.idempotencyKeySuffix}`;
      if (row.seenKeys.has(key)) return { txnId: 'T-' + key, idempotent: true };
      await new Promise((r) => setTimeout(r, 5));
      row.seenKeys.add(key); row.credits.push({ key, cents: p.amountCents });
      return { txnId: 'T-' + key, idempotent: false };
    },
  },
}));

import { refundDebitedBookingToWallet } from '../lib/bookingWalletRefund';

const booking = () => ({
  booking_id: 'BR-1', user_id: 'U-1', division_code: 'petsitter',
  wallet_debited_cents: 20000, wallet_refunded_cents: row.wallet_refunded_cents,
});
const refund = (cents: number, suffix: string, b = booking()) => refundDebitedBookingToWallet({
  booking: b, sourceTable: 'booking_requests', refundCents: cents, keySuffix: suffix, reason: 't', metadata: {},
});

describe('refundDebitedBookingToWallet', () => {
  beforeEach(() => {
    Object.assign(row, { finance_state: 'debited', wallet_refunded_cents: 0, wallet_refund_key: null, credits: [], seenKeys: new Set(), failNext: false });
  });

  it('a double-click (same stage read twice) credits once', async () => {
    const b = booking();
    const [x, y] = await Promise.all([refund(20000, 'admin:0', b), refund(20000, 'admin:0', b)]);
    expect([x.ok, y.ok].sort()).toEqual([false, true]);
    expect(row.credits).toHaveLength(1);
    expect(row.wallet_refunded_cents).toBe(20000);
    expect(row.finance_state).toBe('refunded');
  });

  it('two different staff paths racing on the same stage credit once', async () => {
    const b = booking();
    const r = await Promise.all([refund(15000, 'admin:0', b), refund(15000, 'support:0', b)]);
    expect(r.filter((o) => o.ok)).toHaveLength(1);
    expect(row.credits.reduce((n, c) => n + c.cents, 0)).toBe(15000);
  });

  it('two sequential partial refunds of the same size both land', async () => {
    expect((await refund(5000, 'support:0')).ok).toBe(true);
    expect((await refund(5000, 'support:5000')).ok).toBe(true);
    expect(row.credits).toHaveLength(2);
    expect(row.wallet_refunded_cents).toBe(10000);
    expect(row.finance_state).toBe('debited');
  });

  it('a failed credit gives the claim back', async () => {
    row.failNext = true;
    await expect(refund(20000, 'admin:0')).rejects.toThrow('ledger down');
    expect(row.wallet_refunded_cents).toBe(0);
    expect(row.finance_state).toBe('debited');
    expect((await refund(20000, 'admin:0')).ok).toBe(true);
  });

  it('a replayed approval (key already credited) gives the claim back and credits nothing', async () => {
    expect((await refund(8000, 'approval:A1')).ok).toBe(true);
    const again = await refund(8000, 'approval:A1');
    expect(again).toMatchObject({ ok: false, code: 'REFUND_ALREADY_ISSUED' });
    expect(row.credits).toHaveLength(1);
    expect(row.wallet_refunded_cents).toBe(8000);
  });
});
