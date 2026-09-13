/**
 * CEO 2026-09-13: "real sales and more not work at back end — why".
 * Each fix below was traced end to end and verified in code before being made.
 * See memory deep-audit-both-ends-2026-09-13.
 *
 * (The SUMIT transaction→order binding is NOT here: it was already fixed at all three
 * return handlers by #2444 and is pinned by sumitReturnBindsTxnToOrder.regression.test.ts.)
 */
import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'fs';
import path from 'path';
import { getTableColumns } from 'drizzle-orm';
import { nayaxTransactions } from '@shared/schema';
import { israelMidnightUtc, israelPeriodStarts } from '../lib/israelPeriods';

const R = (p: string) => fs.readFileSync(path.join(process.cwd(), p), 'utf8');

// ─────────────────────────────────────────────────────────────────────────────
describe('B1 — a K9000 bay sale can actually be saved', () => {
  // K9000TransactionService pulls in @google-cloud/storage and the db at import time.
  // Importing it inside each test made the first one pay for that and time out under
  // a full parallel run (the same flake class fixed in tierUpgradePushLanguage).
  let buildBayTransactionRow: typeof import('../services/K9000TransactionService')['buildBayTransactionRow'];
  beforeAll(async () => {
    ({ buildBayTransactionRow } = await import('../services/K9000TransactionService'));
  }, 120_000);

  it('every key of the row is a real nayax_transactions column', async () => {
    const row = buildBayTransactionRow(
      { stationId: 'KFS-R', terminalId: 'T1', nayaxTransactionId: 'NX1', paymentStatus: 'completed' },
      'K9K-1-ABCD', 48,
    );
    const columns = getTableColumns(nayaxTransactions);
    const unknown = Object.keys(row).filter(k => !(k in columns));
    // The old insert used `transactionId` and `metadata` — neither is a column.
    expect(unknown, `not columns of nayax_transactions: ${unknown.join(', ')}`).toEqual([]);
  });

  it('every NOT NULL column without a default is filled — the old insert omitted `id`', async () => {
    const row: Record<string, unknown> = buildBayTransactionRow(
      { stationId: 'KFS-R', paymentStatus: 'pending' }, 'K9K-2-EFGH', 55,
    );
    const columns = getTableColumns(nayaxTransactions) as Record<string, any>;
    const required = Object.entries(columns)
      .filter(([, c]) => c.notNull && !c.hasDefault)
      .map(([k]) => k);
    expect(required).toContain('id');
    for (const k of required) {
      expect(row[k], `required column ${k} missing — Postgres rejects the insert`).not.toBeUndefined();
      expect(row[k]).not.toBeNull();
    }
  });

  it('amount stays in shekels and status follows the payment', async () => {
    const paid = buildBayTransactionRow({ stationId: 'S', paymentStatus: 'completed' }, 'K9K-3', 48);
    expect(paid.amount).toBe('48');
    expect(paid.status).toBe('settled');
    expect(paid.settledAt).toBeInstanceOf(Date);
    const pending = buildBayTransactionRow({ stationId: 'S', paymentStatus: 'pending' }, 'K9K-4', 48);
    expect(pending.status).toBe('initiated');
    expect(pending.settledAt).toBeNull();
  });

  it('the service really inserts that row', () => {
    expect(R('server/services/K9000TransactionService.ts'))
      .toMatch(/db\.insert\(nayaxTransactions\)\.values\(buildBayTransactionRow\(request, transactionId, finalAmount\)\)/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('B2 — "today" and "this month" are Israeli days, not UTC days', () => {
  it('summer (IDT, UTC+3): Israel midnight is 21:00 UTC the day before', () => {
    expect(israelMidnightUtc('2026-09-13').toISOString()).toBe('2026-09-12T21:00:00.000Z');
  });

  it('winter (IST, UTC+2): Israel midnight is 22:00 UTC the day before', () => {
    expect(israelMidnightUtc('2026-01-15').toISOString()).toBe('2026-01-14T22:00:00.000Z');
  });

  it('00:30 in Israel counts as the NEW day — the case a UTC server got wrong', () => {
    const halfPastMidnightIsrael = new Date('2026-09-12T21:30:00.000Z'); // 00:30 on 13 Sept in Israel
    const { todayStart, monthStart, yearStart } = israelPeriodStarts(halfPastMidnightIsrael);
    expect(todayStart.toISOString()).toBe('2026-09-12T21:00:00.000Z');
    expect(monthStart.toISOString()).toBe('2026-08-31T21:00:00.000Z');
    expect(yearStart.toISOString()).toBe('2025-12-31T22:00:00.000Z');
  });

  it('00:30 on the 1st of a month in Israel is in the NEW month', () => {
    const firstOfOctoberIsrael = new Date('2026-09-30T21:30:00.000Z');
    expect(israelPeriodStarts(firstOfOctoberIsrael).monthStart.toISOString()).toBe('2026-09-30T21:00:00.000Z');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('B3 — the admin dashboard shows real money, not fiction', () => {
  const admin = () => R('server/routes/admin.ts');

  const handler = (name: string) => {
    const src = admin();
    const at = src.indexOf(`router.get('${name}',`);
    expect(at, `${name} not found`).toBeGreaterThan(-1);
    return src.slice(at, src.indexOf('\n});\n', at));
  };

  it('overview: no ÷100 on a shekel column, no hard-coded success rate', () => {
    const h = handler('/analytics/overview');
    expect(h).not.toMatch(/rev\s*\?\?\s*0\)\s*\/\s*100/);
    // The conversion now lives in one helper — pin the helper, or a /100 inside it
    // slips past the inline check above (a mutation proved exactly that).
    const helper = h.match(/const shekels = \(v: unknown\) => ([^;]+);/);
    expect(helper, 'shekels() helper not found').not.toBeNull();
    expect(helper![1], 'the shekel helper divides by 100 — ₪48 becomes ₪0').not.toMatch(/\/\s*100/);
    // Match the ASSIGNMENT, not the digits — the fix's own comment explains the old
    // hard-coded 98.5 and a bare /98\.5/ matched that comment.
    expect(h, 'fake 98.5% success rate is back').not.toMatch(/successRate:[^\n]*98\.5/);
    expect(h).toMatch(/successRate: decided > 0 \?/);
  });

  it('overview: only paid transactions are revenue, in Israeli periods', () => {
    const h = handler('/analytics/overview');
    expect(h).toMatch(/SALE_STATUSES = \['settled', 'vend_success'\]/);
    expect(h).toMatch(/and\(isSale, sql`\$\{saleTime\} >= \$\{since\}`\)/);
    expect(h).toContain('israelPeriodStarts(now)');
    expect(h, 'still using server-local midnight').not.toMatch(/new Date\(now\.getFullYear\(\), now\.getMonth\(\), now\.getDate\(\)\)/);
  });

  it('stations: no invented stations, real aggregation', () => {
    const h = handler('/analytics/stations');
    expect(h, 'invented station data is back').not.toMatch(/stationName:\s*'(Tel Aviv Center|Jerusalem Hub)'/);
    expect(h).not.toMatch(/totalRevenue:\s*\d{4,}/);
    expect(h).toMatch(/\.groupBy\(nayaxTransactions\.stationId\)/);
  });

  it('dashboard/stats: monthly revenue is not divided by 100 and counts sales only', () => {
    const h = handler('/dashboard/stats');
    expect(h).not.toMatch(/monthlyTxRow\?\.revenue \?\? 0\) \/ 100/);
    expect(h).toMatch(/inArray\(nayaxTransactions\.status, \['settled', 'vend_success'\]\)/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('B4 — the shop can add to cart', () => {
  it('no authenticated shop call goes out without the Firebase token', () => {
    const src = R('client/src/pages/ShopStore.tsx');
    // any bare fetch to an authenticated endpoint is the bug (CSRF 403 + no identity)
    const bare = [...src.matchAll(/fetch\(getApiUrl\((`[^`]*`|'[^']*')/g)]
      .map(m => m[1])
      .filter(u => /\/api\/(shop|user|credit-wallet)/.test(u));
    expect(bare, `bare fetch to: ${bare.join(', ')}`).toEqual([]);
    expect(src).toMatch(/shopFetch\('\/api\/shop\/cart\/items'/);
    expect(src).toMatch(/shopFetch\('\/api\/shop\/checkout'/);
  });

  it('shopFetch attaches Authorization: Bearer (which the CSRF middleware exempts)', () => {
    const src = R('client/src/pages/ShopStore.tsx');
    const at = src.indexOf('async function shopFetch(');
    expect(at).toBeGreaterThan(-1);
    const body = src.slice(at, src.indexOf('\n}', at));
    expect(body).toContain('getFirebaseBearerToken()');
    expect(body).toMatch(/headers\.set\('Authorization', `Bearer \$\{token\}`\)/);
    // and the server really does exempt Bearer requests from CSRF
    expect(R('server/index.ts')).toMatch(/Bearer-authenticated requests/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('B5 — guest eGift sales appear in the control tower', () => {
  it('the overview reads egift_guest_orders, issued only', () => {
    const src = R('server/routes/admin-octopus.ts');
    expect(src).toMatch(/FROM egift_guest_orders\s+WHERE status = 'issued'/);
    expect(src).toMatch(/egiftGuestCents: Number\(guestGift\?\.c \?\? 0\)/);
  });

  it('the page adds them into the total and shows them', () => {
    const src = R('client/src/pages/AdminOctopus.tsx');
    expect(src).toMatch(/\+ \(p\.egiftGuestCents \?\? 0\)/);
    expect(src).toContain('nis(p.egiftGuestCents ?? 0)');
  });
});
