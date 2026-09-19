/**
 * SUMIT unclaimed-payment watch — money received with no order fulfilled
 * raises an alert; nothing is fulfilled by guesswork (2026-09-17).
 *
 * 2026-09-19: when SUMIT's own document names exactly ONE order, the watch
 * replays the customer's missing return through the production /return route
 * (server/lib/sumitLateReturn.ts). The route's verdict decides: fulfilled →
 * no alert; anything else → the alert, carrying the route's answer.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const h = vi.hoisted(() => ({
  pages: [] as any[],
  claimed: [] as string[],
  bookings: [] as any[],
  alerts: [] as any[],
  resolvedPrefixes: [] as string[],
  docs: null as any,
  sqlSeen: [] as string[],
  replays: [] as any[],
  replayResult: null as any,
}));

vi.mock('../lib/sumitLateReturn', () => ({
  replayLateReturn: async (input: any) => {
    h.replays.push(input);
    return h.replayResult ?? { outcome: 'refused', surface: 'booking', status: 302, location: 'https://petwash.co.il/booking/confirmation/x?payment=failed' };
  },
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
  SUMIT_ORDER_REF_PREFIX: 'PW-REF ',
  sumitClient: {
    listPayments: async () => h.pages.shift() ?? { ok: true, payments: [], hasNextPage: false },
    listDocumentsInWindow: async () => h.docs ?? { ok: true, documents: [] },
  },
}));
vi.mock('../services/AlertEngine', () => ({
  createOrUpdateAlert: async (a: any) => { h.alerts.push(a); },
  resolveClearedByPrefix: async (p: string, cur: string[]) => { h.resolvedPrefixes.push(`${p}|${cur.length}`); return 1; },
}));

import { runSumitUnclaimedPaymentWatch, unclaimedOf, describeUnclaimed, refFromDocuments, WATCH_FLOOR } from '../cron/sumit-unclaimed-payments';

const NOW = new Date('2026-09-18T12:00:00Z');
const pay = (id: string, amountCents: number, date = '2026-09-18T10:00:00+03:00') => ({ id, customerId: '77', date, amountCents, valid: true });

describe('SUMIT unclaimed-payment watch', () => {
  beforeEach(() => { h.pages = []; h.claimed = []; h.bookings = []; h.alerts = []; h.resolvedPrefixes = []; h.sqlSeen = []; h.docs = null; h.replays = []; h.replayResult = null; });

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

  it("names the order from SUMIT's own document stamp, and stops guessing by amount", async () => {
    h.pages = [{ ok: true, hasNextPage: false, payments: [pay('9100', 25000)] }];
    h.docs = { ok: true, documents: [
      { description: 'PW-REF bkg_BR-xyz_m1', valueIls: 250, date: '2026-09-18T10:05:00+03:00' },
      { description: 'PW-REF eg_other', valueIls: 99, date: '2026-09-18T10:05:00+03:00' },
    ] };
    h.bookings = [{ ref: 'BR-should-not-be-used', cents: 25000, at: '2026-09-18T06:55:00Z' }];
    const r = await runSumitUnclaimedPaymentWatch(NOW);
    expect(h.alerts[0].message).toContain('bkg_BR-xyz_m1');
    expect(h.alerts[0].message).not.toContain('BR-should-not-be-used');
    expect(h.alerts[0].metadata.stampedRef).toBe('bkg_BR-xyz_m1');
    // The stamp was replayed through the route; the route refused; the alert says so.
    expect(h.replays).toEqual([{ paymentId: '9100', ref: 'bkg_BR-xyz_m1' }]);
    expect(h.alerts[0].message).toMatch(/Late return replayed through the production route and refused: HTTP 302/);
    expect(h.alerts[0].metadata.replayNote).toMatch(/payment=failed/);
    expect(r).toMatchObject({ unclaimed: 1, fulfilled: 0 });
  });

  it('the late return: a unique stamp is replayed through the route, and a fulfilled verdict means NO alert', async () => {
    h.pages = [{ ok: true, hasNextPage: false, payments: [pay('9200', 25000)] }];
    h.docs = { ok: true, documents: [{ description: 'PW-REF egiftguest_77', valueIls: 250, date: '2026-09-18T10:05:00+03:00' }] };
    h.replayResult = { outcome: 'fulfilled', surface: 'egift_guest', location: 'https://petwash.co.il/egift?status=success' };
    const r = await runSumitUnclaimedPaymentWatch(NOW);
    expect(h.replays).toEqual([{ paymentId: '9200', ref: 'egiftguest_77' }]);
    expect(h.alerts).toEqual([]);
    // An alert an earlier run may have raised for this payment is cleared now.
    expect(h.resolvedPrefixes).toContain('sumit_unclaimed_payment:9200:|0');
    expect(r).toMatchObject({ listed: 1, unclaimed: 0, fulfilled: 1, ok: true });
  });

  it('the late return never guesses: no stamp → no replay, ambiguous stamps → no replay', async () => {
    h.pages = [{ ok: true, hasNextPage: false, payments: [pay('9300', 25000), pay('9301', 4800)] }];
    h.docs = { ok: true, documents: [
      { description: 'PW-REF a', valueIls: 250, date: '2026-09-18T10:01:00+03:00' },
      { description: 'PW-REF b', valueIls: 250, date: '2026-09-18T10:02:00+03:00' },
    ] };
    await runSumitUnclaimedPaymentWatch(NOW);
    expect(h.replays).toEqual([]);
    expect(h.alerts.length).toBe(2);
  });

  it('a payment younger than LATE_RETURN_MIN_AGE_MS may still be mid-redirect — not replayed yet', async () => {
    const young = pay('9400', 25000, new Date(NOW.getTime() - 2 * 60_000).toISOString());
    h.pages = [{ ok: true, hasNextPage: false, payments: [young] }];
    h.docs = { ok: true, documents: [{ description: 'PW-REF bkg_BR-new_m1', valueIls: 250, date: young.date }] };
    await runSumitUnclaimedPaymentWatch(NOW);
    expect(h.replays).toEqual([]);
    expect(h.alerts[0].metadata.stampedRef).toBe('bkg_BR-new_m1');
    expect(h.alerts[0].metadata.replayNote).toBeNull();
  });

  it('a replay transport error keeps the alert and names the error', async () => {
    h.pages = [{ ok: true, hasNextPage: false, payments: [pay('9500', 25000)] }];
    h.docs = { ok: true, documents: [{ description: 'PW-REF pw-u-1', valueIls: 250, date: '2026-09-18T10:05:00+03:00' }] };
    h.replayResult = { outcome: 'error', surface: 'wallet_purchase', reason: 'ECONNREFUSED' };
    await runSumitUnclaimedPaymentWatch(NOW);
    expect(h.alerts[0].message).toContain('refused: error ECONNREFUSED');
  });

  it('two documents of the same value are ambiguous — no order is named', () => {
    const p = { amountCents: 25000, date: '2026-09-18T10:00:00+03:00' };
    const docs = [
      { description: 'PW-REF a', valueIls: 250, date: '2026-09-18T10:01:00+03:00' },
      { description: 'PW-REF b', valueIls: 250, date: '2026-09-18T10:02:00+03:00' },
    ];
    expect(refFromDocuments(p, docs)).toBeNull();
  });

  it('a document far from the payment time is not a match', () => {
    expect(refFromDocuments(
      { amountCents: 25000, date: '2026-09-18T10:00:00+03:00' },
      [{ description: 'PW-REF a', valueIls: 250, date: '2026-09-15T10:00:00+03:00' }],
    )).toBeNull();
  });

  it('a document without our stamp is never used', () => {
    expect(refFromDocuments(
      { amountCents: 25000, date: '2026-09-18T10:00:00+03:00' },
      [{ description: 'חשבונית ללקוח', valueIls: 250, date: '2026-09-18T10:01:00+03:00' }],
    )).toBeNull();
  });
});
