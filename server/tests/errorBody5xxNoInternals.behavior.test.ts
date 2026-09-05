/**
 * AGENT-14 privacy lane — BEHAVIORAL test on the WIRE.
 *
 * Everything else in this lane tests helpers in isolation or pins source with
 * a grep. This test boots a real Express app, mounts the REAL
 * server/routes/unified-vouchers.ts router (db + auth + service stubbed), makes
 * the service throw the exact exception shapes production throws, and inspects
 * the bytes that come back over HTTP.
 *
 * Contract asserted:
 *   1. a 5xx body carries NO stack, NO file path, NO SQL, NO customer email,
 *      NO secret name — nothing but a generic message and a trace id
 *   2. the trace id survives, so support can still correlate
 *   3. an authored 4xx domain message still reaches the caller (the fix must
 *      not turn the product into "something went wrong")
 *   4. the exception is still logged server-side — sanitized, not swallowed
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import express from 'express';
import request from 'supertest';

// ── stubs ───────────────────────────────────────────────────────────────────
const thrower = { fn: (): any => undefined };

/** One voucher, owned by the authenticated test user, so ownership gates pass
 *  and execution reaches the catch block we are actually testing. */
const OWNED_VOUCHER = {
  id: 'abc',
  serialNumber: 'S1',
  ownerUserId: 'test-uid',
  purchasedByUserId: 'test-uid',
  recipientEmail: null,
  valueRemaining: '50',
  status: 'ACTIVE',
};

vi.mock('../db', () => {
  const rows: any = [OWNED_VOUCHER];
  rows.limit = async () => [OWNED_VOUCHER];
  const chain: any = {
    from: () => chain,
    where: () => chain,
    orderBy: () => chain,
    limit: async () => [OWNED_VOUCHER],
    then: (r: any) => Promise.resolve([OWNED_VOUCHER]).then(r),
  };
  return { db: { select: () => chain } };
});

vi.mock('../customAuth', () => ({
  requireAuth: (req: any, _res: any, next: any) => {
    req.user = { uid: 'test-uid' };
    next();
  },
}));

vi.mock('../services/unifiedVoucherService', () => ({
  issueVoucher: async () => thrower.fn(),
  generateQrToken: async () => thrower.fn(),
  redeemVoucher: async () => thrower.fn(),
  cancelVoucher: async () => thrower.fn(),
  adjustVoucherBalance: async () => thrower.fn(),
  getVoucherWithBalance: async () => thrower.fn(),
  verifyVoucherIntegrity: async () => thrower.fn(),
}));

const logged: string[] = [];
vi.mock('../lib/logger', () => ({
  logger: {
    debug: (m: string, c?: any) => logged.push(`${m} ${JSON.stringify(c ?? {})}`),
    info: (m: string, c?: any) => logged.push(`${m} ${JSON.stringify(c ?? {})}`),
    warn: (m: string, c?: any) => logged.push(`${m} ${JSON.stringify(c ?? {})}`),
    error: (m: string, c?: any) => logged.push(`${m} ${JSON.stringify(c ?? {})}`),
  },
  generateCorrelationId: () => 'cid',
}));

const { default: vouchersRouter } = await import('../routes/unified-vouchers');

function app() {
  const a = express();
  a.use(express.json());
  a.use('/api/v2/vouchers', vouchersRouter);
  return a;
}

/** Exception shapes production actually throws. */
const PG_UNIQUE = Object.assign(
  new Error(
    'duplicate key value violates unique constraint "unified_vouchers_serial_key" DETAIL: Key (email)=(alice@example.co.il) already exists.',
  ),
  { code: '23505' },
);
const SECRET_LEAK = new Error('Missing process.env.SUMIT_API_KEY — cannot sign request');
const DB_DOWN = new Error('connect ECONNREFUSED 127.0.0.1:5432');

/** Substrings that must never appear in any response body. */
const FORBIDDEN = [
  'alice@example.co.il',
  'unified_vouchers_serial_key',
  'duplicate key',
  'DETAIL:',
  'SUMIT_API_KEY',
  'process.env',
  'ECONNREFUSED',
  '127.0.0.1',
  '5432',
  '/app/server',
  'node_modules',
  '.ts:',
  '    at ',
  '23505',
];

function assertClean(bodyText: string) {
  for (const bad of FORBIDDEN) {
    expect(bodyText, `response leaked "${bad}"`).not.toContain(bad);
  }
  expect(bodyText).not.toMatch(/\bstack\b/i);
}

describe('AGENT-14 · 5xx bodies carry no internal detail (real router, real HTTP)', () => {
  beforeEach(() => {
    logged.length = 0;
  });

  for (const [name, err] of [
    ['a Postgres unique violation quoting a customer email', PG_UNIQUE],
    ['a missing-secret error naming the env var', SECRET_LEAK],
    ['a database-down network error', DB_DOWN],
  ] as Array<[string, Error]>) {
    it(`GET /serial/:sn — ${name} → generic 500, nothing internal on the wire`, async () => {
      thrower.fn = () => {
        throw err;
      };
      const res = await request(app()).get('/api/v2/vouchers/serial/S1');

      expect(res.status).toBe(500);
      const text = JSON.stringify(res.body);
      assertClean(text);

      // Still useful to a human: a stable message + a trace id to quote.
      expect(res.body.success).toBe(false);
      expect(typeof res.body.error).toBe('string');
      expect(res.body.error.length).toBeGreaterThan(0);
      expect(typeof res.body.traceId).toBe('string');
      expect(res.body.traceId.length).toBeGreaterThan(0);
    });

    it(`GET /serial/:sn — ${name} → still logged server-side (sanitized, not swallowed)`, async () => {
      thrower.fn = () => {
        throw err;
      };
      await request(app()).get('/api/v2/vouchers/serial/S1');
      expect(logged.length, 'the exception was swallowed with no server log').toBeGreaterThan(0);
      expect(logged.join('\n')).toContain('[UV] Get voucher failed');
    });
  }

  it('POST /redeem/web — an internal exception does not leak, and 4xx stays a 4xx', async () => {
    thrower.fn = () => {
      throw PG_UNIQUE;
    };
    const res = await request(app())
      .post('/api/v2/vouchers/redeem/web')
      .send({ voucherId: 'abc' });

    assertClean(JSON.stringify(res.body));
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Could not redeem the voucher.');
  });

  it('an AUTHORED domain message still reaches the customer (fix must not blank the UI)', async () => {
    thrower.fn = () => {
      throw new Error('Voucher is EXPIRED');
    };
    const res = await request(app())
      .post('/api/v2/vouchers/redeem/web')
      .send({ voucherId: 'abc' });

    expect(res.body.error).toBe('Voucher is EXPIRED');
  });

  it('a non-Error throw (string) does not leak and does not crash the handler', async () => {
    thrower.fn = () => {
      throw 'raw string blowup at /app/server/routes/unified-vouchers.ts:1:1';
    };
    const res = await request(app()).get('/api/v2/vouchers/serial/S1');
    expect(res.status).toBe(500);
    assertClean(JSON.stringify(res.body));
  });
});
