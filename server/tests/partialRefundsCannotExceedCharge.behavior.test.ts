/**
 * TWO PARTIAL REFUNDS COULD HAND BACK MORE THAN WAS EVER CHARGED.
 *
 * RefundService's treasury-drain guard compared ONE refund against the charge.
 * Every partial refund passes that on its own. Two refunds of ₪600 against a
 * ₪1,000 charge are each ≤ ₪1,000, carry different idempotency keys — so the
 * idempotency guard never fires either — and together return ₪1,200.
 *
 * Nothing summed what had already gone out. The cancellation policy issues
 * partial refunds by design (the 24–72h tier refunds 50%), so this is a live
 * shape, not a hypothetical one.
 *
 * Runs against a real Postgres engine (pglite) because the fix is a SUM plus a
 * transaction-scoped advisory lock — neither of which a hand-rolled fake would
 * prove anything about.
 */
import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// vi.mock is hoisted above every top-level binding, so the factory must build
// its own instances rather than close over consts declared here.
const { pg, testDb } = vi.hoisted(() => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { PGlite: PG } = require('@electric-sql/pglite');
  const { drizzle: dz } = require('drizzle-orm/pglite');
  const client = new PG();
  return { pg: client, testDb: dz(client) };
});

vi.mock('../db', () => ({ db: testDb, pool: { query: (t: string, p?: unknown[]) => pg.query(t, p as any[]) } }));
vi.mock('../lib/logger', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }));
vi.mock('./AlertEngine', () => ({ createOrUpdateAlert: vi.fn(async () => undefined) }));
vi.mock('../middleware/auditLog', () => ({ logAuditEvent: vi.fn(async () => undefined) }));
vi.mock('../services/AlertEngine', () => ({ createOrUpdateAlert: vi.fn(async () => undefined) }));

import { requestRefund } from '../services/RefundService';

beforeAll(async () => {
  await pg.exec(`
    CREATE TABLE refund_transactions (
      id serial PRIMARY KEY,
      refund_id varchar(64) UNIQUE NOT NULL,
      idempotency_key varchar(255) UNIQUE NOT NULL,
      source_type varchar(40) NOT NULL,
      source_id varchar(128) NOT NULL,
      user_id varchar(128) NOT NULL,
      instrument varchar(24) NOT NULL,
      charged_cents integer,
      fee_cents integer NOT NULL DEFAULT 0,
      refund_cents integer NOT NULL,
      currency varchar(8) NOT NULL DEFAULT 'ILS',
      status varchar(16) NOT NULL DEFAULT 'pending',
      rail_ref varchar(128),
      sumit_credit_doc_ref varchar(128),
      billing_record_id varchar(128),
      audit_hash varchar(128),
      approval_id varchar(128),
      reason text,
      initiated_by varchar(128),
      created_at timestamp DEFAULT now(),
      updated_at timestamp DEFAULT now()
    );
  `);
});

beforeEach(async () => { await pg.exec('DELETE FROM refund_transactions;'); });

/** A card refund is recorded as a tracked pending obligation — no rail runs. */
const refund = (key: string, cents: number, charged = 100_000) =>
  requestRefund({
    sourceType: 'booking',
    sourceId: 'BR-PARTIAL-1',
    userId: 'owner-uid',
    instrument: 'card',
    refundCents: cents,
    chargedCents: charged,
    idempotencyKey: key,
    initiatedBy: 'test',
  });

