/**
 * SUMIT unclaimed-payment watch — money received with no order fulfilled
 * raises an alert; nothing is fulfilled by guesswork (2026-09-17).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const h = vi.hoisted(() => ({
  pages: [] as any[],
  claimed: [] as string[],
  bookings: [] as any[],
  alerts: [] as any[],
  resolvedPrefixes: [] as string[],
  sqlSeen: [] as string[],
}));

function text(q: any): string {
  return (q.queryChunks as any[]).map((c) =>
    c && typeof c === 'object' && Array.isArray(c.value) ? c.value.join('') :
    c && typeof c === 'object' && 'queryChunks' in c ? text(c) : '$').join('');
}

vi.mock('../db', () => ({
  db: {
    execute: async (q: any) => {
      const t = text(q);
      h.sqlSeen.push(t);
      if (/FROM sumit_payment_claims/.test(t)) return { rows: h.claimed.map((id) => ({ id })) };
      if (/FROM booking_requests/.test(t)) return { rows: h.bookings };
      if (/FROM egift_guest_orders|FROM purchases/.test(t)) return { rows: [] };
      if (/INSERT|UPDATE|DELETE/i.test(t)) throw new Error('watch must be read-only: ' + t);
      return { rows: [] };
    },
  },
}));
vi.mock('../services/SumitClient', () => ({
  sumitClient: { listPayments: async () => h.pages.shift() ?? { ok: true, payments: [], hasNextPage: false } },
}));
vi.mock('../services/AlertEngine', () => ({
  createOrUpdateAlert: async (a: any) => { h.alerts.push(a); },
  resolveClearedByPrefix: async (p: string, cur: string[]) => { h.resolvedPrefixes.push(`${p}|${cur.length}`); return 1; },
}));

import { runSumitUnclaimedPaymentWatch, unclaimedOf, describeUnclaimed, WATCH_FLOOR } from '../cron/sumit-unclaimed-payments';

const NOW = new Date('2026-09-18T12:00:00Z');
const pay = (id: string, amountCents: number, date = '2026-09-18T10:00:00+03:00') => ({ id, customerId: '77', date, amountCents, valid: true });

describe('SUMIT unclaimed-payment watch', () => {
  beforeEach(() => { h.pages = []; h.claimed = []; h.bookings = []; h.alerts = []; h.resolvedPrefixes = []; h.sqlSeen = []; });

  it('alerts once per valid payment no order claimed, naming same-amount waiting orders', async () => {
    h.pages = [{ ok: true, hasNextPage: false, payments: [pay('9001', 25000), pay('9002', 4800)] }];
    h.claimed = ['9002'];
    h.bookings = [{ ref: 'BR-abc', cents: 25000, at: '2026-09-18T06:55:00Z' }];
    const r = await runSumitUnclaimedPaymentWatch(NOW);
    expect(r).toMatchObject({ ok: true, listed: 2, unclaimed: 1 });
    expect(h.alerts).toHaveLength(1);
    expect(h.alerts[0]).toMatchObject({ dedupeKey: 'sumit_unclaimed_payment:9001:', category: 'payment', severity: 'critical' });
    expect(h.alerts[0].message).toContain('₪250.00');
    expect(h.alerts[0].message).toContain('booking BR-abc');
    // the claimed payment's own alert (if any) is resolved by its exact key only
    expect(h.resolvedPrefixes).toEqual(['sumit_unclaimed_payment:9002:|0']);
  });

  it('never writes to the database', async () => {
    h.pages = [{ ok: true, hasNextPage: false, payments: [pay('9003', 1000)] }];
    await runSumitUnclaimedPaymentWatch(NOW);
    expect(h.sqlSeen.some((t) => /\b(INSERT|UPDATE|DELETE)\b/i.test(t))).toBe(false);
  });

  it('a SUMIT outage skips the run instead of alerting on everything', async () => {
    h.pages = [{ ok: false, payments: [], hasNextPage: false, reason: 'status 500' }];
    const r = await runSumitUnclaimedPaymentWatch(NOW);
    expect(r.ok).toBe(false);
    expect(h.alerts).toHaveLength(0);
  });

  it('follows SUMIT paging', async () => {
    h.pages = [
      { ok: true, hasNextPage: true, payments: [pay('1', 100)] },
      { ok: true, hasNextPage: false, payments: [pay('2', 200)] },
    ];
    const r = await runSumitUnclaimedPaymentWatch(NOW);
    expect(r.listed).toBe(2);
    expect(h.alerts.map((a) => a.linkedEntityId)).toEqual(['1', '2']);
  });

  it('ignores the go-live test payments before the floor', () => {
    const before = { id: 'T', customerId: null, date: '2026-09-17T12:34:00+03:00', amountCents: 100 };
    expect(new Date(before.date).getTime()).toBeLessThan(WATCH_FLOOR.getTime());
    expect(unclaimedOf([before], new Set())).toEqual([]);
  });

  it('says plainly when no waiting order matches', () => {
    expect(describeUnclaimed({ id: '5', customerId: '9', date: null, amountCents: 1234 }, []))
      .toMatch(/₪12\.34.*No waiting order has this amount/);
  });
});
