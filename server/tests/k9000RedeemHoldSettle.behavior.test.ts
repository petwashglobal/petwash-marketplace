/**
 * Behavioral verification for `settleMemberRedemptionHold` (commit f7e637167,
 * "settle the member's redeem hold — honestly, in two phases") and its use
 * from the ACK path (commit 2a20eb294's companion wiring in
 * server/routes/k9000.ts).
 *
 * SCOPE NOTE (important for honest reporting): `settleMemberRedemptionHold`
 * moves NO money. It only advances a `redemption_sessions` UI-status row
 * ('pending' -> 'scanned' -> 'completed'). The actual wallet debit happens
 * earlier, in `debitAndLog`'s atomic conditional UPDATE (unaffected by this
 * commit, already protected by the pre-existing single-use nonce claim in
 * server/routes/k9000.ts and pinned by
 * server/tests/k9000BayClaimAtomic.regression.test.ts). So "run it twice and
 * decrement a balance twice" does not apply to this function by design — what
 * DOES apply, and what this suite proves, is: can the STATUS transition run
 * twice / out of order and mislead the member (e.g. regress 'completed' back
 * to 'scanned', or let two concurrent ACKs both believe they were the one
 * that confirmed the wash)?
 *
 * This test calls the REAL exported `settleMemberRedemptionHold` from
 * server/services/K9000RedemptionService.ts against a fake `db` that
 * reproduces Postgres's single-statement-UPDATE atomicity contract: the
 * predicate match and the mutation happen in one synchronous step, so two
 * "concurrent" calls driven through Promise.all serialize exactly the way
 * two Postgres backends would serialize on the same row's lock (the second
 * re-evaluates the WHERE clause against the row the first one just committed).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Minimal drizzle-orm stand-in ────────────────────────────────────────────
// K9000RedemptionService.ts only uses eq/and/inArray (plus gt/gte/ne/sql/
// notInArray, unused by settleMemberRedemptionHold but must exist so the
// static import doesn't blow up). Each returns a plain descriptor our fake
// db's `where()` can evaluate against a row.
vi.mock('drizzle-orm', () => ({
  eq: (col: string, val: any) => ({ op: 'eq', col, val }),
  and: (...args: any[]) => ({ op: 'and', args }),
  inArray: (col: string, vals: any[]) => ({ op: 'inArray', col, vals }),
  gt: (col: string, val: any) => ({ op: 'gt', col, val }),
  gte: (col: string, val: any) => ({ op: 'gte', col, val }),
  ne: (col: string, val: any) => ({ op: 'ne', col, val }),
  notInArray: (col: string, vals: any[]) => ({ op: 'notInArray', col, vals }),
  sql: (strings: TemplateStringsArray, ...vals: any[]) => ({ op: 'sql', strings, vals }),
}));

// Column identity = the field name itself, so the fake where()-evaluator can
// read `row[col]` directly. Only redemptionSessions matters for this file;
// the rest just need to exist so the module's other (unused-here) exports
// resolve without throwing.
vi.mock('@shared/schema', () => ({
  walletAccounts: {}, creditTransactions: {}, k9000WashEvents: {}, auditLedger: {},
  stationBays: {}, baySessions: {}, bayEvents: {}, bayFaults: {},
  redemptionSessions: {
    sessionId: 'sessionId', userId: 'userId', platform: 'platform', status: 'status',
    updatedAt: 'updatedAt', scannedAt: 'scannedAt', acknowledgedAt: 'acknowledgedAt',
    completedAt: 'completedAt',
  },
}));

// ── Fake db: one table (`rows`), one operation shape (update/set/where/
// returning), matching exactly what settleMemberRedemptionHold issues. ─────
type Row = { sessionId: string; userId: string; platform: string; status: string; [k: string]: any };

vi.mock('../db', () => {
  let rows: Row[] = [];
  const calls: Array<{ patch: any; matchedCount: number }> = [];

  function evalCond(cond: any, row: Row): boolean {
    if (cond.op === 'and') return cond.args.every((c: any) => evalCond(c, row));
    if (cond.op === 'eq') return row[cond.col] === cond.val;
    if (cond.op === 'inArray') return cond.vals.includes(row[cond.col]);
    throw new Error('unsupported condition in test fake: ' + JSON.stringify(cond));
  }

  const db = {
    update(_table: any) {
      return {
        set(patch: any) {
          return {
            where(cond: any) {
              return {
                returning(sel: Record<string, string>) {
                  // Synchronous match + mutate — models the atomicity of a single
                  // Postgres UPDATE ... WHERE ... RETURNING statement. No `await`
                  // occurs inside this function body, so two calls driven through
                  // Promise.all cannot interleave mid-mutation the way two
                  // concurrent Postgres backends cannot either (row lock).
                  const matched = rows.filter((r) => evalCond(cond, r));
                  matched.forEach((r) => Object.assign(r, patch));
                  calls.push({ patch, matchedCount: matched.length });
                  const out = matched.map((r) => {
                    const o: any = {};
                    for (const k of Object.keys(sel)) o[k] = r[sel[k]];
                    return o;
                  });
                  return Promise.resolve(out);
                },
              };
            },
          };
        },
      };
    },
  };

  return {
    db,
    isDatabaseAvailable: true,
    __setRows: (r: Row[]) => { rows = r.map((x) => ({ ...x })); calls.length = 0; },
    __getRows: () => rows,
    __getCalls: () => calls,
  };
});

import { settleMemberRedemptionHold } from '../services/K9000RedemptionService';
// @ts-expect-error — test-only helpers added by the mock factory above
import { __setRows, __getRows, __getCalls } from '../db';

describe('settleMemberRedemptionHold — two-phase status settle (f7e637167)', () => {
  beforeEach(() => { (__setRows as any)([]); });

  it('phase 1: pending -> scanned (the debit-committed, machine-not-yet-confirmed state)', async () => {
    (__setRows as any)([{ sessionId: 's1', userId: 'u1', platform: 'k9000', status: 'pending' }]);
    await settleMemberRedemptionHold({ userId: 'u1', status: 'scanned', washId: 'w1' });
    const row = (__getRows as any)()[0];
    expect(row.status).toBe('scanned');
    expect(row.scannedAt).toBeInstanceOf(Date);
    expect((__getCalls as any)()).toHaveLength(1);
    expect((__getCalls as any)()[0].matchedCount).toBe(1);
  });

  it('phase 2: scanned -> completed (the ONLY point "wash started" becomes true — real ACK path)', async () => {
    (__setRows as any)([{ sessionId: 's1', userId: 'u1', platform: 'k9000', status: 'scanned', scannedAt: new Date() }]);
    await settleMemberRedemptionHold({ userId: 'u1', status: 'completed', washId: 'w1' });
    const row = (__getRows as any)()[0];
    expect(row.status).toBe('completed');
    expect(row.acknowledgedAt).toBeInstanceOf(Date);
    expect(row.completedAt).toBeInstanceOf(Date);
  });

  it('a hold may also reach completed directly from pending (fast machine ACK racing the scan-status write)', async () => {
    (__setRows as any)([{ sessionId: 's1', userId: 'u1', platform: 'k9000', status: 'pending' }]);
    await settleMemberRedemptionHold({ userId: 'u1', status: 'completed', washId: 'w1' });
    expect((__getRows as any)()[0].status).toBe('completed');
  });

  it('REPLAY SAFETY: a second "scanned" call after the hold is already scanned is a no-op', async () => {
    const scannedAt = new Date('2026-01-01T00:00:00Z');
    (__setRows as any)([{ sessionId: 's1', userId: 'u1', platform: 'k9000', status: 'scanned', scannedAt }]);
    await settleMemberRedemptionHold({ userId: 'u1', status: 'scanned' });
    const row = (__getRows as any)()[0];
    expect(row.status).toBe('scanned');
    expect(row.scannedAt).toBe(scannedAt); // untouched — the update matched zero rows
    expect((__getCalls as any)()[0].matchedCount).toBe(0);
  });

  it('REPLAY SAFETY: a duplicated machine ACK ("completed" delivered twice) never regresses or errors', async () => {
    const completedAt = new Date('2026-01-01T00:00:00Z');
    (__setRows as any)([{ sessionId: 's1', userId: 'u1', platform: 'k9000', status: 'completed', completedAt }]);
    await expect(settleMemberRedemptionHold({ userId: 'u1', status: 'completed' })).resolves.toBeUndefined();
    const row = (__getRows as any)()[0];
    expect(row.status).toBe('completed');
    expect(row.completedAt).toBe(completedAt); // untouched — replayed ACK matched nothing
    expect((__getCalls as any)()[0].matchedCount).toBe(0);
  });

  it('NEVER regresses: "scanned" cannot downgrade an already-"completed" hold', async () => {
    // Out-of-order delivery (e.g. a delayed retry of the /redeem-wash "scanned"
    // write arriving AFTER the machine's ACK already marked it "completed").
    (__setRows as any)([{ sessionId: 's1', userId: 'u1', platform: 'k9000', status: 'completed' }]);
    await settleMemberRedemptionHold({ userId: 'u1', status: 'scanned' });
    expect((__getRows as any)()[0].status).toBe('completed'); // still completed, not downgraded
  });

  it('CONCURRENCY: two simultaneous ACKs (Promise.all) settle to "completed" exactly once', async () => {
    (__setRows as any)([{ sessionId: 's1', userId: 'u1', platform: 'k9000', status: 'scanned' }]);
    await Promise.all([
      settleMemberRedemptionHold({ userId: 'u1', status: 'completed', correlationId: 'a' }),
      settleMemberRedemptionHold({ userId: 'u1', status: 'completed', correlationId: 'b' }),
    ]);
    expect((__getRows as any)()[0].status).toBe('completed');
    const matchCounts = (__getCalls as any)().map((c: any) => c.matchedCount).sort();
    // Exactly one of the two UPDATEs actually changed the row; the other
    // matched zero rows once the first had already flipped status away from
    // an open state — the same guarantee a real Postgres row lock provides.
    expect(matchCounts).toEqual([0, 1]);
  });

  it('unscoped by design: settle moves EVERY open hold for the user, not just one sessionId — ' +
      'this is what closes the residual double-pending-QR window (see k9000GenerateQrPendingRace test)', async () => {
    (__setRows as any)([
      { sessionId: 'sA', userId: 'u1', platform: 'k9000', status: 'pending' },
      { sessionId: 'sB', userId: 'u1', platform: 'k9000', status: 'pending' },
    ]);
    await settleMemberRedemptionHold({ userId: 'u1', status: 'scanned' });
    const rows = (__getRows as any)();
    expect(rows.every((r: Row) => r.status === 'scanned')).toBe(true);
  });

  it('scopes strictly to the caller\'s userId + platform (never touches another member\'s hold)', async () => {
    (__setRows as any)([
      { sessionId: 's1', userId: 'u1', platform: 'k9000', status: 'pending' },
      { sessionId: 's2', userId: 'u2', platform: 'k9000', status: 'pending' },
    ]);
    await settleMemberRedemptionHold({ userId: 'u1', status: 'scanned' });
    const rows = (__getRows as any)();
    expect(rows.find((r: Row) => r.sessionId === 's1')!.status).toBe('scanned');
    expect(rows.find((r: Row) => r.sessionId === 's2')!.status).toBe('pending'); // untouched
  });

  it('FAIL-SOFT CONTRACT: never throws even if the underlying db call rejects (money is already committed)', async () => {
    const dbMod: any = await import('../db');
    const originalUpdate = dbMod.db.update;
    dbMod.db.update = () => { throw new Error('simulated connection drop'); };
    try {
      await expect(
        settleMemberRedemptionHold({ userId: 'u1', status: 'completed' }),
      ).resolves.toBeUndefined();
    } finally {
      dbMod.db.update = originalUpdate;
    }
  });
});