describe('the cap is on the TOTAL refunded, not on one call', () => {
  it('a second partial refund that would break the ceiling is REFUSED', async () => {
    const first = await refund('k1', 60_000);   // ₪600 of ₪1,000 — fine
    expect(first.status).toBe('pending');

    // ₪600 again: passes the per-call check (600 ≤ 1000) and has its own
    // idempotency key. This is the ₪1,200 payout that used to go through.
    await expect(refund('k2', 60_000)).rejects.toThrow(/REFUND_EXCEEDS_CHARGE/);

    const rows = await pg.query<{ c: string }>('SELECT COALESCE(SUM(refund_cents),0)::text AS c FROM refund_transactions');
    expect(Number(rows.rows[0].c)).toBe(60_000);
  });

  it('partial refunds that stay inside the ceiling all succeed, to the last agora', async () => {
    expect((await refund('a', 40_000)).status).toBe('pending');
    expect((await refund('b', 35_000)).status).toBe('pending');
    expect((await refund('c', 25_000)).status).toBe('pending'); // exactly ₪1,000
    const rows = await pg.query<{ c: string }>('SELECT COALESCE(SUM(refund_cents),0)::text AS c FROM refund_transactions');
    expect(Number(rows.rows[0].c)).toBe(100_000);
  });

  it('one agora past the ceiling is still past it', async () => {
    await refund('x', 99_999);
    await expect(refund('y', 2)).rejects.toThrow(/REFUND_EXCEEDS_CHARGE/);
  });

  it('a PENDING refund counts — money owed is money out', async () => {
    // The card rail settles later. A second refund raised while the first is
    // still pending must not be waved through on the grounds that nothing has
    // physically moved yet.
    await refund('p1', 70_000);
    const [{ status }] = (await pg.query<{ status: string }>('SELECT status FROM refund_transactions')).rows;
    expect(status).toBe('pending');
    await expect(refund('p2', 40_000)).rejects.toThrow(/REFUND_EXCEEDS_CHARGE/);
  });

  it('a FAILED refund does not hold the ceiling hostage', async () => {
    await refund('f1', 70_000);
    await pg.exec("UPDATE refund_transactions SET status = 'failed';");
    // The money never left, so the customer is still owed it.
    expect((await refund('f2', 70_000)).status).toBe('pending');
  });

  it('refunds on a DIFFERENT booking are not counted against this one', async () => {
    await refund('o1', 90_000);
    const other = await requestRefund({
      sourceType: 'booking', sourceId: 'BR-OTHER', userId: 'owner-uid', instrument: 'card',
      refundCents: 90_000, chargedCents: 100_000, idempotencyKey: 'o2', initiatedBy: 'test',
    });
    expect(other.status).toBe('pending');
  });

  it('replaying the SAME key is still idempotent, and does not consume the ceiling twice', async () => {
    const one = await refund('same', 60_000);
    const two = await refund('same', 60_000);
    expect(two.idempotent).toBe(true);
    expect(two.refundId).toBe(one.refundId);
    const rows = await pg.query<{ n: string }>('SELECT COUNT(*)::text AS n FROM refund_transactions');
    expect(Number(rows.rows[0].n)).toBe(1);
  });
});

describe('the lock spans the CHECK and the INSERT — asserted on the SOURCE', () => {
  /**
   * HONESTY NOTE. pglite runs a SINGLE connection, so `Promise.all` of two
   * requestRefund calls is executed sequentially: a behavioural "race" test
   * here passes whether or not the advisory lock exists. I wrote two and then
   * removed the lock to check — they still passed. A test that cannot fail is
   * worse than no test, so the concurrency guarantee is pinned STRUCTURALLY on
   * the source instead, where breaking it does fail.
   */
  const src = readFileSync(resolve(__dirname, '..', 'services', 'RefundService.ts'), 'utf8');
  const fn = src.slice(src.indexOf('export async function requestRefund'));

  it('there is exactly ONE transaction, and the lock is the first thing in it', () => {
    expect((fn.match(/db\.transaction\(/g) ?? []).length).toBe(1);
    const tx = fn.indexOf('db.transaction(');
    const lock = fn.indexOf('pg_advisory_xact_lock', tx);
    expect(lock).toBeGreaterThan(tx);
  });

  it('the duplicate check, the SUM and the INSERT all sit INSIDE that lock', () => {
    // pg_advisory_xact_lock is TRANSACTION scoped. The first version of this
    // fix locked a transaction that only ran the SUM, so the lock was released
    // before the comparison and long before the insert — two callers both read
    // the same total, both passed, both inserted.
    const lock = fn.indexOf('pg_advisory_xact_lock');
    const dupeCheck = fn.indexOf('refundTransactions.idempotencyKey, idempotencyKey', lock);
    const sum = fn.indexOf('COALESCE(SUM(', lock);
    const insert = fn.indexOf('tx.insert(refundTransactions)', lock);
    for (const [name, at] of [['duplicate check', dupeCheck], ['sum', sum], ['insert', insert]] as const) {
      expect(at, `${name} must come after the lock`).toBeGreaterThan(lock);
    }
  });

  it('the duplicate check is done in CODE — prod has no UNIQUE index to lean on', () => {
    // refund_transactions.idempotency_key is declared UNIQUE in shared/schema.ts
    // and is NOT present in production (one of 20 declared uniques missing;
    // staged in migrations/0166, deliberately unapplied). Catching 23505 is
    // therefore not a guard, only a fallback.
    expect(fn).toMatch(/kind: "duplicate"/);
    expect(fn).toMatch(/NOT PRESENT IN\s*\n\s*\*\s*PRODUCTION/);
  });
});
